/* ============================================
   ORÇAMENTO FAMILIAR - V7.0 (Evolução + Categorias Personalizáveis + Backup Drive)
   ============================================ */
const APP_CONFIG = { sessionKey: 'budgetAppSession', sessionDuration: 7 * 24 * 60 * 60 * 1000 };
const APP_STATE = { currentMonth: new Date().getMonth(), currentYear: new Date().getFullYear(), currentFilter: 'all', isViewOnly: new URLSearchParams(window.location.search).get('viewonly') === '1', trendMonths: 6 };
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
// Categorias padrão (serão mescladas com as personalizadas)
const DEFAULT_CATEGORIES = {
    'moradia': { name: '🏠 Moradia', color: '#e17055' },
    'alimentacao': { name: '🍔 Alimentação', color: '#fdcb6e' },
    'transporte': { name: '🚗 Transporte', color: '#74b9ff' },
    'saude': { name: '💊 Saúde', color: '#55efc4' },
    'educacao': { name: '📚 Educação', color: '#a29bfe' },
    'lazer': { name: '🎮 Lazer', color: '#fd79a8' },
    'vestuario': { name: '👕 Vestuário', color: '#00cec9' },
    'outros': { name: '📦 Outros', color: '#636e72' }
};
const SMART_DICT = { 'aluguel':'moradia','luz':'moradia','energia':'moradia','agua':'moradia','condominio':'moradia','internet':'moradia','mercado':'alimentacao','restaurante':'alimentacao','ifood':'alimentacao','uber':'transporte','99':'transporte','gasolina':'transporte','farmacia':'saude','medico':'saude','plano de saude':'saude','escola':'educacao','curso':'educacao','material':'educacao','netflix':'lazer','spotify':'lazer','cinema':'lazer','roupa':'vestuario','sapato':'vestuario','academia':'saude' };

let categoryChart = null;
let trendChart = null;

// ─── STORAGE & MIGRAÇÃO ───────────────────
function loadData() {
    try { 
        const raw = localStorage.getItem('budgetAppData'); 
        if (!raw) return { recurringItems: [], monthOverrides: {}, customCategories: {} }; 
        let data = JSON.parse(raw);
        // Migração de versões antigas
        if (data.recurringItems === undefined && Object.keys(data).some(k => /^\d{4}-\d{2}$/.test(k))) { 
            const newData = { recurringItems: [], monthOverrides: {}, customCategories: {} }; 
            Object.keys(data).forEach(k => { 
                data[k].income.forEach(i => newData.recurringItems.push({ ...i, type: 'income', activeMonths: [k] })); 
                data[k].expenses.forEach(i => newData.recurringItems.push({ ...i, type: 'expense', activeMonths: [k] })); 
            }); 
            data = newData; saveData(data); showToast('Dados migrados para novo sistema! 🔄'); 
        }
        data.recurringItems = data.recurringItems || [];
        data.monthOverrides = data.monthOverrides || {};
        data.customCategories = data.customCategories || {};
        // Normalização
        data.recurringItems = data.recurringItems.map(item => {
            if (item.duration && !item.activeMonths) {
                const start = item.startMonth || getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
                const months = [start];
                if (item.duration === 'infinite') { for(let i=1; i<=24; i++) { let m = (parseInt(start.split('-')[1])-1 + i)%12; let y = parseInt(start.split('-')[0]) + Math.floor((parseInt(start.split('-')[1])-1 + i)/12); months.push(getMonthKey(m,y)); } }
                else if (!isNaN(item.duration)) { for(let i=1; i<item.duration; i++) { let m = (parseInt(start.split('-')[1])-1 + i)%12; let y = parseInt(start.split('-')[0]) + Math.floor((parseInt(start.split('-')[1])-1 + i)/12); months.push(getMonthKey(m,y)); } }
                item.activeMonths = months;
                delete item.duration;
            }
            item.activeMonths = item.activeMonths || [];
            return item;
        });
        Object.keys(data.monthOverrides).forEach(k => {
            data.monthOverrides[k].notes = data.monthOverrides[k].notes || [];
            data.monthOverrides[k].added = data.monthOverrides[k].added || [];
            data.monthOverrides[k].removed = data.monthOverrides[k].removed || [];
            data.monthOverrides[k].modified = data.monthOverrides[k].modified || {};
        });
        return data;
    } catch { return { recurringItems: [], monthOverrides: {}, customCategories: {} }; }
}
function saveData(data) { try { localStorage.setItem('budgetAppData', JSON.stringify(data)); } catch { showToast('Erro ao salvar!', 'error'); } }
function getMonthKey(m, y) { return `${y}-${String(m+1).padStart(2,'0')}`; }
function isItemActiveForMonth(item, targetMonth, targetYear) {
    const key = getMonthKey(targetMonth, targetYear);
    return item.activeMonths.includes(key);
}
function getMonthData(m, y) {
    const data = loadData(); const key = getMonthKey(m, y); const overrides = data.monthOverrides[key] || { added: [], removed: [], modified: {}, notes: [] };
    let items = data.recurringItems.filter(item => isItemActiveForMonth(item, m, y));
    items = items.map(item => overrides.modified[item.id] ? { ...item, ...overrides.modified[item.id] } : item);
    items = items.filter(item => !overrides.removed.includes(item.id));
    items = items.concat(overrides.added);
    return { income: items.filter(i => i.type === 'income'), expenses: items.filter(i => i.type === 'expense'), key, notes: overrides.notes };
}

