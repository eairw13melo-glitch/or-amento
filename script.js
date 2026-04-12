/* ============================================
   ORÇAMENTO FAMILIAR - V2.0 (FASE 1 + PWA)
   ============================================ */
const APP_CONFIG = { password: 'familia2026', sessionKey: 'budgetAppSession', sessionDuration: 7 * 24 * 60 * 60 * 1000 };
const APP_STATE = { currentMonth: new Date().getMonth(), currentYear: new Date().getFullYear(), currentFilter: 'all', isViewOnly: new URLSearchParams(window.location.search).get('viewonly') === '1' };
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATEGORY_LABELS = { moradia:'🏠 Moradia', alimentacao:'🍔 Alimentação', transporte:'🚗 Transporte', saude:'💊 Saúde', educacao:'📚 Educação', lazer:'🎮 Lazer', vestuario:'👕 Vestuário', outros:'📦 Outros' };
const CATEGORY_COLORS = { moradia:'#e17055', alimentacao:'#fdcb6e', transporte:'#74b9ff', saude:'#55efc4', educacao:'#a29bfe', lazer:'#fd79a8', vestuario:'#00cec9', outros:'#636e72' };
const SMART_DICT = { 'aluguel':'moradia','luz':'moradia','energia':'moradia','agua':'moradia','condominio':'moradia','internet':'moradia','mercado':'alimentacao','restaurante':'alimentacao','ifood':'alimentacao','uber':'transporte','99':'transporte','gasolina':'transporte','farmacia':'saude','medico':'saude','plano de saude':'saude','escola':'educacao','curso':'educacao','material':'educacao','netflix':'lazer','spotify':'lazer','cinema':'lazer','roupa':'vestuario','sapato':'vestuario','academia':'saude' };

// ─── STORAGE & MIGRAÇÃO ───────────────────
function loadData() {
    try { const raw = localStorage.getItem('budgetAppData'); if (!raw) return { recurringItems: [], monthOverrides: {} }; let data = JSON.parse(raw);
    if (data.recurringItems === undefined && Object.keys(data).some(k => /\d{4}-\d{2}/.test(k))) { const newData = { recurringItems: [], monthOverrides: {} }; Object.keys(data).forEach(k => { data[k].income.forEach(i => newData.recurringItems.push({ ...i, isRecurring: true, type: 'income' })); data[k].expenses.forEach(i => newData.recurringItems.push({ ...i, isRecurring: true, type: 'expense' })); }); data = newData; saveData(data); showToast('Dados migrados! 🔄'); }
    return data.recurringItems ? data : { recurringItems: [], monthOverrides: {} };
    } catch { return { recurringItems: [], monthOverrides: {} }; }
}
function saveData(data) { try { localStorage.setItem('budgetAppData', JSON.stringify(data)); } catch { showToast('Erro ao salvar!', 'error'); } }
function getMonthKey(m, y) { return `${y}-${String(m+1).padStart(2,'0')}`; }
function getMonthData(m, y) {
    const data = loadData(); const key = getMonthKey(m, y); const overrides = data.monthOverrides[key] || { added: [], removed: [], modified: {} };
    let items = [...data.recurringItems];
    items = items.map(item => overrides.modified[item.id] ? { ...item, ...overrides.modified[item.id] } : item);
    items = items.filter(item => !overrides.removed.includes(item.id));
    items = items.concat(overrides.added);
    return { income: items.filter(i => i.type === 'income'), expenses: items.filter(i => i.type === 'expense'), key };
}

// ─── UTILITÁRIOS ──────────────────────────
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function parseCurrency(str) { if (typeof str === 'number') return str; return parseFloat(str.replace(/[^\d,]/g, '').replace(',','.')) || 0; }
function normalizeValue(item) { let v = item.amount || 0; const f = item.frequency || 'mensal'; if (f === 'semanal') v *= 4.33; else if (f === 'quinzenal') v *= 2; else if (f === 'anual') v /= 12; return v; }
function showToast(msg, type='success') { const c = document.getElementById('toastContainer'); const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3000); }

// ─── AUTH ─────────────────────────────────
function checkAuth() { const s = sessionStorage.getItem(APP_CONFIG.sessionKey); if (s) { const { token, ts } = JSON.parse(s); if (token === btoa(APP_CONFIG.password) && Date.now() - ts < APP_CONFIG.sessionDuration) { document.getElementById('loginScreen').classList.add('hidden'); return true; } } return false; }
function login(pwd) { if (pwd === APP_CONFIG.password) { sessionStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ token: btoa(pwd), ts: Date.now() })); document.getElementById('loginScreen').classList.add('hidden'); showToast('Bem-vindo! 👋'); return true; } return false; }

