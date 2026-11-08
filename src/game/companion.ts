// 相棒の猫「ミケ」と図鑑の人物欄（登場人物施策の第一弾）。
// クッキークリッカー移植原則(2): ランダム出現＋短時間バフの重ねを、
// 相棒の猫が時々持ってくる短時間バフとして登場人物施策と融合させる。
// 猫は拠点に住み着いた相棒で、たまにやってきて「なでる」と短いご褒美を置いていく。
// 見逃しても損はない（取り逃しで罰しない。CODEX_HANDOFF の方針通り）。
// バフはライブセッション限定。オフライン進行の計算時は無効化する
// （90秒のバフが数日ぶんの進行に掛かるのを防ぐため。tick.ts 参照）。
import { jobs } from '../data/gameData';
import { enqueueMusing } from './musings';
import { getWeekKey } from './weekly';
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
// 「ミケを呼ぶ」の再使用までの間隔。呼ぶのは能動操作なので、
// ランダム来訪（期待 10 分）と並んでもバフの被りすぎにならない間隔にする。
export const CAT_CALL_COOLDOWN_MS = 10 * 60_000;
// 初回来訪は少し早めに（1分ごとの抽選で 6% → 期待 17 分ほど）。
// 2回目以降は 10%（期待 10 分ほど）で、開いている間の楽しみを増やす。
// 旧 2%（期待 50 分）では「開いていてもやることがない」との実機感想があった。
const CAT_FIRST_VISIT_CHANCE = 0.06;
const CAT_VISIT_CHANCE = 0.10;
// 初回来訪には少しだけ生活の積み重ねを条件にする（導入直後の混乱を避ける）。
const CAT_FIRST_VISIT_MIN_CYCLES = 30;

