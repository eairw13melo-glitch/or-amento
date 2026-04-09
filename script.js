/* ============================================
   ORÇAMENTO FAMILIAR - SCRIPT PRINCIPAL
   ============================================ */
// 🔐 CONFIGURAÇÃO DE SENHA
// ⚠️ Em produção real, use backend para validar senhas!
const APP_CONFIG = {
    password: 'familia2026', // ← Altere para sua senha desejada
    sessionKey: 'budgetAppLoggedIn',
    sessionDuration: 7 * 24 * 60 * 60 * 1000 // 7 dias em milissegundos
};

// ─── ESTADO DA APLICAÇÃO ──────────────────
const APP_STATE = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    currentFilter: 'all',
    editingId: null,
    editingType: null,
};

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CATEGORY_LABELS = {
    moradia: '🏠 Moradia',
    alimentacao: '🍔 Alimentação',
    transporte: '🚗 Transporte',
    saude: '💊 Saúde',
    educacao: '📚 Educação',
    lazer: '🎮 Lazer',
    vestuario: '👕 Vestuário',
    outros: '📦 Outros',
};

const CATEGORY_COLORS = {
    moradia: '#e17055',
    alimentacao: '#fdcb6e',
    transporte: '#74b9ff',
    saude: '#55efc4',
    educacao: '#a29bfe',
    lazer: '#fd79a8',
    vestuario: '#00cec9',
    outros: '#636e72',
};

// ─── STORAGE ──────────────────────────────
function loadData() {
    try {
        const data = localStorage.getItem('budgetAppData');
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function saveData(data) {
    try {
        localStorage.setItem('budgetAppData', JSON.stringify(data));
    } catch (e) {
        showToast('Erro ao salvar dados!', 'error');
    }
}

function getMonthKey(month, year) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getMonthData(month, year) {
    const data = loadData();
    const key = getMonthKey(month, year);
    if (!data[key]) {
        data[key] = { income: [], expenses: [] };
    }
    return { data, key, monthData: data[key] };
}

// ─── UTILITÁRIOS ──────────────────────────
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

function parseCurrency(str) {
    if (typeof str === 'number') return str;
    return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function normalizeValue(item) {
    let value = item.amount;
    const freq = item.frequency || 'mensal';
    switch (freq) {
        case 'semanal': value *= 4.33; break;
        case 'quinzenal': value *= 2; break;
        case 'anual': value /= 12; break;
        case 'unico': value /= 1; break;
    }
    return value;
}

// ─── ATUALIZAÇÃO DA UI ───────────────────
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = MONTHS[APP_STATE.currentMonth];
    document.getElementById('currentYear').textContent = APP_STATE.currentYear;
}

function updateSummary() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);

    const totalIncome = monthData.income.reduce((sum, item) => sum + normalizeValue(item), 0);
    const totalExpense = monthData.expenses.reduce((sum, item) => sum + normalizeValue(item), 0);
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);

    const balanceEl = document.getElementById('totalBalance');
    balanceEl.textContent = formatCurrency(balance);

    const cardBalance = document.getElementById('cardBalance');
    cardBalance.classList.remove('positive', 'negative');
    if (balance > 0) cardBalance.classList.add('positive');
    else if (balance < 0) cardBalance.classList.add('negative');

    const savingsEl = document.getElementById('totalSavings');
    savingsEl.textContent = formatCurrency(Math.max(0, balance));

    const fillPercent = Math.min(100, Math.max(0, savingsRate));
    document.getElementById('savingsFill').style.width = fillPercent + '%';
    document.getElementById('savingsPercent').textContent = savingsRate.toFixed(1) + '% da receita economizada';
}

