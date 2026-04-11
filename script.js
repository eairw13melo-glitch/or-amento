/* ============================================
   ORÇAMENTO FAMILIAR - V5.0 (UNIFICADO + EXCEL)
   ============================================ */
const APP_CONFIG = { password: 'familia2026', sessionKey: 'budgetAppSession', sessionDuration: 7 * 24 * 60 * 60 * 1000 };
const APP_STATE = { currentMonth: new Date().getMonth(), currentYear: new Date().getFullYear(), currentFilter: 'all', isViewOnly: new URLSearchParams(window.location.search).get('viewonly') === '1' };
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CATEGORY_LABELS = { moradia:'🏠 Moradia', alimentacao:'🍔 Alimentação', transporte:'🚗 Transporte', saude:'💊 Saúde', educacao:'📚 Educação', lazer:'🎮 Lazer', vestuario:'👕 Vestuário', outros:'📦 Outros' };
const CATEGORY_COLORS = { moradia:'#e17055', alimentacao:'#fdcb6e', transporte:'#74b9ff', saude:'#55efc4', educacao:'#a29bfe', lazer:'#fd79a8', vestuario:'#00cec9', outros:'#636e72' };
const SMART_DICT = { 'aluguel':'moradia','luz':'moradia','energia':'moradia','agua':'moradia','condominio':'moradia','internet':'moradia','mercado':'alimentacao','restaurante':'alimentacao','ifood':'alimentacao','uber':'transporte','99':'transporte','gasolina':'transporte','farmacia':'saude','medico':'saude','plano de saude':'saude','escola':'educacao','curso':'educacao','material':'educacao','netflix':'lazer','spotify':'lazer','cinema':'lazer','roupa':'vestuario','sapato':'vestuario','academia':'saude' };

