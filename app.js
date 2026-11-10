import { FinanceAuthAndStorageService, DEFAULT_FIREBASE_CONFIG } from './firebase-service.js';

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const todayISO = () => new Date().toISOString().split('T')[0];

const DEFAULT_FONT_SETTINGS = {
  titles: 20,
  body: 14,
  buttons: 14,
  inputs: 15,
  numbers: 25
};

const DEFAULT_COLOR_SETTINGS = {
  accent: '#10b981',
  btnText: '#042f2e',
  bgPrimary: '#0f1419',
  bgSecondary: '#161d24',
  bgCard: '#1c252e',
  bgInput: '#131920',
  textPrimary: '#f3f6f9',
  textSecondary: '#9fb0c2'
};

const COLOR_PRESETS = {
  default: { ...DEFAULT_COLOR_SETTINGS },
  ocean: {
    accent: '#38bdf8',
    btnText: '#082f49',
    bgPrimary: '#0b1322',
    bgSecondary: '#111c30',
    bgCard: '#17253f',
    bgInput: '#0d1729',
    textPrimary: '#f0f9ff',
    textSecondary: '#94a3b8'
  },
  purple: {
    accent: '#a855f7',
    btnText: '#ffffff',
    bgPrimary: '#120d1d',
    bgSecondary: '#1a132b',
    bgCard: '#231a38',
    bgInput: '#150f24',
    textPrimary: '#faf5ff',
    textSecondary: '#c4b5fd'
  },
  ruby: {
    accent: '#f43f5e',
    btnText: '#ffffff',
    bgPrimary: '#180e12',
    bgSecondary: '#22141a',
    bgCard: '#2d1b22',
    bgInput: '#1c1015',
    textPrimary: '#fff1f2',
    textSecondary: '#fda4af'
  },
  light: {
    accent: '#059669',
    btnText: '#ffffff',
    bgPrimary: '#f1f5f9',
    bgSecondary: '#ffffff',
    bgCard: '#ffffff',
    bgInput: '#f8fafc',
    textPrimary: '#0f172a',
    textSecondary: '#475569'
  }
};

const FONT_STORAGE_KEY = 'app_financeiro_font_settings';
const COLOR_STORAGE_KEY = 'app_financeiro_color_settings';
const STAY_CONNECTED_PREFIX = 'app_financeiro_stay_connected_';
const SESSION_VERIFIED_PREFIX = 'app_financeiro_2fa_session_';

function hexToRgba(hex, alpha) {
  const clean = String(hex || '#10b981').replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLightHex(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function loadCachedFontSettings() {
  try {
    const raw = localStorage.getItem(FONT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FONT_SETTINGS, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_FONT_SETTINGS };
}

function loadCachedColorSettings() {
  try {
    const raw = localStorage.getItem(COLOR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_COLOR_SETTINGS, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_COLOR_SETTINGS };
}

function applyFontSettings(fontCfg) {
  const cfg = { ...DEFAULT_FONT_SETTINGS, ...(fontCfg || {}) };
  const root = document.documentElement;
  root.style.setProperty('--fs-titles', `${cfg.titles}px`);
  root.style.setProperty('--fs-body', `${cfg.body}px`);
  root.style.setProperty('--fs-buttons', `${cfg.buttons}px`);
  root.style.setProperty('--fs-inputs', `${cfg.inputs}px`);
  root.style.setProperty('--fs-numbers', `${cfg.numbers}px`);

  try {
    localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(cfg));
  } catch (_) {}

  const keys = ['titles', 'body', 'buttons', 'inputs', 'numbers'];
  keys.forEach((key) => {
    const slider = document.getElementById(`font-slider-${key}`);
    const badge = document.getElementById(`font-val-${key}`);
    const preview = document.getElementById(`font-preview-${key}`);
    if (slider) slider.value = cfg[key];
    if (badge) badge.textContent = `${cfg[key]}px`;
    if (preview) preview.style.fontSize = `${cfg[key]}px`;
  });
}

function applyColorSettings(colorCfg) {
  const cfg = { ...DEFAULT_COLOR_SETTINGS, ...(colorCfg || {}) };
  const root = document.documentElement;
  root.style.setProperty('--emerald', cfg.accent);
  root.style.setProperty('--emerald-soft', hexToRgba(cfg.accent, 0.16));
  root.style.setProperty('--border-focus', hexToRgba(cfg.accent, 0.5));
  root.style.setProperty('--btn-primary-text', cfg.btnText);
  root.style.setProperty('--bg-primary', cfg.bgPrimary);
  root.style.setProperty('--bg-secondary', cfg.bgSecondary);
  root.style.setProperty('--bg-card', cfg.bgCard);
  root.style.setProperty('--bg-card-hover', cfg.bgCard);
  root.style.setProperty('--bg-elevated', cfg.bgSecondary);
  root.style.setProperty('--bg-input', cfg.bgInput);
  root.style.setProperty('--text-primary', cfg.textPrimary);
  root.style.setProperty('--text-secondary', cfg.textSecondary);
  root.style.setProperty('--text-muted', cfg.textSecondary);

  const lightMode = isLightHex(cfg.bgCard);
  root.style.setProperty('--gear-icon-color', lightMode ? '#000000' : '#ffffff');
  root.style.setProperty('--border-subtle', lightMode ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)');

  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(cfg));
  } catch (_) {}

  const colorKeys = ['accent', 'btnText', 'bgPrimary', 'bgSecondary', 'bgCard', 'bgInput', 'textPrimary', 'textSecondary'];
  colorKeys.forEach((key) => {
    const picker = document.getElementById(`color-picker-${key}`);
    const badge = document.getElementById(`color-val-${key}`);
    if (picker) picker.value = cfg[key];
    if (badge) badge.textContent = cfg[key];
  });
}

const getInitialSeedData = () => {
  return {
    incomes: [],
    cards: [],
    cardExpenses: [],
    pixExpenses: [],
    debts: [],
    vaultGoals: [],
    vaultMovements: [],
    recurringIncomes: [],
    fontSettings: loadCachedFontSettings(),
    colorSettings: loadCachedColorSettings()
  };
};

// State
let state = getInitialSeedData();
let selectedMonth = currentMonthKey();
let pieMode = 'origin'; // 'origin' | 'category'
let activeUser = null;
let activeProfile = null;
let pendingAuthFlow = false;
let currentVerificationCode = '';
let forgotPasswordCodeVerified = false;

// Service de Autenticação e Firestore
const authService = new FinanceAuthAndStorageService(
  (user, profile) => {
    activeUser = user;
    activeProfile = profile;
    handleAuthChange(user, profile);
  },
  (remoteData) => {
    if (remoteData) {
      state = {
        incomes: remoteData.incomes || [],
        cards: remoteData.cards || [],
        cardExpenses: remoteData.cardExpenses || [],
        pixExpenses: remoteData.pixExpenses || [],
        debts: remoteData.debts || [],
        vaultGoals: remoteData.vaultGoals || [],
        vaultMovements: remoteData.vaultMovements || [],
        recurringIncomes: remoteData.recurringIncomes || [],
        fontSettings: { ...DEFAULT_FONT_SETTINGS, ...(remoteData.fontSettings || loadCachedFontSettings()) },
        colorSettings: { ...DEFAULT_COLOR_SETTINGS, ...(remoteData.colorSettings || loadCachedColorSettings()) }
      };
      applyFontSettings(state.fontSettings);
      applyColorSettings(state.colorSettings);
      renderAll();
    }
  }
);

async function persistAndRender() {
  if (activeUser) {
    await authService.saveUserData(activeUser.uid, state);
  }
  renderAll();
}

// Formatters
const formatBRL = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatMonthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function generateAndShowVerificationCode(channel, destinationLabel, feedbackEl) {
  currentVerificationCode = String(Math.floor(100000 + Math.random() * 900000));
  const channelNames = {
    whatsapp: 'WhatsApp',
    gmail: 'Gmail',
    sms: 'SMS'
  };
  const chLabel = channelNames[channel] || 'Canal';
  const toast = document.getElementById('code-dispatch-toast');
  const toastChannel = document.getElementById('code-toast-channel');
  const toastDesc = document.getElementById('code-toast-desc');
  const toastVal = document.getElementById('code-toast-value');
  const copyBtn = document.getElementById('copy-code-toast-btn');

  if (toast && toastVal) {
    toastChannel.textContent = `Código enviado no ${chLabel}`;
    toastDesc.textContent = destinationLabel
      ? `Enviado para ${destinationLabel}. Copie e cole o código abaixo:`
      : `Copie e cole o código de 6 dígitos abaixo para confirmar:`;
    toastVal.textContent = currentVerificationCode;
    if (copyBtn) copyBtn.textContent = 'Copiar Código';
    toast.style.display = 'block';
  }

  if (feedbackEl) {
    feedbackEl.textContent = `Código enviado no ${chLabel}! Copie o código acima e cole no campo.`;
    feedbackEl.style.color = 'var(--emerald)';
  }
  return currentVerificationCode;
}

function showAuthStep(stepName) {
  const tabsBar = document.getElementById('auth-tabs-bar');
  const formLogin = document.getElementById('form-auth-login');
  const formReg = document.getElementById('form-auth-register');
  const step2fa = document.getElementById('auth-step-2fa');
  const stepStay = document.getElementById('auth-step-stay');
  const stepForgot = document.getElementById('auth-step-forgot');
  const subtitle = document.getElementById('auth-subtitle');

  if (tabsBar) tabsBar.style.display = stepName === 'login' || stepName === 'register' ? 'grid' : 'none';
  if (formLogin) formLogin.style.display = stepName === 'login' ? 'flex' : 'none';
  if (formReg) formReg.style.display = stepName === 'register' ? 'flex' : 'none';
  if (step2fa) step2fa.style.display = stepName === '2fa' ? 'flex' : 'none';
  if (stepStay) stepStay.style.display = stepName === 'stay' ? 'flex' : 'none';
  if (stepForgot) stepForgot.style.display = stepName === 'forgot' ? 'flex' : 'none';

  if (subtitle) {
    if (stepName === 'login') subtitle.textContent = 'Entre na sua conta para acessar seu painel';
    else if (stepName === 'register') subtitle.textContent = 'Preencha seus dados e WhatsApp para criar sua conta';
    else if (stepName === '2fa') subtitle.textContent = 'Segunda verificação de segurança';
    else if (stepName === 'stay') subtitle.textContent = 'Preferência de conexão neste dispositivo';
    else if (stepName === 'forgot') subtitle.textContent = 'Recuperação de senha com código de verificação';
  }
}

function unlockAuthenticatedApp(user, profile) {
  const overlay = document.getElementById('auth-overlay');
  const badge = document.getElementById('user-profile-badge');
  const nameEl = document.getElementById('user-display-name');
  const firebaseStatusDot = document.getElementById('firebase-status-dot');
  const firebaseStatusText = document.getElementById('firebase-status-text');
  const toast = document.getElementById('code-dispatch-toast');

  if (toast) toast.style.display = 'none';
  overlay.classList.add('hidden');
  badge.style.display = 'flex';
  const displayName = (profile && profile.name) || user.displayName || 'Usuário';
  nameEl.textContent = displayName;

  firebaseStatusDot.classList.add('connected');
  firebaseStatusText.textContent = user.email || '';

  state = authService.loadUserData(user.uid, getInitialSeedData());
  state.fontSettings = { ...DEFAULT_FONT_SETTINGS, ...(state.fontSettings || loadCachedFontSettings()) };
  state.colorSettings = { ...DEFAULT_COLOR_SETTINGS, ...(state.colorSettings || loadCachedColorSettings()) };
  applyFontSettings(state.fontSettings);
  applyColorSettings(state.colorSettings);
  renderAll();
}

function handleAuthChange(user, profile) {
  const overlay = document.getElementById('auth-overlay');
  const badge = document.getElementById('user-profile-badge');
  const firebaseStatusDot = document.getElementById('firebase-status-dot');
  const firebaseStatusText = document.getElementById('firebase-status-text');

  if (user) {
    // Se o fluxo manual de Login/Registro estiver conduzindo o 2FA, aguarda confirmação do usuário
    if (pendingAuthFlow) return;

    const stayPref = localStorage.getItem(`${STAY_CONNECTED_PREFIX}${user.uid}`);
    const sessionVerified = sessionStorage.getItem(`${SESSION_VERIFIED_PREFIX}${user.uid}`) === 'true';

    // Se o usuário escolheu "Permanecer" anteriormente ou já verificou nesta sessão, entra direto sem pedir 2FA
    if (stayPref === 'true' || sessionVerified) {
      unlockAuthenticatedApp(user, profile);
    } else {
      // Se escolheu "Não manter conectado", exige a dupla verificação ao conectar
      overlay.classList.remove('hidden');
      const codeInput = document.getElementById('auth-2fa-code');
      const fb = document.getElementById('auth-2fa-feedback');
      if (codeInput) codeInput.value = '';
      if (fb) fb.textContent = '';
      showAuthStep('2fa');
      generateAndShowVerificationCode('gmail', user.email || '', fb);
    }
  } else {
    overlay.classList.remove('hidden');
    showAuthStep('login');
    badge.style.display = 'none';
    firebaseStatusDot.classList.remove('connected');
    firebaseStatusText.textContent = 'Não autenticado';
  }
}

// Verifica se um dia de vencimento no mês selecionado está atrasado ou próximo (<= 5 dias)
function checkDueStatus(dueDay, ym, isResolved) {
  if (isResolved) return { isNearOrOverdue: false, isOverdue: false, label: 'Quitado no mês' };
  const day = Number(dueDay) || 10;
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayDay = now.getDate();

  if (ym < curYm) {
    return { isNearOrOverdue: true, isOverdue: true, daysDiff: -1, label: `Atrasado (Venc. dia ${String(day).padStart(2, '0')})` };
  }
  if (ym > curYm) {
    return { isNearOrOverdue: false, isOverdue: false, daysDiff: 30, label: `Vence dia ${String(day).padStart(2, '0')}` };
  }
  const diff = day - todayDay;
  if (diff < 0) {
    return { isNearOrOverdue: true, isOverdue: true, daysDiff: diff, label: `Atrasado há ${Math.abs(diff)} dia(s) (Dia ${String(day).padStart(2, '0')})` };
  }
  if (diff === 0) {
    return { isNearOrOverdue: true, isOverdue: true, daysDiff: 0, label: `Vence HOJE (Dia ${String(day).padStart(2, '0')})` };
  }
  if (diff <= 5) {
    return { isNearOrOverdue: true, isOverdue: false, daysDiff: diff, label: `Vence em ${diff} dia(s) (Dia ${String(day).padStart(2, '0')})` };
  }
  return { isNearOrOverdue: false, isOverdue: false, daysDiff: diff, label: `Dia ${String(day).padStart(2, '0')}` };
}

// ===== Salário Recorrente =====
// Calcula o N-ésimo dia útil (seg–sex) do mês. Não considera feriados.
function nthBusinessDay(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    if (wd !== 0 && wd !== 6) {
      count++;
      if (count === n) return d;
    }
  }
  return lastDay;
}

