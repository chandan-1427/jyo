// Synthesised with Web Audio, so there are no sound files to download. Only
// on devices with a mouse or trackpad: phone keyboards already click and
// buzz on every key.

export type TypingSound =
  | "key" | "digit" | "digit-delete" | "space" | "delete" | "reveal" | "conceal" | "check" | "uncheck" | "radio" | "button";

const supported = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// A click is band-passed noise (the tick) over a sine sliding from `body`
// to `body * bodyTo` (the thump). Every digit gets the same voice: a pitch
// per digit, like a phone keypad, would let anyone nearby hear the number.
type Voice = { band: number; q: number; decay: number; gain: number; body: number; bodyTo?: number };

const VOICES: Record<Exclude<TypingSound, "reveal" | "conceal" | "button">, Voice> = {
  key: { band: 3000, q: 0.9, decay: 0.035, gain: 0.32, body: 190 },
  space: { band: 1500, q: 0.7, decay: 0.05, gain: 0.3, body: 120 },
  delete: { band: 2100, q: 1.1, decay: 0.04, gain: 0.26, body: 150 },
  digit: { band: 3900, q: 1.3, decay: 0.028, gain: 0.3, body: 240 },
  "digit-delete": { band: 2800, q: 1.3, decay: 0.032, gain: 0.26, body: 190 },
  radio: { band: 2300, q: 0.9, decay: 0.045, gain: 0.46, body: 170, bodyTo: 1.3 },
  check: { band: 3500, q: 1.2, decay: 0.03, gain: 0.32, body: 210, bodyTo: 1.5 },
  uncheck: { band: 2700, q: 1.2, decay: 0.03, gain: 0.26, body: 210, bodyTo: 0.45 },
};

// Timed to the password flip's sweep.
const FLAP: Voice = { band: 2400, q: 1.6, decay: 0.022, gain: 0.2, body: 0 };
const FLAPS = 4;
const FLAP_GAP = 0.03;
const FLAP_STEP = 1.18;

const MIN_GAP_MS = 18;

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastPlayed = 0;

function audio() {
  if (!context) {
    if (typeof AudioContext === "undefined") return null;
    context = new AudioContext();
    noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.08), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

export function playTypingSound(kind: TypingSound) {
  if (!supported()) return;
  const now = performance.now();
  if (now - lastPlayed < MIN_GAP_MS) return;
  lastPlayed = now;

  const ctx = audio();
  if (!ctx || !noise) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.35;
  out.connect(ctx.destination);

  if (kind === "reveal" || kind === "conceal") {
    for (let i = 0; i < FLAPS; i++) {
      const pitch = FLAP_STEP ** (kind === "reveal" ? i : FLAPS - 1 - i);
      const gain = FLAP.gain * (i === FLAPS - 1 ? 1.3 : 0.8);
      click(ctx, noise, out, t + i * FLAP_GAP, { ...FLAP, gain }, pitch * (0.97 + Math.random() * 0.06));
    }
    return;
  }

  if (kind === "button") {
    press(ctx, noise, out, t);
    return;
  }

  click(ctx, noise, out, t, VOICES[kind], 0.9 + Math.random() * 0.2);
}

function press(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number) {
  const base = 440 * (0.97 + Math.random() * 0.06);
  const layers = [
    { from: base, gain: 0.95, decay: 0.07 },
    { from: base * 2, gain: 0.3, decay: 0.03 },
  ];
  for (const layer of layers) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(layer.from, t);
    osc.frequency.exponentialRampToValueAtTime(layer.from * 0.5, t + 0.03);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(layer.gain, t + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, t + layer.decay);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + layer.decay + 0.02);
  }
  click(ctx, noise, out, t, { band: 3200, q: 1.4, decay: 0.012, gain: 0.5, body: 0 }, 1);
}

function click(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number, voice: Voice, vary: number) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = voice.band * vary;
  filter.Q.value = voice.q;
  const tick = ctx.createGain();
  tick.gain.setValueAtTime(0, t);
  tick.gain.linearRampToValueAtTime(voice.gain, t + 0.002);
  tick.gain.exponentialRampToValueAtTime(0.0001, t + voice.decay);
  source.connect(filter).connect(tick).connect(out);
  source.start(t);
  source.stop(t + voice.decay + 0.02);

  if (voice.body) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(voice.body * vary, t);
    osc.frequency.exponentialRampToValueAtTime(voice.body * vary * (voice.bodyTo ?? 0.6), t + 0.03);
    const length = Math.max(0.035, voice.decay);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0, t);
    body.gain.linearRampToValueAtTime(voice.gain * 0.5, t + 0.002);
    body.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(body).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.015);
  }
}