// 🔐 LOGOUT: Limpa cache + sessão, MANTÉM dados financeiros
async function logout() {
    showToast('Encerrando sessão e limpando cache... 🔒', 'success');
    sessionStorage.removeItem(APP_CONFIG.sessionKey);

    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.filter(name => name.includes('budget'))
                          .map(name => caches.delete(name))
            );
        } catch (err) { console.warn('Aviso ao limpar cache:', err); }
    }
    
    setTimeout(() => location.reload(), 800);
}

// ─── THEME & PWA ──────────────────────────
function initTheme() { const saved = localStorage.getItem('appTheme'); const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches; const theme = saved || (prefersLight ? 'light' : 'dark'); document.documentElement.setAttribute('data-theme', theme); updateThemeIcon(theme); updateMetaTheme(theme); }
function toggleTheme() { const current = document.documentElement.getAttribute('data-theme'); const next = current === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('appTheme', next); updateThemeIcon(next); updateMetaTheme(next); }
function updateThemeIcon(theme) { document.getElementById('btnThemeToggle').textContent = theme === 'dark' ? '☀️' : '🌙'; }
function updateMetaTheme(theme) { document.getElementById('themeColorMeta').content = theme === 'dark' ? '#0f1117' : '#f5f7fa'; }
function initPWA() { if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); }); } }

