import { ACHIEVEMENTS, itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import { getJobDropItems } from './collection';
import { hasMetPerson, PERSON_FAIL_REDUCTION, PERSON_JOB_FAIL_REDUCTION } from './companion';
import { SEASONAL_ITEM_IDS } from './seasons';
import { checkRequirement, describeRequirement, isJobUnlocked } from './requirements';
import type { Area, GameState, LifetimeStats, Musing, Requirement, ResourceKey, Upgrade } from '../types';
import { enqueueMusing } from './musings';
import { getSynergyAdventureFailReduction, getSynergyChains, getUpgradeGoldCost } from './synergy';
import { getTraitFailReduction } from './traits';

export { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
export { getFarmingProgress } from './farming';
export { checkRequirement, getActiveArea, isAreaUnlocked, isJobUnlocked } from './requirements';


export function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
// レベル曲線: 序盤の「次の解禁まで遠い」詰まりを均すため、2026-10-28 に緩和。
// 旧: 45 + Lv^2 * 12（Lv1→57, Lv2→93, Lv5→345, Lv10→1245）
// 新: 30 + Lv^2 * 10（Lv1→40, Lv2→70, Lv5→280, Lv10→1030）
// 長期テール（ロードマップ8「数値バランスの長期化」）: Lv11 以降は単一指数で
// 伸ばす（×1.12^(Lv-10)。Lv11→1388, Lv15→4013, Lv20→12516）。
// Lv10 までは従来値と完全一致し、既存プレイヤーの到達レベルは変わらない。
// 数ヶ月遊べる曲線の本体で、序盤の緩和と長期の伸びを両立させる。
export function xpToNext(level: number) {
  const base = Math.floor(30 + level * level * 10);
  if (level <= 10) return base;
  return Math.floor(base * Math.pow(1.12, level - 10));
}
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }
export function isUniqueItem(item: string) {
  return itemKind(item) === '重要';
}

export function addItems(base: Record<string, number>, rewards: Musing['rewardItems'] = []) {
  const next = { ...(base || {}) };
  rewards.forEach((r) => {
    next[r.item] = isUniqueItem(r.item) ? Math.max(next[r.item] || 0, 1) : (next[r.item] || 0) + r.amount;
  });
  return next;
}

export function grantItemRewards(base: Record<string, number>, rewards: Musing['rewardItems'] = []) {
  const next = { ...(base || {}) };
  const granted: NonNullable<Musing['rewardItems']> = [];
  rewards.forEach((r) => {
    if (isUniqueItem(r.item)) {
      if (next[r.item]) return;
      next[r.item] = 1;
      granted.push({ ...r, amount: 1 });
      return;
    }
    next[r.item] = (next[r.item] || 0) + r.amount;
    granted.push(r);
  });
  return { items: next, granted };
}
export function rollDrops(drops: Area['drops'] = [], chanceMultiplier = 1) { return drops.filter((d) => Math.random() <= Math.min(0.95, d.chance * chanceMultiplier)).map((d) => ({ ...d, amount: randInt(d.amount[0], d.amount[1]) })); }
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

export function getReleaseTasks(state: GameState) {
  const unlockedJobs = Object.keys(jobs).filter((key) => isJobUnlocked(key, state));
  const totalJobs = Object.keys(jobs).length;
  const ownedUpgrades = Object.values(jobs).flatMap((job) => job.upgrades).filter((upgrade) => state.items?.[upgrade.id]).length;
  const totalUpgrades = Object.values(jobs).reduce((sum, job) => sum + job.upgrades.length, 0);
  const highestLevel = Math.max(...Object.values(state.jobData || {}).map((data) => data.level || 1));
  const achievementCount = (state.achievements || []).length;
  const tasks = [
    { label: '仕事をすべて解禁', done: unlockedJobs.length >= totalJobs, progress: `${unlockedJobs.length}/${totalJobs}` },
    { label: '拠点整備を6割以上導入', done: ownedUpgrades >= Math.ceil(totalUpgrades * 0.6), progress: `${ownedUpgrades}/${Math.ceil(totalUpgrades * 0.6)}` },
    { label: '得意な仕事をLv8へ', done: highestLevel >= 8, progress: `Lv${highestLevel}/8` },
    { label: '実績を10個集める', done: achievementCount >= 10, progress: `${achievementCount}/10` },
  ];
  return tasks;
}

function requirementProgress(requirement: Requirement, state: GameState) {
  if (requirement.type === 'start') return { percent: 100, current: 1, target: 1, label: 'すぐ開始できます' };
  if (requirement.type === 'rebirth') {
    const current = state.prestige?.rebirthCount || 0;
    return {
      percent: Math.min(100, Math.floor((current / requirement.count) * 100)),
      current,
      target: requirement.count,
      label: `転生${current}/${requirement.count}回`,
    };
  }
  if (requirement.type === 'item') {
    const current = state.items?.[requirement.item] || 0;
    return {
      percent: Math.min(100, Math.floor((current / requirement.amount) * 100)),
      current,
      target: requirement.amount,
      label: `${itemName(requirement.item)} ${current}/${requirement.amount}`,
    };
  }
  if (requirement.type === 'samsara') {
    const current = state.prestige?.samsaraCount || 0;
    return {
      percent: Math.min(100, Math.floor((current / requirement.count) * 100)),
      current,
      target: requirement.count,
      label: `輪廻${current}/${requirement.count}回`,
    };
  }
  const current = state.jobData?.[requirement.job]?.level || 0;
  return {
    percent: Math.min(100, Math.floor((current / requirement.level) * 100)),
    current,
    target: requirement.level,
    label: `Lv${current}/${requirement.level}`,
  };
}

function upgradeReadiness(upgrade: Upgrade, state: GameState, jobKey: string) {
  if (state.items?.[upgrade.id]) return 100;
  const jobLevel = state.jobData?.[jobKey]?.level || 1;
  const levelRatio = upgrade.level ? Math.min(1, jobLevel / upgrade.level) : 1;
  const discountedGold = getUpgradeGoldCost(state, upgrade.cost.gold);
  const goldRatio = discountedGold > 0 ? Math.min(1, (state.gold || 0) / discountedGold) : 1;
  const resourceRatios = Object.entries(upgrade.cost.resources || {}).map(([key, value]) => {
    if (!value) return 1;
    return Math.min(1, ((state.resources || {})[key as ResourceKey] || 0) / value);
  });
  return Math.floor(Math.min(levelRatio, goldRatio, ...resourceRatios, 1) * 100);
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getNextTarget(state: GameState) {
  const lockedJob = Object.entries(jobs).find(([key, job]) => !isJobUnlocked(key, state) && job.unlock.type !== 'start');
  if (lockedJob) {
    const [key, job] = lockedJob;
    const progress = requirementProgress(job.unlock, state);
    return {
      title: `次の解禁：${job.name}`,
      detail: `${job.description} 解禁条件：${describeRequirement(job.unlock, state)}`,
      progress: progress.percent,
      meta: progress.label,
      cta: progress.percent >= 85 ? 'もう少しで生活の選択肢が増える' : 'まずは解禁条件を育てる',
      key,
    };
  }

  const currentJob = jobs[state.activeJob] || jobs.fishing;
  const lockedArea = currentJob.areas.find((area) => area.unlock && !checkRequirement(area.unlock, state));
  if (lockedArea?.unlock) {
    const progress = requirementProgress(lockedArea.unlock, state);
    return {
      title: `次のエリア：${lockedArea.name}`,
      detail: lockedArea.summary,
      progress: progress.percent,
      meta: progress.label,
      cta: '新しい場所は、新しい報酬とぼやきを連れてくる',
      key: lockedArea.id,
    };
  }

  const upgradeCandidates = Object.entries(jobs).flatMap(([jobKey, job]) => job.upgrades
    .filter((upgrade) => !state.items?.[upgrade.id] && isJobUnlocked(jobKey, state))
    .map((upgrade) => ({ jobKey, job, upgrade, readiness: upgradeReadiness(upgrade, state, jobKey) })))
    .sort((a, b) => b.readiness - a.readiness);
  const nextUpgrade = upgradeCandidates[0];
  if (nextUpgrade) {
    return {
      title: `次の拠点整備：${nextUpgrade.upgrade.name}`,
      detail: `${nextUpgrade.job.name}が少し楽になる。${nextUpgrade.upgrade.description}`,
      progress: nextUpgrade.readiness,
      meta: `${nextUpgrade.readiness}%`,
      cta: nextUpgrade.readiness >= 80 ? '財布が導入ボタンの近くまで来ている' : '素材とGを少しずつ積む',
      key: nextUpgrade.upgrade.id,
    };
  }

  const releaseTasks = getReleaseTasks(state);
  const releaseTask = releaseTasks.find((task) => !task.done);
  if (releaseTask) {
    return {
      title: `リリース目標：${releaseTask.label}`,
      detail: 'ここを埋めると、生活が「そこそこ安心」に近づく。',
      progress: 75,
      meta: releaseTask.progress,
      cta: '完成度をもう一段だけ押し上げる',
      key: releaseTask.label,
    };
  }
  return {
    title: '次の自由：図鑑と生活ログを埋める',
    detail: 'まだ読んでいないぼやき、倒していない相手、植えていない作物が生活の余白に残っています。',
    progress: 100,
    meta: '継続中',
    cta: '遊ぶほど、勇者の部屋に生活の厚みが出る',
    key: 'free-life',
  };
}

export function getLifePlan(state: GameState) {
  const currentJob = jobs[state.activeJob] || jobs.fishing;
  const currentArea = currentJob.areas.find((area) => area.id === state.activeArea) || currentJob.areas[0];

  if (state.currentMusing && !state.currentMusing.readAt) {
    return {
      kicker: '今すぐ',
      title: 'ぼやきの「次へ」を読む',
      detail: '新しい出来事が起きています。まずは勇者の内心を確認して、生活ログに残しましょう。',
      progress: 100,
      meta: '未読あり',
      key: 'read-musing',
    };
  }

  if (state.tutorialStep === 'select_fishing') {
    return {
      kicker: '最初の一手',
      title: '仕事から「釣り」を選ぶ',
      detail: '無料で食料と小銭を拾うところから開始。勇者、まずは水辺で人生を薄く立て直します。',
      progress: 0,
      meta: '開始',
      key: 'select-fishing',
    };
  }

  if (state.tutorialStep === 'sell_materials') {
    return {
      kicker: '最初の一手',
      title: '素材を商人で売る',
      detail: '釣りや木こりで手に入る素材は、商人の仕事で売るとGになります。木こりLv2で商人が解禁されます。',
      progress: 33,
      meta: 'ステップ 2/3',
      key: 'sell-materials',
    };
  }

  if (state.tutorialStep === 'improve_base') {
    return {
      kicker: '最初の一手',
      title: '拠点整備で最初の道具を買う',
      detail: 'Gと素材がたまったら、仕事カードの「拠点整備」から中古の釣り竿などを導入。失敗が減って暮らしが楽になります。',
      progress: 66,
      meta: 'ステップ 3/3',
      key: 'improve-base',
    };
  }

  if (state.dailyBonus?.lastClaimDate !== todayKey()) {
    return {
      kicker: '本日の一手',
      title: '生活スタンプを受け取る',
      detail: 'ログインだけで少し進む枠です。Gと生活リズムをもらって、次の作業に余熱を残します。',
      progress: 100,
      meta: `${state.dailyBonus?.streak || 0}日継続`,
      key: 'daily-bonus',
    };
  }

  if (state.farming?.readyAt && Date.now() >= state.farming.readyAt) {
    return {
      kicker: '収穫待ち',
      title: '畑を収穫する',
      detail: '長く待ったぶん、生活にちゃんと戻ってきます。放置時間が罪悪感ではなく成果になる瞬間です。',
      progress: 100,
      meta: '収穫可',
      key: 'harvest-crop',
    };
  }

  const target = getNextTarget(state);
  if (target.key !== 'free-life') {
    return {
      kicker: '次の目標',
      title: target.title,
      detail: target.detail || target.cta,
      progress: target.progress,
      meta: target.meta,
      key: target.key,
    };
  }

  return {
    kicker: '今の進行',
    title: currentArea ? `${currentArea.name}を進める` : '仕事を選ぶ',
    detail: currentArea ? `${currentJob.name}を一周ずつ回して、素材・経験・ぼやきの穴を埋めていきます。` : 'まずは仕事を選んで、今日を回しましょう。',
    progress: currentArea ? 65 : 0,
    meta: currentJob.name,
    key: currentArea?.id || 'choose-job',
  };
}

export function addAchievement(prev: GameState, id: string, logs: string[]) {
  if (!ACHIEVEMENTS[id] || prev.achievements.includes(id)) return prev.achievements;
  logs.unshift(`実績解除：${ACHIEVEMENTS[id].name} — ${ACHIEVEMENTS[id].description}`);
  return grantAchievementMilestones([id, ...prev.achievements], logs);
}

// 実績の節目（コンプリート報酬の区切り）。実績数が区切りに届いたら、その場で
// 節目実績も付与する。122 は 122個の到達点で、121 の状態で付与されてちょうど
// 122 になる（全133個のうちの区切りで、最後の1個の到達点ではない）。
// ただし最大値の節目だけは例外で、at は総数-1 にする。節目実績自体が総数に
// 含まれるため、at を総数にすると付与条件（現在の個数 >= at）を満たす状態が
// 永遠に来ない（付与される前の最大値は総数-1）。at を総数-1 にすれば、他の
// 実績をすべて集めた時点で節目が付与されて総数に到達する。
const ACHIEVEMENT_MILESTONES = [
  { at: 10, id: 'ten_achievements' },
  { at: 25, id: 'achievements_25' },
  { at: 50, id: 'achievements_50' },
  { at: 75, id: 'achievements_75' },
  { at: 100, id: 'achievements_100' },
  { at: 122, id: 'achievements_120' },
  { at: 125, id: 'achievements_125' },
  { at: 135, id: 'achievements_135' },
  { at: 138, id: 'achievements_138' },
  { at: 141, id: 'achievements_141' },
  { at: 142, id: 'achievements_142' },
  { at: 144, id: 'achievements_145' },
];

function grantAchievementMilestones(next: string[], logs: string[]): string[] {
  let out = next;
  for (const milestone of ACHIEVEMENT_MILESTONES) {
    if (out.length >= milestone.at && ACHIEVEMENTS[milestone.id] && !out.includes(milestone.id)) {
      logs.unshift(`実績解除：${ACHIEVEMENTS[milestone.id].name} — ${ACHIEVEMENTS[milestone.id].description}`);
      out = [milestone.id, ...out];
    }
  }
  return out;
}

// ---- 通算の歩み（lifetime） ----

export function emptyLifetime(): LifetimeStats {
  return { cycles: 0, goldEarned: 0, kills: 0, salesGold: 0, harvests: 0, chestsOpened: 0, musingsRead: 0, maxCombo: 0, discovered: [] };
}

function lifetimeOf(state: GameState): LifetimeStats {
  return state.lifetime || emptyLifetime();
}

// ---- 図鑑コンプリート報酬（ロードマップ7） ----
// 全発見＝季節限定アイテムを除く全発見物（図鑑の発見物タブと同じ母集団）を
// すべて lifetime.discovered に持つこと。全討伐＝全44種のモンスター撃破。
// 達成時の永続ボーナス：全発見で金報酬 +10%、全討伐で XP +10%。
// 実績ボーナスと同じ箇所に掛け合わせる派生計算のみ。
export function getAllDiscoverableItemIds(): string[] {
  const seasonal = new Set(SEASONAL_ITEM_IDS);
  return Array.from(new Set(Object.keys(jobs).flatMap((jobKey) => getJobDropItems(jobKey)))).filter((id) => !seasonal.has(id));
}

export function getAllMonsterIds(): string[] {
  const ids = new Set<string>();
  Object.values(jobs).forEach((job) => {
    job.areas.forEach((area) => {
      (area.monsters || []).forEach((monster) => ids.add(monster.id));
    });
  });
  return Array.from(ids);
}

export function getCollectionProgress(state: GameState): {
  itemsFound: number;
  itemsTotal: number;
  itemsComplete: boolean;
  monstersDefeated: number;
  monstersTotal: number;
  monstersComplete: boolean;
} {
  const allItems = getAllDiscoverableItemIds();
  const discovered = new Set((state.lifetime?.discovered || []));
  const itemsFound = allItems.filter((id) => discovered.has(id)).length;
  const allMonsters = getAllMonsterIds();
  const defeated = new Set(state.defeatedMonsters || []);
  const monstersDefeated = allMonsters.filter((id) => defeated.has(id)).length;
  return {
    itemsFound,
    itemsTotal: allItems.length,
    itemsComplete: allItems.length > 0 && itemsFound >= allItems.length,
    monstersDefeated,
    monstersTotal: allMonsters.length,
    monstersComplete: allMonsters.length > 0 && monstersDefeated >= allMonsters.length,
  };
}

export function getCollectionGoldMultiplier(state: GameState): number {
  return getCollectionProgress(state).itemsComplete ? 1.1 : 1;
}

export function getCollectionXpMultiplier(state: GameState): number {
  return getCollectionProgress(state).monstersComplete ? 1.1 : 1;
}

export function getCollectionBonusLines(state: GameState): string[] {
  const progress = getCollectionProgress(state);
  return [
    progress.itemsComplete
      ? `図鑑 全発見：金報酬 +10%（達成済み）`
      : `図鑑 全発見まであと${progress.itemsTotal - progress.itemsFound}種（${progress.itemsFound}/${progress.itemsTotal}）— 達成で金報酬 +10%`,
    progress.monstersComplete
      ? `図鑑 全討伐：XP +10%（達成済み）`
      : `図鑑 全討伐まであと${progress.monstersTotal - progress.monstersDefeated}種（${progress.monstersDefeated}/${progress.monstersTotal}）— 達成でXP +10%`,
  ];
}

// ---- 実績ボーナス（コンプリート報酬連動） ----
// 実績10個ごとに金報酬・XPが +2%（123個で +24%）、25個ごとにドロップ確率が +2%
// （123個で +8%）。派生計算のみで、セーブ形式は変えない。
export function getAchievementBonusPct(state: GameState): number {
  return Math.floor((state.achievements || []).length / 10) * 2;
}

export function getAchievementGoldMultiplier(state: GameState): number {
  return 1 + getAchievementBonusPct(state) / 100;
}

export function getAchievementXpMultiplier(state: GameState): number {
  return 1 + getAchievementBonusPct(state) / 100;
}

export function getAchievementDropMultiplier(state: GameState): number {
  return 1 + Math.floor((state.achievements || []).length / 25) * 0.02;
}

export function getAchievementBonusLines(state: GameState): string[] {
  const count = (state.achievements || []).length;
  const lines: string[] = [];
  const pct = getAchievementBonusPct(state);
  lines.push(pct > 0
    ? `実績 ${count}個：金報酬・XP +${pct}%`
    : `実績 ${count}個：金報酬・XPのボーナスは実績10個から（次は10個で+2%）`);
  const dropPct = Math.floor(count / 25) * 2;
  lines.push(dropPct > 0
    ? `実績 ${count}個：ドロップ確率 +${dropPct}%`
    : `実績 ${count}個：ドロップ確率のボーナスは実績25個から（次は25個で+2%）`);
  const total = Object.keys(ACHIEVEMENTS).length;
  if (count >= total) lines.push(`実績コンプリート：${total}個すべて集めた。`);
  else {
    const nextMilestone = [10, 25, 50, 75, 100, 122, 125, 135, 138, 141, 142, 145].find((at) => count < at) ?? total;
    lines.push(`次の節目：実績${nextMilestone}個（あと${nextMilestone - count}個）`);
  }
  return lines;
}

// ---- 実績の節目判定（中央チェック） ----
// 各所の出来事のあとに呼ぶ。条件を満たす実績をまとめて付与する（冪等）。
// 既存の addAchievement 呼び出しはそのまま残し、ここは累計・横断条件の受け皿にする。
export function checkMilestoneAchievements(state: GameState, eventLog: string[]): string[] {
  let achievements = state.achievements || [];
  const grant = (id: string) => {
    achievements = addAchievement({ ...state, achievements }, id, eventLog);
  };
  const jobData = state.jobData || {};
  for (const key of Object.keys(jobs)) {
    const level = jobData[key]?.level || 1;
    if (level >= 5) grant(`job5_${key}`);
    if (level >= 10) grant(`job10_${key}`);
  }
  const jobKeys = Object.keys(jobs);
  if (jobKeys.every((key) => (jobData[key]?.level || 1) >= 5)) grant('all_jobs_lv5');
  if (jobKeys.every((key) => (jobData[key]?.level || 1) >= 10)) grant('all_jobs_lv10');
  const lt = lifetimeOf(state);
  if (lt.cycles >= 100) grant('cycles_100');
  if (lt.cycles >= 1000) grant('cycles_1000');
  if (lt.cycles >= 5000) grant('cycles_5000');
  if (lt.goldEarned >= 10000) grant('gold_10k');
  if (lt.goldEarned >= 100000) grant('gold_100k');
  if (lt.goldEarned >= 1000000) grant('gold_1m');
  if (lt.kills >= 10) grant('kills_10');
  if (lt.kills >= 100) grant('kills_100');
  if (lt.kills >= 300) grant('kills_300');
  const defeated = state.defeatedMonsters || [];
  if (defeated.includes('throne_mimic')) grant('boss_throne_mimic');
  if (defeated.includes('retired_hero')) grant('boss_retired_hero');
  if (defeated.includes('silent_demon_king')) grant('boss_silent_demon_king');
  if (defeated.includes('household_demon_king')) grant('boss_household_demon_king');
  if ((state.bossStreak || 0) >= 5) grant('boss_streak_5');
  if (defeated.length >= 20) grant('monsters_20');
  if (defeated.length >= 44) grant('monsters_44');
  if (defeated.length >= 63) grant('monsters_63');
  if (defeated.length >= 66) grant('monsters_66');
  if (defeated.length >= 69) grant('monsters_69');
  if (defeated.length >= 74) grant('monsters_74');
  if (defeated.length >= 77) grant('monsters_77');
  if (defeated.length >= 80) grant('monsters_80');
  if ((lt.discovered || []).length >= 50) grant('discovered_50');
  if ((lt.discovered || []).length >= 100) grant('discovered_100');
  if ((lt.discovered || []).length >= 125) grant('discovered_125');
  if ((lt.discovered || []).length >= 135) grant('discovered_135');
  if ((lt.discovered || []).length >= 147) grant('discovered_147');
  if ((lt.discovered || []).length >= 158) grant('discovered_158');
  if ((lt.discovered || []).length >= 164) grant('discovered_164');
  if ((lt.discovered || []).length >= 170) grant('discovered_170');
  const bases = state.seenEquipmentBaseIds || [];
  if (bases.length >= 30) grant('equip_bases_30');
  if (bases.length >= 66) grant('equip_bases_66');
  const legendaryCount = (state.equipmentInventory || []).filter((item) => item.rarity === 'legendary').length;
  if (legendaryCount >= 3) grant('legendary_3');
  if (lt.chestsOpened >= 10) grant('chests_10');
  if (lt.chestsOpened >= 50) grant('chests_50');
  if (lt.salesGold >= 10000) grant('sales_10k');
  if (lt.salesGold >= 100000) grant('sales_100k');
  if (lt.harvests >= 10) grant('harvests_10');
  if (lt.harvests >= 100) grant('harvests_100');
  if (lt.musingsRead >= 25) grant('musings_25');
  if (lt.musingsRead >= 50) grant('musings_50');
  if ((state.dailyBonus?.streak || 0) >= 7) grant('streak_7');
  if ((state.dailyBonus?.streak || 0) >= 30) grant('streak_30');
  const prestige = state.prestige;
  if (prestige) {
    if (prestige.retireCount >= 5) grant('retire_5');
    if (prestige.retireCount >= 10) grant('retire_10');
    if (prestige.rebirthCount >= 5) grant('rebirth_5');
    const prestigeOwned = Object.values(prestige.upgrades || {}).filter((stage) => (stage || 0) > 0).length;
    if (prestigeOwned >= 8) grant('prestige_upgrades_8');
    const rebirthOwned = Object.values(prestige.rebirthUpgrades || {}).filter((stage) => (stage || 0) > 0).length;
    if (rebirthOwned >= 5) grant('rebirth_upgrades_5');
    if (prestige.totalEarned >= 395) grant('memory_395');
  }
  if (state.trait) grant(`trait_${state.trait}`);
  if ((state.traitChanges || 0) >= 1) grant('trait_changed');
  if (getSynergyChains(state).every((chain) => chain.active !== '')) grant('synergy_all_7');
  // 直接セットで付与された実績（宝箱開封など）が節目を越えていた場合の追いつき。
  achievements = grantAchievementMilestones(achievements, eventLog);
  return achievements;
}

// 状態全体に節目チェックを適用する。何も変わらなければ同じ state を返す。
export function applyMilestoneAchievements(prev: GameState): GameState {
  const eventLog = [...(prev.eventLog || [])];
  const achievements = checkMilestoneAchievements(prev, eventLog);
  if (achievements === prev.achievements && eventLog.length === (prev.eventLog || []).length) return prev;
  return { ...prev, achievements, eventLog: eventLog.slice(0, 24) };
}

// 図鑑での進捗表示用。累計・回数系の実績の「現在/目標」を返す。
export function getAchievementProgress(state: GameState, id: string): { current: number; target: number } | null {
  const jobData = state.jobData || {};
  const lt = lifetimeOf(state);
  const jobMatch = id.match(/^job(5|10)_([a-z_]+)$/);
  if (jobMatch) return { current: jobData[jobMatch[2]]?.level || 1, target: Number(jobMatch[1]) };
  const table: Record<string, { current: number; target: number }> = {
    all_jobs_lv5: { current: Object.keys(jobs).filter((key) => (jobData[key]?.level || 1) >= 5).length, target: Object.keys(jobs).length },
    all_jobs_lv10: { current: Object.keys(jobs).filter((key) => (jobData[key]?.level || 1) >= 10).length, target: Object.keys(jobs).length },
    cycles_100: { current: lt.cycles, target: 100 },
    cycles_1000: { current: lt.cycles, target: 1000 },
    cycles_5000: { current: lt.cycles, target: 5000 },
    gold_10k: { current: lt.goldEarned, target: 10000 },
    gold_100k: { current: lt.goldEarned, target: 100000 },
    gold_1m: { current: lt.goldEarned, target: 1000000 },
    kills_10: { current: lt.kills, target: 10 },
    kills_100: { current: lt.kills, target: 100 },
    kills_300: { current: lt.kills, target: 300 },
    boss_throne_mimic: { current: (state.defeatedMonsters || []).includes('throne_mimic') ? 1 : 0, target: 1 },
    boss_retired_hero: { current: (state.defeatedMonsters || []).includes('retired_hero') ? 1 : 0, target: 1 },
    boss_silent_demon_king: { current: (state.defeatedMonsters || []).includes('silent_demon_king') ? 1 : 0, target: 1 },
    boss_household_demon_king: { current: (state.defeatedMonsters || []).includes('household_demon_king') ? 1 : 0, target: 1 },
    boss_streak_5: { current: state.bossStreak || 0, target: 5 },
    monsters_20: { current: (state.defeatedMonsters || []).length, target: 20 },
    monsters_44: { current: (state.defeatedMonsters || []).length, target: 44 },
    monsters_63: { current: (state.defeatedMonsters || []).length, target: 63 },
    monsters_66: { current: (state.defeatedMonsters || []).length, target: 66 },
    monsters_69: { current: (state.defeatedMonsters || []).length, target: 69 },
    monsters_74: { current: (state.defeatedMonsters || []).length, target: 74 },
    monsters_77: { current: (state.defeatedMonsters || []).length, target: 77 },
    monsters_80: { current: (state.defeatedMonsters || []).length, target: 80 },
    discovered_50: { current: (lt.discovered || []).length, target: 50 },
    discovered_100: { current: (lt.discovered || []).length, target: 100 },
    discovered_125: { current: (lt.discovered || []).length, target: 125 },
    discovered_135: { current: (lt.discovered || []).length, target: 135 },
    discovered_147: { current: (lt.discovered || []).length, target: 147 },
    discovered_158: { current: (lt.discovered || []).length, target: 158 },
    discovered_164: { current: (lt.discovered || []).length, target: 164 },
    discovered_170: { current: (lt.discovered || []).length, target: 170 },
    equip_bases_30: { current: (state.seenEquipmentBaseIds || []).length, target: 30 },
    equip_bases_66: { current: (state.seenEquipmentBaseIds || []).length, target: 66 },
    legendary_3: { current: (state.equipmentInventory || []).filter((item) => item.rarity === 'legendary').length, target: 3 },
    chests_10: { current: lt.chestsOpened, target: 10 },
    chests_50: { current: lt.chestsOpened, target: 50 },
    sales_10k: { current: lt.salesGold, target: 10000 },
    sales_100k: { current: lt.salesGold, target: 100000 },
    harvests_10: { current: lt.harvests, target: 10 },
    harvests_100: { current: lt.harvests, target: 100 },
    musings_25: { current: lt.musingsRead, target: 25 },
    musings_50: { current: lt.musingsRead, target: 50 },
    streak_7: { current: state.dailyBonus?.streak || 0, target: 7 },
    streak_30: { current: state.dailyBonus?.streak || 0, target: 30 },
    retire_5: { current: state.prestige?.retireCount || 0, target: 5 },
    retire_10: { current: state.prestige?.retireCount || 0, target: 10 },
    rebirth_5: { current: state.prestige?.rebirthCount || 0, target: 5 },
    prestige_upgrades_8: { current: Object.values(state.prestige?.upgrades || {}).filter((stage) => (stage || 0) > 0).length, target: 8 },
    rebirth_upgrades_5: { current: Object.values(state.prestige?.rebirthUpgrades || {}).filter((stage) => (stage || 0) > 0).length, target: 5 },
    memory_395: { current: state.prestige?.totalEarned || 0, target: 395 },
    trait_craftsman: { current: state.trait === 'craftsman' ? 1 : 0, target: 1 },
    trait_adventurer: { current: state.trait === 'adventurer' ? 1 : 0, target: 1 },
    trait_merchant: { current: state.trait === 'merchant' ? 1 : 0, target: 1 },
    trait_easygoing: { current: state.trait === 'easygoing' ? 1 : 0, target: 1 },
    trait_changed: { current: state.traitChanges || 0, target: 1 },
    achievements_25: { current: (state.achievements || []).length, target: 25 },
    achievements_50: { current: (state.achievements || []).length, target: 50 },
    achievements_75: { current: (state.achievements || []).length, target: 75 },
    achievements_100: { current: (state.achievements || []).length, target: 100 },
    achievements_120: { current: (state.achievements || []).length, target: 123 },
    achievements_125: { current: (state.achievements || []).length, target: 126 },
    achievements_135: { current: (state.achievements || []).length, target: 136 },
    achievements_138: { current: (state.achievements || []).length, target: 139 },
    achievements_141: { current: (state.achievements || []).length, target: 142 },
    achievements_142: { current: (state.achievements || []).length, target: 143 },
    achievements_145: { current: (state.achievements || []).length, target: 145 },
    synergy_all_7: { current: getSynergyChains(state).filter((chain) => chain.active !== '').length, target: 7 },
  };
  return table[id] || null;
}

function unlockedJobKeys(state: GameState) {
  // 条件だけでなく保存済みリストと使用実績も解禁として数える（grandfather）。
  // 条件だけで再計算すると、既存プレイヤーの仕事が解禁リストから落ちて再ロックされ得る。
  return Object.keys(jobs).filter((key) => isJobUnlocked(key, state));
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
    rebirth_guide: `勇者は「転生案内」を始められるようになった。\n\n勇者「生まれ変わったばかりの勇者に、池の歩き方を教える。教える側になると、自分の人生も少し整理されるな」\n\n一度終わった人生を、もう一度なぞる仕事だ。初心者の質問に答えるたびに、自分が最初に覚えたことの順番が、少しずつ見えてくる。\n\n勇者「先生と呼ばれるほどの人生じゃない。でも、教えることで自分の答えも固まってくる。なんだか変な気分だ」\n\nここからは、稼ぐだけでなく、誰かの二周目を支える選択も増える。転生した勇者にだけ開く、静かな仕事が始まった。`,
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
  const seenUnlockIds = new Set([
    ...(prev.seenMusingIds || []),
    ...(next.seenMusingIds || []),
    ...(prev.readMusings || []).map((musing) => musing.id || ''),
    ...(next.readMusings || []).map((musing) => musing.id || ''),
    prev.currentMusing?.id || '',
    next.currentMusing?.id || '',
    ...(prev.musingQueue || []).map((musing) => musing.id || ''),
    ...(next.musingQueue || []).map((musing) => musing.id || ''),
  ]);
  const newlyUnlocked = after.filter((key) => !before.includes(key) && !seenUnlockIds.has(`job-unlock-${key}`));
  let state: GameState = { ...next, unlockedJobs: after };
  newlyUnlocked.forEach((key) => {
    const result = enqueueMusing(state, jobUnlockMusing(key), { prepend: true, now });
    state = result.state;
    if (result.accepted) {
      state = {
        ...state,
        eventLog: [`仕事解禁：${jobs[key].name}。物語の区切りぼやきが届いた。`, ...state.eventLog].slice(0, 24),
      };
    }
  });
  return state;
}

export function getFailChance(area: Area, jobUpgrades: import('../types').Upgrade[], ownedItems: Record<string, number>, state?: GameState): number {
  const base = area.failChance ?? 0;
  if (base === 0) return 0;
  const reduction = jobUpgrades
    .filter((u) => ownedItems[u.id] && u.effects.failReduction)
    .reduce((sum, u) => sum + (u.effects.failReduction ?? 0), 0);
  // 連鎖：冒険エリア（出発費のあるエリア）では、休憩Lvが失敗率をさらに下げる。
  // 特性：冒険者気質ならさらに -5%（シナジーとは別枠）。下限 0% は最後に守る。
  // 人物：元勇者仲間の隣人と出会うとさらに -2%（別枠）。
  // 人物：締切の魔人と出会うと、冒険以外の仕事の失敗率がさらに -3%（別枠）。
  const synergyReduction = state && area.adventureCost ? getSynergyAdventureFailReduction(state) : 0;
  const traitReduction = state && area.adventureCost ? getTraitFailReduction(state) : 0;
  const personReduction = state && area.adventureCost && hasMetPerson(state, 'neighbor') ? PERSON_FAIL_REDUCTION : 0;
  const demonReduction = state && !area.adventureCost && hasMetPerson(state, 'deadline_demon') ? PERSON_JOB_FAIL_REDUCTION : 0;
  return Math.max(0, base - reduction - synergyReduction - traitReduction - personReduction - demonReduction);
}

export function pickFailMusing(area: Area): string {
  const list = area.failMusings ?? [];
  if (!list.length) return '失敗した。';
  return list[Math.floor(Math.random() * list.length)];
}



