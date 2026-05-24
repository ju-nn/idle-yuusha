import { jobs } from '../data/gameData';
import type { GameState, ResourceKey, Upgrade } from '../types';
import { rewardText } from './formatters';
import { enqueueMusing } from './musings';
import { addAchievement, addItems, announceJobUnlocks } from './progression';
import { isAreaUnlocked, isJobUnlocked } from './requirements';
import { CROPS, getCropRewards, type CropId } from './farming';

export function advanceMusing(prev: GameState): GameState {
  const readAt = Date.now();
  const queue = prev.musingQueue || [];
  const currentUnread = Boolean(prev.currentMusing && !prev.currentMusing.readAt);
  const [next, ...rest] = queue;
  const displayed = currentUnread ? prev.currentMusing : next;
  const [, following, ...remaining] = queue;
  if (!displayed) return prev;
  const readEntry = [{ ...displayed, readAt, claimed: true }];
  const eventLog = prev.eventLog;
  const achievements = displayed.id === 'intro_001' ? addAchievement(prev, 'first_musing', [...eventLog]) : prev.achievements;
  return {
    ...prev,
    currentMusing: currentUnread
      ? (next || { ...displayed, readAt, claimed: true })
      : (following || { ...displayed, readAt, claimed: true }),
    musingQueue: currentUnread ? rest : (following ? remaining : []),
    readMusings: [...readEntry, ...(prev.readMusings || [])].slice(0, 80),
    tutorialStep: displayed.id === 'intro_001' ? 'select_fishing' : prev.tutorialStep,
    achievements,
    eventLog,
  };
}

export function selectJob(prev: GameState, key: string): GameState {
  if (!isJobUnlocked(key, prev)) return prev;
  const job = jobs[key];
  const area = job.areas.find((a) => isAreaUnlocked(key, a, prev)) || job.areas[0];
  const next: GameState = {
    ...prev,
    activeJob: key,
    activeArea: area.id,
    tick: 0,
    tutorialStep: key === 'fishing' && prev.tutorialStep === 'select_fishing' ? 'done' : prev.tutorialStep,
    eventLog: [
      `${job.name}を開いた。${job.description}`,
      ...prev.eventLog,
    ].slice(0, 24),
  };
  const unlockedNext = announceJobUnlocks(prev, next);
  if (key !== 'fishing' || prev.tutorialStep !== 'select_fishing') return unlockedNext;
  return enqueueMusing(unlockedNext, {
    id: 'tutorial_fishing_started',
    job: '勇者',
    area: 'しょぼい池',
    category: 'firstTime',
    eventType: 'firstTime',
    eventSubType: 'tutorial_fishing_started',
    once: true,
    text: `勇者「よし、釣り開始。労働というより、食費への抵抗運動だな」\n\n放置すると作業が進み、仕事Lvや新しい発見などの出来事に紐づいてぼやきが未読に溜まります。報酬は出来事が起きた時点で入ります。`,
  }, { prepend: true }).state;
}

export function selectArea(prev: GameState, id: string): GameState {
  const activeJob = jobs[prev.activeJob] || jobs.fishing;
  const area = activeJob.areas.find((a) => a.id === id);
  if (!area || !isAreaUnlocked(prev.activeJob, area, prev)) return prev;
  const isFirstVisit = !prev.visitedAreas?.includes(id);
  const next: GameState = {
    ...prev,
    activeArea: id,
    tick: 0,
    visitedAreas: isFirstVisit ? [...(prev.visitedAreas || []), id] : prev.visitedAreas,
    eventLog: [`${activeJob.name}：${area.name}を始めた。${area.summary}`, ...prev.eventLog].slice(0, 24),
  };
  if (!isFirstVisit) return next;
  return enqueueMusing(next, {
    id: `new-area-${id}`,
    job: activeJob.name,
    area: area.name,
    text: `勇者は${area.name}に到達した。\n\n勇者「${area.summary}。新しい場所は、新しい悩みをくれる」`,
    category: 'event',
    eventType: 'event',
    eventSubType: 'new_area',
    eventTarget: id,
    once: true,
  }).state;
}

