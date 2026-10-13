// A little paper book you can page through: an open spread on wide screens, one page at a time on narrow ones.
// Pages turn like stop-motion paper (a leaf swings over the spine in a few steps), chapters jump to where each one starts.
import { setText, setAttributeText } from './i18n.js';

const PAGE_RATIO = 3 / 4;          // every page sits in a 3:4 sheet, whatever the scan's exact shape
const TURN_MS = 560;

export function createBook() {
  const $ = (id) => document.getElementById(id);
  const dialog = $('book'), stage = $('book-stage'), volume = $('book-volume'), leaf = $('book-leaf');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let work = null, page = 0, single = false, narrow = false, turning = null;

  const total = () => work.pages.length;
  const src = (n) => `./art/portfolio/${work.id}-${n + 1}.webp`;
  const spread = () => !single && !narrow;
  const chapterOf = (p) => work.chapters.reduce((found, start, i) => (start - 1 <= p ? i : found), 0);
  function show(img, n) {
    const sheet = img.closest('.book-page, .face');
    if (n < 0 || n >= total()) { img.removeAttribute('src'); img.alt = ''; sheet?.classList.add('blank'); return; }
    sheet?.classList.remove('blank');
    img.src = src(n);
    setAttributeText(img, 'alt', `portfolio.${work.id}.alt`, { n: n + 1 });
  }

  // the volume is sized by hand: two sheets side by side that fit the stage, or one sheet as wide as is comfortable to read
  function layout() {
    if (!work) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const wasSpread = spread();
    narrow = w < 780;
    dialog.classList.toggle('single', !spread());
    $('book-mode').hidden = narrow;
    if (spread()) {
      const sheetH = Math.max(200, Math.min(h - 28, (w - 150) / 2 / PAGE_RATIO));
      volume.style.height = `${sheetH}px`; volume.style.width = `${sheetH * PAGE_RATIO * 2}px`;
      if (!wasSpread) page -= page % 2;
    } else {
      const sheetW = Math.min(w - (narrow ? 20 : 150), 920);
      volume.style.width = `${sheetW}px`; volume.style.height = `${sheetW / PAGE_RATIO}px`;
    }
    draw();
  }

  function draw() {
    if (spread()) { show($('book-left'), page); show($('book-right'), page + 1); } else { show($('book-left'), page); }
    const last = spread() ? page + 2 >= total() : page + 1 >= total();
    $('book-prev').disabled = page === 0; $('book-next').disabled = last;
    if (spread()) setText($('book-count'), 'book.pages', { a: page + 1, b: Math.min(total(), page + 2), total: total() });
    else setText($('book-count'), 'book.page', { n: page + 1, total: total() });
    const chapter = chapterOf(page);
    [...$('book-chapters').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === chapter)));
    setText($('book-mode'), single ? 'book.spread' : 'book.single');
    $('book-mode').setAttribute('aria-pressed', String(single));
    for (const n of [page + 2, page + 3]) if (n < total()) new Image().src = src(n);   // the next pages, ready before they are turned to
  }

  function finishTurn() {
    if (!turning) return;
    clearTimeout(turning.timer);
    page = turning.to; turning = null;
    leaf.hidden = true; leaf.classList.remove('turn'); leaf.style.transform = '';
    draw();
  }
  function go(to) {
    const step = spread() ? 2 : 1;
    to = Math.max(0, Math.min(total() - 1, to));
    if (spread()) to -= to % 2;
    if (turning) finishTurn();
    if (to === page) return;
    if (!spread() || reduceMotion || Math.abs(to - page) !== step) {
      page = to; draw();
      if (!reduceMotion) { volume.classList.remove('settle'); void volume.offsetWidth; volume.classList.add('settle'); }
      if (!spread()) stage.scrollTop = 0;
      return;
    }
    // a leaf carries the outgoing page over the spine: its front is the page leaving, its back the page arriving
    const forward = to > page;
    show($('leaf-front'), forward ? page + 1 : to + 1);
    show($('leaf-back'), forward ? to : page);
    if (forward) show($('book-right'), to + 1); else show($('book-left'), to);
    leaf.hidden = false;
    leaf.style.transform = `rotateY(${forward ? 0 : -180}deg)`;
    void leaf.offsetWidth;
    leaf.classList.add('turn');
    leaf.style.transform = `rotateY(${forward ? -180 : 0}deg)`;
    turning = { to, timer: setTimeout(finishTurn, TURN_MS + 120) };
  }
  const next = () => go(page + (spread() ? 2 : 1)), prev = () => go(page - (spread() ? 2 : 1));

  leaf.addEventListener('transitionend', finishTurn);
  $('book-prev').onclick = prev; $('book-next').onclick = next;
  $('book-close').onclick = () => dialog.close();
  $('book-mode').onclick = () => { if (turning) finishTurn(); single = !single; layout(); stage.scrollTop = 0; };
  // click the right-hand page (or the right side of a single page) to go on, the left to go back
  volume.addEventListener('click', (e) => {
    const r = volume.getBoundingClientRect();
    if (e.clientX - r.left > r.width * (spread() ? 0.5 : 0.3)) next(); else prev();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total() - 1); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (turning) finishTurn(); });
  new ResizeObserver(layout).observe(stage);
  addEventListener('resize', layout);

  return {
    open(w) {
      if (!w) return;
      work = w; page = 0; single = false;
      setText($('book-title'), `portfolio.${w.id}.title`);
      const chapters = $('book-chapters'); chapters.replaceChildren();
      w.chapters.forEach((start, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'paper-button'; setText(b, `book.chapter${i + 1}`);
        b.onclick = () => go(start - 1);
        chapters.append(b);
      });
      if (!dialog.open) dialog.showModal();
      layout();
      $('book-next').focus({ preventScroll: true });
    },
  };
}
