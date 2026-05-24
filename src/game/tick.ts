import { itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import type { GameState, ResourceKey } from '../types';
import { formatResourceName, rewardText } from './formatters';
import { enqueueMusing } from './musings';
import { getActiveArea, isJobUnlocked } from './requirements';
import { countOwnedUpgrades, getEffectiveDurationTicks } from './timing';
import { addAchievement, announceJobUnlocks, clamp, getFailChance, pickFailMusing, pickFreshMusing, randInt, rollDrops, xpToNext } from './progression';

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
  '床を見ている。床は散らかりを責めない。器が大きい。',
  '放置が終わるのを待っている。待つ仕事なら履歴書に書ける。',
  '空を見ている。雲の勤務形態、かなり自由そうだ。',
  '放置が進む音はしない。静かな成果、性格がいい。',
  '進捗が見えない。見えないなら散らかってない扱いでいいか。',
  '何もしない技術が上がっている。資格名はまだない。',
  '存在確認をした。いた。今日の最低ラインは越えた。',
  '壁を見ている。壁は静かだ。俺の予定表より頼れる。',
  '放置中。今だけは時間に雇われている気分だ。',
  '窓の外は動いている。俺は動かない。分業ができている。',
  '進捗バーを見守っている。育児に近いが、泣かない。',
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
  '世界は回っている。勇者は回転に乗っているだけだ。でも回転に酔う。',
  '今日も何も起きない。それが一番平和な出来事かもしれない。でも平和は退屈。',
  '窓の外は俺の悩みを知らない。知らないまま晴れている。強い。',
  '生活は続く。確認するだけの日も、いちおうログインボーナス扱いにしたい。',
  '何も変わらない日もある。セーブデータが壊れてない証拠だ。',
  '勇者は今日を生き抜いた。明日も生き抜けるかは明日の勇者に聞いて。今日の勇者はもう寝たい。',
  '日常は特別なことをしない特別な時間だ。特別なことをしないのが一番難しい。',
  '勇者は呼吸をしている。呼吸は無料でできる唯一の魔法。でも魔法使いは給料が高い。',
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
  const durationTicks = getEffectiveDurationTicks(area.seconds, data.level, ownedUpgradeCount);
  const recoveredHp = clamp(prev.hp + 1, 0, prev.maxHp);
  const recoveredMp = clamp(prev.mp + 1, 0, prev.maxMp);
  if (nextTick % durationTicks !== 0) return maybeAmbientMusing({ ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false }, now);
  if (job.type === 'combat' && (recoveredHp < 3 || recoveredMp < 2)) {
    const next = { ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false, eventLog: ['HP/MPが足りないので一旦ふんわり休んだ。勇者、急に現実的。', ...prev.eventLog].slice(0, 24) };
    return enqueueMusing(next, { id: 'failure-combat-stamina', job: job.name, area: area.name, text: 'HP/MPが足りない。勇者は戦う前に、まず自分の残量と戦っている。', category: 'failure', eventType: 'failure', eventSubType: 'not_enough_stamina', conditionKey: 'failure-stamina', cooldownSec: 5 }, { now }).state;
  }
  if (job.type === 'adventure' && (recoveredHp < 5 || recoveredMp < 3)) {
    const next = { ...prev, tick: nextTick, hp: recoveredHp, mp: recoveredMp, progressBreaking: false, eventLog: ['HP/MPが足りないので一旦ふんわり休んだ。冒険も体力が必要だ。', ...prev.eventLog].slice(0, 24) };
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
  let level = data.level;
  let xp = data.xp + (area.rewards.xp || 0) + adventureXp;
  const eventLog: string[] = [];
  const seenMusings = [...(data.seenMusings || [])];
  const queue = [...(prev.musingQueue || [])];
  let musingState = prev;
  const nextItems = { ...(prev.items || {}) };
  const resources = { ...prev.resources };
  const gainedDrops = rollDrops(area.drops);
  const newItems = gainedDrops.filter((d) => !prev.items?.[d.item]).map((d) => d.item);
  let achievements = prev.achievements || [];
  let defeatedMonsters = prev.defeatedMonsters || [];

  const grantMusingRewards = (musing: { rewardItems?: Array<{ item: string; amount: number }> }) => {
    if (!musing.rewardItems?.length) return;
    musing.rewardItems.forEach((rewardItem) => {
      nextItems[rewardItem.item] = (nextItems[rewardItem.item] || 0) + rewardItem.amount;
    });
    eventLog.unshift(`出来事報酬：${rewardText(musing.rewardItems)}`);
  };
  const addMusing = (rawMusing: Parameters<typeof enqueueMusing>[1], options: { prepend?: boolean } = {}) => {
    const result = enqueueMusing({ ...prev, ...musingState, musingQueue: queue }, rawMusing, { ...options, now });
    musingState = result.state;
    queue.splice(0, queue.length, ...(result.state.musingQueue || []));
    if (result.accepted) grantMusingRewards(result.musing);
    return result.accepted;
  };

  gainedDrops.forEach((d) => { nextItems[d.item] = (nextItems[d.item] || 0) + d.amount; });
  let sellGold = 0;
  let soldText = '';
  if (area.sell) {
    const owned = resources[area.sell.resource] || 0;
    const sellAmount = Math.min(owned, randInt(area.sell.amount[0], area.sell.amount[1]));
    if (sellAmount > 0) {
      sellGold = sellAmount * area.sell.price;
      resources[area.sell.resource] = Math.max(0, owned - sellAmount);
      soldText = `${formatResourceName(area.sell.resource)}-${sellAmount} / +${sellGold}G`;
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
      combatEvents.push(`⚔️ ${monster.name}が現れた！`);
      combatEvents.push(`勇者の攻撃：ひのきのぼうで現実的な一撃。`);
      combatEvents.push(`${monster.name}の反撃：HP${monster.attack} / MP${Math.floor(monster.attack / 2)}を消耗。`);
      const monsterDrops = rollDrops(monster.drops);
      if (monsterDrops.length) combatEvents.push(`戦利品：${monsterDrops.map((d) => `${itemName(d.item)}+${d.amount}`).join(' / ')}`);
      monsterDrops.forEach((d) => { nextItems[d.item] = (nextItems[d.item] || 0) + d.amount; });
      adventureGold = monster.rewards.gold ? randInt(monster.rewards.gold[0], monster.rewards.gold[1]) : 0;
      adventureXp = monster.rewards.xp || 0;
      adventureHpCost = monster.attack;
      adventureMpCost = Math.floor(monster.attack / 2);
      combatEvents.push(`戦闘結果：+${adventureGold}G / +${adventureXp}XP`);
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
    } else {
      combatEvents.push(`探索：${area.name}を静かに歩いた。何も出なかった。平和だ。`);
    }
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
  const goldGain = (reward.gold ? randInt(reward.gold[0], reward.gold[1]) : 0) + sellGold + adventureGold;
  Object.keys(resources).forEach((key) => {
    const k = key as ResourceKey;
    if (reward[k]) resources[k] += randInt(reward[k]![0], reward[k]![1]);
  });
  const resourceText = Object.keys(resources).filter((key) => reward[key as ResourceKey]).map((key) => `${formatResourceName(key)}+${resources[key as ResourceKey] - prev.resources[key as ResourceKey]}`).join(' / ');
  const itemText = gainedDrops.map((d) => `${itemName(d.item)}+${d.amount}${itemKind(d.item) === '重要' ? '★' : ''}`).join(' / ');

  if (area.sell) eventLog.push(`商人売却：${soldText || '売る素材がない。看板だけが今日も働いている。'}`);
  else if (job.type === 'combat') eventLog.push(`戦闘結果：+${goldGain}G${itemText ? ` / ${itemText}` : ''}`);
  else if (job.type === 'adventure') eventLog.push(`探索結果：+${goldGain}G${itemText ? ` / ${itemText}` : ''}`);
  else if (goldGain || resourceText || itemText) eventLog.push(`作業獲得：${goldGain ? `+${goldGain}G` : ''}${goldGain && (resourceText || itemText) ? ' / ' : ''}${resourceText}${resourceText && itemText ? ' / ' : ''}${itemText}`);
  if (newItems.length) eventLog.unshift(`新発見：${newItems.map(itemName).join(' / ')}。図鑑の？？？がひとつ減った。`);

  if (nextItems.small_fish) achievements = addAchievement({ ...prev, achievements }, 'first_fish', eventLog);
  if (nextItems.hinoki_stick) achievements = addAchievement({ ...prev, achievements }, 'unlock_combat', eventLog);
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
    eventLog: [...eventLog, ...prev.eventLog].slice(0, 24),
    defeatedMonsters,
    seenMusingIds: musingState.seenMusingIds,
    recentMusingIds: musingState.recentMusingIds,
    musingCooldowns: musingState.musingCooldowns,
    lastAmbientMusingAt: musingState.lastAmbientMusingAt,
    lastCertainMusingAt: musingState.lastCertainMusingAt,
  };
  return announceJobUnlocks(prev, nextState, now);
}
