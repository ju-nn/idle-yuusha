import { itemKind, itemName } from '../data/catalog';
import { upgrades } from '../data/gameData';
import type { Musing } from '../types';

export function rewardText(rewards: Musing['rewardItems'] = []) {
  return rewards.map((r) => `${itemName(r.item)}+${r.amount}${itemKind(r.item) === '重要' ? '★' : ''}`).join(' / ');
}

export function formatResourceName(key: string) {
  return ({ fish: '魚', wood: '木材', ore: '鉱石' } as Record<string, string>)[key] || key;
}

export function describeUpgradeEffects(u: typeof upgrades[number]) {
  const parts = [];
  if (u.effects.maxHp) parts.push(`最大HP+${u.effects.maxHp}`);
  if (u.effects.maxMp) parts.push(`最大MP+${u.effects.maxMp}`);
  parts.push('作業速度+12%');
  return parts.join(' / ') || '効果なし';
}
