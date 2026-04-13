/* ============================================
   ORÇAMENTO FAMILIAR - V9.2 (Com seleção de despesas)
   ============================================ */
const APP_CONFIG = { 
    sessionKey: 'budgetAppSession', 
    sessionDuration: 7 * 24 * 60 * 60 * 1000,
    SALT: 'OrcamentoFamiliar2026SecureSalt'
};
const APP_STATE = { 
    currentMonth: new Date().getMonth(), 
    currentYear: new Date().getFullYear(), 
    currentFilter: 'all', 
    isViewOnly: new URLSearchParams(window.location.search).get('viewonly') === '1' 
};
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CATEGORY_LABELS = { moradia:'🏠 Moradia', alimentacao:'🍔 Alimentação', transporte:'🚗 Transporte', saude:'💊 Saúde', educacao:'📚 Educação', lazer:'🎮 Lazer', vestuario:'👕 Vestuário', outros:'📦 Outros' };
const CATEGORY_COLORS = { moradia:'#e17055', alimentacao:'#fdcb6e', transporte:'#74b9ff', saude:'#55efc4', educacao:'#a29bfe', lazer:'#fd79a8', vestuario:'#00cec9', outros:'#636e72' };
const SMART_DICT = { 
    'aluguel':'moradia','luz':'moradia','energia':'moradia','agua':'moradia','condominio':'moradia','internet':'moradia',
    'mercado':'alimentacao','restaurante':'alimentacao','ifood':'alimentacao','uber':'transporte','99':'transporte',
    'gasolina':'transporte','farmacia':'saude','medico':'saude','plano de saude':'saude','escola':'educacao',
    'curso':'educacao','material':'educacao','netflix':'lazer','spotify':'lazer','cinema':'lazer','roupa':'vestuario',
    'sapato':'vestuario','academia':'saude'
};

let categoryChart = null;
let evolutionChart = null;
let deferredPrompt = null;

// --- Categorias personalizadas ---
let customCategories = [];

// --- Seleção de despesas ---
let selectedExpenseIds = new Set();

function loadCustomCategories() {
    const saved = localStorage.getItem('customCategories');
    customCategories = saved ? JSON.parse(saved) : [];
}

function saveCustomCategories() {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    renderCategorySelect();
    renderFilterBar();
    renderChart();
    renderAll();
}

function renderCategorySelect() {
    const select = document.getElementById('itemCategory');
    if (!select) return;
    const defaultCats = Object.entries(CATEGORY_LABELS).map(([val, label]) => ({ value: val, label }));
    const allCats = [...defaultCats, ...customCategories.map(c => ({ value: c.id, label: c.name }))];
    select.innerHTML = allCats.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
}

