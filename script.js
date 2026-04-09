/* ============================================
   ORÇAMENTO FAMILIAR - SCRIPT COMPLETO
   ============================================ */

// 🔐 Configuração de Segurança (Front-end)
const APP_CONFIG = {
    password: 'familia2026', // ← Altere sua senha aqui
    sessionKey: 'budgetAppSession',
    sessionDuration: 7 * 24 * 60 * 60 * 1000 // 7 dias
};

const APP_STATE = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    currentFilter: 'all',
    isViewOnly: new URLSearchParams(window.location.search).get('viewonly') === '1'
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATEGORY_LABELS = { moradia:'🏠 Moradia', alimentacao:'🍔 Alimentação', transporte:'🚗 Transporte', saude:'💊 Saúde', educacao:'📚 Educação', lazer:'🎮 Lazer', vestuario:'👕 Vestuário', outros:'📦 Outros' };
const CATEGORY_COLORS = { moradia:'#e17055', alimentacao:'#fdcb6e', transporte:'#74b9ff', saude:'#55efc4', educacao:'#a29bfe', lazer:'#fd79a8', vestuario:'#00cec9', outros:'#636e72' };

// ─── STORAGE ──────────────────────────────
function loadData() {
    try { const d = localStorage.getItem('budgetAppData'); return d ? JSON.parse(d) : {}; } 
    catch { return {}; }
}
function saveData(data) {
    try { localStorage.setItem('budgetAppData', JSON.stringify(data)); } 
    catch { showToast('Erro ao salvar!', 'error'); }
}
function getMonthKey(m, y) { return `${y}-${String(m+1).padStart(2,'0')}`; }
function getMonthData(m, y) {
    const data = loadData();
    const key = getMonthKey(m, y);
    if (!data[key]) data[key] = { income: [], expenses: [] };
    return { data, key, monthData: data[key] };
}

// ─── UTILITÁRIOS ──────────────────────────
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function parseCurrency(str) { if (typeof str === 'number') return str; return parseFloat(str.replace(/[^\d,]/g, '').replace(',','.')) || 0; }
function normalizeValue(item) {
    let v = item.amount;
    const f = item.frequency || 'mensal';
    if (f === 'semanal') v *= 4.33;
    else if (f === 'quinzenal') v *= 2;
    else if (f === 'anual') v /= 12;
    return v;
}
function showToast(msg, type='success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ─── AUTH ─────────────────────────────────
function checkAuth() {
    const s = sessionStorage.getItem(APP_CONFIG.sessionKey);
    if (s) {
        const { token, ts } = JSON.parse(s);
        if (token === btoa(APP_CONFIG.password) && Date.now() - ts < APP_CONFIG.sessionDuration) {
            document.getElementById('loginScreen').classList.add('hidden');
            return true;
        }
    }
    return false;
}
function login(pwd) {
    if (pwd === APP_CONFIG.password) {
        sessionStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ token: btoa(pwd), ts: Date.now() }));
        document.getElementById('loginScreen').classList.add('hidden');
        showToast('Bem-vindo! 👋');
        return true;
    }
    return false;
}
function logout() { sessionStorage.removeItem(APP_CONFIG.sessionKey); location.reload(); }

// ─── UI RENDER ────────────────────────────
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = MONTHS[APP_STATE.currentMonth];
    document.getElementById('currentYear').textContent = APP_STATE.currentYear;
}

function updateSummary() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const inc = monthData.income.reduce((s,i) => s + normalizeValue(i), 0);
    const exp = monthData.expenses.reduce((s,i) => s + normalizeValue(i), 0);
    const bal = inc - exp;
    const goal = getSavingsGoal();
    const pct = goal > 0 ? (Math.max(0, bal) / goal) * 100 : 0;

    document.getElementById('totalIncome').textContent = formatCurrency(inc);
    document.getElementById('totalExpense').textContent = formatCurrency(exp);
    
    const balEl = document.getElementById('totalBalance');
    balEl.textContent = formatCurrency(bal);
    const cardBal = document.getElementById('cardBalance');
    cardBal.classList.remove('positive','negative');
    if (bal > 0) cardBal.classList.add('positive');
    else if (bal < 0) cardBal.classList.add('negative');

    document.getElementById('totalSavings').textContent = formatCurrency(Math.max(0, bal));
    document.getElementById('savingsFill').style.width = Math.min(100, pct) + '%';
    document.getElementById('savingsPercent').textContent = `${pct.toFixed(1)}% da meta de ${formatCurrency(goal)}`;
}

