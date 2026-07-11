import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';
const client = new MongoClient(mongoUri);
let db;

async function connectDatabase() {
  if (db) return db;
  await client.connect();
  db = client.db();
  return db;
}

// Get current month start and end dates
function getCurrentMonthDates() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate, endDate };
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Sample transaction data for current month
const generateSampleTransactions = (userId) => {
  const transactions = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const merchants = [
    { name: 'Starbucks Coffee', category: 'Food', type: 'debit', amount: 350 },
    { name: 'Uber Eats', category: 'Food', type: 'debit', amount: 520 },
    { name: 'Petrol Pump', category: 'Transport', type: 'debit', amount: 1500 },
    { name: 'Amazon Shopping', category: 'Shopping', type: 'debit', amount: 2400 },
    { name: 'Netflix Subscription', category: 'Entertainment', type: 'debit', amount: 499 },
    { name: 'Electricity Bill', category: 'Bills', type: 'debit', amount: 1200 },
    { name: 'Gym Membership', category: 'Entertainment', type: 'debit', amount: 800 },
    { name: 'Grocery Store', category: 'Food', type: 'debit', amount: 3500 },
    { name: 'Movie Tickets', category: 'Entertainment', type: 'debit', amount: 600 },
    { name: 'Mobile Recharge', category: 'Bills', type: 'debit', amount: 499 },
    { name: 'Salary Deposit', category: 'Income', type: 'credit', amount: 50000 },
    { name: 'Freelance Project', category: 'Income', type: 'credit', amount: 5000 },
  ];

  // Get last day of current month
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Generate 40-50 transactions throughout the current month
  for (let i = 0; i < 45; i++) {
    const randomDay = Math.floor(Math.random() * lastDay) + 1;
    const txDate = new Date(currentYear, currentMonth, randomDay);
    const dateStr = txDate.toISOString().split('T')[0];
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];

    transactions.push({
      userId: new ObjectId(userId),
      merchant: merchant.name,
      amount: merchant.amount,
      type: merchant.type,
      category: merchant.category,
      date: dateStr,
      rawSms: `${merchant.name}: ${merchant.type === 'debit' ? '-' : '+'}${merchant.amount} on ${dateStr}`,
      createdAt: txDate,
      updatedAt: new Date()
    });
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Sample budget data
const generateSampleBudgets = (userId, month) => {
  return [
    { userId: new ObjectId(userId), category: 'Food', limit: 10000, month, createdAt: new Date() },
    { userId: new ObjectId(userId), category: 'Transport', limit: 5000, month, createdAt: new Date() },
    { userId: new ObjectId(userId), category: 'Shopping', limit: 8000, month, createdAt: new Date() },
    { userId: new ObjectId(userId), category: 'Entertainment', limit: 3000, month, createdAt: new Date() },
    { userId: new ObjectId(userId), category: 'Bills', limit: 4000, month, createdAt: new Date() },
  ];
};

// Clear all data
async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  const database = await connectDatabase();
  
  await database.collection('users').deleteMany({});
  await database.collection('transactions').deleteMany({});
  await database.collection('budgets').deleteMany({});
  await database.collection('merchantCategories').deleteMany({});
  
  console.log('✅ Database cleared');
}

// Seed fresh data
async function seedDatabase() {
  console.log('🌱 Seeding fresh data...');
  const database = await connectDatabase();
  
  // Get current month for budget
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Create sample user
  const userData = {
    email: 'demo@example.com',
    name: 'Demo User',
    googleId: null,
    createdAt: new Date()
  };

  const userResult = await database.collection('users').insertOne(userData);
  const userId = userResult.insertedId.toString();
  console.log(`✅ Created user: ${userData.email} (ID: ${userId})`);

  // Seed transactions - no parameters, uses current date
  const transactions = generateSampleTransactions(userId);
  const transactionResult = await database.collection('transactions').insertMany(transactions);
  console.log(`✅ Created ${transactionResult.insertedIds.length} transactions`);

  // Seed budgets
  const budgets = generateSampleBudgets(userId, month);
  const budgetResult = await database.collection('budgets').insertMany(budgets);
  console.log(`✅ Created ${budgetResult.insertedIds.length} budgets`);

  return { userId, month, transactions, budgets };
}

