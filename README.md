# AI Expense Tracker

A full-stack personal expense tracker with an Android SMS collector, Node.js/Express backend, MongoDB database, React dashboard with advanced analytics, AI-driven insights, and report generation.

**Status:** ✅ Production Ready with All Features Implemented

## 🎯 Features

### Core Features
- ✅ **SMS Transaction Fetching**: Automatic SMS parsing from bank messages
- ✅ **Multi-user Support**: Isolated sessions for different users
- ✅ **Real-time Sync**: Live updates from Android app (5-second refresh)
- ✅ **Budget Tracking**: Set and monitor spending limits by category
- ✅ **Category Mapping**: Automatic merchant-to-category classification

### Advanced Features (NEW)
- ✅ **Fixed User Logout Bug**: Prevents cross-user data merging
- ✅ **Advanced Statistics Dashboard**: 
  - Spending trends (line charts)
  - Category breakdown (pie/bar charts)
  - Budget vs actual spending comparisons
  - Monthly predictions with trend analysis
  - Savings suggestions based on spending patterns
- ✅ **AI-Powered Insights**: Smart responses to questions about:
  - Budget status and alerts
  - Spending patterns by category
  - Top merchants and expenses
  - Monthly predictions and forecasts
  - Savings opportunities
  - Total spending analysis
- ✅ **Report Export**:
  - PDF Reports: Comprehensive expense reports with transactions and summary
  - CSV Export: All transactions for spreadsheet analysis
- ✅ **Recurring Expense Scheduling**: Add and manage recurring payments
- ✅ **Detailed Expense List**: Browse and analyze all transactions
- ✅ **Tabbed Interface**: Organized navigation (Dashboard, Transactions, Statistics, Schedules, Export)

## 🛠️ Tech Stack

- **Frontend**: React 18 + Tailwind CSS + Recharts + Vite
- **Backend**: Node.js + Express + MongoDB + JWT
- **Mobile**: Android (Kotlin)
- **Charts**: Recharts for analytics
- **Export**: jsPDF (PDF) + PapaParse (CSV)
- **Real-time**: Axios + WebSocket-ready

## 📋 Project Structure

```
AIExpenseTracker/
├── backend/                 # Express API server
│   ├── src/
│   │   ├── app.js          # API routes, database logic, AI chat
│   │   ├── server.js       # HTTP server setup
│   │   └── swagger.js      # API documentation
│   └── package.json
├── website/                # React dashboard
│   ├── src/
│   │   ├── App.jsx         # Main app with all features
│   │   ├── index.css       # Tailwind styles
│   │   └── main.jsx        # Entry point
│   └── package.json
├── mobile/                 # Android app
│   ├── app/src/main/       # Java/Kotlin source
│   └── build.gradle
├── docs/                   # Documentation
│   ├── schema.sql
│   └── postman_collection.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB running locally or remote connection
- Android Studio (for mobile app)

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/expense_tracker
JWT_SECRET=your-secret-key-here
NODE_ENV=development
CORS_ORIGIN=*
EOF

# Start backend
npm run dev
```

The backend will:
- Listen on http://localhost:5000
- Create MongoDB collections automatically
- Provide API docs at http://localhost:5000/api-docs

### Frontend Setup

```bash
cd website
npm install

# Create .env file (optional)
cat > .env.local << EOF
VITE_API_URL=http://localhost:5000/api
VITE_DIRECT_EMAIL=your-email@gmail.com
VITE_DIRECT_NAME=Your Name
EOF

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser.

### Database Setup

MongoDB will be initialized automatically, but you can manually start it:

```bash
# On Windows
mongod

# On macOS (if installed via Homebrew)
brew services start mongodb-community

# On Linux
sudo systemctl start mongod
```

### Android App Setup

1. Open the `mobile/` folder in Android Studio
2. Update API URL in:
   - `MainActivity.kt`: Change `BACKEND_URL`
   - `SmsReceiver.kt`: Update API endpoint
3. Grant SMS and INTERNET permissions
4. Build and run on emulator or physical device

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Transactions
- `GET /api/transactions` - Get user transactions (paginated)
- `POST /api/transactions` - Add transaction (authenticated)
- `GET /api/direct/transactions` - Get direct user transactions
- `POST /api/transactions/direct` - Add transaction (direct, from app)

### Insights & Analytics
- `GET /api/insights` - Get spending insights (authenticated)
- `GET /api/direct/insights` - Get direct user insights
- `POST /api/chat` - AI chat (authenticated)
- `POST /api/direct/chat` - AI chat (direct)

### Budgets
- `GET /api/budgets` - Get user budgets (authenticated)
- `POST /api/budgets` - Create budget (authenticated)
- `GET /api/direct/budgets` - Get direct user budgets

### Session Management
- `GET /api/direct/session` - Create/get session
- `DELETE /api/direct/history` - Clear user history

## 🤖 AI Assistant Features

The AI can answer questions about:

```
1. Budget Status
   Q: "What's my budget?"
   A: Shows all budgets vs actual spending with alerts

2. Spending Analysis
   Q: "Where do I spend the most?"
   A: Shows top categories and merchants with amounts

3. Category Insights
   Q: "How much on food?"
   A: Shows food spending across all transactions

4. Predictions
   Q: "What's my next month cost?"
   A: Predicts based on spending patterns

5. Savings Tips
   Q: "How can I save?"
   A: Provides personalized suggestions based on spending

6. Recent Transactions
   Q: "Show me my recent transactions"
   A: Lists last few transactions with details
