// Paper stage: draws the cut-paper world on a canvas and animates it like stop-motion.
// Everything positional comes from layers.js (built from world/scene.json); this file only knows how
// pieces move, how paper sprites look, and how the loop is paced.
const TAU = Math.PI * 2, L = 12;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seeds = (() => { const R = rng(2024); return Array.from({ length: 512 }, () => R()); })();
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const cyc = (t, period, offset) => { const v = t / period + offset; return v - Math.floor(v); };
const osc = (t, k, off = 0) => Math.sin((TAU * k * t) / L + off);
const pick = (v, i) => (Array.isArray(v) ? v[i % v.length] : v);
const deg = (d) => (d * Math.PI) / 180;
// paper appears and disappears with a pop, never a fade
const popIn = (f) => (f < 0.05 ? 0.45 : f < 0.1 ? 0.85 : f > 0.94 ? 0.4 : f > 0.88 ? 0.8 : 1);
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });

// ---------- paper sprites ----------
const P = {
  poly: (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; },
  ell: (x, y, rx, ry, r = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, r, 0, TAU); return p; },
  rect: (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; },
  arc: (x, y, r, a0, a1) => { const p = new Path2D(); p.moveTo(x, y); p.arc(x, y, r, a0, a1); p.closePath(); return p; },
  d: (s) => new Path2D(s),
};
function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), R = rng(5);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = R() < 0.55 ? `rgba(255,255,255,${0.08 + R() * 0.16})` : `rgba(70,50,30,${0.04 + R() * 0.09})`;
    g.fillRect(R() * 128, R() * 128, 1 + R() * 1.6, 0.6 + R() * 0.9);
  }
  return c;
}
function buildSprites(paperStyle) {
  const grain = makeGrain();
  // flat facets + a whisper of fibre grain + a soft cut edge + a satin sheen
  function paper(w, h, facets, after) {
    const S = 4, pad = 3, c = document.createElement('canvas');
    c.width = Math.ceil((w + 2 * pad) * S); c.height = Math.ceil((h + 2 * pad) * S);
    const g = c.getContext('2d');
    g.setTransform(S, 0, 0, S, (w / 2 + pad) * S, (h / 2 + pad) * S);
    for (const [p, col] of facets) { g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.3; g.fill(p); g.stroke(p); }
    g.strokeStyle = 'rgba(40,28,16,0.1)'; g.lineWidth = 0.3;
    for (const [p, , crease] of facets) if (crease !== false) g.stroke(p);
    if (after) after(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    if (paperStyle.grain > 0) { g.globalAlpha = paperStyle.grain; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; }
    if (paperStyle.gloss > 0) {
      const sheen = g.createLinearGradient(0, 0, c.width * 0.8, c.height);
      sheen.addColorStop(0, `rgba(255,255,255,${0.42 * paperStyle.gloss})`);
      sheen.addColorStop(0.22, `rgba(255,255,255,${0.16 * paperStyle.gloss})`);
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, `rgba(20,30,40,${0.08 * paperStyle.gloss})`);
      g.fillStyle = sheen; g.fillRect(0, 0, c.width, c.height);
    }
    if (paperStyle.rim > 0) {
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const tg = t.getContext('2d'), o = 3;
      for (const [dx, col] of [[o, `rgba(255,255,255,${0.8 * paperStyle.rim})`], [-o, `rgba(40,28,16,${0.28 * paperStyle.rim})`]]) {
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, t.width, t.height);
        tg.drawImage(c, 0, 0);
        tg.globalCompositeOperation = 'destination-out'; tg.drawImage(c, dx, dx);
        tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height);
        g.drawImage(t, 0, 0);
      }
    }
    return { c, w: c.width / S, h: c.height / S };
  }
  const SP = {};
  SP.note1 = paper(20, 30, [[P.ell(-3, 8, 5.4, 3.9, -0.45), '#3a291c'], [P.rect(0.6, -13, 2.2, 21), '#3a291c', false], [P.d('M2.8,-13 Q11,-8 8.5,1 Q8.8,-5.5 2.8,-7 Z'), '#51392a']]);
  SP.note2 = paper(30, 32, [
    [P.ell(-9, 9, 5.2, 3.8, -0.45), '#3a291c'], [P.ell(7, 6, 5.2, 3.8, -0.45), '#3a291c'],
    [P.rect(-6, -11, 2.1, 20), '#3a291c', false], [P.rect(10, -14, 2.1, 20), '#3a291c', false],
    [P.poly([[-6, -11], [12.1, -14], [12.1, -9.4], [-6, -6.6]]), '#51392a'],
  ]);
  const star = (r, c1, c2) => {
    const f = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5, b = a + TAU / 10, pa = a - TAU / 10, tip = [Math.cos(a) * r, Math.sin(a) * r];
      f.push([P.poly([[0, 0], [Math.cos(pa) * r * 0.42, Math.sin(pa) * r * 0.42], tip]), c1]);
      f.push([P.poly([[0, 0], tip, [Math.cos(b) * r * 0.42, Math.sin(b) * r * 0.42]]), c2]);
    }
    return paper(r * 2, r * 2, f);
  };
  SP.star = star(9, '#ffdf73', '#eab443');
  SP.starW = star(7, '#ffffff', '#dfe8ee');
  SP.twinkle = paper(10, 10, [[P.poly([[0, -5], [1.3, -1.3], [5, 0], [1.3, 1.3], [0, 5], [-1.3, 1.3], [-5, 0], [-1.3, -1.3]]), '#fff6d8']]);
  SP.heart = paper(20, 18, [[P.d('M0,8 C-11,0 -8,-10 0,-4 Z'), '#f68eaa'], [P.d('M0,8 C11,0 8,-10 0,-4 Z'), '#de5f80']]);
  const leaf = (c1, c2) => paper(26, 14, [[P.d('M-11,0 Q0,-8 11,0 Z'), c1], [P.d('M-11,0 Q0,8 11,0 Z'), c2], [P.rect(-14, -0.6, 4, 1.2), c2, false]]);
  SP.leaves = [leaf('#9cc75a', '#78a73d'), leaf('#5f9d8b', '#43796a'), leaf('#c0da6a', '#98b949')];
  SP.drop = paper(12, 18, [[P.d('M0,-9 Q-6,-1 -5,3 Q-4,8 0,8 Z'), '#a9ddf7'], [P.d('M0,-9 Q6,-1 5,3 Q4,8 0,8 Z'), '#69b9e8']]);
  // origami clouds that drift through the open sky
  SP.skyClouds = [
    paper(112, 44, [
      [P.d('M-56,20 L-42,4 L-24,8 L-12,-12 L10,-20 L28,-6 L44,-1 L56,20 Z'), '#f4f8fd'],
      [P.poly([[-42, 4], [-24, 8], [-30, 20]]), '#ffffff'], [P.poly([[-24, 8], [-12, -12], [-4, 12]]), '#ffffff'],
      [P.poly([[-12, -12], [10, -20], [6, 8]]), '#fbfdff'], [P.poly([[10, -20], [28, -6], [6, 8]]), '#e2ebf6'],
      [P.poly([[28, -6], [44, -1], [34, 14]]), '#e6eef8'], [P.poly([[-56, 20], [56, 20], [40, 12], [-44, 13]]), '#d2dfef'],
    ]),
    paper(78, 34, [
      [P.d('M-39,15 L-28,0 L-12,3 L0,-15 L18,-8 L30,2 L39,15 Z'), '#f5f9fe'],
      [P.poly([[-28, 0], [-12, 3], [-18, 15]]), '#ffffff'], [P.poly([[-12, 3], [0, -15], [4, 10]]), '#ffffff'],
      [P.poly([[0, -15], [18, -8], [4, 10]]), '#e4edf7'], [P.poly([[18, -8], [30, 2], [20, 12]]), '#e9f0f9'],
      [P.poly([[-39, 15], [39, 15], [26, 9], [-30, 10]]), '#d4e0ef'],
    ]),
    paper(140, 50, [
      [P.d('M-70,22 L-56,6 L-38,8 L-26,-10 L-6,-16 L6,-24 L26,-12 L42,-8 L56,4 L70,22 Z'), '#f3f8fd'],
      [P.poly([[-56, 6], [-38, 8], [-44, 22]]), '#ffffff'], [P.poly([[-38, 8], [-26, -10], [-18, 14]]), '#ffffff'],
      [P.poly([[-26, -10], [-6, -16], [-12, 10]]), '#fbfdff'], [P.poly([[-6, -16], [6, -24], [10, 6]]), '#ffffff'],
      [P.poly([[6, -24], [26, -12], [10, 6]]), '#e1eaf5'], [P.poly([[42, -8], [56, 4], [44, 16]]), '#e6eef8'],
      [P.poly([[-70, 22], [70, 22], [54, 13], [-58, 14]]), '#d0ddee'],
    ]),
  ];
  // water glints: thin paper slivers lying flat on the river
  SP.glints = [
    paper(24, 5, [[P.d('M-12,0.6 Q-3,-2.6 12,-0.4 Q2,1.5 -12,0.6 Z'), '#ffffff']]),
    paper(26, 5, [[P.d('M-13,0.6 Q-7,-2.4 -1,-0.6 Q5,-2.6 13,0 Q3,1.4 -13,0.6 Z'), '#f4fbff']]),
    paper(15, 4, [[P.d('M-7.5,0.3 Q0,-2.2 7.5,0 Q0,1.3 -7.5,0.3 Z'), '#dff3ff']]),
    paper(20, 5, [[P.d('M-10,0.5 Q-2,-2.3 10,-0.2 Q1,1.3 -10,0.5 Z'), '#e9f7ff'], [P.d('M-4,-0.9 Q2,-1.9 8,-0.5 Q2,-0.4 -4,-0.9 Z'), '#ffffff', false]]),
  ];
  SP.foam = paper(9, 8, [[P.poly([[-4.5, 3.5], [0, -4], [0, 3.5]]), '#ffffff'], [P.poly([[0, 3.5], [0, -4], [4.5, 3.5]]), '#d9e9f4']]);
  const PAINT = [['#e8594d', '#c9433a'], ['#f4c34f', '#dea532'], ['#4b91da', '#3677bf'], ['#6cbc5b', '#4f9b43'], ['#b36bd2', '#9151b1'], ['#f38e3c', '#d7712a']];
  SP.confetti = PAINT.map(([a, b], i) => (i % 2
    ? paper(10, 10, [[P.arc(0, 0, 4.2, deg(-135), deg(45)), a], [P.arc(0, 0, 4.2, deg(45), deg(225)), b]])
    : paper(11, 10, [[P.poly([[-5, 4], [0, -5], [0, 4]]), a], [P.poly([[0, 4], [0, -5], [5, 4]]), b]])));
  const INK = ['#2f7fc0', '#3a8f52', '#7552b8', '#c46a24'];
  SP.tags = ['</>', '{ }', '01', '=>'].map((txt, i) => paper(36, 18, [
    [P.poly([[-17, -8], [11, -8], [17, 0], [-17, 0]]), '#fbf5e4'], [P.poly([[-17, 0], [17, 0], [11, 8], [-17, 8]]), '#efe5cb'],
  ], (g) => {
    g.fillStyle = INK[i]; g.font = '700 10.5px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, -3, 0.5);
    g.globalCompositeOperation = 'destination-out'; g.fill(P.ell(12, 0, 1.6, 1.6)); g.globalCompositeOperation = 'source-over';
  }));
  const wings = (k, c1, c2) => {
    const f = [];
    for (const m of [-1, 1]) {
      f.push([P.poly([[0, -1], [10 * k * m, -9], [6 * k * m, -4]]), m > 0 ? c1 : c2]);
      f.push([P.poly([[0, -1], [6 * k * m, -4], [12 * k * m, -2], [1 * m, 1]]), m > 0 ? c2 : c1]);
      f.push([P.poly([[0, 0.5], [9 * k * m, 2.5], [5 * k * m, 8]]), m > 0 ? c1 : c2]);
    }
    f.push([P.rect(-0.9, -5, 1.8, 11), '#3a2c22', false]);
    f.push([P.poly([[-0.4, -5], [-3, -9], [-2.4, -9.4], [0.4, -5]]), '#3a2c22', false]);
    f.push([P.poly([[0.4, -5], [3, -9], [2.4, -9.4], [-0.4, -5]]), '#3a2c22', false]);
    return paper(28, 20, f);
  };
  SP.butterflies = [['#f8d858', '#e6b03a'], ['#f7abc4', '#df789b'], ['#c3e5ff', '#7fb6e4'], ['#ffffff', '#dfe6ea']].map(([a, b]) => [1, 0.6, 0.22].map((k) => wings(k, a, b)));
  SP.birds = [1, 0.25, -0.7].map((w) => paper(44, 40, [
    [P.poly([[-3, -1.5], [5, -1.5], [-1, -1.5 - 14 * w]]), '#d6d2c8'],
    [P.poly([[-13, 0], [0, -3.6], [13, -1.5]]), '#fbf8f1'], [P.poly([[-13, 0], [13, -1.5], [0, 3.6]]), '#e2ddd1'],
    [P.poly([[10, -1.5], [18, -6.5], [19.5, -5], [13, 1]]), '#f2eee5'],
    [P.poly([[-12, 0], [-20, -6], [-17, 1.5]]), '#ebe6da'],
    [P.poly([[-6, 0], [0, -17 * w], [0, 0]]), '#ffffff'], [P.poly([[0, 0], [0, -17 * w], [6, 0]]), '#e9e4d9'],
  ]));
  SP.fish = paper(30, 12, [
    [P.poly([[-9, 0], [0, -5], [9, 0]]), '#f5a65f'], [P.poly([[-9, 0], [9, 0], [0, 5]]), '#e07835'],
    [P.poly([[-8, 0], [-15, -5], [-14, 0]]), '#f7c585'], [P.poly([[-8, 0], [-14, 0], [-15, 5]]), '#eaa45e'],
    [P.ell(5, -1, 1.1, 1.1), '#2b2622', false],
  ]);
  return SP;
}
function sprite(g, sp, x, y, rot = 0, s = 1) {
  if (s <= 0) return;
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (s !== 1) g.scale(s, s);
  g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  g.restore();
}
function makeTile(w, h, n, seed, draw, a = 1) {
  const k = 2, c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g = c.getContext('2d'), R = rng(seed);
  g.scale(k, k);
  for (let i = 0; i < n; i++) {
    const r = R();
    g.fillStyle = r < 0.5 ? `rgba(255,255,255,${0.6 * a})` : r < 0.85 ? `rgba(210,239,255,${0.62 * a})` : `rgba(62,132,200,${0.24 * a})`;
    const shape = draw(R);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      g.beginPath(); shape.forEach(([x, y], j) => (j ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.closePath(); g.fill();
    }
  }
  return c;
}
// Falling water: bright paper streaks with rounded ends, a few deeper blue ones for depth.
function makeStreaks(w, h, n, seed) {
  const k = 2, c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g = c.getContext('2d'), R = rng(seed);
  g.scale(k, k); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const r = R(), x = R() * w, y = R() * h, l = 16 + R() * 44;
    g.lineWidth = 1.6 + R() * 2.8;
    g.strokeStyle = r < 0.55 ? 'rgba(255,255,255,0.82)' : r < 0.85 ? 'rgba(214,240,255,0.8)' : 'rgba(58,128,200,0.32)';
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox, y + oy + l); g.stroke(); }
  }
  return c;
}
function decodeHitmap(h) {
  const cells = new Uint16Array(h.w * h.h);
  let at = 0;
  for (let i = 0; i < h.rle.length; i += 2) { cells.fill(h.rle[i], at, at + h.rle[i + 1]); at += h.rle[i + 1]; }
  return { ...h, cells };
}

