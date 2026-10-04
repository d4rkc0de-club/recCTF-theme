/**
 * app.js — recCTF Challenges Frontend Controller
 * 
 * ROLE:
 * Handles all UI interaction: challenge board rendering, accessible modal
 * dialog lifecycle, hash-based URL routing, tab switching with Steins;Gate
 * mechanical gear advancement, flag submission debouncing, Steins;Gate background
 * gears & clock dynamics (anti-clockwise random pace with clockwise 12:00 snap on click),
 * and interactive D-Mail notification drawer.
 */

/* Global functions loaded via script tag from data.js:
 * getChallenges, getChallenge, submitFlag, getSolves, getSubmissions, unlockHint
 */

/* =========================================================================
   State Variables
   ========================================================================= */
let cachedChallenges = [];
let activeChallengeId = null;
let currentNotchAngle = 0;
let isSubmitting = false;
let submitDebounceTimer = null;

/* =========================================================================
   DOM Element Cache
   ========================================================================= */
const loadingState = document.getElementById('loading-state');
const categoriesContainer = document.getElementById('categories-container');
const alertSlot = document.getElementById('alert-slot');

// Modal Elements
const modal = document.getElementById('challenge-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const tabNotchGear = document.getElementById('tab-notch-gear');

const modalTitle = document.getElementById('modal-title');
const modalPoints = document.getElementById('modal-points');
const modalTags = document.getElementById('modal-tags');
const modalAuthor = document.getElementById('modal-author');
const modalDesc = document.getElementById('modal-desc');
const modalConnection = document.getElementById('modal-connection');
const modalHints = document.getElementById('modal-hints');
const modalFiles = document.getElementById('modal-files');

const modalAttemptsContainer = document.getElementById('modal-attempts-container');
const modalAttemptsVal = document.getElementById('modal-attempts-val');
const modalMaxAttemptsVal = document.getElementById('modal-max-attempts-val');

const flagInput = document.getElementById('flag-input');
const flagSubmitBtn = document.getElementById('flag-submit-btn');
const modalResultAlert = document.getElementById('modal-result-alert');
const modalNextBtn = document.getElementById('modal-next-btn');

// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = {
  challenge: document.getElementById('tabpanel-challenge'),
  submissions: document.getElementById('tabpanel-submissions'),
  solution: document.getElementById('tabpanel-solution'),
  solves: document.getElementById('tabpanel-solves')
};

const tabBtnSolution = document.getElementById('tab-btn-solution');
const tabSolvesCount = document.getElementById('tab-solves-count');
const submissionsTableBody = document.getElementById('submissions-table-body');
const solvesTableBody = document.getElementById('solves-table-body');
const solutionTextContainer = document.getElementById('solution-text-container');

// Notifications Bell & Drawer Elements
const notifBtn = document.getElementById('notif-btn');
const notifDropdown = document.getElementById('notif-dropdown');
const notifBadge = document.getElementById('notif-badge');
const notifClearBtn = document.getElementById('notif-clear-btn');
const notifList = document.getElementById('notif-list');

// Clock Elements
const clockElement = document.getElementById('clock');
const hHour = document.getElementById('hand-hour');
const hMin = document.getElementById('hand-min');
const hSec = document.getElementById('hand-sec');

const miniHour = document.getElementById('mini-hand-hour');
const miniMin = document.getElementById('mini-hand-min');
const miniSec = document.getElementById('mini-hand-sec');

const gearsSvg = document.getElementById('gears');

/* =========================================================================
   Steins;Gate Clockwork Backdrop Gears (From rules copy)
   ========================================================================= */
const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
};
const createSvgElement = el;