// ─── UI RENDER ────────────────────────────
function updateMonthDisplay() { document.getElementById('currentMonth').textContent = MONTHS[APP_STATE.currentMonth]; document.getElementById('currentYear').textContent = APP_STATE.currentYear; }
function updateSummary() {
    const { income, expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const inc = income.reduce((s,i)=>s+normalizeValue(i),0); const exp = expenses.reduce((s,i)=>s+normalizeValue(i),0); const bal = inc-exp;
    const prevM = APP_STATE.currentMonth===0?11:APP_STATE.currentMonth-1; const prevY = APP_STATE.currentMonth===0?APP_STATE.currentYear-1:APP_STATE.currentYear;
    const prev = getMonthData(prevM, prevY); const pInc = prev.income.reduce((s,i)=>s+normalizeValue(i),0); const pExp = prev.expenses.reduce((s,i)=>s+normalizeValue(i),0);
    
    const incDiff = pInc>0?((inc-pInc)/pInc)*100:0; const expDiff = pExp>0?((exp-pExp)/pExp)*100:0;
    document.getElementById('totalIncome').textContent = formatCurrency(inc); document.getElementById('totalExpense').textContent = formatCurrency(exp);
    renderTrend('trendIncome', incDiff, inc>=pInc); renderTrend('trendExpense', expDiff, exp<=pExp);
    
    const balEl = document.getElementById('totalBalance'); balEl.textContent = formatCurrency(bal);
    const cardBal = document.getElementById('cardBalance'); cardBal.classList.remove('positive','negative'); if(bal>0) cardBal.classList.add('positive'); else if(bal<0) cardBal.classList.add('negative');
    
    const goal = parseCurrency(document.getElementById('savingsGoal').value)||500; const pct = goal>0?(Math.max(0,bal)/goal)*100:0;
    document.getElementById('totalSavings').textContent = formatCurrency(Math.max(0,bal));
    document.getElementById('savingsFill').style.width = Math.min(100,pct)+'%';
    document.getElementById('savingsPercent').textContent = `${pct.toFixed(1)}% da meta de ${formatCurrency(goal)}`;
    renderCategoryGoals(expenses);
}
function renderTrend(id, pct, positive) {
    const el = document.getElementById(id); const val = Math.abs(pct).toFixed(1); const sign = pct===0?'':pct>0?'↑':'↓'; const cls = pct>0?(positive?'trend-up':'trend-down'):(positive?'trend-down':'trend-up'); el.className=`trend ${cls}`; el.textContent = pct===0?'Sem dados anteriores':`${sign} ${val}% vs mês ant.`;
}

function renderCategoryGoals(expenses) {
    const grid = document.getElementById('goalsGrid'); grid.innerHTML = '';
    const goals = JSON.parse(localStorage.getItem('categoryGoals')||'{}');
    const totals = {}; expenses.forEach(i=>totals[i.category||'outros']=(totals[i.category||'outros']||0)+normalizeValue(i));
    Object.keys(CATEGORY_LABELS).forEach(cat=>{
        const total = totals[cat]||0; const g = goals[cat]||1000; const pct = g>0?(total/g)*100:0;
        const div = document.createElement('div'); div.className='goal-item';
        div.innerHTML=`<div class="goal-label"><span>${CATEGORY_LABELS[cat]}</span><span>${formatCurrency(total)} / ${formatCurrency(g)}</span></div><div class="goal-bar"><div class="goal-fill ${pct>100?'over':''}" style="width:${Math.min(100,pct)}%"></div></div>`;
        div.onclick = ()=>{ const nv = prompt(`Meta para ${CATEGORY_LABELS[cat]} (R$):`, g); if(nv!==null){ goals[cat]=parseCurrency(nv); localStorage.setItem('categoryGoals', JSON.stringify(goals)); renderAll(); } };
        grid.appendChild(div);
    });
}

function renderItems(type) {
    const { income, expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const listId = type==='income'?'incomeList':'expenseList'; const emptyId = type==='income'?'incomeEmpty':'expenseEmpty';
    const listEl = document.getElementById(listId); const emptyEl = document.getElementById(emptyId);
    let items = type==='income'?income:expenses;
    if(type==='expense'){ if(APP_STATE.currentFilter!=='all') items=items.filter(i=>i.category===APP_STATE.currentFilter); const search=document.getElementById('searchExpenses')?.value.toLowerCase()||''; if(search) items=items.filter(i=>i.description.toLowerCase().includes(search)||(i.category||'').includes(search)); }
    listEl.innerHTML=''; if(items.length===0){emptyEl.style.display='block';return;} emptyEl.style.display='none';
    items.forEach(item=>{
        const card=document.createElement('div'); card.className='item-card'; const val=normalizeValue(item); const cls=type==='income'?'income':'expense'; const sign=type==='income'?'+':'-';
        const badgeCls=item.isRecurring?'badge-recurring':'badge-unique'; const badgeTxt=item.isRecurring?'🔄 Recorrente':'📌 Avulso';
        let catHTML=type==='expense'&&item.category?`<span class="item-category">${CATEGORY_LABELS[item.category]||item.category}</span>`:'';
        let freqHTML=item.frequency&&item.frequency!=='mensal'?`<span class="item-frequency">${item.frequency}</span>`:'';
        let dueHTML=item.dueDate?`<span class="item-due">Venc. dia ${item.dueDate}</span>`:'';
        card.innerHTML=`<div class="item-info"><div class="item-description">${item.description}<span class="badge ${badgeCls}">${badgeTxt}</span></div><div class="item-meta">${catHTML}${freqHTML}${dueHTML}</div></div><div class="item-value ${cls}">${sign} ${formatCurrency(val)}</div><div class="item-actions"><button class="btn btn-edit" onclick="editItem('${type}','${item.id}')">✏️</button><button class="btn btn-delete" onclick="deleteItem('${type}','${item.id}')">🗑️</button></div>`;
        listEl.appendChild(card);
    });
}

function renderChart() {
    const { expenses } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear); const totals={}; expenses.forEach(i=>totals[i.category||'outros']=(totals[i.category||'outros']||0)+normalizeValue(i));
    const canvas=document.getElementById('categoryChart'); const container=document.getElementById('chartContainer'); const entries=Object.entries(totals);
    container.innerHTML=''; if(entries.length===0){container.innerHTML='<div class="empty-state"><p>Sem dados</p></div>';return;}
    const cv=document.createElement('canvas'); cv.id='categoryChart'; container.appendChild(cv); const c=cv.getContext('2d'); const size=Math.min(container.clientWidth,350); cv.width=size*2; cv.height=size*2; cv.style.width=size+'px'; cv.style.height=size+'px'; c.scale(2,2);
    const total=entries.reduce((s,[,v])=>s+v,0); const cx=size/2, cy=size/2, r=size/3, ir=r*0.6; let start=-Math.PI/2;
    entries.forEach(([cat,val])=>{const a=(val/total)*2*Math.PI; c.beginPath();c.arc(cx,cy,r,start,start+a);c.arc(cx,cy,ir,start+a,start,true);c.closePath();c.fillStyle=CATEGORY_COLORS[cat]||'#636e72';c.fill();start+=a;});
    c.beginPath();c.arc(cx,cy,ir-2,0,Math.PI*2);c.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim();c.fill();
    c.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();c.font=`bold ${size*0.06}px Inter`;c.textAlign='center';c.textBaseline='middle';c.fillText(formatCurrency(total),cx,cy-8);
    c.font=`${size*0.035}px Inter`;c.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();c.fillText('Total Despesas',cx,cy+12);
    const ly=size*0.88; let lx=size*0.05; entries.forEach(([cat,val])=>{const l=CATEGORY_LABELS[cat]||cat;c.fillStyle=CATEGORY_COLORS[cat]||'#636e72';c.fillRect(lx,ly,10,10);c.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();c.font=`${size*0.032}px Inter`;c.textAlign='left';c.textBaseline='middle';c.fillText(l,lx+14,ly+5);lx+=c.measureText(l).width+30;});
}

function renderHistory() {
    const data=loadData(); const tbody=document.getElementById('historyBody'); const emptyEl=document.getElementById('historyEmpty'); tbody.innerHTML='';
    const keys=new Set(Object.keys(data.monthOverrides)); keys.add(getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear)); const sorted=Array.from(keys).sort().reverse();
    if(sorted.length===0||sorted.every(k=>!/^\d{4}-\d{2}$/.test(k))){emptyEl.style.display='block';return;} emptyEl.style.display='none';
    sorted.forEach(k=>{if(!/^\d{4}-\d{2}$/.test(k))return;const[y,m]=k.split('-');const{income,expenses}=getMonthData(parseInt(m)-1,parseInt(y));const inc=income.reduce((s,i)=>s+normalizeValue(i),0);const exp=expenses.reduce((s,i)=>s+normalizeValue(i),0);const bal=inc-exp;const cls=bal>0?'amount-positive':bal<0?'amount-negative':'amount-neutral';const tr=document.createElement('tr');tr.innerHTML=`<td>${MONTHS[parseInt(m)-1]}/${y}</td><td class="amount-income">${formatCurrency(inc)}</td><td class="amount-expense">${formatCurrency(exp)}</td><td class="${cls}">${formatCurrency(bal)}</td>`;tbody.appendChild(tr);});
}

