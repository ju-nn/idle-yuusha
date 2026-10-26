import { itemKind } from '../data/catalog';
import type { GameState, PrestigeState } from '../types';
import { enqueueMusing } from './musings';
import { addAchievement } from './progression';

// プレステージ第1層「引退」。
// 生活をひと通り回した勇者が区切りを付けて引退すると、歩みが「思い出ポイント」に変わる。
// 思い出は次の人生でも消えず、恒久強化として少しずつ生活を楽にする。
// ここで扱うのは永続側の計算と付け替えだけで、周回内の進行は既存システムに任せる。

export const MEMORY_POINT_NAME = '思い出ポイント';

// 引退に必要な進行度スコア。初回は数時間〜1日程度の放置・作業で届く範囲に置く。
export const RETIRE_REQUIRED_SCORE = 35;

export type PrestigeUpgradeDef = {
  id: string;
  name: string;
  description: string;
  maxStage: number;
  costs: number[];
  effectLabel: string;
  perStage: number;
};

export const PRESTIGE_UPGRADES: PrestigeUpgradeDef[] = [
  { id: 'memory_efficiency', name: '段取りの記憶', description: '身体が段取りを覚えている。どの仕事も少し手際がいい。', maxStage: 5, costs: [4, 7, 11, 16, 22], effectLabel: '全仕事速度', perStage: 8 },
  { id: 'memory_gold', name: '小銭の勘', description: '稼ぎ方の勘が残っている。同じ作業でも取りこぼしが減る。', maxStage: 5, costs: [4, 7, 11, 16, 22], effectLabel: '収入（G）', perStage: 10 },
  { id: 'memory_xp', name: '身体の記憶', description: '一度覚えた動きは忘れない。仕事の飲み込みが早い。', maxStage: 5, costs: [3, 6, 10, 15, 21], effectLabel: '仕事XP', perStage: 10 },
  { id: 'memory_vitality', name: '基礎体力の記憶', description: '前の人生で鍛えた分、最初から少し頑丈。', maxStage: 5, costs: [3, 5, 8, 12, 17], effectLabel: '最大HP・最大MP', perStage: 10 },
  { id: 'memory_offline', name: '寝ている間の勘', description: '離れている間も、生活の回し方だけは身体が覚えている。', maxStage: 4, costs: [5, 9, 14, 20], effectLabel: 'オフライン効率', perStage: 15 },
  { id: 'memory_musing', name: 'ぼやきの余韻', description: '前の人生のぼやきが、今の勇者を少しだけ助ける。', maxStage: 4, costs: [3, 6, 10, 15], effectLabel: 'ぼやき報酬', perStage: 25 },
  { id: 'memory_chest', name: '宝箱の嗅覚', description: '宝箱がありそうな場所に、なんとなく足が向く。', maxStage: 5, costs: [4, 7, 11, 16, 22], effectLabel: '宝箱ドロップ率', perStage: 10 },
  { id: 'memory_start_gold', name: 'へそくりの記憶', description: '隠し場所だけは忘れない。次の人生の元手になる。', maxStage: 5, costs: [2, 4, 6, 9, 12], effectLabel: '引退後の初期所持金', perStage: 100 },
];

export function createPrestigeState(): PrestigeState {
  return { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {} };
}

export function normalizePrestigeState(raw: Partial<PrestigeState> | undefined): PrestigeState {
  if (!raw || typeof raw !== 'object') return createPrestigeState();
  const upgrades: Record<string, number> = {};
  for (const def of PRESTIGE_UPGRADES) {
    const stage = Math.floor(Number(raw.upgrades?.[def.id]) || 0);
    if (stage > 0) upgrades[def.id] = Math.min(def.maxStage, stage);
  }
  return {
    memoryPoints: Math.max(0, Math.floor(Number(raw.memoryPoints) || 0)),
    totalEarned: Math.max(0, Math.floor(Number(raw.totalEarned) || 0)),
    retireCount: Math.max(0, Math.floor(Number(raw.retireCount) || 0)),
    upgrades,
  };
}

export function getPrestigeStage(state: GameState, upgradeId: string): number {
  const def = PRESTIGE_UPGRADES.find((candidate) => candidate.id === upgradeId);
  if (!def) return 0;
  const stage = Math.floor(Number(state.prestige?.upgrades?.[upgradeId]) || 0);
  return Math.max(0, Math.min(def.maxStage, stage));
}