function getSavingsGoal() {
    const el = document.getElementById('savingsGoal');
    if (!el) return 500;
    return parseCurrency(el.value) || 500;
}

function renderItems(type) {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const listId = type === 'income' ? 'incomeList' : 'expenseList';
    const emptyId = type === 'income' ? 'incomeEmpty' : 'expenseEmpty';
    const listEl = document.getElementById(listId);
    const emptyEl = document.getElementById(emptyId);

    let items = type === 'income' ? monthData.income : monthData.expenses;
    
    // Filtros e busca
    if (type === 'expense') {
        if (APP_STATE.currentFilter !== 'all') items = items.filter(i => i.category === APP_STATE.currentFilter);
        const search = document.getElementById('searchExpenses')?.value.toLowerCase() || '';
        if (search) items = items.filter(i => i.description.toLowerCase().includes(search) || i.category?.includes(search));
    }

    listEl.innerHTML = '';
    if (items.length === 0) { emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        const val = normalizeValue(item);
        const cls = type === 'income' ? 'income' : 'expense';
        const sign = type === 'income' ? '+' : '-';
        let catHTML = type === 'expense' && item.category ? `<span class="item-category">${CATEGORY_LABELS[item.category]||item.category}</span>` : '';
        let freqHTML = item.frequency && item.frequency !== 'mensal' ? `<span class="item-frequency">${item.frequency}</span>` : '';
        let dueHTML = item.dueDate ? `<span class="item-due">Venc. dia ${item.dueDate}</span>` : '';

        card.innerHTML = `
            <div class="item-info">
                <div class="item-description">${item.description}</div>
                <div class="item-meta">${catHTML}${freqHTML}${dueHTML}</div>
            </div>
            <div class="item-value ${cls}">${sign} ${formatCurrency(val)}</div>
            <div class="item-actions">
                <button class="btn btn-edit" onclick="editItem('${type}','${item.id}')" title="Editar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-delete" onclick="deleteItem('${type}','${item.id}')" title="Excluir">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function renderChart() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const totals = {};
    monthData.expenses.forEach(i => { totals[i.category||'outros'] = (totals[i.category||'outros']||0) + normalizeValue(i); });
    
    const canvas = document.getElementById('categoryChart');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('chartContainer');
    const entries = Object.entries(totals);
    
    if (entries.length === 0) { container.innerHTML = '<div class="empty-state"><p>Sem dados para exibir</p></div>'; return; }
    container.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.id = 'categoryChart';
    container.appendChild(cv);
    const c = cv.getContext('2d');
    const size = Math.min(container.clientWidth, 350);
    cv.width = size*2; cv.height = size*2;
    cv.style.width = size+'px'; cv.style.height = size+'px';
    c.scale(2,2);

    const total = entries.reduce((s,[,v])=>s+v,0);
    const cx=size/2, cy=size/2, r=size/3, ir=r*0.6;
    let start = -Math.PI/2;
    
    entries.forEach(([cat, val]) => {
        const angle = (val/total)*2*Math.PI;
        c.beginPath(); c.arc(cx,cy,r,start,start+angle); c.arc(cx,cy,ir,start+angle,start,true); c.closePath();
        c.fillStyle = CATEGORY_COLORS[cat]||'#636e72'; c.fill();
        start += angle;
    });
    
    c.beginPath(); c.arc(cx,cy,ir-2,0,Math.PI*2); c.fillStyle='#1a1d27'; c.fill();
    c.fillStyle='#e8eaed'; c.font=`bold ${size*0.06}px Inter, sans-serif`; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(formatCurrency(total), cx, cy-8);
    c.font=`${size*0.035}px Inter, sans-serif`; c.fillStyle='#9aa0b0';
    c.fillText('Total Despesas', cx, cy+12);

    const legendY = size*0.88; let lx = size*0.05;
    entries.forEach(([cat, val]) => {
        const label = CATEGORY_LABELS[cat]||cat;
        c.fillStyle = CATEGORY_COLORS[cat]||'#636e72';
        c.fillRect(lx, legendY, 10, 10);
        c.fillStyle='#9aa0b0'; c.font=`${size*0.032}px Inter, sans-serif`; c.textAlign='left'; c.textBaseline='middle';
        c.fillText(label, lx+14, legendY+5);
        lx += c.measureText(label).width + 30;
    });
}

function renderHistory() {
    const data = loadData();
    const tbody = document.getElementById('historyBody');
    const emptyEl = document.getElementById('historyEmpty');
    tbody.innerHTML = '';
    const keys = Object.keys(data).sort().reverse();
    if (keys.length===0) { emptyEl.style.display='block'; return; }
    emptyEl.style.display='none';
    
    keys.forEach(k => {
        const md = data[k];
        const inc = md.income.reduce((s,i)=>s+normalizeValue(i),0);
        const exp = md.expenses.reduce((s,i)=>s+normalizeValue(i),0);
        const bal = inc-exp;
        const [y,m] = k.split('-');
        const cls = bal>0?'amount-positive':bal<0?'amount-negative':'amount-neutral';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${MONTHS[parseInt(m)-1]}/${y}</td><td class="amount-income">${formatCurrency(inc)}</td><td class="amount-expense">${formatCurrency(exp)}</td><td class="${cls}">${formatCurrency(bal)}</td>`;
        tbody.appendChild(tr);
    });
}

