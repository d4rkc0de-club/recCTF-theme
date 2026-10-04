/* Rules page — clockwork scroll, divergence meter, gears & clock. */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };

  /* ------------------------------------------------------------------
   * Gear geometry
   * teeth: count, r: pitch radius, m: module (tooth height unit)
   * Tooth centre sits at 0.325 of each pitch; gap centre at 0.825.
   * ---------------------------------------------------------------- */
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

  /* Shared steel gradient for the knobs */
  const defs = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
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

  /* Knobs on the roller ends */
  document.querySelectorAll('.knob').forEach((k) => {
    const svg = el('svg', { viewBox: '-50 -50 100 100' }, k);
    el('path', { d: gearPath(12, 38, 6), class: 'k-body' }, svg);
    el('circle', { r: 22, class: 'k-ring' }, svg);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      el('line', {
        x1: (8 * Math.cos(a)).toFixed(2), y1: (8 * Math.sin(a)).toFixed(2),
        x2: (22 * Math.cos(a)).toFixed(2), y2: (22 * Math.sin(a)).toFixed(2),
        class: 'k-spoke',
      }, svg);
    }
    el('circle', { r: 7, class: 'k-hole' }, svg);
  });

  /* Small decorative gears */
  document.querySelectorAll('.mini-gear').forEach((g) => {
    const svg = el('svg', { viewBox: '-12 -12 24 24' }, g);
    el('path', { d: gearPath(10, 8.5, 2) }, svg);
    el('circle', { r: 3 }, svg);
  });

  /* ------------------------------------------------------------------
   * Background gear trains (properly meshing)
   * ---------------------------------------------------------------- */
  const gearsSvg = document.getElementById('gears');
  const SPEED = 1.7; // seconds per tooth -> equal pitch-line speed for all gears

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

  // Place `teeth` gear meshing with gear A at angle `deg` (screen coords).
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
    const W = innerWidth;
    const H = innerHeight;
    gearsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    gearsSvg.replaceChildren();
    const s = Math.min(1.25, Math.max(0.55, Math.min(W, H) / 860));
    const root = el('g', {}, gearsSvg);

    // Top-left train
    const g1 = addGear(root, { x: W * 0.04, y: H * 0.14, teeth: 40, m: 6 * s, rot: 0, dir: 1 });
    const g2 = meshWith(root, g1, 18, 38);
    const g3 = meshWith(root, g2, 28, 95);
    meshWith(root, g3, 12, 25);
    annotate(root, g2, 'T18 · ω 2.22', -20, 50 * s);

    // Bottom-right train
    const h1 = addGear(root, { x: W * 0.97, y: H * 0.9, teeth: 48, m: 6 * s, rot: 3, dir: -1 });
    const h2 = meshWith(root, h1, 16, 205);
    const h3 = meshWith(root, h2, 30, 255);
    meshWith(root, h3, 14, 195);
    annotate(root, h3, 'IBN 5100', 200, 46 * s);

    // Top-right
    const k1 = addGear(root, { x: W * 0.95, y: H * 0.08, teeth: 32, m: 4.5 * s, rot: 0, dir: 1 });
    const k2 = meshWith(root, k1, 14, 150);
    annotate(root, k2, 'Ø ' + Math.round(k2.r * 2) + ' · β', 170, 40 * s);

    // Bottom-left
    const l1 = addGear(root, { x: W * 0.06, y: H * 0.94, teeth: 26, m: 5 * s, rot: 0, dir: -1 });
    const l2 = meshWith(root, l1, 12, -40);
    annotate(root, l2, 'WL 1.048596', -30, 40 * s);
  }

  buildGears();
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildGears, 150);
  });

  /* ------------------------------------------------------------------
   * Clock
   * ---------------------------------------------------------------- */
  const clock = document.getElementById('clock');
  const ticks = document.getElementById('clock-ticks');
  const numerals = document.getElementById('clock-numerals');
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

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
  ROMAN.forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2;
    const t = el('text', { x: (160 * Math.cos(a)).toFixed(2), y: (160 * Math.sin(a)).toFixed(2), class: 'numeral' }, numerals);
    t.textContent = n;
  });

  const hHour = document.getElementById('hand-hour');
  const hMin = document.getElementById('hand-min');
  const hSec = document.getElementById('hand-sec');
  let leap = 0; // whole turns added during a "time leap"

  function setHands() {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    const sec = d.getSeconds();
    const secDeg = (h * 3600 + m * 60 + sec) * 6 + leap * 360 * 3;
    const minDeg = (h * 60 + m + sec / 60) * 6 + leap * 360 * 2;
    const hourDeg = (h * 60 + m) * 0.5 + leap * 360;
    hSec.style.transform = `rotate(${secDeg}deg)`;
    hMin.style.transform = `rotate(${minDeg}deg)`;
    hHour.style.transform = `rotate(${hourDeg}deg)`;
  }
  setHands();
  setInterval(setHands, 1000);

  /* ------------------------------------------------------------------
   * Divergence meter
   * ---------------------------------------------------------------- */
  const WORLDLINES = {
    closed: { value: '0.571024', name: 'α World Line' },
    open: { value: '1.048596', name: 'Steins;Gate' },
  };
  const tubesEl = document.getElementById('tubes');
  const wlName = document.getElementById('worldline-name');
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

  let scrambleTimers = [];
  function shiftWorldline(target) {
    scrambleTimers.forEach(clearInterval);
    scrambleTimers = [];
    wlName.textContent = target.name;
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
  }

  /* ------------------------------------------------------------------
   * Scroll open / close
   * ---------------------------------------------------------------- */
  const scroll = document.getElementById('scroll');
  const toggle = document.getElementById('scroll-toggle');
  const toggleLabel = document.getElementById('toggle-label');
  const paper = document.getElementById('scroll-paper');
  const hint = document.getElementById('hint');
  const flash = document.getElementById('shift-flash');
  const unrollMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--unroll')) * 1000 || 1350;
  let leapTimer;

  function setOpen(open) {
    scroll.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Roll up the rules' : 'Unroll the rules';
    hint.textContent = open ? 'Tap the scroll to roll it up' : 'Tap the scroll to unroll';

    if (open) {
      paper.inert = false;
      paper.querySelector('.paper-inner').scrollTop = 0;
    } else {
      if (paper.contains(document.activeElement)) toggle.focus();
      paper.inert = true;
    }

    // world-line shift: meter, clock time-leap, flash
    shiftWorldline(open ? WORLDLINES.open : WORLDLINES.closed);
    if (!reduceMotion) {
      clock.classList.add('leaping');
      leap += open ? 1 : -1;
      setHands();
      clearTimeout(leapTimer);
      leapTimer = setTimeout(() => clock.classList.remove('leaping'), unrollMs);

      flash.classList.remove('on');
      void flash.offsetWidth; // restart animation
      flash.classList.add('on');
    }
  }

  scroll.addEventListener('click', (e) => {
    // Don't toggle while selecting text or when clicking a link inside the rules
    if (String(getSelection()).length) return;
    if (e.target.closest('a')) return;
    setOpen(!scroll.classList.contains('is-open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scroll.classList.contains('is-open')) setOpen(false);
  });

  /* ------------------------------------------------------------------
   * Light / dark (mirrors the 404 page)
   * ---------------------------------------------------------------- */
  const modeBtn = document.getElementById('toggle-mode');
  const modeText = document.getElementById('mode-text');
  let mode = 'light';
  modeBtn.addEventListener('click', () => {
    mode = mode === 'light' ? 'dark' : 'light';
    window.FluidBackground?.setMode(mode);
    document.body.classList.toggle('theme-dark', mode === 'dark');
    modeText.textContent = mode === 'light' ? 'Dark Mode' : 'Light Mode';
  });
})();
