import { getSharedAudioContext } from './audio';
import { loadUserSettings } from './settings';

// 自前生成BGMエンジン。
// 音源ファイルは持たず、Web Audio API でチップチューン風の穏やかなループを
// リアルタイム生成する。著作権のある既存曲は使わない。
// 時間帯（朝/昼/夕/夜）と現在の仕事（冒険中かどうか）でゆるく変化する。

export type BgmVariant = 'morning' | 'day' | 'evening' | 'night' | 'adventure';

type Chord = { bass: number; tones: number[] };

type VariantSpec = {
  bpm: number;
  chords: Chord[];
  melodyBase: number;
  scale: number[];
  density: number;
  leadType: OscillatorType;
  leadGain: number;
  filterFreq: number;
  bassSteps: number[];
};

function chord(root: number, minor = false): Chord {
  return { bass: root - 12, tones: [root + 12, root + 12 + (minor ? 3 : 4), root + 19] };
}

const PENTA_MAJOR = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const PENTA_MINOR = [0, 3, 5, 7, 10, 12, 15, 17, 19];

const VARIANTS: Record<BgmVariant, VariantSpec> = {
  morning: {
    bpm: 76,
    chords: [chord(48), chord(43), chord(45, true), chord(41)],
    melodyBase: 72,
    scale: PENTA_MAJOR,
    density: 0.55,
    leadType: 'triangle',
    leadGain: 0.5,
    filterFreq: 3200,
    bassSteps: [0, 8],
  },
  day: {
    bpm: 72,
    chords: [chord(48), chord(41), chord(43), chord(45, true)],
    melodyBase: 72,
    scale: PENTA_MAJOR,
    density: 0.5,
    leadType: 'triangle',
    leadGain: 0.5,
    filterFreq: 3000,
    bassSteps: [0, 8, 12],
  },
  evening: {
    bpm: 68,
    chords: [chord(41), chord(48), chord(38, true), chord(46)],
    melodyBase: 69,
    scale: PENTA_MAJOR,
    density: 0.45,
    leadType: 'sine',
    leadGain: 0.55,
    filterFreq: 2400,
    bassSteps: [0, 8],
  },
  night: {
    bpm: 60,
    chords: [chord(45, true), chord(41), chord(48), chord(43)],
    melodyBase: 69,
    scale: PENTA_MINOR,
    density: 0.32,
    leadType: 'sine',
    leadGain: 0.5,
    filterFreq: 1600,
    bassSteps: [0],
  },
  adventure: {
    bpm: 84,
    chords: [chord(38, true), chord(46), chord(41), chord(48)],
    melodyBase: 74,
    scale: PENTA_MINOR,
    density: 0.6,
    leadType: 'square',
    leadGain: 0.28,
    filterFreq: 2800,
    bassSteps: [0, 4, 8, 12],
  },
};

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let started = false;
let adventureContext = false;
let masterGain: GainNode | null = null;
let masterFilter: BiquadFilterNode | null = null;
let step = 0;
let nextNoteTime = 0;
let melodyIndex = 4;

export function setBgmAdventure(active: boolean) {
  adventureContext = active;
}

function currentVariant(): BgmVariant {
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 5) return 'night';
  if (adventureContext) return 'adventure';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

function targetVolume() {
  const { bgm } = loadUserSettings();
  if (bgm <= 0) return 0;
  // 知覚音量に寄せたカーブ。最大でも控えめに。
  return Math.pow(bgm / 100, 1.6) * 0.32;
}

function applyVolume(instant = false) {
  const ctx = getSharedAudioContext();
  if (!ctx || !masterGain) return;
  const value = targetVolume();
  if (instant) {
    masterGain.gain.setValueAtTime(value, ctx.currentTime);
  } else {
    masterGain.gain.setTargetAtTime(value, ctx.currentTime, 0.4);
  }
}

function note(ctx: AudioContext, time: number, midi: number, duration: number, gainValue: number, type: OscillatorType, attack = 0.01) {
  if (!masterFilter) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(midi), time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(masterFilter);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function scheduleStep(ctx: AudioContext, globalStep: number, time: number) {
  const variant = VARIANTS[currentVariant()];
  const stepInBar = globalStep % 16;
  const bar = Math.floor(globalStep / 16);
  const chordNow = variant.chords[bar % variant.chords.length];
  const stepDur = 60 / variant.bpm / 4;

  if (stepInBar === 0) {
    // パッド: 小節頭にコードを柔らかく敷く。
    chordNow.tones.forEach((toneNote) => {
      note(ctx, time, toneNote, stepDur * 16, 0.05, 'triangle', 0.6);
    });
    if (masterFilter) {
      masterFilter.frequency.setTargetAtTime(variant.filterFreq, time, 0.8);
    }
  }
  if (variant.bassSteps.includes(stepInBar)) {
    note(ctx, time, chordNow.bass, stepDur * 6, 0.16, 'sine');
  }

  // メロディ: バー単位でシードを変える決定論的ランダムウォーク。
  // 8分音符位置を中心に置き、4小節目の終わりは休ませる。
  const loopCount = Math.floor(bar / 4);
  const phraseEnd = bar % 4 === 3 && stepInBar >= 12;
  const rng = mulberry32(bar * 7919 + loopCount * 131 + 17);
  // このステップまでに消費する乱数を進める（ステップ位置で再現性を保つ）。
  let roll = 0;
  for (let i = 0; i <= stepInBar; i += 1) roll = rng();
  const onGrid = stepInBar % 2 === 0;
  const shouldPlay = !phraseEnd && onGrid && roll < variant.density;
  if (shouldPlay) {
    const walk = Math.floor(rng() * 5) - 2;
    melodyIndex = Math.min(variant.scale.length - 1, Math.max(0, melodyIndex + walk));
    const midi = variant.melodyBase + variant.scale[melodyIndex];
    note(ctx, time, midi, stepDur * 3.2, 0.14 * variant.leadGain * 2, variant.leadType);
    // たまにオクターブ上のきらめきを添える。
    if (rng() < 0.12) {
      note(ctx, time + stepDur, midi + 12, stepDur * 2, 0.05, 'sine');
    }
  }
}

function schedulerTick() {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const variant = VARIANTS[currentVariant()];
  const stepDur = 60 / variant.bpm / 4;
  while (nextNoteTime < ctx.currentTime + 0.45) {
    scheduleStep(ctx, step, nextNoteTime);
    nextNoteTime += stepDur;
    step += 1;
  }
}

function start() {
  if (started) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  started = true;
  masterFilter = ctx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.setValueAtTime(3000, ctx.currentTime);
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterFilter.connect(masterGain);
  masterGain.connect(ctx.destination);
  applyVolume();
  // フェードイン。
  masterGain.gain.setTargetAtTime(targetVolume(), ctx.currentTime, 1.2);
  if (ctx.state === 'suspended') void ctx.resume();
  step = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  window.setInterval(schedulerTick, 200);
}

export function initBgm() {
  if (typeof window === 'undefined') return;
  const kick = () => start();
  // ブラウザの自動再生制限: 初回のユーザー操作までは鳴らさない。
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });
  window.addEventListener('yuusha:settings-changed', () => applyVolume());
  document.addEventListener('visibilitychange', () => {
    const ctx = getSharedAudioContext();
    if (!ctx || !started) return;
    if (document.hidden) {
      void ctx.suspend();
    } else if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  });
}
