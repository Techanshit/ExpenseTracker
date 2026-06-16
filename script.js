/* =============================================
   FLO — EXPENSE TRACKER
   script.js
   ============================================= */

'use strict';

/* =============================================
   STATE
   ============================================= */
let transactions = JSON.parse(localStorage.getItem('flo_transactions')) || [];
let theme = localStorage.getItem('flo_theme') || 'dark';
let pendingDeleteId = null;
let categoryChart = null;
let analyticsChart = null;
let activeSection = 'dashboard';

const CATEGORY_ICONS = {
  'Food & Dining': '🍽',
  'Transport':     '🚗',
  'Shopping':      '🛍',
  'Entertainment': '🎮',
  'Health':        '💊',
  'Housing':       '🏠',
  'Utilities':     '⚡',
  'Salary':        '💼',
  'Freelance':     '💻',
  'Investment':    '📈',
  'Other':         '✨',
};

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(theme);
  setHeaderDate();
  setGreeting();
  bindEvents();
  render();
  setDefaultDate();
});

/* =============================================
   THEME
   ============================================= */
function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('flo_theme', t);

  const icon = document.getElementById('themeIcon');
  const toggle = document.getElementById('darkModeToggle');
  if (t === 'dark') {
    icon.className = 'fa-solid fa-moon';
    if (toggle) toggle.checked = true;
  } else {
    icon.className = 'fa-solid fa-sun';
    if (toggle) toggle.checked = false;
  }
  // Re-render charts on theme change so they pick up new colors
  if (categoryChart || analyticsChart) {
    setTimeout(() => renderCharts(), 100);
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
});

/* =============================================
   DATE / GREETING
   ============================================= */
function setHeaderDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('headerDate').textContent = d.toLocaleDateString('en-US', opts);
}

function setGreeting() {
  const h = new Date().getHours();
  let g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greetingText').textContent = g;
}

function setDefaultDate() {
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
}

/* =============================================
   BIND EVENTS
   ============================================= */
function bindEvents() {
  // Form
  document.getElementById('transactionForm').addEventListener('submit', handleSubmit);

  // Type toggle
  document.getElementById('typeIncome').addEventListener('click', () => setType('income'));
  document.getElementById('typeExpense').addEventListener('click', () => setType('expense'));

  // Cancel edit
  document.getElementById('cancelEdit').addEventListener('click', resetForm);

  // Search
  document.getElementById('searchInput').addEventListener('input', debounce(render, 160));

  // Sort / filter
  document.getElementById('sortSelect').addEventListener('change', render);
  document.getElementById('filterType').addEventListener('change', render);

  // Chart filters
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCharts();
    });
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const sec = item.dataset.section;
      navigateTo(sec);
      closeSidebar();
    });
  });

  // Hamburger
  document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Modal
  document.getElementById('cancelDelete').addEventListener('click', closeModal);
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Empty state CTA
  document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-empty')) {
      navigateTo('dashboard');
      document.getElementById('txName').focus();
    }
  });

  // Settings
  document.getElementById('darkModeToggle').addEventListener('change', e => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('Delete ALL transactions? This cannot be undone.')) {
      transactions = [];
      save();
      render();
    }
  });
}

/* =============================================
   NAVIGATION
   ============================================= */
function navigateTo(section) {
  activeSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('fade-in');
    setTimeout(() => target.classList.remove('fade-in'), 400);
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  if (section === 'analytics') renderAnalyticsChart();
}

/* =============================================
   SIDEBAR
   ============================================= */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* =============================================
   FORM HELPERS
   ============================================= */
function setType(type) {
  document.getElementById('txType').value = type;
  document.getElementById('typeIncome').classList.toggle('active', type === 'income');
  document.getElementById('typeExpense').classList.toggle('active', type === 'expense');
}

function resetForm() {
  document.getElementById('transactionForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formMode').textContent = 'Add';
  document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'Add Transaction';
  document.getElementById('cancelEdit').style.display = 'none';
  setType('income');
  setDefaultDate();
  clearErrors();
}

function clearErrors() {
  ['nameError','amountError','categoryError'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
}

function validate() {
  clearErrors();
  let valid = true;
  const name = document.getElementById('txName').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const cat = document.getElementById('txCategory').value;

  if (!name) {
    document.getElementById('nameError').textContent = 'Name is required.';
    valid = false;
  }
  if (!amount || amount <= 0) {
    document.getElementById('amountError').textContent = 'Enter a valid amount.';
    valid = false;
  }
  if (!cat) {
    document.getElementById('categoryError').textContent = 'Pick a category.';
    valid = false;
  }
  return valid;
}

/* =============================================
   CRUD
   ============================================= */
function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) return;

  const editId = document.getElementById('editId').value;
  const tx = {
    id: editId || crypto.randomUUID(),
    name: document.getElementById('txName').value.trim(),
    amount: parseFloat(parseFloat(document.getElementById('txAmount').value).toFixed(2)),
    category: document.getElementById('txCategory').value,
    type: document.getElementById('txType').value,
    date: document.getElementById('txDate').value || new Date().toISOString().split('T')[0],
    createdAt: editId ? (transactions.find(t => t.id === editId)?.createdAt || Date.now()) : Date.now(),
  };

  if (editId) {
    transactions = transactions.map(t => t.id === editId ? tx : t);
  } else {
    transactions.unshift(tx);
  }

  save();
  render();
  resetForm();
  rippleEffect(document.getElementById('submitBtn'));
}

function editTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('txName').value = tx.name;
  document.getElementById('txAmount').value = tx.amount;
  document.getElementById('txCategory').value = tx.category;
  document.getElementById('txDate').value = tx.date;
  document.getElementById('editId').value = tx.id;
  setType(tx.type);
  document.getElementById('formMode').textContent = 'Edit';
  document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'Save Changes';
  document.getElementById('cancelEdit').style.display = 'block';

  if (window.innerWidth < 768) {
    navigateTo('dashboard');
  }
  document.getElementById('txName').focus();
}

function deleteTransaction(id) {
  pendingDeleteId = id;
  openModal();
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const card = document.querySelector(`[data-tx-id="${pendingDeleteId}"]`);
  if (card) {
    card.style.transition = 'opacity 0.25s, transform 0.25s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(16px)';
    setTimeout(() => {
      transactions = transactions.filter(t => t.id !== pendingDeleteId);
      save();
      render();
    }, 240);
  } else {
    transactions = transactions.filter(t => t.id !== pendingDeleteId);
    save();
    render();
  }
  pendingDeleteId = null;
  closeModal();
}

/* =============================================
   MODAL
   ============================================= */
function openModal() { document.getElementById('deleteModal').classList.add('open'); }
function closeModal() { document.getElementById('deleteModal').classList.remove('open'); }

/* =============================================
   SAVE
   ============================================= */
function save() {
  localStorage.setItem('flo_transactions', JSON.stringify(transactions));
}

/* =============================================
   FILTER / SORT HELPERS
   ============================================= */
function getFiltered() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const typeFilter = document.getElementById('filterType')?.value || 'all';
  const sort = document.getElementById('sortSelect')?.value || 'date-desc';

  let list = [...transactions];

  if (query) {
    list = list.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }
  if (typeFilter !== 'all') {
    list = list.filter(t => t.type === typeFilter);
  }

  list.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  return list;
}

/* =============================================
   RENDER
   ============================================= */
function render() {
  renderStats();
  renderTransactionList();
  renderInsights();
  renderCharts();
}

/* ---- STATS ---- */
function renderStats() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  animateValue('statBalance', balance, true);
  animateValue('statIncome', income, true);
  animateValue('statExpenses', expense, true);

  const totalEl = document.getElementById('statTotal');
  totalEl.textContent = transactions.length;
  totalEl.style.animation = 'none';
  requestAnimationFrame(() => { totalEl.style.animation = 'countUp 0.4s ease'; });

  document.getElementById('statIncomeCount').textContent =
    `${transactions.filter(t => t.type === 'income').length} transactions`;
  document.getElementById('statExpenseCount').textContent =
    `${transactions.filter(t => t.type === 'expense').length} transactions`;
}

function animateValue(id, value, isCurrency) {
  const el = document.getElementById(id);
  el.textContent = isCurrency ? formatCurrency(value) : value;
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'countUp 0.4s ease'; });
}

