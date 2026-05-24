import { ACHIEVEMENTS } from '../data/catalog';
import { jobs } from '../data/gameData';
import { checkRequirement, isJobUnlocked } from './requirements';
import type { Area, GameState, Musing } from '../types';
import { enqueueMusing } from './musings';

export { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
export { getFarmingProgress } from './farming';
export { checkRequirement, getActiveArea, isAreaUnlocked, isJobUnlocked } from './requirements';


export function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
export function xpToNext(level: number) { return Math.floor(45 + level * level * 12); }
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }
export function addItems(base: Record<string, number>, rewards: Musing['rewardItems'] = []) { const next = { ...(base || {}) }; rewards.forEach((r) => { next[r.item] = (next[r.item] || 0) + r.amount; }); return next; }
export function rollDrops(drops: Area['drops'] = []) { return drops.filter((d) => Math.random() <= d.chance).map((d) => ({ ...d, amount: randInt(d.amount[0], d.amount[1]) })); }
export function pickFreshMusing(area: Area, seen: string[] = []) { const indexed = area.musings.map((m, i) => ({ ...m, key: `${area.id}::${i}` })); const unseen = indexed.filter((m) => !seen.includes(m.key)); const selected = unseen.length ? pick(unseen) : pick(indexed); return { ...selected, fresh: !seen.includes(selected.key) }; }
export function getGoal(state: GameState) {
  if (state.currentMusing && !state.currentMusing.readAt) return 'ぼやきの「次へ」を押して、今起きた出来事を読む。';
  if (state.tutorialStep === 'select_fishing') return '左の仕事から「釣り」を選ぶ。';
  if (!isJobUnlocked('rest', state)) return '釣りを開いて、休む許可を得る。';
  if (!isJobUnlocked('woodcutting', state)) return '釣りLv2を目指す。生活素材を集める道が見えてくる。';
  if (!isJobUnlocked('merchant', state)) return '木こりLv2を目指す。集めた素材を売る場所を作る。';
  if (!isJobUnlocked('farming', state)) return '休憩Lv2を目指す。時間に任せる暮らしを増やす。';
  if (!isJobUnlocked('mining', state)) return '木こりLv3を目指す。採掘に使える体力と道具を整える。';
  if (!isJobUnlocked('adventure', state)) return '採掘Lv2を目指す。冒険に出る前に足元を固める。';

  const unlockedJobs = Object.keys(jobs).filter((key) => isJobUnlocked(key, state));
  const totalJobs = Object.keys(jobs).length;
  const ownedUpgrades = Object.values(jobs).flatMap((job) => job.upgrades).filter((upgrade) => state.items?.[upgrade.id]).length;
  const totalUpgrades = Object.values(jobs).reduce((sum, job) => sum + job.upgrades.length, 0);
  const highestLevel = Math.max(...Object.values(state.jobData || {}).map((data) => data.level || 1));
  const longCropReady = state.farming?.readyAt && Date.now() >= state.farming.readyAt;

  if (longCropReady) return '畑が収穫待ち。長く待ったぶん、生活にちゃんと戻ってくる。';
  if (unlockedJobs.length < totalJobs) return `仕事解禁 ${unlockedJobs.length}/${totalJobs}。まだ生活の選択肢は増える。`;
  if (ownedUpgrades < Math.ceil(totalUpgrades * 0.6)) return `拠点整備 ${ownedUpgrades}/${totalUpgrades}。暮らしを楽にする道具を増やす。`;
  if (highestLevel < 8) return `最高仕事Lv${highestLevel}。Lv8を作って、得意な逃げ道をひとつ持つ。`;
  if ((state.achievements || []).length < 10) return `実績 ${(state.achievements || []).length}/10。勇者の人生ログをもう少し厚くする。`;
  return 'リリース版の生活目標は目前。長時間作物、拠点整備、図鑑の穴を埋めて「そこそこ安心」を作る。';
}
export function addAchievement(prev: GameState, id: string, logs: string[]) {
  if (!ACHIEVEMENTS[id] || prev.achievements.includes(id)) return prev.achievements;
  logs.unshift(`実績解除：${ACHIEVEMENTS[id].name} — ${ACHIEVEMENTS[id].description}`);
  let next = [id, ...prev.achievements];
  if (next.length >= 10 && ACHIEVEMENTS.ten_achievements && !next.includes('ten_achievements')) {
    logs.unshift(`実績解除：${ACHIEVEMENTS.ten_achievements.name} — ${ACHIEVEMENTS.ten_achievements.description}`);
    next = ['ten_achievements', ...next];
  }
  return next;
}