function recurringDateFor(rec, ym) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = rec.ruleType === 'businessDay'
    ? nthBusinessDay(ym, Number(rec.day) || 5)
    : Math.min(Number(rec.day) || 1, lastDay);
  return `${ym}-${String(day).padStart(2, '0')}`;
}

function ruleLabel(rec) {
  return rec.ruleType === 'businessDay' ? `Todo ${rec.day}º dia útil` : `Todo dia ${rec.day}`;
}

// Gera as entradas do mês a partir das recorrências (não remove nada sozinho:
// ajustes e pulos são sempre feitos manualmente pelo usuário)
function getRecurringIncomesFor(ym) {
  const list = Array.isArray(state.recurringIncomes) ? state.recurringIncomes : [];
  return list
    .filter((r) => !r.startMonth || ym >= r.startMonth)
    .filter((r) => !r.endMonth || ym <= r.endMonth)
    .map((r) => {
      const overrides = r.overrides || {};
      const skipped = Array.isArray(r.skippedMonths) && r.skippedMonths.includes(ym);
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, ym);
      const amount = skipped ? 0 : hasOverride ? Number(overrides[ym]) : Number(r.amount);
      return {
        id: `rec-${r.id}-${ym}`,
        recurringId: r.id,
        description: r.description,
        category: r.category || 'Salário',
        date: recurringDateFor(r, ym),
        month: ym,
        amount,
        baseAmount: Number(r.amount),
        isRecurring: true,
        skipped,
        adjusted: hasOverride && !skipped,
        rule: ruleLabel(r)
      };
    });
}

function getMonthSummary(ym) {
  const incomes = [
    ...getRecurringIncomesFor(ym),
    ...state.incomes.filter((i) => i.month === ym)
  ];
  const pixExpenses = state.pixExpenses.filter((p) => p.month === ym);
  const cardExpenses = state.cardExpenses.filter((c) => c.month === ym);
  const cardCreditExpenses = cardExpenses.filter((c) => c.mode !== 'debit');
  const cardDebitExpenses = cardExpenses.filter((c) => c.mode === 'debit');

  // Movimentações de depósito nas Caixinhas (Cofrinho) confirmadas pelo usuário neste mês
  const vaultMovementsMonth = (state.vaultMovements || []).filter((m) => {
    const mMonth = m.month || (m.date ? m.date.slice(0, 7) : '');
    return mMonth === ym;
  });
  const vaultDepositsMonth = vaultMovementsMonth.filter((m) => m.type === 'deposit');
  const totalVaultMonth = vaultDepositsMonth.reduce((acc, m) => acc + Number(m.amount || 0), 0);

  // Auto preenchimento mensal de dívidas ativas:
  // Se a dívida dura N meses (ex: 10 meses a partir do mês X),
  // ela aparece em todo mês do intervalo até ser quitada 100% ou excluída.
  const activeDebts = state.debts.filter((d) => {
    const remaining = Math.max(0, Number(d.totalAmount || 0) - Number(d.paidAmount || 0));
    if (remaining <= 0 || d.status === 'Quitada') return false;

    if (d.startMonth) {
      if (ym < d.startMonth) return false;
      if (d.totalMonths && Number(d.totalMonths) > 0) {
        const [sy, sm] = d.startMonth.split('-').map(Number);
        const [cy, cm] = ym.split('-').map(Number);
        const diffMonths = (cy - sy) * 12 + (cm - sm);
        if (diffMonths >= Number(d.totalMonths)) return false;
      }
    }
    return d.includeInCycle !== false;
  });

  const totalIncome = incomes.reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const totalPixOnly = pixExpenses.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalCardDebit = cardDebitExpenses.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  // Gastos fora da fatura de crédito: Pix/Dinheiro + Cartão na função Débito
  const totalPix = totalPixOnly + totalCardDebit;
  const totalCards = cardCreditExpenses.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const totalDebtMonth = activeDebts.reduce((acc, d) => acc + Number(d.monthlyInstallment || 0), 0);

  // O valor depositado no Cofrinho no mês (após confirmação do usuário) é descontado do valor bruto
  const totalExpenses = totalPix + totalCards + totalDebtMonth + totalVaultMonth;
  const freeBalance = totalIncome - totalExpenses;

  return {
    incomes,
    pixExpenses,
    cardExpenses,
    cardCreditExpenses,
    cardDebitExpenses,
    vaultDepositsMonth,
    activeDebts,
    totalIncome,
    totalPix,
    totalPixOnly,
    totalCardDebit,
    totalCards,
    totalDebtMonth,
    totalVaultMonth,
    totalExpenses,
    freeBalance
  };
}

// Build Pie Slices where Total Income = 100% of the Pie Chart (or Total Expenses if Income is exceeded)
function buildPieData(summary) {
  const { totalIncome, totalPix, totalCards, totalDebtMonth, totalVaultMonth, totalExpenses, freeBalance, pixExpenses, cardExpenses, activeDebts } = summary;
  const maxRef = Math.max(totalIncome, totalExpenses, 1);

  if (pieMode === 'origin') {
    const slices = [
      { label: 'Gastos Fora de Cartão (Pix / Dinheiro / Débito)', value: totalPix, color: '#0ea5e9', type: 'expense' },
      { label: 'Faturas de Cartões (Crédito)', value: totalCards, color: '#f59e0b', type: 'expense' },
      { label: 'Dívidas / Parcelas do Mês', value: totalDebtMonth, color: '#f43f5e', type: 'expense' },
      { label: 'Guardado nas Caixinhas (Cofrinho)', value: totalVaultMonth, color: '#14b8a6', type: 'saving' }
    ].filter((s) => s.value > 0);

    if (freeBalance > 0) {
      slices.push({
        label: 'Lucro Livre (Disponível)',
        value: freeBalance,
        color: '#10b981',
        type: 'profit'
      });
    }

    return { maxRef, slices };
  } else {
    // Group by category
    const catMap = {};
    const palette = ['#0ea5e9', '#f59e0b', '#f97316', '#14b8a6', '#eab308', '#ec4899', '#3b82f6'];

    pixExpenses.forEach((p) => {
      catMap[p.category] = (catMap[p.category] || 0) + Number(p.amount || 0);
    });
    cardExpenses.forEach((c) => {
      catMap[c.category] = (catMap[c.category] || 0) + Number(c.amount || 0);
    });
    if (totalDebtMonth > 0) {
      catMap['Dívidas / Acordos'] = (catMap['Dívidas / Acordos'] || 0) + totalDebtMonth;
    }
    if (totalVaultMonth > 0) {
      catMap['Cofrinho / Caixinhas'] = (catMap['Cofrinho / Caixinhas'] || 0) + totalVaultMonth;
    }

    const slices = Object.entries(catMap)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val], idx) => ({
        label: cat,
        value: val,
        color: cat === 'Dívidas / Acordos' ? '#f43f5e' : cat === 'Cofrinho / Caixinhas' ? '#14b8a6' : palette[idx % palette.length],
        type: 'expense'
      }));

    if (freeBalance > 0) {
      slices.push({
        label: 'Lucro Livre (Disponível)',
        value: freeBalance,
        color: '#10b981',
        type: 'profit'
      });
    }

    return { maxRef, slices };
  }
}