export function getNextPrestigeCost(state: GameState, upgradeId: string): number | null {
  const def = PRESTIGE_UPGRADES.find((candidate) => candidate.id === upgradeId);
  if (!def) return null;
  const stage = getPrestigeStage(state, upgradeId);
  return stage >= def.maxStage ? null : def.costs[stage];
}

// 進行度スコア: この人生でどれだけ生活を回したかの物差し。
// レベルは「積み上げ」、発見は「広がり」、実績は「節目」として数える。
// 拠点整備（items のうち種別が拠点整備）と生活スタンプ（記録）は発見から除く。
export type PrestigeScore = {
  totalLevels: number;
  discovered: number;
  achievements: number;
  score: number;
};

export function getPrestigeScore(state: GameState): PrestigeScore {
  const totalLevels = Object.values(state.jobData || {}).reduce((sum, data) => sum + Math.max(0, (data.level || 1) - 1), 0);
  const discovered = Object.entries(state.items || {}).filter(([id, value]) => value > 0 && itemKind(id) !== '拠点整備' && itemKind(id) !== '記録').length;
  const achievements = (state.achievements || []).length;
  return { totalLevels, discovered, achievements, score: totalLevels + discovered + achievements * 2 };
}

// 獲得式は平方根型。序盤の歩みはしっかり報い、進むほど1ポイントの重みを増やす。
// S=35（引退ライン）で11pt、S=100で20pt、S=225で30pt。
export function getRetirementPoints(state: GameState): number {
  const { score } = getPrestigeScore(state);
  return Math.floor(Math.sqrt(Math.max(0, score)) * 2);
}

export function canRetire(state: GameState): boolean {
  return getPrestigeScore(state).score >= RETIRE_REQUIRED_SCORE && getRetirementPoints(state) > 0;
}

// ---- 永続ボーナス（倍率・加算） ----

export function getPrestigeSpeedMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_efficiency') * 8) / 100;
}

export function getPrestigeGoldMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_gold') * 10) / 100;
}

export function getPrestigeXpMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_xp') * 10) / 100;
}

export function getPrestigeOfflineMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_offline') * 15) / 100;
}

export function getPrestigeChestMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_chest') * 10) / 100;
}

export function getPrestigeMusingRewardMultiplier(state: GameState): number {
  return 1 + (getPrestigeStage(state, 'memory_musing') * 25) / 100;
}

export function getPrestigeStartGold(state: GameState): number {
  return getPrestigeStage(state, 'memory_start_gold') * 100;
}

export function getPrestigeMaxHpBonus(state: GameState): number {
  return getPrestigeStage(state, 'memory_vitality') * 10;
}

export function getPrestigeMaxMpBonus(state: GameState): number {
  return getPrestigeStage(state, 'memory_vitality') * 10;
}

// ---- アクション ----

export function buyPrestigeUpgrade(prev: GameState, upgradeId: string): GameState {
  const def = PRESTIGE_UPGRADES.find((candidate) => candidate.id === upgradeId);
  if (!def) return prev;
  const prestige = normalizePrestigeState(prev.prestige);
  const stage = getPrestigeStage(prev, upgradeId);
  if (stage >= def.maxStage) return prev;
  const cost = def.costs[stage];
  if (prestige.memoryPoints < cost) return prev;
  const eventLog = [`思い出強化：${def.name}を段階${stage + 1}にした。${def.effectLabel}が少し上がった。過去の自分、意外と役に立つ。`, ...prev.eventLog].slice(0, 24);
  const achievements = addAchievement(prev, 'first_prestige_upgrade', eventLog);
  const next: GameState = {
    ...prev,
    prestige: {
      ...prestige,
      memoryPoints: prestige.memoryPoints - cost,
      upgrades: { ...prestige.upgrades, [upgradeId]: stage + 1 },
    },
    achievements,
    eventLog,
  };
  return enqueueMusing(next, {
    id: 'prestige-first-upgrade',
    job: '勇者',
    area: '思い出',
    text: `勇者は思い出を強化に変えた。\n\n勇者「過去の俺が今の俺を助ける構造、年金より先にこっちが完成したな」`,
    category: 'firstTime',
    eventType: 'firstTime',
    eventSubType: 'prestige_upgrade',
    once: true,
  }).state;
}

