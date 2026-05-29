import type { GameState, Job, Monster } from '../types';
import { getEquipmentBonus } from './equipment';

export type BattleResult = {
  won: boolean;
  heroAttack: number;
  guard: number;
  turns: number;
  hpCost: number;
  mpCost: number;
  remainingMonsterHp: number;
  logs: string[];
};

export function getHeroAttack(state: GameState, level: number, job: Job) {
  const weaponBonus = (state.items.hinoki_stick || 0) ? 3 : 0;
  const upgradeBonus = job.upgrades.filter((upgrade) => state.items[upgrade.id]).length * 2;
  const baseAttack = Math.max(4, 5 + Math.floor(level * 1.7) + weaponBonus + upgradeBonus);
  return Math.max(4, Math.floor(baseAttack * (1 + getEquipmentBonus(state, 'attack') / 100)));
}

export function getHeroGuard(state: GameState, job: Job) {
  const upgradeGuard = job.upgrades.filter((upgrade) => state.items[upgrade.id]).length;
  const shieldGuard = state.items.adventure_shield ? 2 : 0;
  const equipmentGuard = Math.floor(getEquipmentBonus(state, 'defense') / 8);
  return Math.min(12, upgradeGuard + shieldGuard + equipmentGuard);
}

export function simulateMonsterBattle(state: GameState, job: Job, monster: Monster, level: number): BattleResult {
  const heroAttack = getHeroAttack(state, level, job);
  const guard = getHeroGuard(state, job);
  const turnsToWin = Math.max(1, Math.ceil(monster.hp / heroAttack));
  const damagePerTurn = Math.max(1, monster.attack - guard);
  const mpPerTurn = Math.max(1, Math.ceil(monster.attack / 3));
  const hpCost = Math.max(0, damagePerTurn * Math.max(0, turnsToWin - 1));
  const mpCost = mpPerTurn * turnsToWin;
  const won = state.hp > hpCost && state.mp >= mpCost;
  const turns = won ? turnsToWin : Math.max(1, Math.min(turnsToWin, Math.floor(state.hp / damagePerTurn) || 1));
  const remainingMonsterHp = won ? 0 : Math.max(1, monster.hp - heroAttack * turns);
  const logs = [
    `${monster.name}と遭遇：HP${monster.hp} / 攻撃${monster.attack}`,
    `勇者の攻撃力：${heroAttack}。${turnsToWin}手で片づける計算。計算だけは勇敢だ。`,
    won
      ? `勝利：${turnsToWin}手 / 消耗 HP${hpCost}・MP${mpCost}。帰宅後の風呂が本編。`
      : `撤退：敵HP${remainingMonsterHp}で引き返した。命の優先順位だけは高い。`,
  ];
  if (guard > 0) logs.splice(2, 0, `防御：被害を${guard}軽減。道具、たまに本当に道具だ。`);
  return { won, heroAttack, guard, turns, hpCost, mpCost, remainingMonsterHp, logs };
}
