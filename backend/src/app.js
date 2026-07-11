import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.js';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';
const client = new MongoClient(mongoUri);
let db;

async function connectDatabase() {
  if (db) return db;
  await client.connect();
  db = client.db();
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ userId: 1, date: -1 });
  await db.collection('transactions').createIndex({ userId: 1, rawSms: 1 });
  await db.collection('merchantCategories').createIndex({ userId: 1, merchantName: 1 });
  await db.collection('budgets').createIndex({ userId: 1, month: 1 });
  return db;
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/direct/session', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    res.json({ connected: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export async function initializeDatabase() {
  return connectDatabase();
}

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { email, name, googleId } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'email and name are required' });
  }

  try {
    const database = await connectDatabase();
    const existing = await database.collection('users').findOne({ email });
    const user = existing || await database.collection('users').insertOne({ email, name, googleId: googleId || null, createdAt: new Date() });
    const savedUser = existing || { _id: user.insertedId, email, name, googleId: googleId || null, createdAt: new Date() };
    const token = signToken({ userId: savedUser._id.toString(), email: savedUser.email });
    res.json({ token, user: { id: savedUser._id.toString(), email: savedUser.email, name: savedUser.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const database = await connectDatabase();
    const user = await database.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
    res.json(user ? { id: user._id.toString(), email: user.email, name: user.name, googleId: user.googleId, createdAt: user.createdAt } : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  const { amount, merchant, type, date, sms } = req.body;
  if (!amount || !merchant || !type || !date || !sms) {
    return res.status(400).json({ error: 'amount, merchant, type, date and sms are required' });
  }

  try {
    const database = await connectDatabase();
    const categoryDoc = await database.collection('merchantCategories').findOne({ userId: req.user.userId, merchantName: merchant });
    const category = categoryDoc?.category || categorizeMerchant(merchant, sms, type);

    if (!categoryDoc) {
      await database.collection('merchantCategories').insertOne({ userId: req.user.userId, merchantName: merchant, category, createdAt: new Date() });
    }

    const inserted = await database.collection('transactions').insertOne({
      userId: req.user.userId,
      amount: Number(amount),
      merchant,
      type,
      category,
      date,
      rawSms: sms,
      createdAt: new Date()
    });

    res.status(201).json({ id: inserted.insertedId.toString(), userId: req.user.userId, amount: Number(amount), merchant, type, category, date, rawSms: sms, createdAt: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions/direct', async (req, res) => {
  const { amount, merchant, type, date, sms, email, name, googleId } = req.body;
  if (!amount || !merchant || !type || !date || !sms) {
    return res.status(400).json({ error: 'amount, merchant, type, date and sms are required' });
  }

  try {
    const user = await getOrCreateDirectUser(email, name, googleId);
    const transaction = await saveTransactionForUser(user._id.toString(), { amount, merchant, type, date, sms });
    res.status(transaction.duplicate ? 200 : 201).json({ success: true, ...transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct/transactions', async (req, res) => {
  const { search = '', type = '', page = 1, limit = 20, month = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    const result = await getTransactionsForUser(user._id.toString(), { search, type, offset, limit: Number(limit), month });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct/insights', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    res.json(await buildInsightsForUser(user._id.toString(), req.query.month));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct/budgets', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    const database = await connectDatabase();
    const result = await database.collection('budgets').find({ userId: { $in: getUserIdVariants(user._id.toString()) } }).sort({ createdAt: -1 }).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/direct/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const user = await getOrCreateDirectUser(req.body.email, req.body.name);
    const database = await connectDatabase();
    const { startOfMonth, endOfMonth } = getMonthDateRange(req.body.month);
    const userIdQuery = buildUserIdQuery(user._id.toString());
    
    const [transactions, budgets, allTransactions] = await Promise.all([
      database.collection('transactions').find({ ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } }).sort({ date: -1, createdAt: -1 }).limit(100).toArray(),
      database.collection('budgets').find({ userId: { $in: getUserIdVariants(user._id.toString()) } }).toArray(),
      database.collection('transactions').find({ ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } }).toArray()
    ]);
    
    // Calculate total spending and categories
    const totalSpending = allTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount), 0);
    const categories = {};
    allTransactions.filter(t => t.type === 'debit').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
    });
    const categoryArray = Object.entries(categories).map(([cat, total]) => ({ category: cat, total }));
    
    const answer = await generateAssistantReply({
      message,
      month: req.body.month,
      transactions,
      budgets,
      totalSpending,
      categories: categoryArray,
      userName: user.name
    });
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/direct/history', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.body.email, req.body.name);
    const deleted = await clearHistoryForUser(user._id.toString());
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  const { search = '', type = '', page = 1, limit = 20, month = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    res.json(await getTransactionsForUser(req.user.userId, { search, type, offset, limit: Number(limit), month }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/insights', authMiddleware, async (req, res) => {
  try {
    res.json(await buildInsightsForUser(req.user.userId, req.query.month));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/budgets', authMiddleware, async (req, res) => {
  try {
    const database = await connectDatabase();
    const result = await database.collection('budgets').find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/budgets', authMiddleware, async (req, res) => {
  const { category, monthlyLimit, month } = req.body;
  if (!category || !monthlyLimit || !month) {
    return res.status(400).json({ error: 'category, monthlyLimit and month are required' });
  }

  try {
    const database = await connectDatabase();
    const result = await database.collection('budgets').insertOne({ userId: req.user.userId, category, monthlyLimit: Number(monthlyLimit), month, createdAt: new Date() });
    res.status(201).json({ id: result.insertedId.toString(), userId: req.user.userId, category, monthlyLimit: Number(monthlyLimit), month, createdAt: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const database = await connectDatabase();
    const { startOfMonth, endOfMonth } = getMonthDateRange(req.body.month);
    const userIdQuery = buildUserIdQuery(req.user.userId);
    
    const [transactions, budgets, allTransactions] = await Promise.all([
      database.collection('transactions').find({ ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } }).sort({ date: -1 }).limit(100).toArray(),
      database.collection('budgets').find({ userId: { $in: getUserIdVariants(req.user.userId) } }).toArray(),
      database.collection('transactions').find({ ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } }).toArray()
    ]);
    
    // Calculate total spending and categories
    const totalSpending = allTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount), 0);
    const categories = {};
    allTransactions.filter(t => t.type === 'debit').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
    });
    const categoryArray = Object.entries(categories).map(([cat, total]) => ({ category: cat, total }));
    
    const answer = await generateAssistantReply({
      message,
      month: req.body.month,
      transactions,
      budgets,
      totalSpending,
      categories: categoryArray
    });
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function categorizeMerchant(merchant = '', sms = '', type = '') {
  const lowered = `${merchant} ${sms}`.toLowerCase();

  if (/(salary|credited by employer|interest credited|refund|cashback|investment|mutual fund|sip|deposit|fd|loan emi|emi|insurance|credit card|finance|bank|wallet)/.test(lowered)) {
    return type === 'credit' ? 'Income' : 'Finance';
  }
  if (/(swiggy|zomato|restaurant|cafe|coffee|pizza|burger|biryani|eatery|food|dining)/.test(lowered)) {
    return 'Food';
  }
  if (/(dmart|bigbasket|blinkit|zepto|jiomart|grocery|supermarket|mart|fresh|grocers|reliance fresh)/.test(lowered)) {
    return 'Groceries';
  }
  if (/(uber|ola|rapido|metro|irctc|fuel|petrol|diesel|transport|bus|train|cab|fastag)/.test(lowered)) {
    return 'Transport';
  }
  if (/(amazon|flipkart|myntra|meesho|ajio|shopping|store|retail)/.test(lowered)) {
    return 'Shopping';
  }
  if (/(rent|electric|water|gas|broadband|wifi|recharge|postpaid|bill|utility|subscription|netflix|spotify|prime)/.test(lowered)) {
    return 'Bills';
  }
  if (/(movie|bookmyshow|game|gaming|entertainment|hotstar|sony liv)/.test(lowered)) {
    return 'Entertainment';
  }

  return type === 'credit' ? 'Income' : 'Other';
}

async function getOrCreateDirectUser(email, name, googleId = null) {
  const database = await connectDatabase();
  const userEmail = email || process.env.DEFAULT_EMAIL || 'default@expense-tracker.local';
  const userName = name || process.env.DEFAULT_NAME || 'Phone SMS';

  let user = await database.collection('users').findOne({ email: userEmail });
  if (!user) {
    const createdAt = new Date();
    const created = await database.collection('users').insertOne({
      email: userEmail,
      name: userName,
      googleId,
      createdAt
    });
    user = { _id: created.insertedId, email: userEmail, name: userName, googleId, createdAt };
  }

  return user;
}

function publicUser(user) {
  return { id: user._id.toString(), email: user.email, name: user.name };
}

function getUserIdVariants(userId) {
  if (userId instanceof ObjectId) {
    return [userId, userId.toString()];
  }

  if (typeof userId === 'string' && ObjectId.isValid(userId)) {
    return [userId, new ObjectId(userId)];
  }

  return [userId];
}

function buildUserIdQuery(userId) {
  return { userId: { $in: getUserIdVariants(userId) } };
}

async function clearHistoryForUser(userId) {
  const database = await connectDatabase();
  const userIdQuery = buildUserIdQuery(userId);
  const [transactions, merchantCategories, budgets] = await Promise.all([
    database.collection('transactions').deleteMany(userIdQuery),
    database.collection('merchantCategories').deleteMany({ userId: { $in: getUserIdVariants(userId) } }),
    database.collection('budgets').deleteMany({ userId: { $in: getUserIdVariants(userId) } })
  ]);

  return {
    transactions: transactions.deletedCount,
    merchantCategories: merchantCategories.deletedCount,
    budgets: budgets.deletedCount
  };
}

async function saveTransactionForUser(userId, { amount, merchant, type, date, sms }) {
  const database = await connectDatabase();
  const normalizedMerchant = merchant || 'Unknown';
  const userIdQuery = buildUserIdQuery(userId);
  const existing = await database.collection('transactions').findOne({ ...userIdQuery, rawSms: sms });
  if (existing) {
    return { ...formatTransaction(existing), duplicate: true };
  }

  const categoryDoc = await database.collection('merchantCategories').findOne({ userId: { $in: getUserIdVariants(userId) }, merchantName: normalizedMerchant });
  const category = categoryDoc?.category || categorizeMerchant(normalizedMerchant, sms, type);

  if (!categoryDoc) {
    await database.collection('merchantCategories').insertOne({ userId, merchantName: normalizedMerchant, category, createdAt: new Date() });
  }

  const createdAt = new Date();
  const transaction = {
    userId,
    amount: Number(amount),
    merchant: normalizedMerchant,
    type,
    category,
    date,
    rawSms: sms,
    createdAt
  };
  const inserted = await database.collection('transactions').insertOne(transaction);
  return { ...transaction, id: inserted.insertedId.toString(), duplicate: false };
}

function getMonthDateRange(month) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = normalizedMonth.split('-').map(Number);
  const startOfMonth = `${normalizedMonth}-01`;
  const endOfMonth = new Date(year, monthNumber, 0).toISOString().split('T')[0];
  return { normalizedMonth, startOfMonth, endOfMonth };
}

async function getTransactionsForUser(userId, { search = '', type = '', offset = 0, limit = 20, month = '' } = {}) {
  const database = await connectDatabase();
  const { normalizedMonth, startOfMonth, endOfMonth } = getMonthDateRange(month);
  const userIdQuery = buildUserIdQuery(userId);
  const query = { ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } };
  if (search) query.merchant = { $regex: search, $options: 'i' };
  if (type) query.type = type;

  const items = await database.collection('transactions')
    .find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .toArray();

  const [total, monthRows] = await Promise.all([
    database.collection('transactions').countDocuments(query),
    database.collection('transactions').aggregate([
      { $match: { ...userIdQuery, date: { $type: 'string' } } },
      { $project: { month: { $substr: ['$date', 0, 7] } } },
      { $group: { _id: '$month' } },
      { $sort: { _id: -1 } }
    ]).toArray()
  ]);

  return {
    items: items.map(formatTransaction),
    total,
    selectedMonth: normalizedMonth,
    availableMonths: monthRows.map((row) => row._id).filter(Boolean)
  };
}

async function buildInsightsForUser(userId, month = '') {
  const database = await connectDatabase();
  const { normalizedMonth, startOfMonth, endOfMonth } = getMonthDateRange(month);
  const userIdQuery = buildUserIdQuery(userId);

  const [transactions, allTransactions] = await Promise.all([
    database.collection('transactions')
      .find({ ...userIdQuery, date: { $gte: startOfMonth, $lte: endOfMonth } })
      .toArray(),
    database.collection('transactions')
      .find({ ...userIdQuery, date: { $type: 'string' } })
      .sort({ date: 1, createdAt: 1 })
      .toArray()
  ]);
    
  const totalExpense = transactions.filter((item) => item.type === 'debit').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = transactions.filter((item) => item.type === 'credit').reduce((sum, item) => sum + Number(item.amount), 0);
  const monthlySpending = totalExpense;
  const largestExpense = transactions.filter((item) => item.type === 'debit').sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;

  const monthlyTrend = Object.entries(allTransactions.reduce((acc, item) => {
    const month = item.date.slice(0, 7);
    acc[month] = (acc[month] || 0) + (item.type === 'debit' ? Number(item.amount) : 0);
    return acc;
  }, {})).map(([month, expense]) => ({ month, expense })).slice(-6);

  const dailyTrend = Object.values(transactions.reduce((acc, item) => {
    const day = item.date.slice(8, 10);
    if (!acc[day]) {
      acc[day] = { day, expense: 0, income: 0 };
    }
    if (item.type === 'debit') {
      acc[day].expense += Number(item.amount);
    } else {
      acc[day].income += Number(item.amount);
    }
    return acc;
  }, {})).sort((a, b) => Number(a.day) - Number(b.day));

  const categories = transactions.filter((item) => item.type === 'debit').reduce((acc, item) => {
    const category = categorizeMerchant(item.merchant, item.rawSms, item.type);
    acc[category] = (acc[category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const categoryRows = Object.entries(categories).map(([category, total]) => ({ category, total }));
  const prediction = computePrediction(monthlyTrend);
  const savingsSuggestion = computeSavingsSuggestion({ monthly_spending: monthlySpending });

  return {
    summary: { total_expense: totalExpense, total_income: totalIncome, monthly_spending: monthlySpending, month: normalizedMonth },
    largestExpense: largestExpense ? { merchant: largestExpense.merchant, amount: largestExpense.amount } : null,
    monthlyTrend,
    dailyTrend,
    categories: categoryRows,
    prediction,
    savingsSuggestion
  };
}

function formatTransaction(item) {
  return {
    ...item,
    category: categorizeMerchant(item.merchant, item.rawSms, item.type),
    id: item._id?.toString?.() || item.id
  };
}

async function generateAssistantReply({ message, month, transactions, budgets, totalSpending, categories, userName = 'User' }) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return generateChatReply(message, transactions, budgets, totalSpending, categories);
  }

  try {
    return await callGeminiAssistant({
      apiKey: geminiApiKey,
      message,
      month,
      transactions,
      budgets,
      totalSpending,
      categories,
      userName
    });
  } catch (error) {
    console.error('Gemini request failed, using local fallback:', error.message);
    return generateChatReply(message, transactions, budgets, totalSpending, categories);
  }
}

async function callGeminiAssistant({ apiKey, message, month, transactions, budgets, totalSpending, categories, userName }) {
  const monthLabel = month && /^\d{4}-\d{2}$/.test(month)
    ? new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'the selected month';

  const recentTransactions = transactions.slice(0, 25).map((tx) => ({
    merchant: tx.merchant,
    amount: Number(tx.amount),
    type: tx.type,
    category: categorizeMerchant(tx.merchant, tx.rawSms, tx.type),
    date: tx.date
  }));

  const promptContext = {
    user: userName,
    selectedMonth: month || null,
    selectedMonthLabel: monthLabel,
    summary: {
      totalSpending: Number(totalSpending || 0),
      totalTransactions: transactions.length,
      debitTransactions: transactions.filter((tx) => tx.type === 'debit').length,
      creditTransactions: transactions.filter((tx) => tx.type === 'credit').length
    },
    budgets,
    categoryTotals: categories,
    recentTransactions
  };

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      system_instruction: 'You are a personal finance assistant for an expense tracker. Answer only using the provided budget and transaction data. Be concise, practical, and specific. If asked to summarize a budget, clearly mention overspending risk, top categories, and simple next steps.',
      generation_config: {
        temperature: 0.4,
        thinking_level: 'low'
      },
      input: `User question: ${message}\n\nFinance data:\n${JSON.stringify(promptContext, null, 2)}`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return extractGeminiText(data) || 'I could not generate a response from Gemini right now.';
}

function extractGeminiText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textBlocks = (data?.steps || [])
    .flatMap((step) => step?.content || [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text.trim())
    .filter(Boolean);

  return textBlocks.join('\n\n').trim();
}

function computePrediction(monthlyTrend = []) {
  if (!monthlyTrend.length) return { nextMonthExpense: 0, trend: 'No data yet' };
  const last = Number(monthlyTrend[monthlyTrend.length - 1]?.expense || 0);
  const previous = Number(monthlyTrend[monthlyTrend.length - 2]?.expense || 0);
  const growth = last - previous;
  return {
    nextMonthExpense: Math.max(0, last + growth),
    trend: growth >= 0 ? 'Rising' : 'Cooling down'
  };
}

function computeSavingsSuggestion(summary = {}) {
  const monthlySpend = Number(summary.monthly_spending || 0);
  if (monthlySpend > 20000) return 'Consider trimming discretionary purchases this month.';
  if (monthlySpend > 10000) return 'You are close to your comfort zone; small changes can save more.';
  return 'You are managing spend well. Keep tracking daily.';
}

function generateChatReply(message, transactions, budgets = [], totalSpending = 0, categories = []) {
  const lowered = message.toLowerCase();
  
  // Budget-related queries
  if (lowered.includes('budget')) {
    if (!budgets || budgets.length === 0) {
      return 'You don\'t have any budgets set yet. Set budget limits for each category to track your spending better.';
    }
    const budgetSummary = budgets.map(b => {
      const spent = transactions.filter(t => t.category === b.category).reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = Math.round((spent / b.monthlyLimit) * 100);
      const status = percentage > 100 ? '⚠️ Over budget' : percentage > 80 ? '⚠️ Almost there' : '✅ On track';
      return `${b.category}: ${spent.toFixed(0)} / ${b.monthlyLimit} (${percentage}%) ${status}`;
    }).join('. ');
    return `Budget status: ${budgetSummary}`;
  }
  
  // Spending trend queries
  if (lowered.includes('spend') || lowered.includes('spent')) {
    if (lowered.includes('most')) {
      const categorySpending = {};
      transactions.forEach(tx => {
        categorySpending[tx.category] = (categorySpending[tx.category] || 0) + Number(tx.amount);
      });
      const topCategory = Object.entries(categorySpending).sort((a, b) => b[1] - a[1])[0];
      if (topCategory) {
        return `You spend the most on ${topCategory[0]}: INR ${topCategory[1].toFixed(2)}. Consider optimizing this category.`;
      }
    }
    if (lowered.includes('food')) {
      const foodSpend = transactions.filter(t => t.category === 'Food').reduce((sum, t) => sum + Number(t.amount), 0);
      const foodCount = transactions.filter(t => t.category === 'Food').length;
      return `Food spending: INR ${foodSpend.toFixed(2)} across ${foodCount} transactions. This is your ${categories?.sort((a, b) => b.total - a.total).findIndex(c => c.category === 'Food') === 0 ? 'top' : 'major'} expense category.`;
    }
    if (lowered.includes('category')) {
      const top3 = categories?.sort((a, b) => b.total - a.total).slice(0, 3) || [];
      return `Your top spending categories: ${top3.map(c => `${c.category} (INR ${c.total.toFixed(2)})`).join(', ')}`;
    }
  }
  
  // Savings queries
  if (lowered.includes('save') || lowered.includes('saving')) {
    if (totalSpending > 30000) {
      return 'Your monthly spending is quite high (INR ' + totalSpending.toFixed(0) + '). Try reducing discretionary purchases like food delivery and entertainment.';
    }
    if (totalSpending > 15000) {
      return 'Your spending is moderate at INR ' + totalSpending.toFixed(0) + ' monthly. You could save more by cutting one major category by 10-15%.';
    }
    return 'Your spending is well-managed at INR ' + totalSpending.toFixed(0) + ' monthly. Keep maintaining this habit!';
  }
  
  // Prediction queries
  if (lowered.includes('predict') || lowered.includes('next month') || lowered.includes('forecast')) {
    const avgMonthlySpend = transactions.length > 0 ? transactions.reduce((sum, t) => sum + Number(t.amount), 0) / Math.max(1, transactions.length) * 30 : 0;
    return `Based on your current spending pattern, your next month might cost around INR ${avgMonthlySpend.toFixed(0)}. Monitor your daily transactions to stay within budget.`;
  }
  
  // Merchant queries
  if (lowered.includes('merchant') || lowered.includes('where')) {
    const merchantSpending = {};
    transactions.forEach(tx => {
      merchantSpending[tx.merchant] = (merchantSpending[tx.merchant] || 0) + Number(tx.amount);
    });
    const topMerchant = Object.entries(merchantSpending).sort((a, b) => b[1] - a[1])[0];
    if (topMerchant) {
      return `You spend the most at ${topMerchant[0]}: INR ${topMerchant[1].toFixed(2)}.`;
    }
  }
  
  // General queries
  if (lowered.includes('recent') || lowered.includes('latest')) {
    if (transactions.length === 0) return 'No recent transactions found. Start by receiving SMS from your bank.';
    const recent = transactions.slice(0, 3);
    return `Your recent transactions: ${recent.map(t => `${t.merchant} - INR ${t.amount} (${t.category})`).join('; ')}`;
  }
  
  if (lowered.includes('total') || lowered.includes('all')) {
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const debitCount = transactions.filter(t => t.type === 'debit').length;
    return `Total transactions: ${transactions.length}. Total amount: INR ${total.toFixed(2)} with ${debitCount} debits. Your average transaction is INR ${(total / Math.max(1, transactions.length)).toFixed(2)}.`;
  }
  
  // Default response
  if (transactions.length === 0) {
    return 'No transaction data yet. Ask about: spending, budget, categories, savings, predictions, or recent transactions once you have data.';
  }
  return 'I can answer questions about: spending trends, budget status, category analysis, savings opportunities, monthly predictions, or your recent transactions. What would you like to know?';
}

export default app;