function checkDueAlerts() { const {expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear);const t=new Date().getDate();const u=expenses.filter(i=>i.dueDate&&i.dueDate>=t&&i.dueDate<=t+3);if(u.length>0)showToast(`⚠️ ${u.length} vencimento(s) nos próximos 3 dias!`,'error'); }
function exportPDF() { const {income,expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear);const inc=income.reduce((s,i)=>s+normalizeValue(i),0);const exp=expenses.reduce((s,i)=>s+normalizeValue(i),0);const bal=inc-exp;let t=`ORÇAMENTO FAMILIAR\n${MONTHS[APP_STATE.currentMonth]}/${APP_STATE.currentYear}\n${'═'.repeat(40)}\n\nRECEITAS: ${formatCurrency(inc)}\nDESPESAS: ${formatCurrency(exp)}\nSALDO: ${formatCurrency(bal)}\n\nDESPESAS POR CATEGORIA:\n`;const cats={};expenses.forEach(i=>cats[i.category||'outros']=(cats[i.category||'outros']||0)+normalizeValue(i));Object.entries(cats).forEach(([c,v])=>t+=`• ${CATEGORY_LABELS[c]||c}: ${formatCurrency(v)}\n`);const w=window.open('','_blank');w.document.write(`<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${t}</pre>`);w.document.close();setTimeout(()=>w.print(),500); }
function applyViewOnly() { if(!APP_STATE.isViewOnly)return;document.querySelectorAll('.btn-add, .btn-edit, .btn-delete, #btnExport, #btnImport, #btnExportPDF, #searchExpenses, #savingsGoal, .goal-item').forEach(el=>el.style.display='none');document.querySelectorAll('input, select, button[type="submit"]').forEach(el=>el.disabled=true); }

// ─── SMART CATEGORIES ─────────────────────
function setupSmartSuggestions() {
    const input = document.getElementById('itemDescription'); const box = document.getElementById('smartSuggestion');
    input.addEventListener('input', e => {
        const v = e.target.value.toLowerCase(); const matches = Object.keys(SMART_DICT).filter(k => k.includes(v) && v.length>1);
        if(matches.length>0){ box.innerHTML = matches.map(m=>`<div class="suggestion-item" data-val="${m}">${m}</div>`).join(''); box.classList.add('show'); }
        else box.classList.remove('show');
    });
    input.addEventListener('blur', ()=>setTimeout(()=>box.classList.remove('show'),150));
    box.addEventListener('click', e => {
        const item = e.target.closest('.suggestion-item'); if(!item)return;
        input.value = item.dataset.val; const cat = SMART_DICT[item.dataset.val]; if(cat) document.getElementById('itemCategory').value = cat;
        box.classList.remove('show');
    });
}

