/**
 * ==========================================================================
 *  XODIMLAR MONITORING PANELI — FRONTEND MANTIG'I (script.js)
 * ==========================================================================
 *  Bitta umumiy parol bilan kirilгаn ichki monitoring paneli.
 *
 *  FILTR MANTIG'I (backend — xodim.gs — bilan mos):
 *   - "Oxirgi hisobot" / aniq sana: Baza'dagi o'sha kungi yozuvlar
 *     O'ZGARTIRISHSIZ (Ball, O'rin va h.k. to'g'ridan-to'g'ri Baza'dan).
 *   - "Oy": shu oy ichida yuborilgan barcha xodimlar (distinct), har biri
 *     uchun O'ZINING shu oy ichidagi ENG SO'NGGI hisoboti ko'rsatiladi
 *     (o'rtacha emas).
 *   - "Hammasi": faqat "actives" ro'yxatidagi xodimlar; Savdo soni — har
 *     oyning oxirgi hisobotidagi qiymatlar YIG'INDISI; Ball/Savdo
 *     plan/PAR-31% — shu oylik yakuniy qiymatlarning O'RTACHASI.
 *
 *  Qatorga bosilganda ochiladigan diagramma:
 *   - Bitta sana tanlangan bo'lsa — ishlamaydi.
 *   - Oy tanlangan bo'lsa — shu oy ichidagi HAR BIR KUN bo'yicha (Baza'da
 *     saqlangan O'rin ustunidan to'g'ridan-to'g'ri).
 *   - Hammasi tanlangan bo'lsa — HAR OY bo'yicha (shu oyning oxirgi
 *     hisobotidagi O'rin qiymatidan).
 * ==========================================================================
 */

// >>> MUHIM: admin yuklash vositasi bilan BIR XIL Web App URL <<<
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx1AGKwbMWg4DK0WSNr8lX4mtf_OkbHtOi0S2pIX6CWp-twiU_L0EE8CkRuaUb4duRHMg/exec';

// ---- DOM elementlari: PAROL ----
const authGate = document.getElementById('authGate');
const authForm = document.getElementById('authForm');
const authPasswordInput = document.getElementById('authPasswordInput');
const authError = document.getElementById('authError');
const authSubmitBtn = document.getElementById('authSubmitBtn');

// ---- DOM elementlari: DASHBOARD ----
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');

const summaryTotal = document.getElementById('summaryTotal');
const summaryAvgBall = document.getElementById('summaryAvgBall');
const summaryTopName = document.getElementById('summaryTopName');

const filterChips = document.querySelectorAll('.filter-chip');
const monthFilterInput = document.getElementById('monthFilterInput');
const dateDropdown = document.getElementById('dateDropdown');
const tableSearchInput = document.getElementById('tableSearchInput');

const ballColumnHeader = document.getElementById('ballColumnHeader');
const savdoSoniColumnHeader = document.getElementById('savdoSoniColumnHeader');
const savdoPlanColumnHeader = document.getElementById('savdoPlanColumnHeader');
const par31ColumnHeader = document.getElementById('par31ColumnHeader');
const leaderboardStatus = document.getElementById('leaderboardStatus');
const leaderboardBody = document.getElementById('leaderboardBody');

const employeeChartModal = document.getElementById('employeeChartModal');
const chartModalName = document.getElementById('chartModalName');
const chartModalFilial = document.getElementById('chartModalFilial');
const chartModalCloseBtn = document.getElementById('chartModalCloseBtn');
const chartModalEmpty = document.getElementById('chartModalEmpty');
const chartModalSvgWrapper = document.getElementById('chartModalSvgWrapper');

// ---- Joriy holat ----
let currentPassword = null;
let currentFilter = 'LAST_REPORT';
let latestLeaderboard = [];

// ==========================================================================
// PAROL BILAN KIRISH
// ==========================================================================

authPasswordInput.focus();

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = authPasswordInput.value.trim();

  if (!password) {
    showAuthError('Iltimos, parolni kiriting.');
    return;
  }

  setAuthLoading(true);
  hideAuthError();

  const result = await fetchLeaderboard(password, currentFilter);

  setAuthLoading(false);

  if (result.status === 'success') {
    currentPassword = password;
    enterDashboard(result);
  } else {
    showAuthError(result.message || "Parol noto'g'ri.");
    authPasswordInput.value = '';
    authPasswordInput.focus();
  }
});

logoutBtn.addEventListener('click', () => {
  currentPassword = null;
  authPasswordInput.value = '';
  resetFilterUI();
  dashboard.classList.add('hidden');
  authGate.classList.remove('hidden');
  authPasswordInput.focus();
});

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
}

function hideAuthError() {
  authError.classList.add('hidden');
}

function setAuthLoading(isLoading) {
  authSubmitBtn.disabled = isLoading;
  authSubmitBtn.querySelector('.btn-label').textContent = isLoading ? 'Tekshirilmoqda...' : 'Kirish';
  authSubmitBtn.querySelector('.btn-spinner').classList.toggle('hidden', !isLoading);
}