function gearPath(teeth, r, m) {
  const ro = r + m;
  const rr = r - 1.25 * m;
  const p = TAU / teeth;
  const pt = (rad, a) => `${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const b = i * p;
    d += (i ? 'L' : 'M') + pt(rr, b);
    d += 'L' + pt(ro, b + p * 0.2);
    d += 'L' + pt(ro, b + p * 0.45);
    d += 'L' + pt(rr, b + p * 0.65);
  }
  return d + 'Z';
}

function initBackdropGears() {
  if (!gearsSvg) return;
  const SPEED = 1.7; // seconds per tooth -> equal pitch-line speed for all gears

  function addGear(parent, { x, y, teeth, m, rot, dir }) {
    const r = (m * teeth) / 2;
    const outer = createSvgElement('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(3)})` }, parent);
    const g = createSvgElement('g', { class: 'gear' }, outer);
    g.style.setProperty('--dur', `${(teeth * SPEED).toFixed(1)}s`);
    g.style.setProperty('--dir', dir > 0 ? 'normal' : 'reverse');
    createSvgElement('path', { d: gearPath(teeth, r, m) }, g);
    const inner = r - 1.25 * m - m * 1.6;
    if (inner > 14) {
      createSvgElement('circle', { r: inner.toFixed(1) }, g);
      const hub = Math.max(6, r * 0.22);
      createSvgElement('circle', { r: hub.toFixed(1), class: 'hub' }, g);
      createSvgElement('circle', { r: (hub * 0.45).toFixed(1) }, g);
      const spokes = teeth > 30 ? 6 : teeth > 18 ? 5 : 4;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU;
        createSvgElement('line', {
          x1: (hub * Math.cos(a)).toFixed(1), y1: (hub * Math.sin(a)).toFixed(1),
          x2: (inner * Math.cos(a)).toFixed(1), y2: (inner * Math.sin(a)).toFixed(1),
          class: 'spoke',
        }, g);
      }
    } else {
      createSvgElement('circle', { r: Math.max(3, r * 0.25).toFixed(1) }, g);
    }
    return { x, y, teeth, m, r, rot, dir };
  }

  function meshWith(parent, A, teeth, deg) {
    const th = (deg * Math.PI) / 180;
    const rB = (A.m * teeth) / 2;
    const dist = A.r + rB;
    const pA = TAU / A.teeth;
    const pB = TAU / teeth;
    const a = (A.rot * Math.PI) / 180;
    const phiA = (((th - a) / pA) % 1 + 1) % 1;
    const b = th + Math.PI - pB * (0.15 - phiA);
    return addGear(parent, {
      x: A.x + dist * Math.cos(th),
      y: A.y + dist * Math.sin(th),
      teeth, m: A.m, rot: (b * 180) / Math.PI, dir: -A.dir,
    });
  }

  function annotate(parent, G, text, deg, len = 60) {
    const th = (deg * Math.PI) / 180;
    const x1 = G.x + (G.r + G.m * 2) * Math.cos(th);
    const y1 = G.y + (G.r + G.m * 2) * Math.sin(th);
    const x2 = x1 + len * Math.cos(th);
    const y2 = y1 + len * Math.sin(th);
    const right = Math.cos(th) >= 0;
    createSvgElement('path', { d: `M${x1} ${y1} L${x2} ${y2} l${right ? 40 : -40} 0`, class: 'annot-line' }, parent);
    const t = createSvgElement('text', { x: x2 + (right ? 44 : -44), y: y2 + 3, class: 'annot', 'text-anchor': right ? 'start' : 'end' }, parent);
    t.textContent = text;
  }

  function buildGears() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    gearsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    gearsSvg.replaceChildren();
    const s = Math.min(1.25, Math.max(0.55, Math.min(W, H) / 860));
    const root = createSvgElement('g', {}, gearsSvg);

    const g1 = addGear(root, { x: W * 0.04, y: H * 0.14, teeth: 40, m: 6 * s, rot: 0, dir: 1 });
    const g2 = meshWith(root, g1, 18, 38);
    const g3 = meshWith(root, g2, 28, 95);
    meshWith(root, g3, 12, 25);
    annotate(root, g2, 'T18 · ω 2.22', -20, 50 * s);

    const h1 = addGear(root, { x: W * 0.97, y: H * 0.9, teeth: 48, m: 6 * s, rot: 3, dir: -1 });
    const h2 = meshWith(root, h1, 16, 205);
    const h3 = meshWith(root, h2, 30, 255);
    meshWith(root, h3, 14, 195);
    annotate(root, h3, 'IBN 5100', 200, 46 * s);

    const k1 = addGear(root, { x: W * 0.95, y: H * 0.08, teeth: 32, m: 4.5 * s, rot: 0, dir: 1 });
    const k2 = meshWith(root, k1, 14, 150);
    annotate(root, k2, 'Ø ' + Math.round(k2.r * 2) + ' · β', 170, 40 * s);

    const l1 = addGear(root, { x: W * 0.06, y: H * 0.94, teeth: 26, m: 5 * s, rot: 0, dir: -1 });
    const l2 = meshWith(root, l1, 12, -40);
    annotate(root, l2, 'WL 1.048596', -30, 40 * s);
  }

  buildGears();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildGears, 180);
  });
}

