import { itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import type { GameState, ResourceKey } from '../types';
import { simulateMonsterBattle } from './combat';
import { getAdventureEntryCost, getChestLimit, getEquipmentBonus, getResourceGainMultiplier, getSellPriceMultiplier, maybeDropChest } from './equipment';
import { formatResourceName, rewardText } from './formatters';
import { enqueueMusing } from './musings';
import { getActiveArea, isJobUnlocked } from './requirements';
import { countOwnedUpgrades, getEffectiveDurationTicksForState } from './timing';
import { addAchievement, announceJobUnlocks, clamp, getFailChance, grantItemRewards, isUniqueItem, pickFailMusing, pickFreshMusing, randInt, rollDrops, xpToNext } from './progression';

const IDLE_MUSINGS = [
  '時間だけは定時退勤せず進む。見習いたくはない。',
  'なにもしていないのに少し進んでいる。放置、俺より勤勉だな。',
  '作業音だけが部屋にいる。俺より社会性がある。',
  '進捗は小さい。でも小銭も最初は小さい顔をして来る。',
  '放置が進む。俺は座っている。役割分担としては理想に近い。',
  '何もしない時間にも名前を付けたい。研究、とか。',
  '天井を見ている。天井は今日も昇進しない。安心する。',
  '呼吸のリズムを数えた。無料コンテンツにしては長持ちする。',
  '進捗がゆっくりだ。急がない成果は、ちょっと信用できる。',
  '何もしていないのに疲れた。才能の方向性を間違えている。',
  '放置の芸術。審査員がいたら寝たふりで通したい。',
  '時間が経つ。俺はそれを見守る係。責任は軽い。',
  '何もしないで得たものがある。何もしなかった記録だ。',
  '床を見ている。散らかっていても何も言わない。床、かなり寛容だ。',
  '放置が終わるのを待っている。待つ仕事なら履歴書に書ける。',
  '空を見ている。雲の勤務形態、かなり自由そうだ。',
  '放置が進む音はしない。静かな成果、性格がいい。',
  '進捗が見えない。見えないなら散らかってない扱いでいいか。',
  '何もしない技術が上がっている。資格名はまだない。',
  '存在確認をした。いた。今日の最低ラインは越えた。',
  '壁を見ている。壁は静かだ。俺の予定表より頼れる。',
  '放置中。今だけは時間が少し働いてくれている。',
  '窓の外は動いている。俺は動かない。分業ができている。',
  '進捗バーを見守っている。伸びるだけで褒めたくなる。',
  '見えない進捗を信じる。見えない筋肉よりは役に立つ。',
  '何もしないのに慣れてきた。問題は元から得意だったことだ。',
  '財布は静かだ。静かな財布ほど、あとで大声を出す。',
];

const DAILY_MUSINGS = [
  '布団はいつも正しい。布団に間違いはない。あるのは俺の人生だけ。',
  '低速で生きてもちゃんと生きている。高速で消耗するよりマシ。',
  'がんばらない技術にも熟練度がある。熟練度が上がると、がんばらないのが上手くなる。',
  '生活を整えるとは床を少し見せることかもしれない。全面公開はまだ早い。',
  '勇者は今日も生きている。難易度表示がないゲームほど手強い。',
  '世界は今日も動いている。俺は座っている。役割分担としては悪くない。',
  '今日も何も起きない。それが一番平和な出来事かもしれない。でも平和は退屈。',
  '窓の外は俺の悩みを知らない。知らないまま晴れている。強い。',
  '生活は続く。確認するだけの日も、いちおうログインボーナス扱いにしたい。',
  '何も変わらない日もある。セーブデータが壊れてない証拠だ。',
  '勇者は今日を生き抜いた。明日も生き抜けるかは明日の勇者に聞いて。今日の勇者はもう寝たい。',
  '日常は特別なことをしない特別な時間だ。特別なことをしないのが一番難しい。',
  '勇者は呼吸をしている。無料でできる行動としては、かなり長持ちする。',
  '今日も終わる。閉店作業だけ妙に上手くなっていく。',
  '今日を振り返る。反省より先に、首の角度が悪かった。',
  '明日を考える。考えすぎると明日が前借りで疲れる。',
  '今日を生き抜いた。派手な報酬画面はないが、布団がある。',
  '今日を終えた。完璧ではないが、未提出よりは強い。',
  '今日を始めた。開始ボタンを押しただけで偉業扱いにしたい。',
  '今日を過ごした。薄味でも一日分の経験値は入った。',
];

function maybeAmbientMusing(prev: GameState, now: number) {
  const elapsed = now - (prev.lastAmbientMusingAt || 0);
  if (elapsed < 30_000) return prev;
  if (elapsed < 60_000 && Math.random() >= 0.25) return prev;
  const useIdle = Math.random() < 0.7;
  const list = useIdle ? IDLE_MUSINGS : DAILY_MUSINGS;
  const text = list[Math.floor(Math.random() * list.length)];
  return enqueueMusing(prev, {
    id: `${useIdle ? 'idle' : 'daily'}-${list.indexOf(text)}`,
    job: '勇者',
    area: '放置時間',
    text,
    category: useIdle ? 'idle' : 'daily',
    eventType: useIdle ? 'idle' : 'daily',
    eventSubType: useIdle ? 'time_passed' : 'daily_chat',
    cooldownSec: 60,
  }, { now }).state;
}

function pickStateMusing(prev: GameState) {
  const resourceTotal = Object.values(prev.resources || {}).reduce((sum, value) => sum + value, 0);
  const activeJob = jobs[prev.activeJob];
  const affordableUpgrade = activeJob?.upgrades.find((u) => {
    if (prev.items?.[u.id] || prev.gold < u.cost.gold) return false;
    return Object.entries(u.cost.resources || {}).every(([key, value]) => (prev.resources[key as ResourceKey] || 0) >= value);
  });
  const itemTotal = Object.values(prev.items || {}).reduce((sum, value) => sum + value, 0);
  const jobLevelSum = Object.values(prev.jobData || {}).reduce((sum, data) => sum + (data.level || 0), 0);

  // HP/MP状態
  if (prev.hp / prev.maxHp < 0.2) return { id: 'state-critical-hp', text: 'HPが危険だ。労働より先に生存を実装してほしい。', conditionKey: 'state-critical-hp' };
  if (prev.hp / prev.maxHp < 0.3) return { id: 'state-low-hp', text: 'HPが少ない。労働より先に休息を実装してほしい。', conditionKey: 'state-low-hp' };
  if (prev.hp / prev.maxHp > 0.8) return { id: 'state-high-hp', text: 'HPは十分。元気な日に限って用事がこちらを見つける。', conditionKey: 'state-high-hp' };
  if (prev.mp / prev.maxMp < 0.15) return { id: 'state-critical-mp', text: 'MPが枯れ果てた。思考の電池切れだ。', conditionKey: 'state-critical-mp' };
  if (prev.mp / prev.maxMp < 0.25) return { id: 'state-low-mp', text: 'MPが枯れている。返信は明日の自分に任せたい。', conditionKey: 'state-low-mp' };
  if (prev.mp / prev.maxMp > 0.8) return { id: 'state-high-mp', text: 'MPは満タン。魔法を使わない勇者はただの体力の多い人だ。', conditionKey: 'state-high-mp' };

  // ゴールド状態
  if (prev.gold < 5) return { id: 'state-critical-gold', text: '財布が空っぽ。固定費が勇者を追いかけてくる。', conditionKey: 'state-critical-gold' };
  if (prev.gold < 10) return { id: 'state-low-gold', text: '財布が軽い。心まで軽くなるタイプではない。', conditionKey: 'state-low-gold' };
  if (prev.gold > 200) return { id: 'state-rich', text: '財布が重い。今だけは小銭の音をBGMにできる。', conditionKey: 'state-rich' };

  // 素材状態
  if (resourceTotal >= 200) return { id: 'state-too-many-resources', text: '素材が溢れている。部屋が素材で埋まりそうだ。', conditionKey: 'state-too-many-resources' };
  if (resourceTotal >= 100) return { id: 'state-many-resources', text: '素材が溜まってきた。部屋のすみの紙袋みたいになっている。', conditionKey: 'state-many-resources' };
  if (resourceTotal < 10) return { id: 'state-few-resources', text: '素材が少ない。何も始められない不安がある。', conditionKey: 'state-few-resources' };

  // アイテム状態
  if (itemTotal >= 20) return { id: 'state-many-items', text: 'アイテムが多い。整理整頓も立派な労働だ。', conditionKey: 'state-many-items' };
  if (itemTotal < 3) return { id: 'state-few-items', text: 'アイテムが少ない。荷物欄だけミニマリストを名乗れる。', conditionKey: 'state-few-items' };

  // アップグレード状態
  if (affordableUpgrade) return { id: `state-upgrade-${affordableUpgrade.id}`, text: `${affordableUpgrade.name}を買える。財布と相談するふりをしている。`, conditionKey: 'state-upgrade-ready' };

  // ジョブレベル状態
  if (jobLevelSum >= 20) return { id: 'state-high-levels', text: 'ジョブレベルが高い。いろいろできるようになったけどやることは増えた。', conditionKey: 'state-high-levels' };
  if (jobLevelSum < 5) return { id: 'state-low-levels', text: 'ジョブレベルが低い。まだ何もできない不安がある。', conditionKey: 'state-low-levels' };

  return null;
}

export function runTick(prev: GameState): GameState {
  if (!isJobUnlocked(prev.activeJob, prev)) return prev;
  const now = Date.now();
  const job = jobs[prev.activeJob];
  if (!job || job.type === 'farming') return prev;
  const area = getActiveArea(prev.activeJob, prev.activeArea);
  const data = prev.jobData[prev.activeJob] || { level: 1, xp: 0, seenMusings: [] };
  const ownedUpgradeCount = countOwnedUpgrades(job.upgrades.map((u) => u.id), prev.items || {});
  const nextTick = prev.tick + 1;
  const durationTicks = getEffectiveDurationTicksForState(area.seconds, data.level, ownedUpgradeCount, prev, prev.activeJob);
  const hpRegen = 1 + Math.floor(getEquipmentBonus(prev, 'hpRegen') / 25);
  const mpRegen = 1 + Math.floor(getEquipmentBonus(prev, 'mpRegen') / 25);
  const recoveredHp = clamp(prev.hp + hpRegen, 0, prev.maxHp);
  const recoveredMp = clamp(prev.mp + mpRegen, 0, prev.maxMp);
  if (nextTick % durationTicks !== 0) return maybeAmbientMusing({ ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false }, now);
  if (job.type === 'combat' && (recoveredHp < 3 || recoveredMp < 2)) {
    const next = { ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false, feedbackEvents: [...(prev.feedbackEvents || []), { id: `failure-${now}`, type: 'failure' as const }].slice(-24), eventLog: ['HP/MPが足りないので一旦ふんわり休んだ。勇者、急に現実的。', ...prev.eventLog].slice(0, 24) };
    return enqueueMusing(next, { id: 'failure-combat-stamina', job: job.name, area: area.name, text: 'HP/MPが足りない。勇者は戦う前に、まず自分の残量と戦っている。', category: 'failure', eventType: 'failure', eventSubType: 'not_enough_stamina', conditionKey: 'failure-stamina', cooldownSec: 5 }, { now }).state;
  }
  if (job.type === 'adventure' && (recoveredHp < 5 || recoveredMp < 3)) {
    const next = { ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false, feedbackEvents: [...(prev.feedbackEvents || []), { id: `failure-${now}`, type: 'failure' as const }].slice(-24), eventLog: ['HP/MPが足りないので一旦ふんわり休んだ。冒険も体力が必要だ。', ...prev.eventLog].slice(0, 24) };
    return enqueueMusing(next, { id: 'failure-adventure-stamina', job: job.name, area: area.name, text: 'HP/MPが足りない。冒険の前に、生活の基礎体力が足りていない。', category: 'failure', eventType: 'failure', eventSubType: 'not_enough_stamina', conditionKey: 'failure-stamina', cooldownSec: 5 }, { now }).state;
  }

  // 失敗判定
  const failChance = getFailChance(area, job.upgrades, prev.items || {});
  if (failChance > 0 && Math.random() < failChance) {
    const failText = pickFailMusing(area);
    const next = {
      ...prev,
      tick: nextTick - (durationTicks - 1), // ゲージをリセット（次サイクルの先頭へ）
      hp: recoveredHp,
      mp: recoveredMp,
      progressBreaking: true,
      feedbackEvents: [...(prev.feedbackEvents || []), { id: `failure-${now}`, type: 'failure' as const }].slice(-24),
      eventLog: [`⚡ 失敗：${failText}`, ...prev.eventLog].slice(0, 24),
    };
    return enqueueMusing(next, {
      id: `failure-${area.id}-${failText}`,
      job: job.name,
      area: area.name,
      text: `勇者「${failText}」`,
      category: 'failure',
      eventType: 'failure',
      eventSubType: 'work_failed',
      conditionKey: `failure-${area.id}`,
      cooldownSec: 5,
    }, { now }).state;
  }

  let adventureGold = 0;
  let adventureXp = 0;
  let adventureHpCost = 0;
  let adventureMpCost = 0;
  const adventureEntryCost = job.type === 'adventure' ? getAdventureEntryCost(prev, area.adventureCost || 0) : 0;
  let bonusGold = 0;
  let level = data.level;
  let xp = data.xp + (area.rewards.xp || 0) + adventureXp;
  const eventLog: string[] = [];
  const seenMusings = [...(data.seenMusings || [])];
  const queue = [...(prev.musingQueue || [])];
  let musingState = prev;
  const nextItems = { ...(prev.items || {}) };
  const resources = { ...prev.resources };
  const gainedDrops = rollDrops(area.drops).filter((d) => !isUniqueItem(d.item) || !prev.items?.[d.item]);
  const newItems = gainedDrops.filter((d) => !prev.items?.[d.item]).map((d) => d.item);
  let achievements = prev.achievements || [];
  let defeatedMonsters = prev.defeatedMonsters || [];
  let treasureChests = [...(prev.treasureChests || [])];
  const feedbackEvents = [...(prev.feedbackEvents || [])];
  const combo = prev.combo || { streak: 0, boons: {} };
  const nextBoons = { ...(combo.boons || {}) };
  const nextStreak = combo.lastJob === prev.activeJob ? (combo.streak || 0) + 1 : 1;
  const comboLogs: string[] = [];
  const consumeBoon = (key: string) => {
    if (!nextBoons[key]) return false;
    nextBoons[key] -= 1;
    if (nextBoons[key] <= 0) delete nextBoons[key];
    return true;
  };
  const addFeedback = (type: typeof feedbackEvents[number]['type'], label?: string) => {
    feedbackEvents.push({ id: `${type}-${now}-${feedbackEvents.length}-${Math.floor(Math.random() * 10000)}`, type, label });
  };

  if (adventureEntryCost > 0) {
    if (prev.gold < adventureEntryCost) {
      const next = {
        ...prev,
        tick: nextTick - (durationTicks - 1),
        hp: recoveredHp,
        mp: recoveredMp,
        progressBreaking: true,
        feedbackEvents: [...(prev.feedbackEvents || []), { id: `failure-adventure-gold-${now}`, type: 'failure' as const }].slice(-24),
        eventLog: [`冒険費用不足：${area.name}には${adventureEntryCost}G必要。財布が先に撤退した。`, ...prev.eventLog].slice(0, 24),
      };
      return enqueueMusing(next, {
        id: `failure-adventure-gold-${area.id}`,
        job: job.name,
        area: area.name,
        text: `冒険に出るGが足りない。\n\n勇者「勇気はある。たぶんある。でも交通費がない。冒険、急に現実的だな」`,
        category: 'failure',
        eventType: 'failure',
        eventSubType: 'not_enough_gold_for_adventure',
        conditionKey: `failure-adventure-gold-${area.id}`,
        cooldownSec: 5,
      }, { now }).state;
    }
    addFeedback('adventureStart');
    eventLog.unshift(`冒険出発：${area.name}へ-${adventureEntryCost}G。冒険もまず経費から始まる。`);
  }

  const grantMusingRewards = (musing: { rewardItems?: Array<{ item: string; amount: number }> }) => {
    if (!musing.rewardItems?.length) return;
    const result = grantItemRewards(nextItems, musing.rewardItems);
    Object.keys(nextItems).forEach((key) => delete nextItems[key]);
    Object.assign(nextItems, result.items);
    if (result.granted.length) eventLog.unshift(`出来事報酬：${rewardText(result.granted)}`);
  };
  const addMusing = (rawMusing: Parameters<typeof enqueueMusing>[1], options: { prepend?: boolean } = {}) => {
    const rewardItems = rawMusing.rewardItems?.filter((rewardItem) => !isUniqueItem(rewardItem.item) || !nextItems[rewardItem.item]);
    const musingForQueue = rawMusing.rewardItems ? { ...rawMusing, rewardItems } : rawMusing;
    const result = enqueueMusing({ ...prev, ...musingState, musingQueue: queue }, musingForQueue, { ...options, now });
    musingState = result.state;
    queue.splice(0, queue.length, ...(result.state.musingQueue || []));
    if (result.accepted) grantMusingRewards(result.musing);
    return result.accepted;
  };

  gainedDrops.forEach((d) => {
    nextItems[d.item] = isUniqueItem(d.item) ? 1 : (nextItems[d.item] || 0) + d.amount;
  });
  if (Math.random() < 0.022) {
    const bonusResource = (Object.keys(resources) as ResourceKey[]).find((key) => Boolean(area.rewards[key]));
    const luckyType = Math.random();
    let luckyLog = '';
    let luckyText = '';
    if (bonusResource && luckyType < 0.42) {
      const amount = randInt(2, 5);
      resources[bonusResource] += amount;
      luckyLog = `手応えあり：${formatResourceName(bonusResource)}+${amount}。進捗が急に機嫌を直した。`;
      luckyText = `作業の手応えがいつもより大きい。\n\n勇者「同じことをしたのに成果が増えた。こういう偶然だけ定期便にしてほしい」`;
    } else if (luckyType < 0.76 && job.type !== 'adventure') {
      bonusGold = randInt(10, 24) + Math.floor((data.level || 1) * 2.5);
      luckyLog = `小さな幸運：+${bonusGold}G。こういう日だけ日記に残したい。`;
      luckyText = `小さな幸運が転がり込んだ。\n\n勇者「努力より先に運が来た。順番はどうあれ、来たものは受け取る」`;
    } else {
      const luckyXp = randInt(5, 12) + Math.floor((data.level || 1) / 2);
      xp += luckyXp;
      luckyLog = `コツを掴んだ：XP+${luckyXp}。急に分かる瞬間、たまにある。`;
      luckyText = `作業のコツが少し見えた。\n\n勇者「分かった気がする。気のせいでも、進むなら採用でいい」`;
    }
    eventLog.unshift(luckyLog);
    addFeedback(bonusResource || bonusGold > 0 ? 'multiReward' : 'rareDrop');
    addMusing({
      id: `lucky-${prev.activeJob}-${area.id}-${now}`,
      job: job.name,
      area: area.name,
      text: luckyText,
      category: 'event',
      eventType: 'event',
      eventSubType: 'lucky_break',
      conditionKey: 'lucky-break',
      cooldownSec: 100,
    });
  }
  let sellGold = 0;
  let soldText = '';
  if (area.sell) {
    const owned = resources[area.sell.resource] || 0;
    const sellAmount = Math.min(owned, randInt(area.sell.amount[0], area.sell.amount[1]));
    if (sellAmount > 0) {
      sellGold = Math.max(1, Math.floor(sellAmount * area.sell.price * getSellPriceMultiplier(prev)));
      resources[area.sell.resource] = Math.max(0, owned - sellAmount);
      soldText = `${formatResourceName(area.sell.resource)}-${sellAmount} / +${sellGold}G`;
      addFeedback('sale');
      achievements = addAchievement({ ...prev, achievements }, 'first_sale', eventLog);
      addMusing({
        id: 'first-sale',
        job: job.name,
        area: area.name,
        text: `勇者は初めて素材を売った。\n\n勇者「社会との接点、だいたい換金から始まるんだな」`,
        category: 'firstTime',
        eventType: 'firstTime',
        eventSubType: 'first_sale',
        once: true,
      });
      nextBoons.market_sense = Math.max(nextBoons.market_sense || 0, 3);
      achievements = addAchievement({ ...prev, achievements }, 'first_combo', eventLog);
    }
  }
  if (area.sellItems?.length) {
    const sellTarget = area.sellItems.find((candidate) => (nextItems[candidate.item] || 0) > 0);
    if (sellTarget) {
      const owned = nextItems[sellTarget.item] || 0;
      const sellAmount = Math.min(owned, randInt(sellTarget.amount[0], sellTarget.amount[1]));
      if (sellAmount > 0) {
        const itemGold = Math.max(1, Math.floor(sellAmount * sellTarget.price * getSellPriceMultiplier(prev)));
        sellGold += itemGold;
        nextItems[sellTarget.item] = Math.max(0, owned - sellAmount);
        soldText = `${soldText ? `${soldText} / ` : ''}${itemName(sellTarget.item)}-${sellAmount} / +${itemGold}G`;
        addFeedback('sale');
        achievements = addAchievement({ ...prev, achievements }, 'first_sale', eventLog);
        addMusing({
          id: 'first-item-sale',
          job: job.name,
          area: area.name,
          text: `勇者は初めて戦利品を売った。\n\n勇者「思い出より収納場所が大事な日もある。今日はその日だ」`,
          category: 'firstTime',
          eventType: 'firstTime',
          eventSubType: 'first_item_sale',
          once: true,
        });
        nextBoons.market_sense = Math.max(nextBoons.market_sense || 0, 3);
        achievements = addAchievement({ ...prev, achievements }, 'first_combo', eventLog);
      }
    }
  }

  const combatEvents: string[] = [];
  if (job.type === 'combat') {
    combatEvents.push(`勇者の攻撃：${area.name}へ、ひのきのぼうで現実的な一撃。`);
    combatEvents.push(`敵の反撃：HP${Math.abs(area.rewards.hp || 0)} / MP${Math.abs(area.rewards.mp || 0)}を消耗。仕事より説明がシンプル。`);
    if (gainedDrops.length) combatEvents.push(`戦利品：${gainedDrops.map((d) => `${itemName(d.item)}+${d.amount}`).join(' / ')}`);
    achievements = addAchievement({ ...prev, achievements }, 'first_battle', eventLog);
    addMusing({
      id: 'first-battle',
      job: job.name,
      area: area.name,
      text: `勇者は初めて戦闘を終えた。\n\n勇者「勝った。勝ったけど、働くより説明が短いだけで疲れるな」`,
      category: 'firstTime',
      eventType: 'firstTime',
      eventSubType: 'first_battle',
      once: true,
    });
  }

  if (prev.activeJob === 'rest') {
    nextBoons.rested = Math.max(nextBoons.rested || 0, 4);
    comboLogs.push('生活コンボ：休憩で「よく休んだ」を得た。次の数回、戦闘と冒険の消耗が軽くなる。');
    achievements = addAchievement({ ...prev, achievements }, 'first_combo', eventLog);
    addMusing({
      id: 'first-rest',
      job: job.name,
      area: area.name,
      text: `勇者は初めてちゃんと休んだ。\n\n勇者「ゲームでも現実でも、休むのがいちばん軽視されがちだ」`,
      category: 'firstTime',
      eventType: 'firstTime',
      eventSubType: 'first_rest',
      once: true,
    });
  }

  if (job.type === 'adventure') {
    if (area.encounterChance && area.monsters && Math.random() < area.encounterChance) {
      const monster = area.monsters[Math.floor(Math.random() * area.monsters.length)];
      const battle = simulateMonsterBattle({ ...prev, hp: recoveredHp, mp: recoveredMp }, job, monster, data.level);
      combatEvents.push(...battle.logs);
      if (!battle.won) {
        addMusing({
          id: `failure-monster-${monster.id}-${now}`,
          job: job.name,
          area: area.name,
          text: `勇者は${monster.name}から撤退した。\n\n勇者「勝てない戦いを避けた。これは敗北じゃなくて、明日の俺への引き継ぎだ」`,
          category: 'failure',
          eventType: 'failure',
          eventSubType: 'battle_retreat',
          conditionKey: `battle-retreat-${monster.id}`,
          cooldownSec: 8,
        });
        adventureHpCost = Math.min(recoveredHp, Math.ceil(battle.hpCost * 0.7) + 1);
        adventureMpCost = Math.min(recoveredMp, Math.max(1, Math.ceil(battle.mpCost * 0.7)));
      } else {
      const monsterDrops = rollDrops(monster.drops).filter((d) => !isUniqueItem(d.item) || !nextItems[d.item]);
      if (monsterDrops.length) combatEvents.push(`戦利品：${monsterDrops.map((d) => `${itemName(d.item)}+${d.amount}`).join(' / ')}`);
      monsterDrops.forEach((d) => {
        nextItems[d.item] = isUniqueItem(d.item) ? 1 : (nextItems[d.item] || 0) + d.amount;
      });
      adventureGold = 0;
      adventureXp = monster.rewards.xp || 0;
      adventureHpCost = battle.hpCost;
      adventureMpCost = battle.mpCost;
      combatEvents.push(`戦闘結果：+${adventureXp}XP。Gは落ちない。冒険を財布で永久機関にしないための現実。`);
      addFeedback('adventureSuccess');
      achievements = addAchievement({ ...prev, achievements }, 'first_battle', eventLog);
      addMusing({
        id: 'first-battle',
        job: job.name,
        area: area.name,
        text: `勇者は初めて戦闘を終えた。\n\n勇者「勝った。勝ったけど、働くより説明が短いだけで疲れるな」`,
        category: 'firstTime',
        eventType: 'firstTime',
        eventSubType: 'first_battle',
        once: true,
      });
      // 新しいモンスター撃破時のぼやきを発生させる
      const isFirstDefeat = !defeatedMonsters.includes(monster.id);
      if (isFirstDefeat) {
        const monsterMusing = {
          id: `new-monster-${monster.id}`,
          job: job.name,
          area: area.name,
          text: `勇者は${monster.name}を倒した。\n\n勇者「初めての${monster.name}。勝てたけど、次からは事前予約制にしてほしい」`,
          category: 'event',
          eventType: 'event' as const,
          eventSubType: 'new_monster',
          eventTarget: monster.id,
          once: true,
        };
        addMusing(monsterMusing);
        defeatedMonsters = [...defeatedMonsters, monster.id];
      }
      }
      if (adventureHpCost || adventureMpCost) {
        const costMultiplier = Math.max(0.5, 1 - getEquipmentBonus(prev, 'adventureCost') / 100);
        adventureHpCost = Math.floor(adventureHpCost * costMultiplier);
        adventureMpCost = Math.floor(adventureMpCost * costMultiplier);
        if (consumeBoon('rested')) {
          adventureHpCost = Math.floor(adventureHpCost * 0.75);
          adventureMpCost = Math.floor(adventureMpCost * 0.75);
          combatEvents.push('生活コンボ：よく休んでいたので消耗が少し軽い。休息、ちゃんと防具。');
        }
        if (consumeBoon('home_meal')) {
          adventureHpCost = Math.floor(adventureHpCost * 0.85);
          adventureMpCost = Math.floor(adventureMpCost * 0.85);
          combatEvents.push('生活コンボ：収穫飯が効いた。腹持ちは戦闘力。');
        }
      }
    } else {
      combatEvents.push(`探索：${area.name}を静かに歩いた。何も出なかった。平和だ。`);
    }
  }
  xp += adventureXp;
  if (nextStreak >= 3) {
    const streakXp = Math.min(8, Math.floor(nextStreak / 3));
    xp += streakXp;
    comboLogs.push(`連続作業：${job.name}${nextStreak}周目。慣れでXP+${streakXp}。反復、地味に強い。`);
    achievements = addAchievement({ ...prev, achievements }, 'work_streak', eventLog);
  }
  if (consumeBoon('daily_rhythm')) {
    const rhythmXp = 3 + Math.min(6, Math.floor((data.level || 1) / 2));
    xp += rhythmXp;
    comboLogs.push(`生活コンボ：生活リズムでXP+${rhythmXp}。来ただけの日にも、ちゃんと余熱がある。`);
  }

  if (Math.random() < 0.75 && area.musings.length) {
    const selected = pickFreshMusing(area, seenMusings);
    if (selected.fresh) seenMusings.push(selected.key);
    const exists = queue.some((m) => m.text === selected.text) || prev.currentMusing?.text === selected.text;
    if (!exists) {
      const subType = selected.eventSubType || selected.eventType || selected.category || 'work';
      const musing = { id: `${prev.activeJob}-${selected.key}`, job: job.name, area: area.name, text: selected.text, rewardItems: selected.rewardItems || [], category: selected.category || 'event', eventType: selected.eventType || 'event' as const, eventSubType: subType };
      addMusing(musing);
    }
  }

  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    eventLog.push(`${job.name}Lv${level}：同じ仕事でも、見える景色と悩みが少し変わった。`);
    if (prev.activeJob === 'fishing' && level >= 2) achievements = addAchievement({ ...prev, achievements }, 'fishing_lv2', eventLog);
    // レベルアップ時のぼやきを発生させる
    const levelMusing = job.levelMusings?.[level]?.[0] || {
      text: `${job.name}Lv${level}：${area.name}での仕事が一段進んだ。\n\n勇者「同じ仕事のはずなのに、Lvが上がると見える面倒も少し具体的になるな」`,
      rewardItems: [],
      category: 'milestone',
      eventType: 'milestone' as const,
      eventSubType: 'level_up',
    };
    if (levelMusing) {
      const musing = {
        id: `${prev.activeJob}-level-${level}`,
        job: job.name,
        area: area.name,
        text: levelMusing.text,
        rewardItems: levelMusing.rewardItems,
        category: 'milestone',
        eventType: 'milestone' as const,
        eventSubType: levelMusing.eventSubType || 'level_up',
        eventLevel: level,
        once: true,
      };
      addMusing(musing);
    }
  }

  const reward = area.rewards;
  const baseGoldGain = job.type === 'adventure' || !reward.gold ? 0 : randInt(reward.gold[0], reward.gold[1]);
  let goldGain = baseGoldGain + sellGold + adventureGold + bonusGold - adventureEntryCost;
  if (goldGain > 0 && prev.activeJob !== 'merchant' && consumeBoon('market_sense')) {
    const marketBonus = Math.max(1, Math.floor(goldGain * 0.12));
    goldGain += marketBonus;
    comboLogs.push(`生活コンボ：相場勘で+${marketBonus}G。売った経験が、次の小銭を呼んだ。`);
  }
  Object.keys(resources).forEach((key) => {
    const k = key as ResourceKey;
    if (reward[k]) resources[k] += Math.max(1, Math.floor(randInt(reward[k]![0], reward[k]![1]) * getResourceGainMultiplier(prev, k)));
  });
  const resourceText = Object.keys(resources).filter((key) => reward[key as ResourceKey]).map((key) => `${formatResourceName(key)}+${resources[key as ResourceKey] - prev.resources[key as ResourceKey]}`).join(' / ');
  const itemText = gainedDrops.map((d) => `${itemName(d.item)}+${d.amount}${itemKind(d.item) === '重要' ? '★' : ''}`).join(' / ');
  const chestDrop = maybeDropChest({ ...prev, treasureChests }, prev.activeJob, job.type, area.id);
  let chestText = '';
  if (chestDrop) {
    treasureChests = [chestDrop, ...treasureChests].slice(0, getChestLimit(prev));
    chestText = chestDrop.name;
    addFeedback('rareDrop', chestDrop.name);
    eventLog.unshift(`宝箱発見：${chestDrop.name}。帰ってから開ける楽しみが増えた。`);
    achievements = addAchievement({ ...prev, achievements }, 'first_chest', eventLog);
    addMusing({
      id: 'first-chest-drop',
      job: job.name,
      area: area.name,
      text: `勇者は宝箱を拾った。\n\n勇者「開ける前が一番楽しい。予定と宝箱だけは、未開封のうちが少し輝く」`,
      category: 'firstTime',
      eventType: 'firstTime',
      eventSubType: 'chest_drop',
      eventTarget: chestDrop.type,
      once: true,
    });
  }
  const goldText = goldGain > 0 ? `+${goldGain}G` : goldGain < 0 ? `${goldGain}G` : '';

  if (area.sell || area.sellItems?.length) eventLog.push(`商人売却：${soldText || '売る素材がない。看板だけが今日も働いている。'}`);
  else if (job.type === 'combat') eventLog.push(`戦闘結果：${goldText || '+0G'}${itemText ? ` / ${itemText}` : ''}${chestText ? ` / ${chestText}` : ''}`);
  else if (job.type === 'adventure') eventLog.push(`探索収支：${goldText || '±0G'}${itemText ? ` / ${itemText}` : ''}${chestText ? ` / ${chestText}` : ''}`);
  else if (goldGain || resourceText || itemText || chestText) eventLog.push(`作業獲得：${goldText}${goldText && (resourceText || itemText || chestText) ? ' / ' : ''}${resourceText}${resourceText && (itemText || chestText) ? ' / ' : ''}${itemText}${itemText && chestText ? ' / ' : ''}${chestText}`);
  if (newItems.length) eventLog.unshift(`新発見：${newItems.map(itemName).join(' / ')}。図鑑の？？？がひとつ減った。`);
  eventLog.unshift(...comboLogs);

  if (nextItems.small_fish) achievements = addAchievement({ ...prev, achievements }, 'first_fish', eventLog);
  if (nextItems.hinoki_stick) achievements = addAchievement({ ...prev, achievements }, 'unlock_combat', eventLog);
  if (nextItems.rusty_armor_plate || nextItems.overdue_notice) achievements = addAchievement({ ...prev, achievements }, 'first_castle', eventLog);
  if (nextItems.castle_key_fragment || nextItems.quiet_crown) achievements = addAchievement({ ...prev, achievements }, 'first_inner_castle', eventLog);
  if (nextItems.pebble_ore) achievements = addAchievement({ ...prev, achievements }, 'first_ore', eventLog);
  if (nextItems.employee_badge) achievements = addAchievement({ ...prev, achievements }, 'first_office', eventLog);
  if (nextItems.mute_button) achievements = addAchievement({ ...prev, achievements }, 'first_remote', eventLog);
  if (nextItems.red_flag) achievements = addAchievement({ ...prev, achievements }, 'first_shady', eventLog);
  if (nextItems.delivery_app) achievements = addAchievement({ ...prev, achievements }, 'first_delivery', eventLog);
  if (nextItems.webcam || nextItems.mic) achievements = addAchievement({ ...prev, achievements }, 'first_streaming', eventLog);
  if (isJobUnlocked('merchant', { ...prev, jobData: { ...prev.jobData, [prev.activeJob]: { level, xp, seenMusings } } })) achievements = addAchievement({ ...prev, achievements }, 'unlock_merchant', eventLog);
  const progressState = {
    ...prev,
    achievements,
    gold: Math.max(0, prev.gold + goldGain),
    items: nextItems,
    resources,
    jobData: { ...prev.jobData, [prev.activeJob]: { level, xp, seenMusings } },
  };
  const unlockedJobCount = Object.keys(jobs).filter((key) => isJobUnlocked(key, progressState)).length;
  const totalUpgradeCount = Object.values(jobs).reduce((sum, candidateJob) => sum + candidateJob.upgrades.length, 0);
  const totalOwnedUpgradeCount = Object.values(jobs).flatMap((candidateJob) => candidateJob.upgrades).filter((upgrade) => nextItems[upgrade.id]).length;
  const highestJobLevel = Math.max(...Object.values(progressState.jobData).map((candidate) => candidate.level || 1));
  if (unlockedJobCount === Object.keys(jobs).length) achievements = addAchievement({ ...prev, achievements }, 'all_jobs_unlocked', eventLog);
  if (unlockedJobCount === Object.keys(jobs).length && totalOwnedUpgradeCount >= Math.ceil(totalUpgradeCount * 0.6) && highestJobLevel >= 8 && achievements.length >= 10) {
    achievements = addAchievement({ ...prev, achievements }, 'release_goal', eventLog);
  }

  const stateMusing = pickStateMusing({ ...prev, hp: recoveredHp, mp: recoveredMp, gold: prev.gold + goldGain, resources, items: nextItems });
  if (stateMusing) {
    addMusing({
      ...stateMusing,
      job: job.name,
      area: area.name,
      category: 'state',
      eventType: 'state',
      eventSubType: 'resource_state',
      cooldownSec: 60,
    });
  }
  if (!feedbackEvents.some((event) => event.id.includes(`-${now}-`))) {
    addFeedback((goldGain > 0 || resourceText || itemText) && (goldGain > 15 || gainedDrops.length > 1) ? 'multiReward' : 'workComplete');
  }

  const nextState: GameState = {
    ...prev,
    tick: nextTick,
    progressBreaking: false,
    gold: Math.max(0, prev.gold + goldGain),
    hp: clamp(recoveredHp + (job.type === 'combat' ? (reward.hp || 0) : 0) + (job.type === 'adventure' ? -adventureHpCost : 0), 0, prev.maxHp),
    mp: clamp(recoveredMp + (job.type === 'combat' ? (reward.mp || 0) : 0) + (job.type === 'adventure' ? -adventureMpCost : 0), 0, prev.maxMp),
    resources,
    items: nextItems,
    jobData: { ...prev.jobData, [prev.activeJob]: { level, xp, seenMusings } },
    musingQueue: queue.slice(-20),
    combatLog: combatEvents.length ? [...combatEvents, ...(prev.combatLog || [])].slice(0, 12) : (prev.combatLog || []),
    achievements,
    equipmentInventory: prev.equipmentInventory || [],
    equipped: prev.equipped || {},
    seenEquipmentBaseIds: prev.seenEquipmentBaseIds || [],
    equipmentDropLog: prev.equipmentDropLog || [],
    treasureChests,
    openedChestLog: prev.openedChestLog || [],
    feedbackEvents: feedbackEvents.slice(-24),
    eventLog: [...eventLog, ...prev.eventLog].slice(0, 24),
    defeatedMonsters,
    combo: { lastJob: prev.activeJob, streak: nextStreak, boons: nextBoons },
    seenMusingIds: musingState.seenMusingIds,
    recentMusingIds: musingState.recentMusingIds,
    musingCooldowns: musingState.musingCooldowns,
    lastAmbientMusingAt: musingState.lastAmbientMusingAt,
    lastCertainMusingAt: musingState.lastCertainMusingAt,
  };
  return announceJobUnlocks(prev, nextState, now);
}
