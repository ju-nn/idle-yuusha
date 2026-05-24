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

export function isJobUnlocked(key: string, state: GameState) {
  if (!jobs[key]) return false;
  if (state.unlockedJobs?.length) return state.unlockedJobs.includes(key);
  return checkRequirement(jobs[key].unlock, state);
}

export function isAreaUnlocked(jobKey: string, area: Area, state: GameState) {
  return isJobUnlocked(jobKey, state) && checkRequirement(area.unlock, state);
}

export function getActiveArea(jobKey: string, areaId: string) {
  const job = jobs[jobKey] || jobs.fishing;
  return job.areas.find((area) => area.id === areaId) || job.areas[0];
}
