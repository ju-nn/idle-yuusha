// 相棒の猫「ミケ」と図鑑の人物欄（登場人物施策の第一弾）。
// クッキークリッカー移植原則(2): ランダム出現＋短時間バフの重ねを、
// 相棒の猫が時々持ってくる短時間バフとして登場人物施策と融合させる。
// 猫は拠点に住み着いた相棒で、たまにやってきて「なでる」と短いご褒美を置いていく。
// 見逃しても損はない（取り逃しで罰しない。CODEX_HANDOFF の方針通り）。
// バフはライブセッション限定。オフライン進行の計算時は無効化する
// （90秒のバフが数日ぶんの進行に掛かるのを防ぐため。tick.ts 参照）。
import { enqueueMusing } from './musings';
import type { CatBuffId, CatState, CatVisit, GameState } from '../types';

export type CatBuffDef = {
  id: CatBuffId;
  name: string;
  description: string;
  // gift は即時型（durationMs なし）。それ以外は持続時間つき。
  durationMs?: number;
};

export const CAT_BUFFS: CatBuffDef[] = [
  { id: 'gold_rush', name: '猫の金運', description: '金報酬 +50%', durationMs: 90_000 },
  { id: 'focus', name: '猫の集中', description: '仕事XP +100%', durationMs: 60_000 },
  { id: 'gift', name: '猫のおみやげ', description: 'その場で少しのGをもらう' },
];

export const CAT_VISIT_WINDOW_MS = 5 * 60_000;
const CAT_ROLL_INTERVAL_MS = 60_000;
// 初回来訪は少し早めに（1分ごとの抽選で 6% → 期待 17 分ほど）。
// 2回目以降は 2%（期待 50 分ほど）で、たまに来る気まぐれさを保つ。
const CAT_FIRST_VISIT_CHANCE = 0.06;
const CAT_VISIT_CHANCE = 0.02;
// 初回来訪には少しだけ生活の積み重ねを条件にする（導入直後の混乱を避ける）。
const CAT_FIRST_VISIT_MIN_CYCLES = 30;

export function createCatState(): CatState {
  return { visits: 0, lastRollAt: 0, lastVisitAt: 0, visit: null, buff: null };
}

export function normalizeCatState(raw: Partial<CatState> | undefined): CatState {
  if (!raw || typeof raw !== 'object') return createCatState();
  const num = (value: unknown) => (typeof value === 'number' && value >= 0 ? Math.floor(value) : 0);
  const visit = raw.visit && typeof raw.visit === 'object' && typeof raw.visit.buffId === 'string'
    && CAT_BUFFS.some((buff) => buff.id === raw.visit?.buffId)
    ? { buffId: raw.visit.buffId as CatBuffId, appearedAt: num(raw.visit.appearedAt), expiresAt: num(raw.visit.expiresAt) }
    : null;
  const buff = raw.buff && typeof raw.buff === 'object' && typeof raw.buff.id === 'string'
    && CAT_BUFFS.some((candidate) => candidate.id === raw.buff?.id)
    ? { id: raw.buff.id as CatBuffId, expiresAt: num(raw.buff.expiresAt) }
    : null;
  return {
    visits: num(raw.visits),
    lastRollAt: num(raw.lastRollAt),
    lastVisitAt: num(raw.lastVisitAt),
    visit,
    buff,
  };
}

// 期限切れの来訪・バフを消す。来訪を見逃しても何も起きない（罰なし）。
export function refreshCatState(prev: GameState, now: number): GameState {
  const cat = normalizeCatState(prev.cat);
  const visitExpired = cat.visit !== null && now >= cat.visit.expiresAt;
  const buffExpired = cat.buff !== null && now >= cat.buff.expiresAt;
  if (!visitExpired && !buffExpired) return prev;
  return {
    ...prev,
    cat: {
      ...cat,
      visit: visitExpired ? null : cat.visit,
      buff: buffExpired ? null : cat.buff,
    },
  };
}

function pickBuffId(): CatBuffId {
  return CAT_BUFFS[Math.floor(Math.random() * CAT_BUFFS.length)].id;
}