// ─── UTILITÁRIOS ──────────────────────────
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function parseCurrency(str) { if (typeof str === 'number') return str; return parseFloat(str.replace(/[^\d,]/g, '').replace(',','.')) || 0; }
function normalizeValue(item) { return item.amount || 0; }
function showToast(msg, type='success') { const c = document.getElementById('toastContainer'); const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function getDurationLabel(months) {
    if (months.length === 1) return '📌 Único';
    if (months.length > 12) return '♾️ Longo Prazo';
    return `🔄 ${months.length}x`;
}

// ─── CATEGORIAS PERSONALIZÁVEIS ────────────
function getCategories() {
    const data = loadData();
    const custom = data.customCategories || {};
    // Mescla com as padrão (sobrescreve se houver chave igual)
    const all = { ...DEFAULT_CATEGORIES, ...custom };
    return all;
}
function getCategoryColor(categoryId) {
    const cats = getCategories();
    return cats[categoryId]?.color || '#636e72';
}
function getCategoryName(categoryId) {
    const cats = getCategories();
    return cats[categoryId]?.name || categoryId;
}
function renderCategorySelect(selectedId = 'outros') {
    const select = document.getElementById('itemCategory');
    if (!select) return;
    const cats = getCategories();
    select.innerHTML = '';
    Object.entries(cats).forEach(([id, { name }]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        if (id === selectedId) option.selected = true;
        select.appendChild(option);
    });
}
function renderFilterBar() {
    const container = document.getElementById('filterBar');
    if (!container) return;
    const cats = getCategories();
    let html = `<button class="filter-btn ${APP_STATE.currentFilter === 'all' ? 'active' : ''}" data-filter="all">📋 Todas</button>`;
    Object.entries(cats).forEach(([id, { name }]) => {
        html += `<button class="filter-btn ${APP_STATE.currentFilter === id ? 'active' : ''}" data-filter="${id}">${name}</button>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
            btn.classList.add('active');
            APP_STATE.currentFilter = btn.dataset.filter;
            renderItems('expense');
        };
    });
}

// ─── AUTH & LOGOUT (HASH) ─────────────────
async function hashPassword(pwd) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
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
        const { token, ts } = JSON.parse(s); 
        if (token === 'ok' && Date.now() - ts < APP_CONFIG.sessionDuration) { 
            document.getElementById('loginScreen').classList.add('hidden'); 
            return true; 
        } 
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

// ─── THEME & PWA & CALC ───────────────────
function initTheme() { const saved = localStorage.getItem('appTheme'); const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); document.documentElement.setAttribute('data-theme', theme); updateThemeIcon(theme); updateMetaTheme(theme); }
function toggleTheme() { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('appTheme', next); updateThemeIcon(next); updateMetaTheme(next); if (categoryChart) { categoryChart.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary'); categoryChart.update(); } if (trendChart) { trendChart.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary'); trendChart.update(); } }
function updateThemeIcon(t) { document.getElementById('btnThemeToggle').textContent = t === 'dark' ? '☀️' : '🌙'; }
function updateMetaTheme(t) { document.getElementById('themeColorMeta').content = t === 'dark' ? '#0f1117' : '#f5f7fa'; }
function initPWA() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{}); }
function initCalculator() { let expr = ''; const d = document.getElementById('calcDisplay'); document.querySelectorAll('.calc-btn').forEach(b => b.onclick = () => { const v = b.dataset.val; if(v==='C') expr=''; else if(v==='⌫') expr=expr.slice(0,-1); else if(v==='=') { try { expr = String(Function('"use strict"; return ('+expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')+')')()); if(isNaN(+expr)||!isFinite(+expr)) expr='Erro'; } catch { expr='Erro'; } } else expr+=v; d.textContent = expr||'0'; }); }

// ─── MINI CALENDÁRIO com botão voltar ─────
function renderCalendar() {
    const grid = document.getElementById('miniCalendar');
    grid.innerHTML = `
        <div class="mini-calendar-title">📅 Próximos Meses</div>
        <div class="cal-grid" id="calGrid"></div>
        <button id="btnBackToCurrentMonth" class="btn btn-secondary btn-sm" style="margin-top: 0.75rem; width: 100%;">⬅️ Voltar ao mês atual</button>
    `;
    const cal = document.getElementById('calGrid');
    for(let i = 0; i < 12; i++) {
        let m = APP_STATE.currentMonth + i, y = APP_STATE.currentYear + Math.floor(m / 12);
        m %= 12;
        const key = getMonthKey(m, y);
        const md = getMonthData(m, y);
        const has = md.income.length > 0 || md.expenses.length > 0;
        const active = (m === APP_STATE.currentMonth && y === APP_STATE.currentYear);
        const btn = document.createElement('div');
        btn.className = `cal-item ${active ? 'active' : ''} ${has ? 'has-data' : ''}`;
        btn.innerHTML = `<div class="cal-abbr">${MONTHS_SHORT[m]}</div><div>${y.toString().slice(2)}</div>`;
        btn.onclick = () => {
            APP_STATE.currentMonth = m;
            APP_STATE.currentYear = y;
            renderAll();
        };
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

// ─── UI RENDER ────────────────────────────
function updateMonthDisplay() { document.getElementById('currentMonth').textContent = MONTHS[APP_STATE.currentMonth]; document.getElementById('currentYear').textContent = APP_STATE.currentYear; }
function updateSummary() {
    const {income, expenses} = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const inc=income.reduce((s,i)=>s+normalizeValue(i),0), exp=expenses.reduce((s,i)=>s+normalizeValue(i),0), bal=inc-exp;
    const prevM=APP_STATE.currentMonth===0?11:APP_STATE.currentMonth-1, prevY=APP_STATE.currentMonth===0?APP_STATE.currentYear-1:APP_STATE.currentYear;
    const prev=getMonthData(prevM,prevY), pInc=prev.income.reduce((s,i)=>s+normalizeValue(i),0), pExp=prev.expenses.reduce((s,i)=>s+normalizeValue(i),0);
    const iD=pInc>0?((inc-pInc)/pInc)*100:0, eD=pExp>0?((exp-pExp)/pExp)*100:0;
    document.getElementById('totalIncome').textContent=formatCurrency(inc); document.getElementById('totalExpense').textContent=formatCurrency(exp);
    renderTrend('trendIncome',iD,inc>=pInc); renderTrend('trendExpense',eD,exp<=pExp);
    const bE=document.getElementById('totalBalance'); bE.textContent=formatCurrency(bal); const cB=document.getElementById('cardBalance'); cB.classList.remove('positive','negative'); if(bal>0)cB.classList.add('positive');else if(bal<0)cB.classList.add('negative');
    const goal=parseCurrency(document.getElementById('savingsGoal').value)||500, pct=goal>0?(Math.max(0,bal)/goal)*100:0;
    document.getElementById('totalSavings').textContent=formatCurrency(Math.max(0,bal)); document.getElementById('savingsFill').style.width=Math.min(100,pct)+'%'; document.getElementById('savingsPercent').textContent=`${pct.toFixed(1)}% da meta de ${formatCurrency(goal)}`;
    renderCategoryGoals(expenses);
}
function renderTrend(id,pct,pos){const el=document.getElementById(id),v=Math.abs(pct).toFixed(1),s=pct===0?'':pct>0?'↑':'↓',c=pct>0?(pos?'trend-up':'trend-down'):(pos?'trend-down':'trend-up');el.className=`trend ${c}`;el.textContent=pct===0?'Sem dados anteriores':`${s} ${v}% vs mês ant.`;}
function renderCategoryGoals(expenses){
    const g=document.getElementById('goalsGrid'); if(!g) return;
    g.innerHTML='';const goals=JSON.parse(localStorage.getItem('categoryGoals')||'{}'),totals={};
    expenses.forEach(i=>totals[i.category||'outros']=(totals[i.category||'outros']||0)+normalizeValue(i));
    const cats = getCategories();
    Object.entries(cats).forEach(([id, {name}]) => {
        const t=totals[id]||0, gl=goals[id]||1000, p=gl>0?(t/gl)*100:0;
        const d=document.createElement('div');d.className='goal-item';
        d.innerHTML=`<div class="goal-label"><span>${name}</span><span>${formatCurrency(t)} / ${formatCurrency(gl)}</span></div><div class="goal-bar"><div class="goal-fill ${p>100?'over':''}" style="width:${Math.min(100,p)}%"></div></div>`;
        d.onclick=()=>{const n=prompt(`Meta para ${name} (R$):`,gl);if(n!==null){goals[id]=parseCurrency(n);localStorage.setItem('categoryGoals',JSON.stringify(goals));renderAll();}};
        g.appendChild(d);
    });
}

function renderItems(type) {
    const {income,expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear), listId=type==='income'?'incomeList':'expenseList', emptyId=type==='income'?'incomeEmpty':'expenseEmpty', listEl=document.getElementById(listId), emptyEl=document.getElementById(emptyId);
    let items=type==='income'?income:expenses;
    if(type==='expense'){
        if(APP_STATE.currentFilter!=='all')items=items.filter(i=>i.category===APP_STATE.currentFilter);
        const s=document.getElementById('searchExpenses')?.value.toLowerCase()||'';
        if(s)items=items.filter(i=>i.description.toLowerCase().includes(s)||(i.category||'').includes(s));
        items.sort((a,b) => { const da = a.dueDate || 99; const db = b.dueDate || 99; return da - db; });
    }
    listEl.innerHTML='';if(items.length===0){emptyEl.style.display='block';return;}emptyEl.style.display='none';
    const cats = getCategories();
    items.forEach(item=>{
        const card=document.createElement('div');card.className='item-card';const val=normalizeValue(item),cls=type==='income'?'income':'expense',sign=type==='income'?'+':'-';
        const lbl=getDurationLabel(item.activeMonths||[]), bCls=lbl.includes('Único')?'badge-single':lbl.includes('Longo')?'badge-recurring':'badge-limited';
        let cat=type==='expense'&&item.category?`<span class="item-category">${cats[item.category]?.name || item.category}</span>`:'';
        let due=item.dueDate?`<span class="item-due">Venc. dia ${item.dueDate}</span>`:'';
        card.innerHTML=`<div class="item-info"><div class="item-description">${item.description}<span class="badge ${bCls}">${lbl}</span></div><div class="item-meta">${cat}${due}</div></div><div class="item-value ${cls}">${sign} ${formatCurrency(val)}</div><div class="item-actions"><button class="btn btn-edit" onclick="editItem('${type}','${item.id}')">✏️</button><button class="btn btn-delete" onclick="deleteItem('${type}','${item.id}')">🗑️</button></div>`;
        listEl.appendChild(card);
    });
}

// GRÁFICO DE DESPESAS POR CATEGORIA (pizza)
function renderCategoryChart() {
    const { expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const totals = {};
    expenses.forEach(i => totals[i.category || 'outros'] = (totals[i.category || 'outros'] || 0) + normalizeValue(i));
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    const labels = Object.keys(totals).map(c => getCategoryName(c));
    const data = Object.values(totals);
    const backgroundColors = Object.keys(totals).map(c => getCategoryColor(c));
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: backgroundColors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') } } }
        }
    });
}

// GRÁFICO DE EVOLUÇÃO DO SALDO (linha)
function renderTrendChart() {
    const monthsToShow = APP_STATE.trendMonths;
    const labels = [];
    const balances = [];
    const hoje = new Date();
    let currentM = hoje.getMonth();
    let currentY = hoje.getFullYear();
    for (let i = monthsToShow - 1; i >= 0; i--) {
        let m = currentM - i;
        let y = currentY;
        if (m < 0) { m += 12; y--; }
        const { income, expenses } = getMonthData(m, y);
        const inc = income.reduce((s, i) => s + normalizeValue(i), 0);
        const exp = expenses.reduce((s, i) => s + normalizeValue(i), 0);
        const bal = inc - exp;
        labels.push(`${MONTHS_SHORT[m]}/${y.toString().slice(2)}`);
        balances.push(bal);
    }
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Saldo (R$)',
                data: balances,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary'),
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: balances.map(b => b >= 0 ? '#10b981' : '#ef4444'),
                pointBorderColor: '#fff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: ctx => `Saldo: ${formatCurrency(ctx.raw)}` } },
                legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') } }
            },
            scales: {
                y: { ticks: { callback: val => formatCurrency(val), color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') } },
                x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') } }
            }
        }
    });
}

function renderHistory(){const d=loadData(),tb=document.getElementById('historyBody'),em=document.getElementById('historyEmpty');tb.innerHTML='';const ks=new Set(Object.keys(d.monthOverrides));ks.add(getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear));for(let i=0;i<6;i++)ks.add(getMonthKey((APP_STATE.currentMonth+i)%12,APP_STATE.currentYear+Math.floor((APP_STATE.currentMonth+i)/12)));const so=Array.from(ks).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse();if(so.length===0){em.style.display='block';return;}em.style.display='none';so.forEach(k=>{const[y,m]=k.split('-');const{income,expenses}=getMonthData(parseInt(m)-1,parseInt(y));const inc=income.reduce((s,i)=>s+normalizeValue(i),0),exp=expenses.reduce((s,i)=>s+normalizeValue(i),0),bal=inc-exp,cl=bal>0?'amount-positive':bal<0?'amount-negative':'amount-neutral',tr=document.createElement('tr');tr.innerHTML=`<td>${MONTHS[parseInt(m)-1]}/${y}</td><td class="amount-income">${formatCurrency(inc)}</td><td class="amount-expense">${formatCurrency(exp)}</td><td class="${cl}">${formatCurrency(bal)}</td>`;tb.appendChild(tr);});}
function checkDueAlerts(){const{expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),t=new Date().getDate(),u=expenses.filter(i=>i.dueDate&&i.dueDate>=t&&i.dueDate<=t+3);if(u.length>0)showToast(`⚠️ ${u.length} vencimento(s) nos próximos 3 dias!`,'error');}
function exportPDF(){const{income,expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),inc=income.reduce((s,i)=>s+normalizeValue(i),0),exp=expenses.reduce((s,i)=>s+normalizeValue(i),0),bal=inc-exp;let t=`ORÇAMENTO FAMILIAR\n${MONTHS[APP_STATE.currentMonth]}/${APP_STATE.currentYear}\n${'═'.repeat(40)}\n\nRECEITAS: ${formatCurrency(inc)}\nDESPESAS: ${formatCurrency(exp)}\nSALDO: ${formatCurrency(bal)}\n\n`;const cats={};expenses.forEach(i=>cats[i.category||'outros']=(cats[i.category||'outros']||0)+normalizeValue(i));t+='DESPESAS POR CATEGORIA:\n';Object.entries(cats).forEach(([c,v])=>t+=`• ${getCategoryName(c)}: ${formatCurrency(v)}\n`);const w=window.open('','_blank');w.document.write(`<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${t}</pre>`);w.document.close();setTimeout(()=>w.print(),500);}
function applyViewOnly(){if(!APP_STATE.isViewOnly)return;document.querySelectorAll('.btn-add, .btn-edit, .btn-delete, #btnExport, #btnImport, #btnExportPDF, #btnExportExcel, #btnImportExcel, #btnExcelTemplate, #searchExpenses, #savingsGoal, .goal-item, #btnAddNote, #noteInput, #btnManageCategories, #btnGoogleBackup, #btnGoogleRestore').forEach(el=>el.style.display='none');document.querySelectorAll('input, select, button[type="submit"]').forEach(el=>el.disabled=true);}

// ─── AGENDA ───────────────────────────────
function renderNotes(){const{notes}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),list=document.getElementById('notesList'),em=document.getElementById('notesEmpty');list.innerHTML='';if(notes.length===0){em.style.display='block';return;}em.style.display='none';notes.forEach((n,i)=>{const c=document.createElement('div');c.className='note-card';c.innerHTML=`<div style="flex:1;"><div class="note-text">${n.text}</div><div class="note-time">${n.timestamp?new Date(n.timestamp).toLocaleDateString('pt-BR'):''}</div></div><button class="btn btn-note-del" onclick="deleteNote(${i})" title="Excluir">✖</button>`;list.appendChild(c);});}
function addNote(t){if(!t.trim())return;const d=loadData(),k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};d.monthOverrides[k].notes.push({text:t.trim(),timestamp:Date.now()});saveData(d);document.getElementById('noteInput').value='';showToast('Anotação adicionada! 📝');renderNotes();}
function deleteNote(i){const d=loadData(),k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(d.monthOverrides[k]){d.monthOverrides[k].notes.splice(i,1);saveData(d);renderNotes();}}

// ─── SMART CATEGORIES ─────────────────────
function setupSmartSuggestions(){const i=document.getElementById('itemDescription'),b=document.getElementById('smartSuggestion');i.addEventListener('input',e=>{const v=e.target.value.toLowerCase(),m=Object.keys(SMART_DICT).filter(k=>k.includes(v)&&v.length>1);if(m.length>0){b.innerHTML=m.map(x=>`<div class="suggestion-item" data-val="${x}">${x}</div>`).join('');b.classList.add('show');}else b.classList.remove('show');});i.addEventListener('blur',()=>setTimeout(()=>b.classList.remove('show'),150));b.addEventListener('click',e=>{const it=e.target.closest('.suggestion-item');if(!it)return;i.value=it.dataset.val;const c=SMART_DICT[it.dataset.val];if(c)document.getElementById('itemCategory').value=c;b.classList.remove('show');});}

// ─── MODAL & SELETOR VISUAL (meses a partir do próximo) ───────────────
function renderMonthGrid(selected = []) {
    const grid = document.getElementById('monthsCheckGrid'); 
    grid.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        let m = (APP_STATE.currentMonth + i) % 12;
        let y = APP_STATE.currentYear + Math.floor((APP_STATE.currentMonth + i) / 12);
        const key = getMonthKey(m, y);
        const checked = selected.includes(key);
        const label = document.createElement('label');
        label.className = 'month-check-item';
        label.innerHTML = `<input type="checkbox" value="${key}" ${checked ? 'checked' : ''}>
                           <span>${MONTHS[m].substring(0,3)}/${y.toString().slice(2)}</span>`;
        grid.appendChild(label);
    }
}

function openModal(type, id=null) {
    const ov=document.getElementById('modalOverlay'), title=document.getElementById('modalTitle'), catGrp=document.getElementById('categoryGroup'), occGrp=document.getElementById('occurrenceGroup');
    document.getElementById('itemType').value=type; document.getElementById('itemId').value=id||'';
    if(type==='expense'){catGrp.style.display='block';occGrp.style.display='block';title.textContent=id?'Editar Despesa':'Adicionar Despesa';}
    else{catGrp.style.display='none';occGrp.style.display='none';title.textContent=id?'Editar Receita':'Adicionar Receita';}
    document.getElementById('smartSuggestion').classList.remove('show');
    renderCategorySelect(); // preenche o select com categorias atuais
    
    if(id){
        const d=loadData(); let item=d.recurringItems.find(i=>i.id===id);
        if(!item){const k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);const ovrs=d.monthOverrides[k]||{added:[]};item=ovrs.added.find(i=>i.id===id);if(!item&&ovrs.modified[id]){const base=d.recurringItems.find(i=>i.id===id);item=base?{...base,...ovrs.modified[id]}:null;}}
        if(item){
            document.getElementById('itemDescription').value=item.description;
            document.getElementById('itemAmount').value=item.amount.toString().replace('.',',');
            document.getElementById('itemDueDate').value=item.dueDate||'';
            if(type==='expense')document.getElementById('itemCategory').value=item.category||'outros';
            if(type==='expense'){
                const isRec = (item.activeMonths||[]).length > 1;
                document.querySelector(`input[name="occurrenceType"][value="${isRec?'recurring':'single'}"]`).checked = true;
                document.getElementById('monthSelectionGrid').style.display = isRec ? 'block' : 'none';
                if(isRec) renderMonthGrid(item.activeMonths);
            }
        }
    }else{
        document.getElementById('itemForm').reset();
        if(type==='expense'){
            document.querySelector('input[name="occurrenceType"][value="single"]').checked = true;
            document.getElementById('monthSelectionGrid').style.display = 'none';
        }
    }
    document.querySelectorAll('input[name="occurrenceType"]').forEach(r => r.onchange = e => {
        document.getElementById('monthSelectionGrid').style.display = e.target.value === 'recurring' ? 'block' : 'none';
        if(e.target.value==='recurring') renderMonthGrid(id ? (loadData().recurringItems.find(i=>i.id===id)?.activeMonths||[]) : []);
    });
    ov.classList.add('active'); setTimeout(()=>document.getElementById('itemDescription').focus(),100);
}
function closeModal(){document.getElementById('modalOverlay').classList.remove('active');}
function closeCategoryModal(){document.getElementById('categoryModalOverlay').classList.remove('active');}

function saveItem(e){
    e.preventDefault(); const type=document.getElementById('itemType').value, desc=document.getElementById('itemDescription').value.trim(), amt=parseCurrency(document.getElementById('itemAmount').value), due=parseInt(document.getElementById('itemDueDate').value)||null, cat=type==='expense'?document.getElementById('itemCategory').value:null, editId=document.getElementById('itemId').value;
    if(!desc)return showToast('Informe a descrição!','error'); if(!amt||amt<=0)return showToast('Valor inválido!','error');
    const d=loadData();
    let activeMonths = [];
    if(type==='expense' && document.querySelector('input[name="occurrenceType"]:checked').value === 'recurring'){
        document.querySelectorAll('#monthsCheckGrid input:checked').forEach(cb => activeMonths.push(cb.value));
        if (activeMonths.length === 0) {
            showToast('Selecione pelo menos um mês para a despesa recorrente!', 'error');
            return;
        }
    }
    if(activeMonths.length === 0 && type==='expense') activeMonths = [getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear)];
    
    const newItem={id:editId||generateId(),description:desc,amount:amt,dueDate:due,category:cat,type,activeMonths};
    if(editId){
        const existingIdx = d.recurringItems.findIndex(i => i.id === editId);
        const isRecurringBase = (existingIdx !== -1);
        if(type==='expense' && document.querySelector('input[name="occurrenceType"]:checked').value === 'recurring') {
            newItem.activeMonths = activeMonths;
            if(isRecurringBase) {
                d.recurringItems[existingIdx] = newItem;
            } else {
                d.recurringItems.push(newItem);
                const key = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
                if(d.monthOverrides[key]?.added) d.monthOverrides[key].added = d.monthOverrides[key].added.filter(i => i.id !== editId);
                if(d.monthOverrides[key]?.modified) delete d.monthOverrides[key].modified[editId];
            }
        } else {
            if(isRecurringBase) {
                d.recurringItems.splice(existingIdx, 1);
                const key = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
                if(!d.monthOverrides[key]) d.monthOverrides[key] = { added: [], removed: [], modified: {}, notes: [] };
                d.monthOverrides[key].added.push(newItem);
            } else {
                const key = getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
                if(d.monthOverrides[key]) {
                    const idx = d.monthOverrides[key].added.findIndex(i => i.id === editId);
                    if(idx !== -1) d.monthOverrides[key].added[idx] = newItem;
                    else d.monthOverrides[key].modified[editId] = newItem;
                }
            }
        }
        showToast('Item atualizado! 🔄');
    } else {
        if(type==='expense' && activeMonths.length > 1){
            d.recurringItems.push(newItem);
            showToast('Despesa recorrente criada! 🔄');
        } else {
            const k=getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear);
            if(!d.monthOverrides[k]) d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};
            d.monthOverrides[k].added.push(newItem);
            showToast('Item único adicionado! 📌');
        }
    }
    saveData(d); closeModal(); renderAll();
}

function deleteItem(type, id){if(!confirm('Excluir este item?'))return;const d=loadData(),isRec=d.recurringItems.some(i=>i.id===id),s=prompt('Excluir APENAS deste mês (1) ou TODOS (2)?');if(s!=='2'&&s!=='1')return;if(isRec&&s==='2'){d.recurringItems=d.recurringItems.filter(i=>i.id!==id);Object.keys(d.monthOverrides).forEach(k=>{const ov=d.monthOverrides[k];ov.removed=ov.removed.filter(r=>r!==id);delete ov.modified[id];});showToast('Excluído permanentemente! 🗑️');}else{const k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};if(isRec)d.monthOverrides[k].removed.push(id);else d.monthOverrides[k].added=d.monthOverrides[k].added.filter(i=>i.id!==id);showToast('Removido deste mês! 📅');}saveData(d);renderAll();}
function editItem(type, id){openModal(type, id);}

// ─── GERENCIAMENTO DE CATEGORIAS ──────────
function openCategoryModal() {
    const modal = document.getElementById('categoryModalOverlay');
    renderCategoriesList();
    modal.classList.add('active');
}
function renderCategoriesList() {
    const container = document.getElementById('categoriesList');
    const cats = getCategories();
    container.innerHTML = '';
    Object.entries(cats).forEach(([id, { name, color }]) => {
        const isDefault = DEFAULT_CATEGORIES.hasOwnProperty(id);
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <div class="category-info">
                <div class="category-color" style="background-color: ${color}"></div>
                <span>${name}</span>
            </div>
            <div class="category-actions">
                ${!isDefault ? `<button class="edit-category" data-id="${id}" title="Editar">✏️</button>
                                <button class="delete-category" data-id="${id}" title="Excluir">🗑️</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
    // Adicionar eventos
    document.querySelectorAll('.edit-category').forEach(btn => {
        btn.onclick = () => editCategory(btn.dataset.id);
    });
    document.querySelectorAll('.delete-category').forEach(btn => {
        btn.onclick = () => deleteCategory(btn.dataset.id);
    });
}
function editCategory(id) {
    const cats = getCategories();
    const { name, color } = cats[id];
    const newName = prompt('Novo nome da categoria:', name);
    if (newName && newName.trim()) {
        const newColor = prompt('Cor (hex):', color);
        if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) {
            const data = loadData();
            data.customCategories[id] = { name: newName.trim(), color: newColor };
            saveData(data);
            renderAll();
            if (document.getElementById('categoryModalOverlay').classList.contains('active')) renderCategoriesList();
            showToast('Categoria atualizada!');
        } else showToast('Cor inválida!', 'error');
    }
}
function deleteCategory(id) {
    if (confirm(`Excluir a categoria "${getCategoryName(id)}"? Itens com esta categoria serão movidos para "Outros".`)) {
        const data = loadData();
        // Substituir a categoria nos itens existentes
        data.recurringItems.forEach(item => {
            if (item.category === id) item.category = 'outros';
        });
        Object.keys(data.monthOverrides).forEach(k => {
            const ov = data.monthOverrides[k];
            ov.added.forEach(item => { if (item.category === id) item.category = 'outros'; });
            Object.values(ov.modified).forEach(item => { if (item.category === id) item.category = 'outros'; });
        });
        delete data.customCategories[id];
        saveData(data);
        renderAll();
        if (document.getElementById('categoryModalOverlay').classList.contains('active')) closeCategoryModal();
        showToast('Categoria removida!');
    }
}
function addCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const colorInput = document.getElementById('newCategoryColor');
    const name = nameInput.value.trim();
    const color = colorInput.value;
    if (!name) return showToast('Informe o nome da categoria!', 'error');
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (getCategories()[id]) {
        showToast('Categoria já existe!', 'error');
        return;
    }
    const data = loadData();
    data.customCategories[id] = { name, color };
    saveData(data);
    nameInput.value = '';
    renderAll();
    if (document.getElementById('categoryModalOverlay').classList.contains('active')) renderCategoriesList();
    showToast('Categoria adicionada!');
}

// ─── BACKUP GOOGLE DRIVE (simplificado) ───
// Você precisa configurar seu Client ID no Google Cloud Console
const CLIENT_ID = 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com'; // substitua
const API_KEY = 'SUA_API_KEY_AQUI'; // opcional, mas recomendado
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient;
let gapiInited = false;
let gisInited = false;

function initGapi() {
    return new Promise((resolve) => {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            gapiInited = true;
            resolve();
        });
    });
}
function initGis() {
    return new Promise((resolve) => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // será definido depois
        });
        gisInited = true;
        resolve();
    });
}
async function authenticate() {
    if (!gapiInited || !gisInited) {
        await initGapi();
        await initGis();
    }
    return new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => {
            if (resp.error !== undefined) reject(resp);
            else resolve(resp);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}
async function backupToDrive() {
    try {
        const auth = await authenticate();
        const data = loadData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const metadata = {
            name: `orcamento_backup_${new Date().toISOString().slice(0,19)}.json`,
            mimeType: 'application/json'
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.access_token}` },
            body: form
        });
        if (response.ok) showToast('Backup enviado para o Google Drive! ☁️');
        else showToast('Erro no backup: ' + (await response.text()), 'error');
    } catch (err) {
        console.error(err);
        showToast('Erro ao autenticar ou enviar.', 'error');
    }
}
async function restoreFromDrive() {
    try {
        const auth = await authenticate();
        // Listar arquivos de backup
        const listResp = await fetch('https://www.googleapis.com/drive/v3/files?q=name contains "orcamento_backup"&orderBy=createdTime desc&pageSize=1', {
            headers: { 'Authorization': `Bearer ${auth.access_token}` }
        });
        const list = await listResp.json();
        if (!list.files || list.files.length === 0) {
            showToast('Nenhum backup encontrado no Drive.', 'error');
            return;
        }
        const fileId = list.files[0].id;
        const downloadResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${auth.access_token}` }
        });
        const json = await downloadResp.json();
        saveData(json);
        renderAll();
        showToast('Restaurado do Google Drive com sucesso!');
    } catch (err) {
        console.error(err);
        showToast('Erro ao restaurar do Drive.', 'error');
    }
}