export function createPaperStage({ data, dir, sfx = () => {}, reduceMotion = false }) {
  const [W, H] = data.size;
  const LS = data.scale || 1;
  const STYLE = data.style || {};
  const FPS = STYLE.fps || 12, AFPS = STYLE.actionFps || 24, FRAMES = L * FPS, WFPS = STYLE.waterFps || AFPS;
  const PAPER = { grain: 0.3, rim: 0.45, gloss: 0.55, ...(STYLE.paper || {}) };
  const SHADOW = { sprites: 0.22, pieces: 0.26, clouds: 0.15, ...(STYLE.shadow || {}) };
  const MOTIONS = data.motions || {};
  const PIECES = data.pieces.map((p, i) => ({ ...p, i }));
  const kindCount = {};
  PIECES.forEach((p) => { p.ki = kindCount[p.kind] = (kindCount[p.kind] ?? -1) + 1; });
  const byId = Object.fromEntries(PIECES.map((p) => [p.id, p]));
  const CLOUDS = data.clouds.map((c) => ({ ...c, amp: c.amp ?? 12, ph: c.phase || 0, mode: c.track || 'both' }));
  const WATER = data.water.filter((w) => w.box[2] > 0);
  const SPOTS = Object.fromEntries((data.spots || []).map((s) => [s.id, s]));
  const EMITTERS = data.emitters || [];
  const HIT = decodeHitmap(data.hitmap);
  const COMPANION = data.companion || null;
  const STILL_CLOUDS = new Set(data.staticClouds || []); // variants whose clouds stay painted in the base

  const img = { day: {}, night: {} };
  const shared = {};
  const loaded = {};
  let SP = null, tiles = null;
  const complete = {}; // variants whose every layer has arrived (the base alone can land first on a slow network)
  const react = {}, kicks = {};
  const bursts = [];
  let introT0 = -1e9, hover = null, hoverAmt = {};

  // ---------- loading ----------
  async function loadVariant(v) {
    if (loaded[v]) return loaded[v];
    const d = `${dir}${v}/`, jobs = [];
    const put = (key, src) => jobs.push(loadImage(src).then((i) => { img[v][key] = i; }));
    put('base', d + data.base);
    if (!STILL_CLOUDS.has(v)) {
      put('front', d + data.front);
      CLOUDS.forEach((c) => { put(c.id, d + c.file); if (c.behind) put(c.id + '-behind', d + c.behind.file); });
    }
    PIECES.forEach((p) => put(p.id, d + p.file));
    loaded[v] = Promise.all(jobs).then(() => { complete[v] = true; if (v === variant) render(); }).catch((e) => { delete loaded[v]; throw e; });
    return loaded[v];
  }
  async function loadShared() {
    const jobs = [];
    if (CLOUDS.length) jobs.push(loadImage(dir + data.cloudOccluders).then((i) => { shared.occ = i; }));
    if (data.sky) jobs.push(loadImage(dir + data.sky).then((i) => { shared.sky = i; }).catch(() => {}));
    WATER.forEach((w) => jobs.push(loadImage(dir + w.file).then((i) => { w.mask = i; })));
    if (COMPANION) jobs.push(loadImage(new URL(COMPANION.image, new URL(dir, location.href)).href).then((i) => { shared.claw = i; }).catch(() => {}));
    await Promise.all(jobs);
    SP = buildSprites(PAPER);
    const ctx = document.createElement('canvas').getContext('2d');
    tiles = {
      falls: makeStreaks(60, 120, 20, 3),
      // river chips: short, wide and sparse, so the water reads as sliding paper rather than rain
      river: makeTile(120, 64, 13, 8, (R) => { const x = R() * 120, y = R() * 64, l = 9 + R() * 16, t = 3 + R() * 2.5; return [[x, y], [x + l, y], [x + l + t, y + t], [x + t, y + t]]; }, 0.75),
    };
    WATER.forEach((w) => { if (w.type === 'glints') prepareGlints(w); else if (w.sheets) prepareSheets(w); else w.pattern = ctx.createPattern(tiles[w.tile === 'falls' ? 'falls' : 'river'], 'repeat'); });
  }
  const ready = Promise.all([loadShared(), loadVariant('day')]);

  // ---------- timing ----------
  const stepA = (ms) => Math.floor((ms / 1000) * AFPS) / AFPS; // reactions move on ones (24 fps)
  const introDelay = {};
  {
    const all = [...CLOUDS.map((c) => [c.id, c.x + c.w / 2]), ...PIECES.filter((p) => !p.parent).map((p) => [p.id, p.pivot[0]])];
    all.sort((a, b) => a[1] - b[1]).forEach(([id], i) => { introDelay[id] = (i / all.length) * 1.2; });
  }
  function introWobble(id, now) {
    if (!(id in introDelay)) return 0;
    const t = stepA(now - introT0) - introDelay[id];
    return t >= 0 && t < 1.1 ? Math.exp(-t * 3.6) * Math.sin(t * 17) : 0;
  }

  // ---------- motion vocabulary (scene.json → motions) ----------
  function idleMotion(p, tq, o) {
    for (const m of MOTIONS[p.kind]?.idle || []) {
      const cycles = pick(m.cycles ?? 1, p.ki);
      const s = Math.sin((TAU * cycles * tq) / L + (m.phase || 0) + (m.wave || 0) * p.pivot[0] + (m.spread || 0) * p.ki);
      switch (m.type) {
        case 'rock': o.rot += pick(m.deg ?? 0, p.ki) * s; break;
        case 'bob': o.dy -= Math.round((m.px ?? 2) * (0.5 + 0.5 * s)); break;
        case 'tilt': o.rot += (m.from ?? 0) + ((m.to ?? 0) - (m.from ?? 0)) * (0.5 + 0.5 * s); break;
        case 'breathe': o.sy *= 1 + (m.amount ?? 0.02) * s; o.sx *= 1 - (m.amount ?? 0.02) * 0.6 * s; break;
      }
    }
  }
  // gummy-candy bounce: crouch, stretch on take-off, splat on landing, then a damped wobble
  function jelly(m, t, o) {
    const a = m.anticipate ?? 0.1, air = m.air ?? 0.3, sq = m.squash ?? 0.15, hz = m.hz ?? 4, d = m.decay ?? 3;
    let s = 0;
    if (t < a) s = -sq * Math.sin((Math.PI / 2) * (t / a));
    else if (t < a + air) { const u = (t - a) / air; o.dy -= (m.px ?? 12) * Math.sin(Math.PI * u); s = sq * 0.75 * Math.cos(Math.PI * u) ** 2 * (u < 0.5 ? 1 : 0.6); }
    else { const u = t - a - air; if (u < 5 / d) s = -sq * Math.exp(-d * u) * Math.cos(TAU * hz * u); }
    o.sy *= 1 + s; o.sx *= 1 - s * 0.7;
  }
  function applyPoke(list, t, o) {
    for (const m of list || []) {
      const u = t - (m.delay || 0);
      if (u < 0) continue;
      switch (m.type) {
        case 'swing': { const d = m.decay ?? 3; if (u < 6 / d) o.rot += (m.deg ?? 8) * Math.exp(-d * u) * Math.sin(TAU * (m.hz ?? 2) * u); break; }
        case 'hop': { const time = m.time ?? 0.35, k = Math.floor(u / time); if (k < (m.count ?? 1)) o.dy -= (m.px ?? 10) * Math.pow(m.falloff ?? 0.6, k) * Math.sin((Math.PI * (u - k * time)) / time); break; }
        case 'tilt': { const time = m.time ?? 1; if (u < time) o.rot += (m.deg ?? 10) * Math.sin((Math.PI * u) / time); break; }
        case 'jelly': jelly(m, u, o); break;
      }
    }
  }
  function pokeTime(p, now) {
    const t0 = Math.max(p.spot ? react[p.spot] ?? -1e9 : -1e9, kicks[p.id] ?? -1e9);
    if (t0 < -1e8) return null;
    const t = stepA(now - t0);
    return t >= 0 && t < 6 ? t : null;
  }
  function pieceMatrix(p, tq, now, live, parentM, info) {
    const o = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 };
    idleMotion(p, tq, o);
    const M = MOTIONS[p.kind] || {};
    if (live) {
      const t = pokeTime(p, now);
      if (t !== null) applyPoke(M.poke, t, o);
      if (!p.parent) o.rot += (M.intro || 0) * introWobble(p.id, now);
      if (!p.parent && p.spot) o.dy -= (hoverAmt[p.spot] || 0) * (M.hover || 0);
    }
    info[p.id] = o;
    const [px, py] = p.pivot;
    const m = new DOMMatrix().translateSelf(px + o.dx, py + o.dy).rotateSelf(o.rot).scaleSelf(o.sx, o.sy).translateSelf(-px, -py);
    return parentM ? parentM.multiply(m) : m;
  }

  // ---------- drawing helpers ----------
  let S = 1;
  const setBase = (g) => g.setTransform(S, 0, 0, S, 0, 0);
  const shadow = (g, ox, oy, blur, a) => { g.shadowColor = `rgba(28,38,22,${a})`; g.shadowOffsetX = ox * S; g.shadowOffsetY = oy * S; g.shadowBlur = blur * S; };
  const noShadow = (g) => { g.shadowColor = 'transparent'; g.shadowOffsetX = g.shadowOffsetY = g.shadowBlur = 0; };
  const temps = {};
  const tempFor = (g, name) => {
    const key = name + g.canvas.width + 'x' + g.canvas.height;
    return temps[key] || (temps[key] = Object.assign(document.createElement('canvas'), { width: g.canvas.width, height: g.canvas.height }));
  };
  // Flat water: slivers of paper drift along the channel. Each lives 2–6 s (a divisor of the loop), is pinned to a
  // spot on the water that changes every life, and pops in and out like the other paper bits.
  function prepareGlints(w) {
    const [bx, by, bw, bh] = w.box, cell = 4;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(bw / cell)); c.height = Math.max(1, Math.ceil(bh / cell));
    const cg = c.getContext('2d', { willReadFrequently: true });
    cg.drawImage(w.mask, bx * LS, by * LS, bw * LS, bh * LS, 0, 0, c.width, c.height);
    const d = cg.getImageData(0, 0, c.width, c.height).data;
    w.homes = [];
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[4 * (j * c.width + i) + 3] > 170) w.homes.push([bx + (i + 0.5) * cell, by + (j + 0.5) * cell]);
    const len = Math.hypot(w.flow[0], w.flow[1]) || 1;
    w.dir = [w.flow[0] / len, w.flow[1] / len];
    // a glint lies along the channel; on water running toward the viewer it lies across it, like a ripple
    let a = w.angle !== undefined ? deg(w.angle) : Math.abs(w.dir[0]) >= Math.abs(w.dir[1]) ? Math.atan2(w.dir[1], w.dir[0]) : 0;
    if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
    w.rot = a;
    const R = rng([...w.id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) | 0);
    const n = Math.round(((w.homes.length * cell * cell) / 1000) * (w.density ?? 1.5));
    w.glints = Array.from({ length: n }, () => ({ ph: R(), life: [2, 3, 4, 6][Math.floor(R() * 4)], s: 0.6 + R() * 0.55, v: 0.7 + R() * 0.6, kind: Math.floor(R() * 4), seed: R() * 1000, wob: R() * TAU }));
  }
  // Falling water: each fall is a quad traced from its face in the painting. Streaks run from the lip to the foot
  // along the face (so a leaning fall leans), start short and slow at the lip, stretch and speed up as they drop.
  // Every streak completes a whole number of drops per 12 s loop, so the loop is seamless.
  function prepareSheets(w) {
    const R = rng(4242), speed = w.speed ?? 60, density = w.density ?? 0.55;
    const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const sh of w.sheets) {
      const [tl, tr, br, bl] = sh.quad;
      const width = (len(tl, tr) + len(bl, br)) / 2, height = (len(tl, bl) + len(tr, br)) / 2;
      const k = Math.max(1, Math.round((L * speed) / height)), n = Math.max(6, Math.round(width * density * Math.min(1, 0.35 + height / 120)));
      // short, wide steps get thinner, longer streaks so they read as ribbons, not a fence
      const ws = Math.max(0.5, Math.min(1, height / 110)), ls = Math.max(1, Math.min(1.8, 110 / height));
      sh.streaks = Array.from({ length: n }, (_, i) => {
        const r = R();
        return {
          u: 0.05 + 0.9 * ((i + 0.15 + R() * 0.7) / n), ph: R(), k: k + (R() < 0.3 ? 1 : 0),
          len: (0.2 + R() * 0.3) * ls, w: (1.6 + R() * 2.2) * ws,
          col: r < 0.55 ? 'rgba(255,255,255,0.78)' : r < 0.88 ? 'rgba(222,244,255,0.72)' : 'rgba(40,110,190,0.24)',
        };
      });
    }
  }
  function drawSheets(wg, w, tw) {
    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    wg.lineCap = 'round';
    for (const sh of w.sheets) {
      const [tl, tr, br, bl] = sh.quad;
      const at = (u, v) => [(1 - v) * ((1 - u) * tl[0] + u * tr[0]) + v * ((1 - u) * bl[0] + u * br[0]), (1 - v) * ((1 - u) * tl[1] + u * tr[1]) + v * ((1 - u) * bl[1] + u * br[1])];
      for (const q of sh.streaks) {
        const v = cyc(tw, L / q.k, q.ph);
        const head = Math.pow(v, 1.4) * 1.04; // gravity: slow over the lip, fast at the foot
        const tail = Math.max(0, head - q.len * (0.25 + 0.75 * sm(0, 0.25, head)));
        if (head < 0.015 || tail > 0.99) continue;
        const a = at(q.u, tail), b = at(q.u, Math.min(1, head));
        // a streak slides over the lip out of nothing and melts into the foam at the foot
        wg.globalAlpha = sm(0, 0.22, head) * (1 - sm(0.8, 1, tail));
        wg.strokeStyle = q.col; wg.lineWidth = q.w * (0.7 + 0.3 * sm(0, 0.2, head));
        wg.beginPath(); wg.moveTo(a[0], a[1]); wg.lineTo(b[0], b[1]); wg.stroke();
      }
    }
    wg.globalAlpha = 1;
  }
  function drawGlints(wg, w, tq) {
    if (!w.homes.length) return;
    const speed = w.speed ?? 12;
    for (const q of w.glints) {
      const cycles = L / q.life, v = tq / q.life + q.ph, k = Math.floor(v), u = v - k;
      const home = w.homes[Math.floor(hash(q.seed + (k % cycles) * 7.31) * w.homes.length)];
      const d = speed * q.v * q.life * (u - 0.5);
      sprite(wg, SP.glints[q.kind], home[0] + w.dir[0] * d, home[1] + w.dir[1] * d, w.rot + 0.06 * Math.sin(TAU * u + q.wob), q.s * popIn(u));
    }
  }
  // Paper clouds drifting slowly behind everything: drawn only where the painting shows open sky.
  const DRIFT = (data.emitters || []).find((e) => e.type === 'skydrift');
  const driftClouds = DRIFT ? (() => {
    const R = rng(77), [y0, y1] = DRIFT.y || [20, 150], [v0, v1] = DRIFT.speed || [4, 8], [s0, s1] = DRIFT.scale || [0.7, 1.3];
    return Array.from({ length: DRIFT.count || 4 }, (_, i) => ({ x: ((i + R() * 0.6) / (DRIFT.count || 4)) * (W + 300), y: y0 + R() * (y1 - y0), v: v0 + R() * (v1 - v0), s: s0 + R() * (s1 - s0), k: i % 3 }));
  })() : [];
  function drawSkyDrift(g, variant) {
    if (!DRIFT || !shared.sky || !SP || (DRIFT.variant && DRIFT.variant !== variant)) return;
    const top = Math.max(0, (DRIFT.y?.[0] ?? 0) - 40), bottom = Math.min(H, (DRIFT.y?.[1] ?? 150) + 50);
    const tmp = tempFor(g, 'sky'), sg = tmp.getContext('2d');
    const Y = Math.floor(top * S), Hd = Math.ceil((bottom - top) * S), Wd = Math.ceil(W * S);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, Y, Wd, Hd);
    sg.setTransform(S, 0, 0, S, 0, 0);
    const span = W + 300, t = Math.floor(clock * 4) / 4; // clouds move 4 times a second, like the old ones
    for (const c of driftClouds) {
      const x = ((((c.x - c.v * t) % span) + span) % span) - 150;
      sprite(sg, SP.skyClouds[c.k], x, c.y + 2 * Math.sin(t * 0.3 + c.x), 0, c.s);
    }
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(shared.sky, 0, top * LS, W * LS, (bottom - top) * LS, 0, Y, Wd, Hd);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, Y, Wd, Hd, 0, Y, Wd, Hd); g.restore();
  }
  function drawWater(g, f, alpha, tq) {
    const tmp = tempFor(g, 'water'), wg = tmp.getContext('2d');
    for (const w of WATER) {
      const [bx, by, bw, bh] = w.box;
      const X = Math.floor(bx * S) - 8, Y = Math.floor(by * S) - 8, Wd = Math.ceil(bw * S) + 18, Hd = Math.ceil(bh * S) + 18;
      wg.setTransform(1, 0, 0, 1, 0, 0);
      wg.globalCompositeOperation = 'source-over'; wg.clearRect(X, Y, Wd, Hd);
      if (w.sheets) {
        wg.setTransform(S, 0, 0, S, 0, 0);
        drawSheets(wg, w, tq);
        wg.setTransform(1, 0, 0, 1, 0, 0);
      } else if (w.type === 'glints') {
        wg.setTransform(S, 0, 0, S, 0, 0);
        wg.shadowColor = 'rgba(20,70,130,0.28)'; wg.shadowOffsetX = 0.6 * S; wg.shadowOffsetY = 1 * S; wg.shadowBlur = 1.2 * S;
        drawGlints(wg, w, tq);
        wg.shadowColor = 'transparent'; wg.shadowBlur = wg.shadowOffsetX = wg.shadowOffsetY = 0;
        wg.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        const off = (w.step * f) % 120;
        w.pattern.setTransform(new DOMMatrix().scaleSelf(S, S).translateSelf(w.flow[0] * off, w.flow[1] * off).rotateSelf(w.tileRot || 0).scaleSelf(0.5, 0.5));
        wg.fillStyle = w.pattern; wg.fillRect(X, Y, Wd, Hd);
      }
      wg.globalCompositeOperation = 'destination-in';
      wg.drawImage(w.mask, (X / S) * LS, (Y / S) * LS, (Wd / S) * LS, (Hd / S) * LS, X, Y, Wd, Hd);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha; g.drawImage(tmp, X, Y, Wd, Hd, X, Y, Wd, Hd); g.restore();
    }
  }
  let behindBox = null;
  {
    const boxes = CLOUDS.filter((c) => c.behind).map((c) => [c.behind.x - c.amp - 12, c.behind.y - 6, c.behind.x + c.behind.w + c.amp + 12, c.behind.y + c.behind.h + 6]);
    if (boxes.length) {
      const x0 = Math.max(0, Math.min(...boxes.map((b) => b[0]))), y0 = Math.max(0, Math.min(...boxes.map((b) => b[1])));
      const x1 = Math.min(W, Math.max(...boxes.map((b) => b[2]))), y1 = Math.min(H, Math.max(...boxes.map((b) => b[3])));
      behindBox = [x0, y0, x1 - x0, y1 - y0];
    }
  }
  // The part of each cloud hidden behind trees slides with the cloud but shows only where something stood in front of it.
  function drawCloudsBehind(g, V, offs) {
    if (!behindBox || !shared.occ) return;
    const tmp = tempFor(g, 'behind'), bg = tmp.getContext('2d');
    const [bx, by, bw, bh] = behindBox, X = Math.floor(bx * S), Y = Math.floor(by * S), Wd = Math.ceil(bw * S), Hd = Math.ceil(bh * S);
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalCompositeOperation = 'source-over'; bg.clearRect(X, Y, Wd, Hd);
    for (const [c, dx, dy] of offs) {
      if (!c.behind || !V[c.id + '-behind']) continue;
      bg.setTransform(S, 0, 0, S, dx * S, dy * S);
      bg.drawImage(V[c.id + '-behind'], c.behind.x, c.behind.y, c.behind.w, c.behind.h);
    }
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalCompositeOperation = 'destination-in';
    bg.drawImage(shared.occ, bx * LS, by * LS, bw * LS, bh * LS, X, Y, Wd, Hd);
    bg.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, X, Y, Wd, Hd, X, Y, Wd, Hd); g.restore();
  }
  function groundShadow(g, x, y, rx, ry, lift) {
    noShadow(g); setBase(g);
    const k = Math.max(0.55, 1 - lift / 40);
    g.save(); g.translate(x, y - ry * 0.3); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * k);
    gr.addColorStop(0, `rgba(38,48,28,${0.42 * k})`); gr.addColorStop(0.6, `rgba(38,48,28,${0.26 * k})`); gr.addColorStop(1, 'rgba(38,48,28,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * k, 0, TAU); g.fill();
    g.restore();
  }

  // ---------- one frame ----------
  function drawScene(g, scale, variant, tq, f, now, live, tw = tq) {
    const V = img[variant];
    S = scale;
    g.imageSmoothingQuality = 'high';
    noShadow(g); setBase(g);
    g.drawImage(V.base, 0, 0, W, H);
    drawSkyDrift(g, variant);
    drawWater(g, f, variant === 'night' ? STYLE.night?.water ?? 0.45 : 1, tw);

    // clouds slide on their tracks (4 positions a second)
    const tc = Math.floor(tq * 4) / 4, offs = [];
    const moving = !STILL_CLOUDS.has(variant);
    for (const c of moving ? CLOUDS : []) {
      const s = osc(tc, 1, c.ph), wob = live ? introWobble(c.id, now) : 0;
      let dx = Math.round(c.mode === 'left' ? -c.amp * (0.5 + 0.5 * s) : c.mode === 'right' ? c.amp * (0.5 + 0.5 * s) : c.amp * s);
      dx += Math.round(10 * (c.mode === 'left' ? -Math.abs(wob) : c.mode === 'right' ? Math.abs(wob) : wob));
      const dy = Math.round(2 * osc(tc, 2, c.ph));
      shadow(g, 7, 8, 8, SHADOW.clouds);
      g.setTransform(S, 0, 0, S, dx * S, dy * S);
      g.drawImage(V[c.id], c.x, c.y, c.w, c.h);
      offs.push([c, dx, dy]);
    }
    noShadow(g);
    if (moving) {
      drawCloudsBehind(g, V, offs);
      setBase(g);
      g.drawImage(V.front, 0, 0, W, H);
    }

    // rigid paper pieces, back to front
    const mats = {}, info = {}, base = new DOMMatrix([S, 0, 0, S, 0, 0]);
    for (const p of PIECES) {
      if (p.parent && !mats[p.parent]) continue;
      const m = pieceMatrix(p, tq, now, live, p.parent ? mats[p.parent] : null, info);
      mats[p.id] = m;
      const M = MOTIONS[p.kind] || {};
      const lift = -info[p.id].dy;
      if (!p.parent && M.groundShadow && lift > 0.5) groundShadow(g, p.pivot[0], p.pivot[1], M.groundShadow[0], M.groundShadow[1], lift);
      if (p.kind === 'pine' || p.parent) noShadow(g);
      else {
        const hv = live && p.spot ? hoverAmt[p.spot] || 0 : 0;
        shadow(g, 4 + 3 * hv, 5 + 5 * hv, 5 + 6 * hv, SHADOW.pieces + 0.1 * hv);
      }
      g.setTransform(base.multiply(m));
      g.drawImage(V[p.id], p.x, p.y, p.w, p.h);
    }
    noShadow(g); setBase(g);

    drawLife(g, variant, tq, f, now, live, mats, info);
    if (live) drawCompanion(g, variant, tq, f, now);
    if (live) drawBursts(g);
  }

  // ---------- the small paper life, configured in scene.json → emitters ----------
  const MELODY = [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 77, 0, 76, 0, 72, 0, 69, 0, 72, 0, 74, 0, 71, 0, 67, 0, 74, 0];
  const STEP = L / MELODY.length, POSE4 = [0, 1, 2, 1];
  function drawLife(g, variant, tq, f, now, live, mats) {
    const boil = (k) => (hash(f * 13.1 + k) - 0.5) * 0.08;
    for (const [ei, e] of EMITTERS.entries()) {
      if (e.variant && e.variant !== variant) continue;
      shadow(g, 2, 3, 3, SHADOW.sprites * (variant === 'night' ? 0.6 : 1));
      switch (e.type) {
        case 'foam':
          e.points.forEach(([x, y, w], fi) => {
            const n = w > 60 ? 7 : 3;
            for (let j = 0; j < n; j++) {
              const sd = seeds[(fi * 9 + j + ei * 31) % 512], ph = cyc(tq, 1, j / n + sd);
              sprite(g, SP.foam, x + (sd - 0.5) * w, y - 10 * Math.sin(Math.PI * ph) * (0.6 + sd * 0.6), sd - 0.5 + boil(fi * 9 + j), popIn(ph) * (0.85 + sd * 0.4) * (variant === 'night' ? 0.8 : 1));
            }
          });
          break;
        case 'notes':
          for (let st = 0; st < MELODY.length; st++) {
            if (!MELODY[st]) continue;
            const age = (((tq - st * STEP) % L) + L) % L;
            if (age > 2.5) continue;
            const ph = age / 2.5;
            sprite(g, st % 8 === 4 ? SP.note2 : SP.note1, e.from[0] + e.dx * ph + 8 * Math.sin(ph * TAU * 1.2 + st), e.from[1] + e.dy * ph, 0.3 * Math.sin(ph * TAU + st) + boil(st), popIn(ph) * (0.85 + 0.25 * ph));
          }
          break;
        case 'stars':
          for (let j = 0; j < 6; j++) {
            const ph = cyc(tq, 4, j / 6), sd = seeds[60 + j];
            sprite(g, SP.star, e.from[0] + (sd - 0.5) * (e.spread || 40) + 7 * Math.sin(ph * TAU + j), e.from[1] - (e.rise || 40) * ph, ph * 2.4 + j, popIn(ph) * (0.6 + 0.3 * sd));
          }
          break;
        case 'tags':
          for (let j = 0; j < 4; j++) {
            const ph = cyc(tq, 6, j / 4);
            sprite(g, SP.tags[j], e.from[0] - 10 + j * 12 + e.dx * ph, e.from[1] + e.dy * ph, 0.22 * Math.sin(ph * TAU * 1.5 + j) + boil(40 + j), popIn(ph) * 0.9);
          }
          break;
        case 'confetti':
          for (let j = 0; j < 6; j++) {
            const ph = cyc(tq, 4, j / 6), sd = seeds[80 + j];
            sprite(g, SP.confetti[j], e.from[0] + (sd - 0.5) * (e.spread || 30) + 9 * Math.sin(ph * TAU + j), e.from[1] - (e.rise || 60) * ph, ph * 3 + j, popIn(ph));
          }
          break;
        case 'leaves':
          e.points.forEach(([x, y], i) => {
            const ph = cyc(tq, 6, i / e.points.length);
            sprite(g, SP.leaves[i % 3], x + 24 * Math.sin(ph * TAU * 1.25 + i), y + 140 * ph, 0.9 * Math.sin(ph * TAU * 1.25 + i + 0.8) + i, popIn(ph) * 0.85);
          });
          break;
        case 'butterflies':
          e.paths.forEach(([cx, cy, ax, ay], i) => {
            const k1 = [1, 2, 1, 2][i % 4], k2 = [2, 3, 3, 1][i % 4], ph = [0, 1.7, 3.1, 4.4][i % 4];
            const x = cx + ax * osc(tq, k1, ph), y = cy + ay * osc(tq, k2, ph * 1.3) - 6 * Math.abs(osc(tq, 12, i));
            const dir = Math.cos((TAU * k1 * tq) / L + ph) >= 0 ? 1 : -1;
            g.save(); g.translate(x, y); g.scale(dir, 1);
            sprite(g, SP.butterflies[i % 4][POSE4[(f + i) % 4]], 0, 0, 0.15 + boil(90 + i), 1.1);
            g.restore();
          });
          break;
        case 'birds': {
          shadow(g, 5, 7, 5, SHADOW.sprites * 0.8);
          const fx = -120 + (W + 244) * (tq / L), fy = (e.y || 120) + 16 * osc(tq, 2);
          [[0, 0, 1.3], [-50, 22, 1.05], [-88, -12, 0.9]].forEach(([dx, dy, s], i) => sprite(g, SP.birds[POSE4[(f + i) % 4]], fx + dx, fy + dy, boil(120 + i), s));
          g.save(); g.translate(W + 144 - (W + 324) * cyc(tq, L, 0.5), (e.y || 120) + 60 + 10 * osc(tq, 3)); g.scale(-1, 1);
          sprite(g, SP.birds[POSE4[(f + 2) % 4]], 0, 0, 0, 1); g.restore();
          break;
        }
        case 'fish':
          for (const [start, dur, x0, y0, x1, y1, h] of e.jumps) {
            const tau = tq - start;
            if (tau >= 0 && tau <= dur) {
              const ph = tau / dur, x = x0 + (x1 - x0) * ph, y = y0 + (y1 - y0) * ph - h * 4 * ph * (1 - ph);
              const dx = x1 - x0, dy = y1 - y0 - h * 4 * (1 - 2 * ph);
              g.save(); g.translate(x, y); g.rotate(Math.atan2(dy, Math.abs(dx)) * Math.sign(dx)); g.scale(Math.sign(dx), 1);
              sprite(g, SP.fish, 0, 0); g.restore();
            }
            for (const [ts, sx, sy] of [[0, x0, y0], [dur, x1, y1]]) {
              const a = tau - ts;
              if (a >= 0 && a < 0.5) for (let j = 0; j < 5; j++) {
                const an = -Math.PI / 2 + (j - 2) * 0.5, r = 6 + 34 * a;
                sprite(g, SP.foam, sx + Math.cos(an) * r, sy + 2 + Math.sin(an) * r * 0.6 + 60 * a * a, j, 0.9);
              }
            }
          }
          break;
        case 'screens': {
          noShadow(g);
          const t6 = Math.floor(tq * 6) / 6, flash = live && flashOn(now);
          const COL = ['#7ee0a1', '#6cc6ff', '#ffd479', '#c9a6ff', '#e8f0ff'];
          e.rects.forEach(([x, y, w, h], si) => {
            g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
            g.fillStyle = flash ? 'rgba(210,240,255,0.9)' : 'rgba(16,28,42,0.8)'; g.fillRect(x, y, w, h);
            const lh = 4, n = 14, first = Math.floor(cyc(t6, L / 2, si * 0.37) * n);
            for (let j = 0; j <= Math.ceil(h / lh); j++) {
              const idx = (first + j) % n, r = seeds[(si * 20 + idx) % 512];
              g.fillStyle = COL[Math.floor(r * 5)];
              g.fillRect(x + 2 + (idx % 3) * 3, y + 2 + j * lh, 6 + r * (w - 12), 1.8);
            }
            g.restore();
          });
          break;
        }
        case 'fireflies': {
          noShadow(g);
          g.save(); g.globalCompositeOperation = 'lighter';
          const n = e.count || 20;
          for (let j = 0; j < n; j++) {
            const area = e.areas[j % e.areas.length], sd = seeds[200 + j], sd2 = seeds[300 + j];
            const x = area[0] + area[2] * (0.5 + 0.45 * Math.sin((TAU * (1 + (j % 3)) * tq) / L + sd * TAU));
            const y = area[1] + area[3] * (0.5 + 0.45 * Math.sin((TAU * (2 + (j % 2)) * tq) / L + sd2 * TAU));
            const on = 0.5 + 0.5 * Math.sin((TAU * (4 + (j % 5)) * tq) / L + sd * 9);
            const r = 7 + 5 * on, gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(255,246,170,${0.85 * on})`); gr.addColorStop(0.35, `rgba(220,255,140,${0.35 * on})`); gr.addColorStop(1, 'rgba(200,255,120,0)');
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
          }
          g.restore();
          break;
        }
        case 'twinkle': {
          noShadow(g);
          const n = e.count || 24;
          for (let j = 0; j < n; j++) {
            const area = e.areas[j % e.areas.length], sd = seeds[400 + j], sd2 = seeds[(450 + j) % 512];
            const ph = cyc(tq, 3, sd);
            if (ph > 0.4) continue;
            sprite(g, SP.twinkle, area[0] + area[2] * sd, area[1] + area[3] * sd2, ph * 3, Math.sin((Math.PI * ph) / 0.4) * (0.7 + sd2 * 0.6));
          }
          break;
        }
        case 'glow': {
          noShadow(g);
          g.save(); g.globalCompositeOperation = 'lighter';
          e.points.forEach(([x, y, r, a], j) => {
            const k = a * (0.85 + 0.15 * Math.sin((TAU * 3 * tq) / L + j * 1.9));
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(255,214,140,${k})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
          });
          g.restore();
          break;
        }
      }
    }
    noShadow(g);
  }
  const flashOn = (now) => Object.values(SPOTS).some((s) => {
    if (!s.flashScreens || !(s.id in react)) return false;
    const t = stepA(now - react[s.id]);
    return t >= 0 && t < 1 && Math.floor(t * 6) % 2 === 0;
  });

  // ---------- Cabbageclaw, the companion scuttling along the meadow ----------
  // The walk follows a polyline over the ground (scene.json companion.path), out and back in one 12 s loop, tilting with
  // the slope; hops where a point is marked in companion.hops. Clicked, it stops where it is and waves for a moment.
  const WAVE = (COMPANION?.wave ?? 2.6) * 1000;
  const walk = (() => {
    if (!COMPANION) return null;
    const pts = COMPANION.path, segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    const at = (d) => {
      d = Math.max(0, Math.min(total, d));
      for (let i = 0; i < segs.length; i++) {
        if (d <= segs[i] || i === segs.length - 1) { const u = segs[i] ? d / segs[i] : 0, a = pts[i], b = pts[i + 1]; return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, slope: Math.atan2(b[1] - a[1], Math.abs(b[0] - a[0])), i, u }; }
        d -= segs[i];
      }
    };
    const hopAt = (COMPANION.hops || []).map((k) => { let d = 0; for (let i = 0; i < k; i++) d += segs[i]; return d; });
    return { total, at, hopAt };
  })();
  let compClock = 0;
  function companionPose(now) {
    const t = ((compClock % L) + L) % L, tq = Math.floor(t * FPS) / FPS;
    // walk out (0-5 s), look around (5-6), walk back (6-11), look (11-12)
    let u, dir, walking;
    if (tq < 5) { u = tq / 5; dir = 1; walking = true; }
    else if (tq < 6) { u = 1; dir = 1; walking = false; }
    else if (tq < 11) { u = 1 - (tq - 6) / 5; dir = -1; walking = true; }
    else { u = 0; dir = -1; walking = false; }
    const d = u * walk.total, p = walk.at(d);
    const o = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 };
    const fi = Math.floor(tq * FPS);
    if (walking) {
      o.dy -= fi % 2 ? 2 : 0;
      o.rot = (fi % 2 ? 3 : -3) + (dir * p.slope * 180) / Math.PI * 0.45;
      for (const h of walk.hopAt) { const k = 1 - Math.abs(d - h) / 26; if (k > 0) { o.dy -= 16 * Math.sin((Math.PI * k) / 2) ** 2; o.sy += 0.06 * k; } }
    } else o.rot = 4 * Math.sin((TAU * 6 * tq) / L);
    const t0 = react[COMPANION.spot];
    if (t0 !== undefined) {
      const tt = stepA(now - t0);
      if (tt >= 0 && tt < 3) applyPoke([COMPANION.motion], tt, o);
      // the wave: a few big tilts toward the viewer, settling
      if (tt >= 0.25 && tt < WAVE / 1000) o.rot += 13 * Math.sin(TAU * 2.4 * (tt - 0.25)) * Math.max(0, 1 - (tt - 0.25) / (WAVE / 1000));
    }
    return { x: p.x, y: p.y, dir, o };
  }
  function drawCompanion(g, variant, tq, f, now) {
    if (!COMPANION || !shared.claw) return;
    const { x, y, dir, o } = companionPose(now);
    const h = COMPANION.height, w = (h * shared.claw.width) / shared.claw.height;
    if (-o.dy > 0.5) groundShadow(g, x, y, w * 0.34, 6, -o.dy);
    shadow(g, 3, 4, 4, SHADOW.pieces * (variant === 'night' ? 0.6 : 1));
    g.save(); setBase(g); g.translate(x, y + o.dy); g.rotate(deg(o.rot)); g.scale(dir * o.sx, o.sy);
    g.drawImage(shared.claw, -w / 2, -h * 0.94, w, h);
    g.restore(); noShadow(g);
    companionAt = { x, y: y - h * 0.45, r: h * 0.55, top: y + o.dy - h };
  }
  let companionAt = null;

  // ---------- bursts ----------
  const BURST_SPRITES = ['leaf', 'heart', 'note', 'star', 'tag', 'paint', 'drop'];
  function burst(kind, x, y, n) {
    if (!BURST_SPRITES.includes(kind)) return;
    const R = Math.random;
    for (let i = 0; i < n; i++) {
      const an = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = 110 + R() * 170;
      const p = { kind, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 300, age: 0, life: 1.1 + R() * 0.7, rot: R() * TAU, vr: (R() - 0.5) * 8, s: 0.8 + R() * 0.5, i: Math.floor(R() * 100) };
      if (kind === 'heart' || kind === 'note' || kind === 'tag' || kind === 'star') { p.g = -40; p.vy *= 0.55; p.vx *= 0.6; }
      if (kind === 'drop') { p.vx = 60 + R() * 120; p.vy = -60 - R() * 130; p.g = 520; p.life = 0.9; }
      bursts.push(p);
    }
  }
  function stepBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= 1 - 1.2 * dt;
      if (p.age > p.life) bursts.splice(i, 1);
    }
  }
  function drawBursts(g) {
    shadow(g, 2, 3, 3, SHADOW.sprites);
    for (const p of bursts) {
      const s = p.s * popIn(p.age / p.life);
      switch (p.kind) {
        case 'leaf': sprite(g, SP.leaves[p.i % 3], p.x, p.y, p.rot, s); break;
        case 'heart': sprite(g, SP.heart, p.x, p.y, Math.sin(p.rot) * 0.3, s * 1.1); break;
        case 'note': sprite(g, p.i % 2 ? SP.note1 : SP.note2, p.x, p.y, Math.sin(p.rot) * 0.4, s); break;
        case 'star': sprite(g, p.i % 3 ? SP.star : SP.starW, p.x, p.y, p.rot, s * 0.8); break;
        case 'tag': sprite(g, SP.tags[p.i % 4], p.x, p.y, Math.sin(p.rot) * 0.4, s * 0.9); break;
        case 'paint': sprite(g, SP.confetti[p.i % 6], p.x, p.y, p.rot, s * 1.2); break;
        case 'drop': sprite(g, SP.drop, p.x, p.y, 0.3, s * 0.75); break;
      }
    }
    noShadow(g);
  }

  // ---------- public ----------
  let clock = 0, playing = !reduceMotion, lastNow = performance.now(), stepAcc = 0, lastKey = -1;
  let variant = 'day', fade = null; // fade = {from, to, t0}
  let target = null; // {canvas, scale}
  const loopTime = () => ((clock % L) + L) % L;

  function render(now = performance.now()) {
    if (!target || !SP || !complete[variant]) return;
    const g = target.canvas.getContext('2d');
    const fi = Math.floor(loopTime() * FPS + 1e-6), tq = fi / FPS, f = fi % FRAMES;
    const tw = Math.floor(loopTime() * WFPS + 1e-6) / WFPS; // water moves on its own, finer clock
    if (fade) {
      const k = Math.min(1, (now - fade.t0) / 700);
      drawScene(g, target.scale, fade.from, tq, f, now, true, tw);
      const off = tempFor(g, 'fade'), og = off.getContext('2d');
      og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, off.width, off.height);
      drawScene(og, target.scale, fade.to, tq, f, now, true, tw);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = k; g.drawImage(off, 0, 0); g.restore();
      if (k >= 1) { variant = fade.to; fade = null; }
    } else drawScene(g, target.scale, variant, tq, f, now, true, tw);
  }
  function tick(now) {
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (playing) clock += dt;
    if (playing && !(COMPANION && react[COMPANION.spot] !== undefined && now - react[COMPANION.spot] < WAVE)) compClock += dt;
    // hover lift eases toward its target, on the action frame rate
    for (const k of new Set([...Object.keys(hoverAmt), hover].filter(Boolean))) {
      const goal = k === hover ? 1 : 0, cur = hoverAmt[k] || 0;
      hoverAmt[k] = Math.abs(goal - cur) < 0.02 ? goal : cur + (goal - cur) * Math.min(1, dt * 14);
    }
    stepAcc += dt;
    let stepped = false;
    while (stepAcc >= 1 / AFPS) { stepAcc -= 1 / AFPS; stepBursts(1 / AFPS); stepped = true; }
    const key = Math.floor(loopTime() * AFPS + 1e-6);
    const busy = (playing && WATER.length && WFPS > FPS) || bursts.length || fade || Object.values(hoverAmt).some((v) => v > 0 && v < 1) || stepA(now - introT0) < 3 || Object.values(react).concat(Object.values(kicks)).some((t) => now - t < 6000);
    if (key !== lastKey && (busy || key % (AFPS / FPS) === 0)) { render(now); lastKey = key; }
    else if (stepped && busy) render(now);
    sfx('tick', Math.floor(loopTime() * FPS) / FPS, playing);
    requestAnimationFrame(tick);
  }

  return {
    ready,
    size: [W, H],
    layerScale: LS,
    start() { introT0 = reduceMotion ? -1e9 : performance.now() + 250; requestAnimationFrame((n) => { lastNow = n; tick(n); }); },
    attach(canvas, scale) { target = { canvas, scale }; render(); },
    async setVariant(v) {
      if (v === variant && !fade) return;
      await loadVariant(v);
      fade = { from: variant, to: v, t0: performance.now() };
    },
    preload: loadVariant,
    get variant() { return fade ? fade.to : variant; },
    setPlaying(v) { playing = v; },
    get playing() { return playing; },
    replay() { introT0 = performance.now(); },
    setHover(id) { hover = id; },
    // what is under a point (scene units): a place id, a pokeable piece id, or null
    hitTest(x, y) {
      if (companionAt && Math.hypot(x - companionAt.x, y - companionAt.y) < companionAt.r) return COMPANION.spot;
      const cx = Math.floor(x / HIT.cell), cy = Math.floor(y / HIT.cell);
      if (cx < 0 || cy < 0 || cx >= HIT.w || cy >= HIT.h) return null;
      return HIT.ids[HIT.cells[cy * HIT.w + cx]] || null;
    },
    // poke a place (its pieces react, its burst and sound play) or a single piece
    poke(id, x, y) {
      const now = performance.now(), spot = SPOTS[id];
      if (spot) {
        react[id] = now;
        const at = id === COMPANION?.spot && companionAt ? [companionAt.x, companionAt.y - 20] : spot.burst?.at;
        if (spot.burst && at) burst(spot.burst.sprite, at[0], at[1], spot.burst.count ?? 8);
        (spot.sound || []).forEach((n) => sfx(n));
      } else if (byId[id]) {
        const p = byId[id], M = MOTIONS[p.kind] || {};
        kicks[id] = now;
        if (M.pokeBurst) burst(M.pokeBurst.sprite, p.pivot[0], p.y + Math.min(30, p.h / 3), M.pokeBurst.count ?? 5);
        (M.pokeSound || []).forEach((n) => sfx(n));
      } else if (x !== undefined) {
        burst('star', x, y, 7); sfx('tick');
      }
      render(now);
    },
    // for checking a reaction frame by frame: pokeAt('pets', 0.3)
    pokeAt(id, secondsAgo) { const t = performance.now() - secondsAgo * 1000; if (SPOTS[id]) react[id] = t; else kicks[id] = t; render(); },
    seek(sec) { clock = sec; compClock = sec; render(); },
    // where Cabbageclaw's head is (scene units), for its speech bubble
    companionTop() { return companionAt ? { x: companionAt.x, y: companionAt.top } : null; },
    // bounding box (units) of a place's pieces, for keyboard hotspots and camera moves
    spotBox(id) {
      const ps = PIECES.filter((p) => p.spot === id && p.w);
      if (!ps.length) return null;
      const x0 = Math.min(...ps.map((p) => p.x)), y0 = Math.min(...ps.map((p) => p.y));
      const x1 = Math.max(...ps.map((p) => p.x + p.w)), y1 = Math.max(...ps.map((p) => p.y + p.h));
      return [x0, y0, x1 - x0, y1 - y0];
    },
  };
}
