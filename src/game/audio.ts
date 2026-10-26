import type { FeedbackEventType } from '../types';
import { loadUserSettings } from './settings';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext ||= new AudioCtor();
  return audioContext;
}

function tone(ctx: AudioContext, start: number, frequency: number, duration: number, gainValue: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function getSharedAudioContext() {
  return getAudioContext();
}

export type UiSoundKind = 'click' | 'next' | 'open' | 'buy' | 'achievement';

export function playUiSound(kind: UiSoundKind) {
  const settings = loadUserSettings();
  if (settings.se <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const volume = Math.min(0.18, Math.max(0, settings.se / 100) * 0.16);
  const now = ctx.currentTime + 0.01;

  if (kind === 'click') {
    tone(ctx, now, 880, 0.05, volume * 0.5, 'triangle');
    return;
  }
  if (kind === 'next') {
    // ぼやき「次へ」: 紙をめくるような、柔らかい2音。
    tone(ctx, now, 520, 0.06, volume * 0.55, 'sine');
    tone(ctx, now + 0.05, 700, 0.07, volume * 0.5, 'sine');
    return;
  }
  if (kind === 'open') {
    tone(ctx, now, 440, 0.06, volume * 0.5, 'triangle');
    tone(ctx, now + 0.05, 660, 0.07, volume * 0.5, 'triangle');
    return;
  }
  if (kind === 'buy') {
    tone(ctx, now, 740, 0.06, volume * 0.7, 'square');
    tone(ctx, now + 0.06, 1180, 0.09, volume * 0.6, 'triangle');
    return;
  }
  if (kind === 'achievement') {
    tone(ctx, now, 659, 0.1, volume * 0.85, 'triangle');
    tone(ctx, now + 0.09, 880, 0.12, volume * 0.9, 'triangle');
    tone(ctx, now + 0.2, 1318, 0.18, volume * 0.8, 'triangle');
  }
}

export function playFeedbackSound(type: FeedbackEventType) {
  const settings = loadUserSettings();
  if (settings.se <= 0) return;
  const soundType = settings.simplifiedComboSe && (type === 'multiReward' || type === 'sale') ? 'workComplete' : type;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const volume = Math.min(0.18, Math.max(0, settings.se / 100) * 0.16);
  const now = ctx.currentTime + 0.01;

  if (soundType === 'workComplete') {
    tone(ctx, now, 740, 0.08, volume);
    return;
  }
  if (soundType === 'multiReward') {
    tone(ctx, now, 660, 0.07, volume);
    tone(ctx, now + 0.075, 880, 0.08, volume * 0.92);
    return;
  }
  if (soundType === 'sale') {
    tone(ctx, now, 620, 0.07, volume);
    tone(ctx, now + 0.055, 820, 0.07, volume);
    tone(ctx, now + 0.11, 1040, 0.09, volume * 0.9);
    return;
  }
  if (soundType === 'rareDrop') {
    tone(ctx, now, 980, 0.11, volume * 0.8, 'triangle');
    tone(ctx, now + 0.09, 1320, 0.14, volume, 'triangle');
    return;
  }
  if (soundType === 'equipmentDrop') {
    tone(ctx, now, 440, 0.08, volume * 0.85, 'square');
    tone(ctx, now + 0.08, 880, 0.12, volume, 'triangle');
    return;
  }
  if (soundType === 'legendaryDrop') {
    tone(ctx, now, 523, 0.12, volume, 'triangle');
    tone(ctx, now + 0.11, 784, 0.14, volume, 'triangle');
    tone(ctx, now + 0.24, 1175, 0.2, volume * 0.9, 'triangle');
    return;
  }
  if (soundType === 'adventureSuccess') {
    tone(ctx, now, 523, 0.1, volume * 0.8);
    tone(ctx, now + 0.09, 659, 0.1, volume * 0.8);
    tone(ctx, now + 0.18, 784, 0.13, volume * 0.9);
    return;
  }
  if (soundType === 'adventureStart') {
    tone(ctx, now, 520, 0.07, volume * 0.72, 'triangle');
    tone(ctx, now + 0.06, 680, 0.08, volume * 0.72, 'triangle');
    return;
  }
  if (soundType === 'failure') {
    tone(ctx, now, 220, 0.11, volume * 0.65, 'sine');
    return;
  }
  if (soundType === 'levelUp') {
    // レベルアップ: 小さなファンファーレ（ド・ミ・ソ・ド）。
    tone(ctx, now, 523, 0.09, volume * 0.85, 'triangle');
    tone(ctx, now + 0.08, 659, 0.09, volume * 0.85, 'triangle');
    tone(ctx, now + 0.16, 784, 0.1, volume * 0.9, 'triangle');
    tone(ctx, now + 0.26, 1046, 0.18, volume, 'triangle');
    return;
  }
  if (soundType === 'battleLose') {
    // 撤退: しょんぼり下降2音。敗北ではなく引き継ぎ、の軽さで。
    tone(ctx, now, 392, 0.12, volume * 0.6, 'sine');
    tone(ctx, now + 0.11, 311, 0.17, volume * 0.55, 'sine');
    return;
  }
  if (soundType === 'chestOpen') {
    // 宝箱: カチッという留め金 + 蓋のきしみ。この直後にドロップ音が重なる。
    tone(ctx, now, 1560, 0.04, volume * 0.5, 'square');
    tone(ctx, now + 0.06, 300, 0.1, volume * 0.35, 'sawtooth');
    tone(ctx, now + 0.06, 452, 0.12, volume * 0.3, 'sawtooth');
    return;
  }
  if (soundType === 'retire') {
    // 引退: 区切りの鐘。穏やかに長く鳴らす。
    tone(ctx, now, 392, 0.5, volume * 0.8, 'sine');
    tone(ctx, now, 784, 0.4, volume * 0.4, 'sine');
    tone(ctx, now + 0.3, 523, 0.5, volume * 0.7, 'sine');
    tone(ctx, now + 0.3, 1046, 0.35, volume * 0.3, 'sine');
    tone(ctx, now + 0.65, 659, 0.6, volume * 0.6, 'triangle');
  }
}
