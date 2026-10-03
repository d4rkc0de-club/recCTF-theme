/*!
 * fluid.js — cursor-driven, strictly monochrome WebGL fluid background.
 *
 * Stable-fluids Navier–Stokes solver in fragment shaders (advection, curl,
 * vorticity confinement, divergence, Jacobi pressure, gradient subtraction,
 * dye advection) with ping-pong framebuffers — the approach of Pavel
 * Dobryakov's "WebGL Fluid Simulation", minus random splats and colour.
 *
 * Dye is a single scalar density, so every output pixel has R = G = B.
 * The canvas is idle until the cursor / a finger moves; nothing auto-spawns.
 *
 * Usage: <script src="fluid.js" defer></script>
 * Optional: define window.FLUID_CONFIG = { mode: 'dark', ... } before it.
 * Runtime:  window.FluidBackground.setMode('dark' | 'light')
 */
(() => {
  'use strict';

  /* ======================================================================
   * CONFIG
   * ==================================================================== */
  const CONFIG = Object.assign({
    mode: 'light',              // 'dark' | 'light'

    simResolution: 128,         // velocity / pressure grid (shorter side)
    dyeResolution: 1024,        // smoke density grid (shorter side)

    dissipation: 0.98,          // dye kept per frame @60fps (0.97 – 0.99)
    velocityDissipation: 0.985, // velocity kept per frame @60fps
    pressure: 0.8,              // pressure carried between frames
    pressureIterations: 20,     // Jacobi iterations
    curl: 28,                   // vorticity confinement strength

    splatRadius: 0.04,          // fraction of the viewport's shorter side
    splatForce: 1.2,            // fluid velocity relative to cursor velocity
    dyeAmount: 0.4,             // smoke injected by a fast stroke
    fullSpeed: 2.5,             // px/ms at which a stroke is "fast"
    maxCursorSpeed: 7,          // px/ms clamp, keeps flicks stable

    densityGain: 2.2,           // density -> brightness ramp steepness
    bloom: true,
    bloomIntensity: 0.32,
    bloomThreshold: 0.12,
    bloomKnee: 0.6,
    bloomResolution: 256,
    bloomIterations: 3,
    vignette: 0.16,             // 0 = off

    maxDPR: 2,
    idleSleepMs: 12000,         // stop the loop this long after last input
  }, window.FLUID_CONFIG || {});

  // Strictly grey: one scalar per mode, used for R, G and B alike.
  const PALETTES = {
    dark:  { bg: 0x08 / 255, ink: 0xd0 / 255, css: '#08080a' },
    light: { bg: 0xc8 / 255, ink: 0x0a / 255, css: '#c8c8c8' },
  };
  const palette = () => PALETTES[CONFIG.mode] || PALETTES.dark;

  /* ======================================================================
   * Canvas + context
   * ==================================================================== */
  const canvas = document.createElement('canvas');
  canvas.id = 'fluid-background';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '-1', pointerEvents: 'none', display: 'block',
    background: palette().css,
  });

  const ctxOpts = {
    alpha: false, depth: false, stencil: false,
    antialias: false, preserveDrawingBuffer: false,
  };
  let gl = canvas.getContext('webgl2', ctxOpts);
  const isWebGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
  if (!gl) return; // No WebGL: leave the page untouched.

  let halfFloatType, supportLinear;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    halfFloatType = gl.HALF_FLOAT;
    supportLinear = true; // 16F textures are filterable in WebGL2 core
  } else {
    const hf = gl.getExtension('OES_texture_half_float');
    if (!hf) return;
    gl.getExtension('EXT_color_buffer_half_float');
    halfFloatType = hf.HALF_FLOAT_OES;
    supportLinear = !!gl.getExtension('OES_texture_half_float_linear');
  }

  function supportsRenderFormat(internalFormat, format, type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return ok;
  }

  function getFormat(internalFormat, format) {
    if (supportsRenderFormat(internalFormat, format, halfFloatType)) return { internalFormat, format };
    if (!isWebGL2) return null;
    if (internalFormat === gl.R16F) return getFormat(gl.RG16F, gl.RG);
    if (internalFormat === gl.RG16F) return getFormat(gl.RGBA16F, gl.RGBA);
    return null;
  }

  const fmtR  = isWebGL2 ? getFormat(gl.R16F, gl.RED) : getFormat(gl.RGBA, gl.RGBA);
  const fmtRG = isWebGL2 ? getFormat(gl.RG16F, gl.RG) : getFormat(gl.RGBA, gl.RGBA);
  if (!fmtR || !fmtRG) return; // Can't render to float targets.

  /* ======================================================================
   * Shaders (GLSL ES 1.00 — runs on WebGL1 and WebGL2)
   * ==================================================================== */
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp sampler2D;
#else
precision mediump float;
precision mediump sampler2D;
#endif
`;

  const baseVS = `
