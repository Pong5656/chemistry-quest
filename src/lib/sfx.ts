/** เสียงเกม 8-bit สังเคราะห์ด้วย WebAudio (ไม่ต้องโหลดไฟล์) */
let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem("chemquest.muted") === "1";
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem("chemquest.muted", muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!muted) beep(660, 0.06, "square", 0.05);
  return muted;
}

function beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function slide(f1: number, f2: number, dur: number, type: OscillatorType = "sawtooth", vol = 0.07) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click: () => beep(520, 0.05, "square", 0.05),
  back: () => beep(300, 0.06, "square", 0.05),
  hover: () => beep(880, 0.02, "sine", 0.02),
  type: () => beep(1200 + Math.random() * 200, 0.015, "square", 0.015),
  coin: () => {
    beep(988, 0.06, "square", 0.06);
    beep(1319, 0.14, "square", 0.06, 0.06);
  },
  jump: () => slide(340, 720, 0.16, "square", 0.05),
  land: () => beep(180, 0.05, "triangle", 0.05),
  hurt: () => slide(420, 90, 0.28, "sawtooth", 0.08),
  correct: () => {
    beep(659, 0.09, "square", 0.07);
    beep(784, 0.09, "square", 0.07, 0.09);
    beep(1047, 0.2, "square", 0.07, 0.18);
  },
  wrong: () => {
    beep(233, 0.16, "sawtooth", 0.07);
    beep(155, 0.3, "sawtooth", 0.07, 0.15);
  },
  bossHit: () => slide(700, 120, 0.22, "square", 0.08),
  waveStart: () => {
    beep(392, 0.1, "square", 0.06);
    beep(523, 0.1, "square", 0.06, 0.1);
    beep(659, 0.1, "square", 0.06, 0.2);
    beep(784, 0.26, "square", 0.07, 0.3);
  },
  fanfare: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.22, "square", 0.07, i * 0.11));
  },
  gameOver: () => {
    [392, 349, 311, 262].forEach((f, i) => beep(f, 0.28, "triangle", 0.08, i * 0.16));
  },
  unlock: () => {
    [784, 988, 1175].forEach((f, i) => beep(f, 0.14, "square", 0.06, i * 0.08));
  },
};
