import type { GameState, Job, Musing, OfflineTier } from '../types';
import { itemKind } from '../data/catalog';
import { jobs as gameJobs } from '../data/gameData';
import { createCatState, normalizeCatState, normalizeMetPeople } from './companion';
import { createPrestigeState, getPrestigeOfflineBonus, getRebirthOfflineCapHours, normalizePrestigeState } from './prestige';
import { xpToNext } from './progression';
import { getTraitOfflineBonus } from './traits';
import { checkRequirement } from './requirements';
import { TICK_INTERVAL_MS } from './timing';
import { isValidTraitId } from './traits';
import { runOfflineTicks } from './tick';

export const SAVE_KEY = 'yuusha-does-not-want-to-work-codex-handoff-v1';
export const SAVE_VERSION = 5;
// アプリ本体の表示用バージョン（タイトル画面・フッター表示用）。セーブ版数とは別管理。
export const APP_VERSION = '1.0.0';

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
    bossStreak: 0,
    towerFloor: 1,
    towerBest: 0,
    unlockedJobs: ['fishing'],
    seenMusingIds: ['intro_001'],
    recentMusingIds: ['intro_001'],
    musingCooldowns: {},
    lastAmbientMusingAt: undefined,
    lastCertainMusingAt: Date.now(),
    lastSavedAt: Date.now(),
    prestige: createPrestigeState(),
    trait: null,
    traitChanges: 0,
    cat: createCatState(),
    metPeople: [],
    tickerMusing: null,
    lifetime: { cycles: 0, goldEarned: 0, kills: 0, salesGold: 0, harvests: 0, chestsOpened: 0, musingsRead: 0, maxCombo: 0, discovered: [] },
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
  {
    from: 4,
    to: 5,
    summary: 'プレステージ第2層（転生）と自動休憩の追加に合わせ、転生の証と復帰先の置き場を用意する',
    apply: (parsed) => ({
      ...parsed,
      prestige: normalizePrestigeState(parsed.prestige),
      autoRestReturn: null,
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

function normalizeLifetime(raw: Partial<import('../types').LifetimeStats> | undefined): import('../types').LifetimeStats {
  const num = (value: unknown) => (typeof value === 'number' && value >= 0 ? Math.floor(value) : 0);
  return {
    cycles: num(raw?.cycles),
    goldEarned: num(raw?.goldEarned),
    kills: num(raw?.kills),
    salesGold: num(raw?.salesGold),
    harvests: num(raw?.harvests),
    chestsOpened: num(raw?.chestsOpened),
    musingsRead: num(raw?.musingsRead),
    maxCombo: num(raw?.maxCombo),
    discovered: Array.from(new Set((raw?.discovered || []).filter((id): id is string => typeof id === 'string'))),
  };
}

function normalizeWeekly(raw: Partial<import('../types').WeeklyState> | undefined): import('../types').WeeklyState | undefined {
  if (!raw || typeof raw !== 'object' || typeof raw.weekKey !== 'string') return undefined;
  const num = (value: unknown) => (typeof value === 'number' && value >= 0 ? Math.floor(value) : 0);
  const baseline = raw.baseline;
  if (!baseline || typeof baseline !== 'object') return undefined;
  return {
    weekKey: raw.weekKey,
    baseline: {
      cycles: num(baseline.cycles),
      goldEarned: num(baseline.goldEarned),
      kills: num(baseline.kills),
      salesGold: num(baseline.salesGold),
      harvests: num(baseline.harvests),
      chestsOpened: num(baseline.chestsOpened),
      musingsRead: num(baseline.musingsRead),
      discovered: num(baseline.discovered),
    },
    claimed: Array.from(new Set((raw.claimed || []).filter((id): id is string => typeof id === 'string'))),
  };
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
    // ボス連勝: 旧セーブ（未記録）や不正な値は 0 に倒す。
    bossStreak: typeof parsed.bossStreak === 'number' && parsed.bossStreak >= 0 ? Math.floor(parsed.bossStreak) : 0,
    // 無限の塔: 旧セーブ（未記録）や不正な値は 1階・0階に倒す。
    towerFloor: typeof parsed.towerFloor === 'number' && parsed.towerFloor >= 1 ? Math.floor(parsed.towerFloor) : 1,
    towerBest: typeof parsed.towerBest === 'number' && parsed.towerBest >= 0 ? Math.floor(parsed.towerBest) : 0,
    unlockedJobs: [] as string[],
    seenMusingIds: parsed.seenMusingIds || [],
    recentMusingIds: parsed.recentMusingIds || [],
    musingCooldowns: parsed.musingCooldowns || {},
    lastAmbientMusingAt: parsed.lastAmbientMusingAt,
    lastCertainMusingAt: parsed.lastCertainMusingAt,
    lastSavedAt: parsed.lastSavedAt || Date.now(),
    prestige: normalizePrestigeState(parsed.prestige),
    // 特性: 旧セーブ（trait フィールドなし）は未選択扱い。不正な値は null に倒す。
    trait: isValidTraitId(parsed.trait) ? parsed.trait : null,
    traitChanges: typeof parsed.traitChanges === 'number' && parsed.traitChanges >= 0 ? Math.floor(parsed.traitChanges) : 0,
    // 通算の歩み: 旧セーブ（未記録）や不正な値は 0・空に倒す。引退・転生でも引き継ぐ。
    lifetime: normalizeLifetime(parsed.lifetime),
    // 週間目標: 旧セーブ（未記録）や不正な値は未設定扱い。次の tick で今週の起点が作られる。
    weekly: normalizeWeekly(parsed.weekly),
    // 相棒の猫: 旧セーブ（未記録）は来訪なし扱い。引退・転生でも引き継ぐ。
    cat: normalizeCatState(parsed.cat),
    // 出会った人物: 旧セーブ（未記録）は未出会い扱い。条件を満たせば次の tick で出会う。
    metPeople: normalizeMetPeople(parsed.metPeople),
    // 実家からの仕送り週：旧セーブ（未記録）は未設定扱い。出会い済みでも未記録なら
    // 次の tick でその週の仕送りが届く（初回は出会い週の記録で翌週からになる）。
    familyLetterWeek: typeof parsed.familyLetterWeek === 'string' ? parsed.familyLetterWeek : undefined,
    // ティッカーは一時的な表示のため、読み込み時は消す（古い文を残さない）。
    tickerMusing: null,
    // 自動休憩の復帰先: 仕事とエリアが実在するものだけ残す。不正・未記録は未設定扱い。
    autoRestReturn: parsed.autoRestReturn && typeof parsed.autoRestReturn.job === 'string' && gameJobs[parsed.autoRestReturn.job]
      ? { job: parsed.autoRestReturn.job, area: typeof parsed.autoRestReturn.area === 'string' ? parsed.autoRestReturn.area : gameJobs[parsed.autoRestReturn.job].areas[0].id }
      : null,
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
// 転生の余裕があると上限が延びる（基本72時間＋12時間/段階）。
export const OFFLINE_BASE_HOURS = 72;
// オフライン効率：不在中の進行は実時間の半分ぶんから始まる（クッキークリッカー式）。
// 寝ている間の勘（+5%/段階・最大+30%）とのんびり屋気質（+10%）は
// 割引の緩和として上乗せされ、最大でも 90% に収まる。
// 旧：基本 100% に倍率（最大 1.9 × 1.2 = 約 2.3 倍）が掛かり、
// 「開いているより閉じている方が速い」逆転が起きていた。
export const OFFLINE_BASE_RATE = 0.5;
export const OFFLINE_MAX_RATE = 0.9;
export function getOfflineEfficiency(state: GameState): number {
  return Math.min(OFFLINE_MAX_RATE, OFFLINE_BASE_RATE + getPrestigeOfflineBonus(state) + getTraitOfflineBonus(state));
}

export function getOfflineMaxTicks(state: GameState): number {
  return getRebirthOfflineCapHours(state) * 60 * 60;
}

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

// 仕事の通算XP（レベルアップで消費された分も含む）。不在前後で比べると
// 「不在中に積もった XP」と「上がったレベル」がそのまま出る。
export function totalJobXp(state: GameState): number {
  return Object.values(state.jobData || {}).reduce((sum, data) => {
    const level = data.level || 1;
    let spent = 0;
    for (let lv = 1; lv < level; lv += 1) spent += xpToNext(lv);
    return sum + spent + (data.xp || 0);
  }, 0);
}

// 帰還サマリの詳細化（ロードマップ11「オフライン深化」）。
// 不在前後の state を比べ、不在中に積もった XP・レベルアップ・討伐・新発見を返す。
// 純粋関数なので selfTests から直接検証できる。
export function computeOfflineGains(before: GameState, after: GameState): {
  xpGain: number;
  levelUps: string[];
  killsGain: number;
  discoveredGain: number;
} {
  const xpGain = Math.max(0, totalJobXp(after) - totalJobXp(before));
  const levelUps = Object.entries(after.jobData || {})
    .filter(([key, data]) => (data.level || 1) > ((before.jobData?.[key]?.level) || 1))
    .map(([key, data]) => `${gameJobs[key]?.name || key}Lv${data.level}`);
  const killsGain = Math.max(0, (after.lifetime?.kills || 0) - (before.lifetime?.kills || 0));
  const discoveredGain = Math.max(0, (after.lifetime?.discovered?.length || 0) - (before.lifetime?.discovered?.length || 0));
  return { xpGain, levelUps, killsGain, discoveredGain };
}

function applyOfflineProgress(state: GameState): GameState {
  const now = Date.now();
  const savedAt = state.lastSavedAt || now;
  const elapsedMs = Math.max(0, now - savedAt);
  const rawTicks = Math.floor(elapsedMs / TICK_INTERVAL_MS);
  // オフライン効率は実時間の半分から始まり、永続強化とのんびり屋気質で
  // 最大 90% まで緩和される（上限は転生の余裕で延びる。基本3日ぶん）。
  const effectiveTicks = Math.floor(rawTicks * getOfflineEfficiency(state));
  const offlineMaxTicks = getOfflineMaxTicks(state);
  const offlineTicks = Math.min(offlineMaxTicks, effectiveTicks);
  if (offlineTicks < 3) return { ...state, lastSavedAt: now };

  const next = runOfflineTicks(state, offlineTicks);
  const capped = effectiveTicks > offlineMaxTicks;
  const gains = computeOfflineGains(state, next);

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
      xpGain: gains.xpGain,
      levelUps: gains.levelUps,
      killsGain: gains.killsGain,
      discoveredGain: gains.discoveredGain,
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

export function saveState(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, saveVersion: SAVE_VERSION, lastSavedAt: Date.now() }));
    return true;
  } catch {
    // 容量不足やプライベートモード等で保存できない場合、呼び出し側が警告を出す。
    // ここで例外を握りつぶすのは、セーブ失敗でゲーム自体を止めないため。
    return false;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
