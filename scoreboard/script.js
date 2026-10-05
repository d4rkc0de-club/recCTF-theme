/* Scoreboard Gears — Steins;Gate clockwork podium, fetches CTFd standings. */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  /* ---- SVG helpers ---- */
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };

  /* ---- Gear-tooth path generator (from rules page) ---- */
  function gearPath(teeth, r, m) {
    const ro = r + m;
    const rr = r - 1.25 * m;
    const p = TAU / teeth;
    const pt = (rad, a) =>
      `${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`;
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

  /* ---- Shared SVG defs (steel gradient for nav knobs) ---- */
  const hiddenDefs = el('svg', {
    width: 0,
    height: 0,
    'aria-hidden': 'true',
    style: 'position:absolute',
  });
  hiddenDefs.innerHTML = `
    <defs>
      <radialGradient id="steelGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0" stop-color="#f4f4f5"/>
        <stop offset=".35" stop-color="#bdbdc1"/>
        <stop offset=".75" stop-color="#6c6c71"/>
        <stop offset="1" stop-color="#2c2c2f"/>
      </radialGradient>
    </defs>`;
  document.body.prepend(hiddenDefs);

  /* ---- Mini-gear icons ---- */
  document.querySelectorAll('.mini-gear').forEach((g) => {
    const svg = el('svg', { viewBox: '-12 -12 24 24' }, g);
    el('path', { d: gearPath(10, 8.5, 2) }, svg);
    el('circle', { r: 3 }, svg);
  });

  /* ==================================================================
   * Background gear trains (identical logic to rules page)
   * ================================================================ */
  const gearsSvg = document.getElementById('gears');
  const BG_SPEED = 1.7;

  function addBgGear(parent, { x, y, teeth, m, rot, dir }) {
    const r = (m * teeth) / 2;
    const outer = el(
      'g',
      { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(3)})` },
      parent
    );
    const g = el('g', { class: 'gear' }, outer);
    g.style.setProperty('--dur', `${(teeth * BG_SPEED).toFixed(1)}s`);
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

  function meshBgWith(parent, A, teeth, deg) {
    const th = (deg * Math.PI) / 180;
    const rB = (A.m * teeth) / 2;
    const dist = A.r + rB;
    const pA = TAU / A.teeth;
    const pB = TAU / teeth;
    const a = (A.rot * Math.PI) / 180;
    const phiA = (((th - a) / pA) % 1 + 1) % 1;
    const b = th + Math.PI - pB * (0.15 - phiA);
    return addBgGear(parent, {
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
    el('path', {
      d: `M${x1} ${y1} L${x2} ${y2} l${right ? 40 : -40} 0`,
      class: 'annot-line',
    }, parent);
    const t = el('text', {
      x: x2 + (right ? 44 : -44),
      y: y2 + 3,
      class: 'annot',
      'text-anchor': right ? 'start' : 'end',
    }, parent);
    t.textContent = text;
  }

  function buildBgGears() {
    const W = innerWidth;
    const H = innerHeight;
    gearsSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    gearsSvg.replaceChildren();
    const s = Math.min(1.25, Math.max(0.55, Math.min(W, H) / 860));
    const root = el('g', {}, gearsSvg);

    const g1 = addBgGear(root, { x: W * 0.04, y: H * 0.14, teeth: 40, m: 6 * s, rot: 0, dir: 1 });
    const g2 = meshBgWith(root, g1, 18, 38);
    const g3 = meshBgWith(root, g2, 28, 95);
    meshBgWith(root, g3, 12, 25);
    annotate(root, g2, 'T18 · ω 2.22', -20, 50 * s);

    const h1 = addBgGear(root, { x: W * 0.97, y: H * 0.9, teeth: 48, m: 6 * s, rot: 3, dir: -1 });
    const h2 = meshBgWith(root, h1, 16, 205);
    const h3 = meshBgWith(root, h2, 30, 255);
    meshBgWith(root, h3, 14, 195);
    annotate(root, h3, 'IBN 5100', 200, 46 * s);

    const k1 = addBgGear(root, { x: W * 0.95, y: H * 0.08, teeth: 32, m: 4.5 * s, rot: 0, dir: 1 });
    const k2 = meshBgWith(root, k1, 14, 150);
    annotate(root, k2, 'Ø ' + Math.round(k2.r * 2) + ' · β', 170, 40 * s);

    const l1 = addBgGear(root, { x: W * 0.06, y: H * 0.94, teeth: 26, m: 5 * s, rot: 0, dir: -1 });
    const l2 = meshBgWith(root, l1, 12, -40);
    annotate(root, l2, 'WL 1.048596', -30, 40 * s);
  }

  buildBgGears();
  let bgResizeTimer;
  addEventListener('resize', () => {
    clearTimeout(bgResizeTimer);
    bgResizeTimer = setTimeout(buildBgGears, 150);
  });

  /* ==================================================================
   * Clock (identical to rules page)
   * ================================================================ */
  const ticks = document.getElementById('clock-ticks');
  const numeralsEl = document.getElementById('clock-numerals');
  const ROMAN = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];

  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const major = i % 5 === 0;
    el('line', {
      x1: (186 * Math.cos(a)).toFixed(2), y1: (186 * Math.sin(a)).toFixed(2),
      x2: ((major ? 172 : 180) * Math.cos(a)).toFixed(2),
      y2: ((major ? 172 : 180) * Math.sin(a)).toFixed(2),
      class: major ? 'tick major' : 'tick',
    }, ticks);
  }
  ROMAN.forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2;
    const t = el('text', {
      x: (160 * Math.cos(a)).toFixed(2),
      y: (160 * Math.sin(a)).toFixed(2),
      class: 'numeral',
    }, numeralsEl);
    t.textContent = n;
  });

  const hHour = document.getElementById('hand-hour');
  const hMin = document.getElementById('hand-min');
  const hSec = document.getElementById('hand-sec');

  function setHands() {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    hSec.style.transform = `rotate(${(h * 3600 + m * 60 + s) * 6}deg)`;
    hMin.style.transform = `rotate(${(h * 60 + m + s / 60) * 6}deg)`;
    hHour.style.transform = `rotate(${(h * 60 + m) * 0.5}deg)`;
  }
  setHands();
  setInterval(setHands, 1000);

  /* ==================================================================
   * Light / dark toggle
   * ================================================================ */
  const modeBtn = document.getElementById('toggle-mode');
  const modeText = document.getElementById('mode-text');
  let mode = 'light';
  modeBtn.addEventListener('click', () => {
    mode = mode === 'light' ? 'dark' : 'light';
    window.FluidBackground?.setMode(mode);
    document.body.classList.toggle('theme-dark', mode === 'dark');
    modeText.textContent = mode === 'light' ? 'Dark Mode' : 'Light Mode';
    // Rebuild podium to pick up new CSS variable colours
    if (lastStandings) buildPodium(lastStandings);
  });

  /* ==================================================================
   * PODIUM — Three interlocking gears, the main scoreboard display
   * ================================================================ */
  const PLACEHOLDER = [
    { name: 'Lab Member 001', score: 4200 },
    { name: 'Lab Member 002', score: 3850 },
    { name: 'Lab Member 003', score: 3100 },
  ];

  // All three gears share the same module so teeth can mesh.
  const M = 5.0;
  const GOLD_T = 36;   // gold gear teeth
  const SILVER_T = 30; // silver gear teeth
  const BRONZE_T = 24; // bronze gear teeth
  const GOLD_R = (M * GOLD_T) / 2;     // pitch radius 90
  const SILVER_R = (M * SILVER_T) / 2; // pitch radius 75
  const BRONZE_R = (M * BRONZE_T) / 2; // pitch radius 60

  // Gear rotation periods (seconds per full turn), proportional to teeth
  // so the tangential speed at the pitch circle is identical = they mesh.
  const BASE_PERIOD = 1.2; // seconds per tooth

  // Placement angles for the two side gears relative to gold centre
  const ANG_R = 25 * (Math.PI / 180);            // silver (right-of-centre, below gold)
  const ANG_L = Math.PI - 25 * (Math.PI / 180);  // bronze (left-of-centre, below gold)
  const DIST_S = GOLD_R + SILVER_R;               // pitch-circle tangent distance (silver)
  const DIST_B = GOLD_R + BRONZE_R;               // pitch-circle tangent distance (bronze)

  // Centre positions
  const GX = 0, GY = 0;
  const SX = GX + DIST_S * Math.cos(ANG_R);
  const SY = GY + DIST_S * Math.sin(ANG_R);
  const BX = GX + DIST_B * Math.cos(ANG_L);
  const BY = GY + DIST_B * Math.sin(ANG_L);

  // ViewBox bounds
  const PAD = M + 8;
  const vbL = BX - BRONZE_R - PAD;
  const vbR = SX + SILVER_R + PAD;
  const vbT = Math.min(GY - GOLD_R, SY - SILVER_R, BY - BRONZE_R) - PAD;
  const vbB = Math.max(GY + GOLD_R, SY + SILVER_R, BY + BRONZE_R) + PAD;

  // Mesh offset: so that a tooth of the gold gear lands in a gap of the side gear
  function meshOffset(angle, teethA, teethB) {
    const pA = TAU / teethA;
    const pB = TAU / teethB;
    const phase = ((angle / pA) % 1 + 1) % 1;
    const base = angle + Math.PI;
    return ((base - pB * (0.15 - phase)) * 180) / Math.PI;
  }

  const silverOffset = meshOffset(ANG_R, GOLD_T, SILVER_T);
  const bronzeOffset = meshOffset(ANG_L, GOLD_T, BRONZE_T);

  /* ---- Draw one podium gear (rotating body + static overlay label) ---- */
  function drawGear(svg, cx, cy, teeth, pitchR, gradId, strokeCol, dir, offsetDeg, label) {
    const tickR = pitchR * 0.68;
    const hubR  = pitchR * 0.22;
    const innerR = pitchR * 0.48;
    const isGold = teeth === GOLD_T;
    const period = teeth * BASE_PERIOD;

    // Container group translated to gear centre
    const container = el('g', { transform: `translate(${cx.toFixed(1)},${cy.toFixed(1)})` }, svg);

    // Initial-offset wrapper (static transform so CSS animation adds on top)
    const offsetWrap = el('g', { transform: `rotate(${offsetDeg.toFixed(2)})` }, container);

    // Animated rotation group
    const anim = el('g', { class: 'gear-rotating' }, offsetWrap);
    if (!reduceMotion) {
      const kf = dir > 0 ? 'gear-spin-cw' : 'gear-spin-ccw';
      anim.style.animation = `${kf} ${period}s linear infinite`;
      anim.style.transformOrigin = '0 0';
    }

    // -- Gear tooth body --
    el('path', {
      d: gearPath(teeth, pitchR, M),
      class: 'podium-gear-body',
      fill: `url(#${gradId})`,
      stroke: strokeCol,
    }, anim);

    // -- Decorative rings --
    [0.88, 0.78, 0.55, 0.35].forEach(frac => {
      el('circle', {
        r: (pitchR * frac).toFixed(1),
        class: 'gear-ring-detail',
        stroke: strokeCol,
      }, anim);
    });

    // -- Tick marks & roman numerals ring --
    el('circle', { r: tickR.toFixed(1), class: 'gear-tick-ring', stroke: strokeCol }, anim);

    const ROM = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const major = i % 5 === 0;
      const r1 = tickR + pitchR * 0.05;
      const r2 = tickR - (major ? pitchR * 0.06 : pitchR * 0.03);
      el('line', {
        x1: (r1 * Math.cos(a)).toFixed(2), y1: (r1 * Math.sin(a)).toFixed(2),
        x2: (r2 * Math.cos(a)).toFixed(2), y2: (r2 * Math.sin(a)).toFixed(2),
        class: major ? 'gear-tick major' : 'gear-tick',
        stroke: strokeCol,
      }, anim);

      // Roman numerals only on the larger gold gear
      if (major && isGold) {
        const nr = tickR - pitchR * 0.13;
        const t = el('text', {
          x: (nr * Math.cos(a)).toFixed(2),
          y: (nr * Math.sin(a)).toFixed(2),
          class: 'gear-numeral',
          fill: strokeCol,
          'font-size': `${(pitchR * 0.1).toFixed(1)}px`,
        }, anim);
        t.textContent = ROM[i / 5];
      }
    }

    // -- Spokes --
    const nSpokes = isGold ? 8 : 6;
    for (let i = 0; i < nSpokes; i++) {
      const a = (i / nSpokes) * TAU;
      el('line', {
        x1: (hubR * Math.cos(a)).toFixed(1), y1: (hubR * Math.sin(a)).toFixed(1),
        x2: (innerR * Math.cos(a)).toFixed(1), y2: (innerR * Math.sin(a)).toFixed(1),
        class: 'gear-spoke-line', stroke: strokeCol,
      }, anim);
    }

    // -- Hub --
    el('circle', {
      r: (hubR * 1.4).toFixed(1),
      class: 'gear-hub-outer',
      fill: `url(#${gradId})`, stroke: strokeCol,
    }, anim);
    el('circle', {
      r: (hubR * 0.5).toFixed(1),
      class: 'gear-hub-inner',
      fill: strokeCol, stroke: strokeCol, opacity: '0.4',
    }, anim);

    // -- Text overlay (does NOT rotate — placed directly on container) --
    if (label) {
      const lg = el('g', { class: 'gear-label' }, container);
      const placeMap = { '1st': 'I', '2nd': 'II', '3rd': 'III' };

      el('text', {
        x: 0, y: (-pitchR * 0.22).toFixed(1),
        class: 'gear-place',
        fill: label.textColor,
        'font-size': `${isGold ? 11 : 9}px`,
      }, lg).textContent = placeMap[label.place] || '';

      const displayName = label.name.length > (isGold ? 18 : 13)
        ? label.name.slice(0, isGold ? 16 : 11) + '…'
        : label.name;

      el('text', {
        x: 0, y: (pitchR * 0.02).toFixed(1),
        class: 'gear-name',
        fill: label.textColor,
        'font-size': `${isGold ? 15 : 11}px`,
      }, lg).textContent = displayName;

      el('text', {
        x: 0, y: (pitchR * 0.2).toFixed(1),
        class: 'gear-score',
        fill: label.textColor,
        'font-size': `${isGold ? 12 : 9}px`,
      }, lg).textContent = `${label.score.toLocaleString()} pts`;
    }
  }

  let lastStandings = null;

  /* ---- Build the full podium SVG ---- */
  function buildPodium(standings) {
    lastStandings = standings;
    const area = document.getElementById('podium-area');
    area.innerHTML = '';

    const w = vbR - vbL, h = vbB - vbT;
    const svg = el('svg', {
      viewBox: `${vbL.toFixed(0)} ${vbT.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`,
      class: 'podium-svg',
      width: Math.min(w, 680).toFixed(0),
      height: Math.min(h, 460).toFixed(0),
      'aria-hidden': 'true',
    });
    area.appendChild(svg);

    // Defs — metallic gradients + drop shadow
    const d = el('defs', {}, svg);
    d.innerHTML = `
      <radialGradient id="goldGrad" cx="38%" cy="28%" r="72%">
        <stop offset="0"   stop-color="var(--gold-light)"/>
        <stop offset=".32" stop-color="var(--gold)"/>
        <stop offset=".72" stop-color="var(--gold-dark)"/>
        <stop offset="1"   stop-color="#5c4a1e"/>
      </radialGradient>
      <radialGradient id="silverGrad" cx="38%" cy="28%" r="72%">
        <stop offset="0"   stop-color="var(--silver-light)"/>
        <stop offset=".32" stop-color="var(--silver)"/>
        <stop offset=".72" stop-color="var(--silver-dark)"/>
        <stop offset="1"   stop-color="#48484e"/>
      </radialGradient>
      <radialGradient id="bronzeGrad" cx="38%" cy="28%" r="72%">
        <stop offset="0"   stop-color="var(--bronze-light)"/>
        <stop offset=".32" stop-color="var(--bronze)"/>
        <stop offset=".72" stop-color="var(--bronze-dark)"/>
        <stop offset="1"   stop-color="#3e2c1a"/>
      </radialGradient>
    `;

    const isDark = document.body.classList.contains('theme-dark');

    // Draw order: back gears first, gold on top
    // Bronze — 3rd place, left
    if (standings[2]) {
      drawGear(svg, BX, BY, BRONZE_T, BRONZE_R, 'bronzeGrad',
        'var(--bronze-dark)', -1, bronzeOffset,
        { place: '3rd', name: standings[2].name, score: standings[2].score,
          textColor: isDark ? '#dcba90' : '#3e2c1a' });
    }

    // Silver — 2nd place, right
    if (standings[1]) {
      drawGear(svg, SX, SY, SILVER_T, SILVER_R, 'silverGrad',
        'var(--silver-dark)', -1, silverOffset,
        { place: '2nd', name: standings[1].name, score: standings[1].score,
          textColor: isDark ? '#d0d0d6' : '#2a2a30' });
    }

    // Gold — 1st place, centre (on top)
    if (standings[0]) {
      drawGear(svg, GX, GY, GOLD_T, GOLD_R, 'goldGrad',
        'var(--gold-dark)', 1, 0,
        { place: '1st', name: standings[0].name, score: standings[0].score,
          textColor: isDark ? '#f0e09a' : '#3a2e10' });
    }

    updateSRTable(standings);
  }

  /* ---- Accessible table for screen readers ---- */
  function updateSRTable(standings) {
    const tbody = document.getElementById('sr-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    standings.forEach((s, i) => {
      if (!s) return;
      const tr = document.createElement('tr');
      const d = document.createElement('td');
      d.textContent = i + 1;
      const n = document.createElement('td');
      n.textContent = s.name;
      const sc = document.createElement('td');
      sc.textContent = s.score;
      tr.append(d, n, sc);
      tbody.appendChild(tr);
    });
  }

  /* ---- Visible standings board ---- */
  function updateVisibleTable(standings) {
    const list = document.getElementById('standings-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Helper for roman numerals (up to 100 is usually enough for a scoreboard page like this, but let's use standard numbers for simplicity or roman for top 10)
    const toRoman = (num) => {
      const roman = { C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
      let str = '';
      for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
      }
      return str || '0';
    };

    standings.forEach((s, i) => {
      if (!s) return;
      const li = document.createElement('li');
      
      const rank = document.createElement('div');
      rank.className = 'standing-rank';
      rank.textContent = toRoman(i + 1);
      
      const name = document.createElement('div');
      name.className = 'standing-name';
      name.textContent = s.name;
      
      const score = document.createElement('div');
      score.className = 'standing-score';
      score.textContent = s.score.toLocaleString() + ' pts';
      
      li.append(rank, name, score);
      list.appendChild(li);
    });
  }

  /* ==================================================================
   * Fetch from CTFd's scoreboard API, fall back to placeholders
   * ================================================================ */
  async function fetchStandings() {
    const loading = document.getElementById('podium-loading');
    try {
      const r = await fetch('/api/v1/scoreboard/top/100');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = json.data;
      const list = [];
      const keys = Object.keys(data).map(Number).filter(k => !isNaN(k)).sort((a, b) => a - b);
      
      for (const k of keys) {
        const e = data[String(k)];
        if (e) list.push({ name: e.name || `Team ${k}`, score: e.score || 0 });
      }
      
      while (list.length < 3) list.push(PLACEHOLDER[list.length]);
      if (loading) loading.style.display = 'none';
      buildPodium(list);
      updateVisibleTable(list);
    } catch (err) {
      console.warn('CTFd API unavailable, using placeholder standings:', err.message);
      if (loading) loading.style.display = 'none';
      
      // Expand placeholder for the table preview
      const fullPlaceholder = [...PLACEHOLDER, 
        { name: 'Lab Member 004', score: 2800 },
        { name: 'Lab Member 005', score: 2400 },
        { name: 'Lab Member 006', score: 2100 },
        { name: 'Lab Member 007', score: 1800 },
        { name: 'Lab Member 008', score: 1500 }
      ];
      buildPodium(fullPlaceholder);
      updateVisibleTable(fullPlaceholder);
    }
  }

  fetchStandings();
})();
