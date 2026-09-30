import { createStreamSound } from './stream-audio.js';
import { scheduleTone } from './soundtrack.js';
import { t, setText, setAttributeText, localize, initLanguage } from './i18n.js';
import { createRooms } from './rooms.js';
import { createPaperStage } from './paper-stage.js';
import { createPaperSound } from './paper-sound.js';
import { LAYER_DIR, CARDS, LANDMARKS } from './world-art.js';

const DATA = window.CABBAGE_LAYERS;
const [ART_WIDTH, ART_HEIGHT] = DATA.size;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('map-stage'), viewport = document.getElementById('map-viewport'), canvas = document.getElementById('map-canvas');
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--art-width', ART_WIDTH + 'px');
rootStyle.setProperty('--art-height', ART_HEIGHT + 'px');
rootStyle.setProperty('--art-ratio', ART_WIDTH + '/' + ART_HEIGHT);

const locations = {
  read: { get name() { return t('location.read.name'); }, get sub() { return t('location.read.sub'); }, get tag() { return t('location.read.tag'); }, number: '01', ...CARDS.read },
  music: { name: 'compose boredom', get sub() { return t('location.music.sub'); }, get tag() { return t('location.music.tag'); }, number: '02', ...CARDS.music },
  nerd: { name: 'nerd’s farm', get sub() { return t('location.nerd.sub'); }, get tag() { return t('location.nerd.tag'); }, number: '03', ...CARDS.nerd },
  art: { name: 'my-world-in-XD', get sub() { return t('location.art.sub'); }, get tag() { return t('location.art.tag'); }, number: '04', ...CARDS.art },
  pets: { get name() { return t('location.pets.name'); }, get sub() { return t('location.pets.sub'); }, get tag() { return t('location.pets.tag'); }, number: '05', landmark: true, ...CARDS.pets },
  great: { get name() { return t('location.great.name'); }, get sub() { return t('location.great.sub'); }, get tag() { return t('location.great.tag'); }, number: '06', landmark: true, ...CARDS.great },
};
// Places on the map that react but have no room.
const friends = {
  claw: { name: 'world.clawName', sub: 'world.clawSub', say: 'world.claw' },
  farmer: { name: 'world.farmerName', sub: 'world.farmerSub' },
};

// ---------- camera ----------
// On a desktop the map fills the window and the header and footer float over it (size.top / size.bottom): at the
// minimum zoom the book fills the whole band between them, edge to edge; whatever does not fit (a little of the far
// left and right on narrower windows) is a drag away. On a phone the map is its own 16:9 box and the book fills it.
const MAX_ZOOM = 3;
const band = (size) => size.height - size.top - size.bottom;
const fitScale = (size) => Math.max(size.width / ART_WIDTH, band(size) / ART_HEIGHT);
function constrainView(view, size) {
  const scale = Math.max(fitScale(size), Math.min(view.s, fitScale(size) * MAX_ZOOM));
  const width = ART_WIDTH * scale, height = ART_HEIGHT * scale, h = band(size);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  return {
    s: scale,
    x: width <= size.width ? (size.width - width) / 2 : clamp(view.x, size.width - width, 0),
    y: height <= h ? size.top + (h - height) / 2 : clamp(view.y, size.top + h - height, size.top),
  };
}
// On very wide windows the book is cropped top and bottom: keep more of the sky and the Great Cabbage, less of the page edge.
function fitView(size) { const s = fitScale(size), spare = band(size) - ART_HEIGHT * s; return { s, x: (size.width - ART_WIDTH * s) / 2, y: size.top + spare * (spare < 0 ? 0.25 : 0.5) }; }
function zoomView(view, size, factor, point) {
  const s = Math.max(fitScale(size), Math.min(view.s * factor, fitScale(size) * MAX_ZOOM));
  return constrainView({ s, x: point.x - ((point.x - view.x) * s) / view.s, y: point.y - ((point.y - view.y) * s) / view.s }, size);
}
function resizeView(view, previous, next) {
  if (!previous.width || !previous.height) return fitView(next);
  const relativeZoom = view.s / fitScale(previous), s = fitScale(next) * relativeZoom;
  const cx = (previous.width / 2 - view.x) / view.s, cy = (previous.top + band(previous) / 2 - view.y) / view.s;
  return constrainView({ s, x: next.width / 2 - cx * s, y: next.top + band(next) / 2 - cy * s }, next);
}

let s = 1, x = 0, y = 0, night = false, dragged = false, lastPointer = null, toastTimer, enterTimer;
const pointers = new Map();
let pinch = null, hintKey = null, hovered = null;

