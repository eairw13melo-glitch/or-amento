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
    // Evento do botão "Voltar ao mês atual"
    document.getElementById('btnBackToCurrentMonth').onclick = () => {
        const hoje = new Date();
        APP_STATE.currentMonth = hoje.getMonth();
        APP_STATE.currentYear = hoje.getFullYear();
        renderAll();
        showToast('✅ Voltou para o mês atual!', 'success');
    };
}