// ==========================================================================
// FILTRLAR
// ==========================================================================

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    monthFilterInput.value = '';
    dateDropdown.value = '';
    setFilter(chip.dataset.filter);
  });
});

monthFilterInput.addEventListener('change', () => {
  if (!monthFilterInput.value) return;
  filterChips.forEach((c) => c.classList.remove('active'));
  dateDropdown.value = '';
  setFilter(`MONTH:${monthFilterInput.value}`);
});

dateDropdown.addEventListener('change', () => {
  if (!dateDropdown.value) return;
  filterChips.forEach((c) => c.classList.remove('active'));
  monthFilterInput.value = '';
  setFilter(dateDropdown.value);
});

function resetFilterUI() {
  currentFilter = 'LAST_REPORT';
  filterChips.forEach((c) => c.classList.toggle('active', c.dataset.filter === 'LAST_REPORT'));
  monthFilterInput.value = '';
  dateDropdown.value = '';
  tableSearchInput.value = '';
}

async function setFilter(filterValue) {
  currentFilter = filterValue;
  if (!currentPassword) return;

  showLeaderboardStatus('info', 'Ma\'lumotlar yuklanmoqda...');
  const result = await fetchLeaderboard(currentPassword, currentFilter);

  if (result.status === 'success') {
    hideLeaderboardStatus();
    applyDashboardData(result);
  } else {
    showLeaderboardStatus('error', result.message || "Ma'lumotlarni yuklab bo'lmadi.");
  }
}

// ==========================================================================
// JADVAL ICHIDA QIDIRISH
// ==========================================================================

tableSearchInput.addEventListener('input', () => {
  const query = tableSearchInput.value.trim().toLowerCase();
  const filtered = query
    ? latestLeaderboard.filter((row) => row.fish.toLowerCase().includes(query))
    : latestLeaderboard;
  renderLeaderboard(filtered);
});

// ==========================================================================
// SERVERGA SO'ROV
// ==========================================================================

async function fetchLeaderboard(password, dateFilter) {
  if (GAS_WEB_APP_URL.includes('AKfycb...')) {
    return { status: 'error', message: "GAS_WEB_APP_URL sozlanmagan. script.js faylida Web App URL'ni kiriting." };
  }

  try {
    const url = `${GAS_WEB_APP_URL}?password=${encodeURIComponent(password)}&dateFilter=${encodeURIComponent(dateFilter)}`;
    const response = await fetch(url);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: "Serverga ulanib bo'lmadi: " + err.message };
  }
}

// ==========================================================================
// DASHBOARD'GA KIRISH VA TO'LDIRISH
// ==========================================================================

function enterDashboard(result) {
  authGate.classList.add('hidden');
  dashboard.classList.remove('hidden');
  resetFilterUI();
  applyDashboardData(result);
}

function applyDashboardData(result) {
  updateColumnLabels(result.leaderboardMode);
  latestLeaderboard = result.leaderboard || [];
  tableSearchInput.value = '';
  renderLeaderboard(latestLeaderboard);
  updateSummary(latestLeaderboard);
  populateDateDropdown(result.availableDates);
}

/**
 * Ustun sarlavhalarini backend'dan kelgan "leaderboardMode" asosida
 * to'g'rilaydi:
 *  - 'exact'    -> aniq kunlik qiymatlar (qo'shimcha izohsiz)
 *  - 'month_end'-> oyning oxirgi hisobotidagi qiymat
 *  - 'all_time' -> Ball/Savdo plan/PAR o'rtacha, Savdo soni esa yig'indi
 */
function updateColumnLabels(mode) {
  if (mode === 'month_end') {
    ballColumnHeader.textContent = "Ball (oy oxiri)";
    savdoSoniColumnHeader.textContent = "Savdo soni (oy oxiri)";
    savdoPlanColumnHeader.textContent = "Savdo plan % (oy oxiri)";
    par31ColumnHeader.textContent = "PAR-31 % (oy oxiri)";
  } else if (mode === 'all_time') {
    ballColumnHeader.textContent = "Ball (o'rtacha)";
    savdoSoniColumnHeader.textContent = "Savdo soni (yig'indi)";
    savdoPlanColumnHeader.textContent = "Savdo plan % (o'rtacha)";
    par31ColumnHeader.textContent = "PAR-31 % (o'rtacha)";
  } else {
    ballColumnHeader.textContent = 'Ball';
    savdoSoniColumnHeader.textContent = 'Savdo soni';
    savdoPlanColumnHeader.textContent = 'Savdo plan %';
    par31ColumnHeader.textContent = 'PAR-31 %';
  }
}

