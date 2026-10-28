import { itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import type { Area, GameState, Requirement } from '../types';

export function getJobLevel(state: GameState, key: string) {
  return state.jobData?.[key]?.level || 0;
}

export function checkRequirement(unlock: Requirement | undefined, state: GameState) {
  if (!unlock || unlock.type === 'start') return true;
  if (unlock.type === 'jobLevel') return getJobLevel(state, unlock.job) >= unlock.level;
  if (unlock.type === 'item') return (state.items?.[unlock.item] || 0) >= unlock.amount;
  return false;
}

// 既存プレイヤー保護（grandfather）: その仕事を実際に使った痕跡がある場合、
// 解禁条件や保存済みリストの状態に関わらず解禁済みとして扱う。
// 条件を満たしたのに unlockedJobs への記録が漏れたセーブや、
// 旧バージョンで使えていた仕事が、移行や条件見直しで再ロックされる事故を防ぐ。
export function hasJobUsageEvidence(key: string, state: GameState) {
  const job = jobs[key];
  if (!job) return false;
  if (state.activeJob === key) return true;
  const data = state.jobData?.[key];
  if (data && ((data.level || 1) > 1 || (data.xp || 0) > 0 || (data.seenMusings || []).length > 0)) return true;
  if ((job.upgrades || []).some((upgrade) => (state.items?.[upgrade.id] || 0) > 0)) return true;
  const visited = state.visitedAreas || [];
  if (job.areas.some((area) => visited.includes(area.id))) return true;
  if (key === 'farming' && (state.farming?.plantedAt || state.farming?.cropId)) return true;
  return false;
}

export function isJobUnlocked(key: string, state: GameState) {
  if (!jobs[key]) return false;
  if (state.unlockedJobs?.includes(key)) return true;
  if (checkRequirement(jobs[key].unlock, state)) return true;
  return hasJobUsageEvidence(key, state);
}

// 解禁条件を「次に目指すもの」が分かる言葉にする。未解禁表示の共通文言。
export function describeRequirement(unlock: Requirement | undefined, state: GameState) {
  if (!unlock || unlock.type === 'start') return '最初から解禁';
  if (unlock.type === 'jobLevel') {
    const name = jobs[unlock.job]?.name || unlock.job;
    const current = state.jobData?.[unlock.job]?.level || 1;
    const gap = Math.max(0, unlock.level - current);
    return gap > 0
      ? `${name}Lv${unlock.level}で解禁（現在Lv${current}／あと${gap}）`
      : `${name}Lv${unlock.level}で解禁`;
  }
  if (unlock.type === 'item') {
    const current = state.items?.[unlock.item] || 0;
    return `${itemName(unlock.item)}を手に入れると解禁（${current}/${unlock.amount}）`;
  }
  return '未解禁';
}

export function isAreaUnlocked(jobKey: string, area: Area, state: GameState) {
  return isJobUnlocked(jobKey, state) && checkRequirement(area.unlock, state);
}

export function getActiveArea(jobKey: string, areaId: string) {
  const job = jobs[jobKey] || jobs.fishing;
  return job.areas.find((area) => area.id === areaId) || job.areas[0];
}
