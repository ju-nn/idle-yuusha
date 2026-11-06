import type { GameState, TraitId } from '../types';
import { enqueueMusing } from './musings';

// 特性（Trait）: ロードマップ3「システム間シナジー深化」の仕上げ。
// ビルドの方向性を1つだけ選ぶ仕組み。シナジーと同じ方針で、効果はすべて
// 派生計算のみ（セーブ形式の破壊的変更なし）。既存プレイヤーの解禁状態・
// 所持品は一切変えない。選択は統計モーダルから行う。

export type { TraitId };

export const TRAIT_CHANGE_BASE_COST = 500;

export type TraitDef = {
  id: TraitId;
  name: string;
  flavor: string;
  effects: string[];
  musing: string;
};

export const TRAITS: TraitDef[] = [
  {
    id: 'craftsman',
    name: '職人気質',
    flavor: '道具を握る手が、今日から少し職人っぽい。',
    effects: ['農業の収穫量：主産物 +1', '拠点整備の金コスト -10%'],
    musing: '畑の土を触る手つきが、急に職人っぽくなった。',
  },
  {
    id: 'adventurer',
    name: '冒険者気質',
    flavor: 'モンスターを見ても、逃げ足より先に剣が出た。',
    effects: ['冒険の攻撃力 +3', '冒険の失敗率 -5%'],
    musing: '逃げる前に、まず一歩前に出てしまった。',
  },
  {
    id: 'merchant',
    name: '商人気質',
    flavor: '値札を見る目が、急に商人っぽくなった。',
    effects: ['商人の売却額 +15%', '仕事の金報酬 +10%'],
    musing: '安く買って高く売る。言葉にすると、急に仕事っぽい。',
  },
  {
    id: 'easygoing',
    name: 'のんびり屋気質',
    flavor: 'のんびりするのが、もう立派な方針になった。',
    effects: ['オフライン効率 +20%', '休憩の仕事経験値 +25%'],
    musing: '急がない勇者は、休むのも上手くなった。',
  },
];

export const TRAIT_DEFS: Record<TraitId, TraitDef> = {
  craftsman: TRAITS[0],
  adventurer: TRAITS[1],
  merchant: TRAITS[2],
  easygoing: TRAITS[3],
};

export function isValidTraitId(value: unknown): value is TraitId {
  return value === 'craftsman' || value === 'adventurer' || value === 'merchant' || value === 'easygoing';
}

export function getTrait(state: GameState): TraitId | null {
  return isValidTraitId(state.trait) ? state.trait : null;
}

// 変更費用 = 500G × (traitChanges + 1)。初回選択は無料（traitChanges は増えない）。
export function getTraitChangeCost(state: GameState): number {
  if (!getTrait(state)) return 0;
  return TRAIT_CHANGE_BASE_COST * ((state.traitChanges || 0) + 1);
}

// --- 効果値（すべて派生計算。未選択なら中立値） ---

// 冒険者気質：冒険の攻撃力 +3（装備・採掘シナジーとは別枠で加算）。
export function getTraitAttackBonus(state: GameState): number {
  return getTrait(state) === 'adventurer' ? 3 : 0;
}

// 冒険者気質：冒険の失敗率 -5%（休憩シナジーとは別枠。下限は呼び出し側で 0% にする）。
export function getTraitFailReduction(state: GameState): number {
  return getTrait(state) === 'adventurer' ? 0.05 : 0;
}

// 職人気質：農業の収穫量、主産物 +1（木こりシナジーとは別枠で加算）。
export function getTraitHarvestBonus(state: GameState): number {
  return getTrait(state) === 'craftsman' ? 1 : 0;
}

// 商人気質：商人の売却額 +15%（釣りシナジーとは別枠で加算）。
export function getTraitSellBonusPct(state: GameState): number {
  return getTrait(state) === 'merchant' ? 15 : 0;
}

// 商人気質：仕事の金報酬 +10%。
export function getTraitJobGoldBonusPct(state: GameState): number {
  return getTrait(state) === 'merchant' ? 10 : 0;
}

// のんびり屋気質：オフライン効率 +20%（倍率 1.20。永続強化の倍率と掛け合わせ）。
export function getTraitOfflineMultiplier(state: GameState): number {
  return getTrait(state) === 'easygoing' ? 1.2 : 1;
}

// のんびり屋気質：休憩の仕事経験値 +25%（倍率 1.25。永続強化の倍率と掛け合わせ）。
export function getTraitRestXpMultiplier(state: GameState): number {
  return getTrait(state) === 'easygoing' ? 1.25 : 1;
}

// 職人気質：拠点整備の金コスト -10%（家事代行シナジー割引のあとに別枠で掛ける）。
export function applyTraitUpgradeDiscount(state: GameState, discountedGold: number): number {
  if (discountedGold <= 0) return 0;
  if (getTrait(state) !== 'craftsman') return discountedGold;
  return Math.max(0, Math.floor(discountedGold * 0.9));
}

// 統計画面の「特性ボーナス」表示用。未選択なら空文字。
export function getTraitBonusLines(state: GameState): string[] {
  const trait = getTrait(state);
  if (!trait) return [];
  return TRAIT_DEFS[trait].effects.map((effect) => `${TRAIT_DEFS[trait].name}：${effect}`);
}

// 特性の選択・変更。初回は無料、変更は 500G × (traitChanges + 1)。
// 金が足りなければ failure ぼやきを出して変更しない。同じ特性の再選択は何もしない。
export function selectTrait(prev: GameState, traitId: TraitId): GameState {
  if (!isValidTraitId(traitId)) return prev;
  const current = getTrait(prev);
  if (current === traitId) return prev;
  const isFirstChoice = current === null;
  const cost = isFirstChoice ? 0 : getTraitChangeCost(prev);
  if (!isFirstChoice && prev.gold < cost) {
    const next: GameState = {
      ...prev,
      eventLog: [`特性の変更には${cost}Gかかるが、手持ちは${prev.gold}Gしかない。財布が先に特性を選んだ。`, ...prev.eventLog].slice(0, 24),
    };
    return enqueueMusing(next, {
      id: `failure-trait-change-${traitId}`,
      job: '勇者',
      area: '特性',
      text: `勇者「特性を変えるのに${cost}Gもかかるのか。財布が先に答えを出した」`,
      category: 'failure',
      eventType: 'failure',
      eventSubType: 'not_enough_gold_for_trait',
      conditionKey: 'failure-trait-change',
      cooldownSec: 5,
    }).state;
  }
  const def = TRAIT_DEFS[traitId];
  const next: GameState = {
    ...prev,
    trait: traitId,
    traitChanges: isFirstChoice ? (prev.traitChanges || 0) : (prev.traitChanges || 0) + 1,
    gold: prev.gold - cost,
    eventLog: [
      isFirstChoice
        ? `特性：${def.name}を選んだ。勇者の生き方が、少しだけ定まった。`
        : `特性：${def.name}に変えた（変更費${cost}G）。生き方の模様替えは、意外と高い。`,
      ...prev.eventLog,
    ].slice(0, 24),
  };
  // 初回選択だけ、出来事ぼやきを一度きりでキューに入れる。変更時は出さない。
  if (!isFirstChoice) return next;
  return enqueueMusing(next, {
    id: `trait-first-${traitId}`,
    job: '勇者',
    area: '特性',
    text: `勇者は${def.name}を選んだ。\n\n勇者「${def.musing}」`,
    rewardItems: [],
    category: 'event',
    eventType: 'event',
    eventSubType: 'trait_selected',
    eventTarget: traitId,
    once: true,
  }, { prepend: true }).state;
}