precision highp float;
attribute vec2 aPosition;
uniform vec2 texelSize;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const copyFS = FS + `
varying vec2 vUv;
uniform sampler2D uTexture;
void main () { gl_FragColor = texture2D(uTexture, vUv); }`;

  const scaleFS = FS + `
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uValue;
void main () { gl_FragColor = uValue * texture2D(uTexture, vUv); }`;

  // Capsule-shaped gaussian along the cursor segment A->B: one pass per
  // stroke, so the trail is continuous no matter how fast the cursor moves.
  const splatFS = FS + `
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uA;
uniform vec2 uB;
uniform vec3 uColor;
uniform float uRadius;
void main () {
  vec2 pa = vUv - uA;
  vec2 ba = uB - uA;
  pa.x *= uAspect;
  ba.x *= uAspect;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  vec2 d = pa - ba * h;
  vec3 s = exp(-dot(d, d) / uRadius) * uColor;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0);
}`;

  const advectionFS = FS + `
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uVelTexel;
uniform vec2 uSrcTexel;
uniform float uDt;
uniform float uDecay;
uniform float uFade;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main () {
#ifdef MANUAL_FILTERING
  vec2 coord = vUv - uDt * bilerp(uVelocity, vUv, uVelTexel).xy * uVelTexel;
  vec4 r = bilerp(uSource, coord, uSrcTexel);
#else
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uVelTexel;
  vec4 r = texture2D(uSource, coord);
#endif
  r *= uDecay;
  r = sign(r) * max(abs(r) - uFade, 0.0); // settle to exactly zero
  gl_FragColor = r;
}`;

  const divergenceFS = FS + `
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

  const curlFS = FS + `
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

  const vorticityFS = FS + `
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main () {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * uDt;
  gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

  const pressureFS = FS + `
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

  const gradientSubtractFS = FS + `
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

  // Bloom: soft-knee threshold on the *tone-mapped* grey value.
  const bloomPrefilterFS = FS + `
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uGain;
uniform float uThreshold;
uniform float uKnee;
void main () {
  float a = 1.0 - exp(-max(texture2D(uTexture, vUv).r, 0.0) * uGain);
  float soft = clamp(a - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  gl_FragColor = vec4(max(soft, a - uThreshold), 0.0, 0.0, 1.0);
}`;

  // 9-tap gaussian using linear-sampling offsets.
  const blurFS = FS + `
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uDirection;
void main () {
  vec2 o1 = 1.3846153846 * uDirection;
  vec2 o2 = 3.2307692308 * uDirection;
  float s = texture2D(uTexture, vUv).r * 0.2270270270;
  s += (texture2D(uTexture, vUv + o1).r + texture2D(uTexture, vUv - o1).r) * 0.3162162162;
  s += (texture2D(uTexture, vUv + o2).r + texture2D(uTexture, vUv - o2).r) * 0.0702702703;
  gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
}`;

  // Final composite: density -> single grey ramp, bloom, vignette, dither.
  const displayFS = FS + `
varying vec2 vUv;
uniform sampler2D uDye;
uniform sampler2D uBloom;
uniform float uBg;
uniform float uInk;
uniform float uGain;
uniform float uBloomIntensity;
uniform float uVignette;

float hash (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main () {
  float d = max(texture2D(uDye, vUv).r, 0.0);
  float a = 1.0 - exp(-d * uGain);
  a += texture2D(uBloom, vUv).r * uBloomIntensity;
  a = clamp(a, 0.0, 1.0);

  float c = mix(uBg, uInk, a);

  float vig = smoothstep(0.35, 1.45, length((vUv - 0.5) * 2.0));
  c *= 1.0 - uVignette * vig;

  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // kill banding
  gl_FragColor = vec4(c, c, c, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[fluid]', gl.getShaderInfoLog(s));
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, baseVS);

  function program(fsSrc, defines = '') {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, defines + fsSrc));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.warn('[fluid]', gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { u, bind: () => gl.useProgram(p) };
  }

  const prog = {
    copy:       program(copyFS),
    scale:      program(scaleFS),
    splat:      program(splatFS),
    advection:  program(advectionFS, supportLinear ? '' : '#define MANUAL_FILTERING\n'),
    divergence: program(divergenceFS),
    curl:       program(curlFS),
    vorticity:  program(vorticityFS),
    pressure:   program(pressureFS),
    gradient:   program(gradientSubtractFS),
    prefilter:  program(bloomPrefilterFS),
    blur:       program(blurFS),
    display:    program(displayFS),
  };

  /* ======================================================================
   * Geometry + framebuffers
   * ==================================================================== */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(w, h, fmt, filter) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, halfFloatType, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  function disposeFBO(f) {
    if (!f) return;
    gl.deleteFramebuffer(f.fbo);
    gl.deleteTexture(f.texture);
  }

  function createDoubleFBO(w, h, fmt, filter) {
    let a = createFBO(w, h, fmt, filter);
    let b = createFBO(w, h, fmt, filter);
    return {
      width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
      get read() { return a; }, set read(v) { a = v; },
      get write() { return b; }, set write(v) { b = v; },
      swap() { const t = a; a = b; b = t; },
    };
  }

  function disposeDouble(d) {
    if (!d) return;
    disposeFBO(d.read);
    disposeFBO(d.write);
  }

  // Resize while preserving current contents (smoke survives window resizes).
  function resizeDoubleFBO(d, w, h, fmt, filter) {
    if (d.width === w && d.height === h) return d;
    const next = createFBO(w, h, fmt, filter);
    prog.copy.bind();
    gl.uniform1i(prog.copy.u.uTexture, d.read.attach(0));
    blit(next);
    disposeFBO(d.read);
    disposeFBO(d.write);
    d.read = next;
    d.write = createFBO(w, h, fmt, filter);
    d.width = w; d.height = h;
    d.texelSizeX = 1 / w; d.texelSizeY = 1 / h;
    return d;
  }

  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  function getResolution(res) {
    let ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (ar < 1) ar = 1 / ar;
    const min = Math.round(res);
    const max = Math.min(Math.round(res * ar), maxTex);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max };
  }

  let dye, velocity, divergence, curl, pressure, bloomA, bloomB;

  function initFramebuffers() {
    const sim = getResolution(CONFIG.simResolution);
    const dyeR = getResolution(Math.min(CONFIG.dyeResolution, maxTex));
    const bl = getResolution(CONFIG.bloomResolution);
    const lin = supportLinear ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    dye = dye ? resizeDoubleFBO(dye, dyeR.w, dyeR.h, fmtR, lin) : createDoubleFBO(dyeR.w, dyeR.h, fmtR, lin);
    velocity = velocity ? resizeDoubleFBO(velocity, sim.w, sim.h, fmtRG, lin) : createDoubleFBO(sim.w, sim.h, fmtRG, lin);

    disposeFBO(divergence); disposeFBO(curl); disposeDouble(pressure);
    divergence = createFBO(sim.w, sim.h, fmtR, gl.NEAREST);
    curl = createFBO(sim.w, sim.h, fmtR, gl.NEAREST);
    pressure = createDoubleFBO(sim.w, sim.h, fmtR, gl.NEAREST);

    disposeFBO(bloomA); disposeFBO(bloomB);
    bloomA = createFBO(bl.w, bl.h, fmtR, lin);
    bloomB = createFBO(bl.w, bl.h, fmtR, lin);
  }

  function clearTarget(f) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
    gl.viewport(0, 0, f.width, f.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);
    const w = Math.max(1, Math.floor((canvas.clientWidth || innerWidth) * dpr));
    const h = Math.max(1, Math.floor((canvas.clientHeight || innerHeight) * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    return true;
  }

  /* ======================================================================
   * Input — cursor / touch only, listeners on window
   * ==================================================================== */
  const pointers = new Map(); // id -> last position
  const strokes = [];         // queued segments, consumed each frame

  function viewport() {
    return { w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight };
  }

  function pointerMove(id, cx, cy) {
    const now = performance.now();
    const prev = pointers.get(id);
    if (!prev) { pointers.set(id, { cx, cy, t: now }); return; }

    const dxPx = cx - prev.cx;
    const dyPx = cy - prev.cy;
    const len = Math.hypot(dxPx, dyPx);
    if (len < 1) return; // accumulate micro-jitter until it means something

    const dtMs = Math.min(100, Math.max(4, now - prev.t));
    pointers.set(id, { cx, cy, t: now });
    strokes.push({ ax: prev.cx, ay: prev.cy, bx: cx, by: cy, dxPx, dyPx, len, dtMs });
    wake();
  }

  window.addEventListener('mousemove', (e) => pointerMove('mouse', e.clientX, e.clientY), { passive: true });
  window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointers.delete('mouse'); }, { passive: true });
  window.addEventListener('blur', () => pointers.clear());

  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) pointers.set(t.identifier, { cx: t.clientX, cy: t.clientY, t: performance.now() });
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) pointerMove(t.identifier, t.clientX, t.clientY);
  }, { passive: true });
  const touchEnd = (e) => { for (const t of e.changedTouches) pointers.delete(t.identifier); };
  window.addEventListener('touchend', touchEnd, { passive: true });
  window.addEventListener('touchcancel', touchEnd, { passive: true });

  function applyStrokes() {
    if (!strokes.length) return;
    const { w, h } = viewport();
    const minSide = Math.min(w, h);
    const aspect = canvas.width / canvas.height;

    prog.splat.bind();
    gl.uniform1f(prog.splat.u.uAspect, aspect);

    for (const s of strokes) {
      const rawSpeed = s.len / s.dtMs;                       // px/ms
      const speed = Math.min(rawSpeed, CONFIG.maxCursorSpeed);
      const k = speed / rawSpeed;
      const sf = Math.min(1, Math.max(0.2, speed / CONFIG.fullSpeed)); // 0.2 gentle … 1 fast

      const radiusPx = CONFIG.splatRadius * minSide * (0.7 + 0.55 * sf);
      // Short, slow segments overlap heavily; scale so injection per
      // distance travelled is independent of the event rate.
      const coverage = Math.min(1, s.len / radiusPx);
      const rH = radiusPx / h; // radius in height-normalised uv units

      // Cursor velocity -> sim texels / second.
      const vx = (s.dxPx * k / s.dtMs) * 1000 / w * velocity.width;
      const vy = -(s.dyPx * k / s.dtMs) * 1000 / h * velocity.height;
      const f = CONFIG.splatForce * coverage;

      gl.uniform2f(prog.splat.u.uA, s.ax / w, 1 - s.ay / h);
      gl.uniform2f(prog.splat.u.uB, s.bx / w, 1 - s.by / h);

      // Velocity
      gl.uniform1i(prog.splat.u.uTarget, velocity.read.attach(0));
      gl.uniform3f(prog.splat.u.uColor, vx * f, vy * f, 0);
      gl.uniform1f(prog.splat.u.uRadius, rH * rH);
      blit(velocity.write);
      velocity.swap();

      // Dye — one scalar, written equally to every channel.
      const amt = CONFIG.dyeAmount * sf * coverage;
      const rD = rH * 0.75;
      gl.uniform1i(prog.splat.u.uTarget, dye.read.attach(0));
      gl.uniform3f(prog.splat.u.uColor, amt, amt, amt);
      gl.uniform1f(prog.splat.u.uRadius, rD * rD);
      blit(dye.write);
      dye.swap();
    }
    strokes.length = 0;
  }

  /* ======================================================================
   * Simulation step
   * ==================================================================== */
  function step(dt) {
    gl.disable(gl.BLEND);
    const tx = velocity.texelSizeX, ty = velocity.texelSizeY;

    let p = prog.curl; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
    blit(curl);

    p = prog.vorticity; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.u.uCurl, curl.attach(1));
    gl.uniform1f(p.u.uCurlStrength, CONFIG.curl);
    gl.uniform1f(p.u.uDt, dt);
    blit(velocity.write);
    velocity.swap();

    p = prog.divergence; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    p = prog.scale; p.bind();
    gl.uniform1i(p.u.uTexture, pressure.read.attach(0));
    gl.uniform1f(p.u.uValue, CONFIG.pressure);
    blit(pressure.write);
    pressure.swap();

    p = prog.pressure; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform1i(p.u.uDivergence, divergence.attach(0));
    for (let i = 0; i < CONFIG.pressureIterations; i++) {
      gl.uniform1i(p.u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    p = prog.gradient; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform1i(p.u.uPressure, pressure.read.attach(0));
    gl.uniform1i(p.u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    const frames = dt * 60;
    p = prog.advection; p.bind();
    gl.uniform2f(p.u.texelSize, tx, ty);
    gl.uniform2f(p.u.uVelTexel, tx, ty);
    gl.uniform1f(p.u.uDt, dt);

    // Velocity self-advection
    const vId = velocity.read.attach(0);
    gl.uniform1i(p.u.uVelocity, vId);
    gl.uniform1i(p.u.uSource, vId);
    gl.uniform2f(p.u.uSrcTexel, tx, ty);
    gl.uniform1f(p.u.uDecay, Math.pow(CONFIG.velocityDissipation, frames));
    gl.uniform1f(p.u.uFade, 0.01 * frames);
    blit(velocity.write);
    velocity.swap();

    // Dye advection
    gl.uniform1i(p.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(p.u.uSource, dye.read.attach(1));
    gl.uniform2f(p.u.uSrcTexel, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1f(p.u.uDecay, Math.pow(CONFIG.dissipation, frames));
    gl.uniform1f(p.u.uFade, 0.0006 * frames);
    blit(dye.write);
    dye.swap();
  }

  function applyBloom() {
    let p = prog.prefilter; p.bind();
    gl.uniform1i(p.u.uTexture, dye.read.attach(0));
    gl.uniform1f(p.u.uGain, CONFIG.densityGain);
    gl.uniform1f(p.u.uThreshold, CONFIG.bloomThreshold);
    gl.uniform1f(p.u.uKnee, CONFIG.bloomKnee);
    blit(bloomA);

    p = prog.blur; p.bind();
    for (let i = 0; i < CONFIG.bloomIterations; i++) {
      const spread = i + 1;
      gl.uniform1i(p.u.uTexture, bloomA.attach(0));
      gl.uniform2f(p.u.uDirection, spread / bloomA.width, 0);
      blit(bloomB);
      gl.uniform1i(p.u.uTexture, bloomB.attach(0));
      gl.uniform2f(p.u.uDirection, 0, spread / bloomB.height);
      blit(bloomA);
    }
  }

  function render() {
    if (CONFIG.bloom) applyBloom();
    const pal = palette();
    const p = prog.display; p.bind();
    gl.uniform1i(p.u.uDye, dye.read.attach(0));
    gl.uniform1i(p.u.uBloom, bloomA.attach(1));
    gl.uniform1f(p.u.uBg, pal.bg);
    gl.uniform1f(p.u.uInk, pal.ink);
    gl.uniform1f(p.u.uGain, CONFIG.densityGain);
    gl.uniform1f(p.u.uBloomIntensity, CONFIG.bloom ? CONFIG.bloomIntensity : 0);
    gl.uniform1f(p.u.uVignette, CONFIG.vignette);
    blit(null);
  }

  /* ======================================================================
   * Loop — runs only while there is something to animate
   * ==================================================================== */
  let rafId = 0;
  let lastTime = 0;
  let lastInput = -Infinity;
  let lost = false;

  function frame(now) {
    rafId = 0;
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 60);
    lastTime = now;

    if (resizeCanvas()) initFramebuffers();
    applyStrokes();

    const active = now - lastInput < CONFIG.idleSleepMs;
    if (active) {
      step(dt);
    } else {
      // Fully settled: zero the fields so the next stroke starts clean.
      clearTarget(dye.read); clearTarget(velocity.read); clearTarget(pressure.read);
    }
    render();

    if (active) rafId = requestAnimationFrame(frame);
  }

  function kick() {
    if (rafId || lost || document.hidden) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function wake() {
    lastInput = performance.now();
    kick();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      kick();
    }
  });

  window.addEventListener('resize', kick, { passive: true });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  });

  /* ======================================================================
   * Boot
   * ==================================================================== */
  function mount() {
    document.body.prepend(canvas);
    resizeCanvas();
    initFramebuffers();
    render(); // one idle frame: plain background
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  window.FluidBackground = {
    config: CONFIG,
    setMode(mode) {
      if (!PALETTES[mode]) return;
      CONFIG.mode = mode;
      canvas.style.background = PALETTES[mode].css;
      kick();
    },
  };
})();