// 猫の来訪抽選。1分に1回だけ振る。来訪中・バフ中は抽選しない。
export function maybeCatVisit(prev: GameState, now: number, roll: number = Math.random()): GameState {
  const cat = normalizeCatState(prev.cat);
  if (cat.visit || cat.buff) return prev;
  if (now - (cat.lastRollAt || 0) < CAT_ROLL_INTERVAL_MS) return prev;
  const firstVisit = cat.visits === 0;
  if (firstVisit && (prev.lifetime?.cycles || 0) < CAT_FIRST_VISIT_MIN_CYCLES) {
    return { ...prev, cat: { ...cat, lastRollAt: now } };
  }
  const chance = firstVisit ? CAT_FIRST_VISIT_CHANCE : CAT_VISIT_CHANCE;
  const next: GameState = { ...prev, cat: { ...cat, lastRollAt: now } };
  if (roll >= chance) return next;
  const visit: CatVisit = { buffId: pickBuffId(), appearedAt: now, expiresAt: now + CAT_VISIT_WINDOW_MS };
  return {
    ...next,
    cat: { ...cat, lastRollAt: now, visits: cat.visits + 1, lastVisitAt: now, visit },
  };
}

export function getCatBuffDef(buffId: CatBuffId): CatBuffDef {
  return CAT_BUFFS.find((buff) => buff.id === buffId) || CAT_BUFFS[0];
}

function maxJobLevel(state: GameState): number {
  return Math.max(1, ...Object.values(state.jobData || {}).map((data) => data.level || 1));
}

// 猫のおみやげ（即時型）の金額。進み具合で少しだけ増える。
export function getCatGiftGold(state: GameState): number {
  return 150 + 10 * maxJobLevel(state);
}

export function getCatGoldMultiplier(state: GameState, now: number = Date.now()): number {
  const cat = normalizeCatState(state.cat);
  if (!cat.buff || cat.buff.id !== 'gold_rush' || now >= cat.buff.expiresAt) return 1;
  return 1.5;
}

export function getCatXpMultiplier(state: GameState, now: number = Date.now()): number {
  const cat = normalizeCatState(state.cat);
  if (!cat.buff || cat.buff.id !== 'focus' || now >= cat.buff.expiresAt) return 1;
  return 2;
}

const CAT_VISIT_MUSINGS = [
  'ミケがやってきた。何も言わず、勇者の足元で丸くなった。\n\n勇者「おまえも働きたくないのか。気が合うな」',
  'ミケがやってきた。しっぽで勇者のすねを、軽く叩いた。\n\n勇者「催促か。わかった、なでる。なでればいいんだろ」',
  'ミケがやってきた。机の上に乗って、勇者の仕事をじっと見ている。\n\n勇者「見てるだけなら、監査よりは優しいな」',
];

const CAT_FIRST_VISIT_TEXT = `拠点に猫が住み着いた。\n\n勇者「いつの間に。……まあ、家賃は払ってないが、癒やしは払ってるな」\n\n猫がやってきたら「なでる」で短いご褒美がもらえる。見逃しても損はない。たまに来るだけの、気まぐれな相棒だ。`;

