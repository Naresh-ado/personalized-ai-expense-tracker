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
    const category = categoryDoc?.category || categorizeMerchant(merchant);

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
  const { search = '', type = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    const result = await getTransactionsForUser(user._id.toString(), { search, type, offset, limit: Number(limit) });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct/insights', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    res.json(await buildInsightsForUser(user._id.toString()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct/budgets', async (req, res) => {
  try {
    const user = await getOrCreateDirectUser(req.query.email, req.query.name);
    const database = await connectDatabase();
    const result = await database.collection('budgets').find({ userId: user._id.toString() }).sort({ createdAt: -1 }).toArray();
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
    const transactions = await database.collection('transactions').find({ userId: user._id.toString() }).sort({ date: -1, createdAt: -1 }).limit(20).toArray();
    res.json({ answer: generateChatReply(message, transactions) });
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
  const { search = '', type = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    res.json(await getTransactionsForUser(req.user.userId, { search, type, offset, limit: Number(limit) }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/insights', authMiddleware, async (req, res) => {
  try {
    res.json(await buildInsightsForUser(req.user.userId));
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
    const transactions = await database.collection('transactions').find({ userId: req.user.userId }).sort({ date: -1 }).limit(20).toArray();
    const answer = generateChatReply(message, transactions);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function categorizeMerchant(merchant) {
  const lowered = merchant.toLowerCase();
  if (lowered.includes('swiggy') || lowered.includes('zomato') || lowered.includes('food')) return 'Food';
  if (lowered.includes('uber') || lowered.includes('ola') || lowered.includes('metro')) return 'Transport';
  if (lowered.includes('amazon') || lowered.includes('flipkart')) return 'Shopping';
  if (lowered.includes('rent') || lowered.includes('electric') || lowered.includes('bill')) return 'Bills';
  return 'Other';
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

async function clearHistoryForUser(userId) {
  const database = await connectDatabase();
  const [transactions, merchantCategories, budgets] = await Promise.all([
    database.collection('transactions').deleteMany({ userId }),
    database.collection('merchantCategories').deleteMany({ userId }),
    database.collection('budgets').deleteMany({ userId })
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
  const existing = await database.collection('transactions').findOne({ userId, rawSms: sms });
  if (existing) {
    return { ...formatTransaction(existing), duplicate: true };
  }

  const categoryDoc = await database.collection('merchantCategories').findOne({ userId, merchantName: normalizedMerchant });
  const category = categoryDoc?.category || categorizeMerchant(normalizedMerchant);

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

async function getTransactionsForUser(userId, { search = '', type = '', offset = 0, limit = 20 } = {}) {
  const database = await connectDatabase();
  const query = { userId };
  if (search) query.merchant = { $regex: search, $options: 'i' };
  if (type) query.type = type;

  const items = await database.collection('transactions')
    .find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .toArray();

  const total = await database.collection('transactions').countDocuments(query);
  return { items: items.map(formatTransaction), total };
}

async function buildInsightsForUser(userId) {
  const database = await connectDatabase();
  const transactions = await database.collection('transactions').find({ userId }).toArray();
  const totalExpense = transactions.filter((item) => item.type === 'debit').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = transactions.filter((item) => item.type === 'credit').reduce((sum, item) => sum + Number(item.amount), 0);
  const monthlySpending = transactions.filter((item) => item.type === 'debit' && new Date(item.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((sum, item) => sum + Number(item.amount), 0);
  const largestExpense = transactions.filter((item) => item.type === 'debit').sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;

  const monthlyTrend = Object.entries(transactions.reduce((acc, item) => {
    const month = item.date.slice(0, 7);
    acc[month] = (acc[month] || 0) + (item.type === 'debit' ? Number(item.amount) : 0);
    return acc;
  }, {})).map(([month, expense]) => ({ month, expense })).slice(-6);

  const categories = transactions.filter((item) => item.type === 'debit').reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const categoryRows = Object.entries(categories).map(([category, total]) => ({ category, total }));
  const prediction = computePrediction(monthlyTrend);
  const savingsSuggestion = computeSavingsSuggestion({ monthly_spending: monthlySpending });

  return {
    summary: { total_expense: totalExpense, total_income: totalIncome, monthly_spending: monthlySpending },
    largestExpense: largestExpense ? { merchant: largestExpense.merchant, amount: largestExpense.amount } : null,
    monthlyTrend,
    categories: categoryRows,
    prediction,
    savingsSuggestion
  };
}

function formatTransaction(item) {
  return { ...item, id: item._id?.toString?.() || item.id };
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

function generateChatReply(message, transactions) {
  const lowered = message.toLowerCase();
  if (lowered.includes('most this month')) {
    const top = transactions.reduce((acc, item) => acc.amount > item.amount ? acc : item, { amount: 0, merchant: 'None' });
    return `You spent the most on ${top.merchant || 'your recent purchases'} this month.`;
  }
  if (lowered.includes('food') && lowered.includes('week')) {
    const weekSpend = transactions.filter((item) => item.merchant.toLowerCase().includes('food') || item.merchant.toLowerCase().includes('swiggy') || item.merchant.toLowerCase().includes('zomato'));
    return `You logged ${weekSpend.length} food-related transactions recently.`;
  }
  if (lowered.includes('yesterday')) {
    return `You have ${transactions.length} recent debit transactions; review them in the transactions page.`;
  }
  return 'I can summarize your recent spending, categories, and predictions from your transaction history.';
}

export default app;
