import { ACHIEVEMENTS, itemDesc, itemKind, itemName } from '../data/catalog';
import { jobs, upgrades } from '../data/gameData';
import { AREA_ART } from '../assets/areaArt';
import { MONSTER_ART } from '../assets/monsterArt';
import { UPGRADE_ART } from '../assets/upgradeArt';
import { SCENE_ART } from '../assets/sceneArtAll';
import { simulateMonsterBattle } from './combat';
import { getJobDropItems } from './collection';
import { getAdventureEntryCost } from './equipment';
import { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
import { getFarmingProgress } from './farming';
import { enqueueMusing, routeAmbientMusing } from './musings';
import { callCat, claimCatVisit, createCatState, getCatCallRemainingMs, getCatGiftGold, getCatGoldMultiplier, getCatXpMultiplier, getFamilyRemittanceGold, getOwnedUpgradeCount, getPeople, getPersonBonusLines, hasMetPerson, maybeCatVisit, maybeFamilyLetter, maybeMeetPeople, normalizeCatState, normalizeMetPeople, refreshCatState } from './companion';
import { prestigeCostCurve } from './pricing';
import { addAchievement, addItems, applyMilestoneAchievements, checkMilestoneAchievements, emptyLifetime, getAchievementBonusLines, getAchievementGoldMultiplier, getAchievementProgress, getAllDiscoverableItemIds, getAllMonsterIds, getCollectionBonusLines, getCollectionGoldMultiplier, getCollectionXpMultiplier, getLifePlan, getNextTarget, rollDrops } from './progression';
import { checkRequirement, describeRequirement, getActiveArea, isJobUnlocked } from './requirements';
import { xpToNext } from './progression';
import { parseSaveBackup, SAVE_BACKUP_GAME_ID } from './saveTransfer';
import { buyPrestigeUpgrade, buyRebirthUpgrade, buySamsaraUpgrade, canRebirth, canRetire, canSamsara, createPrestigeState, getPrestigeOfflineBonus, getPrestigeScore, getPrestigeStage, getRebirthChestLimitBonus, getRebirthOfflineCapHours, getRebirthPoints, getRebirthSpeedMultiplier, getRebirthStage, getRetirementPoints, getSamsaraGoldMultiplier, getSamsaraMusingMultiplier, getSamsaraPoints, getSamsaraRebirthMultiplier, getSamsaraSpeedMultiplier, getSamsaraXpMultiplier, PRESTIGE_UPGRADES, REBIRTH_UPGRADES, rebirth, retire, samsara, SAMSARA_UPGRADES } from './prestige';
import { defaultSettings } from './settings';
import { runTick } from './tick';
import { autoSellGainedItems, isAutoSellTarget } from './automation';
import { getEquipmentPower, getChestLimit, isEquipmentBaseInSeason } from './equipment';
import { getSynergyAdventureFailReduction, getSynergyAttackBonus, getSynergyChains, getSynergyDropChanceMultiplier, getSynergyEntryCostReductionPct, getSynergyHarvestBonus, getSynergySellBonusPct, getSynergyUpgradeDiscountPct, getChainHintForJob, getUpgradeGoldCost } from './synergy';
import { getTraitAttackBonus, getTraitChangeCost, getTraitFailReduction, getTraitHarvestBonus, getTraitJobGoldBonusPct, getTraitOfflineBonus, getTraitRestXpMultiplier, getTraitSellBonusPct, selectTrait } from './traits';
import { getCropRewards, CROPS } from './farming';
import { getCurrentSeason, getSeasonCalendar, SEASONAL_ITEM_IDS, seasonStartMusingId } from './seasons';
import { claimWeeklyGoal, ensureWeeklyState, getWeekKey, getWeeklyGoals } from './weekly';
import { getHeroAttack } from './combat';
import { bossStreakBonusPct, nextBossStreak } from './combat';
import { scaleTowerMonster, towerMilestoneForFloor } from './tower';
import { getFailChance } from './progression';
import { advanceTutorial, buyUpgrade, dismissTutorial, selectArea, selectJob } from './actions';
import { getSellPriceMultiplier } from './equipment';
import { computeOfflineGains, createInitialState, getOfflineEfficiency, getOfflineMaxTicks, migrateState, SAVE_VERSION, totalJobXp } from './state';

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
  console.assert(getTraitAttackBonus(initialState) === 0 && getTraitFailReduction(initialState) === 0 && getTraitHarvestBonus(initialState) === 0 && getTraitSellBonusPct(initialState) === 0 && getTraitJobGoldBonusPct(initialState) === 0 && getTraitOfflineBonus(initialState) === 0 && getTraitRestXpMultiplier(initialState) === 1, 'fresh state should have no trait bonus');
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
  console.assert(getTraitOfflineBonus(easygoingState) === 0.1, 'easygoing trait should add +10% offline efficiency');
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
  // 無限の塔（2026-11-08）: 玉座の鍵で解禁され、既存モンスターを階数で強化して出す。
  const tower = jobs.adventure.areas.find((area) => area.id === 'endless_tower');
  console.assert(tower !== undefined, 'endless tower area should exist');
  console.assert(tower?.unlock?.type === 'item' && 'item' in (tower?.unlock || {}) && (tower?.unlock as { item: string }).item === 'throne_key', 'endless tower should unlock with the throne key');
  console.assert(checkRequirement(tower?.unlock, { ...initialState, items: { throne_key: 1 } }) === true, 'throne key should unlock the endless tower');
  console.assert(checkRequirement(tower?.unlock, initialState) === false, 'endless tower should stay locked without the throne key');
  console.assert(describeRequirement(tower?.unlock, initialState).includes('玉座の鍵'), 'endless tower hint should name the throne key');
  console.assert((tower?.monsters || []).length === 6 && (tower?.monsters || []).every((monster) => !monster.boss), 'tower should hold six non-boss monsters');
  console.assert((tower?.monsters || []).every((monster) => (monster.drops || []).some((drop) => drop.item === 'tower_shard')), 'tower monsters should drop tower shards');
  console.assert(itemName('tower_shard') === '塔のかけら', 'tower shard should be a catalog item');
  console.assert(isAutoSellTarget('tower_shard') === true, 'tower shard should be auto-sellable');
  console.assert(getJobDropItems('adventure').includes('tower_shard'), 'tower shard should count toward adventure discovery');
  // コンテンツ小バッチ（2026-11-09 / 無限の塔と同時公開）：置き去りの日用品モンスター3体と素材6種。
  console.assert(['single_glove', 'faded_towel', 'burnt_wick', 'sunken_key', 'rusty_nail', 'dried_ink'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new batch materials should be catalogued and auto-sellable');
  console.assert(getJobDropItems('adventure').includes('single_glove') && getJobDropItems('adventure').includes('faded_towel') && getJobDropItems('adventure').includes('burnt_wick'), 'new batch adventure materials should count toward discovery');
  console.assert(getJobDropItems('adventure').includes('torn_page') && getJobDropItems('adventure').includes('cracked_lens') && getJobDropItems('adventure').includes('dented_bucket'), 'boss art batch adventure materials should count toward discovery');
  // 階数による強化の純粋計算。
  const towerSlime = (tower?.monsters || []).find((monster) => monster.id === 'slime');
  if (towerSlime) {
    const floor1 = scaleTowerMonster(towerSlime, 1);
    console.assert(floor1.hp === towerSlime.hp && floor1.attack === towerSlime.attack && floor1.name === towerSlime.name, 'tower floor 1 should not scale the monster');
    const floor10 = scaleTowerMonster(towerSlime, 10);
    console.assert(floor10.hp > towerSlime.hp * 3 && floor10.hp < towerSlime.hp * 4 && floor10.attack === towerSlime.attack + 4 && (floor10.rewards.xp || 0) > (towerSlime.rewards.xp || 0), 'tower floor 10 should scale hp about 3.5x, attack +4 and xp up');
    const floor25 = scaleTowerMonster(towerSlime, 25);
    console.assert(floor25.hp > towerSlime.hp * 25 && floor25.attack === towerSlime.attack + 12, 'tower floor 25 should scale hp about 28x and attack +12');
  }
  console.assert(towerMilestoneForFloor(9) === null && towerMilestoneForFloor(10) === 10 && towerMilestoneForFloor(25) === 25 && towerMilestoneForFloor(50) === 50 && towerMilestoneForFloor(100) === 100, 'tower milestones should be 10/25/50/100 only');
  // 旧セーブ: towerFloor/towerBest 未記録・不正値は 1階・0階に倒れること。
  const migratedNoTower = migrateState({ gold: 55, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoTower.towerFloor === 1 && migratedNoTower.towerBest === 0, 'old save without tower state should migrate as floor 1 and best 0');
  const migratedTower = migrateState({ gold: 55, towerFloor: 12, towerBest: 25, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedTower.towerFloor === 12 && migratedTower.towerBest === 25, 'tower floor and best should survive migration');
  // 塔を離れると今の階数は1階に戻るが、最高階は残ること。
  const towerState = { ...initialState, activeJob: 'adventure', activeArea: 'endless_tower', towerFloor: 7, towerBest: 10, visitedAreas: ['forest', 'endless_tower'], jobData: { ...initialState.jobData, mining: { level: 2, xp: 0, seenMusings: [] } } };
  const leftTower = selectArea(towerState, 'forest');
  console.assert(leftTower.towerFloor === 1 && leftTower.towerBest === 10, 'leaving the tower should reset the current floor but keep the best');
  // 転生（2026-11-07 / ロードマップ5）: 引退3回が条件で、獲得は思い出の累計から平方根型。
  console.assert(!canRebirth(initialState) && getRebirthPoints(initialState) === 0, 'fresh state should not be rebirthable');
  const rebirthReady = {
    ...grownState,
    prestige: { memoryPoints: 20, totalEarned: 100, retireCount: 3, upgrades: { memory_xp: 2 }, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: {}, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} },
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
  const migratedWithRebirth = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 7, totalRebirthEarned: 7, rebirthCount: 1, rebirthUpgrades: { rebirth_gold: 1 }, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} } } as Partial<typeof initialState>, initialState);
  console.assert(migratedWithRebirth.prestige?.rebirthPoints === 7 && migratedWithRebirth.prestige?.rebirthUpgrades.rebirth_gold === 1, 'rebirth data should survive migration');
  // 輪廻（2026-11-09 / プレステージ第3層）: 転生3回が条件で、獲得は転生の証の累計から平方根型。
  console.assert(!canSamsara(initialState) && getSamsaraPoints(initialState) === 0, 'fresh state should not be samsarable');
  const samsaraReady = {
    ...grownState,
    prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 20, totalRebirthEarned: 100, rebirthCount: 3, rebirthUpgrades: { rebirth_efficiency: 2 }, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} },
  };
  console.assert(canSamsara(samsaraReady) && getSamsaraPoints(samsaraReady) === 20, 'three rebirths with 100 total rebirth points should grant 20 samsara points');
  const notYetSamsara = { ...samsaraReady, prestige: { ...samsaraReady.prestige, rebirthCount: 2 } };
  console.assert(!canSamsara(notYetSamsara) && samsara(notYetSamsara, initialState) === notYetSamsara, 'two rebirths should not unlock samsara');
  // 輪廻: 第1・第2層まで置いていき、輪廻の証と輪廻回数だけが残ること。
  const samsaraed = samsara(samsaraReady, initialState);
  console.assert(samsaraed !== samsaraReady && samsaraed.jobData.fishing.level === 1 && samsaraed.gold === initialState.gold, 'samsara should reset run progress');
  console.assert(samsaraed.prestige?.samsaraCount === 1 && samsaraed.prestige?.samsaraPoints === 20 && samsaraed.prestige?.totalSamsaraEarned === 20, 'samsara should bank samsara points');
  console.assert(samsaraed.prestige?.memoryPoints === 0 && samsaraed.prestige?.rebirthPoints === 0 && samsaraed.prestige?.totalRebirthEarned === 0 && samsaraed.prestige?.rebirthCount === 0 && Object.keys(samsaraed.prestige?.rebirthUpgrades || {}).length === 0, 'samsara should reset layers 1 and 2');
  console.assert(samsaraed.achievements.includes('first_fish') && samsaraed.achievements.includes('first_samsara'), 'samsara should keep achievements and add first_samsara');
  const samsaraedAgain = samsara({ ...samsaraReady, prestige: { ...samsaraReady.prestige, samsaraCount: 2, samsaraPoints: 5, totalSamsaraEarned: 15 } }, initialState);
  console.assert(samsaraedAgain.prestige?.samsaraCount === 3 && samsaraedAgain.achievements.includes('samsara_3'), 'third samsara should add the samsara_3 achievement');
  // 輪廻の強化: 所持する証の範囲でだけ買えて、倍率に効くこと。
  const boughtSamsara = buySamsaraUpgrade(samsaraed, 'samsara_efficiency');
  console.assert(boughtSamsara.prestige?.samsaraUpgrades.samsara_efficiency === 1, 'samsara upgrade should apply one stage');
  console.assert((boughtSamsara.prestige?.samsaraPoints || 0) === 17, 'samsara upgrade should cost points');
  const brokeSamsara = buySamsaraUpgrade({ ...initialState, prestige: { ...createInitialState(jobs).prestige!, samsaraPoints: 0 } }, 'samsara_efficiency');
  console.assert(brokeSamsara.prestige?.samsaraUpgrades.samsara_efficiency === undefined, 'samsara upgrade should not apply without points');
  const samsaraBoosted = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, samsaraUpgrades: { samsara_efficiency: 2, samsara_gold: 2, samsara_xp: 1, samsara_musing: 1, samsara_rebirth: 1 } } };
  console.assert(getSamsaraSpeedMultiplier(samsaraBoosted) === 1.24, 'samsara efficiency 2 should give x1.24 speed');
  console.assert(getSamsaraGoldMultiplier(samsaraBoosted) === 1.3, 'samsara gold 2 should give x1.30 gold');
  console.assert(getSamsaraXpMultiplier(samsaraBoosted) === 1.15, 'samsara xp 1 should give x1.15 xp');
  console.assert(getSamsaraMusingMultiplier(samsaraBoosted) === 1.3, 'samsara musing 1 should give x1.30 musing rewards');
  console.assert(getRebirthPoints({ ...rebirthReady, prestige: { ...rebirthReady.prestige, totalEarned: 36 } }) === 12, 'thirty-six total memory should grant 12 rebirth points');
  console.assert(getRebirthPoints({ ...rebirthReady, prestige: { ...rebirthReady.prestige, totalEarned: 36, samsaraUpgrades: { samsara_rebirth: 1 } } }) === 15, 'samsara rebirth 1 should raise rebirth points from 12 to 15');
  console.assert(getSamsaraRebirthMultiplier(samsaraBoosted) === 1.3, 'samsara rebirth 1 should give x1.30 rebirth points');
  console.assert(SAMSARA_UPGRADES.length === 5 && SAMSARA_UPGRADES.every((def) => def.maxStage >= 4), 'there should be five samsara upgrades');
  // 輪廻の移行: 輪廻フィールド無しのセーブは空の輪廻状態になり、転生の証は引き継がれること。
  const migratedNoSamsara = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 7, totalRebirthEarned: 7, rebirthCount: 1, rebirthUpgrades: { rebirth_gold: 1 } } } as unknown as Partial<typeof initialState>, initialState);
  console.assert(migratedNoSamsara.prestige?.samsaraPoints === 0 && migratedNoSamsara.prestige?.samsaraCount === 0 && migratedNoSamsara.prestige?.rebirthPoints === 7, 'old save without samsara fields should gain an empty samsara state and keep rebirth data');
  // 輪廻専用コンテンツ（2026-11-09 / プレステージ第3層）：輪廻1回で解禁される仕事とエリア。
  console.assert(jobs.samsara_guide && jobs.samsara_guide.areas.length === 2 && jobs.samsara_guide.upgrades.length === 3, 'samsara guide job should have two areas and three upgrades');
  console.assert(checkRequirement(jobs.samsara_guide.unlock, initialState) === false, 'samsara guide should be locked before any samsara');
  const samsaraedOnce = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, samsaraCount: 1 } };
  console.assert(checkRequirement(jobs.samsara_guide.unlock, samsaraedOnce) === true, 'samsara guide should unlock after one samsara');
  console.assert(describeRequirement(jobs.samsara_guide.unlock, initialState).includes('輪廻1回'), 'samsara unlock hint should name the samsara count');
  const samsaraGarden = jobs.adventure.areas.find((area) => area.id === 'samsara_garden');
  console.assert(samsaraGarden && (samsaraGarden.monsters || []).length === 2 && checkRequirement(samsaraGarden.unlock, initialState) === false && checkRequirement(samsaraGarden.unlock, samsaraedOnce) === true, 'samsara garden should hold two monsters and unlock after one samsara');
  console.assert(!isJobUnlocked('samsara_guide', initialState) && isJobUnlocked('samsara_guide', samsaraedOnce), 'samsara guide should be locked fresh and unlocked after samsara');
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
  // 実績157件（2026-11-07 に120件へ拡張、2026-11-09 に輪廻3種と無限の塔4種、ボスイラストと同時公開の小バッチ3種、拠点整備絵・初期モンスター絵と同時公開の小バッチ3種、2026-11-10 05時台の小バッチ3種、2026-11-10 09時台の小バッチ3種を追加。2026-11-10 09時台の統合で実績の追加なし。2026-11-10 13時台に11時台バッチの移植で小バッチ3種を追加。2026-11-10 15時台にUI重なり修正と同時公開の小バッチ3種を追加。2026-11-10 17時台に節目見直しと同時公開の小バッチ3種を追加）: 定義数・ヒント・カテゴリ・節目・通算カウンタ・ボーナス。2026-11-10 22時台に小バッチ3種を追加。2026-11-11 05時台に小バッチ3種を追加。2026-11-11 10時台に小バッチ3種を追加。2026-11-11 13時台に小バッチ3種を追加。2026-11-12 08時台に小バッチ3種を追加。2026-11-12 20時台に小バッチ3種を追加。2026-11-12 22時台に小バッチ3種を追加。2026-11-13 01時台に小バッチ3種を追加。2026-11-14 10時台に小バッチ3種を追加。
  const achievementIds = Object.keys(ACHIEVEMENTS);
  console.assert(achievementIds.length === 175, `achievements should total 166 (got ${achievementIds.length})`);
  console.assert(new Set(Object.values(ACHIEVEMENTS).map((a) => a.name)).size === 175, 'achievement names should be unique');
  console.assert(Object.values(ACHIEVEMENTS).every((a) => a.name && a.description && a.hint && a.category), 'every achievement should have a name, description, hint and category');
  const twentyFour = achievementIds.filter((id) => !['achievements_25', 'achievements_50', 'achievements_75', 'achievements_100', 'achievements_120', 'achievements_125', 'achievements_135', 'achievements_138', 'achievements_141', 'achievements_142', 'achievements_145', 'achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'achievements_169', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'ten_achievements'].includes(id)).slice(0, 24);
  const milestoneLogs: string[] = [];
  const with25 = addAchievement({ ...initialState, achievements: twentyFour }, twentyFour.length ? achievementIds.find((id) => !twentyFour.includes(id) && !id.startsWith('achievements_') && id !== 'ten_achievements')! : 'first_fish', milestoneLogs);
  console.assert(with25.includes('achievements_25'), 'the 25th achievement should also grant achievements_25');
  const allBut120 = achievementIds.filter((id) => id !== 'achievements_120' && id !== 'synergy_all_7');
  const completed = addAchievement({ ...initialState, achievements: allBut120 }, 'synergy_all_7', []);
  console.assert(completed.length === 175 && completed.includes('achievements_120'), 'collecting the last achievement should grant achievements_120 and reach 175');
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
  console.assert(allMonsters.length === 115, `there should be 106 monsters to defeat (got ${allMonsters.length})`);
  console.assert(allDiscoverable.length === 240, `there should be 222 discoverable items (got ${allDiscoverable.length})`);
  console.assert(allMonsters.includes('left_hat') && allMonsters.includes('forgotten_raincoat') && allMonsters.includes('forgotten_map'), 'new daily-life monsters should be counted');
  console.assert(allMonsters.includes('left_handkerchief') && allMonsters.includes('left_notebook') && allMonsters.includes('forgotten_matches'), 'samsara batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('left_gloves') && allMonsters.includes('forgotten_towel') && allMonsters.includes('forgotten_lantern'), 'endless tower batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_picture_book') && allMonsters.includes('left_binoculars') && allMonsters.includes('forgotten_bucket'), 'boss art batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_hand_mirror') && allMonsters.includes('left_compass') && allMonsters.includes('forgotten_candle'), 'upgrade art batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_watering_can') && allMonsters.includes('left_telescope') && allMonsters.includes('forgotten_sleeping_bag'), '2026-11-10 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_mug') && allMonsters.includes('left_hiking_boots') && allMonsters.includes('forgotten_pocket_watch'), '2026-11-10 09:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_plushie') && allMonsters.includes('left_radio'), '2026-11-10 09:00 merged batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_wristwatch') && allMonsters.includes('forgotten_camera') && allMonsters.includes('forgotten_shovel'), '2026-11-10 13:00 ported 11:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_ribbon') && allMonsters.includes('forgotten_bottle') && allMonsters.includes('forgotten_rope'), '2026-11-10 15:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_comb') && allMonsters.includes('left_work_gloves') && allMonsters.includes('forgotten_spoon'), '2026-11-10 17:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_slippers') && allMonsters.includes('forgotten_wallet'), '2026-11-10 19:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_earring') && allMonsters.includes('left_parasol') && allMonsters.includes('forgotten_music_box'), '2026-11-10 21:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_hairpin') && allMonsters.includes('left_sunglasses') && allMonsters.includes('forgotten_diary'), '2026-11-10 22:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_socks') && allMonsters.includes('left_magnifier') && allMonsters.includes('forgotten_blanket'), '2026-11-11 10:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_apron') && allMonsters.includes('left_trekking_pole') && allMonsters.includes('forgotten_sandal'), '2026-11-11 13:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_bandana') && allMonsters.includes('left_headlamp') && allMonsters.includes('forgotten_harmonica'), '2026-11-12 08:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_yarn_ball') && allMonsters.includes('left_postcard') && allMonsters.includes('forgotten_alarm_clock'), '2026-11-12 20:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_fishing_rod') && allMonsters.includes('left_first_aid_kit') && allMonsters.includes('forgotten_pillow'), '2026-11-12 22:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_toothbrush') && allMonsters.includes('left_whistle') && allMonsters.includes('forgotten_soap'), '2026-11-13 01:00 batch daily-life monsters should be counted');
  console.assert(allMonsters.includes('forgotten_bug_cage') && allMonsters.includes('left_bear_bell') && allMonsters.includes('forgotten_chalk'), '2026-11-14 10:00 batch daily-life monsters should be counted');
  console.assert(allDiscoverable.includes('cracked_watering_can') && allDiscoverable.includes('dented_watering_can') && allDiscoverable.includes('cracked_telescope') && allDiscoverable.includes('cracked_telescope_lens') && allDiscoverable.includes('torn_sleeping_bag') && allDiscoverable.includes('broken_sleeping_bag_zipper'), '2026-11-10 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('broken_mug') && allDiscoverable.includes('dented_mug') && allDiscoverable.includes('broken_hiking_boots') && allDiscoverable.includes('frayed_hiking_boot_lace') && allDiscoverable.includes('broken_pocket_watch') && allDiscoverable.includes('stopped_pocket_watch'), '2026-11-10 09:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('frayed_plushie') && allDiscoverable.includes('plushie_button') && allDiscoverable.includes('broken_radio') && allDiscoverable.includes('broken_radio_dial') && allDiscoverable.includes('pocket_watch_hand'), '2026-11-10 09:00 merged batch material items should be discoverable');
  console.assert(allDiscoverable.includes('cracked_wristwatch') && allDiscoverable.includes('stopped_wristwatch') && allDiscoverable.includes('cracked_camera') && allDiscoverable.includes('cracked_camera_lens') && allDiscoverable.includes('bent_shovel') && allDiscoverable.includes('broken_shovel_handle'), '2026-11-10 13:00 ported 11:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('frayed_ribbon') && allDiscoverable.includes('faded_ribbon') && allDiscoverable.includes('dented_bottle') && allDiscoverable.includes('bottle_cap') && allDiscoverable.includes('tangled_rope') && allDiscoverable.includes('snapped_rope'), '2026-11-10 15:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('chipped_comb') && allDiscoverable.includes('missing_comb_tooth') && allDiscoverable.includes('single_work_glove') && allDiscoverable.includes('frayed_work_glove') && allDiscoverable.includes('bent_spoon') && allDiscoverable.includes('rusty_spoon'), '2026-11-10 17:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('worn_slipper') && allDiscoverable.includes('faded_slipper') && allDiscoverable.includes('empty_wallet') && allDiscoverable.includes('loose_coins'), '2026-11-10 19:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('single_earring') && allDiscoverable.includes('rusty_earring') && allDiscoverable.includes('parasol_rib') && allDiscoverable.includes('broken_parasol') && allDiscoverable.includes('music_box_spring') && allDiscoverable.includes('stopped_music_box'), '2026-11-10 21:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('bent_hairpin') && allDiscoverable.includes('tarnished_hairpin') && allDiscoverable.includes('scratched_sunglasses') && allDiscoverable.includes('cracked_sunglasses') && allDiscoverable.includes('torn_diary') && allDiscoverable.includes('faded_diary'), '2026-11-10 22:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('holey_socks') && allDiscoverable.includes('single_sock') && allDiscoverable.includes('cracked_magnifier') && allDiscoverable.includes('foggy_magnifier') && allDiscoverable.includes('torn_blanket') && allDiscoverable.includes('faded_blanket'), '2026-11-11 10:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('stained_apron') && allDiscoverable.includes('torn_apron') && allDiscoverable.includes('bent_trekking_pole') && allDiscoverable.includes('worn_trekking_pole') && allDiscoverable.includes('worn_sandal') && allDiscoverable.includes('single_sandal'), '2026-11-11 13:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('faded_bandana') && allDiscoverable.includes('torn_bandana') && allDiscoverable.includes('broken_headlamp') && allDiscoverable.includes('dim_headlamp') && allDiscoverable.includes('rusty_harmonica') && allDiscoverable.includes('silent_harmonica'), '2026-11-12 08:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('frayed_yarn_ball') && allDiscoverable.includes('yarn_scrap') && allDiscoverable.includes('faded_postcard') && allDiscoverable.includes('torn_postcard') && allDiscoverable.includes('rusty_alarm_clock') && allDiscoverable.includes('stopped_alarm_clock'), '2026-11-12 20:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('broken_fishing_rod') && allDiscoverable.includes('frayed_fishing_line') && allDiscoverable.includes('empty_first_aid_kit') && allDiscoverable.includes('used_bandage') && allDiscoverable.includes('worn_pillow') && allDiscoverable.includes('torn_pillowcase'), '2026-11-12 22:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('worn_toothbrush') && allDiscoverable.includes('dried_toothpaste') && allDiscoverable.includes('cracked_whistle') && allDiscoverable.includes('tangled_whistle_strap') && allDiscoverable.includes('melted_soap') && allDiscoverable.includes('faded_soap_dish'), '2026-11-13 01:00 batch material items should be discoverable');
  console.assert(allDiscoverable.includes('broken_bug_cage') && allDiscoverable.includes('tangled_bug_net') && allDiscoverable.includes('rusty_bear_bell') && allDiscoverable.includes('frayed_bear_bell_strap') && allDiscoverable.includes('broken_chalk') && allDiscoverable.includes('dusty_chalkboard_eraser'), '2026-11-14 10:00 batch material items should be discoverable');
  console.assert(['broken_mug', 'dented_mug', 'broken_hiking_boots', 'frayed_hiking_boot_lace', 'broken_pocket_watch', 'stopped_pocket_watch'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 09:00 batch materials should be catalogued and auto-sellable');
  console.assert(['frayed_plushie', 'plushie_button', 'broken_radio', 'broken_radio_dial', 'pocket_watch_hand'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 09:00 merged batch materials should be catalogued and auto-sellable');
  // 売却単価（2026-11-10 13時台の移植で判明）：11時台の新素材6種と05時台の小バッチ素材6種は ITEM_SELL_PRICES 未登録で自動売却の対象外だったため、単価を追加して自動売却対象にする。
  console.assert(['cracked_wristwatch', 'stopped_wristwatch', 'cracked_camera', 'cracked_camera_lens', 'bent_shovel', 'broken_shovel_handle'].every((id) => isAutoSellTarget(id)), '2026-11-10 13:00 ported 11:00 batch material items should be auto-sell targets');
  console.assert(['cracked_watering_can', 'dented_watering_can', 'cracked_telescope', 'cracked_telescope_lens', 'torn_sleeping_bag', 'broken_sleeping_bag_zipper'].every((id) => isAutoSellTarget(id)), '2026-11-10 05:00 batch material items should be auto-sell targets');
  console.assert(['frayed_ribbon', 'faded_ribbon', 'dented_bottle', 'bottle_cap', 'tangled_rope', 'snapped_rope'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 15:00 batch materials should be catalogued and auto-sellable');
  console.assert(['chipped_comb', 'missing_comb_tooth', 'single_work_glove', 'frayed_work_glove', 'bent_spoon', 'rusty_spoon'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 17:00 batch materials should be catalogued and auto-sellable');
  console.assert(['worn_slipper', 'faded_slipper', 'empty_wallet', 'loose_coins'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 19:00 batch materials should be catalogued and auto-sellable');
  console.assert(['single_earring', 'rusty_earring', 'parasol_rib', 'broken_parasol', 'music_box_spring', 'stopped_music_box'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 21:00 batch materials should be catalogued and auto-sellable');
  console.assert(['bent_hairpin', 'tarnished_hairpin', 'scratched_sunglasses', 'cracked_sunglasses', 'torn_diary', 'faded_diary'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 22:00 batch materials should be catalogued and auto-sellable');
  console.assert(['holey_socks', 'single_sock', 'cracked_magnifier', 'foggy_magnifier', 'torn_blanket', 'faded_blanket'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 10:00 batch materials should be catalogued and auto-sellable');
  console.assert(['stained_apron', 'torn_apron', 'bent_trekking_pole', 'worn_trekking_pole', 'worn_sandal', 'single_sandal'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 13:00 batch materials should be catalogued and auto-sellable');
  console.assert(['faded_bandana', 'torn_bandana', 'broken_headlamp', 'dim_headlamp', 'rusty_harmonica', 'silent_harmonica'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 08:00 batch materials should be catalogued and auto-sellable');
  console.assert(['frayed_yarn_ball', 'yarn_scrap', 'faded_postcard', 'torn_postcard', 'rusty_alarm_clock', 'stopped_alarm_clock'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 20:00 batch materials should be catalogued and auto-sellable');
  console.assert(['broken_fishing_rod', 'frayed_fishing_line', 'empty_first_aid_kit', 'used_bandage', 'worn_pillow', 'torn_pillowcase'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 22:00 batch materials should be catalogued and auto-sellable');
  console.assert(['worn_toothbrush', 'dried_toothpaste', 'cracked_whistle', 'tangled_whistle_strap', 'melted_soap', 'faded_soap_dish'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 01:00 batch materials should be catalogued and auto-sellable');
  console.assert(['broken_bug_cage', 'tangled_bug_net', 'rusty_bear_bell', 'frayed_bear_bell_strap', 'broken_chalk', 'dusty_chalkboard_eraser'].every((id) => itemName(id) !== id && isAutoSellTarget(id)), 'new 10:00 batch materials should be catalogued and auto-sellable');
  // 新実績3件（2026-11-10 15時台）：全80種討伐・170の発見・実績145個の節目が付与される。
  const nearFullDefeated15 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 79), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 169) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated15, []).includes('monsters_80'), '79 defeated monsters should not grant monsters_80');
  console.assert(!checkMilestoneAchievements(nearFullDefeated15, []).includes('discovered_170'), '169 discovered items should not grant discovered_170');
  const fullDefeated15 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated15, []).includes('monsters_80'), '80 defeated monsters should grant monsters_80');
  console.assert(checkMilestoneAchievements(fullDefeated15, []).includes('discovered_170'), '170 discovered items should grant discovered_170');
  // 下位の節目をすべて含む144件を明示的に作る（除外は新節目4件＋節目でない6件。2026-11-11 05時台に総数が154件になったため除外を増やした。2026-11-11 10時台に総数が157件になったため新節目3件を追加して除外13件に。2026-11-11 13時台に総数が160件になったため新節目3件を追加して除外16件に。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外19件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外22件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外25件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外28件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外31件に）。
  const almostAllAchievements15 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_145', 'achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_94', 'discovered_198', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish', 'cycles_100', 'gold_10k', 'gold_100k'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements15, []).includes('achievements_145'), '144 achievements should grant achievements_145 (fires at 144 other achievements)');
  // 下位の節目をすべて含む143件を明示的に作る（除外は新節目4件＋節目でない7件。2026-11-11 05時台に総数が154件になったため除外を増やした。2026-11-11 10時台に総数が157件になったため新節目3件を追加して除外14件に。2026-11-11 13時台に総数が160件になったため新節目3件を追加して除外17件に。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外20件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外23件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外26件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外29件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外32件に）。
  const oneShortAchievements15 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_145', 'achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_94', 'discovered_198', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish', 'cycles_100', 'gold_10k', 'gold_100k', 'chests_10'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements15, []).includes('achievements_145'), '143 achievements should not grant achievements_145');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 144 }, (_, i) => `test-${i}`) }, 'achievements_145')?.target === 145, 'achievements_145 progress should target 145');
  console.assert(getAchievementBonusLines({ ...initialState, achievements: Array.from({ length: 144 }, (_, i) => `test-${i}`) }).some((line) => line.includes('次の節目：実績148個（あと3個）')), 'bonus lines should point to the 148 milestone at 144 achievements');
  // 新実績3件（2026-11-10 17・19・21時台の統合）：全88種討伐・186の発見・実績148個の節目が付与される。
  const nearFullDefeated17 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 87), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 185) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated17, []).includes('monsters_88'), '87 defeated monsters should not grant monsters_88');
  console.assert(!checkMilestoneAchievements(nearFullDefeated17, []).includes('discovered_186'), '185 discovered items should not grant discovered_186');
  const fullDefeated17 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated17, []).includes('monsters_88'), '88 defeated monsters should grant monsters_88');
  console.assert(checkMilestoneAchievements(fullDefeated17, []).includes('discovered_186'), '186 discovered items should grant discovered_186');
  // 節目実績の自己参照の見直し（2026-11-10 17時台）：条件は「自分自身を除いた他の実績の獲得数」で判定する。
  // 2026-11-11 10時台：総数が157件になったため、旧来の slice(0, 147) では末尾の節目（achievements_135・138・141・142・145）が落ち、追いつき処理に依存する構成になる。
  // 下位の節目をすべて含む147件を明示的に作る（除外は13件：新節目7件＋新実績2件＋節目でない4件。2026-11-11 13時台に総数が160件になったため新節目3件を追加。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外16件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外19件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外22件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外25件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外28件に）。
  const almostAllAchievements17 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish', 'cycles_100', 'gold_10k', 'gold_100k'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements17, []).includes('achievements_148'), '147 achievements should grant achievements_148 (fires at 147 other achievements)');
  // 2026-11-10 22時台：総数が151件になったため、旧来の slice(0, 146) では末尾の achievements_145 が落ち、
  // 追いつき処理で achievements_145 が付与されて 147件になり achievements_148 まで付いてしまう。
  // 下位の節目をすべて含む146件を明示的に作る（除外は14件：新節目7件＋新実績2件＋節目でない5件。2026-11-11 05時台に総数が154件になったため除外を増やした。2026-11-11 10時台に総数が157件になったため新節目3件を追加。2026-11-11 13時台に総数が160件になったため新節目3件を追加。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外17件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外20件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外23件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外26件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外29件に）。
  const oneShortAchievements17 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_94', 'discovered_198', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'synergy_all_7', 'first_fish', 'cycles_100'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements17, []).includes('achievements_148'), '146 achievements should not grant achievements_148');
  // 最後の非節目実績の獲得と同じ呼び出しで節目も付く（到達可能性の直接確認）。
  const nonMilestoneIds17 = achievementIds.filter((id) => !id.startsWith('achievements_') && id !== 'ten_achievements');
  const lastNonMilestone17 = nonMilestoneIds17[nonMilestoneIds17.length - 1];
  const othersBeforeLast17 = achievementIds.filter((id) => id !== 'achievements_148' && id !== lastNonMilestone17);
  console.assert(addAchievement({ ...initialState, achievements: othersBeforeLast17 }, lastNonMilestone17, []).includes('achievements_148'), 'earning the last non-milestone achievement should also grant achievements_148');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 147 }, (_, i) => `test-${i}`) }, 'achievements_148')?.target === 148, 'achievements_148 progress should target 148');
  console.assert(ACHIEVEMENTS.achievements_145.hint === '実績を144個集める', 'achievements_145 hint should match its trigger (144 other achievements)');
  console.assert(getAchievementBonusLines({ ...initialState, achievements: Array.from({ length: 143 }, (_, i) => `test-${i}`) }).some((line) => line.includes('次の節目：実績145個（あと1個）')), 'bonus lines should point to the 145 milestone with 1 to go at 143 achievements');
  console.assert(getAchievementBonusLines({ ...initialState, achievements: Array.from({ length: 121 }, (_, i) => `test-${i}`) }).some((line) => line.includes('次の節目：実績122個（あと1個）')), 'bonus lines should point to the 122 milestone with 1 to go at 121 achievements');
  // 新実績3件（2026-11-10 22時台）：全91種討伐・192の発見・実績151個の節目が付与される。
  const nearFullDefeated22 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 90), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 191) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated22, []).includes('monsters_91'), '90 defeated monsters should not grant monsters_91');
  console.assert(!checkMilestoneAchievements(nearFullDefeated22, []).includes('discovered_192'), '191 discovered items should not grant discovered_192');
  const fullDefeated22 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated22, []).includes('monsters_91'), '91 defeated monsters should grant monsters_91');
  console.assert(checkMilestoneAchievements(fullDefeated22, []).includes('discovered_192'), '192 discovered items should grant discovered_192');
  // 2026-11-11 10時台：総数が157件になったため、旧来の slice(0, 150) では末尾の節目（achievements_142・145・148）が落ち、追いつき処理に依存する構成になる。
  // 下位の節目をすべて含む150件を明示的に作る（除外は10件：新節目6件＋新実績2件＋節目でない2件。2026-11-11 13時台に総数が160件になったため新節目3件を追加。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外13件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外16件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外19件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外22件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外25件に）。
  const almostAllAchievements22 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'synergy_all_7', 'first_fish'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements22, []).includes('achievements_151'), '150 achievements should grant achievements_151 (fires at 150 other achievements)');
  // 2026-11-11 05時台：総数が154件になったため、旧来の slice(0, 149) では末尾の achievements_145 と
  // achievements_148 が落ち、追いつき処理で 145→148→151 と連鎖して付与されてしまう。
  // 下位の節目をすべて含む149件を明示的に作る（除外は11件：新節目6件＋新実績4件＋節目でない1件。2026-11-11 10時台に総数が157件になったため新節目3件を追加。2026-11-11 13時台に総数が160件になったため新節目3件を追加。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外14件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外17件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外20件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外23件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外26件に）。
  const oneShortAchievements22 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_94', 'discovered_198', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'synergy_all_7'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements22, []).includes('achievements_151'), '149 achievements should not grant achievements_151');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 150 }, (_, i) => `test-${i}`) }, 'achievements_151')?.target === 151, 'achievements_151 progress should target 151');
  // 新実績3件（2026-11-11 05時台）：全94種討伐・198の発見・実績154個の節目が付与される。
  const nearFullDefeated05 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 93), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 197) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated05, []).includes('monsters_94'), '93 defeated monsters should not grant monsters_94');
  console.assert(!checkMilestoneAchievements(nearFullDefeated05, []).includes('discovered_198'), '197 discovered items should not grant discovered_198');
  const fullDefeated05 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated05, []).includes('monsters_94'), '94 defeated monsters should grant monsters_94');
  console.assert(checkMilestoneAchievements(fullDefeated05, []).includes('discovered_198'), '198 discovered items should grant discovered_198');
  // 2026-11-11 10時台：総数が157件になったため、旧来の slice(0, 153) では末尾の achievements_151・achievements_157・synergy_all_7 が落ち、追いつき処理に依存する構成になる。
  // 下位の節目をすべて含む153件を明示的に作る（除外は7件：節目2件＋新実績4件＋節目でない1件。2026-11-11 13時台に総数が160件になったため新節目・新実績3件を追加。最新節目 achievements_160 は153件では発火しないため含めたまま。2026-11-12 08時台に総数が163件になったため新節目・新実績3件を追加して除外10件に。最新節目 achievements_163 は153件では発火しないため含めたままでもよいが、件数を合わせるため除外した。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外13件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外16件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外19件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外22件に）。
  const almostAllAchievements05 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_154', 'achievements_157', 'achievements_163', 'achievements_166', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'synergy_all_7'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements05, []).includes('achievements_154'), '153 achievements should grant achievements_154 (fires at 153 other achievements)');
  // 下位の節目をすべて含む152件を明示的に作る（除外は8件：節目2件＋新実績4件＋節目でない2件。2026-11-11 13時台に総数が160件になったため新節目・新実績3件を追加。最新節目 achievements_160 は152件では発火しないため含めたまま。2026-11-12 08時台に総数が163件になったため新節目・新実績3件を追加して除外11件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外14件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外17件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外20件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外23件に）。
  const oneShortAchievements05 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_154', 'achievements_157', 'achievements_163', 'achievements_166', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'synergy_all_7', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements05, []).includes('achievements_154'), '152 achievements should not grant achievements_154');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 153 }, (_, i) => `test-${i}`) }, 'achievements_154')?.target === 154, 'achievements_154 progress should target 154');
  // 新実績3件（2026-11-11 10時台）：全97種討伐・204の発見・実績157個の節目が付与される。
  const nearFullDefeated01 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 96), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 203) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated01, []).includes('monsters_97'), '96 defeated monsters should not grant monsters_97');
  console.assert(!checkMilestoneAchievements(nearFullDefeated01, []).includes('discovered_204'), '203 discovered items should not grant discovered_204');
  const fullDefeated01 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated01, []).includes('monsters_97'), '97 defeated monsters should grant monsters_97');
  console.assert(checkMilestoneAchievements(fullDefeated01, []).includes('discovered_204'), '204 discovered items should grant discovered_204');
  // 下位の節目をすべて含む156件を明示的に作る（除外は4件：新節目2件＋新実績2件。2026-11-11 13時台に総数が160件になったため achievements_160・monsters_100・discovered_210 を追加。2026-11-12 08時台に総数が163件になったため achievements_163・monsters_103・discovered_216 を追加して除外7件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外10件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外13件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外16件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外19件に）。
  const almostAllAchievements01 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements01, []).includes('achievements_157'), '156 achievements should grant achievements_157 (fires at 156 other achievements)');
  const oneShortAchievements01 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements01, []).includes('achievements_157'), '155 achievements should not grant achievements_157');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 156 }, (_, i) => `test-${i}`) }, 'achievements_157')?.target === 157, 'achievements_157 progress should target 157');
  // 新実績3件（2026-11-11 13時台）：全100種討伐・210の発見・実績160個の節目が付与される。
  const nearFullDefeated13 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 99), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 209) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated13, []).includes('monsters_100'), '99 defeated monsters should not grant monsters_100');
  console.assert(!checkMilestoneAchievements(nearFullDefeated13, []).includes('discovered_210'), '209 discovered items should not grant discovered_210');
  const fullDefeated13 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated13, []).includes('monsters_100'), '100 defeated monsters should grant monsters_100');
  console.assert(checkMilestoneAchievements(fullDefeated13, []).includes('discovered_210'), '210 discovered items should grant discovered_210');
  // 下位の節目をすべて含む159件を明示的に作る（除外は1件：achievements_160 のみ。総数が160件のため。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外4件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外7件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外10件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外13件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外16件に）。
  const almostAllAchievements13 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_160', 'achievements_163', 'achievements_166', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175'].includes(id)) };
  console.assert(checkMilestoneAchievements(almostAllAchievements13, []).includes('achievements_160'), '159 achievements should grant achievements_160 (fires at 159 other achievements)');
  const oneShortAchievements13 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_160', 'achievements_163', 'achievements_166', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements13, []).includes('achievements_160'), '158 achievements should not grant achievements_160');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 159 }, (_, i) => `test-${i}`) }, 'achievements_160')?.target === 160, 'achievements_160 progress should target 160');
  // 新実績3件（2026-11-12 08時台）：全103種討伐・216の発見・実績163個の節目が付与される。
  const nearFullDefeated08 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 102), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 215) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated08, []).includes('monsters_103'), '102 defeated monsters should not grant monsters_103');
  console.assert(!checkMilestoneAchievements(nearFullDefeated08, []).includes('discovered_216'), '215 discovered items should not grant discovered_216');
  const fullDefeated08 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated08, []).includes('monsters_103'), '103 defeated monsters should grant monsters_103');
  console.assert(checkMilestoneAchievements(fullDefeated08, []).includes('discovered_216'), '216 discovered items should grant discovered_216');
  // 下位の節目をすべて含む162件を明示的に作る（除外は1件：achievements_163 のみ。総数が163件のため）。
  const almostAllAchievements08 = { ...initialState, achievements: achievementIds.filter((id) => id !== 'achievements_163') };
  console.assert(checkMilestoneAchievements(almostAllAchievements08, []).includes('achievements_163'), '162 achievements should grant achievements_163 (fires at 162 other achievements)');
  const oneShortAchievements08 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_163', 'achievements_166', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements08, []).includes('achievements_163'), '161 achievements should not grant achievements_163');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 162 }, (_, i) => `test-${i}`) }, 'achievements_163')?.target === 163, 'achievements_163 progress should target 163');
  // 新実績3件（2026-11-12 20時台）：全106種討伐・222の発見・実績166個の節目が付与される。
  const nearFullDefeated20 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 105), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 221) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated20, []).includes('monsters_106'), '105 defeated monsters should not grant monsters_106');
  console.assert(!checkMilestoneAchievements(nearFullDefeated20, []).includes('discovered_222'), '221 discovered items should not grant discovered_222');
  const fullDefeated20 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated20, []).includes('monsters_106'), '106 defeated monsters should grant monsters_106');
  console.assert(checkMilestoneAchievements(fullDefeated20, []).includes('discovered_222'), '222 discovered items should grant discovered_222');
  // 下位の節目をすべて含む168件を明示的に作る（除外は1件：achievements_166 のみ。総数が169件のため。メッセージの165件は総数166件時点のもの）。
  const almostAllAchievements20 = { ...initialState, achievements: achievementIds.filter((id) => id !== 'achievements_166') };
  console.assert(checkMilestoneAchievements(almostAllAchievements20, []).includes('achievements_166'), '165 achievements should grant achievements_166 (fires at 165 other achievements)');
  const oneShortAchievements20 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_166', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements20, []).includes('achievements_166'), '164 achievements should not grant achievements_166');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 165 }, (_, i) => `test-${i}`) }, 'achievements_166')?.target === 166, 'achievements_166 progress should target 166');
  // 新実績3件（2026-11-12 22時台）：全109種討伐・228の発見・実績169個の節目が付与される。
  const nearFullDefeated21 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 108), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 227) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated21, []).includes('monsters_109'), '108 defeated monsters should not grant monsters_109');
  console.assert(!checkMilestoneAchievements(nearFullDefeated21, []).includes('discovered_228'), '227 discovered items should not grant discovered_228');
  const fullDefeated21 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated21, []).includes('monsters_109'), '109 defeated monsters should grant monsters_109');
  console.assert(checkMilestoneAchievements(fullDefeated21, []).includes('discovered_228'), '228 discovered items should grant discovered_228');
  // 下位の節目をすべて含む168件を明示的に作る（除外は1件：achievements_169 のみ。総数が169件のため）。
  const almostAllAchievements21 = { ...initialState, achievements: achievementIds.filter((id) => id !== 'achievements_169') };
  console.assert(checkMilestoneAchievements(almostAllAchievements21, []).includes('achievements_169'), '168 achievements should grant achievements_169 (fires at 168 other achievements)');
  const oneShortAchievements21 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements21, []).includes('achievements_169'), '167 achievements should not grant achievements_169');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 168 }, (_, i) => `test-${i}`) }, 'achievements_169')?.target === 169, 'achievements_169 progress should target 169');
  // 新実績3件（2026-11-13 01時台）：全112種討伐・234の発見・実績172個の節目が付与される。
  const nearFullDefeated0113 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 111), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 233) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated0113, []).includes('monsters_112'), '111 defeated monsters should not grant monsters_112');
  console.assert(!checkMilestoneAchievements(nearFullDefeated0113, []).includes('discovered_234'), '233 discovered items should not grant discovered_234');
  const fullDefeated0113 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated0113, []).includes('monsters_112'), '112 defeated monsters should grant monsters_112');
  console.assert(checkMilestoneAchievements(fullDefeated0113, []).includes('discovered_234'), '234 discovered items should grant discovered_234');
  // 下位の節目をすべて含む171件を明示的に作る（除外は1件：achievements_172 のみ。総数が172件のため）。
  const almostAllAchievements0113 = { ...initialState, achievements: achievementIds.filter((id) => id !== 'achievements_172') };
  console.assert(checkMilestoneAchievements(almostAllAchievements0113, []).includes('achievements_172'), '171 achievements should grant achievements_172 (fires at 171 other achievements)');
  const oneShortAchievements0113 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements0113, []).includes('achievements_172'), '170 achievements should not grant achievements_172');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 171 }, (_, i) => `test-${i}`) }, 'achievements_172')?.target === 172, 'achievements_172 progress should target 172');
  // 新実績3件（2026-11-14 10時台）：全115種討伐・240の発見・実績175個の節目が付与される。
  const nearFullDefeated1114 = { ...initialState, defeatedMonsters: allMonsters.slice(0, 114), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 239) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated1114, []).includes('monsters_115'), '114 defeated monsters should not grant monsters_115');
  console.assert(!checkMilestoneAchievements(nearFullDefeated1114, []).includes('discovered_240'), '239 discovered items should not grant discovered_240');
  const fullDefeated1114 = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated1114, []).includes('monsters_115'), '115 defeated monsters should grant monsters_115');
  console.assert(checkMilestoneAchievements(fullDefeated1114, []).includes('discovered_240'), '240 discovered items should grant discovered_240');
  // 下位の節目をすべて含む174件を明示的に作る（除外は1件：achievements_175 のみ。総数が175件のため）。
  const almostAllAchievements1114 = { ...initialState, achievements: achievementIds.filter((id) => id !== 'achievements_175') };
  console.assert(checkMilestoneAchievements(almostAllAchievements1114, []).includes('achievements_175'), '174 achievements should grant achievements_175 (fires at 174 other achievements)');
  const oneShortAchievements1114 = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_175', 'first_fish'].includes(id)) };
  console.assert(!checkMilestoneAchievements(oneShortAchievements1114, []).includes('achievements_175'), '173 achievements should not grant achievements_175');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 174 }, (_, i) => `test-${i}`) }, 'achievements_175')?.target === 175, 'achievements_175 progress should target 175');
  // 新実績3件（2026-11-10 13時台）：全77種討伐・164の発見・実績142個の節目が付与される。
  const nearFullDefeated = { ...initialState, defeatedMonsters: allMonsters.slice(0, 76), lifetime: { ...emptyLifetime(), discovered: allDiscoverable.slice(0, 163) } };
  console.assert(!checkMilestoneAchievements(nearFullDefeated, []).includes('monsters_77'), '76 defeated monsters should not grant monsters_77');
  console.assert(!checkMilestoneAchievements(nearFullDefeated, []).includes('discovered_164'), '163 discovered items should not grant discovered_164');
  const fullDefeated = { ...initialState, defeatedMonsters: allMonsters, lifetime: { ...emptyLifetime(), discovered: allDiscoverable } };
  console.assert(checkMilestoneAchievements(fullDefeated, []).includes('monsters_77'), '77 defeated monsters should grant monsters_77');
  console.assert(checkMilestoneAchievements(fullDefeated, []).includes('discovered_164'), '164 discovered items should grant discovered_164');
  // 2026-11-10 17時台：総数が148件になったため、旧テストの除外4件では144件になって
  // 追いつき処理で achievements_142 が付与されてしまう。
  // 下位の節目をすべて含む141件を明示的に作る（除外は19件：節目7件＋討伐・発見8件＋節目でない4件。2026-11-11 05時台に総数が154件になったため除外を増やした。2026-11-11 10時台に総数が157件になったため新節目3件を追加。2026-11-11 13時台に総数が160件になったため新節目3件を追加。2026-11-12 08時台に総数が163件になったため新節目3件を追加して除外22件に。2026-11-12 20時台に総数が166件になったため新節目3件を追加して除外25件に。2026-11-12 22時台に総数が169件になったため新節目3件を追加して除外28件に。2026-11-13 01時台に総数が172件になったため新節目3件を追加して除外31件に。2026-11-14 10時台に総数が175件になったため新節目3件を追加して除外34件に）。
  const almostAllAchievements = { ...initialState, achievements: achievementIds.filter((id) => !['achievements_142', 'achievements_145', 'achievements_148', 'achievements_151', 'achievements_154', 'achievements_157', 'achievements_160', 'achievements_163', 'achievements_166', 'monsters_91', 'discovered_192', 'monsters_94', 'discovered_198', 'monsters_97', 'discovered_204', 'monsters_100', 'discovered_210', 'monsters_103', 'discovered_216', 'monsters_106', 'discovered_222', 'monsters_109', 'discovered_228', 'achievements_169', 'monsters_112', 'discovered_234', 'achievements_172', 'monsters_115', 'discovered_240', 'achievements_175', 'first_fish', 'cycles_100', 'gold_10k', 'gold_100k'].includes(id)) };
  console.assert(!checkMilestoneAchievements(almostAllAchievements, []).includes('achievements_142'), '141 achievements should not grant achievements_142');
  console.assert(getAchievementProgress({ ...initialState, achievements: Array.from({ length: 142 }, (_, i) => `test-${i}`) }, 'achievements_142')?.target === 143, 'achievements_142 progress should target 143');
  console.assert(getAchievementBonusLines({ ...initialState, achievements: Array.from({ length: 141 }, (_, i) => `test-${i}`) }).some((line) => line.includes('次の節目：実績142個')), 'bonus lines should point to the 142 milestone at 141 achievements');
  // 一般モンスター専用絵（2026-11-11 13時台）：登録順の次の7体（森に忘れられた靴下／山道に置き去りの軍手／山道に置き去りの日傘／山道に置き去りのサングラス／山道に置き去りの凧／山道に置き去りの虫眼鏡／暗闇キノコ）にイラストを追加し、専用絵は58体になった（2026-11-12 08時台に61体へ拡張。上記の assert が最新）。
  // 一般モンスター専用絵（2026-11-12 08時台）：登録順の次の7体のうち3体（水晶ガニ／つららのカタツムリ／忘れられたマフラー）にイラストを追加し、専用絵は61体になった。残る4体（森に忘れられたエプロン／山道に置き去りのストック／忘れられたヘルメット／忘れられた懐中電灯）は画像生成の失敗（参照パス指定ミスでツールが再試行不可を返したためこの回は見送り）で次回へ持ち越し（2026-11-12 12時台に65体へ拡張。下記の assert が最新）。
  // 一般モンスター専用絵（2026-11-11 10時台）：登録順の次の7体（森に忘れられたヘアピン／森に忘れられた風鈴／山道に置き去りの方位磁針／山道に置き去りの望遠鏡／山道に置き去りの登山靴／山道に置き去りのラジオ／山道に置き去りのカメラ）にイラストを追加し、専用絵は51体になった（2026-11-11 13時台に58体へ拡張。上記の assert が最新）。
  // 一般モンスター専用絵（2026-11-11 05時台）：登録順の次の7体（傾いた道しるべ／山頂のカラス／置き去りの弁当箱／忘れられた雨具／置き去りの手帳／忘れられたタオル／置き去りの双眼鏡）にイラストを追加し、専用絵は44体になった（2026-11-11 10時台に51体へ拡張。上記の assert が最新）。
  // 一般モンスター専用絵（2026-11-12 12時台）：08時台の持ち越し4体（森に忘れられたエプロン／山道に置き去りのストック／忘れられたヘルメット／忘れられた懐中電灯）にイラストを追加し、専用絵は65体になった。
  // 一般モンスター専用絵（2026-11-12 20時台）：登録順の次の7体（森に忘れられたバンダナ／山道に置き去りのヘッドランプ／忘れられた地図／忘れられたマッチ箱／忘れられたランタン／忘れられたバケツ／洞窟に忘れられたろうそく）にイラストを追加し、専用絵は72体になった。
  // 一般モンスター専用絵（2026-11-12 22時台）：登録順の次の7体（森に忘れられた毛糸玉／山道に置き去りの絵はがき／洞窟に忘れられた寝袋／洞窟に忘れられた懐中時計／洞窟に忘れられたスコップ／洞窟に忘れられたスプーン／洞窟に忘れられた財布）にイラストを追加し、専用絵は79体になった。
  // 一般モンスター専用絵（2026-11-13 01時台）：登録順の次の7体（森に忘れられた釣り竿／山道に置き去りの救急箱／洞窟に忘れられたオルゴール／洞窟に忘れられた日記／洞窟に忘れられた湯たんぽ／洞窟に忘れられた毛布／洞窟に忘れられたサンダル）にイラストを追加し、専用絵は86体になった。
  // 一般モンスター専用絵（2026-11-14 10時台）：登録順の次の7体（森に忘れられた歯ブラシ／山道に置き去りのホイッスル／洞窟に忘れられたハーモニカ／洞窟に忘れられた目覚まし時計／洞窟に忘れられた枕／洞窟に忘れられた石けん／錆びた鎧）にイラストを追加し、専用絵は93体になった。
  console.assert(Object.keys(MONSTER_ART).length === 93 && ['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom', 'lost_umbrella', 'lost_picnic_basket', 'moss_turtle', 'lost_boot', 'rolling_rock', 'cliff_goat', 'shadow_rat', 'left_hat', 'left_handkerchief', 'left_gloves', 'forgotten_picture_book', 'forgotten_ribbon', 'forgotten_bottle', 'forgotten_rope', 'forgotten_hand_mirror', 'forgotten_watering_can', 'forgotten_mug', 'forgotten_wristwatch', 'forgotten_plushie', 'forgotten_comb', 'forgotten_slippers', 'forgotten_earring', 'pebble_golem', 'left_backpack', 'left_water_bottle', 'tilted_signpost', 'summit_crow', 'left_lunchbox', 'forgotten_raincoat', 'left_notebook', 'forgotten_towel', 'left_binoculars', 'forgotten_hairpin', 'forgotten_wind_chime', 'left_compass', 'left_telescope', 'left_hiking_boots', 'left_radio', 'forgotten_camera', 'forgotten_socks', 'left_work_gloves', 'left_parasol', 'left_sunglasses', 'left_kite', 'left_magnifier', 'dark_mushroom', 'crystal_crab', 'icicle_snail', 'forgotten_scarf', 'forgotten_apron', 'left_trekking_pole', 'forgotten_helmet', 'forgotten_flashlight', 'forgotten_bandana', 'left_headlamp', 'forgotten_map', 'forgotten_matches', 'forgotten_lantern', 'forgotten_bucket', 'forgotten_candle', 'forgotten_yarn_ball', 'left_postcard', 'forgotten_sleeping_bag', 'forgotten_pocket_watch', 'forgotten_shovel', 'forgotten_spoon', 'forgotten_wallet', 'forgotten_fishing_rod', 'left_first_aid_kit', 'forgotten_music_box', 'forgotten_diary', 'forgotten_yutanpo', 'forgotten_blanket', 'forgotten_sandal', 'forgotten_toothbrush', 'left_whistle', 'forgotten_harmonica', 'forgotten_alarm_clock', 'forgotten_pillow', 'forgotten_soap', 'rust_armor'].every((id) => MONSTER_ART[id]?.startsWith('data:image/webp;base64,')), 'all four bosses, four early monsters and eighty-five general monsters should have dedicated art');
  // 一般モンスター専用絵（2026-11-10 13時台）：11時台バッチから3体（転がる岩玉／崖ヤギ／かげネズミ）を移植し、専用絵は19体になった（2026-11-10 17時台に27体へ拡張。上記の assert が最新）。
  console.assert(['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom', 'lost_umbrella', 'lost_picnic_basket', 'moss_turtle', 'lost_boot', 'rolling_rock', 'cliff_goat', 'shadow_rat'].every((id) => MONSTER_ART[id]?.startsWith('data:image/webp;base64,')), 'all four bosses, four early monsters and eleven general monsters should have dedicated art');
  // 一般モンスター専用絵（2026-11-10 09時台）：迷子の傘／置き忘れのピクニックかご／苔ガメ／迷子の長靴にイラストを追加し、専用絵は16体になった（2026-11-10 13時台に19体へ拡張。上記の assert が最新）。
  console.assert(['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom', 'lost_umbrella', 'lost_picnic_basket', 'moss_turtle', 'lost_boot'].every((id) => MONSTER_ART[id]?.startsWith('data:image/webp;base64,')), 'all four bosses, four early monsters and eight general monsters should have dedicated art');
  // 拠点整備パネル絵（2026-11-10 13時台）：残り5仕事（闇クエスト／動画投稿者／古本せどり／転生案内／輪廻案内）に専用絵を追加し、全18仕事になった。
  console.assert(Object.keys(UPGRADE_ART).length === 18 && ['fishing', 'rest', 'woodcutting', 'merchant', 'farming', 'mining', 'adventure', 'office', 'remote', 'delivery', 'housekeeping', 'photography', 'nightwatch', 'shady', 'streaming', 'booktrade', 'rebirth_guide', 'samsara_guide'].every((id) => UPGRADE_ART[id]?.startsWith('data:image/webp;base64,')), 'all eighteen jobs should have dedicated upgrade art');
  // 拠点整備パネル絵（2026-11-10 09時台）：次の4仕事（在宅作業／配達アプリ／家事代行／写真販売）に専用絵を追加し、専用絵は12仕事になった（同09時台の統合で08時台の夜間警備を追加し13仕事へ拡張。2026-11-10 13時台に18仕事へ拡張。上記の assert が最新）。
  console.assert(['fishing', 'rest', 'woodcutting', 'merchant', 'farming', 'mining', 'adventure', 'office', 'remote', 'delivery', 'housekeeping', 'photography', 'nightwatch'].every((id) => UPGRADE_ART[id]?.startsWith('data:image/webp;base64,')), 'the first thirteen jobs should have dedicated upgrade art');
  // 一般モンスター専用絵（2026-11-10 05時台）：おすましキノコ／ため息ゴケ／ささやきツタ／寝坊キノコにイラストを追加し、専用絵は12体になった（2026-11-10 09時台に16体へ拡張。上記の assert が最新）。
  console.assert(['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom'].every((id) => MONSTER_ART[id]?.startsWith('data:image/webp;base64,')), 'all four bosses, four early monsters and four general monsters should have dedicated art');
  // 拠点整備パネル絵（2026-11-10 05時台）：次の4仕事（農業／採掘／冒険／王国勤務）に専用絵を追加し、専用絵は8仕事になった（2026-11-10 09時台に12仕事へ拡張。上記の assert が最新）。
  console.assert(['fishing', 'rest', 'woodcutting', 'merchant', 'farming', 'mining', 'adventure', 'office'].every((id) => UPGRADE_ART[id]?.startsWith('data:image/webp;base64,')), 'the first eight jobs should have dedicated upgrade art');
  // 初期モンスター専用絵（2026-11-09 15時台）：スライム／ゴブリン／オオカミ／洞窟コウモリにイラストを追加し、専用絵は8体になった（2026-11-10 05時台に12体へ拡張。上記の assert が最新）。
  console.assert(['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat'].every((id) => MONSTER_ART[id]?.startsWith('data:image/webp;base64,')), 'all four bosses and four early monsters should have dedicated art');
  // 拠点整備パネル絵（2026-11-09 15時台）：最初の4仕事（釣り／休憩／木こり／商人）に専用絵がある（2026-11-10 05時台に8仕事へ拡張。上記の assert が最新）。
  console.assert(['fishing', 'rest', 'woodcutting', 'merchant'].every((id) => UPGRADE_ART[id]?.startsWith('data:image/webp;base64,')), 'the first four jobs should have dedicated upgrade art');
  console.assert(allMonsters.includes('past_self_shadow') && allMonsters.includes('samsara_blossom'), 'samsara garden monsters should be counted');
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
  // エリア専用イラスト（2026-11-08〜11-09）：冒険エリア9種すべてに専用絵がある。フォールバック（仕事絵＋色調変化）は残っていない。
  console.assert(Object.keys(AREA_ART).length === 9 && ['forest', 'mountain', 'cave', 'throne_room', 'old_castle_gate', 'inner_courtyard', 'rebirth_corridor', 'samsara_garden', 'endless_tower'].every((id) => AREA_ART[id]?.startsWith('data:image/webp;base64,')), 'nine adventure areas should have dedicated art');
  console.assert(jobs.adventure.areas.filter((area) => AREA_ART[area.id]).length === 9, 'dedicated area art should cover all nine adventure areas');
  console.assert(jobs.adventure.areas.every((area) => AREA_ART[area.id] || SCENE_ART.adventure), 'every adventure area should resolve to area art or the adventure job art');
  console.assert(Object.keys(jobs).every((key) => SCENE_ART[key]?.startsWith('data:image/')), 'every job should resolve to scene art');
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
  // オフライン深化（ロードマップ11）と 2026-11-07 の見直し：
  // 基本は実時間の 50% から始まり、寝ている間の勘は6段階まで
  // （+5%/段階・最大+30%）、のんびり屋気質で +10%、上限は最大 90%。
  // 転生の余裕は4段階まで（上限 5日ぶん）。
  const offlineMaxed = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, upgrades: { memory_offline: 6 }, rebirthUpgrades: { rebirth_offline: 4 } } };
  console.assert(getPrestigeStage(offlineMaxed, 'memory_offline') === 6 && getPrestigeOfflineBonus(offlineMaxed) === 0.3, 'memory offline 6 should add +30% offline efficiency');
  console.assert(getOfflineEfficiency(initialState) === 0.5, 'offline efficiency should start at 50% of real time');
  console.assert(getOfflineEfficiency(offlineMaxed) === 0.8, 'offline efficiency with max memory offline should be 80%');
  console.assert(getOfflineEfficiency({ ...offlineMaxed, trait: 'easygoing' as const }) === 0.9, 'offline efficiency should cap at 90% with memory offline and easygoing');
  console.assert(getRebirthStage(offlineMaxed, 'rebirth_offline') === 4 && getRebirthOfflineCapHours(offlineMaxed) === 120 && getOfflineMaxTicks(offlineMaxed) === 120 * 60 * 60, 'rebirth offline 4 should extend the offline cap to 120 hours');
  const offlineOverflow = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, upgrades: { memory_offline: 9 }, rebirthUpgrades: { rebirth_offline: 9 } } };
  console.assert(getPrestigeStage(offlineOverflow, 'memory_offline') === 6 && getRebirthStage(offlineOverflow, 'rebirth_offline') === 4, 'offline stages should clamp to their new maxima');
  console.assert(buyPrestigeUpgrade(offlineMaxed, 'memory_offline') === offlineMaxed, 'buying memory offline past max should be a no-op');
  const offlineLegacy = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {}, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: { memory_offline: 4 }, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: { rebirth_offline: 3 }, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} } } as Partial<typeof initialState>, initialState);
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
  // 2回目以降の来訪は 10%/分（期待 10 分ほど）。初回は 6% のまま。
  const catSecond = { ...catGrown, cat: { ...createCatState(), visits: 1, lastRollAt: 0 } };
  console.assert(maybeCatVisit(catSecond, 200_000, 0.09).cat?.visit !== null, 'second cat visit should happen on a roll under 10%');
  console.assert(maybeCatVisit(catSecond, 200_000, 0.11).cat?.visit === null, 'second cat visit should not happen on a roll over 10%');
  // ミケを呼ぶ：能動操作で来訪を起こし、クールダウン（10分）と来訪・バフ中は呼べない。
  const catCalled = callCat(initialState, 100_000);
  console.assert(catCalled.cat?.visit !== null && catCalled.cat?.visits === 1 && (catCalled.cat?.lastCallAt || 0) === 100_000, 'calling the cat should start a visit');
  console.assert(getCatCallRemainingMs(catCalled, 100_000 + 60_000) === 9 * 60_000, 'cat call cooldown should count down from 10 minutes');
  const catCallBlocked = callCat({ ...catCalled, cat: { ...catCalled.cat!, visit: null } }, 100_000 + 9 * 60_000);
  console.assert(catCallBlocked.cat?.visit === null, 'calling the cat during the cooldown should do nothing');
  const catRecall = callCat({ ...catCalled, cat: { ...catCalled.cat!, visit: null } }, 100_000 + 10 * 60_000);
  console.assert(catRecall.cat?.visit !== null && catRecall.cat?.visits === 2, 'calling the cat after the cooldown should start another visit');
  const catCallWhileBuff = callCat({ ...catClaimed, cat: { ...catClaimed.cat!, visit: null } }, 100_000 + 10 * 60_000);
  console.assert(catCallWhileBuff.cat?.visit === null, 'calling the cat while a buff is active should do nothing');
  // 初回チュートリアル：釣り選択 → 売却 → 拠点整備の3段階。手動送りと破棄もできる。
  const tutorialPicked = selectJob({ ...initialState, tutorialStep: 'select_fishing' }, 'fishing');
  console.assert(tutorialPicked.tutorialStep === 'sell_materials', 'picking fishing should advance the tutorial to selling');
  let sellState: typeof initialState = { ...initialState, tutorialStep: 'sell_materials', activeJob: 'merchant', activeArea: 'fish_stall', resources: { fish: 50, wood: 0, ore: 0 }, jobData: { ...initialState.jobData, woodcutting: { level: 2, xp: 0, seenMusings: [] } } };
  for (let i = 0; i < 60 && sellState.tutorialStep === 'sell_materials'; i += 1) sellState = runTick(sellState);
  console.assert(sellState.tutorialStep === 'improve_base', 'first sale should advance the tutorial to base improvement');
  const tutorialUpgraded = buyUpgrade({ ...initialState, tutorialStep: 'improve_base', gold: 100, resources: { fish: 10, wood: 0, ore: 0 } }, jobs.fishing.upgrades[0]);
  console.assert(tutorialUpgraded.tutorialStep === 'done' && tutorialUpgraded.items?.fishing_better_rod === 1, 'buying the first upgrade should complete the tutorial');
  console.assert(advanceTutorial({ ...initialState, tutorialStep: 'select_fishing' }).tutorialStep === 'sell_materials', 'advanceTutorial should move to the next step');
  console.assert(advanceTutorial({ ...initialState, tutorialStep: 'improve_base' }).tutorialStep === 'done', 'advanceTutorial on the last step should finish the tutorial');
  console.assert(advanceTutorial(initialState).tutorialStep === 'intro', 'advanceTutorial should ignore the intro state');
  console.assert(dismissTutorial({ ...initialState, tutorialStep: 'sell_materials' }).tutorialStep === 'done', 'dismissTutorial should finish the tutorial');
  const planSell = getLifePlan({ ...initialState, currentMusing: { ...initialState.currentMusing, readAt: 1 }, tutorialStep: 'sell_materials' });
  console.assert(planSell.key === 'sell-materials', 'life plan should guide selling during the tutorial');
  const planBase = getLifePlan({ ...initialState, currentMusing: { ...initialState.currentMusing, readAt: 1 }, tutorialStep: 'improve_base' });
  console.assert(planBase.key === 'improve-base', 'life plan should guide base improvement during the tutorial');
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
  // 登場人物の出会い（2026-11-08 / 仲間3名）：条件・初登場ぼやき・ボーナス・図鑑。
  const merchantGrown = { ...initialState, jobData: { ...initialState.jobData, merchant: { level: 3, xp: 0, seenMusings: [] } } };
  const metShopkeeper = maybeMeetPeople(merchantGrown, 100_000);
  console.assert(hasMetPerson(metShopkeeper, 'shopkeeper') && metShopkeeper.musingQueue.some((m) => m.id === 'meet-shopkeeper'), 'merchant level 3 should meet the shopkeeper with a first-meeting musing');
  console.assert(Math.abs(getSellPriceMultiplier(metShopkeeper) - 1.05) < 1e-9, 'shopkeeper should raise the sell price by 5%');
  console.assert(getSellPriceMultiplier(initialState) === 1, 'sell price should stay at 1x before meeting the shopkeeper');
  const upgradedBase = { ...initialState, items: { fishing_better_rod: 1, fishing_lure: 1, fishing_boat: 1 } };
  console.assert(getOwnedUpgradeCount(upgradedBase) === 3, 'three owned upgrades should count as three base improvements');
  const metLandlord = maybeMeetPeople(upgradedBase, 100_000);
  console.assert(hasMetPerson(metLandlord, 'landlord') && metLandlord.musingQueue.some((m) => m.id === 'meet-landlord'), 'three base improvements should meet the landlord');
  console.assert(getUpgradeGoldCost(metLandlord, 100) === 95, 'landlord should cut upgrade gold cost by 5%');
  const retiredOnce = { ...initialState, prestige: { ...createInitialState(jobs).prestige!, retireCount: 1 } };
  const metNeighbor = maybeMeetPeople(retiredOnce, 100_000);
  console.assert(hasMetPerson(metNeighbor, 'neighbor') && metNeighbor.musingQueue.some((m) => m.id === 'meet-neighbor'), 'one retirement should meet the former-hero neighbor');
  const peopleForestArea = jobs.adventure.areas[0];
  const failBefore = getFailChance(peopleForestArea, jobs.adventure.upgrades, {}, initialState);
  const failAfter = getFailChance(peopleForestArea, jobs.adventure.upgrades, {}, metNeighbor);
  console.assert(Math.abs(failBefore - failAfter - 0.02) < 1e-9, 'neighbor should cut adventure fail chance by 2%');
  // 敵2名＋家族（2026-11-08）：条件・初登場ぼやき・ボーナス・週次仕送り。
  const officeGrown = { ...initialState, jobData: { ...initialState.jobData, office: { level: 3, xp: 0, seenMusings: [] } } };
  const metDemon = maybeMeetPeople(officeGrown, 100_000);
  console.assert(hasMetPerson(metDemon, 'deadline_demon') && metDemon.musingQueue.some((m) => m.id === 'meet-deadline_demon'), 'office level 3 should meet the deadline demon with a first-meeting musing');
  const remoteArea = jobs.remote.areas[0];
  const jobFailBefore = getFailChance(remoteArea, jobs.remote.upgrades, {}, initialState);
  const jobFailAfter = getFailChance(remoteArea, jobs.remote.upgrades, {}, metDemon);
  console.assert(Math.abs(jobFailBefore - jobFailAfter - 0.03) < 1e-9, 'deadline demon should cut job fail chance by 3%');
  const deliveryGrown = { ...initialState, jobData: { ...initialState.jobData, delivery: { level: 3, xp: 0, seenMusings: [] } } };
  const metGolem = maybeMeetPeople(deliveryGrown, 100_000);
  console.assert(hasMetPerson(metGolem, 'commuter_golem') && metGolem.musingQueue.some((m) => m.id === 'meet-commuter_golem'), 'delivery level 3 should meet the commuter golem with a first-meeting musing');
  console.assert(getAdventureEntryCost(initialState, 100) === 100, 'entry cost should stay at base before meeting the golem');
  console.assert(getAdventureEntryCost(metGolem, 100) === 95, 'commuter golem should cut adventure entry cost by 5%');
  const stamped = { ...initialState, items: { life_stamp: 7 } };
  const meetMonday = new Date(2026, 10, 9).getTime();
  const metFamily = maybeMeetPeople(stamped, meetMonday);
  console.assert(hasMetPerson(metFamily, 'family') && metFamily.musingQueue.some((m) => m.id === 'meet-family'), 'seven life stamps should meet the family with a first-meeting musing');
  console.assert(metFamily.familyLetterWeek === getWeekKey(new Date(2026, 10, 9)), 'meeting the family should stamp the current week so the first letter is the meeting itself');
  console.assert(getPersonBonusLines(metFamily).some((line) => line.includes('仕送り')), 'family bonus line should mention the weekly remittance');
  // 週次仕送り：出会った週は届かず、翌週に一度だけ届き、同じ週の2回目は届かない。
  const nextMonday = new Date(2026, 10, 16).getTime();
  const lettered = maybeFamilyLetter(metFamily, nextMonday);
  console.assert(lettered.gold === metFamily.gold + getFamilyRemittanceGold(metFamily) && lettered.familyLetterWeek === getWeekKey(new Date(2026, 10, 16)) && lettered.musingQueue.some((m) => m.id === `family-letter-${getWeekKey(new Date(2026, 10, 16))}`), 'a new week should deliver the family remittance and letter once');
  console.assert(maybeFamilyLetter(lettered, new Date(2026, 10, 17).getTime()).gold === lettered.gold, 'the same week should not pay the remittance twice');
  console.assert(maybeFamilyLetter(initialState, Date.now()).gold === initialState.gold, 'family letter should not pay before meeting the family');
  // 旧セーブ：実家と出会っていない旧セーブは仕送り週も未記録のまま移行する。
  const migratedNoFamily = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(migratedNoFamily.familyLetterWeek === undefined && !hasMetPerson(migratedNoFamily, 'family'), 'old save without family should migrate with no letter week');
  const metAllThree = maybeMeetPeople({ ...metShopkeeper, jobData: { ...metShopkeeper.jobData }, items: { fishing_better_rod: 1, fishing_lure: 1, fishing_boat: 1 }, prestige: { ...createInitialState(jobs).prestige!, retireCount: 1 } }, 200_000);
  const peopleMetAll = getPeople(metAllThree);
  console.assert(peopleMetAll.slice(2, 5).every((person) => person.met === true), 'all three new faces should appear in the people book once met');
  console.assert(getPersonBonusLines(metAllThree).length === 3, 'three met people should list three bonus lines');
  console.assert(maybeMeetPeople(metAllThree, 300_000).musingQueue.filter((m) => m.id === 'meet-shopkeeper').length === 1, 'meeting the same person twice should not repeat the first-meeting musing');
  console.assert(normalizeMetPeople(['shopkeeper', 'nope', 42, 'landlord']).length === 2, 'invalid met-people entries should be dropped');
  const migratedNoPeople = migrateState({ saveVersion: 5, gold: 50, jobData: {}, items: {} } as Partial<typeof initialState>, initialState);
  console.assert(Array.isArray(migratedNoPeople.metPeople) && migratedNoPeople.metPeople.length === 0, 'old save without met people should migrate with nobody met');
}

