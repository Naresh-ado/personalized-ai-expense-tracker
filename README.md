<<<<<<< HEAD
# AI Expense Tracker

A full-stack personal expense tracker with an Android SMS collector, a Node.js + Express backend, a PostgreSQL database, a React dashboard, and AI-driven insights.

## Project structure

- mobile/: Android app written in Kotlin.
- backend/: Express API with PostgreSQL + JWT + Swagger.
- website/: Vite + React + Tailwind dashboard.
- docs/: SQL schema, sample data, and Postman collection.

## Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Website

```bash
cd website
npm install
npm run dev
```

### Database

Make sure MongoDB is running locally on port 27017, then start the backend. The app will create the required collections automatically.

```bash
mongod
```

## Environment variables

Backend uses:

- PORT
- MONGODB_URI
- JWT_SECRET
- NODE_ENV
- CORS_ORIGIN

## API routes

- GET /api/health
- POST /api/auth/login
- GET /api/auth/me
- POST /api/transactions
- GET /api/transactions
- GET /api/insights
- GET /api/budgets
- POST /api/budgets
- POST /api/chat

## Android app

1. Open Android Studio.
2. Open the mobile folder as a project.
3. Install the Android SDK.
4. Run the app on an emulator or physical device.
5. Grant SMS permissions.
6. Point the app to your backend URL in MainActivity.kt and SmsReceiver.kt.

## Deployment notes

- Use a managed PostgreSQL service.
- Deploy the backend to Render, Railway, or Fly.io.
- Deploy the website to Vercel or Netlify.
- Serve the backend behind HTTPS.

## Folder and file guide

- mobile/: Android app source and manifest.
- mobile/app/src/main/java/com/aiexpensetracker/mobile/MainActivity.kt: app entry point and transaction sync UI.
- mobile/app/src/main/java/com/aiexpensetracker/mobile/SmsReceiver.kt: background SMS receiver for banking messages.
- backend/: Express API server and route definitions.
- backend/src/app.js: authentication, database initialization, transaction ingestion, and analytics endpoints.
- backend/src/server.js: boots the HTTP server.
- website/: React + Vite dashboard.
- website/src/App.jsx: dashboard, charts, transaction list, and AI chat experience.
- docs/: SQL schema, sample data, and Postman collection.
=======
# Personalized-AI-Expense-Tracker
AI Expense Tracker is a full-stack finance application that automates expense tracking using an Android app, Node.js/Express, MongoDB, and React. With SMS permission, it reads bank transaction messages, extracts details like amount, merchant, date, and transaction type, then stores and displays them on a web dashboard.
>>>>>>> 2860a1fd361cb8e01d47511b48ed9ff9a0ade394
