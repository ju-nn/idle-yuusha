// 無限の塔（2026-11-08）：エンドゲームの先にある、終わりのない長期目標。
// 塔は既存のモンスターを階数で強化して出し続ける。階が上がるほど敵は強く、
// 報酬も増える。勝てば1階上がり、負けても階数はそのまま（同じ階を登り直す）。
// 他のエリア・仕事へ移ると1階に戻る（＝1回の登攀）。休憩（自動休憩を含む）
// では階数を維持する。引退・転生では今の階数は1階に戻るが、最高階の記録は残る。
// 塔に終わりはないため、「どこまで登れるか」という記録自体が長期の遊びになる。
import type { Monster } from '../types';

export const TOWER_AREA_ID = 'endless_tower';

// 到達の節目。実績 tower_floor_{N} と連動する。
export const TOWER_MILESTONES = [10, 25, 50, 100] as const;

export function towerMilestoneForFloor(floor: number): number | null {
  return (TOWER_MILESTONES as readonly number[]).includes(floor) ? floor : null;
}

// 階数による強化: HP は 1階あたり +15%（複利）、攻撃は 2階あたり +1、
// 報酬（金・XP）は 1階あたり +8%（複利）。10階で HP 約3.5倍、25階で約28倍。
// どこかで必ず壁にぶつかるが、負けても階数は戻らないので登り直しで進める。
export function scaleTowerMonster(monster: Monster, floor: number): Monster {
  const f = Math.max(1, Math.floor(floor));
  if (f <= 1) return monster;
  const hpMult = Math.pow(1.15, f - 1);
  const rewardMult = Math.pow(1.08, f - 1);
  const gold = monster.rewards.gold
    ? [Math.floor(monster.rewards.gold[0] * rewardMult), Math.floor(monster.rewards.gold[1] * rewardMult)] as [number, number]
    : undefined;
  return {
    ...monster,
    name: `${monster.name}（${f}階）`,
    hp: Math.max(1, Math.round(monster.hp * hpMult)),
    attack: monster.attack + Math.floor((f - 1) / 2),
    rewards: { ...monster.rewards, gold, xp: Math.floor((monster.rewards.xp || 0) * rewardMult) },
  };
}