/* =========================================================================
   Component Gears & Steel Gradient (Directly from rules copy)
   ========================================================================= */
function initComponentGears() {
  if (!document.getElementById('steelGrad')) {
    const defs = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute; width:0; height:0;' });
    defs.innerHTML = `
      <defs>
        <radialGradient id="steelGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#f4f4f5"/>
          <stop offset=".35" stop-color="#bdbdc1"/>
          <stop offset=".75" stop-color="#6c6c71"/>
          <stop offset="1" stop-color="#2c2c2f"/>
        </radialGradient>
      </defs>`;
    document.body.prepend(defs);
  }

  /* Small decorative gears */
  document.querySelectorAll('.mini-gear').forEach((g) => {
    if (g.children.length === 0) {
      const svg = el('svg', { viewBox: '-12 -12 24 24' }, g);
      el('path', { d: gearPath(10, 8.5, 2) }, svg);
      el('circle', { r: 3 }, svg);
    }
  });
}

/* =========================================================================
   Steins;Gate Divergence Meter (Directly from rules copy):
   - Generates cathode tubes with ghost '8' behind active digits
   - shiftWorldline: digit scrambling with randomized flicker and staggered settling
   ========================================================================= */
const WORLDLINES = {
  closed: { value: '0.571024', name: 'α World Line' },
  open: { value: '1.048596', name: 'Steins;Gate' },
};
let currentWL = WORLDLINES.closed;
let scrambleTimers = [];
let shiftWorldlineFn = null;

function initDivergenceMeter() {
  const tubesEl = document.getElementById('tubes');
  const wlName = document.getElementById('worldline-name');
  if (!tubesEl || tubesEl.children.length > 0) return;

  const tubes = [];

  WORLDLINES.closed.value.split('').forEach((ch) => {
    const tube = document.createElement('span');
    tube.className = 'tube' + (ch === '.' ? ' is-dot' : '');
    const ghost = document.createElement('span');
    ghost.className = 'ghost';
    ghost.textContent = ch === '.' ? '' : '8';
    const digit = document.createElement('span');
    digit.className = 'digit';
    digit.textContent = ch;
    tube.append(ghost, digit);
    tubesEl.appendChild(tube);
    tubes.push({ tube, digit, isDot: ch === '.' });
  });

  shiftWorldlineFn = function shiftWorldline(target) {
    scrambleTimers.forEach(clearInterval);
    scrambleTimers = [];
    if (wlName) wlName.textContent = target.name;
    tubesEl.setAttribute('aria-label', 'Divergence ' + target.value);

    tubes.forEach((t, i) => {
      if (t.isDot) return;
      const finalCh = target.value[i];
      if (reduceMotion) { t.digit.textContent = finalCh; return; }
      t.tube.classList.add('flicker');
      const iv = setInterval(() => {
        t.digit.textContent = String(Math.floor(Math.random() * 10));
      }, 55);
      scrambleTimers.push(iv);
      setTimeout(() => {
        clearInterval(iv);
        t.digit.textContent = finalCh;
        t.tube.classList.remove('flicker');
      }, 500 + i * 110);
    });
  };
}

/* =========================================================================
   Steins;Gate Clock Mechanics (From rules copy):
   - Generates exact 60 ticks & 12 Roman numerals using el('line') & el('text')
   - Moves in anti-clockwise direction at a variable random pace
   - On registered click: whirls clockwise to 12:00 (snap) with CSS transition
     cubic-bezier(.65, 0, .25, 1) and flashes, holds momentarily, then resumes anti-clockwise
   ========================================================================= */
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
let secAngle = -Math.floor(Math.random() * 360);
let minAngle = secAngle / 12;
let hourAngle = minAngle / 12;

let currentPace = 45;      // degrees/sec for second hand
let targetPace = 45;
let lastPaceShiftTime = performance.now();
let lastFrameTime = performance.now();

let isLeaping = false;
let leapTimer = null;
let leap = 0; // whole turns added during a "time leap"