```

## 📊 Dashboard Tabs

### Dashboard Tab
- Key metrics cards (Total Expense, Income, Monthly Spending, Largest Expense)
- Spending trend chart (last 6 months)
- Category split pie chart
- Recent transactions list
- AI assistant chat

### Transactions Tab
- Full expense list with pagination
- Sortable by merchant, amount, type, category, date
- Detailed view of all transactions

### Statistics Tab
- Advanced spending by category (bar chart)
- Budget vs actual spending (progress bars)
- Monthly predictions with trend indicator
- Savings suggestions based on analysis

### Schedules Tab
- Add recurring expenses (daily, weekly, monthly, yearly)
- View all scheduled expenses
- Delete schedules
- Auto-reminder for upcoming payments

### Export Tab
- Download PDF reports (full expense summary + transactions)
- Download CSV for spreadsheet analysis
- Setup guide for API connections

## 🔐 Security Features

- JWT token-based authentication
- Session isolation for multi-user support
- CORS configuration for API security
- Helmet.js for HTTP headers security
- MongoDB unique indexes on email

## 📱 Android App Features

- Automatic SMS parsing
- Background SMS receiver (BroadcastReceiver)
- Real-time sync with backend
- Transaction categorization
- SMS permission handling
- Configurable backend URL

## 🐛 Bug Fixes

### Fixed Issues
1. **User Logout/Data Merging Bug** ✅
   - Problem: When user A logs out and user B logs in, data was merging
   - Solution: Added session ID tracking with timestamp to prevent race conditions
   - Properly clears all state and cancels pending timers on logout

2. **AI Summarizer** ✅
   - Problem: Not answering questions based on budget spend
   - Solution: Enhanced generateChatReply() to handle budget data
   - Now provides smart responses about budget status and spending patterns

## 📊 Data Models

### User
```javascript
{
  _id: ObjectId,
  email: String,
  name: String,
  googleId: String (optional),
  createdAt: Date
}
```

### Transaction
```javascript
{
  _id: ObjectId,
  userId: String,
  amount: Number,
  merchant: String,
  type: "credit" | "debit",
  category: String,
  date: String (YYYY-MM-DD),
  rawSms: String,
  createdAt: Date
}
```

### Budget
```javascript
{
  _id: ObjectId,
  userId: String,
  category: String,
  monthlyLimit: Number,
  month: String (YYYY-MM),
  createdAt: Date
}
```

### Schedule (Stored in Frontend)
```javascript
{
  id: Number,
  merchant: String,
  amount: Number,
  category: String,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  nextDate: String (YYYY-MM-DD)
}
```

## 🌍 Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/expense_tracker
JWT_SECRET=your-secret-key
NODE_ENV=development
CORS_ORIGIN=*
DEFAULT_EMAIL=nrshsenthil@gmail.com
DEFAULT_NAME=Default User
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:5000/api
VITE_DIRECT_EMAIL=nrshsenthil@gmail.com
VITE_DIRECT_NAME=NAresh
```

## 📦 Dependencies

### Backend
- express, cors, helmet
- mongodb, jsonwebtoken
- swagger-ui-express, dotenv

### Frontend
- react, react-dom
- axios, recharts
- jspdf, papaparse
- tailwindcss, postcss
- vite

## 🧪 Testing

### Test Scenarios
1. **Login** - Create new user or login existing
2. **Logout** - Verify data clearing and session termination
3. **SMS Sync** - Add transactions via Android app
4. **Charts** - Verify all visualizations load correctly
5. **Export** - Download PDF and CSV reports
6. **AI Chat** - Test various question types
7. **Budgets** - Create and monitor budgets
8. **Scheduling** - Add and delete recurring expenses

## 🚢 Deployment

### Backend Deployment
```bash
# Option 1: Render
git push heroku main

# Option 2: Railway
railway up

# Option 3: Fly.io
flyctl deploy
```

### Frontend Deployment
```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

### MongoDB Cloud
```bash
# Use MongoDB Atlas
# Connection string: mongodb+srv://user:pass@cluster.mongodb.net/expense_tracker
```

## 📝 Error Handling

The app handles:
- Network errors with fallback UI
- Database connection issues with retry logic
- Invalid input validation
- Session expiration and re-authentication
- Race conditions in multi-user scenarios

## 🤝 Contributing

1. Clone the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## 📄 License

MIT License - Use freely in personal and commercial projects

## 👥 Support

For issues or questions:
1. Check existing GitHub issues
2. Review API documentation at `/api-docs`
3. Check backend logs for errors
4. Verify MongoDB connection

## 📈 Roadmap

- [ ] Mobile push notifications for budgets
- [ ] Photo receipt capture and OCR
- [ ] Multi-card expense tracking
- [ ] Expense splitting between users
- [ ] Advanced forecasting with ML
- [ ] Tax report generation
- [ ] API for third-party integrations

## 🎉 Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| SMS Transaction Fetching | ✅ | Working from Android app |
| Multi-user Support | ✅ | Session isolation fixed |
| Budget Tracking | ✅ | Category-based budgets |
| Advanced Statistics | ✅ | Charts and predictions |
| AI Assistant | ✅ | Budget-aware responses |
| PDF Export | ✅ | Complete expense report |
| CSV Export | ✅ | For spreadsheet analysis |
| Recurring Expenses | ✅ | Customizable scheduling |
| User Logout | ✅ | No data leakage |
| Detailed Analytics | ✅ | Monthly trends |

---

**Last Updated**: 2026-07-11
**Version**: 2.0.0
**Status**: 🟢 Production Ready
