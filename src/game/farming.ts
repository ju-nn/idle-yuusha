import type { GameState } from '../types';

export const CROPS = {
  daikon: {
    name: 'しょぼい大根',
    seedName: 'しょぼい大根の種',
    growthMs: 30 * 60_000,
    rewards: [{ item: 'daikon', amount: 3 }],
    bonusEveryMs: 20 * 60_000,
    bonusItem: { item: 'daikon', amount: 1 },
    maxBonus: 4,
    unlockLevel: 1,
    musing: '俺が頑張ってない間に育ってる。かなり理想の働き方では？',
  },
  herb: {
    name: '眠気ざまし草',
    seedName: '眠気ざまし草の種',
    growthMs: 2 * 60 * 60_000,
    rewards: [{ item: 'sleepy_herb', amount: 4 }, { item: 'field_note', amount: 1 }],
    bonusEveryMs: 60 * 60_000,
    bonusItem: { item: 'sleepy_herb', amount: 1 },
    maxBonus: 5,
    unlockLevel: 2,
    musing: '草に生活リズムを心配されている。立場がだいぶ草側にある。',
  },
  potato: {
    name: '安心じゃがいも',
    seedName: '安心じゃがいもの種',
    growthMs: 6 * 60 * 60_000,
    rewards: [{ item: 'safe_potato', amount: 8 }, { item: 'daikon', amount: 2 }],
    bonusEveryMs: 2 * 60 * 60_000,
    bonusItem: { item: 'safe_potato', amount: 2 },
    maxBonus: 6,
    unlockLevel: 4,
    musing: 'じゃがいもは偉い。主張は少ないのに腹持ちで説得してくる。',
  },
  moonbean: {
    name: '夜更け豆',
    seedName: '夜更け豆の種',
    growthMs: 12 * 60 * 60_000,
    rewards: [{ item: 'moonbean', amount: 6 }, { item: 'quiet_scale', amount: 1 }],
    bonusEveryMs: 3 * 60 * 60_000,
    bonusItem: { item: 'moonbean', amount: 2 },
    maxBonus: 8,
    unlockLevel: 6,
    musing: '寝てる間に豆が増えた。俺の睡眠にも収穫判定をつけたい。',
  },
  rent_rice: {
    name: '家賃米',
    seedName: '家賃米の種もみ',
    growthMs: 24 * 60 * 60_000,
    rewards: [{ item: 'rent_rice', amount: 10 }, { item: 'safe_potato', amount: 4 }, { item: 'merchant_license', amount: 1 }],
    bonusEveryMs: 6 * 60 * 60_000,
    bonusItem: { item: 'rent_rice', amount: 3 },
    maxBonus: 10,
    unlockLevel: 8,
    musing: '一日待ったら米ができた。固定費より米が増える世界で暮らしたい。',
  },
} as const;

export type CropId = keyof typeof CROPS;

export function getFarmingProgress(farming: GameState['farming'], now = Date.now()) {
  if (!farming.plantedAt || !farming.readyAt) return { percent: 0, remaining: 0, ready: false };
  const total = Math.max(1, farming.readyAt - farming.plantedAt);
  const elapsed = Math.max(0, now - farming.plantedAt);
  const remaining = Math.max(0, farming.readyAt - now);
  return { percent: Math.min(100, Math.floor((elapsed / total) * 100)), remaining, ready: remaining <= 0 };
}

export function getCropRewards(cropId: CropId, readyAt: number, now = Date.now()) {
  const crop = CROPS[cropId] || CROPS.daikon;
  const overgrownMs = Math.max(0, now - readyAt);
  const bonusCount = Math.min(crop.maxBonus, Math.floor(overgrownMs / crop.bonusEveryMs));
  const rewards = crop.rewards.map((reward) => ({ ...reward }));
  if (bonusCount > 0) {
    rewards.push({ item: crop.bonusItem.item, amount: crop.bonusItem.amount * bonusCount });
  }
  return { rewards, bonusCount, overgrownMs };
}

export function formatFarmDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}