function initSteinsGateClock() {
  const clock = document.getElementById('clock');
  const ticks = document.getElementById('clock-ticks');
  const numerals = document.getElementById('clock-numerals');
  const miniTicks = document.getElementById('mini-clock-ticks');
  const flash = document.getElementById('shift-flash');
  const unrollMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--unroll')) * 1000 || 1350;

  // Draw 60 ticks directly as in rules copy
  if (ticks && ticks.children.length === 0) {
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const major = i % 5 === 0;
      const r1 = 186;
      const r2 = major ? 172 : 180;
      el('line', {
        x1: (r1 * Math.cos(a)).toFixed(2), y1: (r1 * Math.sin(a)).toFixed(2),
        x2: (r2 * Math.cos(a)).toFixed(2), y2: (r2 * Math.sin(a)).toFixed(2),
        class: major ? 'tick major' : 'tick',
      }, ticks);
    }
  }

  // Draw Roman numerals XII through XI
  if (numerals && numerals.children.length === 0) {
    ROMAN.forEach((n, i) => {
      const a = (i / 12) * TAU - Math.PI / 2;
      const t = el('text', { x: (160 * Math.cos(a)).toFixed(2), y: (160 * Math.sin(a)).toFixed(2), class: 'numeral' }, numerals);
      t.textContent = n;
    });
  }

  // Mini clock ticks inside challenge modal
  if (miniTicks && miniTicks.children.length === 0) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      el('line', {
        x1: (182 * Math.cos(a)).toFixed(2), y1: (182 * Math.sin(a)).toFixed(2),
        x2: (160 * Math.cos(a)).toFixed(2), y2: (160 * Math.sin(a)).toFixed(2),
        class: 'tick major',
      }, miniTicks);
    }
  }

  function setHands(sDeg = secAngle, mDeg = minAngle, hDeg = hourAngle) {
    if (hSec) hSec.style.transform = `rotate(${sDeg}deg)`;
    if (hMin) hMin.style.transform = `rotate(${mDeg}deg)`;
    if (hHour) hHour.style.transform = `rotate(${hDeg}deg)`;

    if (miniSec) miniSec.style.transform = `rotate(${sDeg}deg)`;
    if (miniMin) miniMin.style.transform = `rotate(${mDeg}deg)`;
    if (miniHour) miniHour.style.transform = `rotate(${hDeg}deg)`;
  }

  // Animation Loop: continuous anti-clockwise motion at random pace
  function clockLoop(now) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (!isLeaping) {
      // Periodically shift pace randomly (every 1.6s to 2.8s)
      if (now - lastPaceShiftTime > 1800) {
        targetPace = 25 + Math.random() * 95; // Random pace between 25°/s and 120°/s
        lastPaceShiftTime = now;
      }
      currentPace += (targetPace - currentPace) * 0.05;

      // Anti-clockwise rotation (decreasing angles)
      secAngle -= currentPace * dt;
      minAngle -= (currentPace / 12) * dt;
      hourAngle -= (currentPace / 144) * dt;

      setHands(secAngle, minAngle, hourAngle);
    }

    requestAnimationFrame(clockLoop);
  }

  requestAnimationFrame(clockLoop);

  /**
   * Fast clockwise whirl to 12:00 (snap) using rules copy CSS transition var(--unroll) var(--ease-roll).
   */
  function triggerClockwiseSnapTo12() {
    if (isLeaping) return;
    isLeaping = true;

    // Clockwise target angles: next multiple of 360° (landing squarely at 12:00)
    const targetSec = Math.ceil(secAngle / 360) * 360 + 360;
    const targetMin = Math.ceil(minAngle / 360) * 360 + 360;
    const targetHour = Math.ceil(hourAngle / 360) * 360;

    leap += 1;
    if (clock) clock.classList.add('leaping');

    // Setting transform triggers GPU-accelerated CSS transition (--unroll --ease-roll)
    setHands(targetSec, targetMin, targetHour);

    // World-line shift: meter scramble + flash
    if (flash && !reduceMotion) {
      flash.classList.remove('on');
      void flash.offsetWidth;
      flash.classList.add('on');
    }
    currentWL = (currentWL === WORLDLINES.closed ? WORLDLINES.open : WORLDLINES.closed);
    if (shiftWorldlineFn) shiftWorldlineFn(currentWL);

    clearTimeout(leapTimer);
    leapTimer = setTimeout(() => {
      // Hold momentarily at 12:00 for mechanical realism
      secAngle = targetSec;
      minAngle = targetMin;
      hourAngle = targetHour;

      setTimeout(() => {
        if (clock) clock.classList.remove('leaping');
        isLeaping = false;
        lastFrameTime = performance.now();
      }, 240);
    }, unrollMs);
  }

  window.triggerClockwiseSnapTo12 = triggerClockwiseSnapTo12;

  // When a click is registered anywhere: rotate quickly to 12:00 in clockwise direction
  document.addEventListener('click', () => {
    // Avoid triggering if selecting text
    if (String(window.getSelection()).length > 0) return;
    triggerClockwiseSnapTo12();
  });
}