function openCategoriesModal() {
    const modal = document.getElementById('modalCategoriesOverlay');
    const listDiv = document.getElementById('categoriesList');
    if (!modal || !listDiv) return;
    listDiv.innerHTML = '';
    customCategories.forEach((cat, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '0.5rem';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <span>${escapeHtml(cat.name)}</span>
            <div>
                <button class="btn-edit-cat" data-idx="${idx}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Editar">✏️</button>
                <button class="btn-delete-cat" data-idx="${idx}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Excluir">🗑️</button>
            </div>
        `;
        listDiv.appendChild(div);
    });
    document.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            const newName = prompt('Editar categoria:', customCategories[idx].name);
            if (newName && newName.trim() && !customCategories.some(c => c.name === newName.trim())) {
                customCategories[idx].name = newName.trim();
                saveCustomCategories();
                openCategoriesModal();
            } else if (newName && customCategories.some(c => c.name === newName.trim())) {
                showToast('Já existe uma categoria com esse nome!', 'error');
            }
        });
    });
    document.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            if (confirm(`Excluir categoria "${customCategories[idx].name}"?`)) {
                customCategories.splice(idx, 1);
                saveCustomCategories();
                openCategoriesModal();
            }
        });
    });
    modal.classList.add('active');
}

function closeCategoriesModal() {
    const modal = document.getElementById('modalCategoriesOverlay');
    if (modal) modal.classList.remove('active');
}

// --- STORAGE ---
function loadData() {
    try { 
        const raw = localStorage.getItem('budgetAppData'); 
        if (!raw) return { recurringItems: [], monthOverrides: {}, categoryGoals: {} }; 
        let data = JSON.parse(raw);
        if (data.recurringItems === undefined && Object.keys(data).some(k => /^\d{4}-\d{2}$/.test(k))) { 
            const newData = { recurringItems: [], monthOverrides: {}, categoryGoals: {} }; 
            Object.keys(data).forEach(k => { 
                data[k].income.forEach(i => newData.recurringItems.push({ ...i, type: 'income', activeMonths: [k] })); 
                data[k].expenses.forEach(i => newData.recurringItems.push({ ...i, type: 'expense', activeMonths: [k] })); 
            }); 
            data = newData; saveData(data); showToast('Dados migrados! 🔄'); 
        }
        data.recurringItems = data.recurringItems || [];
        data.monthOverrides = data.monthOverrides || {};
        data.categoryGoals = data.categoryGoals || {};
        data.recurringItems.forEach(item => {
            if (item.type === 'income' && !item.frequency) item.frequency = 'monthly';
        });
        return data;
    } catch { return { recurringItems: [], monthOverrides: {}, categoryGoals: {} }; }
}

function saveData(data) { 
    try { 
        localStorage.setItem('budgetAppData', JSON.stringify(data)); 
    } catch { showToast('Erro ao salvar!', 'error'); } 
}

function getMonthKey(m, y) { return `${y}-${String(m+1).padStart(2,'0')}`; }

function isItemActiveForMonth(item, targetMonth, targetYear) {
    const key = getMonthKey(targetMonth, targetYear);
    return item.activeMonths.includes(key);
}

function getMonthData(m, y) {
    const data = loadData(); 
    const key = getMonthKey(m, y); 
    const overrides = data.monthOverrides[key] || { added: [], removed: [], modified: {}, notes: [] };
    let items = data.recurringItems.filter(item => isItemActiveForMonth(item, m, y));
    items = items.map(item => overrides.modified[item.id] ? { ...item, ...overrides.modified[item.id] } : item);
    items = items.filter(item => !overrides.removed.includes(item.id));
    items = items.concat(overrides.added);
    return { 
        income: items.filter(i => i.type === 'income'), 
        expenses: items.filter(i => i.type === 'expense'), 
        key, 
        notes: overrides.notes 
    };
}

// --- Utilitários ---
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

function getWeeklyOccurrences(year, month, weekdayTarget) {
    let occurrences = 0;
    for (let d = 1; d <= getDaysInMonth(year, month); d++) {
        if (new Date(year, month, d).getDay() === weekdayTarget) occurrences++;
    }
    return occurrences;
}

function normalizeValue(item, month, year) {
    let base = item.amount || 0;
    if (item.type === 'income' && item.frequency && item.frequency !== 'monthly') {
        if (item.frequency === 'daily') return base * getDaysInMonth(year, month);
        if (item.frequency === 'weekly') {
            const firstDayWeekday = new Date(year, month, 1).getDay();
            return base * getWeeklyOccurrences(year, month, firstDayWeekday);
        }
    }
    return base;
}

function getFrequencyLabel(freq) {
    if (freq === 'daily') return 'diário';
    if (freq === 'weekly') return 'semanal';
    return 'mensal';
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

function formatCurrency(v) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); 
}

function parseCurrency(str) { 
    if (typeof str === 'number') return str; 
    let cleaned = str.replace(/[^\d,.-]/g, '').replace(',', '.');
    let val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

function setupAmountMask() {
    const amountInput = document.getElementById('itemAmount');
    if (!amountInput) return;
    amountInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value === '') { this.value = ''; return; }
        let number = parseInt(value, 10) / 100;
        this.value = number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
    amountInput.addEventListener('blur', function() {
        if (this.value === '') this.value = '0,00';
    });
}

function showToast(msg, type='success') { 
    const c = document.getElementById('toastContainer'); 
    const t = document.createElement('div'); 
    t.className = `toast ${type}`; 
    t.textContent = msg; 
    c.appendChild(t); 
    setTimeout(() => t.remove(), 3000); 
}

function getDurationLabel(months) {
    if (months.length === 1) return '📌 Único';
    if (months.length > 12) return '♾️ Longo Prazo';
    return `🔄 ${months.length}x`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// --- Auth ---
async function hashPassword(pwd, salt = APP_CONFIG.SALT) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(pwd) {
    const storedHash = localStorage.getItem('appPasswordHash');
    const inputHash = await hashPassword(pwd);
    if (!storedHash) {
        localStorage.setItem('appPasswordHash', inputHash);
        sessionStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ token: 'ok', ts: Date.now() }));
        document.getElementById('loginScreen').classList.add('hidden');
        showToast('Senha definida! Guarde-a com cuidado 🔐');
        return true;
    }
    if (inputHash === storedHash) {
        sessionStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ token: 'ok', ts: Date.now() }));
        document.getElementById('loginScreen').classList.add('hidden');
        showToast('Bem-vindo! 👋');
        return true;
    }
    return false;
}

function checkAuth() { 
    const s = sessionStorage.getItem(APP_CONFIG.sessionKey); 
    if (s) { 
        try {
            const { token, ts } = JSON.parse(s); 
            if (token === 'ok' && Date.now() - ts < APP_CONFIG.sessionDuration) { 
                document.getElementById('loginScreen').classList.add('hidden'); 
                return true; 
            }
        } catch(e) {}
    } 
    return false; 
}

async function logout() { 
    showToast('Encerrando sessão... 🔒', 'success'); 
    sessionStorage.removeItem(APP_CONFIG.sessionKey); 
    if ('caches' in window) { 
        try { 
            const keys = await caches.keys(); 
            await Promise.all(keys.filter(k => k.includes('budget')).map(k => caches.delete(k))); 
        } catch {} 
    } 
    setTimeout(() => location.reload(), 800); 
}

// --- Theme & PWA & Calc ---
function initTheme() { 
    const saved = localStorage.getItem('appTheme'); 
    const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); 
    document.documentElement.setAttribute('data-theme', theme); 
    updateThemeIcon(theme); 
    updateMetaTheme(theme); 
}

function toggleTheme() { 
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; 
    document.documentElement.setAttribute('data-theme', next); 
    localStorage.setItem('appTheme', next); 
    updateThemeIcon(next); 
    updateMetaTheme(next); 
    if (categoryChart) {
        categoryChart.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary'); 
        categoryChart.update(); 
    }
    if (evolutionChart) {
        evolutionChart.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary'); 
        evolutionChart.update(); 
    }
}

function updateThemeIcon(t) { 
    document.getElementById('btnThemeToggle').textContent = t === 'dark' ? '☀️' : '🌙'; 
}

function updateMetaTheme(t) { 
    document.getElementById('themeColorMeta').content = t === 'dark' ? '#0f1117' : '#f5f7fa'; 
}

function initPWA() { 
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{});
    }
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.createElement('button');
        installBtn.textContent = '📲 Instalar App';
        installBtn.className = 'btn btn-primary';
        installBtn.style.position = 'fixed';
        installBtn.style.bottom = '20px';
        installBtn.style.right = '20px';
        installBtn.style.zIndex = '1000';
        installBtn.setAttribute('aria-label', 'Instalar aplicativo na tela inicial');
        installBtn.onclick = () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => installBtn.remove());
                deferredPrompt = null;
            }
        };
        document.body.appendChild(installBtn);
    });
}

function initCalculator() { 
    let expr = ''; 
    const d = document.getElementById('calcDisplay'); 
    document.querySelectorAll('.calc-btn').forEach(b => b.onclick = () => { 
        const v = b.dataset.val; 
        if(v==='C') expr=''; 
        else if(v==='⌫') expr=expr.slice(0,-1); 
        else if(v==='=') { 
            try { 
                expr = String(Function('"use strict"; return ('+expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')+')')()); 
                if(isNaN(+expr)||!isFinite(+expr)) expr='Erro'; 
            } catch { expr='Erro'; } 
        } else expr+=v; 
        d.textContent = expr||'0'; 
    }); 
}

// --- Mini Calendário ---
function renderCalendar() {
    const grid = document.getElementById('miniCalendar');
    if (!grid) return;
    grid.innerHTML = `
        <div class="mini-calendar-title">📅 Próximos Meses</div>
        <div class="cal-grid" id="calGrid"></div>
        <button id="btnBackToCurrentMonth" class="btn btn-secondary btn-sm" style="margin-top: 0.75rem; width: 100%;" aria-label="Voltar ao mês atual">⬅️ Voltar ao mês atual</button>
    `;
    const cal = document.getElementById('calGrid');
    for(let i = 0; i < 12; i++) {
        let m = APP_STATE.currentMonth + i, y = APP_STATE.currentYear + Math.floor(m / 12);
        m %= 12;
        const md = getMonthData(m, y);
        const has = md.income.length > 0 || md.expenses.length > 0;
        const active = (m === APP_STATE.currentMonth && y === APP_STATE.currentYear);
        const btn = document.createElement('div');
        btn.className = `cal-item ${active ? 'active' : ''} ${has ? 'has-data' : ''}`;
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-label', `${MONTHS[m]} ${y}${has ? ' com dados' : ''}`);
        btn.innerHTML = `<div class="cal-abbr">${MONTHS_SHORT[m]}</div><div>${y.toString().slice(2)}</div>`;
        btn.onclick = () => {
            APP_STATE.currentMonth = m;
            APP_STATE.currentYear = y;
            renderAll();
        };
        btn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') btn.click(); };
        cal.appendChild(btn);
    }
    document.getElementById('btnBackToCurrentMonth').onclick = () => {
        const hoje = new Date();
        APP_STATE.currentMonth = hoje.getMonth();
        APP_STATE.currentYear = hoje.getFullYear();
        renderAll();
        showToast('✅ Voltou para o mês atual!', 'success');
    };
}

// --- Renderização principal ---
function updateMonthDisplay() { 
    document.getElementById('currentMonth').textContent = MONTHS[APP_STATE.currentMonth]; 
    document.getElementById('currentYear').textContent = APP_STATE.currentYear; 
}

function updateSummary() {
    const {income, expenses} = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const inc = income.reduce((s,i)=>s+normalizeValue(i, APP_STATE.currentMonth, APP_STATE.currentYear),0);
    const exp = expenses.reduce((s,i)=>s+normalizeValue(i, APP_STATE.currentMonth, APP_STATE.currentYear),0);
    const bal = inc - exp;
    
    const prevM = APP_STATE.currentMonth===0?11:APP_STATE.currentMonth-1, 
          prevY = APP_STATE.currentMonth===0?APP_STATE.currentYear-1:APP_STATE.currentYear;
    const prev = getMonthData(prevM, prevY);
    const pInc = prev.income.reduce((s,i)=>s+normalizeValue(i, prevM, prevY),0);
    const pExp = prev.expenses.reduce((s,i)=>s+normalizeValue(i, prevM, prevY),0);
    const iD = pInc>0?((inc-pInc)/pInc)*100:0, 
          eD = pExp>0?((exp-pExp)/pExp)*100:0;
    
    document.getElementById('totalIncome').textContent = formatCurrency(inc);
    document.getElementById('totalExpense').textContent = formatCurrency(exp);
    renderTrend('trendIncome', iD, inc>=pInc);
    renderTrend('trendExpense', eD, exp<=pExp);
    
    const bE = document.getElementById('totalBalance');
    bE.textContent = formatCurrency(bal);
    const cB = document.getElementById('cardBalance');
    cB.classList.remove('positive','negative');
    if(bal>0) cB.classList.add('positive');
    else if(bal<0) cB.classList.add('negative');
    
    const goal = parseCurrency(document.getElementById('savingsGoal').value) || 500;
    const pct = goal>0 ? (Math.max(0,bal)/goal)*100 : 0;
    document.getElementById('totalSavings').textContent = formatCurrency(Math.max(0,bal));
    document.getElementById('savingsFill').style.width = Math.min(100,pct)+'%';
    document.getElementById('savingsPercent').textContent = `${pct.toFixed(1)}% da meta de ${formatCurrency(goal)}`;
    renderCategoryGoals(expenses);
}

function renderTrend(id, pct, pos) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = Math.abs(pct).toFixed(1);
    const s = pct===0 ? '' : pct>0 ? '↑' : '↓';
    const c = pct>0 ? (pos ? 'trend-up' : 'trend-down') : (pos ? 'trend-down' : 'trend-up');
    el.className = `trend ${c}`;
    el.textContent = pct===0 ? 'Sem dados anteriores' : `${s} ${v}% vs mês ant.`;
}

function renderCategoryGoals(expenses) {
    const g = document.getElementById('goalsGrid');
    if (!g) return;
    g.innerHTML = '';
    const data = loadData();
    const goals = data.categoryGoals || {};
    const totals = {};
    expenses.forEach(i => {
        const cat = i.category || 'outros';
        totals[cat] = (totals[cat] || 0) + normalizeValue(i, APP_STATE.currentMonth, APP_STATE.currentYear);
    });
    
    const allCategoryKeys = [...Object.keys(CATEGORY_LABELS), ...customCategories.map(c => c.id)];
    allCategoryKeys.forEach(c => {
        const t = totals[c] || 0;
        const gl = goals[c] || 1000;
        const p = gl > 0 ? (t / gl) * 100 : 0;
        const isOver = t > gl;
        const label = CATEGORY_LABELS[c] || customCategories.find(cat => cat.id === c)?.name || c;
        const d = document.createElement('div');
        d.className = 'goal-item';
        d.setAttribute('role', 'button');
        d.setAttribute('tabindex', '0');
        d.innerHTML = `
            <div class="goal-label">
                <span>${label} ${isOver ? '⚠️' : ''}</span>
                <span>${formatCurrency(t)} / ${formatCurrency(gl)}</span>
            </div>
            <div class="goal-bar">
                <div class="goal-fill ${p > 100 ? 'over' : ''}" style="width: ${Math.min(100, p)}%"></div>
            </div>
            ${isOver ? `<div class="goal-alert">❗ Ultrapassou a meta em ${formatCurrency(t - gl)}</div>` : ''}
        `;
        d.onclick = () => {
            const n = prompt(`Meta para ${label} (R$):`, gl);
            if (n !== null) {
                const newGoal = parseCurrency(n);
                if (!isNaN(newGoal)) {
                    goals[c] = newGoal;
                    const fullData = loadData();
                    fullData.categoryGoals = goals;
                    saveData(fullData);
                    renderAll();
                }
            }
        };
        g.appendChild(d);
    });
}

// --- Atualização do total selecionado ---
function updateSelectedTotal() {
    const { expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    let visibleExpenses = [...expenses];
    if (APP_STATE.currentFilter !== 'all') {
        visibleExpenses = visibleExpenses.filter(e => e.category === APP_STATE.currentFilter);
    }
    const searchTerm = document.getElementById('searchExpenses')?.value.toLowerCase() || '';
    if (searchTerm) {
        visibleExpenses = visibleExpenses.filter(e => e.description.toLowerCase().includes(searchTerm) || (e.category || '').includes(searchTerm));
    }
    let total = 0;
    visibleExpenses.forEach(exp => {
        if (selectedExpenseIds.has(exp.id)) {
            total += normalizeValue(exp, APP_STATE.currentMonth, APP_STATE.currentYear);
        }
    });
    const totalSpan = document.getElementById('selectedTotal');
    if (totalSpan) totalSpan.textContent = formatCurrency(total);
}

// --- Renderização de itens com checkbox para despesas ---
function renderItems(type) {
    const { income, expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const listId = type === 'income' ? 'incomeList' : 'expenseList';
    const emptyId = type === 'income' ? 'incomeEmpty' : 'expenseEmpty';
    const listEl = document.getElementById(listId);
    const emptyEl = document.getElementById(emptyId);
    if (!listEl || !emptyEl) return;
    
    let items = type === 'income' ? income : expenses;
    if (type === 'expense') {
        if (APP_STATE.currentFilter !== 'all') items = items.filter(i => i.category === APP_STATE.currentFilter);
        const s = document.getElementById('searchExpenses')?.value.toLowerCase() || '';
        if (s) items = items.filter(i => i.description.toLowerCase().includes(s) || (i.category || '').includes(s));
        items.sort((a, b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
            return da - db;
        });
    }
    
    listEl.innerHTML = '';
    if (items.length === 0) {
        emptyEl.style.display = 'block';
        if (type === 'expense') updateSelectedTotal();
        return;
    }
    emptyEl.style.display = 'none';
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        const val = normalizeValue(item, APP_STATE.currentMonth, APP_STATE.currentYear);
        const cls = type === 'income' ? 'income' : 'expense';
        const sign = type === 'income' ? '+' : '-';
        const lbl = getDurationLabel(item.activeMonths || []);
        const bCls = lbl.includes('Único') ? 'badge-single' : (lbl.includes('Longo') ? 'badge-recurring' : 'badge-limited');
        
        let categoryLabel = '';
        if (type === 'expense' && item.category) {
            categoryLabel = CATEGORY_LABELS[item.category] || customCategories.find(c => c.id === item.category)?.name || item.category;
            categoryLabel = `<span class="item-category">${categoryLabel}</span>`;
        }
        let due = item.dueDate ? `<span class="item-due">Venc. ${new Date(item.dueDate).toLocaleDateString('pt-BR')}</span>` : '';
        let freqBadge = '';
        if (type === 'income' && item.frequency && item.frequency !== 'monthly') {
            freqBadge = `<span class="badge badge-frequency">${getFrequencyLabel(item.frequency)}</span>`;
        }
        
        let checkboxHtml = '';
        if (type === 'expense') {
            checkboxHtml = `<input type="checkbox" class="expense-checkbox" data-id="${item.id}" ${selectedExpenseIds.has(item.id) ? 'checked' : ''} style="margin-right: 12px;">`;
        }
        
        card.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                ${checkboxHtml}
                <div class="item-info">
                    <div class="item-description">${escapeHtml(item.description)}<span class="badge ${bCls}">${lbl}</span>${freqBadge}</div>
                    <div class="item-meta">${categoryLabel}${due}</div>
                </div>
            </div>
            <div class="item-value ${cls}">${sign} ${formatCurrency(val)}</div>
            <div class="item-actions">
                <button class="btn btn-edit" onclick="editItem('${type}','${item.id}')">✏️</button>
                <button class="btn btn-delete" onclick="deleteItem('${type}','${item.id}')">🗑️</button>
            </div>
        `;
        listEl.appendChild(card);
    });
    
    if (type === 'expense') {
        document.querySelectorAll('.expense-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = cb.dataset.id;
                if (cb.checked) selectedExpenseIds.add(id);
                else selectedExpenseIds.delete(id);
                updateSelectedTotal();
            });
        });
        updateSelectedTotal();
    }
}

