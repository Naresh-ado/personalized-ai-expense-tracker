import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, LineChart, Line, ResponsiveContainer, BarChart, Bar } from 'recharts';
import jsPDF from 'jspdf';
import Papa from 'papaparse';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DIRECT_EMAIL = import.meta.env.VITE_DIRECT_EMAIL || 'nrshsenthil@gmail.com';
const DIRECT_NAME = import.meta.env.VITE_DIRECT_NAME || 'NAresh';
const REFRESH_MS = 5000;
const USER_KEY = 'ai_expense_tracker_user';

function App() {
  const [user, setUser] = useState(() => loadStoredUser());
  const [loginForm, setLoginForm] = useState({ email: '', password: '', name: '' });
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [status, setStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scheduling, setScheduling] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [availableMonths, setAvailableMonths] = useState([]);
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Create unique session ID to prevent cross-user data merging
  useEffect(() => {
    if (user) {
      sessionIdRef.current = `${user.email}_${user.name}_${Date.now()}`;
    } else {
      sessionIdRef.current = null;
    }
  }, [user?.email, user?.name]);

  // Main data loading effect with proper cleanup
  useEffect(() => {
    if (!user || !sessionIdRef.current) return;

    const currentSessionId = sessionIdRef.current;
    let active = true;

    const loadData = async () => {
      if (!active || sessionIdRef.current !== currentSessionId) return;
      await connectAndLoad(active, user, currentSessionId);
    };

    loadData();
    const timer = window.setInterval(async () => {
      if (active && sessionIdRef.current === currentSessionId) {
        await loadDashboard(active, user, currentSessionId);
      }
    }, REFRESH_MS);

    timerRef.current = timer;

    return () => {
      active = false;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user, selectedMonth]);

  function directParams() {
    return {
      email: user?.email || DIRECT_EMAIL,
      name: user?.name || DIRECT_NAME
    };
  }

  async function connectAndLoad(active = true, sessionUser = user, sessionId = sessionIdRef.current) {
    if (!sessionUser || sessionId !== sessionIdRef.current) return;
    setStatus('Connecting to backend...');
    try {
      await axios.get(`${API_URL}/direct/session`, {
        params: { email: sessionUser.email, name: sessionUser.name }
      });
      if (!active || sessionId !== sessionIdRef.current) return;
      await loadDashboard(active, sessionUser, sessionId);
      setStatus('Connected. Waiting for SMS transactions from the app.');
    } catch (error) {
      if (!active || sessionId !== sessionIdRef.current) return;
      setStatus('Backend offline. Start the backend on port 5000 and refresh this page.');
    }
  }

  async function loadDashboard(active = true, sessionUser = user, sessionId = sessionIdRef.current) {
    try {
      const params = sessionUser
        ? { email: sessionUser.email, name: sessionUser.name, month: selectedMonth }
        : { ...directParams(), month: selectedMonth };
      const [insights, transactionRes, budgetRes] = await Promise.all([
        axios.get(`${API_URL}/direct/insights`, { params }),
        axios.get(`${API_URL}/direct/transactions`, { params: { ...params, limit: 100 } }),
        axios.get(`${API_URL}/direct/budgets`, { params })
      ]);
      
      if (!active || sessionId !== sessionIdRef.current) return;
      
      setDashboard(insights.data);
      setTransactions(transactionRes.data.items.slice(0, 10));
      setAllTransactions(transactionRes.data.items);
      setAvailableMonths(transactionRes.data.availableMonths || []);
      setBudgets(budgetRes.data);
      setLastUpdated(new Date());
    } catch (error) {
      if (!active || sessionId !== sessionIdRef.current) return;
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

    sessionIdRef.current = null;
    setDashboard(null);
    setTransactions([]);
    setAllTransactions([]);
    setBudgets([]);
    setChatText('');
    setChatReply('');
    setLastUpdated(null);
    setScheduling([]);
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    setAvailableMonths([]);
    setActiveTab('dashboard');

    const nextUser = { email, name };
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setLoginForm({ email: '', password: '', name: '' });
  }

  async function handleChat(e) {
    e.preventDefault();
    if (!chatText.trim()) return;
    
    try {
      setChatReply('Analyzing your spending...');
      const res = await axios.post(`${API_URL}/direct/chat`, { 
        message: chatText, 
        ...directParams(),
        month: selectedMonth,
        budgets,
        totalSpending: dashboard?.summary?.monthly_spending,
        categories: dashboard?.categories,
        recentTransactions: allTransactions.slice(0, 50)
      });
      setChatReply(res.data.answer);
    } catch (error) {
      setChatReply('Error connecting to AI. Check backend connection.');
    }
  }

  async function handleLogout() {
    sessionIdRef.current = null;
    setStatus('Logged out. Your synced transaction history was kept.');

    localStorage.removeItem(USER_KEY);
    setUser(null);
    setDashboard(null);
    setTransactions([]);
    setAllTransactions([]);
    setBudgets([]);
    setChatText('');
    setChatReply('');
    setLastUpdated(null);
    setScheduling([]);
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    setAvailableMonths([]);
    setActiveTab('dashboard');
    setStatus('');
  }

  function exportToPDF() {
    try {
      const doc = new jsPDF();
      let yPosition = 14;
      const pageHeight = doc.internal.pageSize.height;
      const addLine = (text, x = 14, yStep = 6) => {
        if (yPosition > pageHeight - 16) {
          doc.addPage();
          yPosition = 14;
        }
        doc.text(text, x, yPosition);
        yPosition += yStep;
      };

      doc.setFontSize(18);
      doc.text('Expense Report', 105, yPosition, { align: 'center' });
      yPosition += 10;

      doc.setFontSize(10);
      addLine(`User: ${user?.name || 'N/A'}`);
      addLine(`Email: ${user?.email || 'N/A'}`);
      addLine(`Month: ${selectedMonthLabel}`);
      addLine(`Generated: ${new Date().toLocaleString()}`);
      yPosition += 4;

      doc.setFontSize(12);
      addLine('Summary', 14, 7);
      doc.setFontSize(10);
      addLine(`Total Expenses: ${money(dashboard?.summary?.total_expense)}`);
      addLine(`Total Income: ${money(dashboard?.summary?.total_income)}`);
      addLine(`Monthly Spending: ${money(dashboard?.summary?.monthly_spending)}`);
      yPosition += 4;

      doc.setFontSize(12);
      addLine('Transactions', 14, 7);
      doc.setFontSize(9);
      allTransactions.slice(0, 60).forEach((tx, index) => {
        const row = `${index + 1}. ${tx.date} | ${tx.merchant} | ${tx.category} | ${tx.type.toUpperCase()} | ${money(tx.amount)}`;
        const lines = doc.splitTextToSize(row, 180);
        lines.forEach((line) => addLine(line, 14, 5));
      });

      doc.save('expense-report.pdf');
      setStatus('PDF exported successfully!');
    } catch (error) {
      setStatus('Error exporting PDF: ' + error.message);
    }
  }

  function exportToCSV() {
    try {
      const csvData = allTransactions.map(tx => ({
        Merchant: tx.merchant,
        Amount: tx.amount,
        Type: tx.type,
        Category: tx.category,
        Date: tx.date
      }));

      const csv = Papa.unparse(csvData);
      const link = document.createElement('a');
      link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      link.download = `expense-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus('CSV exported successfully!');
    } catch (error) {
      setStatus('Error exporting CSV: ' + error.message);
    }
  }

  function addSchedule(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const schedule = {
      id: Date.now(),
      merchant: formData.get('merchant'),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      frequency: formData.get('frequency'),
      nextDate: formData.get('nextDate')
    };
    setScheduling([...scheduling, schedule]);
    e.target.reset();
    setStatus('Recurring expense added successfully!');
  }

  function deleteSchedule(id) {
    setScheduling(scheduling.filter(s => s.id !== id));
    setStatus('Recurring expense deleted!');
  }

  const cards = [
    { label: 'Total Expense', value: money(dashboard?.summary?.total_expense), valueClass: 'text-red-400' },
    { label: 'Total Income', value: money(dashboard?.summary?.total_income), valueClass: 'text-green-400' },
    { label: 'Monthly Spending', value: money(dashboard?.summary?.monthly_spending), valueClass: 'text-red-300' },
    { label: 'Largest Expense', value: dashboard?.largestExpense ? `${dashboard.largestExpense.merchant} (${money(dashboard.largestExpense.amount)})` : 'None', valueClass: 'text-zinc-100' }
  ];
  const monthOptions = availableMonths.includes(selectedMonth)
    ? availableMonths
    : [selectedMonth, ...availableMonths.filter((month) => month !== selectedMonth)];
  const selectedMonthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-neutral-900 p-6 text-zinc-100">
        <div className="mx-auto flex min-h-[80vh] max-w-xl items-center">
          <form onSubmit={handleLogin} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-bold text-zinc-100">AI Expense Tracker</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in to open your expense dashboard.</p>
            
            <input
              className="mt-5 w-full rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              placeholder="Gmail"
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <input
              className="mt-3 w-full rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              placeholder="Password"
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <input
              className="mt-3 w-full rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              placeholder="Name"
              value={loginForm.name}
              onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
            />
            <button className="mt-6 w-full rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-black hover:bg-zinc-300 transition">
              Login
            </button>
            {status && <p className="mt-4 text-sm text-amber-400">{status}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">AI Expense Tracker</h1>
            <p className="text-sm text-zinc-400">{status}</p>
          </div>
          <div className="flex flex-col gap-3 text-left text-sm text-zinc-400 md:items-end md:text-right">
            <div>
              <div className="font-semibold text-zinc-100">{user?.name || DIRECT_NAME}</div>
              <div className="text-xs">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}</div>
            </div>
            <button onClick={handleLogout} className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-100 hover:bg-zinc-900 transition">
              Logout
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 backdrop-blur">
          {['dashboard', 'transactions', 'statistics', 'schedules', 'export'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-zinc-100 text-black'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-zinc-400">Selected month</div>
            <div className="text-lg font-semibold text-zinc-100">{selectedMonthLabel}</div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <label htmlFor="month-select" className="text-sm text-zinc-400">Filter by SMS date month</label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-black px-4 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {new Date(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {cards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur hover:bg-zinc-900 transition">
                  <div className="text-sm text-zinc-400">{card.label}</div>
                  <div className={`mt-2 text-2xl font-semibold ${card.valueClass}`}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur xl:col-span-2">
                <h2 className="mb-1 text-lg font-semibold">Spending Trend</h2>
                <p className="mb-4 text-sm text-zinc-400">Daily movement inside {selectedMonthLabel}</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dashboard?.dailyTrend || []}>
                    <XAxis dataKey="day" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip formatter={(value) => money(value)} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #3f3f46' }} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 3 }} />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
                <h2 className="mb-4 text-lg font-semibold">Category Split</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={dashboard?.categories || []} dataKey="total" nameKey="category" outerRadius={90}>
                      {(dashboard?.categories || []).map((item, index) => (
                        <Cell key={item.category} fill={['#e4e4e7', '#a1a1aa', '#71717a', '#ef4444', '#22c55e'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(value)} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #3f3f46' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid gap-2 text-sm text-white">
                  {(dashboard?.categories || []).map((item) => (
                    <div key={item.category} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                      <span>{item.category}</span>
                      <span>{money(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
                <h2 className="mb-2 text-lg font-semibold">Recent Transactions</h2>
                <p className="mb-4 text-sm text-zinc-400">
                  {money(dashboard?.summary?.monthly_spending || 0)} spent in {selectedMonthLabel}
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.length === 0 && (
                    <div className="rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400">
                      No SMS transactions found for this month yet.
                    </div>
                  )}
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 hover:bg-zinc-900 transition">
                      <div>
                        <div className="font-medium">{tx.merchant}</div>
                        <div className="text-xs text-zinc-400">{tx.date} • {tx.category}</div>
                      </div>
                      <div className={tx.type === 'credit' ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{money(tx.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
                <h2 className="mb-4 text-lg font-semibold">AI Assistant</h2>
                <form onSubmit={handleChat} className="space-y-3">
                  <textarea
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                    placeholder="Ask about spending, budget alerts, category trends, predictions..."
                    rows="3"
                  />
                  <button className="w-full rounded-lg bg-zinc-100 px-4 py-2 font-medium text-black hover:bg-zinc-300 transition">
                    Ask AI
                  </button>
                </form>
                {chatReply && (
                  <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100">
                    <div className="mb-2 font-semibold text-zinc-200">AI Response:</div>
                    <div>{chatReply}</div>
                  </div>
                )}
                <div className="mt-4 text-sm text-zinc-400">Active budgets: {budgets.length}</div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
            <h2 className="mb-4 text-2xl font-semibold">Detailed Expense List</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-slate-400">Merchant</th>
                    <th className="px-4 py-3 text-slate-400">Amount</th>
                    <th className="px-4 py-3 text-slate-400">Type</th>
                    <th className="px-4 py-3 text-slate-400">Category</th>
                    <th className="px-4 py-3 text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactions.slice(0, 100).map((tx) => (
                    <tr key={tx.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition">
                      <td className="px-4 py-3">{tx.merchant}</td>
                      <td className={`px-4 py-3 font-semibold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>{money(tx.amount)}</td>
                      <td className="px-4 py-3 text-slate-400">{tx.type}</td>
                      <td className="px-4 py-3 text-slate-400">{tx.category}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
                <h3 className="mb-4 text-lg font-semibold">Spending by Category</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboard?.categories || []}>
                    <XAxis dataKey="category" stroke="#ffffff" />
                    <YAxis stroke="#ffffff" />
                    <Tooltip formatter={(value) => money(value)} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #3f3f46' }} />
                    <Bar dataKey="total" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
                <h3 className="mb-4 text-lg font-semibold">Budget vs Actual</h3>
                <div className="space-y-4">
                  {budgets.length === 0 ? (
                    <p className="text-slate-400 text-sm">No budgets set yet. Create one to track spending.</p>
                  ) : (
                    budgets.map((budget, idx) => {
                      const spent = allTransactions
                        .filter(tx => tx.category === budget.category)
                        .reduce((sum, tx) => sum + tx.amount, 0);
                      const percentage = Math.min(100, Math.round((spent / budget.monthlyLimit) * 100));
                      
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{budget.category}</span>
                            <span className={percentage > 80 ? 'text-red-400' : 'text-green-400'}>
                              {money(spent)} / {money(budget.monthlyLimit)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full transition-all ${percentage > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
              <h3 className="mb-4 text-lg font-semibold">Predictions & Insights</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-zinc-900 p-4">
                  <p className="text-zinc-400 text-sm">Next Month Prediction</p>
                  <p className="mt-2 text-2xl font-semibold text-green-400">{money(dashboard?.prediction?.nextMonthExpense)}</p>
                  <p className="mt-2 text-sm text-zinc-400">Trend: {dashboard?.prediction?.trend}</p>
                </div>
                <div className="rounded-xl bg-zinc-900 p-4">
                  <p className="text-zinc-400 text-sm">Savings Suggestion</p>
                  <p className="mt-2 text-sm text-zinc-100">{dashboard?.savingsSuggestion}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
              <h2 className="mb-4 text-2xl font-semibold">Add Recurring Expense</h2>
              <form onSubmit={addSchedule} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <input
                  name="merchant"
                  type="text"
                  placeholder="Merchant (e.g., Netflix)"
                  className="rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  required
                />
                <input
                  name="amount"
                  type="number"
                  placeholder="Amount"
                  className="rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  step="0.01"
                  required
                />
                <select
                  name="category"
                  className="rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  required
                >
                  <option value="">Category</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Bills">Bills</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Other">Other</option>
                </select>
                <select
                  name="frequency"
                  className="rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  required
                >
                  <option value="">Frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <input
                  name="nextDate"
                  type="date"
                  className="rounded-lg border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  required
                />
                <button className="rounded-lg bg-zinc-100 px-4 py-2 font-medium text-black hover:bg-zinc-300 transition md:col-span-2 lg:col-span-5">
                  Add Recurring Expense
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
              <h2 className="mb-4 text-2xl font-semibold">Scheduled Expenses ({scheduling.length})</h2>
              <div className="space-y-3">
                {scheduling.length === 0 ? (
                  <p className="text-slate-400">No scheduled expenses yet.</p>
                ) : (
                  scheduling.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div>
                        <p className="font-medium">{schedule.merchant}</p>
                        <p className="text-sm text-slate-400">{schedule.category} • {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-red-300">{money(schedule.amount)}</p>
                          <p className="text-xs text-slate-400">{new Date(schedule.nextDate).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-red-400 hover:text-red-300 transition text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
                <h2 className="mb-4 text-lg font-semibold">Export to PDF</h2>
                <p className="text-sm text-slate-400 mb-4">Download a detailed PDF report of your expenses including transactions and statistics.</p>
                <button
                  onClick={exportToPDF}
                  className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 transition"
                >
                  📄 Download PDF Report
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
                <h2 className="mb-4 text-lg font-semibold">Export to CSV</h2>
                <p className="text-sm text-slate-400 mb-4">Download a CSV file of all transactions for use in spreadsheets or data analysis.</p>
                <button
                  onClick={exportToCSV}
                  className="w-full rounded-lg bg-zinc-100 px-4 py-3 font-medium text-black hover:bg-zinc-300 transition"
                >
                  📊 Download CSV Report
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur">
              <h2 className="mb-4 text-lg font-semibold">Contact</h2>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-lg bg-zinc-900 p-4 text-zinc-200">
                  <p className="mb-2">Need help with SMS sync, budgets, reports, or AI setup?</p>
                  <p>Email: <span className="text-white">support@ai-expense-tracker.local</span></p>
                  <p>Phone: <span className="text-white">+91 90000 00000</span></p>
                  <p>Hours: <span className="text-white">Mon-Sat, 9:00 AM to 6:00 PM</span></p>
                  <p className="mt-3 text-zinc-400">If you want, I can replace these placeholder contact details with your real ones.</p>
                </div>
              </div>
            </div>
          </div>
        )}
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
