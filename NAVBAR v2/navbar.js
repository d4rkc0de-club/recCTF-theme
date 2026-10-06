/* recCTF navbar — vanilla JS. Load with `defer` after script.js (or alone). */
(() => {
  'use strict';

  const nav = document.getElementById('nav');
  if (!nav) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobileMQ = matchMedia('(max-width: 860px)');

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  function gearPath(teeth, r, m) {
    const ro = r + m, rr = r - 1.25 * m, p = TAU / teeth;
    const pt = (rad, a) => `${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const b = i * p;
      d += (i ? 'L' : 'M') + pt(rr, b) + 'L' + pt(ro, b + p * .2) + 'L' + pt(ro, b + p * .45) + 'L' + pt(rr, b + p * .65);
    }
    return d + 'Z';
  }

  /* ---------- Steel knobs + mini gears (same geometry as the scroll) ---------- */
  const defs = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
  defs.innerHTML = `<defs><radialGradient id="navSteel" cx="35%" cy="30%" r="75%">
    <stop offset="0" stop-color="#f4f4f5"/><stop offset=".35" stop-color="#bdbdc1"/>
    <stop offset=".75" stop-color="#6c6c71"/><stop offset="1" stop-color="#2c2c2f"/></radialGradient></defs>`;
  document.body.prepend(defs);

  nav.querySelectorAll('.knob').forEach((k) => {
    const svg = el('svg', { viewBox: '-50 -50 100 100' }, k);
    el('path', { d: gearPath(12, 38, 6), class: 'k-body' }, svg);
    el('circle', { r: 22, class: 'k-ring' }, svg);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      el('line', { x1: (8 * Math.cos(a)).toFixed(2), y1: (8 * Math.sin(a)).toFixed(2),
        x2: (22 * Math.cos(a)).toFixed(2), y2: (22 * Math.sin(a)).toFixed(2), class: 'k-spoke' }, svg);
    }
    el('circle', { r: 7, class: 'k-hole' }, svg);
  });

  const buildMiniGears = (root) => root.querySelectorAll('.mini-gear:not(:has(svg))').forEach((g) => {
    const svg = el('svg', { viewBox: '-12 -12 24 24' }, g);
    el('path', { d: gearPath(10, 8.5, 2), fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 }, svg);
    el('circle', { r: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4 }, svg);
  });
  buildMiniGears(nav);

  /* ---------- Active page ---------- */
  const linksEl = document.getElementById('nav-links');
  const links = [...linksEl.querySelectorAll('.nav-link')];
  const norm = (p) => p.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const here = norm(location.pathname);
  let active = links.find((a) => norm(new URL(a.href, location.href).pathname) === here)
    || links.find((a) => a.hasAttribute('aria-current')) || null;
  links.forEach((a) => a.removeAttribute('aria-current'));
  active?.setAttribute('aria-current', 'page');

  /* ---------- Lamp: slides to hovered / focused / active link ---------- */
  const lamp = linksEl.querySelector('.nav-lamp');
  let lit = null;

  function moveLamp(target) {
    lit = target;
    links.forEach((a) => a.classList.toggle('is-lit', a === target));
    if (!target) { linksEl.style.setProperty('--lo', 0); return; }
    linksEl.style.setProperty('--lx', target.offsetLeft + 'px');
    linksEl.style.setProperty('--lw', target.offsetWidth + 'px');
    linksEl.style.setProperty('--lo', 1);
  }
  const rest = () => moveLamp(active);

  /* ---------- Divergence mini-meter: scrambles to each page's "world line" ---------- */
  const wl = document.getElementById('nav-wl');
  const home = '0.571024';
  const cells = [];
  home.split('').forEach((ch) => {
    const t = document.createElement('span');
    t.className = 't' + (ch === '.' ? ' dot' : '');
    t.textContent = ch;
    wl.appendChild(t);
    cells.push({ t, dot: ch === '.' });
  });
  let timers = [];
  function setWorldline(value) {
    wl.setAttribute('aria-label', 'Divergence ' + value);
    timers.forEach((x) => { clearInterval(x); clearTimeout(x); });
    timers = [];
    cells.forEach((c, i) => {
      if (c.dot) return;
      if (reduceMotion) { c.t.textContent = value[i]; return; }
      c.t.classList.add('flicker');
      const iv = setInterval(() => { c.t.textContent = Math.floor(Math.random() * 10); }, 55);
      const to = setTimeout(() => {
        clearInterval(iv);
        c.t.textContent = value[i];
        c.t.classList.remove('flicker');
      }, 220 + i * 70);
      timers.push(iv, to);
    });
  }
  const wlOf = (a) => (a && a.dataset.wl) || home;
  const baseWL = () => wlOf(active);
  setWorldline(baseWL());

  links.forEach((a) => {
    a.addEventListener('pointerenter', () => { moveLamp(a); setWorldline(wlOf(a)); });
    a.addEventListener('focus', () => { moveLamp(a); setWorldline(wlOf(a)); });
    a.addEventListener('blur', () => { if (!linksEl.matches(':hover')) { rest(); setWorldline(baseWL()); } });

    // magnetic pull toward the pointer
    if (finePointer && !reduceMotion) {
      a.addEventListener('pointermove', (e) => {
        const r = a.getBoundingClientRect();
        a.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .14).toFixed(1) + 'px');
        a.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .22).toFixed(1) + 'px');
      });
      a.addEventListener('pointerleave', () => { a.style.setProperty('--mx', '0px'); a.style.setProperty('--my', '0px'); });
    }
  });
  linksEl.addEventListener('pointerleave', () => { rest(); setWorldline(baseWL()); });

  // roving arrow-key navigation
  linksEl.addEventListener('keydown', (e) => {
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Home') links[0].focus();
    else if (e.key === 'End') links[links.length - 1].focus();
    else if (step) links[(i + step + links.length) % links.length].focus();
    else return;
    e.preventDefault();
  });

  const place = () => { moveLamp(lit && linksEl.matches(':hover') ? lit : active); };
  const settle = () => {
    // first placement without sliding in from x:0
    lamp.style.transition = 'none';
    rest();
    void lamp.offsetWidth;
    lamp.style.transition = '';
    nav.classList.add('is-ready');
  };
  (document.fonts?.ready || Promise.resolve()).then(settle);
  new ResizeObserver(place).observe(linksEl);

  /* ---------- Mobile sheet (clones the links as a scroll of rules) ---------- */
  const burger = document.getElementById('nav-burger');
  const sheet = document.getElementById('nav-sheet');
  const sheetList = sheet.querySelector('ol');
  links.forEach((a, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', i);
    const c = document.createElement('a');
    c.className = 's-link';
    c.href = a.href;
    c.textContent = a.querySelector('.label').textContent;
    if (a === active) c.setAttribute('aria-current', 'page');
    li.appendChild(c);
    sheetList.appendChild(li);
  });
  const cta = nav.querySelector('.nav-cta');
  const foot = sheet.querySelector('.sheet-foot');
  const sheetCta = cta.cloneNode(true);
  sheetCta.querySelector('.mini-gear')?.replaceChildren();
  foot.appendChild(sheetCta);
  buildMiniGears(sheet);

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    sheet.inert = !open;
    setWorldline(open ? '1.048596' : baseWL());
    if (!open && sheet.contains(document.activeElement)) burger.focus();
  }
  sheet.inert = true;
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false); });
  document.addEventListener('pointerdown', (e) => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false); });
  mobileMQ.addEventListener('change', (e) => { if (!e.matches) setOpen(false); });

  /* ---------- Scroll: knobs turn, bar condenses (always stays pinned) ---------- */
  let ticking = false;
  function onScroll() {
    nav.classList.toggle('is-scrolled', scrollY > 24);
    if (!reduceMotion) nav.style.setProperty('--spin-n', (scrollY * .35).toFixed(1));
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Light / dark (drives the same hooks as the rules page) ---------- */
  const modeBtn = document.getElementById('toggle-mode');
  const modeText = document.getElementById('mode-text');
  const sync = () => {
    const dark = document.body.classList.contains('theme-dark');
    modeText.textContent = dark ? 'Light Mode' : 'Dark Mode';
    modeBtn.setAttribute('aria-pressed', String(dark));
  };
  // If the page already wires #toggle-mode (script.js does), just mirror it.
  if (!window.__pageOwnsModeToggle && !document.querySelector('script[src$="script.js"]')) {
    modeBtn.addEventListener('click', () => {
      const dark = !document.body.classList.contains('theme-dark');
      document.body.classList.toggle('theme-dark', dark);
      window.FluidBackground?.setMode(dark ? 'dark' : 'light');
    });
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