// 猫をなでる。来訪がなければ何もしない。初回来訪では紹介ぼやきも出す。
export function claimCatVisit(prev: GameState, now: number = Date.now()): GameState {
  const cat = normalizeCatState(prev.cat);
  if (!cat.visit || now >= cat.visit.expiresAt) return prev;
  const def = getCatBuffDef(cat.visit.buffId);
  const firstVisit = cat.visits <= 1 && !(prev.seenMusingIds || []).includes('cat-first-visit');
  let next: GameState = { ...prev, cat: { ...cat, visit: null } };
  let eventLog = [...(next.eventLog || [])];
  if (def.id === 'gift') {
    const gold = getCatGiftGold(next);
    next = { ...next, gold: (next.gold || 0) + gold };
    eventLog = [`猫のおみやげ：ミケが +${gold}G を置いていった。どこで拾ってきたのかは聞かない約束だ。`, ...eventLog].slice(0, 24);
  } else {
    next = { ...next, cat: { ...cat, visit: null, buff: { id: def.id, expiresAt: now + (def.durationMs || 0) } } };
    eventLog = [`猫のご褒美：${def.name}（${def.description}）が始まった。ミケは満足そうに丸くなった。`, ...eventLog].slice(0, 24);
  }
  next = { ...next, eventLog };
  // 初回は紹介ぼやき（id 固定・一度だけ）を出し、2回目以降は来訪ごとの短いぼやきを出す。
  if (firstVisit) {
    return enqueueMusing(next, {
      id: 'cat-first-visit',
      job: '相棒の猫',
      area: '拠点',
      text: CAT_FIRST_VISIT_TEXT,
      category: 'event',
      eventType: 'event',
      eventSubType: 'cat_visit',
      once: true,
    }, { now }).state;
  }
  const visitText = CAT_VISIT_MUSINGS[Math.floor(Math.random() * CAT_VISIT_MUSINGS.length)];
  return enqueueMusing(next, {
    id: `cat-visit-${now}`,
    job: '相棒の猫',
    area: '拠点',
    text: visitText,
    category: 'event',
    eventType: 'event',
    eventSubType: 'cat_visit',
    eventTarget: def.id,
  }, { now }).state;
}

// ---- 図鑑の人物欄 ----
// 出会った人物だけ名前が出る。まだの人物は「？？？＋ヒント」で、次に目指すものが分かる。
// 顔ぶれは 2026-11-07 にユーザーが承認したもの。猫以外は今後の施策で出会いを追加する。
export type PersonEntry = {
  id: string;
  name: string;
  role: string;
  description: string;
  hint: string;
  met: boolean;
};

export function getPeople(state: GameState): PersonEntry[] {
  const cat = normalizeCatState(state.cat);
  const metCat = cat.visits > 0;
  return [
    {
      id: 'hero',
      name: '勇者',
      role: '主人公',
      description: '働きたくない勇者。能力はあるが無理するのが苦手で、生活が少し整うと元気になる。最強より、働かなくてもそこそこ安心な暮らしを目指している。',
      hint: 'はじめからいる。',
      met: true,
    },
    {
      id: 'cat',
      name: 'ミケ',
      role: '相棒の猫',
      description: '拠点に住み着いた猫。たまにやってきて、なでると短いご褒美を置いていく。家賃は払っていない。',
      hint: '拠点で生活を続けると、猫がやってくるらしい。',
      met: metCat,
    },
    {
      id: 'shopkeeper',
      name: '商店の店主',
      role: '仲間',
      description: '街の商店を切り盛りする店主。素材の値段に妙に詳しい。',
      hint: '商人の仕事を続けると、店の奥から店主が顔を出すらしい。',
      met: false,
    },
    {
      id: 'landlord',
      name: '大家さん',
      role: '仲間',
      description: '拠点の大家さん。家賃の話になると、なぜか少しだけ優しい。',
      hint: '拠点整備を進めると、大家さんが見回りに来るらしい。',
      met: false,
    },
    {
      id: 'neighbor',
      name: '元勇者仲間の隣人',
      role: '仲間',
      description: '隣の部屋に住む元勇者。引退後の生活にやけに詳しい。',
      hint: '引退を重ねると、隣の部屋の元勇者が声をかけてくるらしい。',
      met: false,
    },
    {
      id: 'deadline_demon',
      name: '締切の魔人',
      role: '敵',
      description: '王国の締切を守らせる魔人。倒すというより、間に合わせる相手。',
      hint: '王国勤務を続けると、締切の気配が近づいてくるらしい。',
      met: false,
    },
    {
      id: 'commuter_golem',
      name: '満員電車ゴーレム',
      role: '敵',
      description: '朝の満員電車に棲むゴーレム。押されても倒れない。乗る側も倒れない。',
      hint: '配達を続けると、朝の満員電車で何かと出会うらしい。',
      met: false,
    },
    {
      id: 'family',
      name: '実家からの連絡',
      role: '家族',
      description: '実家からの定期連絡。元気かと聞かれると、つい元気なふりをしてしまう。',
      hint: '生活スタンプを続けると、実家から手紙が届くらしい。',
      met: false,
    },
  ];
}
