// 週間目標（ロードマップ7「リテンション施策」）。
// 1週間ごとに3件の目標が出て、達成したら金報酬がもらえる。進捗は通算の歩み
// （lifetime）の「今週の始まりからの差分」で測るので、週が変われば自動で
// 新しい目標になる。同じ週は全員同じ3件（週キーからの決定的ハッシュで選ぶ）。
import type { GameState, LifetimeStats, WeeklyBaseline, WeeklyGoal, WeeklyState } from '../types';

export type { WeeklyGoal } from '../types';

// 目標プール約10件。易・中・難の3段階で、各週は各段階から1件ずつ選ぶ。
// 報酬は金のみで、既存の金報酬の感覚に合わせる（易200G / 中600G / 難1500G）。
export const WEEKLY_GOAL_POOL: WeeklyGoal[] = [
  { id: 'weekly_cycles_50', label: 'サイクルを50周まわす', kind: 'cycles', target: 50, rewardGold: 200, tier: 'easy' },
  { id: 'weekly_gold_2000', label: '今週2,000G稼ぐ', kind: 'goldEarned', target: 2000, rewardGold: 200, tier: 'easy' },
  { id: 'weekly_kills_5', label: 'モンスターを5体倒す', kind: 'kills', target: 5, rewardGold: 200, tier: 'easy' },
  { id: 'weekly_sales_1000', label: '今週1,000Gぶん売る', kind: 'salesGold', target: 1000, rewardGold: 600, tier: 'medium' },
  { id: 'weekly_harvests_5', label: '畑を5回収穫する', kind: 'harvests', target: 5, rewardGold: 600, tier: 'medium' },
  { id: 'weekly_chests_3', label: '宝箱を3個開ける', kind: 'chestsOpened', target: 3, rewardGold: 600, tier: 'medium' },
  { id: 'weekly_musings_10', label: 'ぼやきを10件読む', kind: 'musingsRead', target: 10, rewardGold: 600, tier: 'medium' },
  { id: 'weekly_cycles_300', label: 'サイクルを300周まわす', kind: 'cycles', target: 300, rewardGold: 1500, tier: 'hard' },
  { id: 'weekly_gold_15000', label: '今週15,000G稼ぐ', kind: 'goldEarned', target: 15000, rewardGold: 1500, tier: 'hard' },
  { id: 'weekly_discovered_8', label: '新しい発見を8種増やす', kind: 'discovered', target: 8, rewardGold: 1500, tier: 'hard' },
];

function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  return hash;
}

// 月曜始まりの週キー `YYYY-Www`（端末のローカル日時基準）。now を注入できる。
export function getWeekKey(now: Date | number = new Date()): string {
  const date = typeof now === 'number' ? new Date(now) : new Date(now.getTime());
  const day = (date.getDay() + 6) % 7; // 月曜=0
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  // ISO週番号：その週の木曜日の属する年で数える。
  const thursday = new Date(monday);
  thursday.setDate(thursday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// その週の3件（易・中・難から1件ずつ）。同じ週キーなら常に同じ3件。
export function getWeeklyGoals(weekKey: string): WeeklyGoal[] {
  const hash = hashString(weekKey);
  const pick = (tier: WeeklyGoal['tier'], shift: number) => {
    const group = WEEKLY_GOAL_POOL.filter((goal) => goal.tier === tier);
    return group[(hash >>> shift) % group.length];
  };
  return [pick('easy', 0), pick('medium', 8), pick('hard', 16)];
}

function snapshotBaseline(lifetime: LifetimeStats | undefined): WeeklyBaseline {
  return {
    cycles: lifetime?.cycles || 0,
    goldEarned: lifetime?.goldEarned || 0,
    kills: lifetime?.kills || 0,
    salesGold: lifetime?.salesGold || 0,
    harvests: lifetime?.harvests || 0,
    chestsOpened: lifetime?.chestsOpened || 0,
    musingsRead: lifetime?.musingsRead || 0,
    discovered: (lifetime?.discovered || []).length,
  };
}

function isValidBaseline(raw: unknown): raw is WeeklyBaseline {
  if (!raw || typeof raw !== 'object') return false;
  return (['cycles', 'goldEarned', 'kills', 'salesGold', 'harvests', 'chestsOpened', 'musingsRead', 'discovered'] as const)
    .every((key) => typeof (raw as Record<string, unknown>)[key] === 'number' && (raw as Record<string, number>)[key] >= 0);
}

// 週が変わったら baseline を現在の lifetime で取り直し、claimed を空にする。
// 週が変わらないときは同じ state をそのまま返す（純粋関数）。
export function ensureWeeklyState(prev: GameState, now?: Date | number): GameState {
  const weekKey = getWeekKey(now);
  const weekly = prev.weekly;
  if (weekly && weekly.weekKey === weekKey && isValidBaseline(weekly.baseline) && Array.isArray(weekly.claimed)) return prev;
  const nextWeekly: WeeklyState = { weekKey, baseline: snapshotBaseline(prev.lifetime), claimed: [] };
  return { ...prev, weekly: nextWeekly };
}

export type WeeklyGoalProgress = {
  goal: WeeklyGoal;
  current: number;
  done: boolean;
  claimed: boolean;
};

// 週間目標3件の進捗。weekly が未記録（旧セーブ）や週違いのときは、
// 現在の lifetime を起点として進捗 0 で返す（次の tick で baseline が作られる）。
export function getWeeklyGoalProgresses(state: GameState, now?: Date | number): WeeklyGoalProgress[] {
  const weekKey = getWeekKey(now);
  const weekly = state.weekly && state.weekly.weekKey === weekKey && isValidBaseline(state.weekly.baseline)
    ? state.weekly
    : { weekKey, baseline: snapshotBaseline(state.lifetime), claimed: [] as string[] };
  const lifetime = state.lifetime;
  const currentOf = (goal: WeeklyGoal): number => {
    const base = weekly.baseline[goal.kind];
    const nowValue = goal.kind === 'discovered' ? (lifetime?.discovered || []).length : (lifetime?.[goal.kind] || 0);
    return Math.max(0, nowValue - base);
  };
  return getWeeklyGoals(weekKey).map((goal) => {
    const current = currentOf(goal);
    return { goal, current, done: current >= goal.target, claimed: weekly.claimed.includes(goal.id) };
  });
}

export function getWeeklySummary(state: GameState, now?: Date | number): { claimed: number; done: number; total: number } {
  const progresses = getWeeklyGoalProgresses(state, now);
  return {
    claimed: progresses.filter((p) => p.claimed).length,
    done: progresses.filter((p) => p.done).length,
    total: progresses.length,
  };
}

// 週間目標の受け取り。達成済み・未受取のときだけ金報酬を付与する（冪等）。
// 未達成・受取済み・存在しない目標なら何もしない。
export function claimWeeklyGoal(prev: GameState, goalId: string, now?: Date | number): GameState {
  const ensured = ensureWeeklyState(prev, now);
  const weekly = ensured.weekly;
  if (!weekly) return ensured;
  const progress = getWeeklyGoalProgresses(ensured, now).find((entry) => entry.goal.id === goalId);
  if (!progress || !progress.done || progress.claimed) return ensured;
  return {
    ...ensured,
    gold: ensured.gold + progress.goal.rewardGold,
    weekly: { ...weekly, claimed: [...weekly.claimed, goalId] },
    eventLog: [`週間目標達成：${progress.goal.label} — 報酬+${progress.goal.rewardGold}G。来週も、無理のない範囲で。`, ...(ensured.eventLog || [])].slice(0, 24),
  };
}