// ─── CRUD ─────────────────────────────────
function openModal(type, id=null) {
    const ov=document.getElementById('modalOverlay'); const title=document.getElementById('modalTitle'); const catGrp=document.getElementById('categoryGroup'); const scopeGrp=document.getElementById('scopeGroup');
    document.getElementById('itemType').value=type; document.getElementById('itemId').value=id||'';
    if(type==='expense'){catGrp.style.display='block';title.textContent=id?'Editar Despesa':'Adicionar Despesa';}else{catGrp.style.display='none';title.textContent=id?'Editar Receita':'Adicionar Receita';}
    scopeGrp.style.display='none'; document.getElementById('smartSuggestion').classList.remove('show');
    if(id){
        const data=loadData(); let item=data.recurringItems.find(i=>i.id===id);
        if(!item){const key=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);const ovrs=data.monthOverrides[key]||{added:[]};item=ovrs.added.find(i=>i.id===id);if(!item&&ovrs.modified[id]){const base=data.recurringItems.find(i=>i.id===id);item=base?{...base,...ovrs.modified[id]}:null;}}
        if(item){document.getElementById('itemDescription').value=item.description;document.getElementById('itemAmount').value=item.amount.toString().replace('.',',');document.getElementById('itemFrequency').value=item.frequency||'mensal';document.getElementById('itemDueDate').value=item.dueDate||'';document.getElementById('itemRecurring').checked=item.isRecurring;if(type==='expense')document.getElementById('itemCategory').value=item.category||'outros';if(item.isRecurring)scopeGrp.style.display='block';}
    }else{document.getElementById('itemForm').reset();document.getElementById('itemRecurring').checked=true;}
    ov.classList.add('active'); setTimeout(()=>document.getElementById('itemDescription').focus(),100);
}
function closeModal(){document.getElementById('modalOverlay').classList.remove('active');}
function saveItem(e){
    e.preventDefault(); const type=document.getElementById('itemType').value; const desc=document.getElementById('itemDescription').value.trim(); const amt=parseCurrency(document.getElementById('itemAmount').value); const freq=document.getElementById('itemFrequency').value; const due=parseInt(document.getElementById('itemDueDate').value)||null; const cat=type==='expense'?document.getElementById('itemCategory').value:null; const isRec=document.getElementById('itemRecurring').checked; const editId=document.getElementById('itemId').value;
    if(!desc)return showToast('Informe a descrição!','error'); if(!amt||amt<=0)return showToast('Valor inválido!','error');
    const data=loadData(); const newItem={id:editId||generateId(),description:desc,amount:amt,frequency:freq,dueDate:due,category:cat,type,isRecurring:isRec};
    if(editId){
        const scope=document.querySelector('input[name="scope"]:checked')?.value||(isRec?'all':'current');
        if(isRec&&scope==='all'){const idx=data.recurringItems.findIndex(i=>i.id===editId);if(idx!==-1)data.recurringItems[idx]=newItem;showToast('Atualizado para todos os meses! 🔄');}
        else{const key=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!data.monthOverrides[key])data.monthOverrides[key]={added:[],removed:[],modified:{}};data.monthOverrides[key].modified[editId]=newItem;showToast('Alteração apenas neste mês! 📅');}
    }else{
        if(isRec){data.recurringItems.push(newItem);showToast('Item recorrente criado! 🔄');}
        else{const key=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!data.monthOverrides[key])data.monthOverrides[key]={added:[],removed:[],modified:{}};data.monthOverrides[key].added.push(newItem);showToast('Item avulso adicionado! 📌');}
    }
    saveData(data);closeModal();renderAll();
}
function deleteItem(type, id){
    if(!confirm('Deseja excluir este item?'))return; const data=loadData(); const isRec=data.recurringItems.some(i=>i.id===id); let scope='current';
    if(isRec){const c=prompt('Excluir APENAR deste mês (1) ou de TODOS os meses (2)?\nDigite 1 ou 2:');if(c==='2')scope='all';else if(c!=='1')return;}
    if(isRec&&scope==='all'){data.recurringItems=data.recurringItems.filter(i=>i.id!==id);Object.keys(data.monthOverrides).forEach(k=>{const ov=data.monthOverrides[k];ov.removed=ov.removed.filter(r=>r!==id);delete ov.modified[id];});showToast('Excluído permanentemente! 🗑️');}
    else{const key=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!data.monthOverrides[key])data.monthOverrides[key]={added:[],removed:[],modified:{}};if(isRec)data.monthOverrides[key].removed.push(id);else data.monthOverrides[key].added=data.monthOverrides[key].added.filter(i=>i.id!==id);showToast('Removido apenas deste mês! 📅');}
    saveData(data);renderAll();
}
function editItem(type, id){openModal(type, id);}

