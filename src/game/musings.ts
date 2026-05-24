import type { GameState, Musing, MusingType } from '../types';

const QUEUE_LIMIT = 20;
const RECENT_LIMIT = 10;
const AMBIENT_TYPES: MusingType[] = ['idle', 'daily'];
const CERTAIN_TYPES: MusingType[] = ['event', 'firstTime', 'failure', 'milestone'];

export const MUSING_PRIORITY: Record<MusingType, number> = {
  failure: 70,
  event: 60,
  firstTime: 50,
  milestone: 40,
  state: 30,
  idle: 20,
  daily: 10,
};

export const MUSING_LABELS: Record<MusingType, string> = {
  event: '出来事',
  firstTime: '初回',
  failure: '失敗',
  milestone: '節目',
  state: '状態',
  idle: '時間経過',
  daily: '日常',
};

function getMusingKey(musing: Musing) {
  return musing.id || `${musing.eventType || 'event'}:${musing.eventSubType || musing.category || 'misc'}:${musing.text}`;
}

function normalizeMusing(musing: Musing): Musing {
  const eventType = musing.eventType || 'event';
  return {
    ...musing,
    eventType,
    category: musing.category || eventType,
    priority: musing.priority ?? MUSING_PRIORITY[eventType],
    claimed: musing.claimed ?? true,
  };
}

function canEnqueue(prev: GameState, musing: Musing, now: number) {
  const key = getMusingKey(musing);
  const isAmbient = AMBIENT_TYPES.includes(musing.eventType || 'event');
  if (!isAmbient && (prev.seenMusingIds || []).includes(key)) return false;
  if (musing.once && (prev.seenMusingIds || []).includes(key)) return false;
  if ((prev.recentMusingIds || []).includes(key)) return false;
  const cooldownKey = musing.conditionKey || key;
  const availableAt = (prev.musingCooldowns || {})[cooldownKey] || 0;
  if (availableAt > now) return false;
  if (isAmbient) {
    if ((prev.lastAmbientMusingAt || 0) + 30_000 > now) return false;
    if ((prev.lastCertainMusingAt || 0) + 10_000 > now) return false;
  }
  return true;
}

function sortQueue(queue: Musing[]) {
  return [...queue].sort((a, b) => (b.priority ?? MUSING_PRIORITY[b.eventType || 'event']) - (a.priority ?? MUSING_PRIORITY[a.eventType || 'event']));
}

export function enqueueMusing(prev: GameState, rawMusing: Musing, options: { prepend?: boolean; now?: number } = {}) {
  const now = options.now ?? Date.now();
  const musing = normalizeMusing(rawMusing);
  if (!canEnqueue(prev, musing, now)) return { state: prev, accepted: false, musing };

  const key = getMusingKey(musing);
  const cooldownKey = musing.conditionKey || key;
  const cooldownSec = musing.cooldownSec || (musing.eventType === 'failure' ? 5 : 0);
  const queue = options.prepend
    ? [musing, ...(prev.musingQueue || [])]
    : [...(prev.musingQueue || []), musing];

  const next: GameState = {
    ...prev,
    musingQueue: sortQueue(queue).slice(0, QUEUE_LIMIT),
    seenMusingIds: Array.from(new Set([...(prev.seenMusingIds || []), key])),
    recentMusingIds: [key, ...(prev.recentMusingIds || []).filter((id) => id !== key)].slice(0, RECENT_LIMIT),
    musingCooldowns: cooldownSec > 0
      ? { ...(prev.musingCooldowns || {}), [cooldownKey]: now + cooldownSec * 1000 }
      : prev.musingCooldowns || {},
    lastAmbientMusingAt: AMBIENT_TYPES.includes(musing.eventType || 'event') ? now : prev.lastAmbientMusingAt,
    lastCertainMusingAt: CERTAIN_TYPES.includes(musing.eventType || 'event') ? now : prev.lastCertainMusingAt,
  };

  return { state: next, accepted: true, musing };
}

export function enqueueManyMusings(prev: GameState, musings: Musing[], options: { now?: number } = {}) {
  return musings.reduce((result, musing) => enqueueMusing(result.state, musing, options), { state: prev, accepted: false, musing: undefined as Musing | undefined });
}
