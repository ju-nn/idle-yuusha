import { ACHIEVEMENTS, itemDesc, itemKind, itemName } from '../data/catalog';
import { jobs, upgrades } from '../data/gameData';
import { simulateMonsterBattle } from './combat';
import { getJobDropItems } from './collection';
import { getAdventureEntryCost } from './equipment';
import { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
import { getFarmingProgress } from './farming';
import { enqueueMusing, routeAmbientMusing } from './musings';
import { claimCatVisit, createCatState, getCatGiftGold, getCatGoldMultiplier, getCatXpMultiplier, getPeople, maybeCatVisit, normalizeCatState, refreshCatState } from './companion';
import { prestigeCostCurve } from './pricing';
import { addAchievement, addItems, applyMilestoneAchievements, checkMilestoneAchievements, emptyLifetime, getAchievementBonusLines, getAchievementGoldMultiplier, getAchievementProgress, getAllDiscoverableItemIds, getAllMonsterIds, getCollectionBonusLines, getCollectionGoldMultiplier, getCollectionXpMultiplier, getLifePlan, getNextTarget, rollDrops } from './progression';
import { checkRequirement, describeRequirement, getActiveArea, isJobUnlocked } from './requirements';
import { xpToNext } from './progression';
import { parseSaveBackup, SAVE_BACKUP_GAME_ID } from './saveTransfer';
import { buyPrestigeUpgrade, buyRebirthUpgrade, canRebirth, canRetire, createPrestigeState, getPrestigeOfflineMultiplier, getPrestigeScore, getPrestigeStage, getRebirthChestLimitBonus, getRebirthOfflineCapHours, getRebirthPoints, getRebirthSpeedMultiplier, getRebirthStage, getRetirementPoints, PRESTIGE_UPGRADES, REBIRTH_UPGRADES, rebirth, retire } from './prestige';
import { defaultSettings } from './settings';
import { runTick } from './tick';
import { autoSellGainedItems, isAutoSellTarget } from './automation';
import { getEquipmentPower, getChestLimit, isEquipmentBaseInSeason } from './equipment';
import { getSynergyAdventureFailReduction, getSynergyAttackBonus, getSynergyChains, getSynergyDropChanceMultiplier, getSynergyEntryCostReductionPct, getSynergyHarvestBonus, getSynergySellBonusPct, getSynergyUpgradeDiscountPct, getChainHintForJob, getUpgradeGoldCost } from './synergy';
import { getTraitAttackBonus, getTraitChangeCost, getTraitFailReduction, getTraitHarvestBonus, getTraitJobGoldBonusPct, getTraitOfflineMultiplier, getTraitRestXpMultiplier, getTraitSellBonusPct, selectTrait } from './traits';
import { getCropRewards, CROPS } from './farming';
import { getCurrentSeason, getSeasonCalendar, SEASONAL_ITEM_IDS, seasonStartMusingId } from './seasons';
import { claimWeeklyGoal, ensureWeeklyState, getWeekKey, getWeeklyGoals } from './weekly';
import { getHeroAttack } from './combat';
import { bossStreakBonusPct, nextBossStreak } from './combat';
import { getFailChance } from './progression';
import { getSellPriceMultiplier } from './equipment';
import { computeOfflineGains, createInitialState, getOfflineMaxTicks, migrateState, SAVE_VERSION, totalJobXp } from './state';

const initialState = createInitialState(jobs);

export function runSelfTests() {
  console.assert(checkRequirement({ type: 'start' }, initialState) === true, 'start unlock should always pass');
  console.assert(isJobUnlocked('fishing', { ...initialState, items: {} }) === true, 'fishing should be available from the start');
  console.assert(checkRequirement(jobs.woodcutting.unlock, { ...initialState, jobData: { ...initialState.jobData, fishing: { level: 2, xp: 0, seenMusings: [] } } }) === true, 'woodcutting should become eligible at fishing level 2');
  console.assert(checkRequirement(jobs.merchant.unlock, { ...initialState, jobData: { ...initialState.jobData, woodcutting: { level: 2, xp: 0, seenMusings: [] } } }) === true, 'merchant should become eligible at woodcutting level 2');
  console.assert(checkRequirement(jobs.farming.unlock, { ...initialState, jobData: { ...initialState.jobData, rest: { level: 2, xp: 0, seenMusings: [] } } }) === true, 'farming should become eligible at rest level 2');
  const unlockSignatures = Object.entries(jobs).map(([key, job]) => [`${job.unlock.type}:${'job' in job.unlock ? job.unlock.job : 'item' in job.unlock ? job.unlock.item : 'start'}:${'level' in job.unlock ? job.unlock.level : 'amount' in job.unlock ? job.unlock.amount : 0}`, key]);
  const duplicateUnlocks = unlockSignatures.filter(([signature], index) => unlockSignatures.findIndex(([other]) => other === signature) !== index);
  console.assert(duplicateUnlocks.length === 0, `jobs should not share identical unlock gates: ${duplicateUnlocks.map(([, key]) => key).join(', ')}`);
  console.assert(getJobDropItems('fishing').includes('resolve_to_fish'), 'fishing collection should include tutorial reward');
  console.assert(formatResourceName('wood') === '木材', 'wood should be formatted as 木材');
  console.assert(addItems({}, [{ item: 'small_fish', amount: 2 }]).small_fish === 2, 'addItems should add item amounts');
  console.assert(addItems({ field_note: 1 }, [{ item: 'field_note', amount: 3 }]).field_note === 1, 'important items should stay unique');
  console.assert(isAutoSellTarget('small_fish') === true && isAutoSellTarget('quiet_scale') === false && isAutoSellTarget('life_stamp') === false && isAutoSellTarget('upgrade_small_shelf') === false, 'auto sell should target materials only');
  const autoSoldFirst = autoSellGainedItems({}, { small_fish: 3, quiet_scale: 1 }, 1);
  console.assert(autoSoldFirst.items.small_fish === 1 && autoSoldFirst.gold === 6 && autoSoldFirst.items.quiet_scale === 1, 'auto sell should keep one copy of a first discovery and never sell important items');
  const autoSoldMore = autoSellGainedItems({ small_fish: 1 }, { small_fish: 4 }, 1);
  console.assert(autoSoldMore.items.small_fish === 1 && autoSoldMore.gold === 9, 'auto sell should sell all later gains of a known material');
  const weakItem = { uid: 't-weak', baseId: 'better_stick', name: '弱い棒', description: '', slot: 'weapon' as const, rarity: 'common' as const, options: [{ id: 'attack:all', target: 'attack' as const, value: 4 }], obtainedAt: 0 };
  const strongItem = { ...weakItem, uid: 't-strong', name: '強い棒', rarity: 'rare' as const, options: [{ id: 'attack:all', target: 'attack' as const, value: 20 }] };
  console.assert(getEquipmentPower(strongItem) > getEquipmentPower(weakItem), 'equipment power should rank a rarer, stronger item higher');
  console.assert(getActiveArea('fishing', 'missing').id === 'pond', 'missing area should fallback to first area');
  console.assert(rollDrops([]).length === 0, 'empty drops should roll empty');
  console.assert(rewardText([{ item: 'small_fish', amount: 1 }]).includes('小魚'), 'rewardText should show item names');
  console.assert(isJobUnlocked('unknown', initialState) === false, 'unknown job should stay locked');
  console.assert(getJobDropItems('unknown').length === 0, 'unknown job should have no drops');
  console.assert(itemName('missing') === 'missing', 'missing item should fallback to id');
  console.assert(itemDesc('missing') === '', 'missing item description should be empty');
  console.assert(describeUpgradeEffects(upgrades[0]).includes('最大MP+5'), 'upgrade effects should describe max MP bonus');
  console.assert(getNextTarget(initialState).title.includes('休憩'), 'next target should point to the first locked lifestyle option');
  const initialLifePlan = getLifePlan(initialState);
  console.assert(initialLifePlan.title.includes('休憩') || initialLifePlan.title.includes('釣り'), 'life plan should expose one primary next action');
  console.assert(getFarmingProgress({ plantedAt: 1000, readyAt: 11000, cropId: 'daikon' }, 6000).percent === 50, 'farming progress should calculate percentage');
  const onceResult = enqueueMusing(initialState, { id: 'self-test-once', text: '一度だけ出る。', eventType: 'firstTime', once: true }, { now: 1000 });
  const duplicateResult = enqueueMusing(onceResult.state, { id: 'self-test-once', text: '一度だけ出る。', eventType: 'firstTime', once: true }, { now: 2000 });
  console.assert(onceResult.accepted === true && duplicateResult.accepted === false, 'once musings should enqueue only once');
  const eventResult = enqueueMusing(initialState, { id: 'self-test-event', text: 'イベントは一度だけ。', eventType: 'event' }, { now: 1000 });
  const eventDuplicateResult = enqueueMusing(eventResult.state, { id: 'self-test-event', text: 'イベントは一度だけ。', eventType: 'event' }, { now: 70000 });
  console.assert(eventResult.accepted === true && eventDuplicateResult.accepted === false, 'non-ambient musings should never repeat');
  const idleResult = enqueueMusing({ ...initialState, lastCertainMusingAt: undefined }, { id: 'self-test-idle', text: '時間経過は再表示可能。', eventType: 'idle' }, { now: 1000 });
  const idleRepeatResult = enqueueMusing(idleResult.state, { id: 'self-test-idle', text: '時間経過は再表示可能。', eventType: 'idle' }, { now: 70000 });
  console.assert(idleResult.accepted === true && idleRepeatResult.accepted === true, 'idle musings may repeat after ambient cooldown');
  const failureResult = enqueueMusing(initialState, { id: 'self-test-failure', text: '失敗した。', eventType: 'failure', conditionKey: 'self-test-failure', cooldownSec: 5 }, { now: 1000 });
  const cooldownResult = enqueueMusing(failureResult.state, { id: 'self-test-failure-2', text: 'また失敗した。', eventType: 'failure', conditionKey: 'self-test-failure', cooldownSec: 5 }, { now: 2000 });
  console.assert(failureResult.accepted === true && cooldownResult.accepted === false, 'failure musings should respect cooldown');
  const migrated = migrateState({ gold: 99, items: { small_fish: 1 }, jobData: { fishing: { level: 2, xp: 0, seenMusings: [] } } } as Partial<typeof initialState>, initialState);
  console.assert(migrated.saveVersion === SAVE_VERSION && migrated.gold === 99 && migrated.resources.wood === 0, 'migration should preserve data and fill defaults');
  console.assert(migrated.combo?.streak === 0 && Boolean(migrated.combo?.boons), 'migration should initialize combo state');
  console.assert(migrated.dailyBonus?.streak === 0, 'migration should initialize daily bonus state');
  console.assert(Array.isArray(migrated.equipmentInventory) && Boolean(migrated.equipped), 'migration should initialize equipment state');
  const migratedUnique = migrateState({ items: { field_note: 4, small_fish: 4 } } as Partial<typeof initialState>, initialState);
  console.assert(migratedUnique.items.field_note === 1 && migratedUnique.items.small_fish === 4, 'migration should normalize repeated important items only');
  // v1（saveVersion無し・装備や宝箱が無い時代）のセーブが、移行手順を通って現行形になること。
  const migratedV1 = migrateState({ gold: 7, tick: 42, jobData: { fishing: { level: 3, xp: 1, seenMusings: [] } }, items: { small_fish: 2 } } as Partial<typeof initialState>, initialState);
  console.assert(migratedV1.saveVersion === SAVE_VERSION && migratedV1.gold === 7 && migratedV1.jobData.fishing.level === 3, 'v1 save should migrate to current version without losing progress');
  console.assert(Array.isArray(migratedV1.treasureChests) && Array.isArray(migratedV1.equipmentInventory), 'v1 migration should prepare equipment and chest storage');
  // バックアップの往復: 書き出し（封筒）→読み込みで中身が保たれること、不正な文字列で既存セーブが壊れないこと。
  const backupRoundTrip = parseSaveBackup(JSON.stringify({ game: SAVE_BACKUP_GAME_ID, kind: 'save-backup', formatVersion: 1, exportedAt: '', save: { saveVersion: SAVE_VERSION, gold: 123, jobData: { fishing: { level: 5, xp: 0, seenMusings: [] } }, items: {} } }));
  console.assert(backupRoundTrip.ok && backupRoundTrip.save.gold === 123, 'envelope backup should parse back to the save');
  const legacyBackup = parseSaveBackup(JSON.stringify({ gold: 55, jobData: { fishing: { level: 2, xp: 0, seenMusings: [] } }, items: {} }));
  console.assert(legacyBackup.ok && legacyBackup.fromVersion === 1, 'legacy raw backup should be accepted as a v1 save');
  console.assert(!parseSaveBackup('{"game":"other","kind":"save-backup","save":{}}').ok, 'backup from another game should be rejected');
  console.assert(!parseSaveBackup(JSON.stringify({ saveVersion: SAVE_VERSION + 1, gold: 1, jobData: {}, items: {} })).ok, 'future save version should be rejected');
  console.assert(!parseSaveBackup('not json').ok && !parseSaveBackup('{"gold":1}').ok, 'broken or shapeless backup should be rejected');
  const slime = jobs.adventure.areas[0].monsters?.[0];
  if (slime) {
    const battle = simulateMonsterBattle({ ...initialState, hp: 80, mp: 60, items: { ...initialState.items, hinoki_stick: 1 } }, jobs.adventure, slime, 3);
    console.assert(battle.won && battle.hpCost >= 0 && battle.mpCost > 0, 'battle simulation should resolve a basic win with costs');
  }
  console.assert(getAdventureEntryCost(initialState, 8) === 8, 'adventure entry cost should default to base cost');
  // プレステージ: v3セーブ（prestige無し）からの移行で置き場が初期化されること。
  const migratedV3 = migrateState({ saveVersion: 3, gold: 50, jobData: { fishing: { level: 4, xp: 0, seenMusings: [] } }, items: { small_fish: 3 } } as Partial<typeof initialState>, initialState);
  console.assert(migratedV3.saveVersion === SAVE_VERSION && migratedV3.prestige?.memoryPoints === 0 && migratedV3.prestige?.retireCount === 0, 'v3 save should gain an empty prestige state');
  // プレステージ: バックアップ往復で思い出が保たれること。
  const prestigeBackup = parseSaveBackup(JSON.stringify({ saveVersion: SAVE_VERSION, gold: 10, jobData: {}, items: {}, prestige: { memoryPoints: 9, totalEarned: 9, retireCount: 1, upgrades: { memory_xp: 2 } } }));
  console.assert(prestigeBackup.ok, 'prestige save should parse as a valid backup');
  if (prestigeBackup.ok) {
    const restored = migrateState(prestigeBackup.save, initialState);
    console.assert(restored.prestige?.memoryPoints === 9 && restored.prestige?.upgrades.memory_xp === 2, 'prestige data should survive backup round trip');
  }
  // プレステージ: 初期状態では引退できず、進めると獲得見込みが増えること。
  console.assert(!canRetire(initialState) && getRetirementPoints(initialState) >= 0, 'fresh state should not be retireable');
  const grownState = {
    ...initialState,
    jobData: {
      ...initialState.jobData,
      fishing: { level: 12, xp: 0, seenMusings: [] },
      woodcutting: { level: 8, xp: 0, seenMusings: [] },
      rest: { level: 6, xp: 0, seenMusings: [] },
      merchant: { level: 5, xp: 0, seenMusings: [] },
    },
    items: { ...initialState.items, small_fish: 5, twig: 3, hinoki_stick: 1, quiet_scale: 1, field_note: 1, old_pickaxe: 1 },
    achievements: ['first_fish', 'first_musing'],
  };
  const grownScore = getPrestigeScore(grownState);
  console.assert(grownScore.score === (11 + 7 + 5 + 4) + 7 + 4, `prestige score should sum levels, discoveries and achievements (got ${grownScore.score})`);
  console.assert(canRetire(grownState) && getRetirementPoints(grownState) > 0, 'grown state should be retireable with points');
  // プレステージ: 引退で周回内がリセットされ、思い出と記録が残ること。
  const retired = retire(grownState, initialState);
  console.assert(retired !== grownState && retired.jobData.fishing.level === 1 && retired.gold === initialState.gold, 'retire should reset run progress');
  console.assert(retired.prestige?.retireCount === 1 && retired.prestige?.memoryPoints === getRetirementPoints(grownState), 'retire should bank memory points');
  console.assert(retired.achievements.includes('first_fish') && retired.achievements.includes('first_retire'), 'retire should keep achievements and add first_retire');
  // プレステージ: 永続強化は所持ポイントの範囲でだけ買えること。
  const bought = buyPrestigeUpgrade(retired, 'memory_start_gold');
  console.assert(bought.prestige?.upgrades.memory_start_gold === 1, 'prestige upgrade should apply one stage');
  console.assert((bought.prestige?.memoryPoints || 0) === (retired.prestige?.memoryPoints || 0) - 2, 'prestige upgrade should cost points');
  const broke = buyPrestigeUpgrade({ ...initialState, prestige: createPrestigeState() }, 'memory_start_gold');
  console.assert(broke.prestige?.upgrades.memory_start_gold === undefined, 'prestige upgrade should not apply without points');
  // 段階的解禁（2026-10-28）: 新規開始では釣り以外は閉じていて、ヒントが次の目標を示すこと。
  console.assert(isJobUnlocked('rest', initialState) === false && isJobUnlocked('woodcutting', initialState) === false, 'fresh state should only have fishing unlocked');
  console.assert(describeRequirement(jobs.rest.unlock, initialState).includes('休む許可'), 'rest unlock hint should name the required item');
  console.assert(describeRequirement(jobs.fishing.areas[1].unlock, initialState).includes('釣りLv3'), 'river unlock hint should name the level gate');
  console.assert(describeRequirement(jobs.woodcutting.unlock, initialState).includes('あと1'), 'woodcutting hint should show the remaining levels');
  // grandfather: 使用実績がある仕事は、条件未達・リスト未記録でも再ロックしない。
  const veteranState = {
    ...initialState,
    unlockedJobs: ['fishing'],
    jobData: { ...initialState.jobData, woodcutting: { level: 3, xp: 0, seenMusings: [] } },
  };
  console.assert(isJobUnlocked('woodcutting', veteranState) === true, 'a job with usage history should never re-lock');
  const listedState = { ...initialState, unlockedJobs: ['fishing', 'merchant'] };
  console.assert(isJobUnlocked('merchant', listedState) === true, 'a job recorded as unlocked should stay unlocked');
  const migratedVeteran = migrateState({ gold: 5, unlockedJobs: ['fishing'], jobData: { fishing: { level: 1, xp: 0, seenMusings: [] }, woodcutting: { level: 2, xp: 0, seenMusings: [] } }, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedVeteran.unlockedJobs.includes('woodcutting'), 'migration should keep jobs with usage history unlocked');
  const migratedFresh = migrateState({ gold: 5, jobData: { fishing: { level: 1, xp: 0, seenMusings: [] } }, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(!migratedFresh.unlockedJobs.includes('woodcutting') && !migratedFresh.unlockedJobs.includes('rest'), 'migration should not unlock unused jobs');
  // バランス調整（2026-10-28）: レベル曲線の緩和が想定値どおりであること。
  console.assert(xpToNext(1) === 40 && xpToNext(2) === 70 && xpToNext(5) === 280 && xpToNext(10) === 1030, 'xp curve should match the softened 2026-10-28 values');
  console.assert(jobs.fishing.areas[0].failChance === 0.10, 'first fishing area fail chance should be softened to 10%');
  // システム間シナジー（2026-11-05）: 派生計算だけで、初期状態は無効・育成で上限付きに効くこと。
  console.assert(getSynergySellBonusPct(initialState) === 0 && getSynergyAttackBonus(initialState) === 0 && getSynergyAdventureFailReduction(initialState) === 0 && getSynergyEntryCostReductionPct(initialState) === 0 && getSynergyHarvestBonus(initialState) === 0 && getSynergyUpgradeDiscountPct(initialState) === 0 && getSynergyDropChanceMultiplier(initialState) === 1, 'fresh state should have no synergy bonus');
  const synergyState = {
    ...initialState,
    jobData: {
      ...initialState.jobData,
      fishing: { level: 7, xp: 0, seenMusings: [] },
      mining: { level: 6, xp: 0, seenMusings: [] },
      rest: { level: 5, xp: 0, seenMusings: [] },
      nightwatch: { level: 6, xp: 0, seenMusings: [] },
      woodcutting: { level: 8, xp: 0, seenMusings: [] },
      housekeeping: { level: 7, xp: 0, seenMusings: [] },
      booktrade: { level: 7, xp: 0, seenMusings: [] },
    },
  };
  console.assert(getSynergySellBonusPct(synergyState) === 10, 'fishing Lv7 should give +10% sell synergy');
  console.assert(getSynergyAttackBonus(synergyState) === 3, 'mining Lv6 should give +3 attack synergy');
  console.assert(getSynergyAdventureFailReduction(synergyState) === 0.04, 'rest Lv5 should give -4% adventure fail synergy');
  console.assert(getSynergyEntryCostReductionPct(synergyState) === 10, 'nightwatch Lv6 should give -10% entry cost synergy');
  console.assert(getSynergyHarvestBonus(synergyState) === 3, 'woodcutting Lv8 should give +3 harvest synergy');
  console.assert(getSynergyUpgradeDiscountPct(synergyState) === 12, 'housekeeping Lv7 should give -12% upgrade discount synergy');
  console.assert(getUpgradeGoldCost(synergyState, 100) === 88, 'upgrade gold cost should include housekeeping synergy');
  console.assert(Math.abs(getSynergyDropChanceMultiplier(synergyState) - 1.1) < 1e-9, 'booktrade Lv7 should give x1.10 drop chance synergy');
  console.assert(getSynergyChains(synergyState).length === 7, 'there should be seven synergy chains');
  console.assert(getSynergyChains(synergyState).filter((chain) => Boolean(chain.active)).length === 7, 'all seven synergy chains should activate for the grown state');
  console.assert(getChainHintForJob(synergyState, 'fishing') === '商人 売却+10%', 'job menu chain hint should show the active fishing chain');
  console.assert(getChainHintForJob(initialState, 'fishing') === '商人 売却（Lv3から）', 'job menu chain hint should show the inactive fishing chain');
  console.assert(getChainHintForJob(initialState, 'office') === null, 'jobs without a chain should have no menu hint');
  console.assert(getCropRewards('daikon', Date.now() - 1000, Date.now(), synergyState).rewards[0].amount === 6, 'daikon harvest should include woodcutting synergy');
  console.assert(getCropRewards('daikon', Date.now() - 1000, Date.now(), initialState).rewards[0].amount === 3, 'daikon harvest should be unchanged without woodcutting synergy');
  console.assert(getAdventureEntryCost(initialState, 100) === 100 && getAdventureEntryCost(synergyState, 100) === 90, 'adventure entry cost should include nightwatch synergy');
  const forestArea = jobs.adventure.areas[0];
  console.assert(getFailChance(forestArea, jobs.adventure.upgrades, {}, synergyState) === Math.max(0, (forestArea.failChance ?? 0) - 0.04), 'adventure fail chance should include rest synergy');
  console.assert(getFailChance(jobs.fishing.areas[0], jobs.fishing.upgrades, {}, synergyState) === (jobs.fishing.areas[0].failChance ?? 0), 'rest synergy should not touch non-adventure fail chance');
  console.assert(getHeroAttack(synergyState, 3, jobs.adventure) === getHeroAttack(initialState, 3, jobs.adventure) + 3, 'hero attack should include mining synergy');
  // 特性（2026-11-06 / ロードマップ3）: 派生計算だけで、初期状態は無効・選択で上限付きに効くこと。
  console.assert(initialState.trait === null && initialState.traitChanges === 0, 'fresh state should have no trait selected');
  console.assert(getTraitAttackBonus(initialState) === 0 && getTraitFailReduction(initialState) === 0 && getTraitHarvestBonus(initialState) === 0 && getTraitSellBonusPct(initialState) === 0 && getTraitJobGoldBonusPct(initialState) === 0 && getTraitOfflineMultiplier(initialState) === 1 && getTraitRestXpMultiplier(initialState) === 1, 'fresh state should have no trait bonus');
  console.assert(getTraitChangeCost(initialState) === 0, 'first trait choice should be free');
  const craftsmanState = { ...initialState, trait: 'craftsman' as const, traitChanges: 0 };
  const adventurerState = { ...initialState, trait: 'adventurer' as const, traitChanges: 0 };
  const merchantState = { ...initialState, trait: 'merchant' as const, traitChanges: 0 };
  const easygoingState = { ...initialState, trait: 'easygoing' as const, traitChanges: 0 };
  console.assert(getTraitHarvestBonus(craftsmanState) === 1, 'craftsman trait should give +1 harvest');
  console.assert(getCropRewards('daikon', Date.now() - 1000, Date.now(), craftsmanState).rewards[0].amount === 4, 'daikon harvest should include craftsman trait');
  console.assert(getUpgradeGoldCost(craftsmanState, 100) === 90, 'upgrade gold cost should include craftsman trait discount');
  console.assert(getUpgradeGoldCost({ ...synergyState, trait: 'craftsman' as const }, 100) === 79, 'craftsman discount should stack separately after housekeeping synergy');
  console.assert(getTraitAttackBonus(adventurerState) === 3, 'adventurer trait should give +3 attack');
  console.assert(getHeroAttack(adventurerState, 3, jobs.adventure) === getHeroAttack(initialState, 3, jobs.adventure) + 3, 'hero attack should include adventurer trait');
  console.assert(getTraitFailReduction(adventurerState) === 0.05, 'adventurer trait should give -5% fail reduction');
  console.assert(getFailChance(forestArea, jobs.adventure.upgrades, {}, adventurerState) === Math.max(0, (forestArea.failChance ?? 0) - 0.05), 'adventure fail chance should include adventurer trait');
  console.assert(getFailChance(jobs.fishing.areas[0], jobs.fishing.upgrades, {}, adventurerState) === (jobs.fishing.areas[0].failChance ?? 0), 'adventurer trait should not touch non-adventure fail chance');
  console.assert(getTraitSellBonusPct(merchantState) === 15 && getTraitJobGoldBonusPct(merchantState) === 10, 'merchant trait should give +15% sell and +10% job gold');
  console.assert(Math.abs(getSellPriceMultiplier(merchantState) - 1.15) < 1e-9, 'sell price multiplier should include merchant trait');
  console.assert(getTraitOfflineMultiplier(easygoingState) === 1.2, 'easygoing trait should give x1.20 offline efficiency');
  console.assert(getTraitRestXpMultiplier(easygoingState) === 1.25, 'easygoing trait should give x1.25 rest xp');
  console.assert(getTraitRestXpMultiplier(merchantState) === 1, 'rest xp trait bonus should apply only to easygoing');
  // 特性の選択・変更: 初回無料・変更は 500G×(変更回数+1)・金不足は変更不可。
  const firstPick = selectTrait({ ...initialState, gold: 40 }, 'merchant');
  console.assert(firstPick.trait === 'merchant' && firstPick.gold === 40 && firstPick.traitChanges === 0, 'first trait choice should be free and keep change count at 0');
  console.assert(firstPick.musingQueue.some((m) => m.id === 'trait-first-merchant'), 'first trait choice should queue a one-time event musing');
  const samePick = selectTrait(firstPick, 'merchant');
  console.assert(samePick === firstPick, 're-selecting the same trait should change nothing');
  console.assert(getTraitChangeCost(firstPick) === 500, 'first trait change should cost 500G');
  const changed = selectTrait({ ...firstPick, gold: 600 }, 'adventurer');
  console.assert(changed.trait === 'adventurer' && changed.gold === 100 && changed.traitChanges === 1, 'trait change should pay 500G and count one change');
  console.assert(getTraitChangeCost(changed) === 1000, 'second trait change should cost 1000G');
  const brokeChange = selectTrait({ ...firstPick, gold: 499 }, 'adventurer');
  console.assert(brokeChange.trait === 'merchant' && brokeChange.gold === 499, 'trait change without enough gold should not apply');
  console.assert(brokeChange.musingQueue.some((m) => m.eventSubType === 'not_enough_gold_for_trait'), 'trait change without enough gold should explain via a failure musing');
  // 旧セーブ: trait フィールドなし（v1〜v4相当）の読み込みが未選択扱いで壊れないこと。
  const migratedNoTrait = migrateState({ gold: 55, jobData: { fishing: { level: 2, xp: 0, seenMusings: [] } }, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoTrait.trait === null && migratedNoTrait.traitChanges === 0 && migratedNoTrait.gold === 55, 'old save without trait fields should migrate as unselected');
  const migratedBadTrait = migrateState({ gold: 55, trait: 'unknown' as never, traitChanges: -3, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedBadTrait.trait === null && migratedBadTrait.traitChanges === 0, 'invalid trait values should normalize to unselected');
  const migratedWithTrait = migrateState({ gold: 55, trait: 'easygoing' as const, traitChanges: 2, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedWithTrait.trait === 'easygoing' && migratedWithTrait.traitChanges === 2, 'trait selection should survive migration');
  // エンドゲーム（2026-11-07 / ロードマップ4）: 玉座の間は静かな王冠で解禁され、ボス4体だけが出ること。
  const throneRoom = jobs.adventure.areas.find((area) => area.id === 'throne_room');
  console.assert(throneRoom !== undefined, 'throne room area should exist');
  console.assert(throneRoom?.unlock?.type === 'item' && 'item' in (throneRoom?.unlock || {}) && (throneRoom?.unlock as { item: string }).item === 'quiet_crown', 'throne room should unlock with quiet crown');
  console.assert(checkRequirement(throneRoom?.unlock, { ...initialState, items: { quiet_crown: 1 } }) === true, 'quiet crown should unlock the throne room');
  console.assert(checkRequirement(throneRoom?.unlock, initialState) === false, 'throne room should stay locked without quiet crown');
  console.assert(describeRequirement(throneRoom?.unlock, initialState).includes('静かな王冠'), 'throne room hint should name the quiet crown');
  const throneBosses = (throneRoom?.monsters || []).filter((monster) => monster.boss);
  console.assert((throneRoom?.monsters || []).length === 4 && throneBosses.length === 4, 'throne room should hold exactly four bosses');
  console.assert(throneBosses.every((monster) => monster.hp >= 150 && monster.attack >= 22), 'throne bosses should outrank courtyard monsters');
  console.assert(throneBosses.some((monster) => (monster.drops || []).some((drop) => drop.item === 'throne_key')), 'throne bosses should drop the throne key');
  console.assert(itemName('throne_key') === '玉座の鍵', 'throne key should be a catalog item');
  // ボス連戦: 連勝数とXPボーナスの純粋計算。
  console.assert(nextBossStreak(0, true) === 1 && nextBossStreak(2, true) === 3 && nextBossStreak(3, false) === 0, 'boss streak should grow on wins and reset on losses');
  console.assert(bossStreakBonusPct(0) === 0 && bossStreakBonusPct(1) === 0 && bossStreakBonusPct(2) === 10 && bossStreakBonusPct(3) === 20 && bossStreakBonusPct(6) === 50 && bossStreakBonusPct(99) === 50, 'boss streak bonus should be +10% per win after the first, capped at +50%');
  // 最上位拠点整備: 冒険Lv8〜10で解禁される3種があり、攻撃力の土台を押し上げること。
  const topUpgrades = jobs.adventure.upgrades.filter((upgrade) => (upgrade.level || 0) >= 8);
  console.assert(topUpgrades.length === 3, 'there should be three top-tier adventure upgrades');
  console.assert(topUpgrades.every((upgrade) => upgrade.cost.gold >= 400 && (upgrade.effects.maxHp || 0) >= 25), 'top-tier upgrades should cost at least 400G and add at least 25 max HP');
  // 旧セーブ: bossStreak 未記録・不正値は 0 に倒れること。
  const migratedNoStreak = migrateState({ gold: 55, jobData: { fishing: { level: 2, xp: 0, seenMusings: [] } }, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoStreak.bossStreak === 0, 'old save without boss streak should migrate as zero');
  const migratedBadStreak = migrateState({ gold: 55, bossStreak: -2, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedBadStreak.bossStreak === 0, 'invalid boss streak should normalize to zero');
  const migratedWithStreak = migrateState({ gold: 55, bossStreak: 3, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedWithStreak.bossStreak === 3, 'boss streak should survive migration');
  // 転生（2026-11-07 / ロードマップ5）: 引退3回が条件で、獲得は思い出の累計から平方根型。
  console.assert(!canRebirth(initialState) && getRebirthPoints(initialState) === 0, 'fresh state should not be rebirthable');
  const rebirthReady = {
    ...grownState,
    prestige: { memoryPoints: 20, totalEarned: 100, retireCount: 3, upgrades: { memory_xp: 2 }, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: {} },
  };
  console.assert(canRebirth(rebirthReady) && getRebirthPoints(rebirthReady) === 20, 'three retires with 100 total memory should grant 20 rebirth points');
  const notYetRebirth = { ...rebirthReady, prestige: { ...rebirthReady.prestige, retireCount: 2 } };
  console.assert(!canRebirth(notYetRebirth) && rebirth(notYetRebirth, initialState) === notYetRebirth, 'two retires should not unlock rebirth');
  // 転生: 第1層まで置いていき、転生の証と転生回数だけが残ること。
  const rebirthed = rebirth(rebirthReady, initialState);
  console.assert(rebirthed !== rebirthReady && rebirthed.jobData.fishing.level === 1 && rebirthed.gold === initialState.gold, 'rebirth should reset run progress');
  console.assert(rebirthed.prestige?.rebirthCount === 1 && rebirthed.prestige?.rebirthPoints === 20 && rebirthed.prestige?.totalRebirthEarned === 20, 'rebirth should bank rebirth points');
  console.assert(rebirthed.prestige?.memoryPoints === 0 && rebirthed.prestige?.totalEarned === 0 && rebirthed.prestige?.retireCount === 0 && Object.keys(rebirthed.prestige?.upgrades || {}).length === 0, 'rebirth should reset layer-1 memory and upgrades');
  console.assert(rebirthed.achievements.includes('first_fish') && rebirthed.achievements.includes('first_rebirth'), 'rebirth should keep achievements and add first_rebirth');
  const rebirthedAgain = rebirth({ ...rebirthReady, prestige: { ...rebirthReady.prestige, rebirthCount: 2, rebirthPoints: 5, totalRebirthEarned: 15 } }, initialState);
  console.assert(rebirthedAgain.prestige?.rebirthCount === 3 && rebirthedAgain.achievements.includes('rebirth_3'), 'third rebirth should add the rebirth_3 achievement');
  // 転生の強化: 所持する証の範囲でだけ買えて、倍率と上限に効くこと。
  const boughtRebirth = buyRebirthUpgrade(rebirthed, 'rebirth_efficiency');
  console.assert(boughtRebirth.prestige?.rebirthUpgrades.rebirth_efficiency === 1, 'rebirth upgrade should apply one stage');
  console.assert((boughtRebirth.prestige?.rebirthPoints || 0) === 17, 'rebirth upgrade should cost points');
  const brokeRebirth = buyRebirthUpgrade({ ...initialState, prestige: { ...createInitialState(jobs).prestige!, rebirthPoints: 0 } }, 'rebirth_efficiency');
  console.assert(brokeRebirth.prestige?.rebirthUpgrades.rebirth_efficiency === undefined, 'rebirth upgrade should not apply without points');
  const rebirthBoosted = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, rebirthUpgrades: { rebirth_efficiency: 2, rebirth_chest: 2, rebirth_offline: 1, rebirth_memory: 1 } } };
  console.assert(getRebirthSpeedMultiplier(rebirthBoosted) === 1.2, 'rebirth efficiency 2 should give x1.20 speed');
  console.assert(getRebirthChestLimitBonus(rebirthBoosted) === 4 && getChestLimit(rebirthBoosted) === 44, 'rebirth chest 2 should add +4 chest limit');
  console.assert(getRebirthOfflineCapHours(rebirthBoosted) === 84 && getOfflineMaxTicks(rebirthBoosted) === 84 * 60 * 60, 'rebirth offline 1 should extend the offline cap to 84 hours');
  console.assert(getRetirementPoints({ ...grownState, prestige: { ...createInitialState(jobs).prestige!, rebirthUpgrades: { rebirth_memory: 1 } } }) === 15, 'rebirth memory 1 should raise retirement points from 12 to 15');
  // 転生の移行: v4セーブ（転生フィールド無し）は空の転生状態で v5 になり、証は引き継がれること。
  // v4相当のセーブは転生フィールドを持たない形で渡す（旧セーブの再現のため unknown 経由）。
  const migratedV4 = migrateState({ saveVersion: 4, gold: 50, jobData: { fishing: { level: 4, xp: 0, seenMusings: [] } }, items: { small_fish: 3 }, prestige: { memoryPoints: 5, totalEarned: 5, retireCount: 1, upgrades: {} } } as unknown as Partial<typeof initialState>, initialState);
  console.assert(migratedV4.saveVersion === SAVE_VERSION && migratedV4.prestige?.rebirthPoints === 0 && migratedV4.prestige?.rebirthCount === 0 && migratedV4.autoRestReturn === null, 'v4 save should gain an empty rebirth state');
  const migratedWithRebirth = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 7, totalRebirthEarned: 7, rebirthCount: 1, rebirthUpgrades: { rebirth_gold: 1 } } } as Partial<typeof initialState>, initialState);
  console.assert(migratedWithRebirth.prestige?.rebirthPoints === 7 && migratedWithRebirth.prestige?.rebirthUpgrades.rebirth_gold === 1, 'rebirth data should survive migration');
  // 自動化の既定: 宝箱の自動開封と自動休憩はどちらも OFF から始まること。
  console.assert(defaultSettings.autoOpenChest === false && defaultSettings.autoRest === false, 'auto chest and auto rest should default to off');
  // 自動休憩・宝箱の自動開封: node でのみ localStorage を差し替えて tick 挙動を検証する
  // （ブラウザでは起動時の selfTests がユーザーの設定を触らないよう、ここは実行しない）。
  if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    const stub = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    };
    (globalThis as unknown as Record<string, unknown>).localStorage = stub;
    try {
      stub.setItem('yuusha-settings-v1', JSON.stringify({ autoRest: true, autoOpenChest: true }));
      // HP/MP不足の冒険サイクル完了で、自動で休憩へ切り替わること。
      const exhausted = {
        ...initialState,
        activeJob: 'adventure',
        activeArea: 'forest',
        tick: 29,
        hp: 1,
        mp: 1,
        gold: 100,
        jobData: { ...initialState.jobData, mining: { level: 2, xp: 0, seenMusings: [] } },
        items: { ...initialState.items, permission_to_rest: 1 },
      };
      const rested = runTick(exhausted);
      console.assert(rested.activeJob === 'rest' && rested.autoRestReturn?.job === 'adventure' && rested.autoRestReturn?.area === 'forest', 'auto rest should switch to rest and remember the return target');
      console.assert((rested.eventLog[0] || '').includes('自動休憩'), 'auto rest should log the switch');
      // 休憩で8割まで回復したら、元の仕事へ自動で戻ること。
      const returned = runTick({ ...rested, hp: 79, mp: 79 });
      console.assert(returned.activeJob === 'adventure' && returned.activeArea === 'forest' && returned.autoRestReturn === null, 'auto rest should return to the previous job after recovery');
      // 宝箱が上限のとき、サイクル完了でいちばん古い宝箱が自動で開くこと。
      const fullChests = Array.from({ length: 40 }, (_, i) => ({ uid: `test-chest-${i}`, type: 'worn' as const, name: 'テスト宝箱', description: '', obtainedAt: 0 }));
      const chestFull = {
        ...initialState,
        activeJob: 'rest',
        activeArea: 'nap',
        tick: 24,
        treasureChests: fullChests,
        equipmentInventory: [],
        items: { ...initialState.items, permission_to_rest: 1 },
      };
      const opened = runTick(chestFull);
      console.assert(opened.treasureChests.length === 39 && opened.equipmentInventory.length === 1, 'auto chest open should open the oldest chest when full');
      console.assert(!opened.treasureChests.some((chest) => chest.uid === 'test-chest-39'), 'auto chest open should remove the oldest chest first');
    } finally {
      delete (globalThis as unknown as Record<string, unknown>).localStorage;
    }
  }
  // 実績120件（2026-11-07）: 定義数・ヒント・カテゴリ・節目・通算カウンタ・ボーナス。
  const achievementIds = Object.keys(ACHIEVEMENTS);
  console.assert(achievementIds.length === 120, `achievements should total 120 (got ${achievementIds.length})`);
  console.assert(new Set(Object.values(ACHIEVEMENTS).map((a) => a.name)).size === 120, 'achievement names should be unique');
  console.assert(Object.values(ACHIEVEMENTS).every((a) => a.name && a.description && a.hint && a.category), 'every achievement should have a name, description, hint and category');
  const twentyFour = achievementIds.filter((id) => !['achievements_25', 'achievements_50', 'achievements_75', 'achievements_100', 'achievements_120', 'ten_achievements'].includes(id)).slice(0, 24);
  const milestoneLogs: string[] = [];
  const with25 = addAchievement({ ...initialState, achievements: twentyFour }, twentyFour.length ? achievementIds.find((id) => !twentyFour.includes(id) && !id.startsWith('achievements_') && id !== 'ten_achievements')! : 'first_fish', milestoneLogs);
  console.assert(with25.includes('achievements_25'), 'the 25th achievement should also grant achievements_25');
  const allBut120 = achievementIds.filter((id) => id !== 'achievements_120' && id !== 'synergy_all_7');
  const completed = addAchievement({ ...initialState, achievements: allBut120 }, 'synergy_all_7', []);
  console.assert(completed.length === 120 && completed.includes('achievements_120'), 'collecting the last achievement should grant achievements_120 and reach 120');
  const milestoneState = {
    ...initialState,
    jobData: { ...initialState.jobData, fishing: { level: 5, xp: 0, seenMusings: [] }, mining: { level: 2, xp: 0, seenMusings: [] }, rest: { level: 2, xp: 0, seenMusings: [] }, nightwatch: { level: 2, xp: 0, seenMusings: [] }, woodcutting: { level: 4, xp: 0, seenMusings: [] }, housekeeping: { level: 2, xp: 0, seenMusings: [] }, booktrade: { level: 3, xp: 0, seenMusings: [] } },
    lifetime: { ...emptyLifetime(), cycles: 100 },
  };
  const checked = checkMilestoneAchievements(milestoneState, []);
  console.assert(checked.includes('job5_fishing'), 'fishing level 5 should grant job5_fishing');
  console.assert(checked.includes('cycles_100'), '100 lifetime cycles should grant cycles_100');
  console.assert(checked.includes('synergy_all_7'), 'all seven synergy chains active should grant synergy_all_7');
  console.assert(getAchievementGoldMultiplier({ ...initialState, achievements: [] }) === 1, 'no achievements should mean no gold bonus');
  console.assert(getAchievementGoldMultiplier({ ...initialState, achievements: Array.from({ length: 20 }, (_, i) => `test-${i}`) }) === 1.04, '20 achievements should give +4% gold');
  console.assert(getAchievementBonusLines({ ...initialState, achievements: [] }).some((line) => line.includes('次の節目：実績10個')), 'bonus lines should point to the next milestone');
  console.assert(getAchievementProgress({ ...initialState, jobData: { ...initialState.jobData, fishing: { level: 3, xp: 0, seenMusings: [] } } }, 'job5_fishing')?.current === 3, 'job5_fishing progress should track the job level');
  const migratedNoLifetime = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoLifetime.lifetime?.cycles === 0 && (migratedNoLifetime.lifetime?.discovered || []).length === 0, 'a save without lifetime should gain empty lifetime counters');
  const retiredWithLifetime = retire({ ...grownState, lifetime: { ...emptyLifetime(), cycles: 100 } }, initialState);
  console.assert(retiredWithLifetime.lifetime?.cycles === 100, 'retire should keep lifetime counters');
  const traitPicked = applyMilestoneAchievements(selectTrait({ ...initialState, gold: 0 }, 'craftsman'));
  console.assert(traitPicked.trait === 'craftsman' && traitPicked.achievements.includes('trait_craftsman'), 'choosing the craftsman trait should grant trait_craftsman');
  // 週間目標・季節イベント・図鑑コンプリート報酬（2026-11-07 / ロードマップ7）。
  // 週キー：月曜始まりで、同じ週の月曜〜日曜は同じキー、翌月曜は別キー。
  console.assert(getWeekKey(new Date(2026, 10, 9)) === getWeekKey(new Date(2026, 10, 15)), 'monday to sunday of the same week should share a week key');
  console.assert(getWeekKey(new Date(2026, 10, 9)) !== getWeekKey(new Date(2026, 10, 16)), 'next monday should start a new week key');
  console.assert(getWeeklyGoals(getWeekKey(new Date(2026, 10, 9))).length === 3, 'each week should have three goals');
  console.assert(JSON.stringify(getWeeklyGoals('2026-W46')) === JSON.stringify(getWeeklyGoals('2026-W46')), 'weekly goals should be deterministic per week key');
  // 週またぎ：同じ週は同じ state、週が変われば baseline を取り直して claimed を空にする。
  const weekState = ensureWeeklyState(initialState, new Date(2026, 10, 9));
  console.assert(weekState.weekly?.weekKey === getWeekKey(new Date(2026, 10, 9)), 'ensureWeeklyState should stamp the current week key');
  console.assert(ensureWeeklyState(weekState, new Date(2026, 10, 12)) === weekState, 'ensureWeeklyState should return the same state within the week');
  const grownWeekly = { ...weekState, lifetime: { ...emptyLifetime(), cycles: 120, goldEarned: 5000 } };
  const nextWeek = ensureWeeklyState(grownWeekly, new Date(2026, 10, 16));
  console.assert(nextWeek.weekly?.baseline.cycles === 120 && nextWeek.weekly?.claimed.length === 0, 'a new week should re-baseline from lifetime and clear claims');
  // 受け取り：達成済み・未受取だけ金が増え、2回目は冪等。未達成は無変化。
  const claimable = { ...weekState, lifetime: { ...emptyLifetime(), cycles: 1000, goldEarned: 100000, kills: 100, salesGold: 100000, harvests: 100, chestsOpened: 100, musingsRead: 100, discovered: Array.from({ length: 50 }, (_, i) => `item-${i}`) } };
  const firstGoal = getWeeklyGoals(claimable.weekly!.weekKey)[0];
  const claimedOnce = claimWeeklyGoal(claimable, firstGoal.id, new Date(2026, 10, 9));
  console.assert(claimedOnce.gold === claimable.gold + firstGoal.rewardGold && claimedOnce.weekly?.claimed.includes(firstGoal.id), 'claiming an achieved weekly goal should pay its reward once');
  console.assert(claimWeeklyGoal(claimedOnce, firstGoal.id, new Date(2026, 10, 9)).gold === claimedOnce.gold, 'claiming the same weekly goal twice should not pay again');
  console.assert(claimWeeklyGoal(weekState, firstGoal.id, new Date(2026, 10, 9)).gold === weekState.gold, 'claiming an unachieved weekly goal should pay nothing');
  // 季節：月→季節の対応と冬の年またぎ。
  console.assert(getCurrentSeason(new Date(2026, 2, 15)).id === 'spring' && getCurrentSeason(new Date(2026, 6, 1)).id === 'summer', 'march should be spring and july summer');
  console.assert(getCurrentSeason(new Date(2026, 9, 1)).id === 'autumn' && getCurrentSeason(new Date(2026, 11, 25)).id === 'winter', 'october should be autumn and december winter');
  console.assert(getCurrentSeason(new Date(2027, 0, 15)).id === 'winter' && getCurrentSeason(new Date(2027, 0, 15)).daysLeft > 0, 'january should be winter with days left');
  console.assert(seasonStartMusingId(getCurrentSeason(new Date(2026, 11, 25))) === seasonStartMusingId(getCurrentSeason(new Date(2027, 0, 15))), 'december and january of one winter should share a season musing id');
  console.assert(getCurrentSeason(new Date(2026, 10, 7)).daysLeft > 0 && getCurrentSeason(new Date(2026, 10, 7)).eventName === '秋の収穫祭', 'november should show the autumn festival with days left');
  // 季節お守りの抽選フィルタ：季節違いは候補外、無季節はいつでも候補。
  console.assert(isEquipmentBaseInSeason('spring_sprout_charm', 'spring') && !isEquipmentBaseInSeason('spring_sprout_charm', 'summer'), 'spring charm should be a candidate only in spring');
  console.assert(isEquipmentBaseInSeason('winter_lamp_charm', 'winter') && isEquipmentBaseInSeason('better_stick', 'winter'), 'winter charm and seasonless bases should be candidates in winter');
  console.assert(SEASONAL_ITEM_IDS.length === 4 && SEASONAL_ITEM_IDS.every((id) => itemKind(id) === '素材'), 'there should be four seasonal material items');
  // 図鑑コンプリート：未達成は倍率1.0、全発見で金+10%、全討伐でXP+10%。
  console.assert(getCollectionGoldMultiplier(initialState) === 1 && getCollectionXpMultiplier(initialState) === 1, 'fresh state should have no collection bonus');
  const allDiscoverable = getAllDiscoverableItemIds();
  const allMonsters = getAllMonsterIds();
  console.assert(allMonsters.length === 46, `there should be 46 monsters to defeat (got ${allMonsters.length})`);
  console.assert(allMonsters.includes('past_life_echo') && allMonsters.includes('new_life_wisp'), 'rebirth corridor monsters should be counted');
  // 転生専用コンテンツ（2026-11-07 / ロードマップ5の残り）：転生1回で解禁される仕事とエリア。
  // 初期状態では未解禁、転生1回で解禁。転生は周回でリセットされないため再ロックは起きない。
  console.assert(jobs.rebirth_guide && jobs.rebirth_guide.areas.length === 2 && jobs.rebirth_guide.upgrades.length === 3, 'rebirth guide job should have two areas and three upgrades');
  console.assert(checkRequirement(jobs.rebirth_guide.unlock, initialState) === false, 'rebirth guide should be locked before any rebirth');
  const rebirthedOnce = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, rebirthCount: 1 } };
  console.assert(checkRequirement(jobs.rebirth_guide.unlock, rebirthedOnce) === true, 'rebirth guide should unlock after one rebirth');
  console.assert(describeRequirement(jobs.rebirth_guide.unlock, initialState).includes('転生1回'), 'rebirth unlock hint should name the rebirth count');
  const rebirthCorridor = jobs.adventure.areas.find((area) => area.id === 'rebirth_corridor');
  console.assert(rebirthCorridor && checkRequirement(rebirthCorridor.unlock, initialState) === false && checkRequirement(rebirthCorridor.unlock, rebirthedOnce) === true, 'rebirth corridor should unlock after one rebirth');
  console.assert(!isJobUnlocked('rebirth_guide', initialState) && isJobUnlocked('rebirth_guide', rebirthedOnce), 'rebirth guide should be locked fresh and unlocked after rebirth');
  // 解禁間隔の再設計（2026-11-07）：仕事の解禁は Lv3 までに収め、整備は Lv2 → Lv4 → Lv6 の2刻みにする。
  console.assert(Object.values(jobs).every((job) => job.unlock.type !== 'jobLevel' || (job.unlock.level || 0) <= 3), 'every job gate should be at most level 3');
  console.assert(Object.entries(jobs).filter(([key]) => key !== 'adventure').every(([, job]) => job.upgrades.some((upgrade) => (upgrade.level || 0) === 6)), 'every non-adventure job should have a level 6 upgrade');
  const castleSalvage = jobs.merchant.areas.find((area) => area.id === 'castle_salvage');
  const castleSalvageUnlock = castleSalvage?.unlock;
  console.assert(castleSalvageUnlock?.type === 'jobLevel' && castleSalvageUnlock.job === 'adventure' && castleSalvageUnlock.level === 4, 'castle salvage should open at adventure level 4');
  console.assert(jobs.delivery.unlock.type === 'jobLevel' && jobs.delivery.unlock.level === 3 && jobs.nightwatch.unlock.type === 'jobLevel' && jobs.nightwatch.unlock.job === 'delivery' && jobs.nightwatch.unlock.level === 3, 'delivery should open at office level 3 and nightwatch at delivery level 3');
  console.assert(jobs.booktrade.unlock.type === 'jobLevel' && jobs.booktrade.unlock.level === 2, 'booktrade should open at merchant level 2');
  const completeState = { ...initialState, lifetime: { ...emptyLifetime(), discovered: allDiscoverable }, defeatedMonsters: allMonsters };
  console.assert(getCollectionGoldMultiplier(completeState) === 1.1 && getCollectionXpMultiplier(completeState) === 1.1, 'full discovery should give +10% gold and full defeat +10% xp');
  console.assert(getCollectionBonusLines(initialState).some((line) => line.includes('あと')), 'collection bonus lines should point to the remaining counts');
  console.assert(!allDiscoverable.some((id) => SEASONAL_ITEM_IDS.includes(id)), 'seasonal items should not count toward collection completion');
  // 旧セーブ：weekly 無しは未設定扱いで、次の tick で今週の起点が作られる。
  const migratedNoWeekly = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoWeekly.weekly === undefined, 'old save without weekly should migrate as unset');
  const migratedWithWeekly = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, weekly: { weekKey: '2026-W45', baseline: { cycles: 10, goldEarned: 100, kills: 1, salesGold: 50, harvests: 0, chestsOpened: 0, musingsRead: 2, discovered: 3 }, claimed: ['weekly_cycles_50'] } } as Partial<typeof initialState>, initialState);
  console.assert(migratedWithWeekly.weekly?.weekKey === '2026-W45' && migratedWithWeekly.weekly?.claimed.includes('weekly_cycles_50'), 'weekly state should survive migration');
  const migratedBadWeekly = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, weekly: { weekKey: 42, baseline: null, claimed: 'no' } } as unknown as Partial<typeof initialState>, initialState);
  console.assert(migratedBadWeekly.weekly === undefined, 'invalid weekly values should normalize to unset');
  // 引退・転生でも週間目標の進行を引き継ぐ。
  const retiredWeekly = retire({ ...grownState, lifetime: { ...emptyLifetime(), cycles: 100 }, weekly: weekState.weekly }, initialState);
  console.assert(retiredWeekly.weekly?.weekKey === weekState.weekly?.weekKey, 'retire should keep weekly progress');
  const rebirthedWeekly = rebirth({ ...rebirthReady, lifetime: { ...emptyLifetime(), cycles: 100 }, weekly: weekState.weekly }, initialState);
  console.assert(rebirthedWeekly.weekly?.weekKey === weekState.weekly?.weekKey, 'rebirth should keep weekly progress');
  // オフライン深化（ロードマップ11）：効率の伸びしろと上限の拡張。
  // 寝ている間の勘は6段階まで（最大 +90%）、転生の余裕は4段階まで（上限 5日ぶん）。
  const offlineMaxed = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, upgrades: { memory_offline: 6 }, rebirthUpgrades: { rebirth_offline: 4 } } };
  console.assert(getPrestigeStage(offlineMaxed, 'memory_offline') === 6 && getPrestigeOfflineMultiplier(offlineMaxed) === 1.9, 'memory offline 6 should give +90% offline efficiency');
  console.assert(getRebirthStage(offlineMaxed, 'rebirth_offline') === 4 && getRebirthOfflineCapHours(offlineMaxed) === 120 && getOfflineMaxTicks(offlineMaxed) === 120 * 60 * 60, 'rebirth offline 4 should extend the offline cap to 120 hours');
  const offlineOverflow = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, upgrades: { memory_offline: 9 }, rebirthUpgrades: { rebirth_offline: 9 } } };
  console.assert(getPrestigeStage(offlineOverflow, 'memory_offline') === 6 && getRebirthStage(offlineOverflow, 'rebirth_offline') === 4, 'offline stages should clamp to their new maxima');
  console.assert(buyPrestigeUpgrade(offlineMaxed, 'memory_offline') === offlineMaxed, 'buying memory offline past max should be a no-op');
  const offlineLegacy = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: { memory_offline: 4 }, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: { rebirth_offline: 3 } } } as Partial<typeof initialState>, initialState);
  console.assert(getPrestigeStage(offlineLegacy, 'memory_offline') === 4 && getRebirthStage(offlineLegacy, 'rebirth_offline') === 3, 'old saves should keep their offline stages under the new maxima');
  // 帰還サマリの詳細化：不在前後の差分から XP・レベルアップ・討伐・新発見を出すこと。
  const offlineBefore = {
    ...initialState,
    jobData: { ...initialState.jobData, fishing: { level: 1, xp: 0, seenMusings: [] }, mining: { level: 1, xp: 0, seenMusings: [] } },
    lifetime: { ...emptyLifetime(), kills: 0, discovered: [] },
  };
  const offlineAfter = {
    ...offlineBefore,
    jobData: { ...offlineBefore.jobData, fishing: { level: 2, xp: 5, seenMusings: [] }, mining: { level: 1, xp: 3, seenMusings: [] } },
    lifetime: { ...emptyLifetime(), kills: 7, discovered: ['small_fish', 'twig', 'acorn'] },
  };
  console.assert(totalJobXp(offlineBefore) === 0 && totalJobXp(offlineAfter) === 48, 'total job xp should include xp spent on level ups');
  const offlineGains = computeOfflineGains(offlineBefore, offlineAfter);
  console.assert(offlineGains.xpGain === 48 && offlineGains.levelUps.join('・') === '釣りLv2' && offlineGains.killsGain === 7 && offlineGains.discoveredGain === 3, 'offline gains should report xp, level ups, kills and new discoveries');
  const offlineSame = computeOfflineGains(offlineBefore, offlineBefore);
  console.assert(offlineSame.xpGain === 0 && offlineSame.levelUps.length === 0 && offlineSame.killsGain === 0 && offlineSame.discoveredGain === 0, 'no offline change should report zero gains');
  // 季節カレンダー（ロードマップ7の残り）：4季節が月を重なりなく覆い、今の季節が1つだけ。
  const autumnCalendar = getSeasonCalendar(new Date(2026, 10, 7));
  console.assert(autumnCalendar.length === 4 && autumnCalendar.filter((entry) => entry.isCurrent).length === 1, 'season calendar should have four seasons with exactly one current');
  console.assert(autumnCalendar.find((entry) => entry.isCurrent)?.id === 'autumn' && (autumnCalendar.find((entry) => entry.isCurrent)?.daysLeft || 0) > 0, 'november calendar should mark autumn as current with days left');
  console.assert(autumnCalendar.filter((entry) => !entry.isCurrent).every((entry) => entry.daysLeft === 0), 'non-current seasons should have zero days left');
  console.assert(autumnCalendar.map((entry) => entry.monthsLabel).join('/') === '3〜5月/6〜8月/9〜11月/12〜2月', 'season calendar should cover the year without overlap');
  console.assert(new Set(autumnCalendar.map((entry) => entry.itemId)).size === 4 && autumnCalendar.every((entry) => SEASONAL_ITEM_IDS.includes(entry.itemId)), 'season calendar should list all four seasonal items');
  console.assert(getSeasonCalendar(new Date(2026, 2, 15)).find((entry) => entry.isCurrent)?.id === 'spring', 'march calendar should mark spring as current');
  // 数値バランスの長期化（ロードマップ8）：単一指数の価格曲線。
  console.assert(JSON.stringify(prestigeCostCurve(4, 5)) === JSON.stringify([4, 6, 9, 14, 20]), 'prestige cost curve should be a single exponential (base 4)');
  console.assert(prestigeCostCurve(5, 6).join(',') === '5,8,11,17,25,38', 'prestige cost curve should scale with base');
  console.assert([...PRESTIGE_UPGRADES, ...REBIRTH_UPGRADES].every((def) => JSON.stringify(def.costs) === JSON.stringify(prestigeCostCurve(def.costs[0], def.maxStage))), 'every prestige upgrade should follow the single exponential curve');
  // XP 長期テール：Lv10 までは従来値と同一、Lv11 以降は指数で伸びる。
  console.assert(xpToNext(10) === 1030 && xpToNext(11) === 1388, 'xp curve should keep level 10 and start the long tail at level 11');
  console.assert(xpToNext(20) === 12516, 'xp curve should stretch the late game (level 20)');
  // 実時間タイマー資源：72時間の保存食づくり。農業Lv10で解禁。
  console.assert(CROPS.preserved_meal.growthMs === 72 * 60 * 60_000 && CROPS.preserved_meal.unlockLevel === 10, 'preserved meal should be a 72h crop unlocked at farming level 10');
  console.assert(getJobDropItems('farming').includes('preserved_food'), 'farming collection should include preserved food');
  // 相棒の猫：来訪の抽選となでる、バフの倍率と期限。
  const catFresh = createCatState();
  console.assert(catFresh.visits === 0 && catFresh.visit === null && catFresh.buff === null, 'fresh cat state should have no visits');
  const catGrown = { ...initialState, lifetime: { ...emptyLifetime(), cycles: 100 } };
  const catNoRoll = maybeCatVisit(catGrown, 100_000, 0.99);
  console.assert(catNoRoll.cat?.visit === null && (catNoRoll.cat?.lastRollAt || 0) === 100_000, 'cat should not visit on a high roll');
  const catVisited = maybeCatVisit(catGrown, 200_000, 0.01);
  console.assert(catVisited.cat?.visit !== null && catVisited.cat?.visits === 1, 'cat should visit on a low roll after enough cycles');
  const catClaimed = claimCatVisit({ ...catVisited, cat: { ...catVisited.cat!, visit: { buffId: 'gold_rush', appearedAt: 200_000, expiresAt: 200_000 + 300_000 } } }, 210_000);
  console.assert(catClaimed.cat?.visit === null && catClaimed.cat?.buff?.id === 'gold_rush', 'petting the cat should activate its buff');
  console.assert(getCatGoldMultiplier(catClaimed, 220_000) === 1.5 && getCatGoldMultiplier(catClaimed, 400_000) === 1, 'cat gold buff should be +50% while active and expire');
  console.assert(getCatXpMultiplier(catClaimed, 220_000) === 1, 'gold rush should not boost xp');
  const catGift = claimCatVisit({ ...catVisited, cat: { ...catVisited.cat!, visit: { buffId: 'gift', appearedAt: 200_000, expiresAt: 200_000 + 300_000 } } }, 210_000);
  console.assert(catGift.gold === initialState.gold + getCatGiftGold(catGift), 'cat gift should grant gold immediately');
  const catExpired = refreshCatState({ ...catClaimed, cat: { ...catClaimed.cat!, buff: { id: 'gold_rush', expiresAt: 300_000 } } }, 400_000);
  console.assert(catExpired.cat?.buff === null, 'refresh should clear an expired cat buff');
  const catNoClaim = claimCatVisit(initialState, 100_000);
  console.assert(catNoClaim === initialState, 'petting without a visit should be a no-op');
  console.assert(normalizeCatState({ visits: -3, lastRollAt: 'soon', visit: { buffId: 'nope', appearedAt: 0, expiresAt: 0 }, buff: { id: 'gold_rush', expiresAt: -5 } } as unknown as Parameters<typeof normalizeCatState>[0]).visits === 0, 'invalid cat state should normalize to no visits');
  // 旧セーブ：猫なしは来訪なし扱い、ティッカーは読み込み時に消える。
  const migratedNoCat = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoCat.cat?.visits === 0 && migratedNoCat.tickerMusing === null, 'old save without cat should migrate with no visits and no ticker');
  // ぼやきハイブリッド：日常ぼやきはティッカーへ、キューは触らない。
  const tickerState = routeAmbientMusing(initialState, 'テストのひとりごと。', 5000);
  console.assert(tickerState.tickerMusing?.text === 'テストのひとりごと。' && tickerState.musingQueue.length === 0 && (tickerState.lastAmbientMusingAt || 0) === 5000, 'ambient musings should go to the ticker, not the queue');
  // 図鑑の人物欄：勇者は常時、猫は来訪後、それ以外は未出でヒントつき。
  const peopleFresh = getPeople(initialState);
  console.assert(peopleFresh.length === 8 && peopleFresh[0].met === true && peopleFresh[1].met === false && peopleFresh.slice(2).every((person) => person.met === false && person.hint.length > 0), 'people book should list the hero, the cat, and future faces with hints');
  const peopleMetCat = getPeople({ ...initialState, cat: { ...createCatState(), visits: 1 } });
  console.assert(peopleMetCat[1].met === true && peopleMetCat[1].name === 'ミケ', 'cat should appear in the people book after the first visit');
}

