import { FinanceAuthAndStorageService, DEFAULT_FIREBASE_CONFIG } from './firebase-service.js';

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const todayISO = () => new Date().toISOString().split('T')[0];

const getInitialSeedData = () => {
  return {
    incomes: [],
    cards: [],
    cardExpenses: [],
    pixExpenses: [],
    debts: [],
    vaultGoals: [],
    vaultMovements: [],
    recurringIncomes: []
  };
};

// State
let state = getInitialSeedData();
let selectedMonth = currentMonthKey();
let pieMode = 'origin'; // 'origin' | 'category'
let activeUser = null;
let activeProfile = null;

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
        recurringIncomes: remoteData.recurringIncomes || []
      };
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

function handleAuthChange(user, profile) {
  const overlay = document.getElementById('auth-overlay');
  const badge = document.getElementById('user-profile-badge');
  const nameEl = document.getElementById('user-display-name');
  const metaEl = document.getElementById('user-display-meta');
  const firebaseStatusDot = document.getElementById('firebase-status-dot');
  const firebaseStatusText = document.getElementById('firebase-status-text');

  if (user) {
    overlay.classList.add('hidden');
    badge.style.display = 'flex';
    const displayName = (profile && profile.name) || user.displayName || 'Usuário';
    const displayAge = (profile && profile.age) ? ` • ${profile.age} anos` : '';
    nameEl.textContent = displayName;
    metaEl.textContent = `${user.email}${displayAge}`;

    firebaseStatusDot.classList.add('connected');
    firebaseStatusText.textContent = `Online: ${user.email}`;

    // Carrega dados específicos desse usuário
    state = authService.loadUserData(user.uid, getInitialSeedData());
    renderAll();
  } else {
    overlay.classList.remove('hidden');
    badge.style.display = 'none';
    firebaseStatusDot.classList.remove('connected');
    firebaseStatusText.textContent = 'Não autenticado';
  }
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

  // Auto preenchimento mensal de dívidas ativas:
  // Se a dívida dura N meses (ex: 10 meses a partir do mês X),
  // ela aparece em todo mês do intervalo até ser quitada 100% ou excluída.
  const activeDebts = state.debts.filter((d) => {
    const remaining = Math.max(0, Number(d.totalAmount || 0) - Number(d.paidAmount || 0));
    if (remaining <= 0 || d.status === 'Quitada') return false;

    // Se possui mês de início definido
    if (d.startMonth) {
      if (ym < d.startMonth) return false; // Ainda não começou
      if (d.totalMonths && Number(d.totalMonths) > 0) {
        // Calcula até qual mês a dívida se estende
        const [sy, sm] = d.startMonth.split('-').map(Number);
        const [cy, cm] = ym.split('-').map(Number);
        const diffMonths = (cy - sy) * 12 + (cm - sm);
        if (diffMonths >= Number(d.totalMonths)) return false; // Passou dos N meses
      }
    }
    return d.includeInCycle !== false;
  });

  const totalIncome = incomes.reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const totalPix = pixExpenses.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalCards = cardExpenses.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const totalDebtMonth = activeDebts.reduce((acc, d) => acc + Number(d.monthlyInstallment || 0), 0);

  const totalExpenses = totalPix + totalCards + totalDebtMonth;
  const freeBalance = totalIncome - totalExpenses;

  return {
    incomes,
    pixExpenses,
    cardExpenses,
    activeDebts,
    totalIncome,
    totalPix,
    totalCards,
    totalDebtMonth,
    totalExpenses,
    freeBalance
  };
}