// ─── STORAGE & MIGRAÇÃO ───────────────────
function loadData() {
    try { 
        const raw = localStorage.getItem('budgetAppData'); 
        if (!raw) return { recurringItems: [], monthOverrides: {} }; 
        let data = JSON.parse(raw);
        
        // Migração v1/v2 -> v3/v4/v5
        if (data.recurringItems === undefined && Object.keys(data).some(k => /^\d{4}-\d{2}$/.test(k))) { 
            const newData = { recurringItems: [], monthOverrides: {} }; 
            Object.keys(data).forEach(k => { 
                data[k].income.forEach(i => newData.recurringItems.push({ ...i, type: 'income', activeMonths: [k] })); 
                data[k].expenses.forEach(i => newData.recurringItems.push({ ...i, type: 'expense', activeMonths: [k] })); 
            }); 
            data = newData; saveData(data); showToast('Dados migrados para novo sistema! 🔄'); 
        }

        // Normalização e migração de campos antigos
        data.recurringItems = data.recurringItems || [];
        data.monthOverrides = data.monthOverrides || {};
        data.recurringItems = data.recurringItems.map(item => {
            if (item.duration && !item.activeMonths) {
                // Converte duração antiga para activeMonths
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
    } catch { return { recurringItems: [], monthOverrides: {} }; }
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
function normalizeValue(item) { return item.amount || 0; } // Simplificado para valor direto
function showToast(msg, type='success') { const c = document.getElementById('toastContainer'); const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function getDurationLabel(months) {
    if (months.length === 1) return '📌 Único';
    if (months.length > 12) return '♾️ Longo Prazo';
    return `🔄 ${months.length}x`;
}

// ─── AUTH & LOGOUT ────────────────────────
function checkAuth() { const s = sessionStorage.getItem(APP_CONFIG.sessionKey); if (s) { const { token, ts } = JSON.parse(s); if (token === btoa(APP_CONFIG.password) && Date.now() - ts < APP_CONFIG.sessionDuration) { document.getElementById('loginScreen').classList.add('hidden'); return true; } } return false; }
function login(pwd) { if (pwd === APP_CONFIG.password) { sessionStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify({ token: btoa(pwd), ts: Date.now() })); document.getElementById('loginScreen').classList.add('hidden'); showToast('Bem-vindo! 👋'); return true; } return false; }
async function logout() { showToast('Encerrando sessão e limpando cache... 🔒', 'success'); sessionStorage.removeItem(APP_CONFIG.sessionKey); if ('caches' in window) { try { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.includes('budget')).map(k => caches.delete(k))); } catch {} } setTimeout(() => location.reload(), 800); }

// ─── THEME & PWA & CALC ───────────────────
function initTheme() { const saved = localStorage.getItem('appTheme'); const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); document.documentElement.setAttribute('data-theme', theme); updateThemeIcon(theme); updateMetaTheme(theme); }
function toggleTheme() { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('appTheme', next); updateThemeIcon(next); updateMetaTheme(next); }
function updateThemeIcon(t) { document.getElementById('btnThemeToggle').textContent = t === 'dark' ? '☀️' : '🌙'; }
function updateMetaTheme(t) { document.getElementById('themeColorMeta').content = t === 'dark' ? '#0f1117' : '#f5f7fa'; }
function initPWA() { if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }
function initCalculator() { let expr = ''; const d = document.getElementById('calcDisplay'); document.querySelectorAll('.calc-btn').forEach(b => b.onclick = () => { const v = b.dataset.val; if(v==='C') expr=''; else if(v==='⌫') expr=expr.slice(0,-1); else if(v==='=') { try { expr = String(Function('"use strict"; return ('+expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')+')')()); if(isNaN(+expr)||!isFinite(+expr)) expr='Erro'; } catch { expr='Erro'; } } else expr+=v; d.textContent = expr||'0'; }); }

// ─── MINI CALENDÁRIO ──────────────────────
function renderCalendar() {
    const grid = document.getElementById('miniCalendar'); grid.innerHTML = '<div class="mini-calendar-title">📅 Próximos Meses</div><div class="cal-grid"></div>';
    const cal = grid.querySelector('.cal-grid');
    for(let i=0; i<12; i++) {
        let m=APP_STATE.currentMonth+i, y=APP_STATE.currentYear+Math.floor(m/12); m%=12;
        const key=getMonthKey(m,y), md=getMonthData(m,y), has=md.income.length>0||md.expenses.length>0, active=m===APP_STATE.currentMonth&&y===APP_STATE.currentYear;
        const btn=document.createElement('div'); btn.className=`cal-item ${active?'active':''} ${has?'has-data':''}`;
        btn.innerHTML=`<div class="cal-abbr">${MONTHS_SHORT[m]}</div><div>${y.toString().slice(2)}</div>`;
        btn.onclick=()=>{APP_STATE.currentMonth=m;APP_STATE.currentYear=y;renderAll();}; cal.appendChild(btn);
    }
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
function renderCategoryGoals(expenses){const g=document.getElementById('goalsGrid');g.innerHTML='';const goals=JSON.parse(localStorage.getItem('categoryGoals')||'{}'),totals={};expenses.forEach(i=>totals[i.category||'outros']=(totals[i.category||'outros']||0)+normalizeValue(i));Object.keys(CATEGORY_LABELS).forEach(c=>{const t=totals[c]||0,gl=goals[c]||1000,p=gl>0?(t/gl)*100:0;const d=document.createElement('div');d.className='goal-item';d.innerHTML=`<div class="goal-label"><span>${CATEGORY_LABELS[c]}</span><span>${formatCurrency(t)} / ${formatCurrency(gl)}</span></div><div class="goal-bar"><div class="goal-fill ${p>100?'over':''}" style="width:${Math.min(100,p)}%"></div></div>`;d.onclick=()=>{const n=prompt(`Meta para ${CATEGORY_LABELS[c]} (R$):`,gl);if(n!==null){goals[c]=parseCurrency(n);localStorage.setItem('categoryGoals',JSON.stringify(goals));renderAll();}};g.appendChild(d);});}

function renderItems(type) {
    const {income,expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear), listId=type==='income'?'incomeList':'expenseList', emptyId=type==='income'?'incomeEmpty':'expenseEmpty', listEl=document.getElementById(listId), emptyEl=document.getElementById(emptyId);
    let items=type==='income'?income:expenses;
    if(type==='expense'){if(APP_STATE.currentFilter!=='all')items=items.filter(i=>i.category===APP_STATE.currentFilter);const s=document.getElementById('searchExpenses')?.value.toLowerCase()||'';if(s)items=items.filter(i=>i.description.toLowerCase().includes(s)||(i.category||'').includes(s));}
    listEl.innerHTML='';if(items.length===0){emptyEl.style.display='block';return;}emptyEl.style.display='none';
    items.forEach(item=>{
        const card=document.createElement('div');card.className='item-card';const val=normalizeValue(item),cls=type==='income'?'income':'expense',sign=type==='income'?'+':'-';
        const lbl=getDurationLabel(item.activeMonths||[]), bCls=lbl.includes('Único')?'badge-single':lbl.includes('Longo')?'badge-recurring':'badge-limited';
        let cat=type==='expense'&&item.category?`<span class="item-category">${CATEGORY_LABELS[item.category]||item.category}</span>`:'';
        let due=item.dueDate?`<span class="item-due">Venc. dia ${item.dueDate}</span>`:'';
        card.innerHTML=`<div class="item-info"><div class="item-description">${item.description}<span class="badge ${bCls}">${lbl}</span></div><div class="item-meta">${cat}${due}</div></div><div class="item-value ${cls}">${sign} ${formatCurrency(val)}</div><div class="item-actions"><button class="btn btn-edit" onclick="editItem('${type}','${item.id}')">✏️</button><button class="btn btn-delete" onclick="deleteItem('${type}','${item.id}')">🗑️</button></div>`;
        listEl.appendChild(card);
    });
}
function renderChart(){const{expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),totals={};expenses.forEach(i=>totals[i.category||'outros']=(totals[i.category||'outros']||0)+normalizeValue(i));const cv=document.getElementById('categoryChart'),ct=document.getElementById('chartContainer'),en=Object.entries(totals);ct.innerHTML='';if(en.length===0){ct.innerHTML='<div class="empty-state"><p>Sem dados</p></div>';return;}const c=document.createElement('canvas');c.id='categoryChart';ct.appendChild(c);const x=c.getContext('2d'),sz=Math.min(ct.clientWidth,350);c.width=sz*2;c.height=sz*2;c.style.width=sz+'px';c.style.height=sz+'px';x.scale(2,2);const tot=en.reduce((s,[,v])=>s+v,0),cx=sz/2,cy=sz/2,r=sz/3,ir=r*0.6;let st=-Math.PI/2;en.forEach(([k,v])=>{const a=(v/tot)*2*Math.PI;x.beginPath();x.arc(cx,cy,r,st,st+a);x.arc(cx,cy,ir,st+a,st,true);x.closePath();x.fillStyle=CATEGORY_COLORS[k]||'#636e72';x.fill();st+=a;});x.beginPath();x.arc(cx,cy,ir-2,0,Math.PI*2);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim();x.fill();x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();x.font=`bold ${sz*0.06}px Inter`;x.textAlign='center';x.textBaseline='middle';x.fillText(formatCurrency(tot),cx,cy-8);x.font=`${sz*0.035}px Inter`;x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();x.fillText('Total Despesas',cx,cy+12);const ly=sz*0.88;let lx=sz*0.05;en.forEach(([k,v])=>{const l=CATEGORY_LABELS[k]||k;x.fillStyle=CATEGORY_COLORS[k]||'#636e72';x.fillRect(lx,ly,10,10);x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();x.font=`${sz*0.032}px Inter`;x.textAlign='left';x.textBaseline='middle';x.fillText(l,lx+14,ly+5);lx+=x.measureText(l).width+30;});}
function renderHistory(){const d=loadData(),tb=document.getElementById('historyBody'),em=document.getElementById('historyEmpty');tb.innerHTML='';const ks=new Set(Object.keys(d.monthOverrides));ks.add(getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear));for(let i=0;i<6;i++)ks.add(getMonthKey((APP_STATE.currentMonth+i)%12,APP_STATE.currentYear+Math.floor((APP_STATE.currentMonth+i)/12)));const so=Array.from(ks).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().reverse();if(so.length===0){em.style.display='block';return;}em.style.display='none';so.forEach(k=>{const[y,m]=k.split('-');const{income,expenses}=getMonthData(parseInt(m)-1,parseInt(y));const inc=income.reduce((s,i)=>s+normalizeValue(i),0),exp=expenses.reduce((s,i)=>s+normalizeValue(i),0),bal=inc-exp,cl=bal>0?'amount-positive':bal<0?'amount-negative':'amount-neutral',tr=document.createElement('tr');tr.innerHTML=`<td>${MONTHS[parseInt(m)-1]}/${y}</td><td class="amount-income">${formatCurrency(inc)}</td><td class="amount-expense">${formatCurrency(exp)}</td><td class="${cl}">${formatCurrency(bal)}</td>`;tb.appendChild(tr);});}
function checkDueAlerts(){const{expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),t=new Date().getDate(),u=expenses.filter(i=>i.dueDate&&i.dueDate>=t&&i.dueDate<=t+3);if(u.length>0)showToast(`⚠️ ${u.length} vencimento(s) nos próximos 3 dias!`,'error');}
function exportPDF(){const{income,expenses}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),inc=income.reduce((s,i)=>s+normalizeValue(i),0),exp=expenses.reduce((s,i)=>s+normalizeValue(i),0),bal=inc-exp;let t=`ORÇAMENTO FAMILIAR\n${MONTHS[APP_STATE.currentMonth]}/${APP_STATE.currentYear}\n${'═'.repeat(40)}\n\nRECEITAS: ${formatCurrency(inc)}\nDESPESAS: ${formatCurrency(exp)}\nSALDO: ${formatCurrency(bal)}\n\n`;const cats={};expenses.forEach(i=>cats[i.category||'outros']=(cats[i.category||'outros']||0)+normalizeValue(i));t+='DESPESAS POR CATEGORIA:\n';Object.entries(cats).forEach(([c,v])=>t+=`• ${CATEGORY_LABELS[c]||c}: ${formatCurrency(v)}\n`);const w=window.open('','_blank');w.document.write(`<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap;">${t}</pre>`);w.document.close();setTimeout(()=>w.print(),500);}
function applyViewOnly(){if(!APP_STATE.isViewOnly)return;document.querySelectorAll('.btn-add, .btn-edit, .btn-delete, #btnExport, #btnImport, #btnExportPDF, #btnExportExcel, #btnImportExcel, #btnExcelTemplate, #searchExpenses, #savingsGoal, .goal-item, #btnAddNote, #noteInput').forEach(el=>el.style.display='none');document.querySelectorAll('input, select, button[type="submit"]').forEach(el=>el.disabled=true);}

// ─── AGENDA ───────────────────────────────
function renderNotes(){const{notes}=getMonthData(APP_STATE.currentMonth,APP_STATE.currentYear),list=document.getElementById('notesList'),em=document.getElementById('notesEmpty');list.innerHTML='';if(notes.length===0){em.style.display='block';return;}em.style.display='none';notes.forEach((n,i)=>{const c=document.createElement('div');c.className='note-card';c.innerHTML=`<div style="flex:1;"><div class="note-text">${n.text}</div><div class="note-time">${n.timestamp?new Date(n.timestamp).toLocaleDateString('pt-BR'):''}</div></div><button class="btn btn-note-del" onclick="deleteNote(${i})" title="Excluir">✖</button>`;list.appendChild(c);});}
function addNote(t){if(!t.trim())return;const d=loadData(),k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};d.monthOverrides[k].notes.push({text:t.trim(),timestamp:Date.now()});saveData(d);document.getElementById('noteInput').value='';showToast('Anotação adicionada! 📝');renderNotes();}
function deleteNote(i){const d=loadData(),k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(d.monthOverrides[k]){d.monthOverrides[k].notes.splice(i,1);saveData(d);renderNotes();}}

// ─── SMART CATEGORIES ─────────────────────
function setupSmartSuggestions(){const i=document.getElementById('itemDescription'),b=document.getElementById('smartSuggestion');i.addEventListener('input',e=>{const v=e.target.value.toLowerCase(),m=Object.keys(SMART_DICT).filter(k=>k.includes(v)&&v.length>1);if(m.length>0){b.innerHTML=m.map(x=>`<div class="suggestion-item" data-val="${x}">${x}</div>`).join('');b.classList.add('show');}else b.classList.remove('show');});i.addEventListener('blur',()=>setTimeout(()=>b.classList.remove('show'),150));b.addEventListener('click',e=>{const it=e.target.closest('.suggestion-item');if(!it)return;i.value=it.dataset.val;const c=SMART_DICT[it.dataset.val];if(c)document.getElementById('itemCategory').value=c;b.classList.remove('show');});}

// ─── MODAL & SELETOR VISUAL ───────────────
function renderMonthGrid(selected = []) {
    const grid = document.getElementById('monthsCheckGrid'); grid.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const m = (APP_STATE.currentMonth + i) % 12;
        const y = APP_STATE.currentYear + Math.floor((APP_STATE.currentMonth + i) / 12);
        const key = getMonthKey(m, y);
        const checked = selected.includes(key);
        const label = document.createElement('label'); label.className = 'month-check-item';
        label.innerHTML = `<input type="checkbox" value="${key}" ${checked ? 'checked' : ''}><span>${MONTHS[m].substring(0,3)}/${y.toString().slice(2)}</span>`;
        grid.appendChild(label);
    }
}

function openModal(type, id=null) {
    const ov=document.getElementById('modalOverlay'), title=document.getElementById('modalTitle'), catGrp=document.getElementById('categoryGroup'), occGrp=document.getElementById('occurrenceGroup');
    document.getElementById('itemType').value=type; document.getElementById('itemId').value=id||'';
    if(type==='expense'){catGrp.style.display='block';occGrp.style.display='block';title.textContent=id?'Editar Despesa':'Adicionar Despesa';}
    else{catGrp.style.display='none';occGrp.style.display='none';title.textContent=id?'Editar Receita':'Adicionar Receita';}
    document.getElementById('smartSuggestion').classList.remove('show');
    
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
function saveItem(e){
    e.preventDefault(); const type=document.getElementById('itemType').value, desc=document.getElementById('itemDescription').value.trim(), amt=parseCurrency(document.getElementById('itemAmount').value), due=parseInt(document.getElementById('itemDueDate').value)||null, cat=type==='expense'?document.getElementById('itemCategory').value:null, editId=document.getElementById('itemId').value;
    if(!desc)return showToast('Informe a descrição!','error'); if(!amt||amt<=0)return showToast('Valor inválido!','error');
    const d=loadData();
    let activeMonths = [];
    if(type==='expense' && document.querySelector('input[name="occurrenceType"]:checked').value === 'recurring'){
        document.querySelectorAll('#monthsCheckGrid input:checked').forEach(cb => activeMonths.push(cb.value));
    }
    if(activeMonths.length === 0 && type==='expense') activeMonths = [getMonthKey(APP_STATE.currentMonth, APP_STATE.currentYear)];
    
    const newItem={id:editId||generateId(),description:desc,amount:amt,dueDate:due,category:cat,type,activeMonths};
    if(editId){
        if(activeMonths.length>1){const idx=d.recurringItems.findIndex(i=>i.id===editId);if(idx!==-1)d.recurringItems[idx]=newItem;showToast('Atualizado para os meses selecionados! 🔄');}
        else{const k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};d.monthOverrides[k].modified[editId]=newItem;showToast('Exceção aplicada a este mês! 📅');}
    }else{
        if(activeMonths.length>1){d.recurringItems.push(newItem);showToast('Despesa recorrente criada! 🔄');}
        else{const k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};d.monthOverrides[k].added.push(newItem);showToast('Item único adicionado! 📌');}
    }
    saveData(d);closeModal();renderAll();
}
function deleteItem(type, id){if(!confirm('Excluir este item?'))return;const d=loadData(),isRec=d.recurringItems.some(i=>i.id===id),s=prompt('Excluir APENAR deste mês (1) ou TODOS (2)?');if(s!=='2'&&s!=='1')return;if(isRec&&s==='2'){d.recurringItems=d.recurringItems.filter(i=>i.id!==id);Object.keys(d.monthOverrides).forEach(k=>{const ov=d.monthOverrides[k];ov.removed=ov.removed.filter(r=>r!==id);delete ov.modified[id];});showToast('Excluído permanentemente! 🗑️');}else{const k=getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear);if(!d.monthOverrides[k])d.monthOverrides[k]={added:[],removed:[],modified:{},notes:[]};if(isRec)d.monthOverrides[k].removed.push(id);else d.monthOverrides[k].added=d.monthOverrides[k].added.filter(i=>i.id!==id);showToast('Removido deste mês! 📅');}saveData(d);renderAll();}
function editItem(type, id){openModal(type, id);}

// ─── EXCEL ────────────────────────────────
function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const data = [
        { Tipo: 'Receita ou Despesa', Descrição: 'Ex: Aluguel', Categoria: 'moradia/alimentacao/etc', Valor: 1000, Meses_Ativos: '2024-05,2024-06,2024-07', Dia_Vencimento: 10 }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:20},{wch:30},{wch:20},{wch:10},{wch:35},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "Modelo_Importacao_Excel.xlsx");
    showToast('Modelo baixado! Preencha e importe. 📥');
}
function exportExcel() {
    const d=loadData(), rows=[];
    d.recurringItems.forEach(i=>rows.push({'Tipo':i.type==='income'?'Receita':'Despesa','Descrição':i.description,'Categoria':i.category||'-','Valor':i.amount,'Meses_Ativos':(i.activeMonths||[]).join(','),'Dia_Vencimento':i.dueDate||'-'}));
    const ws=XLSX.utils.json_to_sheet(rows), wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Orçamento"); XLSX.writeFile(wb,`Orcamento_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Planilha exportada! 📊');
}
function importExcel(file){const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'binary'}),ws=wb.Sheets[wb.SheetNames[0]],json=XLSX.utils.sheet_to_json(ws),d=loadData();json.forEach(row=>{const type=row.Tipo==='Receita'?'income':'expense',am=(row.Meses_Ativos||'').split(',').map(s=>s.trim()).filter(s=>/^\d{4}-\d{2}$/.test(s));if(am.length===0)am.push(getMonthKey(APP_STATE.currentMonth,APP_STATE.currentYear));const item={id:generateId(),description:row.Descrição||'Importado',amount:parseFloat(row.Valor)||0,category:row.Categoria||'outros',dueDate:row.Dia_Vencimento==='-'||isNaN(row.Dia_Vencimento)?null:parseInt(row.Dia_Vencimento),type,activeMonths:am};d.recurringItems.push(item);});saveData(d);renderAll();showToast('Planilha importada! 📥');}catch(err){showToast('Erro ao ler planilha. Use o modelo fornecido.','error');}};r.readAsBinaryString(file);}