export function plantCrop(prev: GameState, cropId: CropId): GameState {
  if (!isJobUnlocked('farming', prev)) return prev;
  const crop = CROPS[cropId];
  const farmingLevel = prev.jobData.farming?.level || 1;
  if (!crop || farmingLevel < crop.unlockLevel || prev.farming.plantedAt) return prev;
  const now = Date.now();
  return {
    ...prev,
    farming: { plantedAt: now, readyAt: now + crop.growthMs, cropId },
    eventLog: [`${crop.seedName}を植えた。あとは畑に進捗管理を任せる。`, ...prev.eventLog].slice(0, 24),
  };
}

export const plantDaikon = (prev: GameState) => plantCrop(prev, 'daikon');

export function harvestCrop(prev: GameState): GameState {
  if (!prev.farming?.readyAt || Date.now() < prev.farming.readyAt) return prev;
  const crop = CROPS[(prev.farming.cropId || 'daikon') as CropId] || CROPS.daikon;
  const { rewards, bonusCount } = getCropRewards((prev.farming.cropId || 'daikon') as CropId, prev.farming.readyAt);
  const bonusText = bonusCount > 0 ? ` 完熟おまけ+${bonusCount}段階。` : '';
  const eventLog = [`出来事報酬：${rewardText(rewards)}`, `${crop.name}を収穫した。畑が静かに勝っていた。${bonusText}`, ...prev.eventLog].slice(0, 24);
  let achievements = addAchievement(prev, 'first_daikon', eventLog);
  if (crop.growthMs >= 2 * 60 * 60_000) {
    achievements = addAchievement({ ...prev, achievements }, 'first_long_crop', eventLog);
  }
  if (prev.farming.cropId === 'rent_rice') {
    achievements = addAchievement({ ...prev, achievements }, 'first_rent_rice', eventLog);
  }
  const musing = {
    id: `harvest-${Date.now()}`,
    job: '農業',
    area: '小さな畑',
    text: `勇者は${crop.name}を収穫した。\n\n勇者「${crop.musing}${bonusCount > 0 ? ' 放置しすぎた分まで実ってる。怠惰にも利息がついた。' : ''}」`,
    rewardItems: rewards,
    eventType: 'event' as const,
    eventSubType: 'harvest',
    category: 'event',
  };
  const next: GameState = {
    ...prev,
    farming: { plantedAt: null, readyAt: null, cropId: null },
    items: addItems(prev.items, rewards),
    achievements,
    eventLog,
  };
  return announceJobUnlocks(prev, enqueueMusing(next, musing, { prepend: true }).state);
}

export const harvestDaikon = harvestCrop;

export function buyUpgrade(prev: GameState, u: Upgrade): GameState {
  if (prev.items?.[u.id] || prev.gold < u.cost.gold) return prev;
  for (const [key, value] of Object.entries(u.cost.resources || {})) {
    if ((prev.resources[key as ResourceKey] || 0) < value) return prev;
  }
  const resources = { ...prev.resources };
  for (const [key, value] of Object.entries(u.cost.resources || {})) {
    resources[key as ResourceKey] -= value;
  }
  const eventLog = [`拠点整備：${u.name}を導入した。${u.log}`, ...prev.eventLog].slice(0, 24);
  const achievements = addAchievement(prev, 'first_upgrade', eventLog);
  // アップグレード時のぼやきを発生させる
  const upgradeMusing = {
    id: `upgrade-${u.id}`,
    job: jobs[prev.activeJob]?.name || '拠点整備',
    text: `勇者「${u.name}を導入した。${u.log}」`,
    category: 'event' as const,
    eventType: 'event' as const,
    eventSubType: 'upgrade',
    eventTarget: u.id,
    once: true,
  };
  const next: GameState = {
    ...prev,
    gold: prev.gold - u.cost.gold,
    resources,
    items: { ...(prev.items || {}), [u.id]: 1 },
    maxHp: prev.maxHp + (u.effects.maxHp || 0),
    maxMp: prev.maxMp + (u.effects.maxMp || 0),
    achievements,
    eventLog,
  };
  return announceJobUnlocks(prev, enqueueMusing(next, upgradeMusing, { prepend: true }).state);
}

export function resetState(initialState: GameState): GameState {
  return initialState;
}
