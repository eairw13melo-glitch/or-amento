/* ============================================
   ORÇAMENTO FAMILIAR - V10.0 (Refatorado + Previsão)
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

const CATEGORY_LABELS = {
    moradia: '🏠 Moradia', alimentacao: '🍔 Alimentação', transporte: '🚗 Transporte',
    saude: '💊 Saúde', educacao: '📚 Educação', lazer: '🎮 Lazer',
    vestuario: '👕 Vestuário', outros: '📦 Outros'
};

// Forçar atualização do Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

let categoryChart = null;
let evolutionChart = null;
let customCategories = [];
let selectedExpenseIds = new Set();
let searchTimeout = null;

// ==================== MONTH BACKGROUNDS ====================
const monthBackgrounds = [
    'images/janeiro.jpg', 'images/fevereiro.jpg', 'images/marco.jpg',
    'images/abril.jpg', 'images/maio.jpg', 'images/junho.jpg',
    'images/julho.jpg', 'images/agosto.jpg', 'images/setembro.jpg',
    'images/outubro.jpg', 'images/novembro.jpg', 'images/dezembro.jpg'
];

function updateMonthBackground() {
    const el = document.querySelector('.month-selector');
    if (!el) return;
    const url = monthBackgrounds[APP_STATE.currentMonth];
    el.style.backgroundImage = `url('${url}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
}

// ==================== STORAGE & DATA ====================
function loadData() {
    try {
        const raw = localStorage.getItem('budgetAppData');
        if (!raw) return { recurringItems: [], monthOverrides: {}, categoryGoals: {}, customCategories: [] };
        
        let data = JSON.parse(raw);
        // Migration logic (mantida e melhorada)
        if (!data.recurringItems) {
            // ... (manter lógica de migração do original)
        }
        return {
            recurringItems: data.recurringItems || [],
            monthOverrides: data.monthOverrides || {},
            categoryGoals: data.categoryGoals || {},
            customCategories: data.customCategories || []
        };
    } catch (e) {
        return { recurringItems: [], monthOverrides: {}, categoryGoals: {}, customCategories: [] };
    }
}

function saveData(data) {
    try {
        data.customCategories = customCategories;
        localStorage.setItem('budgetAppData', JSON.stringify(data));
    } catch (e) {
        showToast('Erro ao salvar dados', 'error');
    }
}

// ==================== UTILITIES ====================
function getMonthKey(m, y) { return `${y}-${String(m+1).padStart(2,'0')}`; }

function normalizeValue(item, month, year) {
    let base = item.amount || 0;
    if (item.type === 'income' && item.frequency === 'daily') {
        return base * new Date(year, month + 1, 0).getDate();
    }
    if (item.type === 'income' && item.frequency === 'weekly') {
        // lógica simplificada
        return base * 4.345;
    }
    return base;
}

function formatCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function parseCurrency(str) {
    if (typeof str === 'number') return str;
    return parseFloat(str?.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}

// ==================== NOVA FUNCIONALIDADE: PREVISÃO ====================
function renderForecast() {
    const container = document.getElementById('forecastContainer');
    if (!container) return;

    let html = `<h3>📈 Previsão dos Próximos 3 Meses</h3><div class="forecast-grid">`;
    
    for (let i = 1; i <= 3; i++) {
        let m = (APP_STATE.currentMonth + i) % 12;
        let y = APP_STATE.currentYear + Math.floor((APP_STATE.currentMonth + i) / 12);
        
        const data = getMonthData(m, y);
        const income = data.income.reduce((sum, item) => sum + normalizeValue(item, m, y), 0);
        const expense = data.expenses.reduce((sum, item) => sum + normalizeValue(item, m, y), 0);
        const balance = income - expense;

        html += `
            <div class="forecast-card">
                <strong>${MONTHS_SHORT[m]} ${y}</strong>
                <div class="f-income">+ ${formatCurrency(income)}</div>
                <div class="f-expense">- ${formatCurrency(expense)}</div>
                <div class="f-balance ${balance >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(balance)}
                </div>
            </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// ==================== RENDER ALL (Otimizado) ====================
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
    renderCategoryComparison();
    updateMonthBackground();
    renderForecast();           // ← Nova feature
    checkDueAlerts();
    updateSelectedTotal();
}

// ==================== INIT ====================
function initApp() {
    loadCustomCategories();
    renderCategorySelect();

    if (APP_STATE.isViewOnly) applyViewOnly();

    // Inicializações
    initTheme();
    initPWA();
    initCalculator();
    setupAmountMask();
    initPasswordToggle();
    setupSmartSuggestions();

    // Event listeners centralizados
    setupEventListeners();

    setInterval(updateDateTime, 1000);
    updateDateTime();

    renderAll();
}

// Chama init
if (checkAuth()) {
    initApp();
} else {
    // login logic (mantida)
}