function selectAllExpenses() {
    const { expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    let visibleExpenses = [...expenses];
    if (APP_STATE.currentFilter !== 'all') {
        visibleExpenses = visibleExpenses.filter(e => e.category === APP_STATE.currentFilter);
    }
    const searchTerm = document.getElementById('searchExpenses')?.value.toLowerCase() || '';
    if (searchTerm) {
        visibleExpenses = visibleExpenses.filter(e => e.description.toLowerCase().includes(searchTerm) || (e.category || '').includes(searchTerm));
    }
    visibleExpenses.forEach(e => selectedExpenseIds.add(e.id));
    renderItems('expense');
}

function clearSelection() {
    selectedExpenseIds.clear();
    renderItems('expense');
}

// --- Gráficos e histórico (idênticos à versão anterior) ---
function renderChart() {
    const { expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const totals = {};
    expenses.forEach(i => {
        const cat = i.category || 'outros';
        totals[cat] = (totals[cat] || 0) + normalizeValue(i, APP_STATE.currentMonth, APP_STATE.currentYear);
    });
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    const labels = Object.keys(totals).map(c => CATEGORY_LABELS[c] || customCategories.find(cat => cat.id === c)?.name || c);
    const data = Object.values(totals);
    const backgroundColors = Object.keys(totals).map(c => CATEGORY_COLORS[c] || '#636e72');
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: backgroundColors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { 
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') } } 
            }
        }
    });
}

