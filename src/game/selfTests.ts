import { itemDesc, itemName } from '../data/catalog';
import { jobs, upgrades } from '../data/gameData';
import { getJobDropItems } from './collection';
import { describeUpgradeEffects, formatResourceName, rewardText } from './formatters';
import { getFarmingProgress } from './farming';
import { enqueueMusing } from './musings';
import { addItems, rollDrops } from './progression';
import { checkRequirement, getActiveArea, isJobUnlocked } from './requirements';
import { createInitialState } from './state';

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
  console.assert(getActiveArea('fishing', 'missing').id === 'pond', 'missing area should fallback to first area');
  console.assert(rollDrops([]).length === 0, 'empty drops should roll empty');
  console.assert(rewardText([{ item: 'small_fish', amount: 1 }]).includes('小魚'), 'rewardText should show item names');
  console.assert(isJobUnlocked('unknown', initialState) === false, 'unknown job should stay locked');
  console.assert(getJobDropItems('unknown').length === 0, 'unknown job should have no drops');
  console.assert(itemName('missing') === 'missing', 'missing item should fallback to id');
  console.assert(itemDesc('missing') === '', 'missing item description should be empty');
  console.assert(describeUpgradeEffects(upgrades[0]).includes('最大MP+5'), 'upgrade effects should describe max MP bonus');
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
}

