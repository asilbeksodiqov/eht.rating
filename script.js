/**
 * ==========================================================================
 *  XODIMLAR DASHBOARD PORTALI — FRONTEND MANTIG'I (script.js)
 * ==========================================================================
 *  Vazifalari:
 *   1. Sahifa ochilganda "actives" ro'yxatidagi barcha FISh'larni (parolsiz)
 *      oldindan yuklab oladi — qidiruv/autocomplete uchun.
 *   2. Ism qidiruv maydoni + parol (birinchi marta bo'lsa — shu kodni
 *      parol qilib saqlaydi).
 *   3. Sana filtri: "Oxirgi hisobot" (default), "Hammasi", oy tanlash,
 *      yoki Baza'da mavjud aniq sanalar ro'yxatidan biri.
 *   4. Yakka sana — aniq qiymatlar. Oy/Hammasi — o'rtacha (KPI kartalar
 *      HAM, reyting jadvalidagi Ball ustuni HAM), buni "(o'rtacha)" /
 *      "(o'rtacha kunlik)" yorlig'i bilan ko'rsatadi.
 *   5. Xodimning joriy o'rnini header'da ko'rsatadi.
 *   6. So'rovchi xodimning reytingdagi qatorini ajratib ko'rsatadi.
 *   7. Xodim ismidan dinamik suv belgisini (watermark) generatsiya qiladi.
 * ==========================================================================
 */

// >>> MUHIM: admin yuklash vositasi bilan BIR XIL Web App URL <<<
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzHC3zi7BXbnlnsyDEEbwEGUfkCwOdy2T_F-VtryX0jOlWZ2mEJr78xKAhUeCfk1Lgdjg/exec';

// "Parolni unutdingizmi?" tugmasi yo'naltiradigan Telegram admin akkaunti.
const ADMIN_TELEGRAM_USERNAME = 'asilbek_sodiqov';

// ---- DOM elementlari: LOGIN ----
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const fishSearchInput = document.getElementById('fishSearchInput');
const fishSuggestions = document.getElementById('fishSuggestions');
const loginPasswordInput = document.getElementById('loginPasswordInput');
const loginHint = document.getElementById('loginHint');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

// ---- DOM elementlari: DASHBOARD ----
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');
const avatarInitials = document.getElementById('avatarInitials');
const myNameLabel = document.getElementById('myNameLabel');
const myFilialLabel = document.getElementById('myFilialLabel');
const myRankValue = document.getElementById('myRankValue');

const kpiBall = document.getElementById('kpiBall');
const kpiSavdoSoni = document.getElementById('kpiSavdoSoni');
const kpiSavdoPlan = document.getElementById('kpiSavdoPlan');
const kpiPar31 = document.getElementById('kpiPar31');
const ballSuffix = document.getElementById('ballSuffix');
const savdoSoniSuffix = document.getElementById('savdoSoniSuffix');
const savdoPlanSuffix = document.getElementById('savdoPlanSuffix');
const par31Suffix = document.getElementById('par31Suffix');
const medalRank1 = document.getElementById('medalRank1');
const medalRank2 = document.getElementById('medalRank2');
const medalRank3 = document.getElementById('medalRank3');

const filterChips = document.querySelectorAll('.filter-chip');
const monthFilterInput = document.getElementById('monthFilterInput');
const dateDropdown = document.getElementById('dateDropdown');
const ballColumnHeader = document.getElementById('ballColumnHeader');
const leaderboardStatus = document.getElementById('leaderboardStatus');
const leaderboardBody = document.getElementById('leaderboardBody');

const listViewBtn = document.getElementById('listViewBtn');
const chartViewBtn = document.getElementById('chartViewBtn');
const listView = document.getElementById('listView');
const chartView = document.getElementById('chartView');
const chartEmptyState = document.getElementById('chartEmptyState');
const chartSvgWrapper = document.getElementById('chartSvgWrapper');

const confettiContainer = document.getElementById('confettiContainer');
const celebrationModal = document.getElementById('celebrationModal');
const celebrationCloseBtn = document.getElementById('celebrationCloseBtn');

const watermarkOverlay = document.getElementById('watermarkOverlay');

// ---- Joriy holat ----
let allEmployeeNames = [];
let selectedFish = null;
let currentPassword = null;
let currentFilter = 'LAST_REPORT';
let activeSuggestionIndex = -1;
let currentView = 'list'; // 'list' | 'chart'
let latestRankSeries = [];

// ==========================================================================
// ISHGA TUSHIRISH: ISMLAR RO'YXATINI OLDINDAN YUKLASH
// ==========================================================================

loadEmployeeNames();