function getLast12Months() {
    let months = [];
    let currentM = APP_STATE.currentMonth;
    let currentY = APP_STATE.currentYear;
    for (let i = 11; i >= 0; i--) {
        let m = (currentM - i) % 12;
        let y = currentY - Math.floor((i - currentM) / 12);
        if (m < 0) { m += 12; y--; }
        months.push({ month: m, year: y, key: getMonthKey(m, y) });
    }
    return months;
}

function renderEvolutionChart() {
    const months = getLast12Months();
    const labels = months.map(m => `${MONTHS_SHORT[m.month]}/${m.year.toString().slice(2)}`);
    const incomes = [];
    const expenses = [];
    const balances = [];

    months.forEach(m => {
        const data = getMonthData(m.month, m.year);
        const inc = data.income.reduce((s, i) => s + normalizeValue(i, m.month, m.year), 0);
        const exp = data.expenses.reduce((s, i) => s + normalizeValue(i, m.month, m.year), 0);
        incomes.push(inc);
        expenses.push(exp);
        balances.push(inc - exp);
    });

    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChart) evolutionChart.destroy();
    
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Receitas', data: incomes, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true, pointRadius: 4 },
                { label: 'Despesas', data: expenses, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, fill: true, pointRadius: 4 },
                { label: 'Saldo', data: balances, borderColor: '#5b4cdb', backgroundColor: 'rgba(91,76,219,0.05)', tension: 0.3, fill: true, pointRadius: 4, borderDash: [5,5] }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } },
                legend: { position: 'top', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') } }
            },
            scales: {
                y: { ticks: { callback: (v) => formatCurrency(v), color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') } },
                x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') } }
            }
        }
    });
}

