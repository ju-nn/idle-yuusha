import type { GameState } from '../types';
import { hasMetPerson, PERSON_UPGRADE_DISCOUNT_PCT } from './companion';
import { applyTraitUpgradeDiscount } from './traits';

// システム間シナジー（ロードマップ3）。
// Melvor Idle式の「Aの育成がBを強くする」連鎖を、セーブ形式を変えずに
// 派生計算だけで実現する。既存プレイヤーの解禁状態・所持品は一切変えない。
// 効果はすべて上限付きで、既存の装備・永続強化とは別枠で加算される。
// 第一弾（2026-11-05）：釣り・採掘・休憩・夜間警備の4連鎖＋統計画面の表示。
// 第二弾（2026-11-05）：木こり・家事代行・古本せどりの3連鎖を追加し計7連鎖、
// 仕事メニューにも連鎖ヒントを表示する。

export function getJobLevel(state: GameState, jobKey: string): number {
  return state.jobData?.[jobKey]?.level || 1;
}

// 釣りLv → 商人の売却額：魚の目利きが上がると、売値の交渉も強くなる。
// Lv3から +2%/Lv、上限 +20%。
export function getSynergySellBonusPct(state: GameState): number {
  return Math.min(20, Math.max(0, getJobLevel(state, 'fishing') - 2) * 2);
}

// 採掘Lv → 冒険の攻撃力：岩を掘る腕が、そのまま武器の振りに出る。
// Lv2ごとに +1、上限 +10。
export function getSynergyAttackBonus(state: GameState): number {
  return Math.min(10, Math.floor(getJobLevel(state, 'mining') / 2));
}

// 休憩Lv → 冒険の失敗率軽減：よく休んだ勇者は、足元のミスが減る。
// Lv2から -1%/Lv、上限 -10%。冒険エリア（出発費のあるエリア）にだけ効く。
export function getSynergyAdventureFailReduction(state: GameState): number {
  return Math.min(0.10, Math.max(0, getJobLevel(state, 'rest') - 1) * 0.01);
}

// 夜間警備Lv → 冒険の出発費軽減：夜の見回りで安全な裏道を覚え、準備が安くなる。
// Lv2から -2%/Lv、上限 -20%。
export function getSynergyEntryCostReductionPct(state: GameState): number {
  return Math.min(20, Math.max(0, getJobLevel(state, 'nightwatch') - 1) * 2);
}

// 木こりLv → 農業の収穫量：切った木で畑の支柱や柵を整えると、作物がよく育つ。
// Lv4から主産物 +1、Lv2ごとに +1、上限 +3。
export function getSynergyHarvestBonus(state: GameState): number {
  return Math.min(3, Math.max(0, Math.floor((getJobLevel(state, 'woodcutting') - 2) / 2)));
}

// 家事代行Lv → 拠点整備の金コスト：片付けと段取りの勘で、整備の無駄な出費が減る。
// Lv2から -2%/Lv、上限 -20%。金コストだけが対象（素材は対象外）。
export function getSynergyUpgradeDiscountPct(state: GameState): number {
  return Math.min(20, Math.max(0, getJobLevel(state, 'housekeeping') - 1) * 2);
}

export function getUpgradeGoldCost(state: GameState, baseGold: number): number {
  if (baseGold <= 0) return 0;
  const synergyDiscounted = Math.max(0, Math.floor(baseGold * (1 - getSynergyUpgradeDiscountPct(state) / 100)));
  // 特性：職人気質ならさらに -10%（シナジー割引とは別枠で両方適用）。
  const traitDiscounted = applyTraitUpgradeDiscount(state, synergyDiscounted);
  // 人物：大家さんと出会うとさらに -5%（別枠）。
  return hasMetPerson(state, 'landlord')
    ? Math.max(0, Math.floor(traitDiscounted * (1 - PERSON_UPGRADE_DISCOUNT_PCT / 100)))
    : traitDiscounted;
}

// 古本せどりLv → ドロップ確率：目利きが上がると、戦利品の中から価値あるものを見逃さなくなる。
// Lv3から確率 ×(1+2%/Lv)、上限 +20%（倍率1.20）。
export function getSynergyDropChanceMultiplier(state: GameState): number {
  return 1 + Math.min(0.20, Math.max(0, getJobLevel(state, 'booktrade') - 2) * 0.02);
}

export type SynergyChain = {
  id: string;
  from: string;
  fromJob: string;
  to: string;
  label: string;
  detail: string;
  active: string;
  inactive: string;
  menuActive: string;
  menuInactive: string;
};

