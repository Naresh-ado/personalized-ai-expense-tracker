import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const docsDir = path.join(rootDir, 'docs');

const sourceFiles = [
  {
    path: 'backend/src/app.js',
    purpose: 'Main Express application. It configures security middleware, connects to MongoDB, defines API routes, performs authentication, stores transactions and budgets, builds analytics, and answers AI chat questions.',
    important: [
      ['dotenv.config();', 'Loads environment variables such as MONGODB_URI, JWT_SECRET, CORS_ORIGIN, and GEMINI_API_KEY before the app starts.'],
      ['const client = new MongoClient(mongoUri);', 'Creates the MongoDB client used by all backend database functions.'],
      ["await db.collection('users').createIndex({ email: 1 }, { unique: true });", 'Prevents duplicate user accounts for the same email.'],
      ["app.use(helmet());", 'Adds secure HTTP headers to reduce common web security risks.'],
      ["app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));", 'Allows the React website and Android app to call the backend API.'],
      ["export function authMiddleware(req, res, next) { ... }", 'Validates JWT bearer tokens before protected routes can access user data.'],
      ["app.post('/api/transactions/direct', async (req, res) => { ... })", 'Receives transaction payloads from the Android SMS collector without requiring a browser login token.'],
      ['const existing = await database.collection(\'transactions\').findOne({ ...userIdQuery, rawSms: sms });', 'Deduplicates SMS transactions by checking whether the same raw SMS has already been saved.'],
      ['function categorizeMerchant(merchant = \'\', sms = \'\', type = \'\') { ... }', 'Maps merchants and SMS keywords to categories such as Food, Transport, Shopping, Bills, and Income.'],
      ['async function buildInsightsForUser(userId, month = \'\') { ... }', 'Calculates dashboard totals, trends, category totals, predictions, and savings suggestions.'],
      ['async function generateAssistantReply({ message, month, transactions, budgets, totalSpending, categories, userName = \'User\' })', 'Uses Gemini when configured, otherwise falls back to local rule-based chat logic.']
    ]
  },
  {
    path: 'backend/src/server.js',
    purpose: 'Starts the backend HTTP server after database initialization.',
    important: [
      ["import app, { initializeDatabase } from './app.js';", 'Imports the Express app and database initialization helper.'],
      ['await initializeDatabase();', 'Ensures MongoDB is reachable and indexes are created before accepting API requests.'],
      ["app.listen(port, '0.0.0.0', () => { ... })", 'Listens on all network interfaces so the Android device can reach the backend over the local network.']
    ]
  },
  {
    path: 'backend/src/swagger.js',
    purpose: 'Defines the OpenAPI/Swagger configuration and exports API documentation specs.',
    important: [
      ["openapi: '3.0.0'", 'Declares the API documentation format.'],
      ["apis: ['./src/app.js']", 'Tells Swagger to scan backend route files for API documentation comments.'],
      ['export const specs = swaggerJSDoc(options);', 'Builds the Swagger spec consumed by /api-docs in app.js.']
    ]
  },
  {
    path: 'backend/src/seed-data.js',
    purpose: 'Utility script that clears MongoDB, inserts sample users, transactions, and budgets, and generates a sample project report. It should be used carefully because it deletes existing data.',
    important: [
      ['await database.collection(\'users\').deleteMany({});', 'Clears users during demo seeding; this is destructive and should not be run on production data.'],
      ['const transactions = generateSampleTransactions(userId);', 'Creates realistic demo expense and income records for the current month.'],
      ['await generateProjectReport(data);', 'Creates a sample report from seeded demo data.']
    ]
  },
  {
    path: 'backend/src/generate-documents.js',
    purpose: 'One-off documentation generator created for this submission. It writes the short project report and detailed file explanation Word documents.',
    important: [
      ['const sourceFiles = [ ... ];', 'Stores explanations of the important project files and key code lines.'],
      ['await Packer.toBuffer(doc);', 'Converts the document structure into a .docx file buffer.'],
      ['fs.writeFileSync(outputPath, buffer);', 'Writes the generated Word document to the docs folder.']
    ]
  },
  {
    path: 'website/src/App.jsx',
    purpose: 'Main React application. It handles login, user session isolation, data loading, dashboard tabs, charts, AI chat, schedule management, and PDF/CSV export.',
    important: [
      ["const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';", 'Chooses the backend API base URL from environment variables or local development default.'],
      ["const [user, setUser] = useState(() => loadStoredUser());", 'Restores the previously logged-in user from localStorage.'],
      ["sessionIdRef.current = `${user.email}_${user.name}_${Date.now()}`;", 'Creates a unique session marker so old async requests cannot update the next user session.'],
      ['const [insights, transactionRes, budgetRes] = await Promise.all([ ... ]);', 'Loads insights, transactions, and budgets in parallel for faster dashboard refresh.'],
      ["const timer = window.setInterval(async () => { ... }, REFRESH_MS);", 'Refreshes dashboard data every five seconds for near-real-time SMS sync.'],
      ['localStorage.setItem(USER_KEY, JSON.stringify(nextUser));', 'Persists the user identity for reloads.'],
      ['const res = await axios.post(`${API_URL}/direct/chat`, { ... });', 'Sends the user question and current finance context to the backend assistant.'],
      ['const doc = new jsPDF();', 'Creates a client-side PDF expense report.'],
      ['const csv = Papa.unparse(csvData);', 'Converts transaction rows to CSV for spreadsheet export.'],
      ["{['dashboard', 'transactions', 'statistics', 'schedules', 'export'].map(tab => ( ... ))}", 'Builds the tabbed navigation used by the dashboard.']
    ]
  },
  {
    path: 'website/src/main.jsx',
    purpose: 'React entry point. It mounts the App component into the HTML root element.',
    important: [
      ["ReactDOM.createRoot(document.getElementById('root')).render(...)", 'Starts the React application in the browser.'],
      ["import './index.css';", 'Loads Tailwind and global styling.']
    ]
  },
  {
    path: 'website/src/index.css',
    purpose: 'Global frontend stylesheet. It activates Tailwind layers and defines the dark visual theme.',
    important: [
      ['@tailwind base;', 'Loads Tailwind base styles.'],
      ['@tailwind components;', 'Loads Tailwind component utilities.'],
      ['@tailwind utilities;', 'Loads utility classes used throughout App.jsx.'],
      ['background: radial-gradient(...), linear-gradient(...);', 'Creates the dark dashboard background.']
    ]
  },
  {
    path: 'mobile/app/src/main/java/com/aiexpensetracker/mobile/MainActivity.kt',
    purpose: 'Main Android screen. It lets the user configure the backend host, connect to the server, request SMS permission, and manually start SMS sync.',
    important: [
      ['private const val PC_HOST = "10.183.6.192"', 'Default backend host for a physical Android device on the local network.'],
      ['private fun getHostCandidates(inputHost: String?): List<String>', 'Builds possible server hosts including user input, PC host, emulator host, and Genymotion host.'],
      ['Retrofit.Builder().baseUrl(HostUtils.buildBaseUrl(host))', 'Creates an API client for the selected backend host.'],
      ['apiService.health().enqueue(object : Callback<Map<String, Any>> { ... })', 'Checks whether the backend is reachable before enabling sync.'],
      ['ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS), 1001)', 'Requests SMS permissions required for transaction capture.'],
      ['WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<SmsSyncWorker>().build())', 'Starts background inbox sync through WorkManager.']
    ]
  },
  {
    path: 'mobile/app/src/main/java/com/aiexpensetracker/mobile/SmsParser.kt',
    purpose: 'Parses bank SMS messages into structured transaction data: amount, merchant, date, and debit/credit type.',
    important: [
      ['if (!isTransactionSms(body)) return null', 'Ignores messages that do not look like financial transactions.'],
      ['val amount = parseAmount(body) ?: return null', 'Requires a valid amount before creating a transaction.'],
      ['Regex("""(?:rs\\.?|inr|INR)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)', 'Finds amounts written before or after currency text.'],
      ['return if (body.contains("credit", ignoreCase = true) || body.contains("credited", ignoreCase = true))', 'Classifies SMS as credit when credit keywords are present; otherwise defaults to debit.'],
      ['knownMerchants.firstOrNull { body.contains(it, ignoreCase = true) }?.let { return it }', 'Quickly recognizes common merchants such as Swiggy, Zomato, Amazon, Uber, and GPay.'],
      ['return extracted?.takeIf { it.isNotBlank() } ?: "Unknown"', 'Falls back safely when merchant extraction fails.']
    ]
  },
  {
    path: 'mobile/app/src/main/java/com/aiexpensetracker/mobile/SmsReceiver.kt',
    purpose: 'Android broadcast receiver that reacts to newly received SMS messages and schedules background syncing.',
    important: [
      ['if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return', 'Processes only SMS received broadcasts.'],
      ['val body = messages.joinToString(separator = " ") { it.messageBody.orEmpty() }.trim()', 'Combines multipart SMS messages into one body.'],
      ['if (!prefs.getBoolean("connected", false)) { ... return }', 'Prevents syncing before the app is connected to a backend.'],
      ['OneTimeWorkRequestBuilder<SmsSyncWorker>()', 'Delegates network work to WorkManager instead of doing it inside the receiver.']
    ]
  },
  {
    path: 'mobile/app/src/main/java/com/aiexpensetracker/mobile/SmsSyncWorker.kt',
    purpose: 'Background worker that reads new SMS messages, parses them, sends transactions to the backend, and retries on network failure.',
    important: [
      ['if (!prefs.getBoolean("connected", false)) { return Result.success() }', 'Skips sync when the user has not connected the app.'],
      ['val lastProcessedTime = prefs.getLong("last_sms_sync_time", 0L)', 'Tracks the last synced SMS timestamp to avoid reprocessing the whole inbox.'],
      ['applicationContext.contentResolver.query(uri, projection, "date > ?", ...)', 'Reads only inbox SMS messages newer than the last sync time.'],
      ['val parsed = SmsParser.parse(body, timestamp) ?: continue', 'Ignores non-transaction SMS messages.'],
      ['val response = service.sendDirectTransaction(payload).execute()', 'Sends the parsed transaction to the direct backend endpoint.'],
      ['return if (hadNetworkFailure) Result.retry() else Result.success()', 'Lets WorkManager retry when upload fails.']
    ]
  },
  {
    path: 'mobile/app/src/main/java/com/aiexpensetracker/mobile/HostUtils.kt',
    purpose: 'Normalizes backend host input and builds the API base URL.',
    important: [
      ['val normalized = rawHost.trim().removePrefix("http://").removePrefix("https://")', 'Allows users to enter either a raw host or a full URL.'],
      ['val port = hostPart.substringAfter(\':\', "").takeIf { it.isNotEmpty() }?.toIntOrNull() ?: DEFAULT_BACKEND_PORT', 'Uses a provided port or defaults to 5000.'],
      ['return "http://${hostWithoutPort}:$port/api/"', 'Returns the Retrofit base URL required by API calls.']
    ]
  },
  {
    path: 'mobile/app/src/test/java/com/aiexpensetracker/mobile/SmsParserTest.kt',
    purpose: 'Unit tests for SMS parsing behavior.',
    important: [
      ['assertEquals("20", parsed!!.amount)', 'Verifies amount extraction from a debit SMS.'],
      ['assertEquals("JOHN", parsed.merchant)', 'Verifies merchant extraction from a UPI-style message.'],
      ['assertEquals("credit", parsed.type)', 'Verifies credit classification.']
    ]
  },
  {
    path: 'mobile/app/src/test/java/com/aiexpensetracker/mobile/HostUtilsTest.kt',
    purpose: 'Unit tests for backend host URL normalization.',
    important: [
      ['assertEquals("http://10.183.6.192:5000/api/", HostUtils.buildBaseUrl("10.183.6.192"))', 'Verifies default port handling.'],
      ['assertEquals("http://localhost:5000/api/", HostUtils.buildBaseUrl("localhost"))', 'Verifies localhost conversion for testing.']
    ]
  }
];

