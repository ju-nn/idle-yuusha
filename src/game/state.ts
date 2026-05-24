import type { GameState, Job, Musing } from '../types';
import { checkRequirement } from './requirements';
import { TICK_INTERVAL_MS } from './timing';
import { runTick } from './tick';

export const SAVE_KEY = 'yuusha-does-not-want-to-work-codex-handoff-v1';

export const introMusing: Musing = {
  id: 'intro_001',
  job: '勇者',
  area: 'はじまりの部屋',
  category: 'firstTime',
  eventType: 'firstTime',
  eventSubType: 'tutorial_intro',
  once: true,
  text: `勇者「金がない。働くのも面倒だし、無料で食い物を手に入れたい……まぁ釣りでもするか」\n\n→ 最初の出来事で、釣りをする決意が生まれました。『次へ』で読み進めましょう。`,
  rewardItems: [{ item: 'resolve_to_fish', amount: 1 }],
};

export function makeJobData(jobs: Record<string, Job>) {
  return Object.fromEntries(Object.keys(jobs).map((key) => [key, { level: 1, xp: 0, seenMusings: [] as string[] }]));
}

export function createInitialState(jobs: Record<string, Job>): GameState {
  return {
    activeJob: 'fishing',
    activeArea: 'pond',
    tick: 0,
    gold: 40,
    hp: 80,
    maxHp: 100,
    mp: 60,
    maxMp: 80,
    resources: { fish: 0, wood: 0, ore: 0 },
    items: { resolve_to_fish: 1 },
    jobData: makeJobData(jobs),
    currentMusing: introMusing,
    readMusings: [],
    musingQueue: [],
    eventLog: ['出来事報酬：釣りをする決意+1', 'まずは導入ぼやきを読みましょう。最初の出来事で釣りをする決意が生まれました。'],
    combatLog: [],
    farming: { plantedAt: null, cropId: null, readyAt: null },
    tutorialStep: 'intro',
    achievements: [],
    progressBreaking: false,
    inCombat: false,
    currentMonster: null,
    monsterHp: 0,
    visitedAreas: [],
    defeatedMonsters: [],
    unlockedJobs: ['fishing'],
    seenMusingIds: ['intro_001'],
    recentMusingIds: ['intro_001'],
    musingCooldowns: {},
    lastAmbientMusingAt: undefined,
    lastCertainMusingAt: Date.now(),
    lastSavedAt: Date.now(),
  };
}

function applyOfflineProgress(state: GameState): GameState {
  const now = Date.now();
  const savedAt = state.lastSavedAt || now;
  const elapsedMs = Math.max(0, now - savedAt);
  const offlineTicks = Math.min(720, Math.floor(elapsedMs / TICK_INTERVAL_MS));
  if (offlineTicks < 3) return { ...state, lastSavedAt: now };

  let next = state;
  for (let i = 0; i < offlineTicks; i += 1) {
    next = runTick(next);
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);
  const elapsedText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  return {
    ...next,
    lastSavedAt: now,
    eventLog: [
      `不在中の進行：${elapsedText}ぶん生活が少し進んだ。勇者「見てない間に進む成果、性格がいい」`,
      ...(next.eventLog || []),
    ].slice(0, 24),
  };
}

export function loadState(initialState: GameState): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved);
    const next = {
      ...initialState,
      ...parsed,
      resources: { ...initialState.resources, ...(parsed.resources || {}) },
      items: { ...(parsed.items || {}) },
      jobData: { ...initialState.jobData, ...(parsed.jobData || {}) },
      farming: { ...initialState.farming, ...(parsed.farming || {}) },
      combatLog: parsed.combatLog || [],
      achievements: parsed.achievements || [],
      inCombat: parsed.inCombat || false,
      currentMonster: parsed.currentMonster || null,
      monsterHp: parsed.monsterHp || 0,
      visitedAreas: parsed.visitedAreas || [],
      defeatedMonsters: parsed.defeatedMonsters || [],
      unlockedJobs: [],
      seenMusingIds: parsed.seenMusingIds || [],
      recentMusingIds: parsed.recentMusingIds || [],
      musingCooldowns: parsed.musingCooldowns || {},
      lastAmbientMusingAt: parsed.lastAmbientMusingAt,
      lastCertainMusingAt: parsed.lastCertainMusingAt,
      lastSavedAt: parsed.lastSavedAt || Date.now(),
    };
    next.unlockedJobs = Object.keys(jobs).filter((key) => checkRequirement(jobs[key].unlock, next));
    return applyOfflineProgress(next);
  } catch {
    return initialState;
  }
}

export function saveState(state: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