function updateSummary(leaderboard) {
  summaryTotal.textContent = leaderboard.length;

  if (leaderboard.length === 0) {
    summaryAvgBall.textContent = '—';
    summaryTopName.textContent = '—';
    return;
  }

  const avgBall = leaderboard.reduce((sum, row) => sum + row.ball, 0) / leaderboard.length;
  summaryAvgBall.textContent = formatNumber(avgBall.toFixed(1));

  const top = leaderboard.find((row) => row.rank === 1) || leaderboard[0];
  summaryTopName.textContent = top.fish;
}

function populateDateDropdown(availableDates) {
  if (!availableDates) return;

  const currentValue = dateDropdown.value;
  dateDropdown.innerHTML = '<option value="">Aniq sana...</option>';

  availableDates.forEach((dateKey) => {
    const option = document.createElement('option');
    option.value = dateKey;
    option.textContent = formatDateDisplay(dateKey);
    dateDropdown.appendChild(option);
  });

  dateDropdown.value = currentValue;
}

function formatDateDisplay(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function renderLeaderboard(leaderboard) {
  leaderboardBody.innerHTML = '';

  if (!leaderboard || leaderboard.length === 0) {
    showLeaderboardStatus('info', "Mos ma'lumot topilmadi.");
    return;
  }
  hideLeaderboardStatus();

  leaderboard.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${escapeHtml(row.fish)}</td>
      <td>${escapeHtml(row.filial)}</td>
      <td>${formatNumber(row.ball)}</td>
      <td>${formatNumber(row.savdoSoni)}</td>
      <td>${formatNumber(row.savdoPlan)}%</td>
      <td>${formatNumber(row.par31)}%</td>
    `;
    tr.addEventListener('click', () => openEmployeeChart(row));
    leaderboardBody.appendChild(tr);
  });
}

// ==========================================================================
// XODIM DIAGRAMMASI (MODAL)
// ==========================================================================

chartModalCloseBtn.addEventListener('click', closeEmployeeChart);
employeeChartModal.addEventListener('click', (e) => {
  if (e.target === employeeChartModal) closeEmployeeChart();
});

function openEmployeeChart(row) {
  chartModalName.textContent = row.fish;
  chartModalFilial.textContent = row.filial;
  employeeChartModal.classList.remove('hidden');
  renderChart(row.series);
}

function closeEmployeeChart() {
  employeeChartModal.classList.add('hidden');
}

function renderChart(series) {
  chartModalSvgWrapper.innerHTML = '';

  if (!series || series.length === 0) {
    chartModalEmpty.classList.remove('hidden');
    return;
  }
  chartModalEmpty.classList.add('hidden');

  const width = Math.max(360, series.length * 46);
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 34 };
  const maxRank = Math.max(...series.map((p) => p.rank || 1), 5);

  const xStep = (width - padding.left - padding.right) / Math.max(series.length - 1, 1);
  const yFor = (rank) => padding.top + ((rank - 1) / (maxRank - 1 || 1)) * (height - padding.top - padding.bottom);
  const xFor = (idx) => padding.left + idx * xStep;

  const points = series.map((p, idx) => ({ x: xFor(idx), y: yFor(p.rank || maxRank), rank: p.rank, date: p.date }));
  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const pathLength = points.length * 60;
  const bestRank = Math.min(...series.map((s) => s.rank || Infinity));

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  svg += `<path class="chart-line" d="${pathD}" stroke-dasharray="${pathLength}" stroke-dashoffset="${pathLength}">
    <animate attributeName="stroke-dashoffset" from="${pathLength}" to="0" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
  </path>`;

  points.forEach((p, idx) => {
    const isBest = p.rank === bestRank;
    svg += `<circle class="chart-point ${isBest ? 'is-best' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4">
      <animate attributeName="r" from="0" to="4" dur="0.3s" begin="${0.03 * idx}s" fill="freeze"/>
    </circle>`;
    svg += `<text class="chart-rank-label" x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle">${p.rank ?? '—'}</text>`;
    svg += `<text class="chart-axis-label" x="${p.x.toFixed(1)}" y="${height - 8}" text-anchor="middle">${formatAxisLabel(p.date)}</text>`;
  });

  svg += '</svg>';
  chartModalSvgWrapper.innerHTML = svg;
}

/**
 * "Oy" diagrammasida kun.oy (masalan "06.07"), "Hammasi" diagrammasida
 * oy.yil (masalan "07.2026") ko'rinishida ko'rsatadi — sana uzunligiga
 * qarab avtomatik aniqlanadi.
 */
function formatAxisLabel(isoDate) {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [, month, day] = parts;
    return `${day}.${month}`;
  }
  const [year, month] = parts;
  return `${month}.${year}`;
}

// ==========================================================================
// YORDAMCHI FUNKSIYALAR
// ==========================================================================

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('uz-UZ');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showLeaderboardStatus(type, message) {
  leaderboardStatus.textContent = message;
  leaderboardStatus.className = `status-box status-${type}`;
  leaderboardStatus.classList.remove('hidden');
}

function hideLeaderboardStatus() {
  leaderboardStatus.classList.add('hidden');
}