const supportingFiles = [
  ['README.md', 'Main project overview, setup, features, endpoints, data models, testing, deployment, and roadmap.'],
  ['SETUP_GUIDE.md', 'Step-by-step local setup instructions for backend, website, mobile app, and environment variables.'],
  ['CHANGELOG.md', 'History of fixes and feature additions.'],
  ['backend/package.json', 'Backend metadata, Node module type, start scripts, and backend dependencies.'],
  ['backend/package-lock.json', 'Exact backend dependency versions for repeatable installs.'],
  ['backend/docs/PROJECT_REPORT.docx', 'Previously generated sample report file.'],
  ['website/package.json', 'Website scripts and dependencies including React, Vite, Recharts, jsPDF, and PapaParse.'],
  ['website/package-lock.json', 'Exact frontend dependency versions for repeatable installs.'],
  ['website/index.html', 'HTML shell containing the root element where React mounts.'],
  ['website/vite.config.js', 'Vite configuration with React plugin and dev server port 5173.'],
  ['website/tailwind.config.js', 'Tailwind content scanning configuration.'],
  ['website/postcss.config.js', 'PostCSS setup for Tailwind and Autoprefixer.'],
  ['mobile/settings.gradle', 'Gradle project name and included Android app module.'],
  ['mobile/build.gradle', 'Top-level Android Gradle and Kotlin plugin configuration.'],
  ['mobile/app/build.gradle', 'Android app build configuration, SDK versions, view binding, and dependencies.'],
  ['mobile/gradle.properties', 'Gradle JVM and AndroidX settings.'],
  ['mobile/gradlew', 'Unix Gradle wrapper script.'],
  ['mobile/gradlew.bat', 'Windows Gradle wrapper script.'],
  ['mobile/gradle/wrapper/gradle-wrapper.properties', 'Gradle wrapper distribution configuration.'],
  ['mobile/gradle/wrapper/gradle-wrapper.jar', 'Gradle wrapper executable jar.'],
  ['mobile/app/src/main/AndroidManifest.xml', 'Android permissions, launcher activity, SMS receiver, cleartext networking, and app metadata.'],
  ['mobile/app/src/main/res/layout/activity_main.xml', 'Android UI layout for connect, permission, sync, and status controls.'],
  ['mobile/app/src/main/res/values/strings.xml', 'Reusable Android app text resources.'],
  ['mobile/app/src/main/res/values/colors.xml', 'Android color resources.'],
  ['mobile/app/src/main/res/values/themes.xml', 'Android theme configuration.'],
  ['mobile/app/src/main/res/drawable/ic_launcher_background.xml', 'Launcher icon background asset.'],
  ['mobile/app/src/main/res/drawable/ic_launcher_foreground.xml', 'Launcher icon foreground asset.'],
  ['mobile/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'Adaptive launcher icon definition.'],
  ['mobile/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', 'Round adaptive launcher icon definition.'],
  ['docs/schema.sql', 'Relational schema reference for users, transactions, merchant categories, and budgets.'],
  ['docs/sample-data.sql', 'Example SQL seed data for demo users, transactions, and budgets.'],
  ['docs/postman_collection.json', 'Postman collection for manually testing backend API endpoints.']
];

const interviewQuestions = [
  'Why did you choose a three-part architecture with Android, backend, and React website?',
  'How does the Android app detect and parse transaction SMS messages?',
  'How do you prevent duplicate transactions from being saved?',
  'Why is WorkManager used for SMS sync instead of calling the API directly in the BroadcastReceiver?',
  'How does the app handle network failures during SMS upload?',
  'How is user data isolated between different logged-in users?',
  'Why are MongoDB indexes created for email, userId/date, and rawSms?',
  'What is the difference between authenticated endpoints and direct endpoints?',
  'How does JWT authentication work in this project?',
  'How does the dashboard refresh data in near real time?',
  'What data is sent to the AI assistant, and how does the fallback response work?',
  'How are expense categories assigned from merchants and SMS text?',
  'How are monthly trends and daily trends calculated?',
  'How is the next-month spending prediction computed?',
  'How are budgets compared with actual expenses?',
  'How does PDF export work in the React app?',
  'How does CSV export work in the React app?',
  'What security improvements would you make before production deployment?',
  'Why does the Android manifest enable RECEIVE_SMS, READ_SMS, and INTERNET permissions?',
  'How does HostUtils support emulator and physical device testing?',
  'What are the limitations of regex-based SMS parsing?',
  'How would you improve merchant categorization accuracy?',
  'How would you scale the backend for many users?',
  'What test cases are already covered, and what tests should be added?',
  'How would you handle banks with different SMS formats?',
  'How would you migrate this project from local MongoDB to MongoDB Atlas?',
  'How would you protect sensitive financial data at rest and in transit?',
  'How would you design push notifications for budget alerts?'
];

function text(text, options = {}) {
  return new TextRun({ text, font: 'Aptos', size: options.size || 22, bold: options.bold, italics: options.italics });
}

function para(content, options = {}) {
  const children = Array.isArray(content) ? content : [text(String(content), options)];
  return new Paragraph({
    children,
    heading: options.heading,
    alignment: options.alignment,
    bullet: options.bullet ? { level: 0 } : undefined,
    spacing: { before: options.before || 0, after: options.after ?? 120, line: options.line || 260 },
    pageBreakBefore: options.pageBreakBefore
  });
}

function heading(title, level = HeadingLevel.HEADING_1, pageBreakBefore = false) {
  return para(title, { heading: level, bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24, before: 160, after: 120, pageBreakBefore });
}

function makeTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        children: row.map((cell) =>
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: rowIndex === 0 ? { fill: 'D9EAF7' } : undefined,
            children: [para(String(cell), { bold: rowIndex === 0, after: 60 })]
          })
        )
      })
    )
  });
}