/* =========================================================================
   Interactable Notifications Bell (D-Mails Drawer)
   ========================================================================= */
function initNotifications() {
  let unreadCount = 3;

  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = notifDropdown.hidden;
    notifDropdown.hidden = !isHidden;
    notifBtn.setAttribute('aria-expanded', String(isHidden));
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!notifDropdown.hidden && !e.target.closest('#notif-wrapper')) {
      notifDropdown.hidden = true;
      notifBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close dropdown on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !notifDropdown.hidden) {
      notifDropdown.hidden = true;
      notifBtn.setAttribute('aria-expanded', 'false');
      notifBtn.focus();
    }
  });

  // Mark all notifications read
  notifClearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unreadCount = 0;
    notifBadge.textContent = '0';
    notifBadge.style.opacity = '0.4';
    notifClearBtn.textContent = 'All Read';
    notifClearBtn.disabled = true;

    notifList.querySelectorAll('.notif-item').forEach((item) => {
      item.classList.remove('unread');
    });
  });

  // Mark individual notification read on click
  notifList.querySelectorAll('.notif-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (item.classList.contains('unread')) {
        item.classList.remove('unread');
        unreadCount = Math.max(0, unreadCount - 1);
        notifBadge.textContent = String(unreadCount);
        if (unreadCount === 0) {
          notifBadge.style.opacity = '0.4';
          notifClearBtn.textContent = 'All Read';
          notifClearBtn.disabled = true;
        }
      }
    });
  });
}

/* =========================================================================
   Application Initialization
   ========================================================================= */
async function initializeApp() {
  initBackdropGears();
  initComponentGears();
  initDivergenceMeter();
  initSteinsGateClock();
  initNotifications();
  setupEventListeners();

  try {
    const response = await getChallenges();
    if (response.success && Array.isArray(response.data)) {
      cachedChallenges = response.data;
      renderBoard(cachedChallenges);
      handleHashNavigation();
    } else {
      showBoardAlert('Failed to synchronize challenge database with the world line.');
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showBoardAlert('Network anomaly detected. Could not connect to lab servers.');
  } finally {
    loadingState.hidden = true;
  }
}

/* =========================================================================
   Board Rendering (Categories & Cards Grid)
   ========================================================================= */
function renderBoard(challenges) {
  categoriesContainer.innerHTML = '';

  const categoriesMap = new Map();
  challenges.forEach((chal) => {
    const cat = chal.category || 'General';
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat).push(chal);
  });

  for (const [categoryName, items] of categoriesMap.entries()) {
    const section = document.createElement('section');
    section.className = 'category-section';
    section.setAttribute('aria-labelledby', `cat-heading-${slugify(categoryName)}`);

    const header = document.createElement('h3');
    header.className = 'category-header';
    header.id = `cat-heading-${slugify(categoryName)}`;
    header.innerHTML = `
      <svg class="category-gear-icon" viewBox="-12 -12 24 24" aria-hidden="true">
        <use href="#gear-10t" />
      </svg>
      <span>${escapeHtml(categoryName)}</span>
    `;
    section.appendChild(header);

    const divider = document.createElement('div');
    divider.className = 'divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = `<span></span><i class="mini-gear"></i><span></span>`;
    section.appendChild(divider);

    const grid = document.createElement('div');
    grid.className = 'challenges-grid';

    items.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.challengeId = item.id;

      const tagClasses = (item.tags || [])
        .map((t) => `tag-${slugify(t.value || t)}`)
        .join(' ');

      card.className = `challenge-card ${tagClasses} ${item.solved_by_me ? 'solved' : ''}`;
      card.setAttribute('aria-label', `${item.name} worth ${item.value} points${item.solved_by_me ? ', solved' : ''}`);

      card.innerHTML = `
        <svg class="card-corner-gear" viewBox="-12 -12 24 24" aria-hidden="true">
          <use href="#gear-10t" />
        </svg>
        <h4 class="card-title">${escapeHtml(item.name)}</h4>
        <p class="card-points">${item.value} pts</p>
      `;

      card.addEventListener('click', () => openChallenge(item.id));
      grid.appendChild(card);
    });

    section.appendChild(grid);
    categoriesContainer.appendChild(section);
  }

  initComponentGears();
}