// ---------- sound ----------
const audio = {
  ctx: null, ambientGain: null, on: false,
  ensure() {
    if (!this.ctx || this.ctx.state === 'closed') { const C = window.AudioContext || window.webkitAudioContext; if (!C) { toast('world.soundUnsupported'); return null; } this.ctx = new C(); }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  note(f, duration = 0.45, volume = 0.07) {
    const ctx = this.ensure(); if (!ctx) return;
    if (ctx.state === 'running') scheduleTone(ctx, f, duration, volume);
    else ctx.resume().then(() => { if (ctx.state === 'running') scheduleTone(ctx, f, duration, volume); }).catch(() => toast('world.soundUnsupported'));
  },
  toggle() {
    const ctx = this.ensure(); if (!ctx) return;
    if (!this.ambientGain) this.ambientGain = createStreamSound(ctx).gain;
    this.on = !this.on;
    this.ambientGain.gain.setTargetAtTime(this.on ? 0.34 : 0, ctx.currentTime, 0.65);
    document.getElementById('ambient').setAttribute('aria-pressed', String(this.on));
    setAttributeText(document.getElementById('ambient'), 'aria-label', this.on ? 'world.soundOff' : 'world.soundOn');
    toast(this.on ? 'world.soundPlaying' : 'world.soundStopped');
  },
};
const sfx = createPaperSound(audio);

// ---------- the paper world ----------
const paper = createPaperStage({ data: DATA, dir: LAYER_DIR, sfx, reduceMotion });
const ENTER_DELAY = (DATA.style?.enterDelay ?? 0.42) * 1000;
let canvasScale = 0, canvasTimer = null;
function wantedScale() { return Math.min(paper.layerScale, Math.max(0.5, Math.ceil(s * (window.devicePixelRatio || 1) * 4) / 4)); }
function syncCanvas(now) {
  const want = wantedScale();
  if (want === canvasScale) return;
  clearTimeout(canvasTimer);
  canvasTimer = setTimeout(() => {
    canvasScale = want;
    canvas.width = Math.round(ART_WIDTH * want); canvas.height = Math.round(ART_HEIGHT * want);
    paper.attach(canvas, want);
  }, now || !canvasScale ? 0 : 160);
}

const phone = matchMedia('(max-width: 700px)');
const headerEl = document.querySelector('.world-header'), footerEl = document.querySelector('.world-footer');
function canvasSize() {
  const overlay = !phone.matches;
  return { width: viewport.clientWidth, height: viewport.clientHeight, top: overlay ? headerEl.offsetHeight : 0, bottom: overlay ? footerEl.offsetHeight : 0 };
}
function draw() {
  const size = canvasSize(); if (!size.width || !size.height) return;
  ({ s, x, y } = constrainView({ s, x, y }, size));
  stage.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  // landmark names keep a steady on-screen size (a little larger on big windows) whatever the zoom
  const ui = Math.min(1.3, Math.max(1, innerWidth / 1500));
  stage.style.setProperty('--label-scale', Math.min(2, Math.max(0.65, (1.02 * ui) / s)));
  stage.style.setProperty('--great-label-scale', Math.min(1.3, Math.max(0.65, (0.98 * ui) / s)));
  syncCanvas();
}
function home() { const size = canvasSize(); if (!size.width || !size.height) return; ({ s, x, y } = fitView(size)); draw(); }
function zoom(factor, clientX, clientY) {
  const size = canvasSize(), rect = viewport.getBoundingClientRect(); if (!size.width || !size.height) return;
  const point = { x: clientX === undefined ? size.width / 2 : clientX - rect.left, y: clientY === undefined ? size.top + band(size) / 2 : clientY - rect.top };
  ({ s, x, y } = zoomView({ s, x, y }, size, factor, point)); draw();
}
let previousSize = { width: 0, height: 0 };
{
  const ro = new ResizeObserver(() => { const next = canvasSize(); if (!next.width || !next.height) return; ({ s, x, y } = resizeView({ s, x, y }, previousSize, next)); previousSize = next; draw(); });
  ro.observe(viewport); ro.observe(headerEl); ro.observe(footerEl);
}
// true full screen, when the browser allows it
{
  const b = document.getElementById('fullscreen');
  if (!document.fullscreenEnabled) b.hidden = true;
  b.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    b.setAttribute('aria-pressed', String(on));
    setAttributeText(b, 'aria-label', on ? 'world.exitFullscreen' : 'world.fullscreen');
    setAttributeText(b, 'title', on ? 'world.exitFullscreen' : 'world.fullscreen');
  });
}