// ─── EXCEL (corrigido) ────────────────────
function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const data = [{
        Tipo: 'Despesa',
        Descrição: 'Aluguel',
        Categoria: 'moradia',
        Valor: 1200,
        Meses_Ativos: '2025-01,2025-02,2025-03',
        Dia_Vencimento: 10
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:15},{wch:30},{wch:15},{wch:10},{wch:30},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "Modelo_Importacao_Orcamento.xlsx");
    showToast('Modelo baixado! Preencha e importe. 📥');
}
function exportExcel() {
    const d=loadData(), rows=[];
    d.recurringItems.forEach(i=>rows.push({'Tipo':i.type==='income'?'Receita':'Despesa','Descrição':i.description,'Categoria':i.category||'-','Valor':i.amount,'Meses_Ativos':(i.activeMonths||[]).join(','),'Dia_Vencimento':i.dueDate||'-'}));
    const ws=XLSX.utils.json_to_sheet(rows), wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Orçamento"); XLSX.writeFile(wb,`Orcamento_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Planilha exportada! 📊');
}
function importExcel(file){
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
                const item = {
                    id: generateId(),
                    description: row.Descrição || 'Importado',
                    amount: parseFloat(row.Valor) || 0,
                    category: row.Categoria || 'outros',
                    dueDate: (row.Dia_Vencimento && !isNaN(row.Dia_Vencimento)) ? parseInt(row.Dia_Vencimento) : null,
                    type: type,
                    activeMonths: activeMonths
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

// ─── INIT ─────────────────────────────────
function renderAll(){
    updateMonthDisplay();
    updateSummary();
    renderItems('income');
    renderItems('expense');
    renderCategoryChart();
    renderTrendChart();
    renderHistory();
    renderCalendar();
    renderNotes();
    checkDueAlerts();
    renderFilterBar(); // atualiza filtros com novas categorias
}
function initApp(){
    if(APP_STATE.isViewOnly) applyViewOnly();
    renderAll();
    initTheme();
    setupSmartSuggestions();
    initPWA();
    initCalculator();
    // Carregar APIs do Google (se configuradas)
    if (typeof google !== 'undefined' && CLIENT_ID !== 'SEU_CLIENT_ID_AQUI') {
        initGapi().catch(console.warn);
        initGis().catch(console.warn);
    } else if (CLIENT_ID === 'SEU_CLIENT_ID_AQUI') {
        console.warn('Google Drive: configure CLIENT_ID e API_KEY em script.js');
    }
    
    document.getElementById('btnThemeToggle').onclick=toggleTheme;
    document.getElementById('btnPrevMonth').onclick=()=>{APP_STATE.currentMonth--;if(APP_STATE.currentMonth<0){APP_STATE.currentMonth=11;APP_STATE.currentYear--;}renderAll();};
    document.getElementById('btnNextMonth').onclick=()=>{APP_STATE.currentMonth++;if(APP_STATE.currentMonth>11){APP_STATE.currentMonth=0;APP_STATE.currentYear++;}renderAll();};
    document.querySelectorAll('.btn-add').forEach(b=>b.onclick=()=>{document.getElementById('itemId').value='';openModal(b.dataset.type);});
    document.getElementById('btnCloseModal').onclick=closeModal;
    document.getElementById('btnCancelModal').onclick=closeModal;
    document.getElementById('modalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeModal();};
    document.getElementById('itemForm').onsubmit=saveItem;
    document.getElementById('itemAmount').oninput=e=>{let v=e.target.value.replace(/[^\d]/g,'');if(v)e.target.value=(parseInt(v)/100).toFixed(2).replace('.',',');};
    document.getElementById('searchExpenses').oninput=()=>renderItems('expense');
    document.getElementById('savingsGoal').oninput=()=>updateSummary();
    document.getElementById('savingsGoal').value=localStorage.getItem('savingsGoal')||'500,00';
    document.getElementById('savingsGoal').onblur=e=>{localStorage.setItem('savingsGoal',e.target.value);updateSummary();};
    document.getElementById('btnExport').onclick=()=>{const d=loadData();const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`orcamento-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);showToast('Backup JSON exportado!');};
    document.getElementById('btnExportPDF').onclick=exportPDF;
    document.getElementById('btnExportExcel').onclick=exportExcel;
    document.getElementById('btnExcelTemplate').onclick=downloadExcelTemplate;
    document.getElementById('btnImport').onclick=()=>document.getElementById('fileImport').click();
    document.getElementById('fileImport').onchange=e=>{if(e.target.files[0]){const r=new FileReader();r.onload=ev=>{try{const d=loadData(),imp=JSON.parse(ev.target.result);saveData({recurringItems:imp.recurringItems||d.recurringItems,monthOverrides:{...d.monthOverrides,...imp.monthOverrides},customCategories:{...d.customCategories,...imp.customCategories}});renderAll();showToast('Restaurado!');}catch{showToast('Erro!','error');}};r.readAsText(e.target.files[0]);}e.target.value='';};
    document.getElementById('btnImportExcel').onclick=()=>document.getElementById('fileImportExcel').click();
    document.getElementById('fileImportExcel').onchange=e=>{if(e.target.files[0])importExcel(e.target.files[0]);e.target.value='';};
    document.getElementById('btnLogout').onclick=logout;
    document.getElementById('btnAddNote').onclick=()=>addNote(document.getElementById('noteInput').value);
    document.getElementById('noteInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addNote(document.getElementById('noteInput').value);}};
    // Gerenciar categorias
    document.getElementById('btnManageCategories').onclick=openCategoryModal;
    document.getElementById('btnCloseCategoryModal').onclick=closeCategoryModal;
    document.getElementById('btnCloseCategoryModalFooter').onclick=closeCategoryModal;
    document.getElementById('btnAddCategory').onclick=addCategory;
    document.getElementById('categoryModalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeCategoryModal();};
    // Backup Google Drive
    document.getElementById('btnGoogleBackup').onclick=backupToDrive;
    document.getElementById('btnGoogleRestore').onclick=restoreFromDrive;
    // Seletor de meses do gráfico de tendência
    document.getElementById('btnTrend6').onclick=()=>{APP_STATE.trendMonths=6; renderTrendChart(); document.getElementById('btnTrend6').classList.add('active'); document.getElementById('btnTrend12').classList.remove('active');};
    document.getElementById('btnTrend12').onclick=()=>{APP_STATE.trendMonths=12; renderTrendChart(); document.getElementById('btnTrend12').classList.add('active'); document.getElementById('btnTrend6').classList.remove('active');};
    document.onkeydown=e=>{if(e.key==='Escape')closeModal();};
    window.onresize=()=>{if(categoryChart) categoryChart.resize(); if(trendChart) trendChart.resize();};
    document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowLeft')document.getElementById('btnPrevMonth').click();if(e.key==='ArrowRight')document.getElementById('btnNextMonth').click();if(e.key.toLowerCase()==='n')document.querySelector('.btn-add')?.click();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();document.getElementById('searchExpenses')?.focus();}});
}
if(checkAuth()){initApp();}else{document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();if(await login(document.getElementById('password').value)){document.getElementById('loginError').textContent='';initApp();}else{document.getElementById('loginError').textContent='Senha incorreta.';document.getElementById('password').value='';document.getElementById('password').focus();}};document.getElementById('password').focus();}
