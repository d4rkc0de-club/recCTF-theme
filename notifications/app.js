/**
 * app.js — recCTF Notifications Logic
 * 
 * Generates dummy data and handles interactions for the expanded 
 * D-Mails page. Also sets up the background clockwork animations.
 */

document.addEventListener('DOMContentLoaded', () => {
  initBackdropGears();
  initSteinsGateClock();
  initNotifications();
});

/* =========================================================================
 * Steins;Gate Clock Mechanics
 * ========================================================================= */
const TAU = Math.PI * 2;
const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
};

function initSteinsGateClock() {
  const ticks = document.getElementById('clock-ticks');
  const numerals = document.getElementById('clock-numerals');
  
  const hHour = document.getElementById('hand-hour');
  const hMin = document.getElementById('hand-min');
  const hSec = document.getElementById('hand-sec');

  // Draw 60 ticks
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

  // Draw Roman numerals
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  if (numerals && numerals.children.length === 0) {
    ROMAN.forEach((n, i) => {
      const a = (i / 12) * TAU - Math.PI / 2;
      const t = el('text', { x: (160 * Math.cos(a)).toFixed(2), y: (160 * Math.sin(a)).toFixed(2), class: 'numeral' }, numerals);
      t.textContent = n;
    });
  }

  // Animation Loop: continuous anti-clockwise motion at random pace
  let secAngle = -Math.floor(Math.random() * 360);
  let minAngle = secAngle / 12;
  let hourAngle = minAngle / 12;
  let currentPace = 45;
  let targetPace = 45;
  let lastPaceShiftTime = performance.now();
  let lastFrameTime = performance.now();

  function clockLoop(now) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (now - lastPaceShiftTime > 1800) {
      targetPace = 25 + Math.random() * 95;
      lastPaceShiftTime = now;
    }
    currentPace += (targetPace - currentPace) * 0.05;

    secAngle -= currentPace * dt;
    minAngle -= (currentPace / 12) * dt;
    hourAngle -= (currentPace / 144) * dt;

    if (hSec) hSec.style.transform = `rotate(${secAngle}deg)`;
    if (hMin) hMin.style.transform = `rotate(${minAngle}deg)`;
    if (hHour) hHour.style.transform = `rotate(${hourAngle}deg)`;

    requestAnimationFrame(clockLoop);
  }

  requestAnimationFrame(clockLoop);
}

/* =========================================================================
 * Background Gears (Decorative)
 * ========================================================================= */
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
  const gearsSvg = document.getElementById('gears');
  if (!gearsSvg) return;
  const SPEED = 1.7; // seconds per tooth

  function addGear(parent, { x, y, teeth, m, rot, dir }) {
    const r = (m * teeth) / 2;
    const outer = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(3)})` }, parent);
    const g = el('g', { class: 'gear' }, outer);
    g.style.setProperty('--dur', `${(teeth * SPEED).toFixed(1)}s`);
    g.style.setProperty('--dir', dir > 0 ? 'normal' : 'reverse');
    el('path', { d: gearPath(teeth, r, m) }, g);
    const inner = r - 1.25 * m - m * 1.6;
    if (inner > 14) {
      el('circle', { r: inner.toFixed(1) }, g);
      const hub = Math.max(6, r * 0.22);
      el('circle', { r: hub.toFixed(1), class: 'hub' }, g);
      el('circle', { r: (hub * 0.45).toFixed(1) }, g);
      const spokes = teeth > 30 ? 6 : teeth > 18 ? 5 : 4;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU;
        el('line', {
          x1: (hub * Math.cos(a)).toFixed(1), y1: (hub * Math.sin(a)).toFixed(1),
          x2: (inner * Math.cos(a)).toFixed(1), y2: (inner * Math.sin(a)).toFixed(1),
          class: 'spoke',
        }, g);
      }
    } else {
      el('circle', { r: Math.max(3, r * 0.25).toFixed(1) }, g);
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
    el('path', { d: `M${x1} ${y1} L${x2} ${y2} l${right ? 40 : -40} 0`, class: 'annot-line' }, parent);
    const t = el('text', { x: x2 + (right ? 44 : -44), y: y2 + 3, class: 'annot', 'text-anchor': right ? 'start' : 'end' }, parent);
    t.textContent = text;
  }

  function buildGears() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    gearsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    gearsSvg.replaceChildren();
    const s = Math.min(1.25, Math.max(0.55, Math.min(W, H) / 860));
    const root = el('g', {}, gearsSvg);

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
 * Notifications Data & Rendering
 * ========================================================================= */
const DUMMY_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Temporal Synchronization Alert',
    body: 'The divergence meter has shifted to 0.571024. Please ensure all ongoing challenges are calibrated to the new timeline to prevent data corruption.',
    tag: 'System',
    critical: true,
    unread: true,
    time: '10:42 AM'
  },
  {
    id: 2,
    title: 'New Challenge Unlocked: SERN Gateway',
    body: 'A new node has appeared on the network. Preliminary scans indicate an encrypted SERN employee portal. We need you to breach it immediately.',
    tag: 'Web',
    critical: false,
    unread: true,
    time: 'Yesterday'
  },
  {
    id: 3,
    title: 'Maintenance Downtime',
    body: 'The lab server will be undergoing brief maintenance at 0300 hours. The IBN-5100 emulator might be temporarily unavailable during this window.',
    tag: 'Notice',
    critical: false,
    unread: false,
    time: 'Oct 2'
  },
  {
    id: 4,
    title: 'Welcome to the Future Gadget Lab',
    body: 'El Psy Kongroo. Your lab member badge has been issued. Head over to the challenges board and start proving your worth.',
    tag: 'General',
    critical: false,
    unread: false,
    time: 'Sep 28'
  }
];

function initNotifications() {
  const listEl = document.getElementById('notif-list');
  const countEl = document.getElementById('unread-count');
  const markReadBtn = document.getElementById('mark-all-read');

  if (!listEl) return;

  // Render
  listEl.innerHTML = DUMMY_NOTIFICATIONS.map(notif => `
    <a href="#" class="notif-card ${notif.unread ? 'unread' : ''} ${notif.critical ? 'critical' : ''}" data-id="${notif.id}">
      <div class="notif-meta">
        <span class="notif-tag">${notif.tag}</span>
        <span class="notif-time">${notif.time}</span>
      </div>
      <h3 class="notif-title">${notif.title}</h3>
      <p class="notif-body">${notif.body}</p>
    </a>
  `).join('');

  // Update count
  const updateCount = () => {
    const unread = document.querySelectorAll('.notif-card.unread').length;
    countEl.textContent = unread;
  };
  updateCount();

  // Mark all read
  markReadBtn.addEventListener('click', () => {
    document.querySelectorAll('.notif-card.unread').forEach(el => {
      el.classList.remove('unread');
    });
    updateCount();
  });

  // Individual click
  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.notif-card');
    if (card) {
      e.preventDefault();
      card.classList.remove('unread');
      updateCount();
    }
  });
}