const RETIRE_MUSINGS: Array<{ id: string; text: string }> = [
  {
    id: 'prestige-retire-first',
    text: `勇者は引退した。\n\n勇者「レベルも金も置いていく。残るのは思い出と、段取りの良さだけだ」\n\n荷物は軽くなった。でも不思議と、次の一歩は前より軽い。`,
  },
  {
    id: 'prestige-retire-repeat-a',
    text: `勇者はまた引退した。\n\n勇者「何度目かの引退。もう手続きに迷わない。引退のプロみたいな顔をしている」`,
  },
  {
    id: 'prestige-retire-repeat-b',
    text: `勇者は区切りを付けて、また最初から始めた。\n\n勇者「最初から、は前より怖くない。だって俺はもう、池の魚の機嫌くらいは読める」`,
  },
  {
    id: 'prestige-retire-repeat-c',
    text: `勇者は引退届を出した。\n\n勇者「周回するたび、生活の立ち上がりが少し速い。思い出は荷物にならない唯一の財産だな」`,
  },
];

// 引退: 周回内の進行をリセットし、歩みを思い出ポイントへ変換する。
// 実績・ぼやき図鑑・討伐/訪問の記録・生活スタンプの継続は「思い出」として残す。
// 装備・宝箱・素材・拠点整備は今回の人生のものとして置いていく。
export function retire(prev: GameState, initialState: GameState): GameState {
  if (!canRetire(prev)) return prev;
  const gained = getRetirementPoints(prev);
  const before = normalizePrestigeState(prev.prestige);
  const retireCount = before.retireCount + 1;
  const prestige: PrestigeState = {
    memoryPoints: before.memoryPoints + gained,
    totalEarned: before.totalEarned + gained,
    retireCount,
    upgrades: { ...before.upgrades },
  };
  const withPrestige: GameState = { ...prev, prestige };
  const startGold = initialState.gold + getPrestigeStartGold(withPrestige);
  const maxHp = initialState.maxHp + getPrestigeMaxHpBonus(withPrestige);
  const maxMp = initialState.maxMp + getPrestigeMaxMpBonus(withPrestige);
  const musingTemplate = before.retireCount === 0
    ? RETIRE_MUSINGS[0]
    : RETIRE_MUSINGS[1 + ((retireCount - 2) % (RETIRE_MUSINGS.length - 1))];
  const retireMusing = {
    id: `${musingTemplate.id}-${retireCount}`,
    job: '勇者',
    area: '引退',
    text: musingTemplate.text,
    category: 'event' as const,
    eventType: 'event' as const,
    eventSubType: 'retire',
    once: true,
  };
  const eventLog = [
    `引退：${retireCount}回目の区切り。思い出ポイント+${gained}（累計${prestige.totalEarned}）。生活は最初から、思い出はそのまま。`,
    '新しい人生が始まった。池のほとりから、でも前より少し手際がいい。',
  ];
  let achievements = addAchievement(withPrestige, 'first_retire', eventLog);
  if (retireCount >= 3) achievements = addAchievement({ ...withPrestige, achievements }, 'retire_3', eventLog);
  const next: GameState = {
    ...initialState,
    prestige,
    gold: startGold,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    achievements,
    readMusings: prev.readMusings || [],
    seenMusingIds: Array.from(new Set([...(prev.seenMusingIds || []), 'intro_001', retireMusing.id])),
    recentMusingIds: [retireMusing.id, ...(prev.recentMusingIds || [])].slice(0, 10),
    musingCooldowns: prev.musingCooldowns || {},
    defeatedMonsters: prev.defeatedMonsters || [],
    visitedAreas: prev.visitedAreas || [],
    seenEquipmentBaseIds: prev.seenEquipmentBaseIds || [],
    equipmentDropLog: prev.equipmentDropLog || [],
    openedChestLog: prev.openedChestLog || [],
    dailyBonus: prev.dailyBonus || { streak: 0 },
    tutorialStep: 'done',
    currentMusing: retireMusing,
    musingQueue: [],
    eventLog,
    lastSavedAt: Date.now(),
    lastCertainMusingAt: Date.now(),
  };
  return next;
}