async function loadEmployeeNames() {
  if (GAS_WEB_APP_URL.includes('AKfycb...')) return;

  try {
    const response = await fetch(`${GAS_WEB_APP_URL}?action=listNames`);
    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.names)) {
      allEmployeeNames = result.names;
    }
  } catch (err) {
    // Jimgina o'tkazib yuboramiz.
  }
}

// ==========================================================================
// ISM QIDIRUV (AUTOCOMPLETE)
// ==========================================================================

fishSearchInput.addEventListener('input', () => {
  selectedFish = null;
  lockPasswordStage();

  const query = fishSearchInput.value.trim().toLowerCase();
  if (!query) {
    hideSuggestions();
    return;
  }

  const matches = allEmployeeNames
    .filter((name) => name.toLowerCase().includes(query))
    .slice(0, 8);

  renderSuggestions(matches);
});

fishSearchInput.addEventListener('keydown', (e) => {
  const items = fishSuggestions.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
    highlightSuggestion(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    highlightSuggestion(items);
  } else if (e.key === 'Enter' && activeSuggestionIndex !== -1) {
    e.preventDefault();
    items[activeSuggestionIndex].click();
  }
});

document.addEventListener('click', (e) => {
  if (!fishSuggestions.contains(e.target) && e.target !== fishSearchInput) {
    hideSuggestions();
  }
});

function renderSuggestions(matches) {
  activeSuggestionIndex = -1;
  fishSuggestions.innerHTML = '';

  if (matches.length === 0) {
    fishSuggestions.innerHTML = '<div class="suggestion-empty">Mos ism topilmadi</div>';
    fishSuggestions.classList.remove('hidden');
    return;
  }

  matches.forEach((name) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = name;
    item.addEventListener('click', () => selectFish(name));
    fishSuggestions.appendChild(item);
  });

  fishSuggestions.classList.remove('hidden');
}

function highlightSuggestion(items) {
  items.forEach((item, idx) => item.classList.toggle('is-active', idx === activeSuggestionIndex));
  if (activeSuggestionIndex !== -1) items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
}

function selectFish(name) {
  selectedFish = name;
  fishSearchInput.value = name;
  hideSuggestions();
  unlockPasswordStage();
}

function hideSuggestions() {
  fishSuggestions.classList.add('hidden');
  fishSuggestions.innerHTML = '';
}

function unlockPasswordStage() {
  loginPasswordInput.disabled = false;
  loginSubmitBtn.disabled = false;
  loginHint.textContent = "Kodingizni kiriting (birinchi marta kirsangiz, shu kod parolingiz sifatida saqlanadi)";
  loginPasswordInput.focus();
}

function lockPasswordStage() {
  loginPasswordInput.disabled = true;
  loginSubmitBtn.disabled = true;
  loginHint.textContent = "Avval ro'yxatdan ismingizni tanlang";
}

// ==========================================================================
// RO'YXAT / DIAGRAMMA ALMASHTIRISH
// ==========================================================================

listViewBtn.addEventListener('click', () => setView('list'));
chartViewBtn.addEventListener('click', () => setView('chart'));

function setView(view) {
  currentView = view;
  listViewBtn.classList.toggle('active', view === 'list');
  chartViewBtn.classList.toggle('active', view === 'chart');
  listView.classList.toggle('hidden', view !== 'list');
  chartView.classList.toggle('hidden', view !== 'chart');
  if (view === 'chart') renderChart(latestRankSeries);
}

/**
 * Bitta xodimning davr davomidagi kunlik o'rnini SVG chiziqli diagramma
 * sifatida chizadi (past o'rin raqami = yuqori nuqta). "Oxirgi hisobot"
 * yoki aniq bitta sana tanlansa, series bo'sh keladi va bo'sh holat
 * xabari ko'rsatiladi.
 */
function renderChart(series) {
  latestRankSeries = series || [];
  chartSvgWrapper.innerHTML = '';

  if (!series || series.length === 0) {
    chartEmptyState.classList.remove('hidden');
    return;
  }
  chartEmptyState.classList.add('hidden');

  const width = Math.max(360, series.length * 46);
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 34 };
  const maxRank = Math.max(...series.map((p) => p.rank), 5);

  const xStep = (width - padding.left - padding.right) / Math.max(series.length - 1, 1);
  const yFor = (rank) => padding.top + ((rank - 1) / (maxRank - 1 || 1)) * (height - padding.top - padding.bottom);
  const xFor = (idx) => padding.left + idx * xStep;

  const points = series.map((p, idx) => ({ x: xFor(idx), y: yFor(p.rank), rank: p.rank, date: p.date }));
  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const pathLength = points.length * 60;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  svg += `<path class="chart-line" d="${pathD}" stroke-dasharray="${pathLength}" stroke-dashoffset="${pathLength}">
    <animate attributeName="stroke-dashoffset" from="${pathLength}" to="0" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
  </path>`;

  points.forEach((p, idx) => {
    const isBest = p.rank === Math.min(...series.map((s) => s.rank));
    svg += `<circle class="chart-point ${isBest ? 'is-best' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4">
      <animate attributeName="r" from="0" to="4" dur="0.3s" begin="${0.05 * idx}s" fill="freeze"/>
    </circle>`;
    svg += `<text class="chart-rank-label" x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle">${p.rank}</text>`;
    svg += `<text class="chart-axis-label" x="${p.x.toFixed(1)}" y="${height - 8}" text-anchor="middle">${formatDateShort(p.date)}</text>`;
  });

  svg += '</svg>';
  chartSvgWrapper.innerHTML = svg;
}

