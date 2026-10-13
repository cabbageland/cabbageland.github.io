// The gallery viewer: one work at a time, large, with its label and Tracy's note beside it.
// A set shows its pictures one by one (little frames under the note switch between them); a book shows its cover and opens the reader.
import { setText, setAttributeText } from './i18n.js';

export function createViewer({ onBook }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('viewer'), art = $('viewer-art');
  let works = [], at = 0, part = 0;   // the works being paged through, which one, and which picture of a set

  const key = (w) => `portfolio.${w.id}`;
  const file = (w, n) => (w.kind ? `${w.id}-${n + 1}` : w.id);
  function picture(w, n) {
    const [fw] = w.kind === 'set' ? w.images[n] : [w.w], img = document.createElement('img');
    img.className = 'viewer-picture';
    img.src = `./art/portfolio/m/${file(w, n)}.webp`;
    if (w.mw < fw) { img.srcset = `./art/portfolio/m/${file(w, n)}.webp ${w.mw}w, ./art/portfolio/${file(w, n)}.webp ${fw}w`; img.sizes = '(min-width: 900px) 62vw, 96vw'; }
    setAttributeText(img, 'alt', `${key(w)}.alt`, w.kind === 'set' ? { n: n + 1 } : {});
    return img;
  }
  function showArt() {
    const w = works[at];
    if (w.kind === 'book') {
      // the cover is the first spread; a click opens the book
      const cover = document.createElement('button');
      cover.type = 'button'; cover.className = 'gallery-frame book-cover';
      setAttributeText(cover, 'aria-label', 'book.open');
      for (const n of [0, 1]) { const i = document.createElement('img'); i.src = `./art/portfolio/m/${file(w, n)}.webp`; i.alt = ''; [i.width, i.height] = w.pages[n]; cover.append(i); }
      cover.onclick = () => onBook(w);
      art.replaceChildren(cover);
    } else art.replaceChildren(picture(w, part));
    $('viewer-full').hidden = w.kind === 'book';
    if (w.kind !== 'book') $('viewer-full').href = `./art/portfolio/${file(w, part)}.webp`;
    [...$('viewer-set').children].forEach((b, i) => b.setAttribute('aria-current', String(i === part)));
  }
  function show(i) {
    at = (i + works.length) % works.length; part = 0;
    const w = works[at], k = key(w);
    setText($('viewer-title'), `${k}.title`);
    $('viewer-meta').hidden = !w.meta; if (w.meta) setText($('viewer-meta'), `${k}.meta`);
    $('viewer-note').hidden = !w.note; if (w.note) setText($('viewer-note'), `${k}.note`);
    setText($('viewer-count'), 'viewer.count', { n: at + 1, total: works.length });
    $('viewer-prev').disabled = $('viewer-next').disabled = works.length < 2;
    $('viewer-book').hidden = w.kind !== 'book';
    const set = $('viewer-set'); set.hidden = w.kind !== 'set'; set.replaceChildren();
    if (w.kind === 'set') w.images.forEach((_, n) => {
      const b = document.createElement('button'), t = document.createElement('img');
      b.type = 'button'; b.className = 'gallery-frame'; setAttributeText(b, 'aria-label', 'viewer.picture', { n: n + 1, total: w.images.length });
      t.src = `./art/portfolio/s/${file(w, n)}.webp`; t.alt = ''; b.append(t);
      b.onclick = () => { part = n; showArt(); };
      set.append(b);
    });
    showArt();
    dialog.querySelector('.viewer-caption').scrollTop = 0;
    const next = works[(at + 1) % works.length];   // have the next work ready
    if (next !== w && next.kind !== 'book') new Image().src = `./art/portfolio/m/${file(next, 0)}.webp`;
  }

  $('viewer-prev').onclick = () => show(at - 1);
  $('viewer-next').onclick = () => show(at + 1);
  $('viewer-close').onclick = () => dialog.close();
  $('viewer-book').onclick = () => onBook(works[at]);
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  return {
    // list = the works the wall is showing (all of them or one group), i = the one that was clicked
    open(list, i) {
      works = list;
      show(i);
      if (!dialog.open) dialog.showModal();
      $('viewer-next').focus({ preventScroll: true });
    },
  };
}