function renderHistory() {
    const data = loadData();
    const tb = document.getElementById('historyBody');
    const em = document.getElementById('historyEmpty');
    if (!tb || !em) return;
    tb.innerHTML = '';
    const ks = new Set(Object.keys(data.monthOverrides));
    ks.add(getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear));
    for(let i = 0; i < 6; i++) ks.add(getMonthKey((APP_STATE.currentMonth+i)%12, APP_STATE.currentYear+Math.floor((APP_STATE.currentMonth+i)/12)));
    const so = Array.from(ks).filter(k => /^\d{4}-\d{2}$/.test(k)).sort().reverse();
    if(so.length === 0) {
        em.style.display = 'block';
        return;
    }
    em.style.display = 'none';
    so.forEach(k => {
        const [y,m] = k.split('-');
        const {income, expenses} = getMonthData(parseInt(m)-1, parseInt(y));
        const inc = income.reduce((s,i)=>s+normalizeValue(i,parseInt(m)-1,parseInt(y)),0);
        const exp = expenses.reduce((s,i)=>s+normalizeValue(i,parseInt(m)-1,parseInt(y)),0);
        const bal = inc - exp;
        const cl = bal>0 ? 'amount-positive' : (bal<0 ? 'amount-negative' : 'amount-neutral');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${MONTHS[parseInt(m)-1]}/${y}</td>
            <td class="amount-income">${formatCurrency(inc)}</td>
            <td class="amount-expense">${formatCurrency(exp)}</td>
            <td class="${cl}">${formatCurrency(bal)}</td>
        `;
        tb.appendChild(tr);
    });
}

function checkDueAlerts() {
    const {expenses} = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const today = new Date();
    const next3Days = new Date();
    next3Days.setDate(today.getDate() + 3);
    const upcoming = expenses.filter(i => {
        if (!i.dueDate) return false;
        const due = new Date(i.dueDate);
        return due >= today && due <= next3Days;
    });
    if(upcoming.length > 0) {
        showToast(`⚠️ ${upcoming.length} vencimento(s) nos próximos 3 dias!`, 'error');
    }
}

// --- PDF ---
async function exportAdvancedPDF() {
    showToast('Gerando PDF avançado...', 'success');
    const pdfContent = document.createElement('div');
    pdfContent.style.padding = '20px';
    pdfContent.style.backgroundColor = 'white';
    pdfContent.style.color = 'black';
    pdfContent.style.fontFamily = 'Inter, sans-serif';
    
    const summaryCards = document.querySelector('.summary-cards').cloneNode(true);
    const categoryChartCanvas = document.getElementById('categoryChart').cloneNode(true);
    const evolutionChartCanvas = document.getElementById('evolutionChart').cloneNode(true);
    
    const expenseTable = document.createElement('table');
    expenseTable.style.width = '100%';
    expenseTable.style.borderCollapse = 'collapse';
    expenseTable.style.marginTop = '20px';
    expenseTable.innerHTML = `
        <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Vencimento</th></tr></thead>
        <tbody>
            ${getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear).expenses.map(e => {
                const catName = CATEGORY_LABELS[e.category] || customCategories.find(c => c.id === e.category)?.name || e.category;
                return `<tr>
                    <td>${escapeHtml(e.description)}</td>
                    <td>${catName}</td>
                    <td style="text-align:right">${formatCurrency(normalizeValue(e, APP_STATE.currentMonth, APP_STATE.currentYear))}</td>
                    <td style="text-align:right">${e.dueDate ? new Date(e.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                </tr>`;
            }).join('')}
        </tbody>
    `;
    
    pdfContent.appendChild(summaryCards);
    pdfContent.appendChild(document.createElement('hr'));
    pdfContent.appendChild(categoryChartCanvas);
    pdfContent.appendChild(document.createElement('hr'));
    pdfContent.appendChild(evolutionChartCanvas);
    pdfContent.appendChild(document.createElement('hr'));
    pdfContent.appendChild(expenseTable);
    
    document.body.appendChild(pdfContent);
    try {
        const canvas = await html2canvas(pdfContent, { scale: 2, backgroundColor: '#ffffff' });
        document.body.removeChild(pdfContent);
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= (pdf.internal.pageSize.height - 10);
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdf.internal.pageSize.height;
        }
        pdf.save(`orcamento_${MONTHS[APP_STATE.currentMonth]}_${APP_STATE.currentYear}.pdf`);
        showToast('PDF gerado com sucesso!');
    } catch (err) {
        console.error(err);
        showToast('Erro ao gerar PDF.', 'error');
        if (document.body.contains(pdfContent)) document.body.removeChild(pdfContent);
    }
}

function applyViewOnly() {
    if(!APP_STATE.isViewOnly) return;
    document.querySelectorAll('.btn-add, .btn-edit, .btn-delete, #btnExport, #btnImport, #btnExportPDF, #btnExportExcel, #btnImportExcel, #btnExcelTemplate, #searchExpenses, #savingsGoal, .goal-item, #btnAddNote, #noteInput').forEach(el => {
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('input, select, button[type="submit"]').forEach(el => el.disabled = true);
}

// --- Agenda ---
function renderNotes() {
    const {notes} = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const list = document.getElementById('notesList');
    const em = document.getElementById('notesEmpty');
    if (!list || !em) return;
    list.innerHTML = '';
    if(notes.length === 0) {
        em.style.display = 'block';
        return;
    }
    em.style.display = 'none';
    notes.forEach((n, i) => {
        const c = document.createElement('div');
        c.className = 'note-card';
        c.innerHTML = `
            <div style="flex:1;">
                <div class="note-text">${escapeHtml(n.text)}</div>
                <div class="note-time">${n.timestamp ? new Date(n.timestamp).toLocaleDateString('pt-BR') : ''}</div>
            </div>
            <button class="btn btn-note-del" onclick="deleteNote(${i})" title="Excluir" aria-label="Excluir anotação">✖</button>
        `;
        list.appendChild(c);
    });
}

function addNote(t) {
    if(!t.trim()) return;
    const d = loadData();
    const k = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
    if(!d.monthOverrides[k]) d.monthOverrides[k] = { added:[], removed:[], modified:{}, notes:[] };
    d.monthOverrides[k].notes.push({ text: t.trim(), timestamp: Date.now() });
    saveData(d);
    document.getElementById('noteInput').value = '';
    showToast('Anotação adicionada! 📝');
    renderNotes();
}

function deleteNote(i) {
    const d = loadData();
    const k = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
    if(d.monthOverrides[k]) {
        d.monthOverrides[k].notes.splice(i, 1);
        saveData(d);
        renderNotes();
    }
}

// --- Smart Suggestions ---
function setupSmartSuggestions() {
    const i = document.getElementById('itemDescription');
    const b = document.getElementById('smartSuggestion');
    if (!i || !b) return;
    i.addEventListener('input', e => {
        const v = e.target.value.toLowerCase();
        const matches = Object.keys(SMART_DICT).filter(k => k.includes(v) && v.length > 1);
        if(matches.length > 0) {
            b.innerHTML = matches.map(x => `<div class="suggestion-item" data-val="${x}" role="option">${x}</div>`).join('');
            b.classList.add('show');
        } else b.classList.remove('show');
    });
    i.addEventListener('blur', () => setTimeout(() => b.classList.remove('show'), 150));
    b.addEventListener('click', e => {
        const it = e.target.closest('.suggestion-item');
        if(!it) return;
        i.value = it.dataset.val;
        const c = SMART_DICT[it.dataset.val];
        if(c) document.getElementById('itemCategory').value = c;
        b.classList.remove('show');
    });
}

// --- Modal principal e CRUD ---
function renderMonthGrid(selected = [], includeCurrent = false) {
    const grid = document.getElementById('monthsCheckGrid'); 
    if (!grid) return;
    grid.innerHTML = '';
    const start = includeCurrent ? 0 : 1;
    for (let i = start; i <= 12; i++) {
        let m = (APP_STATE.currentMonth + i) % 12;
        let y = APP_STATE.currentYear + Math.floor((APP_STATE.currentMonth + i) / 12);
        const key = getMonthKey(m, y);
        const checked = selected.includes(key);
        const label = document.createElement('label');
        label.className = 'month-check-item';
        label.innerHTML = `<input type="checkbox" value="${key}" ${checked ? 'checked' : ''}> <span>${MONTHS[m].substring(0,3)}/${y.toString().slice(2)}</span>`;
        grid.appendChild(label);
    }
}

function openModal(type, id=null) {
    const ov = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const catGrp = document.getElementById('categoryGroup');
    const occGrp = document.getElementById('occurrenceGroup');
    const freqGrp = document.getElementById('frequencyGroup');
    const installmentGrp = document.getElementById('installmentGroup');
    
    document.getElementById('itemType').value = type;
    document.getElementById('itemId').value = id || '';
    
    if(type === 'expense') {
        catGrp.style.display = 'block';
        occGrp.style.display = 'block';
        freqGrp.style.display = 'none';
        installmentGrp.style.display = 'block';
        title.textContent = id ? 'Editar Despesa' : 'Adicionar Despesa';
        renderCategorySelect();
    } else {
        catGrp.style.display = 'none';
        occGrp.style.display = 'block';
        freqGrp.style.display = 'block';
        installmentGrp.style.display = 'none';
        title.textContent = id ? 'Editar Receita' : 'Adicionar Receita';
    }
    
    document.getElementById('smartSuggestion').classList.remove('show');
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemAmount').value = '';
    document.getElementById('itemDueDate').value = '';
    document.getElementById('installments').value = '';
    document.querySelector('input[name="occurrenceType"][value="single"]').checked = true;
    document.getElementById('monthSelectionGrid').style.display = 'none';
    if(type === 'income') {
        document.querySelector('input[name="frequency"][value="monthly"]').checked = true;
    }
    
    if(id) {
        const d = loadData();
        let item = d.recurringItems.find(i => i.id === id);
        if(!item) {
            const k = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
            const ovrs = d.monthOverrides[k] || { added: [] };
            item = ovrs.added.find(i => i.id === id);
            if(!item && ovrs.modified[id]) {
                const base = d.recurringItems.find(i => i.id === id);
                item = base ? { ...base, ...ovrs.modified[id] } : null;
            }
        }
        if(item) {
            document.getElementById('itemDescription').value = item.description;
            document.getElementById('itemAmount').value = item.amount.toFixed(2).replace('.', ',');
            if (item.dueDate) {
                const dueDate = new Date(item.dueDate);
                if (!isNaN(dueDate)) {
                    document.getElementById('itemDueDate').value = dueDate.toISOString().split('T')[0];
                }
            }
            if(type === 'expense') {
                renderCategorySelect();
                document.getElementById('itemCategory').value = item.category || 'outros';
            }
            if(type === 'income' && item.frequency) {
                document.querySelector(`input[name="frequency"][value="${item.frequency}"]`).checked = true;
            }
            const isRec = (item.activeMonths || []).length > 1;
            document.querySelector(`input[name="occurrenceType"][value="${isRec ? 'recurring' : 'single'}"]`).checked = true;
            document.getElementById('monthSelectionGrid').style.display = isRec ? 'block' : 'none';
            if(isRec) renderMonthGrid(item.activeMonths, true);
            if (type === 'expense' && item.installments) {
                document.getElementById('installments').value = item.installments;
            }
        }
    }
    
    document.querySelectorAll('input[name="occurrenceType"]').forEach(r => {
        r.onchange = (e) => {
            const showGrid = e.target.value === 'recurring';
            document.getElementById('monthSelectionGrid').style.display = showGrid ? 'block' : 'none';
            if(showGrid) {
                let selected = id ? (loadData().recurringItems.find(i => i.id === id)?.activeMonths || []) : [];
                if (!id && type === 'income') {
                    selected = [getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear)];
                }
                renderMonthGrid(selected, true);
            }
        };
    });
    
    ov.classList.add('active');
    setTimeout(() => document.getElementById('itemDescription').focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function saveItem(e) {
    e.preventDefault();
    const type = document.getElementById('itemType').value;
    const desc = document.getElementById('itemDescription').value.trim();
    const amt = parseCurrency(document.getElementById('itemAmount').value);
    const dueDateStr = document.getElementById('itemDueDate').value;
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
    const cat = type === 'expense' ? document.getElementById('itemCategory').value : null;
    const editId = document.getElementById('itemId').value;
    const installments = type === 'expense' ? parseInt(document.getElementById('installments').value) || 0 : 0;
    
    if(!desc) return showToast('Informe a descrição!', 'error');
    if(!amt || amt <= 0) return showToast('Valor inválido!', 'error');
    
    const d = loadData();
    let activeMonths = [];
    const occurrence = document.querySelector('input[name="occurrenceType"]:checked')?.value;
    if(occurrence === 'recurring') {
        document.querySelectorAll('#monthsCheckGrid input:checked').forEach(cb => activeMonths.push(cb.value));
        if (activeMonths.length === 0) {
            showToast('Selecione pelo menos um mês!', 'error');
            return;
        }
    } else {
        activeMonths = [getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear)];
    }
    
    let frequency = 'monthly';
    if(type === 'income') {
        const freqRadio = document.querySelector('input[name="frequency"]:checked');
        if(freqRadio) frequency = freqRadio.value;
    }
    
    const newItem = {
        id: editId || generateId(),
        description: desc,
        amount: amt,
        dueDate: dueDate ? dueDate.toISOString() : null,
        category: cat,
        type: type,
        activeMonths: activeMonths,
        frequency: type === 'income' ? frequency : undefined,
        installments: installments > 1 ? installments : undefined
    };
    
    if(editId) {
        const existingIdx = d.recurringItems.findIndex(i => i.id === editId);
        const isRecurringBase = (existingIdx !== -1);
        if(isRecurringBase) {
            d.recurringItems[existingIdx] = newItem;
        } else {
            const key = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
            if(d.monthOverrides[key]) {
                const idx = d.monthOverrides[key].added.findIndex(i => i.id === editId);
                if(idx !== -1) d.monthOverrides[key].added[idx] = newItem;
                else d.monthOverrides[key].modified[editId] = newItem;
            } else {
                if(!d.monthOverrides[key]) d.monthOverrides[key] = { added:[], removed:[], modified:{}, notes:[] };
                d.monthOverrides[key].added.push(newItem);
            }
        }
        showToast('Item atualizado! 🔄');
    } else {
        if(activeMonths.length > 1 || (type === 'expense' && installments > 1)) {
            if (type === 'expense' && installments > 1) {
                const startMonthKey = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
                const [year, month] = startMonthKey.split('-').map(Number);
                const newMonths = [];
                for (let i = 0; i < installments; i++) {
                    let m = month - 1 + i;
                    let y = year;
                    if (m >= 12) {
                        y += Math.floor(m / 12);
                        m = m % 12;
                    }
                    newMonths.push(getMonthKey(m, y));
                }
                newItem.activeMonths = newMonths;
                d.recurringItems.push(newItem);
                showToast(`Despesa parcelada em ${installments}x criada! 🔄`);
            } else {
                d.recurringItems.push(newItem);
                showToast(type==='income' ? 'Receita recorrente criada! 🔄' : 'Despesa recorrente criada! 🔄');
            }
        } else {
            const k = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
            if(!d.monthOverrides[k]) d.monthOverrides[k] = { added:[], removed:[], modified:{}, notes:[] };
            d.monthOverrides[k].added.push(newItem);
            showToast('Item único adicionado! 📌');
        }
    }
    saveData(d);
    closeModal();
    renderAll();
}

function deleteItem(type, id) {
    if(!confirm('Excluir este item?')) return;
    const d = loadData();
    const isRec = d.recurringItems.some(i => i.id === id);
    const s = prompt('Excluir APENAS deste mês (1) ou TODOS (2)?');
    if(s !== '2' && s !== '1') return;
    if(isRec && s === '2') {
        d.recurringItems = d.recurringItems.filter(i => i.id !== id);
        Object.keys(d.monthOverrides).forEach(k => {
            const ov = d.monthOverrides[k];
            ov.removed = ov.removed.filter(r => r !== id);
            delete ov.modified[id];
        });
        showToast('Excluído permanentemente! 🗑️');
    } else {
        const k = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
        if(!d.monthOverrides[k]) d.monthOverrides[k] = { added:[], removed:[], modified:{}, notes:[] };
        if(isRec) d.monthOverrides[k].removed.push(id);
        else d.monthOverrides[k].added = d.monthOverrides[k].added.filter(i => i.id !== id);
        showToast('Removido deste mês! 📅');
    }
    saveData(d);
    renderAll();
}

function editItem(type, id) {
    openModal(type, id);
}

// --- Excel ---
function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const data = [{
        Tipo: 'Despesa', Descrição: 'Aluguel', Categoria: 'moradia', Valor: 1200,
        Meses_Ativos: '2025-01,2025-02,2025-03', Dia_Vencimento: '2025-01-10', Frequencia: 'mensal'
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:15},{wch:30},{wch:15},{wch:10},{wch:30},{wch:15},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "Modelo_Importacao_Orcamento.xlsx");
    showToast('Modelo baixado! Preencha e importe. 📥');
}

function exportExcel() {
    const d = loadData();
    const rows = [];
    d.recurringItems.forEach(i => {
        rows.push({
            'Tipo': i.type === 'income' ? 'Receita' : 'Despesa',
            'Descrição': i.description,
            'Categoria': i.category || '-',
            'Valor': i.amount,
            'Meses_Ativos': (i.activeMonths || []).join(','),
            'Dia_Vencimento': i.dueDate ? new Date(i.dueDate).toISOString().split('T')[0] : '',
            'Frequencia': i.frequency || 'mensal'
        });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orçamento");
    XLSX.writeFile(wb, `Orcamento_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Planilha exportada! 📊');
}