function toast(key, values = {}) { clearTimeout(toastTimer); const e = document.getElementById('toast'); setText(e, key, values); e.classList.add('show'); toastTimer = setTimeout(() => e.classList.remove('show'), 2600); }
function locationHint(key) {
  hintKey = key;
  const p = locations[key], fr = friends[key], e = document.getElementById('location-hint'), name = e.querySelector('b');
  if (p) { delete name.dataset.i18n; name.textContent = p.name; }
  else setText(name, fr ? fr.name : 'world.welcome');
  setText(e.querySelector('small'), p ? 'location.' + key + '.sub' : fr ? fr.sub : 'world.welcomeHint');
}
function refreshWorldLanguage() {
  for (const [key, p] of Object.entries(locations)) {
    const b = document.querySelector('.building-hotspot[data-enter="' + key + '"]');
    if (b) setAttributeText(b, 'aria-label', 'world.enter', { name: p.name, category: p.sub });
  }
  locationHint(hintKey);
}

const rooms = createRooms({ locations, audio, toast, onClose: () => { document.querySelectorAll('[data-enter]').forEach((b) => b.classList.remove('active')); } });
function enter(key) {
  clearTimeout(enterTimer);
  locationHint(key);
  document.querySelectorAll('[data-enter]').forEach((b) => b.classList.toggle('active', b.dataset.enter === key));
  paper.poke(key);
  enterTimer = setTimeout(() => rooms.open(key), reduceMotion ? 0 : ENTER_DELAY);
}

// ---------- pointer: what is under it comes from the paper hit map ----------
function toUnits(clientX, clientY) { const r = viewport.getBoundingClientRect(); return [(clientX - r.left - x) / s, (clientY - r.top - y) / s]; }
function setHovered(id) {
  if (id === hovered) return;
  hovered = id;
  const place = id && (locations[id] || friends[id]) ? id : null;
  paper.setHover(place);
  viewport.classList.toggle('pointing', !!id);
  locationHint(place);
  document.querySelectorAll('.landmark-label').forEach((l) => l.classList.toggle('hot', l.dataset.for === place));
}
// Cabbageclaw stops, waves and says hello in a paper speech bubble above its head.
let bubbleTimer = null;
function say(key) {
  const at = paper.companionTop(); if (!at) return;
  let b = document.getElementById('claw-bubble');
  if (!b) { b = document.createElement('div'); b.id = 'claw-bubble'; b.className = 'speech-bubble'; b.setAttribute('role', 'status'); document.getElementById('map-hotspots').append(b); }
  setText(b, key);
  b.style.left = `${at.x}px`; b.style.top = `${at.y - 6}px`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), (DATA.companion?.wave ?? 2.6) * 1000);
}
function activate(id, ux, uy) {
  if (id && locations[id]) enter(id);
  else if (id && friends[id]) { paper.poke(id); if (friends[id].say) say(friends[id].say); }
  else paper.poke(id, ux, uy);
}

viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) { dragged = false; lastPointer = { x: e.clientX, y: e.clientY }; }
  if (pointers.size === 2) { const a = [...pointers.values()]; pinch = { distance: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; dragged = true; }
});
viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse') { const [ux, uy] = toUnits(e.clientX, e.clientY); setHovered(paper.hitTest(ux, uy)); }
    return;
  }
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const a = [...pointers.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    if (pinch?.distance) zoom(d / pinch.distance, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
    pinch = { distance: d }; return;
  }
  if (!lastPointer) return;
  if (!dragged && Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) > 5) { dragged = true; viewport.setPointerCapture(e.pointerId); viewport.classList.add('dragging'); setHovered(null); }
  if (dragged) { x += e.clientX - prev.x; y += e.clientY - prev.y; draw(); }
});
function endPointer(e) {
  const wasTap = pointers.has(e.pointerId) && pointers.size === 1 && !dragged && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasTap) { const [ux, uy] = toUnits(e.clientX, e.clientY); activate(paper.hitTest(ux, uy), ux, uy); }
  if (!pointers.size) { viewport.classList.remove('dragging'); lastPointer = null; setTimeout(() => (dragged = false), 40); }
  else lastPointer = [...pointers.values()][0];
}
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) setHovered(null); });
viewport.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0014), e.clientX, e.clientY); }, { passive: false });
viewport.addEventListener('dblclick', (e) => { const [ux, uy] = toUnits(e.clientX, e.clientY); if (paper.hitTest(ux, uy)) return; zoom(1.25, e.clientX, e.clientY); });
viewport.addEventListener('keydown', (e) => {
  if (e.target !== viewport) return;
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'h', 'H'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  if (e.key === '+' || e.key === '=') zoom(1.2);
  else if (e.key === '-') zoom(1 / 1.2);
  else if (e.key.toLowerCase() === 'h') home();
  else { x += e.key === 'ArrowLeft' ? 55 : e.key === 'ArrowRight' ? -55 : 0; y += e.key === 'ArrowUp' ? 55 : e.key === 'ArrowDown' ? -55 : 0; draw(); }
});

