import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DIRECT_EMAIL = import.meta.env.VITE_DIRECT_EMAIL || 'nrshsenthil@gmail.com';
const DIRECT_NAME = import.meta.env.VITE_DIRECT_NAME || 'NAresh';
const REFRESH_MS = 5000;
const USER_KEY = 'ai_expense_dummy_user';

function App() {
  const [user, setUser] = useState(() => loadStoredUser());
  const [loginForm, setLoginForm] = useState({ email: '', password: '', name: '' });
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [status, setStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    connectAndLoad(active, user);
    const timer = window.setInterval(() => loadDashboard(active), REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.email, user?.name]);

  function directParams() {
    return {
      email: user?.email || DIRECT_EMAIL,
      name: user?.name || DIRECT_NAME
    };
  }

  async function connectAndLoad(active = true, sessionUser = user) {
    if (!sessionUser) return;
    setStatus('Connecting to backend...');
    try {
      const session = await axios.get(`${API_URL}/direct/session`, {
        params: { email: sessionUser.email, name: sessionUser.name }
      });
      if (!active) return;
      await loadDashboard(active);
      setStatus('Connected. Waiting for SMS transactions from the app.');
      setUser((current) => ({ ...(current || sessionUser), ...session.data.user }));
    } catch (error) {
      if (!active) return;
      setStatus('Backend offline. Start the backend on port 5000 and refresh this page.');
    }
  }

  async function loadDashboard(active = true) {
    try {
      const [insights, transactionRes, budgetRes] = await Promise.all([
        axios.get(`${API_URL}/direct/insights`, { params: directParams() }),
        axios.get(`${API_URL}/direct/transactions`, { params: { ...directParams(), limit: 10 } }),
        axios.get(`${API_URL}/direct/budgets`, { params: directParams() })
      ]);
      if (!active) return;
      setDashboard(insights.data);
      setTransactions(transactionRes.data.items);
      setBudgets(budgetRes.data);
      setLastUpdated(new Date());
    } catch (error) {
      if (!active) return;
      setStatus('Cannot load transactions yet. Check backend, MongoDB, IP, and port 5000.');
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.email.trim();
    const name = loginForm.name.trim();
    const password = loginForm.password.trim();

    if (!email || !name || !password) {
      setStatus('Enter Gmail, password, and name to continue.');
      return;
    }

    const nextUser = { email, name };
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setLoginForm({ email: '', password: '', name: '' });
  }

  async function handleChat(e) {
    e.preventDefault();
    if (!chatText.trim()) return;
    const res = await axios.post(`${API_URL}/direct/chat`, { message: chatText, ...directParams() });
    setChatReply(res.data.answer);
  }

  async function handleLogout() {
    const currentUser = user;
    setStatus('Clearing transaction history...');

    if (currentUser) {
      try {
        await axios.delete(`${API_URL}/direct/history`, {
          data: { email: currentUser.email, name: currentUser.name }
        });
        setStatus('Logged out. Previous transaction history was cleared.');
      } catch (error) {
        setStatus('Logged out locally. Backend history could not be cleared because the server was unreachable.');
      }
    }

    localStorage.removeItem(USER_KEY);
    setUser(null);
    setDashboard(null);
    setTransactions([]);
    setBudgets([]);
    setChatText('');
    setChatReply('');
    setLastUpdated(null);
  }

  const cards = [
    { label: 'Total Expense', value: money(dashboard?.summary?.total_expense) },
    { label: 'Total Income', value: money(dashboard?.summary?.total_income) },
    { label: 'Monthly Spending', value: money(dashboard?.summary?.monthly_spending) },
    { label: 'Largest Expense', value: dashboard?.largestExpense ? `${dashboard.largestExpense.merchant} (${money(dashboard.largestExpense.amount)})` : 'None' }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center">
          <form onSubmit={handleLogin} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h1 className="text-2xl font-semibold">AI Expense Tracker</h1>
            <p className="mt-2 text-sm text-slate-400">Sign in to open your expense dashboard.</p>
            <input
              className="mt-5 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
              placeholder="Gmail"
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <input
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
              placeholder="Password"
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <input
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
              placeholder="Name"
              value={loginForm.name}
              onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
            />
            <button className="mt-6 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950">
              Login
            </button>
            {status && <p className="mt-4 text-sm text-slate-400">{status}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">AI Expense Tracker</h1>
            <p className="text-sm text-slate-400">{status}</p>
          </div>
          <div className="flex flex-col gap-3 text-left text-sm text-slate-400 md:items-end md:text-right">
            <div>
              <div>{user?.name || DIRECT_NAME}</div>
              <div>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first load'}</div>
            </div>
            <button onClick={handleLogout} className="rounded-lg border border-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-800">
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-sm text-slate-400">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Spending Trend</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dashboard?.monthlyTrend || []}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Line type="monotone" dataKey="expense" stroke="#34d399" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">Category Split</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={dashboard?.categories || []} dataKey="total" nameKey="category" outerRadius={90}>
                  {(dashboard?.categories || []).map((item, index) => (
                    <Cell key={item.category} fill={['#34d399', '#60a5fa', '#f59e0b', '#f97316', '#a3e635'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
            <div className="space-y-3">
              {transactions.length === 0 && (
                <div className="rounded-xl border border-slate-800 p-3 text-sm text-slate-400">
                  No SMS transactions yet. Tap Connect in the app, allow SMS permission, then receive a bank SMS.
                </div>
              )}
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-800 p-3">
                  <div>
                    <div className="font-medium">{tx.merchant}</div>
                    <div className="text-sm text-slate-400">{tx.date} - {tx.type} - {tx.category}</div>
                  </div>
                  <div className={tx.type === 'credit' ? 'text-sky-400' : 'text-emerald-400'}>{money(tx.amount)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-lg font-semibold">AI Assistant</h2>
            <form onSubmit={handleChat} className="space-y-3">
              <input value={chatText} onChange={(e) => setChatText(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Ask about your spending" />
              <button className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950">Ask</button>
            </form>
            {chatReply && <div className="mt-4 rounded-xl border border-slate-800 bg-slate-800 p-3">{chatReply}</div>}
            <div className="mt-4 text-sm text-slate-400">Budgets connected: {budgets.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function money(value = 0) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function loadStoredUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    return stored?.email && stored?.name ? stored : null;
  } catch (_error) {
    return null;
  }
}

export default App;