function checkDueAlerts() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const today = new Date().getDate();
    const upcoming = monthData.expenses.filter(i => i.dueDate && i.dueDate >= today && i.dueDate <= today+3);
    if (upcoming.length > 0) showToast(`⚠️ ${upcoming.length} vencimento(s) nos próximos 3 dias!`, 'error');
}

function exportPDF() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const inc = monthData.income.reduce((s,i)=>s+normalizeValue(i),0);
    const exp = monthData.expenses.reduce((s,i)=>s+normalizeValue(i),0);
    const bal = inc-exp;
    let t = `ORÇAMENTO FAMILIAR\n${MONTHS[APP_STATE.currentMonth]}/${APP_STATE.currentYear}\n`;
    t += '═'.repeat(40)+'\n\n';
    t += `RECEITAS: ${formatCurrency(inc)}\nDESPESAS: ${formatCurrency(exp)}\nSALDO: ${formatCurrency(bal)}\n\nDESPESAS POR CATEGORIA:\n`;
    const cats = {}; monthData.expenses.forEach(i => cats[i.category||'outros']=(cats[i.category||'outros']||0)+normalizeValue(i));
    Object.entries(cats).forEach(([c,v]) => t += `• ${CATEGORY_LABELS[c]||c}: ${formatCurrency(v)}\n`);
    
    const w = window.open('','_blank');
    w.document.write(`<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${t}</pre>`);
    w.document.close();
    setTimeout(()=>w.print(), 500);
}

function applyViewOnly() {
    if (!APP_STATE.isViewOnly) return;
    const selectors = '.btn-add, .btn-edit, .btn-delete, #btnExport, #btnImport, #btnExportPDF, #searchExpenses, #savingsGoal';
    document.querySelectorAll(selectors).forEach(el => el.style.display = 'none');
    document.querySelectorAll('input, select, button[type="submit"]').forEach(el => el.disabled = true);
}

// ─── CRUD ─────────────────────────────────
function openModal(type, id=null) {
    const ov = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const catGrp = document.getElementById('categoryGroup');
    
    document.getElementById('itemType').value = type;
    if (type==='expense') { catGrp.style.display='block'; title.textContent = id?'Editar Despesa':'Adicionar Despesa'; }
    else { catGrp.style.display='none'; title.textContent = id?'Editar Receita':'Adicionar Receita'; }

    if (id) {
        const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
        const items = type==='income'?monthData.income:monthData.expenses;
        const item = items.find(i=>i.id===id);
        if (item) {
            document.getElementById('itemDescription').value = item.description;
            document.getElementById('itemAmount').value = item.amount.toString().replace('.',',');
            document.getElementById('itemFrequency').value = item.frequency||'mensal';
            document.getElementById('itemDueDate').value = item.dueDate||'';
            if (type==='expense') document.getElementById('itemCategory').value = item.category||'outros';
        }
    } else document.getElementById('itemForm').reset();

    ov.classList.add('active');
    setTimeout(()=>document.getElementById('itemDescription').focus(),100);
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }

function saveItem(e) {
    e.preventDefault();
    const type = document.getElementById('itemType').value;
    const desc = document.getElementById('itemDescription').value.trim();
    const amt = parseCurrency(document.getElementById('itemAmount').value);
    const freq = document.getElementById('itemFrequency').value;
    const due = parseInt(document.getElementById('itemDueDate').value)||null;
    const cat = type==='expense'?document.getElementById('itemCategory').value:null;
    
    if (!desc) return showToast('Informe a descrição!','error');
    if (!amt || amt<=0) return showToast('Valor inválido!','error');

    const { data, key, monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const items = type==='income'?monthData.income:monthData.expenses;
    const item = { id: document.getElementById('itemId').value||generateId(), description:desc, amount:amt, frequency:freq, dueDate:due, category:cat };
    
    const editId = document.getElementById('itemId').value;
    if (editId) { const idx = items.findIndex(i=>i.id===editId); if(idx!==-1) items[idx]=item; showToast('Atualizado!'); }
    else { items.push(item); showToast('Adicionado!'); }
    
    data[key] = monthData; saveData(data); closeModal(); renderAll();
}

function deleteItem(type, id) {
    if (!confirm('Excluir este item?')) return;
    const { data, key, monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const items = type==='income'?monthData.income:monthData.expenses;
    const idx = items.findIndex(i=>i.id===id);
    if (idx!==-1) { items.splice(idx,1); data[key]=monthData; saveData(data); showToast('Excluído!'); renderAll(); }
}

function editItem(type, id) { openModal(type, id); document.getElementById('itemId').value = id; }

function exportData() {
    const d = loadData();
    const blob = new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`orcamento-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast('Backup exportado!');
}

function importData(file) {
    const r = new FileReader();
    r.onload = e => {
        try {
            const imp = JSON.parse(e.target.result);
            if (typeof imp==='object') { const merged={...loadData(), ...imp}; saveData(merged); showToast('Restaurado!'); renderAll(); }
            else showToast('Arquivo inválido!','error');
        } catch { showToast('Erro ao ler arquivo!','error'); }
    };
    r.readAsText(file);
}

// ─── INIT & EVENTS ────────────────────────
function renderAll() {
    updateMonthDisplay(); updateSummary(); renderItems('income'); renderItems('expense'); renderChart(); renderHistory(); checkDueAlerts();
}

function initApp() {
    if (APP_STATE.isViewOnly) applyViewOnly();
    renderAll();
    
    document.getElementById('btnPrevMonth').onclick = () => { APP_STATE.currentMonth--; if(APP_STATE.currentMonth<0){APP_STATE.currentMonth=11;APP_STATE.currentYear--;} renderAll(); };
    document.getElementById('btnNextMonth').onclick = () => { APP_STATE.currentMonth++; if(APP_STATE.currentMonth>11){APP_STATE.currentMonth=0;APP_STATE.currentYear++;} renderAll(); };
    
    document.querySelectorAll('.btn-add').forEach(btn => btn.onclick = () => { document.getElementById('itemId').value=''; openModal(btn.dataset.type); });
    document.getElementById('btnCloseModal').onclick = closeModal;
    document.getElementById('btnCancelModal').onclick = closeModal;
    document.getElementById('modalOverlay').onclick = e => { if(e.target===e.currentTarget) closeModal(); };
    document.getElementById('itemForm').onsubmit = saveItem;
    
    document.getElementById('itemAmount').oninput = function(e) { let v=e.target.value.replace(/[^\d]/g,''); if(v){e.target.value=(parseInt(v)/100).toFixed(2).replace('.',',');} };
    
    document.querySelectorAll('.filter-btn').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); APP_STATE.currentFilter=btn.dataset.filter; renderItems('expense');
    });
    
    document.getElementById('searchExpenses').oninput = () => renderItems('expense');
    document.getElementById('savingsGoal').oninput = () => updateSummary();
    document.getElementById('savingsGoal').value = localStorage.getItem('savingsGoal') || '500,00';
    document.getElementById('savingsGoal').onblur = function() { localStorage.setItem('savingsGoal', this.value); updateSummary(); };
    
    document.getElementById('btnExport').onclick = exportData;
    document.getElementById('btnExportPDF').onclick = exportPDF;
    document.getElementById('btnImport').onclick = () => document.getElementById('fileImport').click();
    document.getElementById('fileImport').onchange = e => { if(e.target.files[0]) importData(e.target.files[0]); e.target.value=''; };
    document.getElementById('btnLogout').onclick = logout;
    document.onkeydown = e => { if(e.key==='Escape') closeModal(); };
    window.onresize = () => { clearTimeout(window._rt); window._rt=setTimeout(renderChart,200); };
}

// Boot
if (checkAuth()) {
    initApp();
} else {
    document.getElementById('loginForm').onsubmit = e => {
        e.preventDefault();
        if (login(document.getElementById('password').value)) {
            document.getElementById('loginError').textContent = '';
            initApp();
        } else {
            document.getElementById('loginError').textContent = 'Senha incorreta. Tente novamente.';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    };
    document.getElementById('password').focus();
}