function formatDateShort(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

// ==========================================================================
// KONFETTI + 1-O'RIN TABRIGI
// ==========================================================================

celebrationCloseBtn.addEventListener('click', hideCelebrationModal);

function triggerFirstPlaceCelebration() {
  spawnConfetti();
  celebrationModal.classList.remove('hidden');
  setTimeout(hideCelebrationModal, 5000);
}

function hideCelebrationModal() {
  celebrationModal.classList.add('hidden');
}

function spawnConfetti() {
  const colors = ['#0e9c6f', '#b8862f', '#2f6fbf', '#c0293f', '#8a94a6'];
  const pieceCount = 60;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    confettiContainer.appendChild(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}

// ==========================================================================
// LOGIN
// ==========================================================================

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedFish) {
    showLoginError("Iltimos, ro'yxatdan ismingizni tanlang.");
    return;
  }

  const password = loginPasswordInput.value.trim();
  if (!password) {
    showLoginError('Iltimos, kodingizni kiriting.');
    return;
  }

  setLoginLoading(true);
  hideLoginError();

  const result = await fetchPortalData(selectedFish, password, currentFilter);

  setLoginLoading(false);

  if (result.status === 'success') {
    currentPassword = password;
    enterDashboard(result);
  } else {
    showLoginError(result.message || "Parol noto'g'ri.");
    loginPasswordInput.value = '';
    loginPasswordInput.focus();
  }
});

logoutBtn.addEventListener('click', () => {
  selectedFish = null;
  currentPassword = null;
  currentFilter = 'LAST_REPORT';
  fishSearchInput.value = '';
  loginPasswordInput.value = '';
  lockPasswordStage();
  resetFilterUI();
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  fishSearchInput.focus();
  setWatermark('');
});

function resetFilterUI() {
  filterChips.forEach((c) => c.classList.toggle('active', c.dataset.filter === 'LAST_REPORT'));
  monthFilterInput.value = '';
  dateDropdown.value = '';
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideLoginError() {
  loginError.classList.add('hidden');
}

forgotPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();

  const typedName = fishSearchInput.value.trim();
  const templateMessage = typedName
    ? `Salom! Men ${typedName}. Reyting platformasiga kirishda parolimni unutdim, yordam bera olasizmi?`
    : "Salom! Reyting platformasiga kirishda parolimni unutdim, yordam bera olasizmi? To‘liq ism-familiyam: ";

  const url = `https://t.me/${ADMIN_TELEGRAM_USERNAME}?text=${encodeURIComponent(templateMessage)}`;
  window.open(url, '_blank');
});

function setLoginLoading(isLoading) {
  loginSubmitBtn.disabled = isLoading;
  loginSubmitBtn.querySelector('.btn-label').textContent = isLoading ? 'Tekshirilmoqda...' : 'Kirish';
  loginSubmitBtn.querySelector('.btn-spinner').classList.toggle('hidden', !isLoading);
}

// ==========================================================================
// SANA FILTRI
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
  setFilter(`MONTH:${monthFilterInput.value}`); // input value allaqachon "YYYY-MM"
});

dateDropdown.addEventListener('change', () => {
  if (!dateDropdown.value) return;
  filterChips.forEach((c) => c.classList.remove('active'));
  monthFilterInput.value = '';
  setFilter(dateDropdown.value); // "YYYY-MM-DD"
});

async function setFilter(filterValue) {
  currentFilter = filterValue;
  if (!selectedFish || !currentPassword) return;

  showLeaderboardStatus('info', 'Reyting yuklanmoqda...');
  const result = await fetchPortalData(selectedFish, currentPassword, currentFilter);

  if (result.status === 'success') {
    hideLeaderboardStatus();
    updateProfilePanel(result.myProfile);
    updateMyRank(result.myRank);
    updateBallColumnLabel(result.leaderboardIsAverage);
    renderLeaderboard(result.leaderboard, result.myFish);
    renderChart(result.myRankSeries);
    populateDateDropdown(result.availableDates);
  } else {
    showLeaderboardStatus('error', result.message || "Ma'lumotlarni yuklab bo'lmadi.");
  }
}