// ─── INIT ─────────────────────────────────
function renderAll(){updateMonthDisplay();updateSummary();renderItems('income');renderItems('expense');renderChart();renderHistory();renderCalendar();renderNotes();checkDueAlerts();}
function initApp(){if(APP_STATE.isViewOnly)applyViewOnly();renderAll();initTheme();setupSmartSuggestions();initPWA();initCalculator();
    document.getElementById('btnThemeToggle').onclick=toggleTheme;
    document.getElementById('btnPrevMonth').onclick=()=>{APP_STATE.currentMonth--;if(APP_STATE.currentMonth<0){APP_STATE.currentMonth=11;APP_STATE.currentYear--;}renderAll();};
    document.getElementById('btnNextMonth').onclick=()=>{APP_STATE.currentMonth++;if(APP_STATE.currentMonth>11){APP_STATE.currentMonth=0;APP_STATE.currentYear++;}renderAll();};
    document.querySelectorAll('.btn-add').forEach(b=>b.onclick=()=>{document.getElementById('itemId').value='';openModal(b.dataset.type);});
    document.getElementById('btnCloseModal').onclick=closeModal;document.getElementById('btnCancelModal').onclick=closeModal;
    document.getElementById('modalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeModal();};
    document.getElementById('itemForm').onsubmit=saveItem;
    document.getElementById('itemAmount').oninput=e=>{let v=e.target.value.replace(/[^\d]/g,'');if(v)e.target.value=(parseInt(v)/100).toFixed(2).replace('.',',');};
    document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');APP_STATE.currentFilter=b.dataset.filter;renderItems('expense');});
    document.getElementById('searchExpenses').oninput=()=>renderItems('expense');
    document.getElementById('savingsGoal').oninput=()=>updateSummary();document.getElementById('savingsGoal').value=localStorage.getItem('savingsGoal')||'500,00';document.getElementById('savingsGoal').onblur=e=>{localStorage.setItem('savingsGoal',e.target.value);updateSummary();};
    document.getElementById('btnExport').onclick=()=>{const d=loadData();const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`orcamento-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);showToast('Backup JSON exportado!');};
    document.getElementById('btnExportPDF').onclick=exportPDF; document.getElementById('btnExportExcel').onclick=exportExcel; document.getElementById('btnExcelTemplate').onclick=downloadExcelTemplate;
    document.getElementById('btnImport').onclick=()=>document.getElementById('fileImport').click();document.getElementById('fileImport').onchange=e=>{if(e.target.files[0]){const r=new FileReader();r.onload=ev=>{try{const d=loadData(),imp=JSON.parse(ev.target.result);saveData({recurringItems:imp.recurringItems||d.recurringItems,monthOverrides:{...d.monthOverrides,...imp.monthOverrides}});renderAll();showToast('Restaurado!');}catch{showToast('Erro!','error');}};r.readAsText(e.target.files[0]);}e.target.value='';};
    document.getElementById('btnImportExcel').onclick=()=>document.getElementById('fileImportExcel').click();document.getElementById('fileImportExcel').onchange=e=>{if(e.target.files[0])importExcel(e.target.files[0]);e.target.value='';};
    document.getElementById('btnLogout').onclick=logout;
    document.getElementById('btnAddNote').onclick=()=>addNote(document.getElementById('noteInput').value);
    document.getElementById('noteInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addNote(document.getElementById('noteInput').value);}};
    document.onkeydown=e=>{if(e.key==='Escape')closeModal();};
    window.onresize=()=>{clearTimeout(window._rt);window._rt=setTimeout(renderChart,200);};
    document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowLeft')document.getElementById('btnPrevMonth').click();if(e.key==='ArrowRight')document.getElementById('btnNextMonth').click();if(e.key.toLowerCase()==='n')document.querySelector('.btn-add')?.click();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();document.getElementById('searchExpenses')?.focus();}});
}
if(checkAuth()){initApp();}else{document.getElementById('loginForm').onsubmit=e=>{e.preventDefault();if(login(document.getElementById('password').value)){document.getElementById('loginError').textContent='';initApp();}else{document.getElementById('loginError').textContent='Senha incorreta.';document.getElementById('password').value='';document.getElementById('password').focus();}};document.getElementById('password').focus();}