function buildProjectReport() {
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        para('AI EXPENSE TRACKER', { heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, bold: true, size: 34, after: 60 }),
        para('Project Report', { alignment: AlignmentType.CENTER, bold: true, size: 26, after: 80 }),
        para(`Generated on ${new Date().toLocaleDateString('en-IN')}`, { alignment: AlignmentType.CENTER, italics: true, size: 18, after: 220 }),
        heading('1. Overview'),
        para('AI Expense Tracker is a full-stack personal finance system that captures bank transaction SMS messages from an Android phone, stores them through a Node.js and MongoDB backend, and presents spending analytics in a React dashboard. The system focuses on automatic transaction capture, category-based tracking, budget monitoring, AI-style finance assistance, and exportable reports.'),
        heading('2. Objectives', HeadingLevel.HEADING_2),
        para('Automatically detect transaction SMS messages and convert them into structured expense records.', { bullet: true }),
        para('Provide monthly expense, income, category, and trend analytics through a responsive dashboard.', { bullet: true }),
        para('Support budgets, recurring expense tracking, PDF/CSV export, and assistant-style financial questions.', { bullet: true }),
        para('Maintain user isolation so one user logout/login cycle does not mix transaction data.', { bullet: true }),
        heading('3. Technology Stack', HeadingLevel.HEADING_2),
        makeTable([
          ['Layer', 'Technology'],
          ['Mobile', 'Android Kotlin, BroadcastReceiver, WorkManager, Retrofit'],
          ['Backend', 'Node.js, Express, MongoDB, JWT, Helmet, CORS, Swagger'],
          ['Frontend', 'React 18, Vite, Tailwind CSS, Recharts, Axios, jsPDF, PapaParse'],
          ['Database', 'MongoDB collections for users, transactions, budgets, and merchant categories']
        ]),
        para('', { after: 80 }),
        heading('4. Architecture', HeadingLevel.HEADING_2),
        para('The Android app receives or reads SMS messages and sends parsed transactions to /api/transactions/direct. The backend validates required fields, creates or finds the direct user, categorizes merchants, deduplicates by raw SMS, and stores the record in MongoDB. The React website loads insights, transactions, and budgets from direct endpoints, then visualizes them using charts and summary cards.'),
        new Paragraph({ children: [new PageBreak()] }),
        heading('5. Main Modules'),
        para('Android SMS Collector: MainActivity handles connection and permissions, SmsReceiver reacts to new SMS broadcasts, SmsParser extracts amount/type/merchant/date, and SmsSyncWorker uploads parsed transactions in the background.'),
        para('Backend API: app.js defines health checks, session creation, authentication, transaction ingestion, insights, budgets, chat, and history clearing. MongoDB indexes improve lookup speed and enforce unique users.'),
        para('Website Dashboard: App.jsx manages login, selected month filtering, five-second refresh, charts, transaction table, assistant questions, recurring schedules, and PDF/CSV export.'),
        heading('6. Key Features', HeadingLevel.HEADING_2),
        para('Automatic SMS parsing and sync from Android.', { bullet: true }),
        para('Month-wise transaction filtering and analytics.', { bullet: true }),
        para('Dashboard cards for expense, income, monthly spending, and largest expense.', { bullet: true }),
        para('Charts for daily movement, category split, and spending by category.', { bullet: true }),
        para('Budget comparison, prediction, savings suggestion, AI assistant, and export features.', { bullet: true }),
        heading('7. Security And Reliability', HeadingLevel.HEADING_2),
        para('JWT is used for authenticated API routes, while direct endpoints support the SMS collector and website direct mode. Helmet adds safer HTTP headers, CORS controls browser access, required field checks prevent incomplete records, and session IDs in the frontend prevent stale async responses from leaking into a new user session. WorkManager retry behavior improves Android sync reliability.'),
        new Paragraph({ children: [new PageBreak()] }),
        heading('8. Data Model'),
        makeTable([
          ['Collection', 'Purpose'],
          ['users', 'Stores email, name, optional Google ID, and creation time.'],
          ['transactions', 'Stores user ID, amount, merchant, type, category, date, raw SMS, and creation time.'],
          ['merchantCategories', 'Caches merchant-to-category mappings per user.'],
          ['budgets', 'Stores category budget limits for a selected month.']
        ]),
        para('', { after: 80 }),
        heading('9. Testing And Validation', HeadingLevel.HEADING_2),
        para('Existing Android unit tests validate SMS amount/type/merchant parsing and backend host URL construction. Manual testing should include backend health checks, Android connection, SMS permission flow, inbox sync, dashboard refresh, chart rendering, AI chat, budgets, logout/login isolation, PDF export, and CSV export.'),
        heading('10. Conclusion', HeadingLevel.HEADING_2),
        para('The project demonstrates a practical end-to-end finance tracker with mobile data collection, API-based storage, and a useful analytics dashboard. Its strongest technical points are SMS-to-transaction automation, MongoDB-backed analytics, session isolation, export support, and a finance assistant that can use either Gemini or local rule-based responses.')
      ]
    }]
  });
}