/* ---- TRANSACTION LIST ---- */
function renderTransactionList() {
  const list = getFiltered();
  const container = document.getElementById('transactionList');

  if (list.length === 0) {
    container.innerHTML = emptyStateHTML();
    return;
  }

  container.innerHTML = list.map(txCardHTML).join('');

  // bind action buttons
  container.querySelectorAll('.tx-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => editTransaction(btn.dataset.id));
  });
  container.querySelectorAll('.tx-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

function txCardHTML(tx) {
  const icon = CATEGORY_ICONS[tx.category] || '✨';
  const sign = tx.type === 'income' ? '+' : '-';
  const dateStr = formatDate(tx.date);
  return `
    <div class="tx-card" data-tx-id="${tx.id}">
      <div class="tx-emoji ${tx.type}-bg">${icon}</div>
      <div class="tx-info">
        <div class="tx-name">${escapeHTML(tx.name)}</div>
        <div class="tx-meta">
          <span class="tx-category">${tx.category}</span>
          <div class="dot"></div>
          <span class="tx-date">${dateStr}</span>
        </div>
      </div>
      <span class="tx-badge ${tx.type}">${tx.type}</span>
      <span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span>
      <div class="tx-actions">
        <button class="tx-btn edit" data-id="${tx.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="tx-btn delete" data-id="${tx.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
}

function emptyStateHTML() {
  return `
    <div class="empty-state">
      <div class="empty-illustration">💸</div>
      <h3 class="empty-title">Your financial journey starts here.</h3>
      <p class="empty-subtitle">Add your first transaction to get started.</p>
      <button class="btn-empty">Add a Transaction</button>
    </div>
  `;
}

/* ---- INSIGHTS ---- */
function renderInsights() {
  const container = document.getElementById('insightsList');
  const deepContainer = document.getElementById('deepInsightsList');

  if (transactions.length === 0) {
    const empty = '<div class="insight-empty">Add transactions to see insights</div>';
    container.innerHTML = empty;
    if (deepContainer) deepContainer.innerHTML = empty;
    return;
  }

  const incomes  = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');

  const largestExpense = expenses.reduce((m, t) => t.amount > (m?.amount || 0) ? t : m, null);
  const largestIncome  = incomes.reduce((m, t) => t.amount > (m?.amount || 0) ? t : m, null);
  const avgExpense = expenses.length ? expenses.reduce((s, t) => s + t.amount, 0) / expenses.length : 0;
  const avgIncome  = incomes.length  ? incomes.reduce((s, t) => s + t.amount, 0) / incomes.length   : 0;

  // Most used category
  const catCount = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  const insights = [
    largestIncome  ? { icon: '📈', iconClass: 'income-bg',  label: 'Largest Income',   value: `${formatCurrency(largestIncome.amount)} — ${largestIncome.name}` } : null,
    largestExpense ? { icon: '📉', iconClass: 'expense-bg', label: 'Largest Expense',  value: `${formatCurrency(largestExpense.amount)} — ${largestExpense.name}` } : null,
    avgIncome  > 0 ? { icon: '💰', iconClass: 'income-bg',  label: 'Avg. Income',      value: formatCurrency(avgIncome) } : null,
    avgExpense > 0 ? { icon: '💸', iconClass: 'expense-bg', label: 'Avg. Expense',     value: formatCurrency(avgExpense) } : null,
    topCat         ? { icon: CATEGORY_ICONS[topCat[0]] || '✨', iconClass: '', label: 'Top Category', value: `${topCat[0]} (${topCat[1]}×)` } : null,
  ].filter(Boolean);

  const html = insights.map(i => `
    <div class="insight-item">
      <div class="insight-icon ${i.iconClass}">${i.icon}</div>
      <div class="insight-text">
        <div class="insight-label">${i.label}</div>
        <div class="insight-value">${i.value}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
  if (deepContainer) deepContainer.innerHTML = html;
}

/* ---- CHARTS ---- */
function renderCharts() {
  const activeChip = document.querySelector('.chip.active');
  const filter = activeChip ? activeChip.dataset.filter : 'all';

  let data = [...transactions];
  if (filter === 'income')  data = data.filter(t => t.type === 'income');
  if (filter === 'expense') data = data.filter(t => t.type === 'expense');

  const catTotals = data.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const labels = Object.keys(catTotals);
  const values = Object.values(catTotals);

  const colors = [
    '#7c6fff','#22d3a5','#f76b6b','#f7c26b','#c85bff',
    '#1aa3e8','#ff9640','#f76b9e','#5bffc8','#ffda6b'
  ];

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(240,242,255,0.55)' : 'rgba(13,14,20,0.6)';

  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  if (categoryChart) categoryChart.destroy();

  if (labels.length === 0) {
    ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length).map(c => c + 'cc'),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 12 },
            boxWidth: 12,
            padding: 14,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
          backgroundColor: isDark ? '#1a1c28' : '#fff',
          titleColor: isDark ? '#f0f2ff' : '#0d0e14',
          bodyColor: textColor,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
        }
      },
      animation: { animateRotate: true, duration: 700, easing: 'easeInOutQuart' }
    }
  });
}

function renderAnalyticsChart() {
  const expenseData = transactions.filter(t => t.type === 'expense');
  const catTotals = expenseData.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const labels = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a]);
  const values = labels.map(l => catTotals[l]);

  const colors = ['#7c6fff','#22d3a5','#f76b6b','#f7c26b','#c85bff','#1aa3e8','#ff9640','#f76b9e','#5bffc8'];
  const isDark = theme === 'dark';
  const textColor = isDark ? 'rgba(240,242,255,0.55)' : 'rgba(13,14,20,0.6)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;
  if (analyticsChart) analyticsChart.destroy();
  if (labels.length === 0) return;

  analyticsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spent',
        data: values,
        backgroundColor: colors.slice(0, labels.length).map(c => c + '99'),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` },
          backgroundColor: isDark ? '#1a1c28' : '#fff',
          titleColor: isDark ? '#f0f2ff' : '#0d0e14',
          bodyColor: textColor,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1, padding: 12, cornerRadius: 10,
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: {
            color: textColor,
            font: { family: 'Inter', size: 11 },
            callback: v => formatCurrency(v),
          },
          grid: { color: gridColor },
          border: { display: false },
        }
      },
      animation: { duration: 700, easing: 'easeInOutQuart' }
    }
  });
}

/* =============================================
   UTILS
   ============================================= */
function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function rippleEffect(btn) {
  const ripple = btn.querySelector('.btn-ripple');
  if (!ripple) return;
  ripple.classList.remove('ripple-animate');
  const size = Math.max(btn.offsetWidth, btn.offsetHeight);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = '50%';
  ripple.style.top = '50%';
  ripple.style.marginLeft = ripple.style.marginTop = `-${size/2}px`;
  void ripple.offsetWidth; // reflow
  ripple.classList.add('ripple-animate');
}
