import { itemDesc, itemName } from '../data/catalog';
import { jobs, upgrades } from '../data/gameData';
import { simulateMonsterBattle } from './combat';
import { getJobDropItems } from './collection';
import { getAdventureEntryCost } from './equipment';
import { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
import { getFarmingProgress } from './farming';
import { enqueueMusing } from './musings';
import { addItems, getLifePlan, getNextTarget, rollDrops } from './progression';
import { checkRequirement, describeRequirement, getActiveArea, isJobUnlocked } from './requirements';
import { xpToNext } from './progression';
import { parseSaveBackup, SAVE_BACKUP_GAME_ID } from './saveTransfer';
import { buyPrestigeUpgrade, canRetire, getPrestigeScore, getRetirementPoints, retire } from './prestige';
import { autoSellGainedItems, isAutoSellTarget } from './automation';
import { getEquipmentPower } from './equipment';
import { createInitialState, migrateState, SAVE_VERSION } from './state';

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
  const broke = buyPrestigeUpgrade({ ...initialState, prestige: { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {} } }, 'memory_start_gold');
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
}