// ---------- controls ----------
async function toggleNight() {
  const button = document.getElementById('daynight'), nextNight = !night;
  if (button.disabled) return;
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    if (nextNight) setText(document.getElementById('day-text'), 'world.nightLoading');
    await paper.setVariant(nextNight ? 'night' : 'day');
    night = nextNight;
    document.body.classList.toggle('night', night);
    button.setAttribute('aria-pressed', String(night));
    setAttributeText(button, 'aria-label', night ? 'world.toDay' : 'world.toNight');
    document.getElementById('day-symbol').textContent = night ? '☾' : '☀';
    setAttributeText(canvas, 'aria-label', night ? 'world.nightAlt' : 'world.dayAlt');
  } catch { toast('world.nightError'); }
  finally { setText(document.getElementById('day-text'), night ? 'world.night' : 'world.day'); button.disabled = false; button.removeAttribute('aria-busy'); }
}
document.getElementById('home').onclick = () => { home(); locationHint(null); paper.replay(); };
document.getElementById('fit-map').onclick = () => home();
document.getElementById('zoom-in').onclick = () => zoom(1.2);
document.getElementById('zoom-out').onclick = () => zoom(1 / 1.2);
document.getElementById('ambient').onclick = () => audio.toggle();
document.getElementById('daynight').onclick = toggleNight;
const help = document.getElementById('help');
document.getElementById('help-open').onclick = () => help.showModal();
document.querySelectorAll('.close-help').forEach((b) => (b.onclick = () => help.close()));
document.querySelectorAll('.world-nav [data-enter]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.enter)));
document.querySelectorAll('.world-nav [data-enter]').forEach((b) => {
  b.addEventListener('mouseenter', () => paper.setHover(b.dataset.enter));
  b.addEventListener('mouseleave', () => paper.setHover(hovered && (locations[hovered] || friends[hovered]) ? hovered : null));
});

// Keyboard and screen-reader entrances sit over each place; the pointer uses the hit map instead.
function buildHotspots() {
  const layer = document.getElementById('map-hotspots');
  for (const [key, p] of Object.entries(locations)) {
    const box = paper.spotBox(key); if (!box) continue;
    const b = document.createElement('button');
    b.className = 'building-hotspot'; b.dataset.enter = key;
    b.style.cssText = `left:${box[0]}px;top:${box[1]}px;width:${box[2]}px;height:${box[3]}px`;
    setAttributeText(b, 'aria-label', 'world.enter', { name: p.name, category: p.sub });
    b.addEventListener('click', () => enter(key));
    b.addEventListener('focus', () => { paper.setHover(key); locationHint(key); });
    b.addEventListener('blur', () => { paper.setHover(null); locationHint(null); });
    layer.append(b);
    if (p.landmark && LANDMARKS[key]) {
      const label = document.createElement('span');
      label.className = 'landmark-label landmark-' + key; label.dataset.for = key;
      label.style.cssText = `left:${LANDMARKS[key][0]}px;top:${LANDMARKS[key][1]}px`;
      const title = document.createElement('b'); setText(title, 'location.' + key + '.label'); label.append(title);
      if (key === 'great') { const sub = document.createElement('small'); setText(sub, 'location.great.sub'); label.append(sub); }
      layer.append(label);
    }
  }
}

function ready() {
  buildHotspots();
  refreshWorldLanguage();
  home(); syncCanvas(true);
  paper.start();
  const l = document.getElementById('loading'); l.classList.add('ready'); setTimeout(() => l.remove(), 500);
  // warm the night artwork once the day is on screen
  setTimeout(() => paper.preload('night').catch(() => {}), 4000);
}
initLanguage();
refreshWorldLanguage();
document.addEventListener('languagechange', () => { refreshWorldLanguage(); rooms.refreshLanguage(); });
paper.ready.then(ready).catch(() => {
  document.getElementById('loading').innerHTML = '<h1 data-i18n="world.loadError"></h1><p data-i18n="world.loadHint"></p><button class="paper-button" onclick="location.reload()" data-i18n="common.retry"></button>';
  localize(document.getElementById('loading'));
});
addEventListener('resize', () => rooms.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) { rooms.pause(); audio.ctx?.suspend(); } else if (audio.on) audio.ctx?.resume(); });
// handy for tuning scene.json from the console: cabbageland.pokeAt('pets', 0.3)
window.cabbageland = { paper, pokeAt: paper.pokeAt, seek: paper.seek, setPlaying: paper.setPlaying, replay: paper.replay, home };