/* =========================================================================
   Challenge Modal Management
   ========================================================================= */
async function openChallenge(id) {
  activeChallengeId = id;

  const meta = cachedChallenges.find((c) => c.id === id);
  if (meta) {
    const hash = `#${slugify(meta.name)}-${id}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
    }
  }

  resetModalView();
  switchTab('challenge');

  if (!modal.open) {
    modal.showModal();
    initComponentGears();
  }

  try {
    const [chalResponse, solvesResponse, submissionsResponse] = await Promise.all([
      getChallenge(id),
      getSolves(id),
      getSubmissions(id)
    ]);

    if (chalResponse.success && chalResponse.data) {
      populateChallengeDetails(chalResponse.data);
    }
    if (solvesResponse.success && Array.isArray(solvesResponse.data)) {
      populateSolvesTable(solvesResponse.data);
    }
    if (submissionsResponse.success && Array.isArray(submissionsResponse.data)) {
      populateSubmissionsTable(submissionsResponse.data);
    }
  } catch (error) {
    console.error('Error fetching challenge modal data:', error);
    modalTitle.textContent = 'Error Loading Challenge';
    modalDesc.innerHTML = '<p>Could not retrieve transmission parameters from the laboratory.</p>';
  }
}

function resetModalView() {
  modalTitle.textContent = 'Synchronizing...';
  modalPoints.textContent = '';
  modalTags.innerHTML = '';
  modalAuthor.textContent = '';
  modalDesc.innerHTML = '';
  modalConnection.innerHTML = '';
  modalHints.innerHTML = '';
  modalFiles.innerHTML = '';
  modalAttemptsContainer.hidden = true;
  modalResultAlert.hidden = true;
  modalResultAlert.className = 'submit-result-alert';
  modalNextBtn.hidden = true;
  flagInput.value = '';
  tabBtnSolution.hidden = true;
}

function populateChallengeDetails(data) {
  modalTitle.textContent = data.name;
  modalPoints.textContent = `${data.value} points`;

  if (data.tags && data.tags.length > 0) {
    modalTags.innerHTML = data.tags
      .map((t) => `<span class="tag-badge">${escapeHtml(t.value || t)}</span>`)
      .join('');
  } else {
    modalTags.innerHTML = '';
  }

  modalAuthor.textContent = data.byline ? `authored by ${data.byline}` : '';
  modalDesc.innerHTML = data.description || '';

  if (data.connection_info) {
    const conn = data.connection_info.trim();
    if (conn.startsWith('http://') || conn.startsWith('https://')) {
      modalConnection.innerHTML = `<a href="${escapeHtml(conn)}" target="_blank" rel="noopener noreferrer">${escapeHtml(conn)}</a>`;
    } else {
      modalConnection.innerHTML = `<code>${escapeHtml(conn)}</code>`;
    }
  } else {
    modalConnection.innerHTML = '';
  }

  if (data.hints && data.hints.length > 0) {
    modalHints.innerHTML = '';
    data.hints.forEach((hint) => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');

      if (hint.content) {
        summary.textContent = hint.title ? `Hint: ${hint.title}` : 'View Hint';
        const body = document.createElement('div');
        body.className = 'hint-content-body';
        body.innerHTML = hint.content;
        details.appendChild(summary);
        details.appendChild(body);
      } else {
        const costText = hint.cost > 0 ? ` (Cost: ${hint.cost} pts)` : ' (Free)';
        summary.textContent = `${hint.title || 'Unlock Hint'}${costText}`;
        const body = document.createElement('div');
        body.className = 'hint-content-body';
        body.innerHTML = `<button type="button" class="unlock-hint-btn">Confirm unlock hint for ${hint.cost} points</button>`;

        body.querySelector('.unlock-hint-btn').addEventListener('click', async () => {
          body.innerHTML = '<span>Decrypting memory bank...</span>';
          const unlRes = await unlockHint(hint.id);
          if (unlRes.success && unlRes.data) {
            body.innerHTML = unlRes.data.content;
          }
        });

        details.appendChild(summary);
        details.appendChild(body);
      }
      modalHints.appendChild(details);
    });
  } else {
    modalHints.innerHTML = '';
  }

  if (data.files && data.files.length > 0) {
    modalFiles.innerHTML = data.files
      .map((filePath) => {
        const fileName = filePath.split('/').pop().split('?')[0];
        return `
          <a class="file-download-btn" href="${escapeHtml(filePath)}" download target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><use href="#icon-download"/></svg>
            <span>${escapeHtml(fileName)}</span>
          </a>
        `;
      })
      .join('');
  } else {
    modalFiles.innerHTML = '';
  }

  if (data.max_attempts && data.max_attempts > 0) {
    modalAttemptsVal.textContent = data.attempts || 0;
    modalMaxAttemptsVal.textContent = data.max_attempts;
    modalAttemptsContainer.hidden = false;
  } else {
    modalAttemptsContainer.hidden = true;
  }

  if (data.solution) {
    tabBtnSolution.hidden = false;
    solutionTextContainer.innerHTML = data.solution;
  } else {
    tabBtnSolution.hidden = true;
    solutionTextContainer.innerHTML = '';
  }

  setTimeout(() => flagInput.focus(), 50);
}

function populateSolvesTable(solves) {
  tabSolvesCount.textContent = solves.length;
  if (solves.length === 0) {
    solvesTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--paper-muted);">No solves recorded on this world line yet.</td></tr>';
    return;
  }

  solvesTableBody.innerHTML = solves
    .map(
      (s) => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${formatDate(s.date)}</td>
      </tr>
    `
    )
    .join('');
}