function unlockedJobKeys(state: GameState) {
  return Object.keys(jobs).filter((key) => checkRequirement(jobs[key].unlock, state));
}

function jobUnlockMusing(key: string): Musing {
  const job = jobs[key];
  const texts: Record<string, string> = {
    rest: `勇者は「休憩」という仕事を手に入れた。\n\n勇者「仕事欄に休憩が並ぶの、かなり世の中の歪みを感じるな」\n\n池のほとりで手に入れた小さな許可は、思ったより重かった。休むことに理由が必要で、理由がないと横になれない。勇者はその面倒くささを、ようやく名前で呼べるようになった。\n\n勇者「金は増えない。でも、壊れたら全部止まる。休むのも進行の一部ってことにするか」\n\nここからは、稼ぐだけではなく、減ったHPとMPを戻す選択も物語の一部になる。勇者の生活に、初めて『止まる勇気』が追加された。`,
    woodcutting: `勇者は「木こり」を始められるようになった。\n\n勇者「魚を待つ生活から、木を切る生活へ。静かな方向に荒れてきたな」\n\n釣りで少しだけ日銭を得た勇者は、裏庭の細い木を見た。そこには派手な運命も、伝説の剣もない。ただ、切れば木材になる現実が立っていた。\n\n勇者「成果が目に見えるのは助かる。問題は、手首にも成果が残りそうなところだ」\n\n木材は道具になり、道具は次の仕事を呼ぶ。生活は少しずつ、面倒の種類を増やしながら広がっていく。`,
    merchant: `勇者は「商人」を名乗れるようになった。\n\n勇者「ついに売る側か。魚を食べ物として見ていた頃の俺は、まだ素朴だったな」\n\n集めた素材は、持っているだけでは部屋のすみに積もっていく。値札を付けた瞬間、それは生活費になるかもしれないし、売れ残りになるかもしれない。\n\n勇者「自分で集めたものを、自分で売る。自由っぽい。でも売れるかどうかは他人が決める。自由、急に薄いな」\n\nここから勇者は、労働だけでなく換金も覚える。生活は少し便利になり、同時に在庫という新しい不安を手に入れた。`,
    combat: `勇者は「モンスター退治」に踏み込めるようになった。\n\n勇者「ひのきのぼう一本で世界が急に戦闘画面になるの、説明が足りないだろ」\n\n手に入れた棒は、ただの棒だった。けれど腰に差した瞬間、勇者の立ち位置が少し変わった。避けていたものに近づける。近づけるということは、傷つく可能性も増える。\n\n勇者「勝てば報酬。負ければ痛い。労働より分かりやすいのに、全然楽じゃないな」\n\nここからはHPとMPの残量が、ただの数字ではなくなる。勇者はようやく、勇者らしい危険に手を伸ばした。`,
    farming: `勇者は「農業」を始められるようになった。\n\n勇者「俺が頑張らない間に育つものがある。かなり希望のある話だ」\n\n小さな畑のメモには、派手な儲け話は書かれていなかった。種を植える。水をやる。待つ。それだけだ。でも、その『待つ』の中に、勇者は久しぶりに少しだけ安心を見つけた。\n\n勇者「放置している時間が罪悪感じゃなくて育成時間になるなら、人生にもそういう畑が欲しい」\n\nここからは、作業を選ぶだけでなく、時間に任せる選択も増える。勇者の生活に、静かな成長の区切りが生まれた。`,
    mining: `勇者は「採掘」に向かえるようになった。\n\n勇者「岩を掘る仕事か。一発当てたい気持ちが、もう腰に来てる」\n\n古びたツルハシは、木の根元から出てきた。誰かが置いていった道具なのか、逃げるように手放した道具なのかは分からない。ただ、握ると重かった。\n\n勇者「重い素材は高く売れる。だいたい、重い理由も一緒についてくるんだよな」\n\n採掘は報酬を増やすが、失敗も疲労も増やす。生活はまた一段、硬い場所へ進む。`,
    adventure: `勇者は「冒険」に出られるようになった。\n\n勇者「ついに冒険か。名前だけなら本業っぽい。内容はたぶん、かなり労働だ」\n\n森の奥には、まだ見ていない道と、たぶん見たくない敵がいる。釣り糸や斧では届かなかった場所へ、勇者はひのきのぼうを握って進むことにした。\n\n勇者「前に進むしかない、みたいな顔をしてるけど、本音を言うと戻れる道も常に欲しい」\n\nここから物語は、稼ぐ生活から探索する生活へ少し広がる。発見と戦闘が、勇者の毎日に混ざり始める。`,
    office: `勇者は「王国勤務」に就けるようになった。\n\n勇者「安定収入。響きは強い。でも決まった時間に決まった場所へ行く魔法、かなり強力だな」\n\n王国の仕事は、冒険ほど派手ではない。けれど机、書類、上司、締め切りは、別の種類のモンスターとして静かに並んでいる。\n\n勇者「世界を救うより、出勤する方が難しい日もある。これはかなり重大な発見だ」\n\nここから勇者は、安定と拘束の取引を覚える。生活は整うかもしれない。心の余白は、別途見積もりになる。`,
    remote: `勇者は「在宅作業」を始められるようになった。\n\n勇者「通勤がない。すばらしい。仕事が家に入ってくる。すばらしくない」\n\nミュートボタンは小さいが、勇者には扉のように見えた。外界を少し閉じ、自分の部屋から仕事を受ける。便利さは、境界線を薄くしながらやってくる。\n\n勇者「家にいるのに休んでない状態、かなり高度な罠だな」\n\nここからは、場所に縛られない代わりに、時間と気分の管理が仕事になる。勇者の部屋に、新しい働き方と新しい散らかり方が入ってきた。`,
    shady: `勇者は「闇クエスト」を受けられるようになった。\n\n勇者「報酬が高い。説明が薄い。これは財布と胃が別々の意見を出すやつだ」\n\n赤い旗は、ただの布ではなかった。見ないふりをすれば進める。ちゃんと見れば足が止まる。勇者はその間で、しばらく黙った。\n\n勇者「危ない仕事ほど、最初は簡単そうな顔をしてくる。そういう顔、だいたい信用できない」\n\nここからは、稼げるけれど危うい道も選択肢になる。断ることも、進むことも、勇者の物語の分岐になる。`,
    delivery: `勇者は「配達アプリ」を起動できるようになった。\n\n勇者「スマホが鳴る。俺が走る。現代の召喚魔法、だいぶ雑だな」\n\n街は地図より複雑で、評価は天気より冷たいことがある。依頼を選んでいるつもりでも、通知に選ばれている気がしてくる。\n\n勇者「冒険者だった頃は地図の端が怖かった。今は配達先のピンが怖い」\n\nここから勇者は、街を走って小銭を積む。自由な働き方は、自由に疲れる働き方でもあった。`,
    streaming: `勇者は「動画投稿者」として動けるようになった。\n\n勇者「生活を切り抜いて、サムネを付けて、数字を見る。勇者業より心拍に悪いかもしれない」\n\nカメラの向こうに誰かがいる。いるかもしれない。いないかもしれない。その曖昧な気配に向かって、勇者は声を出すことにした。\n\n勇者「見られるために動くのか、動いた結果を見られるのか。順番を間違えると、かなりしんどいやつだ」\n\nここからは、作業だけでなく注目も資源になる。勇者の生活は、画面の向こう側へ少し漏れ出した。`,
  };
  return {
    id: `job-unlock-${key}`,
    job: job.name,
    area: '仕事解禁',
    text: texts[key] || `勇者は「${job.name}」を始められるようになった。\n\n勇者「新しい仕事が増えた。生活が広がったと言えば聞こえはいい。やることも増えた」\n\nここから勇者の毎日は、また少し別の方向へ進む。`,
    category: 'event',
    eventType: 'event',
    eventSubType: 'unlock',
    eventTarget: key,
    once: true,
    priority: 95,
  };
}

