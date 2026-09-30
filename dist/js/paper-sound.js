// Little paper sounds: a music box that follows the gramophone's notes, the odd bird, and click effects.
// Everything plays only while the visitor has turned sound on (the stream button in the header).
const L = 12;
const MELODY = [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 77, 0, 76, 0, 72, 0, 69, 0, 72, 0, 74, 0, 71, 0, 67, 0, 74, 0];
const BASS = { 0: 48, 8: 53, 16: 45, 24: 43 };
const STEP = L / MELODY.length;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createPaperSound(audio) {
  let master = null, lastStep = -1, nextChirp = 0;
  const live = () => audio.on && audio.ctx && audio.ctx.state === 'running';
  function out() {
    if (!master || master.context !== audio.ctx) { master = audio.ctx.createGain(); master.gain.value = 0.85; master.connect(audio.ctx.destination); }
    return master;
  }
  function tone(freq, when, dur, gain, type = 'sine', to) {
    const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, when);
    if (to) o.frequency.exponentialRampToValueAtTime(to, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out()); o.start(when); o.stop(when + dur + 0.05);
  }
  function musicBox(m, when, gain = 0.05) {
    const f = mtof(m);
    tone(f, when, 1.4, gain); tone(f * 2, when, 0.7, gain * 0.28); tone(f * 4, when, 0.25, gain * 0.08);
  }
  function noise(when, dur, freq, gain, q = 0.8) {
    const ctx = audio.ctx, n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(out()); s.start(when);
  }
  const effects = {
    flap(n) { noise(n, 0.07, 1700, 0.5, 1.4); tone(150, n, 0.06, 0.06, 'sine', 90); },
    boing(n) { tone(240, n, 0.45, 0.2, 'sine', 90); tone(360, n + 0.02, 0.3, 0.05, 'triangle', 140); },
    jelly(n) {
      const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(260, n); o.frequency.exponentialRampToValueAtTime(640, n + 0.14); o.frequency.exponentialRampToValueAtTime(240, n + 0.55);
      lfo.frequency.value = 13; lg.gain.value = 45; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.14, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.62);
      o.connect(g).connect(out()); o.start(n); lfo.start(n); o.stop(n + 0.66); lfo.stop(n + 0.66);
    },
    dino(n) { tone(520, n + 0.12, 0.16, 0.06, 'triangle', 780); tone(700, n + 0.28, 0.2, 0.05, 'triangle', 460); },
    beep(n) { [0, 1].forEach((i) => tone(1180 + i * 420, n + 0.1 + i * 0.1, 0.09, 0.04, 'square')); },
    chirp(n) { const base = 2700 + Math.random() * 500; [0, 1, 2].forEach((i) => tone(base, n + i * 0.11, 0.08, 0.035, 'sine', base * 1.4)); },
    run(n) { [72, 76, 79, 84, 79, 81, 84].forEach((m, i) => musicBox(m, n + i * 0.09, 0.06)); },
    splash(n) { noise(n, 0.35, 2400, 0.3); },
    chime(n) { [84, 88, 91, 96].forEach((m, i) => tone(mtof(m), n + i * 0.07, 0.9, 0.045)); },
    blip(n) { [0, 1, 2].forEach((i) => tone(880 + i * 330, n + i * 0.08, 0.07, 0.03, 'square')); },
    pop(n) { [0, 1, 2].forEach((i) => tone(700 - i * 90, n + i * 0.07, 0.12, 0.1, 'sine', 180)); },
    tick(n) { noise(n, 0.06, 3200, 0.2); },
  };
  // tick(tq): called every frame with the loop time; plays the music box in step with the gramophone's notes
  function tick(tq, playing) {
    const step = Math.floor(tq / STEP) % MELODY.length;
    if (!live() || !playing) { lastStep = step; return; }
    const now = performance.now();
    if (step !== lastStep && lastStep !== -1) {
      const n = audio.ctx.currentTime + 0.02;
      if (MELODY[step]) musicBox(MELODY[step], n, 0.035);
      if (BASS[step]) musicBox(BASS[step], n, 0.03);
    }
    lastStep = step;
    if (now > nextChirp) {
      if (nextChirp) effects.chirp(audio.ctx.currentTime);
      nextChirp = now + 6000 + Math.random() * 9000;
    }
  }
  return function sfx(name, ...args) {
    if (name === 'tick' && args.length) { tick(args[0], args[1]); return; }
    if (!live() || !effects[name]) return;
    effects[name](audio.ctx.currentTime);
  };
}