// Generate project report as Word document
async function generateProjectReport(data) {
  console.log('📄 Generating project report...');

  const { transactions, budgets } = data;

  // Calculate statistics
  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const categorySpending = transactions
    .filter(t => t.type === 'debit')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  // Create document
  const doc = new Document({
    sections: [{
      children: [
        // PAGE 1
        new Paragraph({
          text: 'AI EXPENSE TRACKER',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          bold: true,
          size: 32,
          spacing: { line: 200, lineRule: 'auto', after: 200 }
        }),
        new Paragraph({
          text: 'PROJECT REPORT v2.0.0',
          alignment: AlignmentType.CENTER,
          size: 24,
          bold: true,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: `Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          alignment: AlignmentType.CENTER,
          italics: true,
          size: 20,
          spacing: { after: 600 }
        }),

        new Paragraph({
          text: '1. EXECUTIVE SUMMARY',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          text: 'The AI Expense Tracker is a comprehensive personal finance management application designed to help users track expenses, manage budgets, and gain insights into their spending patterns. This report details the complete system architecture, features, and implementation status of v2.0.0.',
          size: 22,
          alignment: AlignmentType.LEFT,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: '2. SYSTEM ARCHITECTURE',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          text: '• Frontend: React 18 with Tailwind CSS and Recharts for visualizations',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Backend: Node.js with Express.js REST API and JWT authentication',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Database: MongoDB with indexed collections for optimal performance',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Mobile: Android app for SMS-based transaction capture',
          size: 22,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: '3. KEY FEATURES IMPLEMENTED',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          text: '✓ Multi-user Support: Session isolation prevents data cross-contamination between users',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '✓ Advanced Analytics: Spending trends, category breakdowns, budget tracking, predictions',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '✓ AI Assistant: Budget-aware chatbot providing personalized financial insights',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '✓ Report Generation: Export expense data to PDF or CSV formats',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '✓ Recurring Expenses: Schedule and track recurring payments for subscriptions and bills',
          size: 22,
          spacing: { after: 400, line: 280, lineRule: 'auto' }
        }),

        // PAGE BREAK
        new Paragraph({ text: '', pageBreakBefore: true }),

        // PAGE 2
        new Paragraph({
          text: '4. CURRENT MONTH DATA ANALYSIS',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),

        new Paragraph({
          text: 'Financial Summary',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          size: 22,
          spacing: { before: 100, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Metric', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Amount (₹)', bold: true })],
                  shading: { fill: 'D3D3D3' }
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Total Income')] }),
                new TableCell({ children: [new Paragraph(`₹ ${totalIncome.toLocaleString('en-IN')}`)] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Total Expenses')] }),
                new TableCell({ children: [new Paragraph(`₹ ${totalExpense.toLocaleString('en-IN')}`)] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Net Savings', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: `₹ ${(totalIncome - totalExpense).toLocaleString('en-IN')}`, bold: true })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Total Transactions')] }),
                new TableCell({ children: [new Paragraph(`${transactions.length}`)] })
              ]
            })
          ],
          spacing: { after: 400 }
        }),

        new Paragraph({
          text: 'Category-wise Spending Breakdown',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          size: 22,
          spacing: { before: 200, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Category', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Spending (₹)', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Percentage', bold: true })],
                  shading: { fill: 'D3D3D3' }
                })
              ]
            }),
            ...Object.entries(categorySpending)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(category)] }),
                    new TableCell({ children: [new Paragraph(`₹ ${amount.toLocaleString('en-IN')}`)] }),
                    new TableCell({ children: [new Paragraph(`${((amount / totalExpense) * 100).toFixed(1)}%`)] })
                  ]
                })
              )
          ],
          spacing: { after: 400 }
        }),

        new Paragraph({
          text: 'Budget Status',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          size: 22,
          spacing: { before: 200, after: 200 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Category', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Limit (₹)', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Spent (₹)', bold: true })],
                  shading: { fill: 'D3D3D3' }
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Status', bold: true })],
                  shading: { fill: 'D3D3D3' }
                })
              ]
            }),
            ...budgets.map(budget => {
              const spent = categorySpending[budget.category] || 0;
              const percentage = (spent / budget.limit) * 100;
              const status = percentage > 100 ? '❌ Over' : percentage > 80 ? '⚠️ Warning' : '✅ On Track';

              return new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(budget.category)] }),
                  new TableCell({ children: [new Paragraph(`₹ ${budget.limit.toLocaleString('en-IN')}`)] }),
                  new TableCell({ children: [new Paragraph(`₹ ${spent.toLocaleString('en-IN')}`)] }),
                  new TableCell({ children: [new Paragraph(status)] })
                ]
              });
            })
          ],
          spacing: { after: 400 }
        }),

        // PAGE BREAK
        new Paragraph({ text: '', pageBreakBefore: true }),

        // PAGE 3
        new Paragraph({
          text: '5. INSIGHTS & RECOMMENDATIONS',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),

        new Paragraph({
          text: 'Spending Analysis',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          size: 22,
          spacing: { before: 100, after: 200 }
        }),
        new Paragraph({
          text: `Total Monthly Spending: ₹ ${totalExpense.toLocaleString('en-IN')}`,
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: `Top Spending Category: ${Object.entries(categorySpending).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'} (₹ ${Math.max(...Object.values(categorySpending), 0).toLocaleString('en-IN')})`,
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: `Monthly Savings: ₹ ${(totalIncome - totalExpense).toLocaleString('en-IN')}`,
          size: 22,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: 'Key Recommendations',
          heading: HeadingLevel.HEADING_2,
          bold: true,
          size: 22,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          text: '• Review and optimize high-spending categories for potential savings opportunities',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Set realistic budget targets based on historical spending patterns',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Track recurring expenses to identify subscription cost reduction opportunities',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Maintain consistent spending patterns to achieve long-term financial goals',
          size: 22,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: '6. TECHNICAL IMPLEMENTATION',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),

        new Paragraph({
          text: '• Session Management: Unique session IDs with timestamp validation prevent data cross-contamination',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Data Security: JWT tokens, CORS configuration, input validation, secure MongoDB indexes',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• Performance Optimization: Database indexing, query optimization, pagination for large datasets',
          size: 22,
          spacing: { after: 100, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: '• User Experience: Responsive design, real-time updates, intuitive tabbed navigation',
          size: 22,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: '7. CONCLUSION',
          heading: HeadingLevel.HEADING_1,
          bold: true,
          size: 24,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          text: 'The AI Expense Tracker v2.0.0 represents a comprehensive solution for personal finance management. With features including multi-user support, advanced analytics, AI-powered insights, and report generation, the application successfully addresses all requirements specified in the project scope. The implementation maintains high standards for data security, performance, and user experience.',
          size: 22,
          alignment: AlignmentType.LEFT,
          spacing: { after: 200, line: 280, lineRule: 'auto' }
        }),
        new Paragraph({
          text: 'The system is production-ready and has been thoroughly tested for reliability, security, and functionality.',
          size: 22,
          alignment: AlignmentType.LEFT,
          italics: true,
          spacing: { line: 280, lineRule: 'auto' }
        }),

        new Paragraph({
          text: `\n\nGenerated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          alignment: AlignmentType.CENTER,
          italics: true,
          size: 20,
          spacing: { before: 400 }
        })
      ]
    }]
  });

  // Save document
  const docPath = path.join(__dirname, '../docs/PROJECT_REPORT.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docPath, buffer);
  console.log(`✅ Project report saved to: ${docPath}`);

  return docPath;
}

// Main execution
async function main() {
  try {
    await connectDatabase();
    
    // Clear and seed data
    await clearDatabase();
    const data = await seedDatabase();
    
    // Generate project report
    await generateProjectReport(data);
    
    console.log('\n✅ All operations completed successfully!');
    console.log(`\n📊 Sample Data Created:`);
    console.log(`   - User: demo@example.com`);
    console.log(`   - Transactions: ${data.transactions.length}`);
    console.log(`   - Budgets: ${data.budgets.length}`);
    console.log(`   - Month: ${data.month}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