// SVG Pie / Donut Path Helper
function renderPieSVG(summary) {
  const svg = document.getElementById('cycle-pie-svg');
  const legendContainer = document.getElementById('cycle-pie-legend');
  const centerLabel = document.getElementById('pie-center-label');
  const centerValue = document.getElementById('pie-center-value');
  const centerSub = document.getElementById('pie-center-sub');
  const deficitBanner = document.getElementById('deficit-banner');

  const { totalIncome, totalExpenses, freeBalance } = summary;
  const { maxRef, slices } = buildPieData(summary);

  // Show/hide deficit alert
  if (totalExpenses > totalIncome && totalIncome > 0) {
    deficitBanner.style.display = 'flex';
    deficitBanner.innerHTML = `
      <strong>Atenção:</strong> Seus gastos deste mês (${formatBRL(totalExpenses)}) ultrapassaram suas entradas (${formatBRL(totalIncome)}) em <strong>${formatBRL(totalExpenses - totalIncome)}</strong>.
    `;
  } else {
    deficitBanner.style.display = 'none';
  }

  // Default center text: shows Total Income (the maximum scale of the chart) and remaining profit
  const setDefaultCenter = () => {
    centerLabel.textContent = 'Entradas (Teto 100%)';
    centerValue.textContent = formatBRL(totalIncome);
    if (totalIncome === 0 && totalExpenses === 0) {
      centerSub.textContent = 'Sem lançamentos';
      centerSub.style.color = 'var(--text-muted)';
    } else if (freeBalance >= 0) {
      const pctFree = totalIncome > 0 ? Math.round((freeBalance / totalIncome) * 100) : 0;
      centerSub.textContent = `Livre: ${formatBRL(freeBalance)} (${pctFree}%)`;
      centerSub.style.color = 'var(--emerald)';
    } else {
      centerSub.textContent = `Déficit: ${formatBRL(freeBalance)}`;
      centerSub.style.color = 'var(--coral)';
    }
  };

  setDefaultCenter();

  if (slices.length === 0) {
    svg.innerHTML = `
      <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="28"></circle>
    `;
    legendContainer.innerHTML = `<div class="empty-state">Adicione suas entradas e gastos para visualizar o ciclo completo no gráfico de pizza.</div>`;
    return;
  }

  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPct = 0;

  svg.innerHTML = '';

  slices.forEach((slice, index) => {
    const pct = slice.value / maxRef;
    const strokeDasharray = `${Math.max(pct * circumference - 2, 1)} ${circumference}`;
    const strokeDashoffset = -accumulatedPct * circumference;
    accumulatedPct += pct;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '100');
    circle.setAttribute('r', String(radius));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', slice.color);
    circle.setAttribute('stroke-width', '30');
    circle.setAttribute('stroke-dasharray', strokeDasharray);
    circle.setAttribute('stroke-dashoffset', String(strokeDashoffset));
    circle.setAttribute('class', 'pie-slice');

    const pctOfIncome = totalIncome > 0 ? ((slice.value / totalIncome) * 100).toFixed(1) : ((slice.value / maxRef) * 100).toFixed(1);

    circle.addEventListener('mouseenter', () => {
      centerLabel.textContent = slice.label;
      centerValue.textContent = formatBRL(slice.value);
      centerSub.textContent = `${pctOfIncome}% do seu ganho`;
      centerSub.style.color = slice.color;
    });

    circle.addEventListener('mouseleave', () => {
      setDefaultCenter();
    });

    svg.appendChild(circle);
  });

  // Render Legend
  legendContainer.innerHTML = slices
    .map((slice) => {
      const pctOfIncome = totalIncome > 0 ? Math.min(100, (slice.value / totalIncome) * 100) : (slice.value / maxRef) * 100;
      const pctLabel = totalIncome > 0 ? ((slice.value / totalIncome) * 100).toFixed(1) : ((slice.value / maxRef) * 100).toFixed(1);
      return `
        <div class="legend-item">
          <div class="legend-row">
            <div class="legend-name">
              <span class="legend-swatch" style="background-color: ${slice.color}"></span>
              <span>${slice.label}</span>
            </div>
            <div class="legend-values">
              <span>${formatBRL(slice.value)}</span>
              <span class="legend-pct">${pctLabel}%</span>
            </div>
          </div>
          <div class="legend-bar-track">
            <div class="legend-bar-fill" style="width: ${pctOfIncome}%; background-color: ${slice.color}"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Renderiza os novos containers (mesmo padrão dos KPIs) em ordem de data prevista de pagamento
// (Cartões, Dívidas & Acordos, Caixinhas do Cofrinho e Pix / Dinheiro), destacando em vermelho os próximos de vencer ou atrasados
function renderDueScheduleCards(summary) {
  const grid = document.getElementById('due-schedule-grid');
  const countBadge = document.getElementById('schedule-count-badge');
  if (!grid) return;

  const items = [];

  // 1. Faturas de Cartões (usa o dia de pagamento/vencimento da fatura)
  state.cards.forEach((card) => {
    const creditItems = summary.cardExpenses.filter((ce) => ce.cardId === card.id && ce.mode !== 'debit');
    const debitItems = summary.cardExpenses.filter((ce) => ce.cardId === card.id && ce.mode === 'debit');
    const invoiceAmount = creditItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const debitAmount = debitItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const dueDay = Number(card.dueDay) || 12;
    const isPaid = Array.isArray(card.paidMonths) && card.paidMonths.includes(selectedMonth);
    const status = checkDueStatus(dueDay, selectedMonth, isPaid || invoiceAmount <= 0);

    items.push({
      id: `sched-card-${card.id}`,
      day: dueDay,
      dateText: `Vencimento: Dia ${String(dueDay).padStart(2, '0')}`,
      typeLabel: 'Fatura de Cartão',
      icon: '&#128179;',
      iconClass: 'cards',
      title: card.name,
      amount: invoiceAmount,
      extraSub:
        invoiceAmount <= 0
          ? debitAmount > 0
            ? `Sem fatura crédito • Débito: ${formatBRL(debitAmount)}`
            : 'Fatura zerada neste mês'
          : isPaid
            ? '✓ Fatura marcada como Paga'
            : status.label,
      isUrgent: status.isNearOrOverdue && invoiceAmount > 0 && !isPaid,
      isPaid: isPaid || invoiceAmount <= 0,
      targetTab: 'cards-view',
      actionLabel: 'Abrir Cartões'
    });
  });

  // 2. Dívidas e Acordos ativos no mês (usa o dia de vencimento da parcela)
  summary.activeDebts.forEach((d) => {
    const dueDay = Number(d.dueDay) || 10;
    const paidMonthsList = Array.isArray(d.paidMonths) ? d.paidMonths : [];
    const isPaid = paidMonthsList.includes(selectedMonth);
    const status = checkDueStatus(dueDay, selectedMonth, isPaid);
    const remaining = Math.max(0, Number(d.totalAmount || 0) - Number(d.paidAmount || 0));

    items.push({
      id: `sched-debt-${d.id}`,
      day: dueDay,
      dateText: `Vencimento: Dia ${String(dueDay).padStart(2, '0')}`,
      typeLabel: 'Dívida / Acordo',
      icon: '&#128196;',
      iconClass: 'debt',
      title: d.creditor,
      amount: Number(d.monthlyInstallment || 0),
      extraSub: isPaid
        ? `✓ Parcela paga • Resta ${formatBRL(remaining)}`
        : `${status.label} • Resta ${formatBRL(remaining)}`,
      isUrgent: status.isNearOrOverdue && !isPaid,
      isPaid,
      targetTab: 'debts-view',
      actionLabel: isPaid ? 'Ver Dívida' : 'Pagar / Ver'
    });
  });

  // 3. Caixinhas do Cofrinho (usa o dia limite mensal de depósito)
  const goals = Array.isArray(state.vaultGoals) ? state.vaultGoals : [];
  goals.forEach((g) => {
    const minMonthly = Number(g.minMonthly || 0);
    const dueDay = Number(g.dueDay) || 10;
    const depositedInMonth = summary.vaultDepositsMonth
      .filter((m) => m.goalId === g.id)
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
    const isFulfilled = minMonthly > 0 ? depositedInMonth >= minMonthly : depositedInMonth > 0;
    const status = checkDueStatus(dueDay, selectedMonth, isFulfilled);
    const missing = Math.max(0, minMonthly - depositedInMonth);

    items.push({
      id: `sched-vault-${g.id}`,
      day: dueDay,
      dateText: `Data Limite: Dia ${String(dueDay).padStart(2, '0')}`,
      typeLabel: 'Caixinha / Cofrinho',
      icon: '&#128176;',
      iconClass: 'income',
      title: g.name,
      amount: minMonthly > 0 ? minMonthly : depositedInMonth,
      extraSub: isFulfilled
        ? `✓ Guardado no mês: ${formatBRL(depositedInMonth)}`
        : `${status.label} • Falta ${formatBRL(missing)}`,
      isUrgent: status.isNearOrOverdue && !isFulfilled,
      isPaid: isFulfilled,
      targetTab: 'vault-view',
      actionLabel: isFulfilled ? 'Ver Caixinha' : 'Guardar no Mês'
    });
  });

  // 4. Gastos no Pix / Dinheiro / Cartão Débito do mês (ordenados pelo dia do pagamento)
  summary.pixExpenses.forEach((p) => {
    const day = p.date ? parseInt(p.date.split('-')[2], 10) || 1 : 1;
    const fmtDate = p.date ? p.date.split('-').reverse().join('/') : `Dia ${String(day).padStart(2, '0')}`;
    items.push({
      id: `sched-pix-${p.id}`,
      day,
      dateText: `Data: ${fmtDate}`,
      typeLabel: `Pix / Dinheiro (${p.category || 'Gasto'})`,
      icon: '&#9889;',
      iconClass: 'pix',
      title: p.description,
      amount: Number(p.amount || 0),
      extraSub: p.recipient ? `Meio/Dest.: ${p.recipient}` : 'Pago à vista fora de cartão',
      isUrgent: false,
      isPaid: true,
      targetTab: 'pix-view',
      actionLabel: 'Ver Pix / Dinheiro'
    });
  });

  summary.cardDebitExpenses.forEach((cd) => {
    const card = state.cards.find((c) => c.id === cd.cardId);
    const day = cd.date ? parseInt(cd.date.split('-')[2], 10) || 1 : 1;
    const fmtDate = cd.date ? cd.date.split('-').reverse().join('/') : `Dia ${String(day).padStart(2, '0')}`;
    items.push({
      id: `sched-debit-${cd.id}`,
      day,
      dateText: `Data: ${fmtDate}`,
      typeLabel: `Cartão Débito (${card ? card.name : 'Cartão'})`,
      icon: '&#128179;',
      iconClass: 'pix',
      title: cd.description,
      amount: Number(cd.amount || 0),
      extraSub: `Categoria: ${cd.category || 'Outros'} • Débito à vista`,
      isUrgent: false,
      isPaid: true,
      targetTab: 'cards-view',
      actionLabel: 'Ver no Cartão'
    });
  });

  // Ordena por data prevista de pagamento (dia do mês crescente: dia 1 -> dia 31),
  // mantendo urgentes no topo em caso de empate no mesmo dia
  items.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    return 0;
  });

  if (countBadge) {
    const urgentCount = items.filter((i) => i.isUrgent).length;
    countBadge.textContent =
      urgentCount > 0 ? `${items.length} item(ns) • ${urgentCount} em alerta !` : `${items.length} item(ns) por ordem de data`;
    countBadge.style.color = urgentCount > 0 ? '#fecdd3' : '';
    countBadge.style.backgroundColor = urgentCount > 0 ? 'rgba(244, 63, 94, 0.28)' : '';
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="kpi-card schedule-empty-card" style="grid-column: 1 / -1">
        <div class="kpi-top">
          <span>Nenhum cartão, dívida, caixinha ou Pix registrado neste mês</span>
          <div class="kpi-icon net">&#128197;</div>
        </div>
        <div class="kpi-sub">
          <span>Assim que você registrar cartões, dívidas/acordos, caixinhas ou gastos no Pix/Dinheiro, novos containers aparecerão aqui em ordem de data de pagamento.</span>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map(
      (item) => `
      <div class="kpi-card schedule-kpi-card ${item.isUrgent ? 'schedule-kpi-urgent' : ''}">
        <div class="kpi-top">
          <span class="schedule-card-type">
            ${item.isUrgent ? '<span class="due-exclamation-badge" title="Próximo do vencimento ou em atraso!">!</span>' : ''}
            ${item.typeLabel}
          </span>
          <div class="kpi-icon ${item.isUrgent ? 'urgent' : item.iconClass}">${item.icon}</div>
        </div>
        <div class="schedule-card-title" title="${item.title}">${item.title}</div>
        <div class="kpi-value ${item.isUrgent ? 'schedule-value-urgent' : ''}">${formatBRL(item.amount)}</div>
        <div class="schedule-card-date ${item.isUrgent ? 'schedule-date-urgent' : ''}">
          &#128197; ${item.dateText}
        </div>
        <div class="kpi-sub schedule-card-footer">
          <span>${item.extraSub}</span>
          <button type="button" class="btn ${item.isUrgent ? 'btn-danger' : 'btn-secondary'} btn-sm" data-goto="${item.targetTab}">
            ${item.actionLabel}
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

// Render Overview & Recent Transactions
function renderOverview(summary) {
  const { totalIncome, totalPix, totalCards, totalDebtMonth, totalVaultMonth, totalExpenses, freeBalance } = summary;

  document.getElementById('kpi-income').textContent = formatBRL(totalIncome);
  document.getElementById('kpi-income-sub').textContent = `${summary.incomes.filter((i) => !i.skipped).length} entrada(s) no mês`;

  document.getElementById('kpi-pix').textContent = formatBRL(totalPix);
  const pixPct = totalIncome > 0 ? Math.round((totalPix / totalIncome) * 100) : 0;
  document.getElementById('kpi-pix-sub').textContent = `${pixPct}% das entradas`;

  document.getElementById('kpi-cards').textContent = formatBRL(totalCards);
  const cardsPct = totalIncome > 0 ? Math.round((totalCards / totalIncome) * 100) : 0;
  document.getElementById('kpi-cards-sub').textContent = `${cardsPct}% das entradas`;

  const netEl = document.getElementById('kpi-net');
  netEl.textContent = formatBRL(freeBalance);
  netEl.style.color = freeBalance >= 0 ? 'var(--emerald)' : 'var(--coral)';
  const committedPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  document.getElementById('kpi-net-sub').textContent = `${committedPct}% da renda comprometida`;

  // Renderiza os novos containers ordenados por data prevista de pagamento (Cartões, Dívidas, Pix, Caixinhas)
  renderDueScheduleCards(summary);

  // Render Pie Chart
  renderPieSVG(summary);

  // Render Side Summary Panel (Cards Limit + Debts + Pix Breakdown + Vault)
  const totalCreditLimit = state.cards.reduce((acc, c) => acc + Number(c.limit || 0), 0);
  const availableCreditLimit = Math.max(0, totalCreditLimit - totalCards);
  const totalRemainingDebt = state.debts
    .filter((d) => d.status !== 'Quitada')
    .reduce((acc, d) => acc + Math.max(0, Number(d.totalAmount || 0) - Number(d.paidAmount || 0)), 0);

  document.getElementById('overview-side-stats').innerHTML = `
    <div class="cycle-stat-box">
      <div class="meta">
        <span>Teto do Gráfico (Entradas do Mês)</span>
        <strong style="color: var(--emerald)">${formatBRL(totalIncome)}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="pix-view">+ Entrada</button>
    </div>
    <div class="cycle-stat-box">
      <div class="meta">
        <span>Gastos Fora de Cartão (Pix / Dinheiro / Débito)</span>
        <strong style="color: var(--sky)">${formatBRL(totalPix)}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="pix-view">+ Pix / Dinheiro</button>
    </div>
    <div class="cycle-stat-box">
      <div class="meta">
        <span>Faturas de Cartões (${state.cards.length} cartões)</span>
        <strong style="color: var(--amber)">${formatBRL(totalCards)} <small style="font-size:0.75rem;color:var(--text-secondary)">/ Disp: ${formatBRL(availableCreditLimit)}</small></strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="cards-view">Ver Cartões</button>
    </div>
    <div class="cycle-stat-box">
      <div class="meta">
        <span>Parcelas de Dívidas no Mês (Saldo Total: ${formatBRL(totalRemainingDebt)})</span>
        <strong style="color: var(--coral)">${formatBRL(totalDebtMonth)}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="debts-view">Ver Dívidas</button>
    </div>
    <div class="cycle-stat-box">
      <div class="meta">
        <span>Guardado nas Caixinhas neste Mês (Descontado do Bruto)</span>
        <strong style="color: var(--teal)">${formatBRL(totalVaultMonth)}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="vault-view">Ver Cofrinho</button>
    </div>
  `;

  // Bind quick navigation buttons
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-goto')));
  });

  // Render Unified Recent Movements Table
  const movements = [
    ...summary.incomes.filter((i) => !i.skipped).map((i) => ({ ...i, kind: 'Entrada', tagClass: 'income', sign: '+' })),
    ...summary.pixExpenses.map((p) => ({ ...p, kind: 'Pix / Dinheiro', tagClass: 'pix', sign: '-' })),
    ...summary.cardExpenses.map((c) => {
      const card = state.cards.find((k) => k.id === c.cardId);
      const isDebit = c.mode === 'debit';
      return {
        ...c,
        kind: card ? `${card.name} (${isDebit ? 'Débito' : 'Crédito'})` : isDebit ? 'Cartão (Débito)' : 'Cartão (Crédito)',
        tagClass: isDebit ? 'pix' : 'card',
        sign: '-'
      };
    }),
    ...summary.vaultDepositsMonth.map((m) => {
      const g = (state.vaultGoals || []).find((x) => x.id === m.goalId);
      return {
        ...m,
        category: g ? g.name : 'Caixinha',
        kind: 'Cofrinho (Guardado)',
        tagClass: 'vault',
        sign: '-'
      };
    })
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const tbody = document.getElementById('recent-movements-tbody');
  if (movements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma movimentação registrada neste mês.</td></tr>`;
  } else {
    tbody.innerHTML = movements
      .map(
        (m) => `
      <tr>
        <td><strong>${m.description}</strong></td>
        <td><span class="tag ${m.tagClass}">${m.kind}</span></td>
        <td>${m.category || '-'}</td>
        <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-secondary)">${m.date ? m.date.split('-').reverse().join('/') : '-'}</td>
        <td class="${m.sign === '+' ? 'amount-positive' : 'amount-negative'}">${m.sign} ${formatBRL(m.amount)}</td>
      </tr>
    `
      )
      .join('');
  }
}

// Render Credit Cards & Invoices View
function renderCardsView(summary) {
  const container = document.getElementById('cards-list-container');
  const cardSelect = document.getElementById('card-expense-cardId');

  // Populate card select dropdown
  if (state.cards.length === 0) {
    cardSelect.innerHTML = `<option value="">Cadastre um cartão primeiro</option>`;
  } else {
    cardSelect.innerHTML = state.cards
      .map((c) => `<option value="${c.id}">${c.name} (Venc. dia ${c.dueDay})</option>`)
      .join('');
  }

  if (state.cards.length === 0) {
    container.innerHTML = `<div class="panel empty-state">Nenhum cartão cadastrado ainda. Utilize o formulário abaixo para cadastrar seu primeiro cartão com limite e datas de fechamento/pagamento.</div>`;
  } else {
    container.innerHTML = state.cards
      .map((card) => {
        const creditItems = summary.cardExpenses.filter((ce) => ce.cardId === card.id && ce.mode !== 'debit');
        const debitItems = summary.cardExpenses.filter((ce) => ce.cardId === card.id && ce.mode === 'debit');
        const invoiceAmount = creditItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
        const debitAmount = debitItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
        const limit = Number(card.limit || 1);
        const available = Math.max(0, limit - invoiceAmount);
        const usagePct = Math.min(100, Math.round((invoiceAmount / limit) * 100));
        const isPaid = Array.isArray(card.paidMonths) && card.paidMonths.includes(selectedMonth);
        const dueStatus = checkDueStatus(card.dueDay || 12, selectedMonth, isPaid || invoiceAmount <= 0);

        const barColor = usagePct > 85 ? 'var(--coral)' : usagePct > 60 ? 'var(--amber)' : 'var(--emerald)';

        return `
          <div class="credit-card-item" style="${dueStatus.isNearOrOverdue ? 'border-color: var(--coral); box-shadow: 0 0 0 1px rgba(244,63,94,0.4)' : ''}">
            <div class="credit-card-visual" style="background: linear-gradient(135deg, ${card.color || '#0f766e'}, #0f172a);">
              <div class="card-visual-top">
                <span class="card-brand-name">${card.name}</span>
                <span class="card-status-pill" style="${dueStatus.isNearOrOverdue ? 'background: var(--coral); color:#fff' : ''}">
                  ${isPaid ? 'Fatura Paga' : dueStatus.isNearOrOverdue ? `! ${dueStatus.label}` : 'Fatura Aberta'}
                </span>
              </div>
              <div class="card-dates-row">
                <div>
                  <span>Fechamento</span>
                  <strong>Dia ${String(card.closingDay).padStart(2, '0')}</strong>
                </div>
                <div>
                  <span>Pagamento / Venc.</span>
                  <strong>Dia ${String(card.dueDay).padStart(2, '0')}</strong>
                </div>
                <div>
                  <span>Limite Total</span>
                  <strong>${formatBRL(limit)}</strong>
                </div>
              </div>
            </div>
            <div class="credit-card-body">
              <div class="limit-meter">
                <div class="limit-labels">
                  <span>Usado no crédito (${usagePct}%)</span>
                  <strong>Disponível: ${formatBRL(available)}</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${usagePct}%; background-color: ${barColor}"></div>
                </div>
              </div>

              <div class="card-invoice-box">
                <div>
                  <div class="label">Fatura Crédito (${formatMonthLabel(selectedMonth)})</div>
                  <div class="amount" style="color: ${isPaid ? 'var(--emerald)' : dueStatus.isNearOrOverdue ? 'var(--coral)' : 'var(--amber)'}">${formatBRL(invoiceAmount)}</div>
                  ${debitAmount > 0 ? `<div style="font-size:0.74rem; color: var(--sky); margin-top:2px">+ Usado no Débito: ${formatBRL(debitAmount)}</div>` : ''}
                </div>
                <button class="btn btn-sm ${isPaid ? 'btn-secondary' : 'btn-primary'}" data-toggle-invoice="${card.id}">
                  ${isPaid ? 'Reabrir Fatura' : 'Marcar Paga'}
                </button>
              </div>

              <div class="card-actions">
                <button class="btn btn-danger btn-sm" data-delete-card="${card.id}">Excluir Cartão</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Bind card actions
  document.querySelectorAll('[data-toggle-invoice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cardId = btn.getAttribute('data-toggle-invoice');
      const card = state.cards.find((c) => c.id === cardId);
      if (!card) return;
      card.paidMonths = Array.isArray(card.paidMonths) ? card.paidMonths : [];
      if (card.paidMonths.includes(selectedMonth)) {
        card.paidMonths = card.paidMonths.filter((m) => m !== selectedMonth);
      } else {
        card.paidMonths.push(selectedMonth);
      }
      persistAndRender();
    });
  });

  document.querySelectorAll('[data-delete-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cardId = btn.getAttribute('data-delete-card');
      state.cards = state.cards.filter((c) => c.id !== cardId);
      state.cardExpenses = state.cardExpenses.filter((ce) => ce.cardId !== cardId);
      persistAndRender();
    });
  });

  // Render table of card expenses for the month
  const tbody = document.getElementById('card-expenses-tbody');
  if (summary.cardExpenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum gasto de cartão registrado neste mês.</td></tr>`;
  } else {
    tbody.innerHTML = summary.cardExpenses
      .map((item) => {
        const card = state.cards.find((c) => c.id === item.cardId);
        const isDebit = item.mode === 'debit';
        return `
          <tr>
            <td><strong>${item.description}</strong></td>
            <td><span class="tag card">${card ? card.name : 'Cartão'}</span></td>
            <td><span class="tag ${isDebit ? 'pix' : 'card'}">${isDebit ? 'Débito (À vista)' : 'Crédito (Fatura)'}</span></td>
            <td>${item.category}</td>
            <td><span class="tag">${isDebit ? 'À vista' : item.installments || '1x'}</span></td>
            <td class="amount-negative">${formatBRL(item.amount)}</td>
            <td>
              <button class="btn btn-danger btn-sm" data-del-card-exp="${item.id}">Remover</button>
            </td>
          </tr>
        `;
      })
      .join('');

    document.querySelectorAll('[data-del-card-exp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-card-exp');
        state.cardExpenses = state.cardExpenses.filter((e) => e.id !== id);
        persistAndRender();
      });
    });
  }
}

// Render Pix & Direct Expenses + Incomes View
function renderPixAndIncomesView(summary) {
  const pixTbody = document.getElementById('pix-expenses-tbody');
  document.getElementById('pix-total-badge').textContent = formatBRL(summary.totalPixOnly);

  if (summary.pixExpenses.length === 0) {
    pixTbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum gasto no Pix ou Dinheiro registrado neste mês.</td></tr>`;
  } else {
    pixTbody.innerHTML = summary.pixExpenses
      .map(
        (p) => `
        <tr>
          <td><strong>${p.description}</strong></td>
          <td>${p.recipient || '-'}</td>
          <td><span class="tag pix">${p.category}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.82rem">${p.date ? p.date.split('-').reverse().join('/') : '-'}</td>
          <td class="amount-negative">- ${formatBRL(p.amount)}</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del-pix="${p.id}">Remover</button>
          </td>
        </tr>
      `
      )
      .join('');

    document.querySelectorAll('[data-del-pix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-pix');
        state.pixExpenses = state.pixExpenses.filter((p) => p.id !== id);
        persistAndRender();
      });
    });
  }

  // Incomes table
  const incTbody = document.getElementById('incomes-tbody');
  document.getElementById('income-total-badge').textContent = formatBRL(summary.totalIncome);

  if (summary.incomes.length === 0) {
    incTbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma entrada cadastrada neste mês.</td></tr>`;
  } else {
    incTbody.innerHTML = summary.incomes
      .map((inc) => {
        const dateStr = inc.date ? inc.date.split('-').reverse().join('/') : '-';
        if (!inc.isRecurring) {
          return `
        <tr>
          <td><strong>${inc.description}</strong></td>
          <td><span class="tag income">${inc.category}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.82rem">${dateStr}</td>
          <td class="amount-positive">+ ${formatBRL(inc.amount)}</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del-inc="${inc.id}">Remover</button>
          </td>
        </tr>`;
        }

        const status = inc.skipped
          ? '<span class="tag skipped">Não recebido neste mês</span>'
          : inc.adjusted
            ? `<span class="tag card">Ajustado (padrão ${formatBRL(inc.baseAmount)})</span>`
            : '';

        return `
        <tr>
          <td>
            <strong>${inc.description}</strong>
            <div style="font-size: 0.74rem; color: var(--text-secondary)">&#128260; ${inc.rule} ${status}</div>
          </td>
          <td><span class="tag recurring">${inc.category} fixo</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.82rem">${dateStr}</td>
          <td class="amount-positive" style="${inc.skipped ? 'opacity:0.5; text-decoration: line-through' : ''}">
            + ${formatBRL(inc.skipped ? inc.baseAmount : inc.amount)}
          </td>
          <td>
            <div class="row-actions">
              ${
                inc.skipped
                  ? `<button class="btn btn-primary btn-sm" data-rec-restore="${inc.recurringId}" title="Volta a contar o salário neste mês">Restaurar mês</button>`
                  : `<button class="btn btn-secondary btn-sm" data-rec-adjust="${inc.recurringId}" title="Muda o valor só deste mês (ex: desconto, férias)">Ajustar valor</button>
                     <button class="btn btn-secondary btn-sm" data-rec-skip="${inc.recurringId}" title="Zera só este mês; os próximos continuam">Zerar mês</button>`
              }
              ${inc.adjusted ? `<button class="btn btn-secondary btn-sm" data-rec-restore="${inc.recurringId}">Voltar ao padrão</button>` : ''}
              <button class="btn btn-danger btn-sm" data-rec-end="${inc.recurringId}" title="Para de registrar a partir deste mês">Encerrar</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    document.querySelectorAll('[data-del-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-inc');
        state.incomes = state.incomes.filter((i) => i.id !== id);
        persistAndRender();
      });
    });

    const findRec = (id) => (state.recurringIncomes || []).find((r) => r.id === id);

    // Ajusta o valor apenas do mês selecionado — a recorrência continua normalmente
    document.querySelectorAll('[data-rec-adjust]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = findRec(btn.getAttribute('data-rec-adjust'));
        if (!rec) return;
        const current = rec.overrides && rec.overrides[selectedMonth] != null ? rec.overrides[selectedMonth] : rec.amount;
        const input = prompt(
          `Valor recebido em ${formatMonthLabel(selectedMonth)} (padrão: ${formatBRL(rec.amount)}).\nOs próximos meses continuam com o valor padrão.`,
          String(current)
        );
        if (input === null) return;
        const val = parseFloat(String(input).replace(/\./g, '').replace(',', '.'));
        if (isNaN(val) || val < 0) return;
        rec.overrides = rec.overrides || {};
        rec.overrides[selectedMonth] = val;
        rec.skippedMonths = (rec.skippedMonths || []).filter((m) => m !== selectedMonth);
        persistAndRender();
      });
    });

    // Zera apenas este mês (ex: férias) — continua auto-registrando nos próximos
    document.querySelectorAll('[data-rec-skip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = findRec(btn.getAttribute('data-rec-skip'));
        if (!rec) return;
        rec.skippedMonths = Array.from(new Set([...(rec.skippedMonths || []), selectedMonth]));
        persistAndRender();
      });
    });

    document.querySelectorAll('[data-rec-restore]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = findRec(btn.getAttribute('data-rec-restore'));
        if (!rec) return;
        rec.skippedMonths = (rec.skippedMonths || []).filter((m) => m !== selectedMonth);
        if (rec.overrides) delete rec.overrides[selectedMonth];
        persistAndRender();
      });
    });

    // Encerra: mantém histórico dos meses anteriores, para de registrar a partir deste mês
    document.querySelectorAll('[data-rec-end]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = findRec(btn.getAttribute('data-rec-end'));
        if (!rec) return;
        if (!confirm(`Encerrar "${rec.description}" a partir de ${formatMonthLabel(selectedMonth)}? Os meses anteriores ficam no histórico.`)) return;
        if (!rec.startMonth || selectedMonth <= rec.startMonth) {
          state.recurringIncomes = state.recurringIncomes.filter((r) => r.id !== rec.id);
        } else {
          rec.endMonth = shiftMonth(selectedMonth, -1);
        }
        persistAndRender();
      });
    });
  }
}

