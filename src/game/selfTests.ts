import { itemDesc, itemName } from '../data/catalog';
import { jobs, upgrades } from '../data/gameData';
import { simulateMonsterBattle } from './combat';
import { getJobDropItems } from './collection';
import { getAdventureEntryCost } from './equipment';
import { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
import { getFarmingProgress } from './farming';
import { enqueueMusing } from './musings';
import { addItems, getLifePlan, getNextTarget, rollDrops } from './progression';
import { checkRequirement, getActiveArea, isJobUnlocked } from './requirements';
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
  const slime = jobs.adventure.areas[0].monsters?.[0];
  if (slime) {
    const battle = simulateMonsterBattle({ ...initialState, hp: 80, mp: 60, items: { ...initialState.items, hinoki_stick: 1 } }, jobs.adventure, slime, 3);
    console.assert(battle.won && battle.hpCost >= 0 && battle.mpCost > 0, 'battle simulation should resolve a basic win with costs');
  }
  console.assert(getAdventureEntryCost(initialState, 8) === 8, 'adventure entry cost should default to base cost');
}