function exportData(){const d=loadData();const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`orcamento-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);showToast('Backup exportado!');}
function importData(file){const r=new FileReader();r.onload=e=>{try{const imp=JSON.parse(e.target.result);if(typeof imp==='object'){const ex=loadData();const mg={recurringItems:imp.recurringItems||ex.recurringItems,monthOverrides:{...ex.monthOverrides,...imp.monthOverrides}};saveData(mg);showToast('Backup restaurado!');renderAll();}else showToast('Arquivo inválido!','error');}catch{showToast('Erro ao ler arquivo!','error');}};r.readAsText(file);}

// ─── INIT & EVENTS ────────────────────────
function renderAll(){updateMonthDisplay();updateSummary();renderItems('income');renderItems('expense');renderChart();renderHistory();checkDueAlerts();}
function initApp(){
    if(APP_STATE.isViewOnly)applyViewOnly(); renderAll(); initTheme(); setupSmartSuggestions(); initPWA();
    document.getElementById('btnThemeToggle').onclick=toggleTheme;
    document.getElementById('btnPrevMonth').onclick=()=>{APP_STATE.currentMonth--;if(APP_STATE.currentMonth<0){APP_STATE.currentMonth=11;APP_STATE.currentYear--;}renderAll();};
    document.getElementById('btnNextMonth').onclick=()=>{APP_STATE.currentMonth++;if(APP_STATE.currentMonth>11){APP_STATE.currentMonth=0;APP_STATE.currentYear++;}renderAll();};
    document.querySelectorAll('.btn-add').forEach(btn=>btn.onclick=()=>{document.getElementById('itemId').value='';openModal(btn.dataset.type);});
    document.getElementById('btnCloseModal').onclick=closeModal; document.getElementById('btnCancelModal').onclick=closeModal;
    document.getElementById('modalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeModal();};
    document.getElementById('itemForm').onsubmit=saveItem;
    document.getElementById('itemAmount').oninput=function(e){let v=e.target.value.replace(/[^\d]/g,'');if(v){e.target.value=(parseInt(v)/100).toFixed(2).replace('.',',');}};
    document.querySelectorAll('.filter-btn').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');APP_STATE.currentFilter=btn.dataset.filter;renderItems('expense');});
    document.getElementById('searchExpenses').oninput=()=>renderItems('expense');
    document.getElementById('savingsGoal').oninput=()=>updateSummary();
    document.getElementById('savingsGoal').value=localStorage.getItem('savingsGoal')||'500,00';
    document.getElementById('savingsGoal').onblur=function(){localStorage.setItem('savingsGoal',this.value);updateSummary();};
    document.getElementById('btnExport').onclick=exportData; document.getElementById('btnExportPDF').onclick=exportPDF;
    document.getElementById('btnImport').onclick=()=>document.getElementById('fileImport').click();
    document.getElementById('fileImport').onchange=e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value='';};
    document.getElementById('btnLogout').onclick=logout;
    document.onkeydown=e=>{if(e.key==='Escape')closeModal();};
    window.onresize=()=>{clearTimeout(window._rt);window._rt=setTimeout(renderChart,200);};
    document.addEventListener('keydown',e=>{
        if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
        if(e.key==='ArrowLeft')document.getElementById('btnPrevMonth').click();
        if(e.key==='ArrowRight')document.getElementById('btnNextMonth').click();
        if(e.key.toLowerCase()==='n')document.querySelector('.btn-add')?.click();
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();document.getElementById('searchExpenses')?.focus();}
    });
}

if(checkAuth()){initApp();}else{
    document.getElementById('loginForm').onsubmit=e=>{e.preventDefault();if(login(document.getElementById('password').value)){document.getElementById('loginError').textContent='';initApp();}else{document.getElementById('loginError').textContent='Senha incorreta.';document.getElementById('password').value='';document.getElementById('password').focus();}};
    document.getElementById('password').focus();
}