export function getSynergyChains(state: GameState): SynergyChain[] {
  const fishing = getJobLevel(state, 'fishing');
  const mining = getJobLevel(state, 'mining');
  const rest = getJobLevel(state, 'rest');
  const nightwatch = getJobLevel(state, 'nightwatch');
  const woodcutting = getJobLevel(state, 'woodcutting');
  const housekeeping = getJobLevel(state, 'housekeeping');
  const booktrade = getJobLevel(state, 'booktrade');
  const sell = getSynergySellBonusPct(state);
  const attack = getSynergyAttackBonus(state);
  const fail = getSynergyAdventureFailReduction(state);
  const entryCost = getSynergyEntryCostReductionPct(state);
  const harvest = getSynergyHarvestBonus(state);
  const discount = getSynergyUpgradeDiscountPct(state);
  const drop = getSynergyDropChanceMultiplier(state);
  return [
    {
      id: 'fishing-to-merchant',
      from: '釣り',
      fromJob: 'fishing',
      to: '商人',
      label: '釣り → 商人の売却額',
      detail: '釣りLvが上がると魚の目利きが上がり、商人の売却額が上がる。',
      active: sell > 0 ? `釣りLv${fishing}で売却額 +${sell}%` : '',
      inactive: '釣りLv3から発動（+2%/Lv、上限+20%）',
      menuActive: `商人 売却+${sell}%`,
      menuInactive: '商人 売却（Lv3から）',
    },
    {
      id: 'mining-to-adventure',
      from: '採掘',
      fromJob: 'mining',
      to: '冒険',
      label: '採掘 → 冒険の攻撃力',
      detail: '採掘Lvが上がると腕力がつき、冒険での攻撃力が上がる。',
      active: attack > 0 ? `採掘Lv${mining}で攻撃力 +${attack}` : '',
      inactive: '採掘Lv2から発動（Lv2ごとに+1、上限+10）',
      menuActive: `冒険 攻撃+${attack}`,
      menuInactive: '冒険 攻撃（Lv2から）',
    },
    {
      id: 'rest-to-adventure',
      from: '休憩',
      fromJob: 'rest',
      to: '冒険',
      label: '休憩 → 冒険の失敗率軽減',
      detail: '休憩Lvが上がると体調が整い、冒険の失敗率が下がる。',
      active: fail > 0 ? `休憩Lv${rest}で冒険の失敗率 -${Math.round(fail * 100)}%` : '',
      inactive: '休憩Lv2から発動（-1%/Lv、上限-10%）',
      menuActive: `冒険 失敗-${Math.round(fail * 100)}%`,
      menuInactive: '冒険 失敗率（Lv2から）',
    },
    {
      id: 'nightwatch-to-adventure-cost',
      from: '夜間警備',
      fromJob: 'nightwatch',
      to: '冒険',
      label: '夜間警備 → 冒険の出発費',
      detail: '夜間警備Lvが上がると安全な裏道を覚え、冒険の出発費が安くなる。',
      active: entryCost > 0 ? `夜間警備Lv${nightwatch}で出発費 -${entryCost}%` : '',
      inactive: '夜間警備Lv2から発動（-2%/Lv、上限-20%）',
      menuActive: `冒険 出発費-${entryCost}%`,
      menuInactive: '冒険 出発費（Lv2から）',
    },
    {
      id: 'woodcutting-to-farming',
      from: '木こり',
      fromJob: 'woodcutting',
      to: '農業',
      label: '木こり → 農業の収穫量',
      detail: '木こりLvが上がると畑の支柱や柵が整い、収穫の主産物が増える。',
      active: harvest > 0 ? `木こりLv${woodcutting}で収穫の主産物 +${harvest}` : '',
      inactive: '木こりLv4から発動（主産物+1、Lv2ごとに+1、上限+3）',
      menuActive: `農業 収穫+${harvest}`,
      menuInactive: '農業 収穫（Lv4から）',
    },
    {
      id: 'housekeeping-to-upgrade',
      from: '家事代行',
      fromJob: 'housekeeping',
      to: '拠点整備',
      label: '家事代行 → 拠点整備の割引',
      detail: '家事代行Lvが上がると片付けと段取りの勘がつき、拠点整備の金コストが安くなる。',
      active: discount > 0 ? `家事代行Lv${housekeeping}で拠点整備 -${discount}%` : '',
      inactive: '家事代行Lv2から発動（-2%/Lv、上限-20%、金コストのみ）',
      menuActive: `拠点整備 -${discount}%`,
      menuInactive: '拠点整備 割引（Lv2から）',
    },
    {
      id: 'booktrade-to-drop',
      from: '古本せどり',
      fromJob: 'booktrade',
      to: 'ドロップ',
      label: '古本せどり → ドロップ確率',
      detail: '古本せどりLvが上がると目利きがつき、戦利品ドロップの確率が上がる。',
      active: drop > 1 ? `古本せどりLv${booktrade}でドロップ確率 +${Math.round((drop - 1) * 100)}%` : '',
      inactive: '古本せどりLv3から発動（+2%/Lv、上限+20%）',
      menuActive: `ドロップ確率 +${Math.round((drop - 1) * 100)}%`,
      menuInactive: 'ドロップ確率（Lv3から）',
    },
  ];
}

export function getChainForJob(state: GameState, jobKey: string): SynergyChain | undefined {
  return getSynergyChains(state).find((chain) => chain.fromJob === jobKey);
}

// 仕事メニュー用の短い連鎖ヒント。連鎖を持たない仕事は null。
export function getChainHintForJob(state: GameState, jobKey: string): string | null {
  const chain = getChainForJob(state, jobKey);
  if (!chain) return null;
  return chain.active ? chain.menuActive : chain.menuInactive;
}
