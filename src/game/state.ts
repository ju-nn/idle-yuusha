import type { GameState, Job, Musing, OfflineTier } from '../types';
import { itemKind } from '../data/catalog';
import { jobs as gameJobs } from '../data/gameData';
import { createPrestigeState, getPrestigeOfflineMultiplier, normalizePrestigeState } from './prestige';
import { checkRequirement } from './requirements';
import { TICK_INTERVAL_MS } from './timing';
import { runOfflineTicks } from './tick';

export const SAVE_KEY = 'yuusha-does-not-want-to-work-codex-handoff-v1';
export const SAVE_VERSION = 4;

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
    saveVersion: SAVE_VERSION,
    offlineSummary: null,
    combo: { streak: 0, boons: {} },
    dailyBonus: { streak: 0 },
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
    equipmentInventory: [],
    equipped: {},
    seenEquipmentBaseIds: [],
    equipmentDropLog: [],
    treasureChests: [],
    openedChestLog: [],
    feedbackEvents: [],
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
    prestige: createPrestigeState(),
  };
}

// セーブの版は saveVersion で数える。初期プロトタイプ（v1）は saveVersion 自体を持たない。
export function detectSaveVersion(parsed: Partial<GameState>): number {
  return typeof parsed.saveVersion === 'number' && parsed.saveVersion >= 1 ? Math.floor(parsed.saveVersion) : 1;
}

type SaveMigrationStep = {
  from: number;
  to: number;
  // その版で何が増えて、どう揃えるのかをここに残す。移行の追跡はこの一覧が正。
  summary: string;
  apply: (parsed: Partial<GameState>) => Partial<GameState>;
};

// バージョンごとの移行手順。新しい版でセーブの形が増えたら、ここに1段追加する。
// 各手順は「その版で増えた置き場を用意する」ところまでを担い、細部の欠損補完は
// 最後に normalizeMigratedState がまとめて面倒を見る（二重の安全網）。
export const SAVE_MIGRATIONS: SaveMigrationStep[] = [
  {
    from: 1,
    to: 2,
    summary: '装備・宝箱システムの追加に合わせ、装備インベントリと宝箱の置き場を用意する',
    apply: (parsed) => ({
      ...parsed,
      equipmentInventory: parsed.equipmentInventory || [],
      equipped: parsed.equipped || {},
      seenEquipmentBaseIds: parsed.seenEquipmentBaseIds || [],
      equipmentDropLog: parsed.equipmentDropLog || [],
      treasureChests: parsed.treasureChests || [],
      openedChestLog: parsed.openedChestLog || [],
    }),
  },
  {
    from: 2,
    to: 3,
    summary: '生活コンボ・デイリーボーナス・帰還サマリーの置き場を用意する',
    apply: (parsed) => ({
      ...parsed,
      combo: parsed.combo || { streak: 0, boons: {} },
      dailyBonus: parsed.dailyBonus || { streak: 0 },
      offlineSummary: parsed.offlineSummary ?? null,
    }),
  },
  {
    from: 3,
    to: 4,
    summary: 'プレステージ（引退）の追加に合わせ、思い出ポイントと永続強化の置き場を用意する',
    apply: (parsed) => ({
      ...parsed,
      prestige: normalizePrestigeState(parsed.prestige),
    }),
  },
];

export function migrateState(parsed: Partial<GameState>, initialState: GameState): GameState {
  const fromVersion = detectSaveVersion(parsed);
  let working: Partial<GameState> = { ...parsed };
  const applied: string[] = [];
  for (const step of SAVE_MIGRATIONS) {
    if (step.from >= fromVersion && step.to <= SAVE_VERSION) {
      working = step.apply(working);
      applied.push(`v${step.from}→v${step.to}: ${step.summary}`);
    }
  }
  const next = normalizeMigratedState(working, initialState);
  if (applied.length > 0) {
    // 移行はゲーム体験の邪魔をしない範囲で、開発者が追えるようにだけ残す。
    console.info(`[idle-yuusha] セーブデータを v${fromVersion} から v${SAVE_VERSION} へ移行しました。`, applied);
  }
  return next;
}