function populateSubmissionsTable(submissions) {
  if (submissions.length === 0) {
    submissionsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--paper-muted);">No submission attempts logged.</td></tr>';
    return;
  }

  submissionsTableBody.innerHTML = submissions
    .map((sub) => {
      const raw = escapeHtml(sub.provided || '');
      const masked = '*'.repeat(Math.max(6, raw.length));
      return `
        <tr>
          <td>
            <div class="flag-cell">
              <code class="flag-text-masked">${masked}</code>
              <code class="flag-text-raw" hidden>${raw}</code>
              <button type="button" class="btn-mask-toggle" aria-label="Toggle flag visibility">
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><use href="#icon-eye"/></svg>
              </button>
            </div>
          </td>
          <td><span class="tag-badge">${escapeHtml(sub.type)}</span></td>
          <td>${formatDate(sub.date)}</td>
        </tr>
      `;
    })
    .join('');

  submissionsTableBody.querySelectorAll('.btn-mask-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cell = btn.closest('.flag-cell');
      const masked = cell.querySelector('.flag-text-masked');
      const raw = cell.querySelector('.flag-text-raw');
      const isMasked = raw.hidden;

      raw.hidden = !isMasked;
      masked.hidden = isMasked;

      btn.querySelector('use').setAttribute('href', isMasked ? '#icon-eye-slash' : '#icon-eye');
    });
  });
}

/* =========================================================================
   Flag Submission Handler (Debounced 500ms, Enter key submits)
   ========================================================================= */
function handleFlagSubmission() {
  if (isSubmitting || !activeChallengeId) return;

  const flagVal = flagInput.value.trim();
  if (!flagVal) return;

  if (submitDebounceTimer) clearTimeout(submitDebounceTimer);
  submitDebounceTimer = setTimeout(async () => {
    isSubmitting = true;
    flagSubmitBtn.disabled = true;

    try {
      const response = await submitFlag(activeChallengeId, flagVal);
      if (response && response.success) {
        displaySubmissionResult(response.data);
      }
    } catch (err) {
      console.error('Submission error:', err);
      showResultAlert('Connection interrupted while dispatching flag packet.', 'incorrect');
    } finally {
      isSubmitting = false;
      flagSubmitBtn.disabled = false;
    }
  }, 500);
}