function renderItems(type) {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const listId = type === 'income' ? 'incomeList' : 'expenseList';
    const emptyId = type === 'income' ? 'incomeEmpty' : 'expenseEmpty';
    const listEl = document.getElementById(listId);
    const emptyEl = document.getElementById(emptyId);

    let items = type === 'income' ? monthData.income : monthData.expenses;

    // Aplicar filtro para despesas
    if (type === 'expense' && APP_STATE.currentFilter !== 'all') {
        items = items.filter(item => item.category === APP_STATE.currentFilter);
    }

    listEl.innerHTML = '';

    if (items.length === 0) {
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        const normalizedValue = normalizeValue(item);
        const valueClass = type === 'income' ? 'income' : 'expense';
        const sign = type === 'income' ? '+' : '-';

        let categoryHTML = '';
        if (type === 'expense' && item.category) {
            categoryHTML = `<span class="item-category">${CATEGORY_LABELS[item.category] || item.category}</span>`;
        }

        let frequencyHTML = '';
        if (item.frequency && item.frequency !== 'mensal') {
            frequencyHTML = `<span class="item-frequency">${item.frequency}</span>`;
        }

        let dueHTML = '';
        if (item.dueDate) {
            dueHTML = `<span class="item-due">Venc. dia ${item.dueDate}</span>`;
        }

        card.innerHTML = `
            <div class="item-info">
                <div class="item-description">${item.description}</div>
                <div class="item-meta">
                    ${categoryHTML}
                    ${frequencyHTML}
                    ${dueHTML}
                </div>
            </div>
            <div class="item-value ${valueClass}">${sign} ${formatCurrency(normalizedValue)}</div>
            <div class="item-actions">
                <button class="btn btn-edit" onclick="editItem('${type}', '${item.id}')" title="Editar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn btn-delete" onclick="deleteItem('${type}', '${item.id}')" title="Excluir">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        listEl.appendChild(card);
    });
}

function renderAll() {
    updateMonthDisplay();
    updateSummary();
    renderItems('income');
    renderItems('expense');
    renderChart();
    renderHistory();
}

// ─── GRÁFICO DE CATEGORIAS ────────────────
function renderChart() {
    const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);

    const categoryTotals = {};
    monthData.expenses.forEach(item => {
        const cat = item.category || 'outros';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + normalizeValue(item);
    });

    const canvas = document.getElementById('categoryChart');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('chartContainer');

    const entries = Object.entries(categoryTotals);
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sem dados para exibir o gráfico</p></div>';
        return;
    }

    // Re-create canvas
    container.innerHTML = '';
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'categoryChart';
    container.appendChild(newCanvas);
    const newCtx = newCanvas.getContext('2d');

    const size = Math.min(container.clientWidth, 350);
    newCanvas.width = size * 2;
    newCanvas.height = size * 2;
    newCanvas.style.width = size + 'px';
    newCanvas.style.height = size + 'px';
    newCtx.scale(2, 2);

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 3;
    const innerRadius = radius * 0.6;

    let startAngle = -Math.PI / 2;

    entries.forEach(([cat, value]) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        newCtx.beginPath();
        newCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        newCtx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        newCtx.closePath();
        newCtx.fillStyle = CATEGORY_COLORS[cat] || '#636e72';
        newCtx.fill();

        startAngle = endAngle;
    });

    // Centro do donut
    newCtx.beginPath();
    newCtx.arc(centerX, centerY, innerRadius - 2, 0, Math.PI * 2);
    newCtx.fillStyle = '#1a1d27';
    newCtx.fill();

    // Texto central
    newCtx.fillStyle = '#e8eaed';
    newCtx.font = `bold ${size * 0.06}px Inter, sans-serif`;
    newCtx.textAlign = 'center';
    newCtx.textBaseline = 'middle';
    newCtx.fillText(formatCurrency(total), centerX, centerY - 8);
    newCtx.font = `${size * 0.035}px Inter, sans-serif`;
    newCtx.fillStyle = '#9aa0b0';
    newCtx.fillText('Total Despesas', centerX, centerY + 12);

    // Legenda
    const legendY = size * 0.88;
    const legendStartX = size * 0.05;
    let legendX = legendStartX;

    entries.forEach(([cat, value]) => {
        const label = CATEGORY_LABELS[cat] || cat;
        newCtx.fillStyle = CATEGORY_COLORS[cat] || '#636e72';
        newCtx.fillRect(legendX, legendY, 10, 10);

        newCtx.fillStyle = '#9aa0b0';
        newCtx.font = `${size * 0.032}px Inter, sans-serif`;
        newCtx.textAlign = 'left';
        newCtx.textBaseline = 'middle';
        newCtx.fillText(label, legendX + 14, legendY + 5);

        legendX += newCtx.measureText(label).width + 30;
    });
}

// ─── HISTÓRICO MENSAL ─────────────────────
function renderHistory() {
    const data = loadData();
    const tbody = document.getElementById('historyBody');
    const emptyEl = document.getElementById('historyEmpty');
    tbody.innerHTML = '';

    const monthKeys = Object.keys(data).sort().reverse();

    if (monthKeys.length === 0) {
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';

    monthKeys.forEach(key => {
        const md = data[key];
        const totalInc = md.income.reduce((s, i) => s + normalizeValue(i), 0);
        const totalExp = md.expenses.reduce((s, i) => s + normalizeValue(i), 0);
        const balance = totalInc - totalExp;

        const [y, m] = key.split('-');
        const monthName = MONTHS[parseInt(m) - 1];

        const balanceClass = balance > 0 ? 'amount-positive' : balance < 0 ? 'amount-negative' : 'amount-neutral';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${monthName}/${y}</td>
            <td class="amount-income">${formatCurrency(totalInc)}</td>
            <td class="amount-expense">${formatCurrency(totalExp)}</td>
            <td class="${balanceClass}">${formatCurrency(balance)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── MODAL ────────────────────────────────
function openModal(type, itemId = null) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const categoryGroup = document.getElementById('categoryGroup');

    APP_STATE.editingId = itemId;
    APP_STATE.editingType = type;

    document.getElementById('itemType').value = type;

    if (type === 'expense') {
        categoryGroup.style.display = 'block';
        title.textContent = itemId ? 'Editar Despesa' : 'Adicionar Despesa';
    } else {
        categoryGroup.style.display = 'none';
        title.textContent = itemId ? 'Editar Receita' : 'Adicionar Receita';
    }

    // Preencher formulário se editando
    if (itemId) {
        const { monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
        const items = type === 'income' ? monthData.income : monthData.expenses;
        const item = items.find(i => i.id === itemId);

        if (item) {
            document.getElementById('itemDescription').value = item.description;
            document.getElementById('itemAmount').value = item.amount.toString().replace('.', ',');
            document.getElementById('itemFrequency').value = item.frequency || 'mensal';
            document.getElementById('itemDueDate').value = item.dueDate || '';
            if (type === 'expense') {
                document.getElementById('itemCategory').value = item.category || 'outros';
            }
        }
    } else {
        document.getElementById('itemForm').reset();
    }

    overlay.classList.add('active');
    setTimeout(() => document.getElementById('itemDescription').focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    APP_STATE.editingId = null;
    APP_STATE.editingType = null;
}

// ─── CRUD ─────────────────────────────────
function saveItem(e) {
    e.preventDefault();

    const type = document.getElementById('itemType').value;
    const description = document.getElementById('itemDescription').value.trim();
    const amount = parseCurrency(document.getElementById('itemAmount').value);
    const frequency = document.getElementById('itemFrequency').value;
    const dueDate = parseInt(document.getElementById('itemDueDate').value) || null;
    const category = type === 'expense' ? document.getElementById('itemCategory').value : null;

    if (!description) {
        showToast('Informe a descrição!', 'error');
        return;
    }

    if (!amount || amount <= 0) {
        showToast('Informe um valor válido!', 'error');
        return;
    }

    const { data, key, monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);

    const item = {
        id: APP_STATE.editingId || generateId(),
        description,
        amount,
        frequency,
        dueDate,
        category,
    };

    const items = type === 'income' ? monthData.income : monthData.expenses;

    if (APP_STATE.editingId) {
        const index = items.findIndex(i => i.id === APP_STATE.editingId);
        if (index !== -1) {
            items[index] = item;
        }
        showToast('Item atualizado com sucesso!');
    } else {
        items.push(item);
        showToast('Item adicionado com sucesso!');
    }

    data[key] = monthData;
    saveData(data);
    closeModal();
    renderAll();
}

function deleteItem(type, id) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    const { data, key, monthData } = getMonthData(APP_STATE.currentMonth, APP_STATE.currentYear);
    const items = type === 'income' ? monthData.income : monthData.expenses;
    const index = items.findIndex(i => i.id === id);

    if (index !== -1) {
        items.splice(index, 1);
        data[key] = monthData;
        saveData(data);
        showToast('Item excluído!');
        renderAll();
    }
}

function editItem(type, id) {
    openModal(type, id);
}

// ─── IMPORTAR / EXPORTAR ──────────────────
function exportData() {
    const data = loadData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orcamento-familiar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (typeof imported === 'object' && imported !== null) {
                const existing = loadData();
                // Merge: imported sobrescreve existing para mesma chave
                const merged = { ...existing, ...imported };
                saveData(merged);
                showToast('Dados importados com sucesso!');
                renderAll();
            } else {
                showToast('Arquivo inválido!', 'error');
            }
        } catch {
            showToast('Erro ao ler o arquivo!', 'error');
        }
    };
    reader.readAsText(file);
}

// ─── EVENT LISTENERS ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderAll();

    // Navegação de meses
    document.getElementById('btnPrevMonth').addEventListener('click', () => {
        APP_STATE.currentMonth--;
        if (APP_STATE.currentMonth < 0) {
            APP_STATE.currentMonth = 11;
            APP_STATE.currentYear--;
        }
        renderAll();
    });

    document.getElementById('btnNextMonth').addEventListener('click', () => {
        APP_STATE.currentMonth++;
        if (APP_STATE.currentMonth > 11) {
            APP_STATE.currentMonth = 0;
            APP_STATE.currentYear++;
        }
        renderAll();
    });

    // Abrir modal
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', () => {
            openModal(btn.dataset.type);
        });
    });

    // Fechar modal
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Salvar formulário
    document.getElementById('itemForm').addEventListener('submit', saveItem);

    // Máscara de moeda
    document.getElementById('itemAmount').addEventListener('input', function (e) {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value) {
            value = (parseInt(value) / 100).toFixed(2);
            e.target.value = value.replace('.', ',');
        }
    });

    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP_STATE.currentFilter = btn.dataset.filter;
            renderItems('expense');
        });
    });

    // Exportar
    document.getElementById('btnExport').addEventListener('click', exportData);

    // Importar
    document.getElementById('btnImport').addEventListener('click', () => {
        document.getElementById('fileImport').click();
    });
    document.getElementById('fileImport').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });

    // Teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Redimensionar gráfico
    window.addEventListener('resize', () => {
        clearTimeout(window._resizeTimer);
        window._resizeTimer = setTimeout(renderChart, 200);
    });
});