// Render Debts View
function renderDebtsView() {
  const tbody = document.getElementById('debts-tbody');
  if (state.debts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhuma dívida ou acordo registrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.debts
    .map((d) => {
      const remaining = Math.max(0, Number(d.totalAmount || 0) - Number(d.paidAmount || 0));
      const pctPaid = d.totalAmount > 0 ? Math.min(100, Math.round((d.paidAmount / d.totalAmount) * 100)) : 100;
      const isQuitada = remaining <= 0 || d.status === 'Quitada';

      const paidMonthsList = Array.isArray(d.paidMonths) ? d.paidMonths : [];
      const isPaidInThisMonth = paidMonthsList.includes(selectedMonth);
      const dueDay = Number(d.dueDay) || 10;
      const dueStatus = checkDueStatus(dueDay, selectedMonth, isPaidInThisMonth || isQuitada);

      const monthsInfo = d.totalMonths ? ` (${d.totalMonths} meses previstos)` : '';
      const startInfo = d.startMonth ? `Início: ${formatMonthLabel(d.startMonth)}` : '';

      return `
        <tr class="${dueStatus.isNearOrOverdue ? 'row-due-danger' : ''}">
          <td>
            <strong>${dueStatus.isNearOrOverdue ? '<span class="due-exclamation-badge" title="Próximo do vencimento ou atrasado" style="width:18px;height:18px;font-size:0.72rem;margin-right:6px">!</span>' : ''}${d.creditor}</strong>
            <div style="font-size: 0.74rem; color: var(--text-secondary)">${startInfo}${monthsInfo} • Venc. dia ${String(dueDay).padStart(2, '0')} • ${pctPaid}% quitado</div>
          </td>
          <td style="font-family: var(--font-mono)">${formatBRL(d.totalAmount)}</td>
          <td style="font-family: var(--font-mono); color: var(--emerald)">${formatBRL(d.paidAmount)}</td>
          <td style="font-family: var(--font-mono); color: var(--coral); font-weight:700">${formatBRL(remaining)}</td>
          <td style="font-family: var(--font-mono)">
            ${formatBRL(d.monthlyInstallment)}/mês
            <div style="font-size: 0.72rem; color: ${isPaidInThisMonth ? 'var(--emerald)' : dueStatus.isNearOrOverdue ? 'var(--coral)' : 'var(--amber)'}; font-weight: ${dueStatus.isNearOrOverdue ? '700' : '400'}">
              ${isPaidInThisMonth ? '✓ Parcela deste mês Paga' : dueStatus.isNearOrOverdue ? `! ${dueStatus.label}` : '○ Parcela deste mês Pendente'}
            </div>
          </td>
          <td><span class="tag ${isQuitada ? 'income' : 'debt'}">${isQuitada ? 'Quitada' : 'Ativa'}</span></td>
          <td>
            <div class="row-actions">
              ${
                !isQuitada
                  ? `
                  <button class="btn ${isPaidInThisMonth ? 'btn-secondary' : 'btn-primary'} btn-sm" data-toggle-debt-month="${d.id}" title="Marcar manualmente se pagou ou não a parcela deste mês">
                    ${isPaidInThisMonth ? 'Desmarcar Mês' : 'Pagar Mês Atual'}
                  </button>
                  <button class="btn btn-secondary btn-sm" data-pay-debt="${d.id}" title="Abater valor de 1 parcela do saldo devedor total">
                    + Abater Saldo
                  </button>
                  `
                  : ''
              }
              <button class="btn btn-danger btn-sm" data-del-debt="${d.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('[data-toggle-debt-month]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-debt-month');
      const debt = state.debts.find((d) => d.id === id);
      if (!debt) return;
      debt.paidMonths = Array.isArray(debt.paidMonths) ? debt.paidMonths : [];
      if (debt.paidMonths.includes(selectedMonth)) {
        debt.paidMonths = debt.paidMonths.filter((m) => m !== selectedMonth);
        debt.paidAmount = Math.max(0, Number(debt.paidAmount || 0) - Number(debt.monthlyInstallment || 0));
      } else {
        debt.paidMonths.push(selectedMonth);
        debt.paidAmount = Math.min(Number(debt.totalAmount), Number(debt.paidAmount || 0) + Number(debt.monthlyInstallment || 0));
        if (debt.paidAmount >= debt.totalAmount) {
          debt.status = 'Quitada';
        }
      }
      persistAndRender();
    });
  });

  document.querySelectorAll('[data-pay-debt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-pay-debt');
      const debt = state.debts.find((d) => d.id === id);
      if (!debt) return;
      const step = Number(debt.monthlyInstallment || 0) || Number(debt.totalAmount || 0);
      debt.paidAmount = Math.min(Number(debt.totalAmount), Number(debt.paidAmount || 0) + step);
      if (debt.paidAmount >= debt.totalAmount) {
        debt.status = 'Quitada';
      }
      persistAndRender();
    });
  });

  document.querySelectorAll('[data-del-debt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-debt');
      state.debts = state.debts.filter((d) => d.id !== id);
      persistAndRender();
    });
  });
}

// Navigation Tab Switcher
function switchTab(targetId) {
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === targetId);
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === targetId);
  });
}

// Render Cofrinho & Reservas (Caixinhas com valor mínimo mensal, confirmação manual e alerta de atraso)
function renderVaultView(summary) {
  const goalsTbody = document.getElementById('vault-goals-tbody');
  const movementsTbody = document.getElementById('vault-movements-tbody');
  const selectGoal = document.getElementById('vault-move-goalId');
  const alertsSub = document.getElementById('vault-pending-alerts-sub');

  const goals = Array.isArray(state.vaultGoals) ? state.vaultGoals : [];
  const movements = Array.isArray(state.vaultMovements) ? state.vaultMovements : [];

  // Calcula saldos totais de cada caixinha e quanto foi depositado no mês selecionado
  const goalBalances = {};
  const goalMonthDeposited = {};
  goals.forEach((g) => {
    goalBalances[g.id] = Number(g.initialBalance || 0);
    goalMonthDeposited[g.id] = 0;
  });

  let totalWithdrawn = 0;

  movements.forEach((m) => {
    const val = Number(m.amount || 0);
    const mMonth = m.month || (m.date ? m.date.slice(0, 7) : '');
    if (m.type === 'deposit') {
      goalBalances[m.goalId] = (goalBalances[m.goalId] || 0) + val;
      if (mMonth === selectedMonth) {
        goalMonthDeposited[m.goalId] = (goalMonthDeposited[m.goalId] || 0) + val;
      }
    } else if (m.type === 'withdraw') {
      goalBalances[m.goalId] = Math.max(0, (goalBalances[m.goalId] || 0) - val);
      totalWithdrawn += val;
    }
  });

  const totalSaved = Object.values(goalBalances).reduce((acc, b) => acc + b, 0);
  const totalDepositedThisMonth = summary ? summary.totalVaultMonth : Object.values(goalMonthDeposited).reduce((a, b) => a + b, 0);

  let overdueCount = 0;
  goals.forEach((g) => {
    const minM = Number(g.minMonthly || 0);
    const depM = goalMonthDeposited[g.id] || 0;
    const status = checkDueStatus(g.dueDay || 10, selectedMonth, minM <= 0 || depM >= minM);
    if (status.isNearOrOverdue) overdueCount++;
  });

  // KPIs do Cofrinho
  document.getElementById('vault-total-saved').textContent = formatBRL(totalSaved);
  document.getElementById('vault-total-in').textContent = formatBRL(totalDepositedThisMonth);
  document.getElementById('vault-total-out').textContent = formatBRL(totalWithdrawn);
  document.getElementById('vault-active-goals').textContent = String(goals.length);
  document.getElementById('nav-badge-vault').textContent = formatBRL(totalSaved);
  if (alertsSub) {
    alertsSub.textContent = overdueCount > 0 ? `! ${overdueCount} caixinha(s) pendente(s)/atraso` : 'Todas em dia no mês';
    alertsSub.style.color = overdueCount > 0 ? 'var(--coral)' : 'var(--text-muted)';
  }

  // Preenche select do formulário de movimentação
  if (goals.length === 0) {
    selectGoal.innerHTML = `<option value="">Crie uma caixinha ao lado primeiro</option>`;
  } else {
    selectGoal.innerHTML = goals
      .map((g) => `<option value="${g.id}">${g.name} (Mín. ${formatBRL(g.minMonthly || 0)}/mês)</option>`)
      .join('');
  }

  // Tabela de Caixinhas (Controle Mês a Mês)
  if (goals.length === 0) {
    goalsTbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhuma caixinha criada ainda. Utilize o formulário "Criar Caixinha" acima para começar.</td></tr>`;
  } else {
    goalsTbody.innerHTML = goals
      .map((g) => {
        const bal = goalBalances[g.id] || 0;
        const minMonthly = Number(g.minMonthly || 0);
        const dueDay = Number(g.dueDay || 10);
        const depositedMonth = goalMonthDeposited[g.id] || 0;
        const isFulfilled = minMonthly > 0 ? depositedMonth >= minMonthly : depositedMonth > 0;
        const dueStatus = checkDueStatus(dueDay, selectedMonth, isFulfilled);
        const target = Number(g.targetAmount || 0);

        let statusBadge = '';
        if (isFulfilled) {
          statusBadge = `<span class="tag income">&#10003; Confirmado no mês</span>`;
        } else if (dueStatus.isNearOrOverdue) {
          statusBadge = `<span class="tag debt"><span class="due-exclamation-badge" style="width:16px;height:16px;font-size:0.7rem">!</span> ${dueStatus.label}</span>`;
        } else {
          statusBadge = `<span class="tag card">Aguardando depósito</span>`;
        }

        return `
          <tr class="${dueStatus.isNearOrOverdue ? 'row-due-danger' : ''}">
            <td>
              <strong>${dueStatus.isNearOrOverdue ? '<span class="due-exclamation-badge" title="Atraso ou próximo da data limite!" style="width:18px;height:18px;font-size:0.72rem;margin-right:6px">!</span>' : ''}&#128176; ${g.name}</strong>
              <div style="font-size: 0.76rem; color: var(--text-secondary)">${g.description || 'Reserva financeira'}${target > 0 ? ` • Meta Total: ${formatBRL(target)}` : ''}</div>
            </td>
            <td style="font-family: var(--font-mono); font-weight: 600">${formatBRL(minMonthly)}/mês</td>
            <td style="font-family: var(--font-mono); color: ${dueStatus.isNearOrOverdue ? 'var(--coral)' : 'var(--text-secondary)'}; font-weight: ${dueStatus.isNearOrOverdue ? '700' : '400'}">
              Todo dia ${String(dueDay).padStart(2, '0')}
            </td>
            <td style="font-family: var(--font-mono); color: ${depositedMonth > 0 ? 'var(--emerald)' : 'var(--text-muted)'}; font-weight: 700">
              ${formatBRL(depositedMonth)}
            </td>
            <td style="font-family: var(--font-mono); color: var(--emerald); font-weight: 700">${formatBRL(bal)}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="row-actions">
                <button class="btn btn-primary btn-sm" data-quick-deposit="${g.id}" title="Confirmar quanto colocou neste mês (será descontado do valor bruto)">
                  + Confirmar Depósito no Mês
                </button>
                <button class="btn btn-danger btn-sm" data-del-vault-goal="${g.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    // Botão rápido de confirmar depósito mensal na caixinha (desconta do bruto somente após confirmação)
    document.querySelectorAll('[data-quick-deposit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-quick-deposit');
        const goal = goals.find((g) => g.id === id);
        if (!goal) return;
        const suggested = Number(goal.minMonthly || 0) || 100;
        const input = prompt(
          `Quanto você guardou na caixinha "${goal.name}" em ${formatMonthLabel(selectedMonth)}?\n(Mínimo mensal: ${formatBRL(goal.minMonthly || 0)})\n\nAo confirmar, esse valor será descontado do valor bruto do mês e somado à sua caixinha:`,
          String(suggested)
        );
        if (input === null) return;
        const val = parseFloat(String(input).replace(/\./g, '').replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        state.vaultMovements = Array.isArray(state.vaultMovements) ? state.vaultMovements : [];
        state.vaultMovements.push({
          id: `vm-${Date.now()}`,
          goalId: goal.id,
          type: 'deposit',
          amount: val,
          description: `Depósito mensal (${formatMonthLabel(selectedMonth)})`,
          date: todayISO(),
          month: selectedMonth
        });
        persistAndRender();
      });
    });

    document.querySelectorAll('[data-del-vault-goal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-vault-goal');
        state.vaultGoals = state.vaultGoals.filter((g) => g.id !== id);
        state.vaultMovements = state.vaultMovements.filter((m) => m.goalId !== id);
        persistAndRender();
      });
    });
  }

  // Tabela de Histórico do Cofrinho
  if (movements.length === 0) {
    movementsTbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhuma movimentação confirmada nas caixinhas até o momento.</td></tr>`;
  } else {
    movementsTbody.innerHTML = movements
      .slice()
      .reverse()
      .map((m) => {
        const g = goals.find((x) => x.id === m.goalId);
        const isDep = m.type === 'deposit';
        return `
          <tr>
            <td><strong>${m.description}</strong></td>
            <td><span class="tag">${g ? g.name : 'Caixinha'}</span></td>
            <td><span class="tag ${isDep ? 'income' : 'debt'}">${isDep ? 'Guardado no Mês (- Bruto / + Caixinha)' : 'Resgate (-)'}</span></td>
            <td style="font-family: var(--font-mono); font-size: 0.82rem">${m.date ? m.date.split('-').reverse().join('/') : '-'}</td>
            <td class="${isDep ? 'amount-positive' : 'amount-negative'}">${isDep ? '+' : '-'} ${formatBRL(m.amount)}</td>
            <td><button class="btn btn-danger btn-sm" data-del-vmove="${m.id}">Remover</button></td>
          </tr>
        `;
      })
      .join('');

    document.querySelectorAll('[data-del-vmove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-vmove');
        state.vaultMovements = state.vaultMovements.filter((m) => m.id !== id);
        persistAndRender();
      });
    });
  }
}