function buildTechnicalDocument() {
  const children = [
    para('AI EXPENSE TRACKER', { heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, bold: true, size: 34, after: 60 }),
    para('Detailed File Usage, Code Explanation, and Interview Questions', { alignment: AlignmentType.CENTER, bold: true, size: 24, after: 220 }),
    heading('1. Project Flow'),
    para('The project starts with the Android app, which receives or reads SMS messages. SmsParser extracts the transaction details, SmsSyncWorker sends them to the Express backend, MongoDB stores the records, and the React website loads analytics through API calls. Users can view trends, ask finance questions, create local recurring schedules, and export reports.'),
    heading('2. Important Source Files')
  ];

  for (const file of sourceFiles) {
    children.push(heading(file.path, HeadingLevel.HEADING_2));
    children.push(para(`Usage: ${file.purpose}`));
    children.push(para('Important lines and explanation:', { bold: true, after: 80 }));
    for (const [line, explanation] of file.important) {
      children.push(para([text(line, { bold: true }), text(` - ${explanation}`)], { bullet: true, after: 80 }));
    }
  }

  children.push(heading('3. Supporting Files'));
  for (const [filePath, purpose] of supportingFiles) {
    children.push(para([text(`${filePath}: `, { bold: true }), text(purpose)], { bullet: true, after: 80 }));
  }

  children.push(heading('4. Technical Approach Summary'));
  children.push(para('The technical approach uses Android as the data collector, Express as the API and analytics layer, MongoDB as flexible transaction storage, and React as the reporting interface. Regex parsing is used because bank SMS formats are text-based and can be handled locally without external OCR. WorkManager is used for dependable background upload. MongoDB indexes support common user and date queries. React state and effects manage live dashboard refresh and prevent stale data after logout. The AI assistant is designed with a Gemini path and a local fallback so the chat feature remains usable even without an API key.'));

  children.push(heading('5. Interview Questions'));
  interviewQuestions.forEach((question, index) => {
    children.push(para(`${index + 1}. ${question}`, { after: 80 }));
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children
    }]
  });
}

async function writeDocx(doc, filename) {
  fs.mkdirSync(docsDir, { recursive: true });
  const outputPath = path.join(docsDir, filename);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function main() {
  const projectReportPath = await writeDocx(buildProjectReport(), 'AI_Expense_Tracker_Project_Report.docx');
  const technicalDocPath = await writeDocx(buildTechnicalDocument(), 'AI_Expense_Tracker_File_Explanation_And_Interview_QA.docx');

  console.log(`Created: ${projectReportPath}`);
  console.log(`Created: ${technicalDocPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