/**
 * Sana dropdown'ini Baza'da haqiqatda mavjud sanalar bilan to'ldiradi
 * (foydalanuvchining joriy tanlovini yo'qotmaydi).
 */
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

// ==========================================================================
// SERVERGA SO'ROV
// ==========================================================================

async function fetchPortalData(fish, password, dateFilter) {
  if (GAS_WEB_APP_URL.includes('AKfycb...')) {
    return { status: 'error', message: "GAS_WEB_APP_URL sozlanmagan. script.js faylida Web App URL'ni kiriting." };
  }

  try {
    const url = `${GAS_WEB_APP_URL}?fish=${encodeURIComponent(fish)}&password=${encodeURIComponent(password)}&dateFilter=${encodeURIComponent(dateFilter)}`;
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
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');

  myNameLabel.textContent = result.myFish || '—';
  myFilialLabel.textContent = result.myFilial || '—';
  avatarInitials.textContent = getInitials(result.myFish);

  resetFilterUI();
  updateMyRank(result.myRank);
  updateProfilePanel(result.myProfile);
  updateBallColumnLabel(result.leaderboardIsAverage);
  renderLeaderboard(result.leaderboard, result.myFish);
  renderChart(result.myRankSeries);
  populateDateDropdown(result.availableDates);
  setWatermark(result.myFish);

  if (result.registered) {
    showLeaderboardStatus('info', "Xush kelibsiz! Kodingiz birinchi marta parol sifatida saqlandi — keyingi safar shu kodni ishlating.");
  }

  if (result.myRank === 1) {
    triggerFirstPlaceCelebration();
  }
}

function updateMyRank(rank) {
  myRankValue.textContent = rank ? rank : '—';
}

function updateProfilePanel(profile) {
  if (!profile) return;

  kpiBall.textContent = formatNumber(profile.ball);
  kpiSavdoSoni.textContent = formatNumber(profile.savdoSoni);
  kpiSavdoPlan.textContent = `${formatNumber(profile.savdoPlan)}%`;
  kpiPar31.textContent = `${formatNumber(profile.par31)}%`;

  medalRank1.textContent = profile.rank1Count || 0;
  medalRank2.textContent = profile.rank2Count || 0;
  medalRank3.textContent = profile.rank3Count || 0;

  // O'rtacha holatida karta nomlari yoniga izoh qo'shiladi.
  toggleSuffix(ballSuffix, profile.isAverage, ' (o\'rtacha)');
  toggleSuffix(savdoPlanSuffix, profile.isAverage, ' (o\'rtacha)');
  toggleSuffix(par31Suffix, profile.isAverage, ' (o\'rtacha)');
  toggleSuffix(savdoSoniSuffix, profile.isAverage, ' (o\'rtacha kunlik)');
}

function toggleSuffix(el, show, text) {
  el.textContent = show ? text : '';
  el.classList.toggle('hidden', !show);
}

function updateBallColumnLabel(isAverage) {
  ballColumnHeader.textContent = isAverage ? "Ball (o'rtacha)" : 'Ball';
}

function renderLeaderboard(leaderboard, myFish) {
  leaderboardBody.innerHTML = '';

  if (!leaderboard || leaderboard.length === 0) {
    showLeaderboardStatus('info', "Tanlangan davr uchun ma'lumot topilmadi.");
    return;
  }

  leaderboard.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.fish === myFish) tr.classList.add('is-me');

    tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${escapeHtml(row.fish)}</td>
      <td>${escapeHtml(row.filial)}</td>
      <td>${formatNumber(row.ball)}</td>
    `;

    leaderboardBody.appendChild(tr);
  });
}

// ==========================================================================
// SUV BELGISI (WATERMARK)
// ==========================================================================

function setWatermark(text) {
  if (!text) {
    watermarkOverlay.style.backgroundImage = '';
    return;
  }

  const tileWidth = 320;
  const tileHeight = 160;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">
      <text x="10" y="90" font-family="Inter, sans-serif" font-size="16"
            fill="#131b2c" transform="rotate(-28 160 80)">${escapeHtml(text)}</text>
    </svg>
  `.trim();

  const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  watermarkOverlay.style.backgroundImage = `url("${encoded}")`;
  watermarkOverlay.style.backgroundSize = `${tileWidth}px ${tileHeight}px`;
}

// ==========================================================================
// YORDAMCHI FUNKSIYALAR
// ==========================================================================

function getInitials(fullName) {
  if (!fullName) return '—';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
}

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

fishSearchInput.focus();