function importExcel(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);
            const data = loadData();
            for (const row of json) {
                const type = row.Tipo === 'Receita' ? 'income' : 'expense';
                let activeMonths = [];
                let monthsRaw = row.Meses_Ativos || '';
                if (typeof monthsRaw === 'string') {
                    activeMonths = monthsRaw.split(',').map(s => s.trim()).filter(s => /^\d{4}-\d{2}$/.test(s));
                } else if (Array.isArray(monthsRaw)) {
                    activeMonths = monthsRaw.filter(s => /^\d{4}-\d{2}$/.test(s));
                }
                if (activeMonths.length === 0) {
                    activeMonths = [getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear)];
                }
                const frequency = (type === 'income' && row.Frequencia) ? row.Frequencia : 'monthly';
                let dueDate = null;
                if (row.Dia_Vencimento) {
                    const parsed = new Date(row.Dia_Vencimento);
                    if (!isNaN(parsed)) dueDate = parsed.toISOString();
                }
                const item = {
                    id: generateId(),
                    description: row.Descrição || 'Importado',
                    amount: parseFloat(row.Valor) || 0,
                    category: row.Categoria || 'outros',
                    dueDate: dueDate,
                    type: type,
                    activeMonths: activeMonths,
                    frequency: frequency
                };
                data.recurringItems.push(item);
            }
            saveData(data);
            renderAll();
            showToast('Planilha importada com sucesso! 📥');
        } catch (err) {
            console.error(err);
            showToast('Erro ao ler planilha. Use o modelo fornecido.', 'error');
        }
    };
    reader.readAsBinaryString(file);
}