function displaySubmissionResult(data) {
  const status = data.status;

  modalResultAlert.classList.remove('shake');
  void modalResultAlert.offsetWidth;

  if (status === 'correct') {
    modalResultAlert.className = 'submit-result-alert correct';
    modalResultAlert.innerHTML = `
      <svg class="gear-lock-icon" viewBox="-12 -12 24 24" aria-hidden="true"><use href="#gear-10t"/></svg>
      <span>${escapeHtml(data.message || 'Correct flag!')}</span>
    `;
    modalResultAlert.hidden = false;

    // Steins;Gate World-Line Shift & Clock Snap to 12:00
    if (shiftWorldlineFn) shiftWorldlineFn(WORLDLINES.open);
    if (window.triggerClockwiseSnapTo12) window.triggerClockwiseSnapTo12();

    flagInput.value = '';

    const targetCard = document.querySelector(`.challenge-card[data-challenge-id="${activeChallengeId}"]`);
    if (targetCard) {
      targetCard.classList.add('solved');
      targetCard.setAttribute('aria-label', `${targetCard.querySelector('.card-title').textContent}, solved`);
    }

    const cachedItem = cachedChallenges.find((c) => c.id === activeChallengeId);
    if (cachedItem) cachedItem.solved_by_me = true;

    getSolves(activeChallengeId).then((res) => {
      if (res.success) populateSolvesTable(res.data);
    });

    const nextItem = cachedChallenges.find((c) => c.id > activeChallengeId && !c.solved_by_me) ||
                     cachedChallenges.find((c) => c.id > activeChallengeId);

    if (nextItem) {
      modalNextBtn.hidden = false;
      modalNextBtn.onclick = () => openChallenge(nextItem.id);
    }
  } else if (status === 'incorrect') {
    modalResultAlert.className = 'submit-result-alert incorrect shake';
    modalResultAlert.innerHTML = `<span>${escapeHtml(data.message || 'Incorrect flag.')}</span>`;
    modalResultAlert.hidden = false;
  } else if (status === 'already_solved') {
    modalResultAlert.className = 'submit-result-alert info';
    modalResultAlert.innerHTML = `<span>${escapeHtml(data.message || 'Already solved.')}</span>`;
    modalResultAlert.hidden = false;
  } else if (status === 'paused') {
    modalResultAlert.className = 'submit-result-alert info';
    modalResultAlert.innerHTML = `<span>${escapeHtml(data.message || 'Attempts limit reached.')}</span>`;
    modalResultAlert.hidden = false;
  }

  getSubmissions(activeChallengeId).then((res) => {
    if (res.success) populateSubmissionsTable(res.data);
  });
}

function showResultAlert(msg, type) {
  modalResultAlert.className = `submit-result-alert ${type}`;
  modalResultAlert.textContent = msg;
  modalResultAlert.hidden = false;
}

/* =========================================================================
   Tab Switching & Smooth Mechanical Notch Advance
   ========================================================================= */
function switchTab(targetName) {
  tabButtons.forEach((btn) => {
    const isTarget = btn.id === `tab-btn-${targetName}`;
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  for (const [name, panel] of Object.entries(tabPanels)) {
    if (panel) {
      panel.hidden = name !== targetName;
    }
  }

  // Smooth Steins;Gate notch gear advance (~30 degrees)
  currentNotchAngle += 30;
  tabNotchGear.style.transform = `rotate(${currentNotchAngle}deg)`;
}

/* =========================================================================
   Modal Event Listeners (Backdrop click, Close button, Hash cleanup)
   ========================================================================= */
function setupEventListeners() {
  modalCloseBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    const rect = modal.getBoundingClientRect();
    const isInDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeModal();
    }
  });

  modal.addEventListener('close', () => {
    activeChallengeId = null;
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.getAttribute('aria-controls');
      const targetName = panelId.replace('tabpanel-', '');
      switchTab(targetName);
    });
  });

  flagSubmitBtn.addEventListener('click', handleFlagSubmission);
  flagInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleFlagSubmission();
    }
  });

  window.addEventListener('hashchange', handleHashNavigation);
}

function closeModal() {
  if (modal.open) {
    modal.close();
  }
}

/* =========================================================================
   URL Hash Navigation (#<name>-<id>)
   ========================================================================= */
function handleHashNavigation() {
  const hash = window.location.hash;
  if (!hash || hash === '#challenges') {
    if (modal.open) closeModal();
    return;
  }

  const lastHyphen = hash.lastIndexOf('-');
  if (lastHyphen !== -1) {
    const id = parseInt(hash.substring(lastHyphen + 1), 10);
    if (!isNaN(id)) {
      if (cachedChallenges.length > 0) {
        if (activeChallengeId !== id) {
          openChallenge(id);
        }
      } else {
        setTimeout(handleHashNavigation, 80);
      }
    }
  }
}

/* =========================================================================
   Utility Helpers
   ========================================================================= */
function slugify(text) {
  return String(text)
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showBoardAlert(message) {
  alertSlot.innerHTML = `
    <div class="banner-alert" role="alert">
      <span>${escapeHtml(message)}</span>
      <button type="button" class="banner-alert-close" aria-label="Dismiss Alert" onclick="this.parentElement.remove()">×</button>
    </div>
  `;
}

// Start application
initializeApp();