// Render Everything
function renderAll() {
  document.getElementById('current-month-label').textContent = formatMonthLabel(selectedMonth);
  const summary = getMonthSummary(selectedMonth);

  // Update nav badges
  document.getElementById('nav-badge-cards').textContent = String(state.cards.length);
  document.getElementById('nav-badge-pix').textContent = String(summary.pixExpenses.length);
  document.getElementById('nav-badge-debts').textContent = String(state.debts.filter((d) => d.status !== 'Quitada').length);

  renderOverview(summary);
  renderCardsView(summary);
  renderPixAndIncomesView(summary);
  renderDebtsView();
  renderVaultView(summary);
  updateFirebaseStatusBadge();
}

function updateFirebaseStatusBadge() {
  const dot = document.getElementById('firebase-status-dot');
  const label = document.getElementById('firebase-status-text');
  if (activeUser) {
    dot.classList.add('connected');
    label.textContent = activeUser.email || '';
  } else {
    dot.classList.remove('connected');
    label.textContent = 'Não autenticado';
  }
}

// Setup Event Listeners
function initApp() {
  // Set default dates in forms
  document.querySelectorAll('input[type="date"]').forEach((inp) => {
    if (!inp.value) inp.value = todayISO();
  });
  const debtMonthInput = document.getElementById('debt-start-month');
  if (debtMonthInput && !debtMonthInput.value) {
    debtMonthInput.value = selectedMonth;
  }

  // Inicializa o serviço de autenticação
  authService.init();

  // Banner de cópia rápida do código de verificação
  const closeToastBtn = document.getElementById('close-code-toast-btn');
  const copyToastBtn = document.getElementById('copy-code-toast-btn');
  if (closeToastBtn) {
    closeToastBtn.addEventListener('click', () => {
      document.getElementById('code-dispatch-toast').style.display = 'none';
    });
  }
  if (copyToastBtn) {
    copyToastBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentVerificationCode);
        copyToastBtn.textContent = 'Copiado!';
      } catch (_) {
        copyToastBtn.textContent = currentVerificationCode;
      }
    });
  }

  // Tabs do Modal de Autenticação (Entrar vs Criar Conta)
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('form-auth-login');
  const formRegister = document.getElementById('form-auth-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    showAuthStep('login');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    showAuthStep('register');
  });

  // Form: Login -> Verifica se já marcou "Permanecer"; caso contrário, pede 2FA + "Permanecer conectado?"
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('login-feedback');
    feedback.textContent = 'Autenticando...';
    feedback.style.color = 'var(--amber)';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    pendingAuthFlow = true;
    try {
      const { user, profile } = await authService.loginUser(email, password);
      activeUser = user;
      activeProfile = profile;
      feedback.textContent = '';

      const stayPref = localStorage.getItem(`${STAY_CONNECTED_PREFIX}${user.uid}`);
      if (stayPref === 'true') {
        pendingAuthFlow = false;
        sessionStorage.setItem(`${SESSION_VERIFIED_PREFIX}${user.uid}`, 'true');
        unlockAuthenticatedApp(user, profile);
      } else {
        const codeInput = document.getElementById('auth-2fa-code');
        const fb2fa = document.getElementById('auth-2fa-feedback');
        if (codeInput) codeInput.value = '';
        showAuthStep('2fa');
        generateAndShowVerificationCode('gmail', user.email || email, fb2fa);
      }
    } catch (err) {
      pendingAuthFlow = false;
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = 'var(--coral)';
    }
  });

  // Form: Registro (Nome, Idade, Telefone/WhatsApp, Gmail e Senha) -> Pede 2FA + "Permanecer conectado?"
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('reg-feedback');
    feedback.textContent = 'Criando conta no Firebase...';
    feedback.style.color = 'var(--amber)';

    const name = document.getElementById('reg-name').value.trim();
    const age = parseInt(document.getElementById('reg-age').value, 10);
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    pendingAuthFlow = true;
    try {
      const { user, profile } = await authService.registerUser({ name, age, phone, email, password }, state);
      activeUser = user;
      activeProfile = profile;
      feedback.textContent = '';

      const codeInput = document.getElementById('auth-2fa-code');
      const fb2fa = document.getElementById('auth-2fa-feedback');
      if (codeInput) codeInput.value = '';
      showAuthStep('2fa');
      generateAndShowVerificationCode('whatsapp', phone || email, fb2fa);
    } catch (err) {
      pendingAuthFlow = false;
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = 'var(--coral)';
    }
  });

  // Botões pequenos de texto para enviar código 2FA (Enviar no WhatsApp | Enviar no Gmail | Enviar SMS)
  document.querySelectorAll('[data-send-2fa]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const channel = btn.getAttribute('data-send-2fa');
      const fb2fa = document.getElementById('auth-2fa-feedback');
      const dest =
        channel === 'gmail'
          ? (activeUser && activeUser.email) || document.getElementById('login-email').value || ''
          : (activeProfile && activeProfile.phone) || document.getElementById('reg-phone').value || (activeUser && activeUser.email) || '';
      generateAndShowVerificationCode(channel, dest, fb2fa);
    });
  });

  // Confirmar código de 2FA -> Abre pergunta "Permanecer conectado?"
  const verify2faBtn = document.getElementById('verify-2fa-btn');
  if (verify2faBtn) {
    verify2faBtn.addEventListener('click', () => {
      const entered = (document.getElementById('auth-2fa-code').value || '').trim();
      const fb2fa = document.getElementById('auth-2fa-feedback');
      if (!entered || entered !== currentVerificationCode) {
        fb2fa.textContent = 'Código inválido. Verifique o código de 6 dígitos enviado e tente novamente.';
        fb2fa.style.color = 'var(--coral)';
        return;
      }
      fb2fa.textContent = '';
      document.getElementById('code-dispatch-toast').style.display = 'none';
      showAuthStep('stay');
    });
  }

  const cancel2faBtn = document.getElementById('cancel-2fa-btn');
  if (cancel2faBtn) {
    cancel2faBtn.addEventListener('click', async () => {
      pendingAuthFlow = false;
      document.getElementById('code-dispatch-toast').style.display = 'none';
      await authService.logout();
      showAuthStep('login');
    });
  }

  // Botões "Permanecer conectado?": "Permanecer" vs "Não manter conectado"
  const stayYesBtn = document.getElementById('stay-connected-yes-btn');
  const stayNoBtn = document.getElementById('stay-connected-no-btn');

  if (stayYesBtn) {
    stayYesBtn.addEventListener('click', () => {
      pendingAuthFlow = false;
      if (activeUser) {
        localStorage.setItem(`${STAY_CONNECTED_PREFIX}${activeUser.uid}`, 'true');
        sessionStorage.setItem(`${SESSION_VERIFIED_PREFIX}${activeUser.uid}`, 'true');
        unlockAuthenticatedApp(activeUser, activeProfile);
      }
    });
  }

  if (stayNoBtn) {
    stayNoBtn.addEventListener('click', () => {
      pendingAuthFlow = false;
      if (activeUser) {
        localStorage.setItem(`${STAY_CONNECTED_PREFIX}${activeUser.uid}`, 'false');
        sessionStorage.setItem(`${SESSION_VERIFIED_PREFIX}${activeUser.uid}`, 'true');
        unlockAuthenticatedApp(activeUser, activeProfile);
      }
    });
  }

  // Fluxo "Esqueci minha senha" (com confirmação de código via WhatsApp, Gmail ou SMS)
  const openForgotBtn = document.getElementById('open-forgot-password-btn');
  const backToLoginBtn = document.getElementById('back-to-login-btn');
  const confirmForgotCodeBtn = document.getElementById('confirm-forgot-code-btn');
  const saveNewPasswordBtn = document.getElementById('save-new-password-btn');
  const forgotNewPassSection = document.getElementById('forgot-new-password-section');
  const forgotFeedback = document.getElementById('forgot-feedback');

  if (openForgotBtn) {
    openForgotBtn.addEventListener('click', () => {
      forgotPasswordCodeVerified = false;
      document.getElementById('forgot-identifier').value = document.getElementById('login-email').value.trim();
      document.getElementById('forgot-code').value = '';
      document.getElementById('forgot-new-password').value = '';
      document.getElementById('forgot-confirm-password').value = '';
      if (forgotNewPassSection) forgotNewPassSection.style.display = 'none';
      if (forgotFeedback) forgotFeedback.textContent = '';
      showAuthStep('forgot');
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
      document.getElementById('code-dispatch-toast').style.display = 'none';
      showAuthStep('login');
    });
  }

  document.querySelectorAll('[data-send-forgot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const channel = btn.getAttribute('data-send-forgot');
      const identifier = document.getElementById('forgot-identifier').value.trim();
      if (!identifier) {
        forgotFeedback.textContent = 'Informe seu Gmail ou Telefone (WhatsApp) primeiro.';
        forgotFeedback.style.color = 'var(--coral)';
        return;
      }
      forgotPasswordCodeVerified = false;
      if (forgotNewPassSection) forgotNewPassSection.style.display = 'none';
      generateAndShowVerificationCode(channel, identifier, forgotFeedback);
    });
  });

  if (confirmForgotCodeBtn) {
    confirmForgotCodeBtn.addEventListener('click', () => {
      const entered = (document.getElementById('forgot-code').value || '').trim();
      if (!entered || !currentVerificationCode || entered !== currentVerificationCode) {
        forgotFeedback.textContent = 'Código incorreto. Clique em Enviar no WhatsApp, Gmail ou SMS e cole o código de 6 dígitos.';
        forgotFeedback.style.color = 'var(--coral)';
        return;
      }
      forgotPasswordCodeVerified = true;
      document.getElementById('code-dispatch-toast').style.display = 'none';
      if (forgotNewPassSection) forgotNewPassSection.style.display = 'flex';
      forgotFeedback.textContent = 'Código confirmado! Agora digite sua nova senha abaixo.';
      forgotFeedback.style.color = 'var(--emerald)';
    });
  }

  if (saveNewPasswordBtn) {
    saveNewPasswordBtn.addEventListener('click', async () => {
      if (!forgotPasswordCodeVerified) {
        forgotFeedback.textContent = 'Confirme o código de verificação antes de alterar a senha.';
        forgotFeedback.style.color = 'var(--coral)';
        return;
      }
      const identifier = document.getElementById('forgot-identifier').value.trim();
      const newPass = document.getElementById('forgot-new-password').value;
      const confirmPass = document.getElementById('forgot-confirm-password').value;

      if (!newPass || newPass.length < 6) {
        forgotFeedback.textContent = 'A nova senha deve ter pelo menos 6 dígitos.';
        forgotFeedback.style.color = 'var(--coral)';
        return;
      }
      if (newPass !== confirmPass) {
        forgotFeedback.textContent = 'As senhas digitadas não coincidem.';
        forgotFeedback.style.color = 'var(--coral)';
        return;
      }

      forgotFeedback.textContent = 'Atualizando sua senha...';
      forgotFeedback.style.color = 'var(--amber)';

      try {
        const res = await authService.resetPasswordWithVerifiedCode(identifier, newPass);
        if (res && res.email) {
          document.getElementById('login-email').value = res.email;
        }
        const loginFb = document.getElementById('login-feedback');
        showAuthStep('login');
        if (loginFb) {
          loginFb.textContent = 'Senha alterada com sucesso! Entre com sua nova senha.';
          loginFb.style.color = 'var(--emerald)';
        }
      } catch (err) {
        forgotFeedback.textContent = `Erro: ${err.message}`;
        forgotFeedback.style.color = 'var(--coral)';
      }
    });
  }

  // Botão Sair da Conta
  document.getElementById('user-logout-btn').addEventListener('click', async () => {
    if (activeUser) {
      sessionStorage.removeItem(`${SESSION_VERIFIED_PREFIX}${activeUser.uid}`);
    }
    await authService.logout();
  });

  // View de Configurações (Hub Principal + Dados do Usuário + Hub de Design + Fontes + Paleta de Cores)
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const settingsForm = document.getElementById('form-user-settings');
  const settingsFeedback = document.getElementById('settings-feedback');

  const openSettingsSubview = (subviewId) => {
    document.querySelectorAll('#settings-view .settings-subview').forEach((sub) => {
      sub.classList.toggle('active', sub.id === subviewId);
    });
  };

  const populateSettingsData = () => {
    const nameInput = document.getElementById('settings-name');
    const ageInput = document.getElementById('settings-age');
    const phoneInput = document.getElementById('settings-phone');
    const emailInput = document.getElementById('settings-email');
    if (nameInput) {
      nameInput.value = (activeProfile && activeProfile.name) || (activeUser && activeUser.displayName) || '';
    }
    if (ageInput) {
      ageInput.value = activeProfile && activeProfile.age != null ? activeProfile.age : '';
    }
    if (phoneInput) {
      phoneInput.value = (activeProfile && activeProfile.phone) || '';
    }
    if (emailInput) {
      emailInput.value = (activeUser && activeUser.email) || '';
    }
    if (settingsFeedback) {
      settingsFeedback.textContent = '';
    }
    applyFontSettings(state.fontSettings);
    applyColorSettings(state.colorSettings);
  };

  // Aplica as fontes e cores salvas logo na inicialização
  applyFontSettings(state.fontSettings);
  applyColorSettings(state.colorSettings);

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      populateSettingsData();
      openSettingsSubview('settings-hub');
      switchTab('settings-view');
    });
  }

  document.querySelectorAll('[data-open-settings-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetSub = btn.getAttribute('data-open-settings-sub');
      populateSettingsData();
      openSettingsSubview(targetSub);
    });
  });

  document.querySelectorAll('[data-back-settings-hub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSettingsSubview('settings-hub');
    });
  });

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('settings-name').value.trim();
      const age = document.getElementById('settings-age').value.trim();
      const phone = document.getElementById('settings-phone')
        ? document.getElementById('settings-phone').value.trim()
        : '';
      if (!name) return;
      settingsFeedback.textContent = 'Salvando alterações...';
      settingsFeedback.style.color = 'var(--amber)';
      try {
        const updated = await authService.updateUserProfile({ name, age, phone });
        activeProfile = updated;
        document.getElementById('user-display-name').textContent = updated.name;
        settingsFeedback.textContent = 'Dados atualizados com sucesso!';
        settingsFeedback.style.color = 'var(--emerald)';
      } catch (err) {
        settingsFeedback.textContent = `Erro ao salvar: ${err.message}`;
        settingsFeedback.style.color = 'var(--coral)';
      }
    });
  }

  const resetAllBtn = document.getElementById('reset-all-data-btn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (!confirm('Tem certeza que deseja zerar todos os dados financeiros desta conta?')) return;
      const currentFonts = { ...DEFAULT_FONT_SETTINGS, ...(state.fontSettings || {}) };
      const currentColors = { ...DEFAULT_COLOR_SETTINGS, ...(state.colorSettings || {}) };
      state = getInitialSeedData();
      state.fontSettings = currentFonts;
      state.colorSettings = currentColors;
      persistAndRender();
      if (settingsFeedback) {
        settingsFeedback.textContent = 'Todos os lançamentos financeiros foram zerados.';
        settingsFeedback.style.color = 'var(--emerald)';
      }
    });
  }

  // Controles de Arraste (Sliders) para Tamanho das Fontes de Texto
  const fontSliderKeys = ['titles', 'body', 'buttons', 'inputs', 'numbers'];
  fontSliderKeys.forEach((key) => {
    const slider = document.getElementById(`font-slider-${key}`);
    if (!slider) return;
    slider.addEventListener('input', () => {
      state.fontSettings = {
        ...DEFAULT_FONT_SETTINGS,
        ...(state.fontSettings || {}),
        [key]: Number(slider.value)
      };
      applyFontSettings(state.fontSettings);
    });
    slider.addEventListener('change', () => {
      persistAndRender();
    });
  });

  const resetFontsBtn = document.getElementById('reset-fonts-btn');
  if (resetFontsBtn) {
    resetFontsBtn.addEventListener('click', () => {
      state.fontSettings = { ...DEFAULT_FONT_SETTINGS };
      applyFontSettings(state.fontSettings);
      persistAndRender();
    });
  }

  // Controles de Paleta de Cores do Aplicativo (Temas Prontos e Seletores Individuais)
  document.querySelectorAll('[data-color-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.getAttribute('data-color-preset');
      const preset = COLOR_PRESETS[presetKey] || DEFAULT_COLOR_SETTINGS;
      state.colorSettings = { ...preset };
      applyColorSettings(state.colorSettings);
      persistAndRender();
    });
  });

  const colorPickerKeys = ['accent', 'btnText', 'bgPrimary', 'bgSecondary', 'bgCard', 'bgInput', 'textPrimary', 'textSecondary'];
  colorPickerKeys.forEach((key) => {
    const picker = document.getElementById(`color-picker-${key}`);
    if (!picker) return;
    picker.addEventListener('input', () => {
      state.colorSettings = {
        ...DEFAULT_COLOR_SETTINGS,
        ...(state.colorSettings || {}),
        [key]: picker.value
      };
      applyColorSettings(state.colorSettings);
    });
    picker.addEventListener('change', () => {
      persistAndRender();
    });
  });

  const resetColorsBtn = document.getElementById('reset-colors-btn');
  if (resetColorsBtn) {
    resetColorsBtn.addEventListener('click', () => {
      state.colorSettings = { ...DEFAULT_COLOR_SETTINGS };
      applyColorSettings(state.colorSettings);
      persistAndRender();
    });
  }

  // Sidebar navigation
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-target'));
    });
  });

  // Month Navigation
  document.getElementById('prev-month-btn').addEventListener('click', () => {
    selectedMonth = shiftMonth(selectedMonth, -1);
    renderAll();
  });
  document.getElementById('next-month-btn').addEventListener('click', () => {
    selectedMonth = shiftMonth(selectedMonth, 1);
    renderAll();
  });

  // Pie Chart Mode Toggle (Por Origem vs Por Categoria)
  document.querySelectorAll('[data-pie-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pieMode = btn.getAttribute('data-pie-mode');
      document.querySelectorAll('[data-pie-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      renderAll();
    });
  });

  // Form: Add Credit Card
  document.getElementById('form-add-card').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('card-name').value.trim();
    const limit = parseFloat(document.getElementById('card-limit').value);
    const closingDay = parseInt(document.getElementById('card-closing').value, 10);
    const dueDay = parseInt(document.getElementById('card-due').value, 10);
    const color = document.getElementById('card-color').value;

    if (!name || isNaN(limit)) return;
    state.cards.push({
      id: `card-${Date.now()}`,
      name,
      limit,
      closingDay: closingDay || 5,
      dueDay: dueDay || 12,
      color,
      paidMonths: []
    });
    e.target.reset();
    persistAndRender();
  });

  // Toggle installments field when card expense mode is Debit vs Credit
  const cardModeEl = document.getElementById('card-expense-mode');
  const cardInstGroup = document.getElementById('card-installments-group');
  if (cardModeEl && cardInstGroup) {
    const syncCardMode = () => {
      cardInstGroup.style.display = cardModeEl.value === 'debit' ? 'none' : '';
    };
    cardModeEl.addEventListener('change', syncCardMode);
    syncCardMode();
  }

  // Form: Add Card Expense (Crédito ou Débito)
  document.getElementById('form-add-card-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const cardId = document.getElementById('card-expense-cardId').value;
    const mode = document.getElementById('card-expense-mode')
      ? document.getElementById('card-expense-mode').value
      : 'credit';
    const description = document.getElementById('card-expense-desc').value.trim();
    const amount = parseFloat(document.getElementById('card-expense-amount').value);
    const category = document.getElementById('card-expense-category').value;
    const installments = mode === 'debit' ? 'À vista (Débito)' : document.getElementById('card-expense-installments').value.trim() || '1x';
    const date = document.getElementById('card-expense-date').value || todayISO();

    if (!cardId || !description || isNaN(amount)) return;
    state.cardExpenses.push({
      id: `ce-${Date.now()}`,
      cardId,
      mode,
      description,
      amount,
      category,
      installments,
      date,
      month: selectedMonth
    });
    e.target.reset();
    document.getElementById('card-expense-date').value = todayISO();
    if (cardModeEl && cardInstGroup) cardInstGroup.style.display = '';
    persistAndRender();
  });

  // Form: Add Pix / Dinheiro Expense
  document.getElementById('form-add-pix').addEventListener('submit', (e) => {
    e.preventDefault();
    const description = document.getElementById('pix-desc').value.trim();
    const recipient = document.getElementById('pix-recipient').value.trim();
    const amount = parseFloat(document.getElementById('pix-amount').value);
    const category = document.getElementById('pix-category').value;
    const date = document.getElementById('pix-date').value || todayISO();

    if (!description || isNaN(amount)) return;
    state.pixExpenses.push({
      id: `pix-${Date.now()}`,
      description,
      recipient,
      amount,
      category,
      date,
      month: selectedMonth
    });
    e.target.reset();
    document.getElementById('pix-date').value = todayISO();
    persistAndRender();
  });

  // Income form: toggle recurring (Salário Fixo) vs single-date fields
  const incomeCategoryEl = document.getElementById('income-category');
  const incomeRuleTypeEl = document.getElementById('income-rule-type');
  const incomeRuleDayEl = document.getElementById('income-rule-day');
  const applyIncomeFormMode = () => {
    const isSalary = incomeCategoryEl.value === 'Salário';
    document.getElementById('income-recurring-group').style.display = isSalary ? '' : 'none';
    document.getElementById('income-single-date-group').style.display = isSalary ? 'none' : '';
    const isBusiness = incomeRuleTypeEl.value === 'businessDay';
    document.getElementById('income-rule-day-label').textContent = isBusiness
      ? 'Qual dia útil? (ex: 5)'
      : 'Qual dia do mês? (ex: 20)';
    incomeRuleDayEl.max = isBusiness ? 23 : 31;
    const startEl = document.getElementById('income-start-month');
    if (!startEl.value) startEl.value = selectedMonth;
    const dateEl = document.getElementById('income-date');
    if (!dateEl.value) dateEl.value = todayISO();
  };
  incomeCategoryEl.addEventListener('change', applyIncomeFormMode);
  incomeRuleTypeEl.addEventListener('change', () => {
    incomeRuleDayEl.value = incomeRuleTypeEl.value === 'businessDay' ? 5 : 20;
    applyIncomeFormMode();
  });
  applyIncomeFormMode();

  // Form: Add Income (Entrada / Lucro Bruto)
  document.getElementById('form-add-income').addEventListener('submit', (e) => {
    e.preventDefault();
    const description = document.getElementById('income-desc').value.trim();
    const amount = parseFloat(document.getElementById('income-amount').value);
    const category = incomeCategoryEl.value;

    if (!description || isNaN(amount)) return;

    if (category === 'Salário') {
      const ruleType = incomeRuleTypeEl.value === 'fixedDay' ? 'fixedDay' : 'businessDay';
      const maxDay = ruleType === 'businessDay' ? 23 : 31;
      const day = Math.min(Math.max(parseInt(incomeRuleDayEl.value, 10) || (ruleType === 'businessDay' ? 5 : 20), 1), maxDay);
      const startMonth = document.getElementById('income-start-month').value || selectedMonth;
      state.recurringIncomes = Array.isArray(state.recurringIncomes) ? state.recurringIncomes : [];
      state.recurringIncomes.push({
        id: `ri-${Date.now()}`,
        description,
        amount,
        category: 'Salário',
        ruleType,
        day,
        startMonth,
        skippedMonths: [],
        overrides: {}
      });
    } else {
      const date = document.getElementById('income-date').value || todayISO();
      state.incomes.push({
        id: `inc-${Date.now()}`,
        description,
        amount,
        category,
        date,
        month: selectedMonth
      });
    }
    e.target.reset();
    incomeRuleDayEl.value = 5;
    document.getElementById('income-start-month').value = selectedMonth;
    document.getElementById('income-date').value = todayISO();
    applyIncomeFormMode();
    persistAndRender();
  });

  // Form: Add Debt
  document.getElementById('form-add-debt').addEventListener('submit', (e) => {
    e.preventDefault();
    const creditor = document.getElementById('debt-creditor').value.trim();
    const totalAmount = parseFloat(document.getElementById('debt-total').value);
    const paidAmount = parseFloat(document.getElementById('debt-paid').value) || 0;
    const monthlyInstallment = parseFloat(document.getElementById('debt-installment').value) || 0;
    const totalMonths = parseInt(document.getElementById('debt-total-months').value, 10) || 1;
    const startMonth = document.getElementById('debt-start-month').value || selectedMonth;
    const dueDay = parseInt(document.getElementById('debt-due-day').value, 10) || 10;

    if (!creditor || isNaN(totalAmount)) return;
    state.debts.push({
      id: `debt-${Date.now()}`,
      creditor,
      totalAmount,
      paidAmount,
      monthlyInstallment,
      totalMonths,
      startMonth,
      dueDay,
      paidMonths: [],
      status: paidAmount >= totalAmount ? 'Quitada' : 'Ativa',
      includeInCycle: true
    });
    e.target.reset();
    document.getElementById('debt-start-month').value = selectedMonth;
    persistAndRender();
  });

  // Form: Add Vault Goal (Criar Caixinha com nome, descrição, mínimo mensal e dia de alerta)
  document.getElementById('form-add-vault-goal').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('vault-goal-name').value.trim();
    const description = document.getElementById('vault-goal-desc').value.trim();
    const minMonthly = parseFloat(document.getElementById('vault-min-monthly').value) || 0;
    const dueDay = parseInt(document.getElementById('vault-due-day').value, 10) || 10;
    const targetAmount = parseFloat(document.getElementById('vault-target-amount').value) || 0;
    const initialBalance = parseFloat(document.getElementById('vault-initial-balance').value) || 0;

    if (!name) return;
    state.vaultGoals = Array.isArray(state.vaultGoals) ? state.vaultGoals : [];
    state.vaultGoals.push({
      id: `vg-${Date.now()}`,
      name,
      description,
      minMonthly,
      dueDay,
      targetAmount,
      initialBalance,
      createdAt: new Date().toISOString()
    });
    e.target.reset();
    document.getElementById('vault-due-day').value = 10;
    document.getElementById('vault-initial-balance').value = 0;
    persistAndRender();
  });

  // Form: Vault Movement (Depósito confirmado que desconta do bruto no mês / Resgate manual)
  document.getElementById('form-vault-movement').addEventListener('submit', (e) => {
    e.preventDefault();
    const goalId = document.getElementById('vault-move-goalId').value;
    const type = document.getElementById('vault-move-type').value;
    const amount = parseFloat(document.getElementById('vault-move-amount').value);
    const description = document.getElementById('vault-move-desc').value.trim();
    const date = document.getElementById('vault-move-date').value || todayISO();

    if (!goalId || isNaN(amount) || !description) return;
    state.vaultMovements = Array.isArray(state.vaultMovements) ? state.vaultMovements : [];
    state.vaultMovements.push({
      id: `vm-${Date.now()}`,
      goalId,
      type,
      amount,
      description,
      date,
      month: selectedMonth
    });
    e.target.reset();
    document.getElementById('vault-move-date').value = todayISO();
    persistAndRender();
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', initApp);