export function announceJobUnlocks(prev: GameState, next: GameState, now = Date.now()): GameState {
  const before = prev.unlockedJobs?.length ? prev.unlockedJobs : unlockedJobKeys(prev);
  const after = unlockedJobKeys(next);
  const newlyUnlocked = after.filter((key) => !before.includes(key));
  let state: GameState = { ...next, unlockedJobs: after };
  newlyUnlocked.forEach((key) => {
    state = {
      ...state,
      eventLog: [`仕事解禁：${jobs[key].name}。物語の区切りぼやきが届いた。`, ...state.eventLog].slice(0, 24),
    };
    state = enqueueMusing(state, jobUnlockMusing(key), { prepend: true, now }).state;
  });
  return state;
}

export function getFailChance(area: Area, jobUpgrades: import('../types').Upgrade[], ownedItems: Record<string, number>): number {
  const base = area.failChance ?? 0;
  if (base === 0) return 0;
  const reduction = jobUpgrades
    .filter((u) => ownedItems[u.id] && u.effects.failReduction)
    .reduce((sum, u) => sum + (u.effects.failReduction ?? 0), 0);
  return Math.max(0, base - reduction);
}

export function pickFailMusing(area: Area): string {
  const list = area.failMusings ?? [];
  if (!list.length) return '失敗した。';
  return list[Math.floor(Math.random() * list.length)];
}