// --- Filter Bar (com categorias personalizadas) ---
function renderFilterBar() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar) return;
    filterBar.innerHTML = '';
    const filters = ['all', ...Object.keys(CATEGORY_LABELS), ...customCategories.map(c => c.id)];
    filters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${APP_STATE.currentFilter === f ? 'active' : ''}`;
        btn.setAttribute('data-filter', f);
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', APP_STATE.currentFilter === f);
        let label = f === 'all' ? '📌 Todas' : (CATEGORY_LABELS[f] || customCategories.find(c => c.id === f)?.name || f);
        btn.textContent = label;
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(x => {
                x.classList.remove('active');
                x.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            APP_STATE.currentFilter = f;
            renderItems('expense');
            updateSelectedTotal();
        };
        filterBar.appendChild(btn);
    });
}

// --- Render All ---
function renderAll() {
    updateMonthDisplay();
    updateSummary();
    renderItems('income');
    renderItems('expense');
    renderChart();
    renderEvolutionChart();
    renderHistory();
    renderCalendar();
    renderNotes();
    renderFilterBar();
    checkDueAlerts();
    updateSelectedTotal();
}

// --- Init App ---
function initApp() {
    loadCustomCategories();
    renderCategorySelect();
    if(APP_STATE.isViewOnly) applyViewOnly();
    renderAll();
    initTheme();
    setupSmartSuggestions();
    initPWA();
    initCalculator();
    setupAmountMask();
    
    document.getElementById('btnThemeToggle').onclick = toggleTheme;
    document.getElementById('btnPrevMonth').onclick = () => { 
        APP_STATE.currentMonth--; 
        if(APP_STATE.currentMonth < 0) { APP_STATE.currentMonth = 11; APP_STATE.currentYear--; } 
        renderAll(); 
    };
    document.getElementById('btnNextMonth').onclick = () => { 
        APP_STATE.currentMonth++; 
        if(APP_STATE.currentMonth > 11) { APP_STATE.currentMonth = 0; APP_STATE.currentYear++; } 
        renderAll(); 
    };
    document.querySelectorAll('.btn-add').forEach(b => b.onclick = () => { 
        document.getElementById('itemId').value = ''; 
        openModal(b.dataset.type); 
    });
    document.getElementById('btnCloseModal').onclick = closeModal;
    document.getElementById('btnCancelModal').onclick = closeModal;
    document.getElementById('modalOverlay').onclick = e => { if(e.target === e.currentTarget) closeModal(); };
    document.getElementById('itemForm').onsubmit = saveItem;
    document.getElementById('searchExpenses').oninput = () => { renderItems('expense'); updateSelectedTotal(); };
    document.getElementById('savingsGoal').oninput = () => updateSummary();
    document.getElementById('savingsGoal').value = localStorage.getItem('savingsGoal') || '500,00';
    document.getElementById('savingsGoal').onblur = e => { 
        localStorage.setItem('savingsGoal', e.target.value); 
        updateSummary(); 
    };
    document.getElementById('btnExport').onclick = () => { 
        const d = loadData(); 
        const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); 
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(b); 
        a.download = `orcamento-${new Date().toISOString().slice(0,10)}.json`; 
        a.click(); 
        URL.revokeObjectURL(a.href); 
        showToast('Backup JSON exportado!'); 
    };
    document.getElementById('btnExportPDF').onclick = exportAdvancedPDF;
    document.getElementById('btnExportExcel').onclick = exportExcel;
    document.getElementById('btnExcelTemplate').onclick = downloadExcelTemplate;
    document.getElementById('btnImport').onclick = () => document.getElementById('fileImport').click();
    document.getElementById('fileImport').onchange = e => { 
        if(e.target.files[0]) { 
            const r = new FileReader(); 
            r.onload = ev => { 
                try { 
                    const d = loadData(); 
                    const imp = JSON.parse(ev.target.result); 
                    const merged = { 
                        recurringItems: imp.recurringItems || d.recurringItems, 
                        monthOverrides: { ...d.monthOverrides, ...imp.monthOverrides },
                        categoryGoals: imp.categoryGoals || d.categoryGoals || {}
                    }; 
                    saveData(merged); 
                    renderAll(); 
                    showToast('Restaurado!'); 
                } catch { showToast('Erro!', 'error'); } 
            }; 
            r.readAsText(e.target.files[0]); 
        } 
        e.target.value = ''; 
    };
    document.getElementById('btnImportExcel').onclick = () => document.getElementById('fileImportExcel').click();
    document.getElementById('fileImportExcel').onchange = e => { 
        if(e.target.files[0]) importExcel(e.target.files[0]); 
        e.target.value = ''; 
    };
    document.getElementById('btnLogout').onclick = logout;
    document.getElementById('btnAddNote').onclick = () => addNote(document.getElementById('noteInput').value);
    document.getElementById('noteInput').onkeydown = e => { if(e.key === 'Enter') { e.preventDefault(); addNote(document.getElementById('noteInput').value); } };
    
    // Botões de seleção
    document.getElementById('btnSelectAll').onclick = selectAllExpenses;
    document.getElementById('btnClearSelection').onclick = clearSelection;
    
    // Gerenciar categorias
    document.getElementById('btnManageCategories')?.addEventListener('click', openCategoriesModal);
    document.getElementById('btnCloseCatModal')?.addEventListener('click', closeCategoriesModal);
    document.getElementById('btnAddCategory')?.addEventListener('click', () => {
        const name = document.getElementById('newCategoryName').value.trim();
        if (name && !customCategories.some(c => c.name === name)) {
            customCategories.push({ id: 'cat_' + Date.now(), name });
            saveCustomCategories();
            document.getElementById('newCategoryName').value = '';
            openCategoriesModal();
        } else if (name && customCategories.some(c => c.name === name)) {
            showToast('Categoria já existe!', 'error');
        }
    });
    document.getElementById('modalCategoriesOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCategoriesModal();
    });
    
    document.onkeydown = e => { if(e.key === 'Escape') closeModal(); };
    window.onresize = () => { if(categoryChart) categoryChart.resize(); if(evolutionChart) evolutionChart.resize(); };
    document.addEventListener('keydown', e => { 
        if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return; 
        if(e.key === 'ArrowLeft') document.getElementById('btnPrevMonth').click(); 
        if(e.key === 'ArrowRight') document.getElementById('btnNextMonth').click(); 
        if(e.key.toLowerCase() === 'n') document.querySelector('.btn-add')?.click(); 
        if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { 
            e.preventDefault(); 
            document.getElementById('searchExpenses')?.focus(); 
        } 
    });
}

// --- Autenticação inicial ---
if(checkAuth()) { 
    initApp(); 
} else {
    document.getElementById('loginForm').onsubmit = async e => { 
        e.preventDefault(); 
        if(await login(document.getElementById('password').value)) { 
            document.getElementById('loginError').textContent = ''; 
            initApp(); 
        } else { 
            document.getElementById('loginError').textContent = 'Senha incorreta.'; 
            document.getElementById('password').value = ''; 
            document.getElementById('password').focus(); 
        } 
    };
    document.getElementById('password').focus();
}