// Build Pie Slices where Total Income = 100% of the Pie Chart (or Total Expenses if Income is exceeded)
function buildPieData(summary) {
  const { totalIncome, totalPix, totalCards, totalDebtMonth, totalExpenses, freeBalance, pixExpenses, cardExpenses, activeDebts } = summary;
  const maxRef = Math.max(totalIncome, totalExpenses, 1);

  if (pieMode === 'origin') {
    const slices = [
      { label: 'Gastos no Pix (Fora de Cartão)', value: totalPix, color: '#0ea5e9', type: 'expense' },
      { label: 'Faturas de Cartões', value: totalCards, color: '#f59e0b', type: 'expense' },
      { label: 'Dívidas / Parcelas do Mês', value: totalDebtMonth, color: '#f43f5e', type: 'expense' }
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

    const slices = Object.entries(catMap)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val], idx) => ({
        label: cat,
        value: val,
        color: cat === 'Dívidas / Acordos' ? '#f43f5e' : palette[idx % palette.length],
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

// Render Overview & Recent Transactions
function renderOverview(summary) {
  const { totalIncome, totalPix, totalCards, totalDebtMonth, totalExpenses, freeBalance } = summary;

  document.getElementById('kpi-income').textContent = formatBRL(totalIncome);
  document.getElementById('kpi-income-sub').textContent = `${summary.incomes.filter(i => !i.skipped).length} entrada(s) no mês`;

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

  // Render Pie Chart
  renderPieSVG(summary);

  // Render Side Summary Panel (Cards Limit + Debts + Pix Breakdown)
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
        <span>Total Gasto Fora de Cartão (Pix)</span>
        <strong style="color: var(--sky)">${formatBRL(totalPix)}</strong>
      </div>
      <button class="btn btn-secondary btn-sm" data-goto="pix-view">+ Registrar Pix</button>
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
  `;

  // Bind quick navigation buttons
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-goto')));
  });

  // Render Unified Recent Movements Table
  const movements = [
    ...summary.incomes.map((i) => ({ ...i, kind: 'Entrada', tagClass: 'income', sign: '+' })),
    ...summary.pixExpenses.map((p) => ({ ...p, kind: 'Pix / À Vista', tagClass: 'pix', sign: '-' })),
    ...summary.cardExpenses.map((c) => {
      const card = state.cards.find((k) => k.id === c.cardId);
      return {
        ...c,
        kind: card ? `Cartão: ${card.name}` : 'Cartão',
        tagClass: 'card',
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
        const cardItems = summary.cardExpenses.filter((ce) => ce.cardId === card.id);
        const invoiceAmount = cardItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
        const limit = Number(card.limit || 1);
        const available = Math.max(0, limit - invoiceAmount);
        const usagePct = Math.min(100, Math.round((invoiceAmount / limit) * 100));
        const isPaid = Array.isArray(card.paidMonths) && card.paidMonths.includes(selectedMonth);

        const barColor = usagePct > 85 ? 'var(--coral)' : usagePct > 60 ? 'var(--amber)' : 'var(--emerald)';

        return `
          <div class="credit-card-item">
            <div class="credit-card-visual" style="background: linear-gradient(135deg, ${card.color || '#0f766e'}, #0f172a);">
              <div class="card-visual-top">
                <span class="card-brand-name">${card.name}</span>
                <span class="card-status-pill">${isPaid ? 'Fatura Paga' : 'Fatura Aberta'}</span>
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
                  <span>Usado na fatura (${usagePct}%)</span>
                  <strong>Disponível: ${formatBRL(available)}</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${usagePct}%; background-color: ${barColor}"></div>
                </div>
              </div>

              <div class="card-invoice-box">
                <div>
                  <div class="label">Fatura de ${formatMonthLabel(selectedMonth)}</div>
                  <div class="amount" style="color: ${isPaid ? 'var(--emerald)' : 'var(--amber)'}">${formatBRL(invoiceAmount)}</div>
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
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum gasto de cartão registrado neste mês.</td></tr>`;
  } else {
    tbody.innerHTML = summary.cardExpenses
      .map((item) => {
        const card = state.cards.find((c) => c.id === item.cardId);
        return `
          <tr>
            <td><strong>${item.description}</strong></td>
            <td><span class="tag card">${card ? card.name : 'Cartão'}</span></td>
            <td>${item.category}</td>
            <td><span class="tag">${item.installments || '1x'}</span></td>
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
  document.getElementById('pix-total-badge').textContent = formatBRL(summary.totalPix);

  if (summary.pixExpenses.length === 0) {
    pixTbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum gasto no Pix registrado neste mês.</td></tr>`;
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

      // Verifica se o usuário marcou a parcela deste mês como paga
      const paidMonthsList = Array.isArray(d.paidMonths) ? d.paidMonths : [];
      const isPaidInThisMonth = paidMonthsList.includes(selectedMonth);

      const monthsInfo = d.totalMonths ? ` (${d.totalMonths} meses previstos)` : '';
      const startInfo = d.startMonth ? `Início: ${formatMonthLabel(d.startMonth)}` : '';

      return `
        <tr>
          <td>
            <strong>${d.creditor}</strong>
            <div style="font-size: 0.74rem; color: var(--text-secondary)">${startInfo}${monthsInfo} • ${pctPaid}% quitado</div>
          </td>
          <td style="font-family: var(--font-mono)">${formatBRL(d.totalAmount)}</td>
          <td style="font-family: var(--font-mono); color: var(--emerald)">${formatBRL(d.paidAmount)}</td>
          <td style="font-family: var(--font-mono); color: var(--coral); font-weight:700">${formatBRL(remaining)}</td>
          <td style="font-family: var(--font-mono)">
            ${formatBRL(d.monthlyInstallment)}/mês
            <div style="font-size: 0.72rem; color: ${isPaidInThisMonth ? 'var(--emerald)' : 'var(--amber)'}">
              ${isPaidInThisMonth ? '✓ Parcela deste mês Paga' : '○ Parcela deste mês Pendente'}
            </div>
          </td>
          <td><span class="tag ${isQuitada ? 'income' : 'debt'}">${isQuitada ? 'Quitada' : 'Ativa'}</span></td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap: wrap">
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

// Render Cofrinho & Reservas
function renderVaultView() {
  const goalsContainer = document.getElementById('vault-goals-container');
  const movementsTbody = document.getElementById('vault-movements-tbody');
  const selectGoal = document.getElementById('vault-move-goalId');

  const goals = Array.isArray(state.vaultGoals) ? state.vaultGoals : [];
  const movements = Array.isArray(state.vaultMovements) ? state.vaultMovements : [];

  // Calcula saldos de cada meta somando saldo inicial + depósitos - resgates
  const goalBalances = {};
  goals.forEach((g) => {
    goalBalances[g.id] = Number(g.initialBalance || 0);
  });

  let totalDeposited = 0;
  let totalWithdrawn = 0;

  movements.forEach((m) => {
    const val = Number(m.amount || 0);
    if (m.type === 'deposit') {
      goalBalances[m.goalId] = (goalBalances[m.goalId] || 0) + val;
      totalDeposited += val;
    } else if (m.type === 'withdraw') {
      goalBalances[m.goalId] = Math.max(0, (goalBalances[m.goalId] || 0) - val);
      totalWithdrawn += val;
    }
  });

  const totalSaved = Object.values(goalBalances).reduce((acc, b) => acc + b, 0);

  // KPIs do Cofrinho
  document.getElementById('vault-total-saved').textContent = formatBRL(totalSaved);
  document.getElementById('vault-total-in').textContent = formatBRL(totalDeposited);
  document.getElementById('vault-total-out').textContent = formatBRL(totalWithdrawn);
  document.getElementById('vault-active-goals').textContent = String(goals.length);
  document.getElementById('nav-badge-vault').textContent = formatBRL(totalSaved);

  // Preenche select do formulário de movimentação
  if (goals.length === 0) {
    selectGoal.innerHTML = `<option value="">Crie um cofrinho primeiro</option>`;
  } else {
    selectGoal.innerHTML = goals
      .map((g) => `<option value="${g.id}">${g.name} (Atual: ${formatBRL(goalBalances[g.id] || 0)})</option>`)
      .join('');
  }

  // Cards das Caixinhas do Cofrinho
  if (goals.length === 0) {
    goalsContainer.innerHTML = `<div class="panel empty-state">Nenhum cofrinho ou reserva criada ainda. Crie sua primeira caixinha (ex: Reserva de Emergência) acima.</div>`;
  } else {
    goalsContainer.innerHTML = goals
      .map((g) => {
        const bal = goalBalances[g.id] || 0;
        const target = Number(g.targetAmount || 0);
        const hasTarget = target > 0;
        const pct = hasTarget ? Math.min(100, Math.round((bal / target) * 100)) : 100;

        return `
          <div class="credit-card-item">
            <div class="credit-card-visual" style="background: linear-gradient(135deg, #065f46, #0f172a); min-height: 120px">
              <div class="card-visual-top">
                <span class="card-brand-name">&#128176; ${g.name}</span>
                <span class="card-status-pill">${hasTarget ? `${pct}% da meta` : 'Sem teto'}</span>
              </div>
              <div style="margin-top: 14px">
                <span style="font-size: 0.74rem; opacity: 0.8">Saldo Guardado</span>
                <strong style="font-family: var(--font-mono); font-size: 1.35rem; display: block">${formatBRL(bal)}</strong>
              </div>
            </div>
            <div class="credit-card-body">
              ${
                hasTarget
                  ? `
                  <div class="limit-labels">
                    <span>Meta: ${formatBRL(target)}</span>
                    <strong>Falta: ${formatBRL(Math.max(0, target - bal))}</strong>
                  </div>
                  <div class="progress-track" style="margin-bottom: 8px">
                    <div class="progress-fill" style="width: ${pct}%; background-color: var(--emerald)"></div>
                  </div>
                  `
                  : ''
              }
              <div class="card-actions">
                <button class="btn btn-danger btn-sm" data-del-vault-goal="${g.id}">Excluir Cofrinho</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

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
    movementsTbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhuma movimentação manual no cofrinho até o momento.</td></tr>`;
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
            <td><span class="tag">${g ? g.name : 'Cofrinho'}</span></td>
            <td><span class="tag ${isDep ? 'income' : 'debt'}">${isDep ? 'Depósito (+)' : 'Resgate (-)'}</span></td>
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
  renderVaultView();
  updateFirebaseStatusBadge();
}

function updateFirebaseStatusBadge() {
  const dot = document.getElementById('firebase-status-dot');
  const label = document.getElementById('firebase-status-text');
  if (activeUser) {
    dot.classList.add('connected');
    label.textContent = `Online: ${activeUser.email}`;
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

  // Tabs do Modal de Autenticação (Entrar vs Criar Conta)
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('form-auth-login');
  const formRegister = document.getElementById('form-auth-register');
  const authSubtitle = document.getElementById('auth-subtitle');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'flex';
    formRegister.style.display = 'none';
    authSubtitle.textContent = 'Entre na sua conta para acessar seu controle financeiro';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formLogin.style.display = 'none';
    formRegister.style.display = 'flex';
    authSubtitle.textContent = 'Preencha seus dados para criar sua conta';
  });

  // Form: Login
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('login-feedback');
    feedback.textContent = 'Autenticando...';
    feedback.style.color = 'var(--amber)';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      await authService.loginUser(email, password);
      feedback.textContent = 'Login efetuado com sucesso!';
      feedback.style.color = 'var(--emerald)';
    } catch (err) {
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = 'var(--coral)';
    }
  });

  // Form: Registro (com Nome e Idade)
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('reg-feedback');
    feedback.textContent = 'Criando conta no Firebase...';
    feedback.style.color = 'var(--amber)';

    const name = document.getElementById('reg-name').value.trim();
    const age = parseInt(document.getElementById('reg-age').value, 10);
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      await authService.registerUser({ name, age, email, password }, state);
      feedback.textContent = 'Conta criada com sucesso!';
      feedback.style.color = 'var(--emerald)';
    } catch (err) {
      feedback.textContent = `Erro: ${err.message}`;
      feedback.style.color = 'var(--coral)';
    }
  });

  // Botão Sair da Conta
  document.getElementById('user-logout-btn').addEventListener('click', async () => {
    await authService.logout();
  });

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

  // Form: Add Card Expense
  document.getElementById('form-add-card-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const cardId = document.getElementById('card-expense-cardId').value;
    const description = document.getElementById('card-expense-desc').value.trim();
    const amount = parseFloat(document.getElementById('card-expense-amount').value);
    const category = document.getElementById('card-expense-category').value;
    const installments = document.getElementById('card-expense-installments').value.trim() || '1x';
    const date = document.getElementById('card-expense-date').value || todayISO();

    if (!cardId || !description || isNaN(amount)) return;
    state.cardExpenses.push({
      id: `ce-${Date.now()}`,
      cardId,
      description,
      amount,
      category,
      installments,
      date,
      month: selectedMonth
    });
    e.target.reset();
    document.getElementById('card-expense-date').value = todayISO();
    persistAndRender();
  });

  // Form: Add Pix Expense
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

  // Form: Add Vault Goal (Cofrinho)
  document.getElementById('form-add-vault-goal').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('vault-goal-name').value.trim();
    const targetAmount = parseFloat(document.getElementById('vault-target-amount').value) || 0;
    const initialBalance = parseFloat(document.getElementById('vault-initial-balance').value) || 0;

    if (!name) return;
    state.vaultGoals = Array.isArray(state.vaultGoals) ? state.vaultGoals : [];
    state.vaultGoals.push({
      id: `vg-${Date.now()}`,
      name,
      targetAmount,
      initialBalance,
      createdAt: new Date().toISOString()
    });
    e.target.reset();
    persistAndRender();
  });

  // Form: Vault Movement (Depósito / Resgate manual)
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
      date
    });
    e.target.reset();
    document.getElementById('vault-move-date').value = todayISO();
    persistAndRender();
  });

  // Clear Sample Data Button
  document.getElementById('clear-sample-btn').addEventListener('click', () => {
    state = { incomes: [], cards: [], cardExpenses: [], pixExpenses: [], debts: [], vaultGoals: [], vaultMovements: [] };
    persistAndRender();
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', initApp);