export function createCatState(): CatState {
  return { visits: 0, lastRollAt: 0, lastVisitAt: 0, lastCallAt: 0, visit: null, buff: null };
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
    lastCallAt: num(raw.lastCallAt),
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

// 「ミケを呼ぶ」まで残り何ミリ秒か。0 なら今すぐ呼べる。
// lastCallAt が 0（まだ一度も呼んでいない）は残り 0 扱いにする。
export function getCatCallRemainingMs(state: GameState, now: number = Date.now()): number {
  const cat = normalizeCatState(state.cat);
  if (!cat.lastCallAt) return 0;
  return Math.max(0, CAT_CALL_COOLDOWN_MS - (now - cat.lastCallAt));
}

const CAT_FIRST_CALL_TEXT = `勇者「ミケー。おやつあるぞ」\n\nミケがやってきた。おやつの匂いには、猫も正直だ。呼べば来る相棒がいる。それだけで、拠点は少しだけ家に近い。`;

// ミケを呼ぶ（能動操作）。来訪中・バフ中・クールダウン中は呼べない。
// 呼ぶとランダム来訪と同じ 5 分の来訪が始まり、「なでる」で短いご褒美がもらえる。
// 呼ばなくてもランダム来訪は起きるし、呼べない時間に損はない（見逃し損なし）。
export function callCat(prev: GameState, now: number = Date.now()): GameState {
  const cat = normalizeCatState(prev.cat);
  if (cat.visit || cat.buff) return prev;
  if (getCatCallRemainingMs(prev, now) > 0) return prev;
  const visit: CatVisit = { buffId: pickBuffId(), appearedAt: now, expiresAt: now + CAT_VISIT_WINDOW_MS };
  const next: GameState = {
    ...prev,
    cat: { ...cat, lastCallAt: now, visits: cat.visits + 1, lastVisitAt: now, visit },
  };
  if ((prev.seenMusingIds || []).includes('cat-first-call')) return next;
  return enqueueMusing(next, {
    id: 'cat-first-call',
    job: '相棒の猫',
    area: '拠点',
    text: CAT_FIRST_CALL_TEXT,
    category: 'event',
    eventType: 'event',
    eventSubType: 'cat_call',
    once: true,
  }, { now }).state;
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

// ---- 登場人物の出会い（2026-11-08 / 仲間3名） ----
// 出会いの出し方は 2026-11-07 にユーザーが承認した通り：初登場イベント＋ぼやきセット＋
// 図鑑の人物欄。システム連動は軽いボーナスのみ（見逃し損は作らない。条件を満たせば
// 次の tick で自動で出会うので、取りこぼしの心配はない）。
// 出会いの条件は、すでに遊んでいる進行に自然に絡むものにする。
// 店主は商人Lv3（王国勤務の解禁と同じ節目）、大家さんは拠点整備3種、
// 隣人は引退1回（引退した先輩と初めて会話が弾む頃合い）。
export const PERSON_SELL_BONUS_PCT = 5;
export const PERSON_UPGRADE_DISCOUNT_PCT = 5;
export const PERSON_FAIL_REDUCTION = 0.02;
// 敵・家族のボーナス（2026-11-08 / 登場人物の残り）。仲間と同じく軽いものだけ。
// 締切の魔人：冒険以外の仕事の失敗率 -3%。満員電車ゴーレム：冒険の出発費 -5%。
export const PERSON_JOB_FAIL_REDUCTION = 0.03;
export const PERSON_ENTRY_COST_DISCOUNT_PCT = 5;

export type PersonDef = PersonEntry & {
  bonusLabel: string;
  meetText: string;
  ambient: string[];
};

export const PERSON_DEFS: PersonDef[] = [
  {
    id: 'shopkeeper',
    name: '商店の店主',
    role: '仲間',
    description: '街の商店を切り盛りする店主。素材の値段に妙に詳しい。出会うと売却額が +5%。',
    hint: '商人の仕事を続けると、店の奥から店主が顔を出すらしい。',
    met: false,
    bonusLabel: '売却額 +5%',
    meetText: `店の奥から店主が顔を出した。\n\n店主「おや、常連さん。売るだけじゃなく、買う顔も見せなさいよ」\n\n勇者「商売、こっち側に回ると急に緊張する」\n\n店主と出会った。素材の売却額が +5% になった。顔なじみは、値段にも効く。`,
    ambient: [
      '店主「今日の相場はね、勇者の機嫌と連動してるのよ」',
      '店主「安く買って高く売る。勇者もそれ、人生でやってるでしょ」',
      '店主が値札を書き直した。数字の前でだけ、やけに真剣だ。',
    ],
  },
  {
    id: 'landlord',
    name: '大家さん',
    role: '仲間',
    description: '拠点の大家さん。家賃の話になると、なぜか少しだけ優しい。出会うと拠点整備の金コストが -5%。',
    hint: '拠点整備を進めると、大家さんが見回りに来るらしい。',
    met: false,
    bonusLabel: '拠点整備の金コスト -5%',
    meetText: `大家さんが拠点の見回りに来た。\n\n大家さん「あら、少しは住み心地がよくなったじゃない。家賃はそのままよ」\n\n勇者「整えた分だけ、家がこっちを見てくれる気がする」\n\n大家さんと出会った。拠点整備の金コストが -5% になった。住み心地は、値引きにもなる。`,
    ambient: [
      '大家さん「廊下の電球、替えておいたわよ。家賃とは別枠よ」',
      '大家さん「家賃の話はまた今度。今日は天気がいいからね」',
      '大家さんが植木に水をやっている。大家さんの方が、この家に住んでいる。',
    ],
  },
  {
    id: 'neighbor',
    name: '元勇者仲間の隣人',
    role: '仲間',
    description: '隣の部屋に住む元勇者。引退後の生活にやけに詳しい。出会うと冒険の失敗率が -2%。',
    hint: '引退を重ねると、隣の部屋の元勇者が声をかけてくるらしい。',
    met: false,
    bonusLabel: '冒険の失敗率 -2%',
    meetText: `隣の部屋から声がかかった。\n\n隣人「おう、新入りの引退者。引退ってな、最初の一回が一番こわいんだ」\n\n勇者「先輩がいた。しかも、引退済みだった」\n\n元勇者仲間の隣人と出会った。冒険の失敗率が -2% になった。先輩の助言は、転ばぬ先の杖だ。`,
    ambient: [
      '隣人「俺も昔は魔王と戦ってた。今は洗濯物と戦ってる」',
      '隣人「引退してからが本番だぞ。生活のボスは逃げないからな」',
      '隣人がベランダでお茶を飲んでいる。引退後の余裕が、湯気になって見える。',
    ],
  },
  {
    id: 'deadline_demon',
    name: '締切の魔人',
    role: '敵',
    description: '王国の締切を守らせる魔人。倒すというより、間に合わせる相手。出会うと仕事の失敗率が -3%。',
    hint: '王国勤務を続けると、締切の気配が近づいてくるらしい。',
    met: false,
    bonusLabel: '仕事の失敗率 -3%',
    meetText: `王国勤務の締切が近づいた夜、書類の影がゆっくり立ち上がった。\n\n魔人「締切は守るものだ。おまえのペースは知らん」\n\n勇者「来た。締切の魔人。倒すんじゃなくて、間に合わせる相手だ」\n\n締切の魔人と出会った。仕事の失敗率が -3% になった。締切を知ると、段取りが少しだけ早くなる。`,
    ambient: [
      '締切の魔人「締切は伸びない。おまえの昼寝は伸びるのに」',
      '締切の魔人がカレンダーを指さした。指さされた日付だけ、急に重く見える。',
      '締切の魔人「間に合ったな。次も間に合わせろよ。俺は待たない」',
    ],
  },
  {
    id: 'commuter_golem',
    name: '満員電車ゴーレム',
    role: '敵',
    description: '朝の満員電車に棲むゴーレム。押されても倒れない。乗る側も倒れない。出会うと冒険の出発費が -5%。',
    hint: '配達を続けると、朝の満員電車で何かと出会うらしい。',
    met: false,
    bonusLabel: '冒険の出発費 -5%',
    meetText: `朝の配達で満員電車に乗った。ドアが閉まる直前、目の前に大きな影が立った。\n\nゴーレム「押すな。押されるな。降りる人から、先に」\n\n勇者「満員電車ゴーレムだ。戦う相手じゃない。流れに乗る相手だ」\n\n満員電車ゴーレムと出会った。冒険の出発費が -5% になった。混雑をやり過ごすと、足取りが少しだけ軽くなる。`,
    ambient: [
      '満員電車ゴーレム「今日は空いてる。空いてる日は、俺も少しだけ優しい」',
      '満員電車ゴーレムがドアの前で仁王立ちしている。降りる人が先、という無言の圧がある。',
      '満員電車ゴーレム「押すなよ。押されたら、俺が押しかえす」',
    ],
  },
  {
    id: 'family',
    name: '実家からの連絡',
    role: '家族',
    description: '実家からの定期連絡。元気かと聞かれると、つい元気なふりをしてしまう。出会うと毎週、少しの仕送りが届く。',
    hint: '生活スタンプを続けると、実家から手紙が届くらしい。',
    met: false,
    bonusLabel: '毎週の仕送り（週に一度Gが届く）',
    meetText: `生活スタンプが7個たまった頃、実家から手紙が届いた。\n\n手紙「元気か。無理するなよ。たまには帰ってこい」\n\n勇者「……元気なふりをする手紙を書く時間だけ、急に手が止まる」\n\n実家からの連絡と出会った。毎週、実家から少しの仕送りが届くようになった。返事を書くのは、来週の自分に任せた。`,
    ambient: [
      '実家からの手紙「ごはんは食べてるか。野菜も食べなさい」',
      '実家からの電話「声が聞けてよかった。また来週な」',
      '実家からの手紙「無理するなよ、という文字だけ妙に太い」',
    ],
  },
];

export const PERSON_AMBIENT_MUSINGS: Record<string, string[]> = Object.fromEntries(
  PERSON_DEFS.map((def) => [def.id, def.ambient]),
);

// 出会い済みの人物 id 一覧。旧セーブは未記録扱い（空）。
export function normalizeMetPeople(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(PERSON_DEFS.map((def) => def.id));
  return Array.from(new Set(raw.filter((id): id is string => typeof id === 'string' && valid.has(id))));
}

export function hasMetPerson(state: GameState, id: string): boolean {
  return (state.metPeople || []).includes(id);
}

// 出会った人物のボーナス表示（統計モーダル用）。出会いがなければ空。
export function getPersonBonusLines(state: GameState): string[] {
  return PERSON_DEFS.filter((def) => hasMetPerson(state, def.id))
    .map((def) => `${def.name}：${def.bonusLabel}`);
}

export function getOwnedUpgradeCount(state: GameState): number {
  return Object.values(jobs)
    .flatMap((job) => job.upgrades)
    .filter((upgrade) => state.items?.[upgrade.id]).length;
}

function meetsPersonCondition(state: GameState, id: string): boolean {
  if (id === 'shopkeeper') return (state.jobData?.merchant?.level || 1) >= 3;
  if (id === 'landlord') return getOwnedUpgradeCount(state) >= 3;
  if (id === 'neighbor') return (state.prestige?.retireCount || 0) >= 1;
  // 敵2名：日常の強敵は、仕事を続けるうちに自然と顔を出す。
  // 締切の魔人は王国勤務Lv3、満員電車ゴーレムは配達Lv3が節目。
  if (id === 'deadline_demon') return (state.jobData?.office?.level || 1) >= 3;
  if (id === 'commuter_golem') return (state.jobData?.delivery?.level || 1) >= 3;
  // 家族：生活スタンプ7個（1週間ほど通う）で、実家から最初の手紙が届く。
  if (id === 'family') return (state.items?.life_stamp || 0) >= 7;
  return false;
}

// ---- 実家からの定期連絡（家族イベント / 2026-11-08） ----
// 出会い（初回の手紙）は maybeMeetPeople で。2回目以降は週が変わるたびに
// 仕送り＋手紙が届く。見逃し損は作らない（週をまたいでいても、その週の分は
// 次の tick で届く。遡っての複数週分は出さない）。
export const FAMILY_REMITTANCE_BASE_GOLD = 150;
export const FAMILY_REMITTANCE_PER_JOB_LEVEL = 15;

export function getFamilyRemittanceGold(state: GameState): number {
  return FAMILY_REMITTANCE_BASE_GOLD + FAMILY_REMITTANCE_PER_JOB_LEVEL * maxJobLevel(state);
}

const FAMILY_LETTER_MUSINGS = [
  `実家から仕送りと手紙が届いた。\n\n手紙「今週も元気そうで何より。こっちは変わらないよ」\n\n勇者「変わらない、という報告が一番安心する。仕送りはありがたく受け取った。返事は、来週の自分に任せた。`,
  `実家から仕送りが届いた。手紙には「野菜を食べなさい」とだけある。\n\n勇者「野菜は食べてる。大根は育ててる。……報告できることが増えたのは、悪くないな」`,
  `実家から手紙が届いた。「たまには帰ってこい」と書いてある。\n\n勇者「帰る、という選択肢があるだけで、今日はもう少し頑張れる。選択肢だけ先に、ありがたく受け取った」`,
];

function hashWeekKey(weekKey: string): number {
  let hash = 0;
  for (let i = 0; i < weekKey.length; i += 1) hash = (hash * 31 + weekKey.charCodeAt(i)) >>> 0;
  return hash;
}

export function maybeFamilyLetter(prev: GameState, now: number = Date.now()): GameState {
  if (!hasMetPerson(prev, 'family')) return prev;
  const weekKey = getWeekKey(now);
  if (prev.familyLetterWeek === weekKey) return prev;
  const gold = getFamilyRemittanceGold(prev);
  const text = FAMILY_LETTER_MUSINGS[hashWeekKey(weekKey) % FAMILY_LETTER_MUSINGS.length];
  const next: GameState = {
    ...prev,
    gold: (prev.gold || 0) + gold,
    familyLetterWeek: weekKey,
    eventLog: [`実家からの仕送り：+${gold}G と手紙が届いた。「元気か」とだけ書いてある。`, ...(prev.eventLog || [])].slice(0, 24),
  };
  return enqueueMusing(next, {
    id: `family-letter-${weekKey}`,
    job: '実家からの連絡',
    area: '拠点',
    text,
    category: 'event',
    eventType: 'event',
    eventSubType: 'family_letter',
    once: true,
  }, { now }).state;
}

// 出会いの判定。条件を満たした人物がいれば出会い済みにし、初登場イベントの
// ぼやきを出す。ライブtick・オフラインtickの両方で呼ぶ（出会いは一度きりの
// フラグ＋ぼやきなので、オフライン帰還時に出るのも自然な流れ）。
export function maybeMeetPeople(prev: GameState, now: number = Date.now()): GameState {
  const met = new Set(normalizeMetPeople(prev.metPeople));
  let next = prev;
  for (const def of PERSON_DEFS) {
    if (met.has(def.id)) continue;
    if (!meetsPersonCondition(next, def.id)) continue;
    met.add(def.id);
    next = {
      ...next,
      metPeople: Array.from(met),
      // 家族と出会った週は、初回の手紙そのものが出会いなので仕送りは翌週から。
      // 出会い週を記録しておくと、同じ tick の後続処理でも二重に届かない。
      ...(def.id === 'family' ? { familyLetterWeek: getWeekKey(now) } : {}),
      eventLog: [`出会い：${def.name}と出会った。${def.bonusLabel}が効くようになった。`, ...(next.eventLog || [])].slice(0, 24),
    };
    next = enqueueMusing(next, {
      id: `meet-${def.id}`,
      job: def.name,
      area: '拠点',
      text: def.meetText,
      category: 'event',
      eventType: 'event',
      eventSubType: 'meet_person',
      once: true,
    }, { now }).state;
  }
  return next;
}

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
    ...PERSON_DEFS.map((def) => ({
      id: def.id,
      name: def.name,
      role: def.role,
      description: def.description,
      hint: def.hint,
      met: hasMetPerson(state, def.id),
    })),
  ];
}
