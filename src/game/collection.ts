import { jobs } from '../data/gameData';
import { CROPS } from './farming';

export function getJobDropItems(jobKey: string) {
  const job = jobs[jobKey];
  if (!job) return [];
  const drops = job.areas.flatMap((area) => (area.drops || []).map((d) => d.item));
  const monsterDrops = job.areas.flatMap((area) => (area.monsters || []).flatMap((monster) => (monster.drops || []).map((d) => d.item)));
  const musings = job.areas.flatMap((area) => (area.musings || []).flatMap((m) => (m.rewardItems || []).map((r) => r.item)));
  const cropRewards = jobKey === 'farming'
    ? Object.values(CROPS).flatMap((crop) => crop.rewards.map((reward) => reward.item))
    : [];
  const tutorial = jobKey === 'fishing' ? ['resolve_to_fish'] : jobKey === 'rest' ? ['permission_to_rest'] : [];
  return Array.from(new Set([...drops, ...monsterDrops, ...musings, ...cropRewards, ...tutorial]));
}