function normalizeMigratedState(parsed: Partial<GameState>, initialState: GameState): GameState {
  const normalizedItems = Object.fromEntries(Object.entries(parsed.items || {}).map(([key, value]) => [
    key,
    itemKind(key) === '重要' ? Math.min(1, value || 0) : value,
  ]));
  const next = {
    ...initialState,
    ...parsed,
    saveVersion: SAVE_VERSION,
    offlineSummary: parsed.offlineSummary || null,
    combo: {
      streak: parsed.combo?.streak || 0,
      lastJob: parsed.combo?.lastJob,
      boons: parsed.combo?.boons || {},
    },
    dailyBonus: {
      lastClaimDate: parsed.dailyBonus?.lastClaimDate,
      streak: parsed.dailyBonus?.streak || 0,
    },
    resources: { ...initialState.resources, ...(parsed.resources || {}) },
    items: normalizedItems,
    jobData: { ...initialState.jobData, ...(parsed.jobData || {}) },
    currentMusing: parsed.currentMusing || initialState.currentMusing,
    readMusings: parsed.readMusings || [],
    musingQueue: parsed.musingQueue || [],
    eventLog: parsed.eventLog || initialState.eventLog,
    farming: { ...initialState.farming, ...(parsed.farming || {}) },
    combatLog: parsed.combatLog || [],
    achievements: parsed.achievements || [],
    equipmentInventory: parsed.equipmentInventory || [],
    equipped: parsed.equipped || {},
    seenEquipmentBaseIds: parsed.seenEquipmentBaseIds || [],
    equipmentDropLog: parsed.equipmentDropLog || [],
    treasureChests: parsed.treasureChests || [],
    openedChestLog: parsed.openedChestLog || [],
    feedbackEvents: [],
    progressBreaking: parsed.progressBreaking || false,
    inCombat: parsed.inCombat || false,
    currentMonster: parsed.currentMonster || null,
    monsterHp: parsed.monsterHp || 0,
    visitedAreas: parsed.visitedAreas || [],
    defeatedMonsters: parsed.defeatedMonsters || [],
    unlockedJobs: [] as string[],
    seenMusingIds: parsed.seenMusingIds || [],
    recentMusingIds: parsed.recentMusingIds || [],
    musingCooldowns: parsed.musingCooldowns || {},
    lastAmbientMusingAt: parsed.lastAmbientMusingAt,
    lastCertainMusingAt: parsed.lastCertainMusingAt,
    lastSavedAt: parsed.lastSavedAt || Date.now(),
    prestige: normalizePrestigeState(parsed.prestige),
  };
  // 解禁済み仕事は「条件を満たすもの」だけでなく、保存済みリストと使用実績も union で守る。
  // 移行のたびに条件だけで再計算すると、旧版で使えていた仕事が再ロックされ得るため。
  const evidenceKeys = Object.keys(gameJobs).filter((key) => {
    const data = next.jobData?.[key];
    if (data && ((data.level || 1) > 1 || (data.xp || 0) > 0 || (data.seenMusings || []).length > 0)) return true;
    if ((gameJobs[key].upgrades || []).some((upgrade) => (next.items?.[upgrade.id] || 0) > 0)) return true;
    return gameJobs[key].areas.some((area) => (next.visitedAreas || []).includes(area.id));
  });
  next.unlockedJobs = Array.from(new Set([
    ...(parsed.unlockedJobs || []),
    ...Object.keys(gameJobs).filter((key) => checkRequirement(gameJobs[key].unlock, next)),
    ...evidenceKeys,
  ])).filter((key) => Boolean(gameJobs[key]));
  return next;
}

// オフライン進行として計算する上限。放置の核は「戻ってきたら成果が積もっている」ことなので、
// 数日ぶんまではそのまま進める。それを超えた分は計算対象外（capped で帰還表示に明示する）。
export const OFFLINE_MAX_TICKS = 72 * 60 * 60; // 3日ぶん

export function getOfflineTier(elapsedMs: number): OfflineTier {
  if (elapsedMs >= 24 * 60 * 60 * 1000) return 'days';
  if (elapsedMs >= 6 * 60 * 60 * 1000) return 'overnight';
  if (elapsedMs >= 30 * 60 * 1000) return 'hours';
  return 'short';
}

function formatOfflineElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}日${hours}時間`;
  if (hours > 0) return `${hours}時間${minutes}分`;
  return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
}

function applyOfflineProgress(state: GameState): GameState {
  const now = Date.now();
  const savedAt = state.lastSavedAt || now;
  const elapsedMs = Math.max(0, now - savedAt);
  const rawTicks = Math.floor(elapsedMs / TICK_INTERVAL_MS);
  // オフライン効率の永続強化があると、不在中の進行が実時間より少し多めに積もる（上限は従来どおり3日ぶん）。
  const boostedTicks = Math.floor(rawTicks * getPrestigeOfflineMultiplier(state));
  const offlineTicks = Math.min(OFFLINE_MAX_TICKS, boostedTicks);
  if (offlineTicks < 3) return { ...state, lastSavedAt: now };

  const next = runOfflineTicks(state, offlineTicks);
  const capped = boostedTicks > OFFLINE_MAX_TICKS;

  // 表示する経過時間は、実際に進行へ反映した（計算対象の）時間に合わせる
  const elapsedText = formatOfflineElapsed(offlineTicks * TICK_INTERVAL_MS);
  const itemGains = Object.fromEntries(Object.entries(next.items || {})
    .map(([key, value]): [string, number] => [key, value - (state.items?.[key] || 0)])
    .filter(([, value]) => value > 0));
  const resourceGains = Object.fromEntries(Object.entries(next.resources || {})
    .map(([key, value]): [string, number] => [key, value - (state.resources?.[key as keyof typeof state.resources] || 0)])
    .filter(([, value]) => value > 0));
  return {
    ...next,
    lastSavedAt: now,
    offlineSummary: {
      elapsedText,
      goldGain: Math.max(0, (next.gold || 0) - (state.gold || 0)),
      resourceGains,
      itemGains,
      chestGain: Math.max(0, (next.treasureChests?.length || 0) - (state.treasureChests?.length || 0)),
      cycles: offlineTicks,
      tier: getOfflineTier(elapsedMs),
      capped,
    },
    feedbackEvents: [],
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
    return applyOfflineProgress(migrateState(parsed, initialState));
  } catch {
    return initialState;
  }
}

export function saveState(state: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, saveVersion: SAVE_VERSION, lastSavedAt: Date.now() }));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
