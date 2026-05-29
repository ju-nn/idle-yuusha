import type { EquipmentItem, EquipmentOption, EquipmentOptionTarget, EquipmentRarity, EquipmentSlot, GameState, JobType, ResourceKey, TreasureChest, TreasureChestType } from '../types';
import { enqueueMusing } from './musings';

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '防具',
  charm: 'お守り',
};

export const EQUIPMENT_RARITY_LABELS: Record<EquipmentRarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
};

const RARITY_WEIGHT: Array<{ rarity: EquipmentRarity; weight: number }> = [
  { rarity: 'common', weight: 70 },
  { rarity: 'uncommon', weight: 22 },
  { rarity: 'rare', weight: 6 },
  { rarity: 'epic', weight: 1.7 },
  { rarity: 'legendary', weight: 0.3 },
];

const CHEST_RARITY_BONUS: Record<TreasureChestType, Partial<Record<EquipmentRarity, number>>> = {
  worn: {},
  life: { uncommon: 4, rare: 1.5 },
  adventure: { common: -8, uncommon: 4, rare: 3, epic: 0.8 },
  castle: { common: -15, uncommon: 4, rare: 7, epic: 3, legendary: 0.8 },
  legendary: { common: -70, uncommon: -22, rare: 40, epic: 35, legendary: 17 },
};

export const CHEST_LABELS: Record<TreasureChestType, { name: string; description: string }> = {
  worn: { name: '古びた宝箱', description: '開ける前だけ、少し人生が明るい。' },
  life: { name: '生活の宝箱', description: '生活の隙間から出てきた、小さなご褒美。' },
  adventure: { name: '冒険者の宝箱', description: '危険の領収書に、おまけが付いてきた。' },
  castle: { name: '城跡の宝箱', description: '歴史と埃と、少し高そうな気配が入っている。' },
  legendary: { name: 'まばゆい宝箱', description: '箱の時点で主張が強い。中身もたぶん強い。' },
};

const RARITY_OPTION_COUNT: Record<EquipmentRarity, [number, number]> = {
  common: [1, 1],
  uncommon: [1, 2],
  rare: [2, 2],
  epic: [2, 3],
  legendary: [3, 3],
};

const RARITY_VALUE_MULTIPLIER: Record<EquipmentRarity, number> = {
  common: 0.78,
  uncommon: 0.95,
  rare: 1.12,
  epic: 1.3,
  legendary: 1.55,
};

type EquipmentBase = {
  baseId: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  minRarity?: EquipmentRarity;
  onlyRarity?: EquipmentRarity;
  jobs?: string[];
  jobTypes?: JobType[];
};

const BASES: EquipmentBase[] = [
  { baseId: 'better_stick', name: 'ちょっとマシな木の棒', slot: 'weapon', description: '棒よりは強い。棒という事実は残る。' },
  { baseId: 'clockout_dagger', name: '定時退社の短剣', slot: 'weapon', minRarity: 'rare', description: '早く終わらせる意思だけは鋭い。' },
  { baseId: 'paid_leave_sword', name: '有給の聖剣', slot: 'weapon', onlyRarity: 'legendary', description: '抜いた瞬間、今日は休んでもいい気がする。' },
  { baseId: 'cheap_gloves', name: '安売りの作業手袋', slot: 'armor', description: '手首への謝罪としては安い。', jobs: ['woodcutting', 'mining'] },
  { baseId: 'back_friendly_belt', name: '腰にやさしいベルト', slot: 'armor', minRarity: 'rare', description: '勇者より先に腰を守る判断。' },
  { baseId: 'holiday_shield', name: '休日を守る盾', slot: 'armor', minRarity: 'epic', description: '予定を入れようとする世界を少し弾く。' },
  { baseId: 'unearned_cloak', name: '不労のマント', slot: 'armor', onlyRarity: 'legendary', description: '羽織ると労働意欲が静かに消える。' },
  { baseId: 'merchant_abacus', name: '商人のそろばん', slot: 'charm', description: '数字が増えると、現実も少し許せる。', jobs: ['merchant'] },
  { baseId: 'quiet_lure', name: '静かなルアー', slot: 'charm', description: '魚より先に、勇者の心が少し落ち着く。', jobs: ['fishing'] },
  { baseId: 'notification_ward', name: '通知除けのお守り', slot: 'charm', minRarity: 'rare', description: '鳴らないだけで、少し勝っている。', jobs: ['remote', 'delivery', 'streaming'] },
  { baseId: 'freedom_compass', name: '自由のコンパス', slot: 'charm', onlyRarity: 'legendary', description: '北ではなく、帰り道をよく指す。' },
  { baseId: 'no_work_ring', name: 'もう働きたくない指輪', slot: 'charm', onlyRarity: 'legendary', description: '願いが強すぎて、効果欄が少し震えている。' },
];

type OptionTemplate = {
  target: EquipmentOptionTarget;
  scopes?: string[];
  min: number;
  max: number;
  slots: EquipmentSlot[];
  jobs?: string[];
  jobTypes?: JobType[];
};

const OPTION_TEMPLATES: OptionTemplate[] = [
  { target: 'jobSpeed', scopes: ['fishing', 'woodcutting', 'mining', 'merchant', 'office', 'remote', 'delivery', 'streaming', 'adventure'], min: 3, max: 18, slots: ['weapon', 'charm'] },
  { target: 'resourceGain', scopes: ['fish', 'wood', 'ore'], min: 4, max: 20, slots: ['charm'] },
  { target: 'sellPrice', min: 3, max: 15, slots: ['charm'], jobs: ['merchant'] },
  { target: 'attack', min: 4, max: 22, slots: ['weapon'], jobTypes: ['combat', 'adventure'] },
  { target: 'defense', min: 4, max: 20, slots: ['armor'], jobTypes: ['combat', 'adventure'] },
  { target: 'hpRegen', min: 4, max: 18, slots: ['armor', 'charm'] },
  { target: 'mpRegen', min: 4, max: 18, slots: ['armor', 'charm'] },
  { target: 'adventureCost', min: 3, max: 12, slots: ['weapon', 'charm'], jobTypes: ['adventure'] },
  { target: 'dropRate', min: 2, max: 10, slots: ['charm', 'weapon'] },
];

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickWeightedRarity(chestType: TreasureChestType = 'worn') {
  const weights = RARITY_WEIGHT.map((entry) => ({
    ...entry,
    weight: Math.max(0.05, entry.weight + (CHEST_RARITY_BONUS[chestType][entry.rarity] || 0)),
  }));
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return 'common';
}

function rarityRank(rarity: EquipmentRarity) {
  return ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rarity);
}

function pickBase(rarity: EquipmentRarity, jobId: string, jobType: JobType) {
  const candidates = BASES.filter((base) => {
    if (base.onlyRarity && base.onlyRarity !== rarity) return false;
    if (base.minRarity && rarityRank(rarity) < rarityRank(base.minRarity)) return false;
    if (base.jobs && !base.jobs.includes(jobId)) return false;
    if (base.jobTypes && !base.jobTypes.includes(jobType)) return false;
    return true;
  });
  const fallback = BASES.filter((base) => !base.onlyRarity && (!base.minRarity || rarityRank(rarity) >= rarityRank(base.minRarity)));
  const pool = candidates.length ? candidates : fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeOptions(rarity: EquipmentRarity, slot: EquipmentSlot, jobId: string, jobType: JobType) {
  const [minCount, maxCount] = RARITY_OPTION_COUNT[rarity];
  const count = randInt(minCount, maxCount);
  const pool = OPTION_TEMPLATES.filter((template) => {
    if (!template.slots.includes(slot)) return false;
    if (template.jobs && !template.jobs.includes(jobId)) return false;
    if (template.jobTypes && !template.jobTypes.includes(jobType)) return false;
    return true;
  });
  const options: EquipmentOption[] = [];
  const used = new Set<string>();
  while (options.length < count && used.size < pool.length) {
    const template = pool[Math.floor(Math.random() * pool.length)];
    const scope = template.scopes?.[Math.floor(Math.random() * template.scopes.length)];
    const key = `${template.target}:${scope || 'all'}`;
    if (used.has(key)) continue;
    used.add(key);
    const baseValue = randInt(template.min, template.max);
    options.push({
      id: key,
      target: template.target,
      scope,
      value: Math.max(1, Math.round(baseValue * RARITY_VALUE_MULTIPLIER[rarity])),
    });
  }
  return options;
}

export function maybeDropChest(state: GameState, jobId: string, jobType: JobType, areaId: string): TreasureChest | null {
  const baseChance = jobType === 'adventure' ? 0.11 : jobType === 'combat' ? 0.075 : jobId === 'merchant' ? 0.035 : 0.018;
  const chance = baseChance * (1 + getEquipmentBonus(state, 'dropRate') / 100);
  if ((state.treasureChests?.length || 0) >= getChestLimit(state)) return null;
  if (Math.random() >= chance) return null;
  let type: TreasureChestType = jobType === 'adventure' ? 'adventure' : jobId === 'merchant' ? 'life' : 'worn';
  if (areaId.includes('castle') || areaId.includes('courtyard')) type = 'castle';
  if (Math.random() < 0.01) type = 'legendary';
  const label = CHEST_LABELS[type];
  return {
    uid: `${type}-chest-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    type,
    name: label.name,
    description: label.description,
    obtainedAt: Date.now(),
    sourceJob: jobId,
    sourceArea: areaId,
  };
}

export function generateEquipmentFromChest(chest: TreasureChest): EquipmentItem {
  const jobId = chest.sourceJob || 'adventure';
  const jobType: JobType = jobId === 'adventure' ? 'adventure' : jobId === 'combat' ? 'combat' : 'idle';
  const rarity = pickWeightedRarity(chest.type);
  const base = pickBase(rarity, jobId, jobType);
  const uid = `${base.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    uid,
    baseId: base.baseId,
    name: base.name,
    description: base.description,
    slot: base.slot,
    rarity,
    options: makeOptions(rarity, base.slot, jobId, jobType),
    obtainedAt: Date.now(),
  };
}

export function getEquipmentLimit(state: GameState) {
  return 30 + ((state.items?.upgrade_small_shelf || 0) ? 10 : 0);
}

export function getChestLimit(state: GameState) {
  return 40 + ((state.items?.upgrade_small_shelf || 0) ? 15 : 0);
}

export function getEquippedItems(state: GameState) {
  const byUid = new Map((state.equipmentInventory || []).map((item) => [item.uid, item]));
  return Object.values(state.equipped || {}).flatMap((uid) => {
    const item = uid ? byUid.get(uid) : undefined;
    return item ? [item] : [];
  });
}

export function getEquipmentBonus(state: GameState, target: EquipmentOptionTarget, scope?: string) {
  return getEquippedItems(state).reduce((sum, item) => sum + item.options.reduce((optionSum, option) => {
    if (option.target !== target) return optionSum;
    if (scope && option.scope && option.scope !== scope) return optionSum;
    return optionSum + option.value;
  }, 0), 0);
}

export function getResourceGainMultiplier(state: GameState, resource: ResourceKey) {
  return 1 + getEquipmentBonus(state, 'resourceGain', resource) / 100 + getEquipmentBonus(state, 'resourceGain') / 100;
}

export function getSellPriceMultiplier(state: GameState) {
  return 1 + getEquipmentBonus(state, 'sellPrice') / 100;
}

export function getAdventureEntryCost(state: GameState, baseCost = 0) {
  if (baseCost <= 0) return 0;
  const multiplier = Math.max(0.5, 1 - getEquipmentBonus(state, 'adventureCost') / 100);
  return Math.max(1, Math.floor(baseCost * multiplier));
}

export function equipmentOptionText(option: EquipmentOption) {
  const scopeLabels: Record<string, string> = {
    fishing: '釣り',
    woodcutting: '木こり',
    mining: '採掘',
    merchant: '商人',
    office: '王国勤務',
    remote: '在宅作業',
    delivery: '配達',
    streaming: '動画',
    adventure: '冒険',
    fish: '魚',
    wood: '木材',
    ore: '鉱石',
  };
  const scope = option.scope ? `${scopeLabels[option.scope] || option.scope} ` : '';
  const labels: Record<EquipmentOptionTarget, string> = {
    jobSpeed: `${scope}速度`,
    resourceGain: `${scope}獲得`,
    sellPrice: '売却額',
    attack: '攻撃力',
    defense: '防御力',
    hpRegen: 'HP回復速度',
    mpRegen: 'MP回復速度',
    adventureCost: '冒険費用',
    dropRate: 'レアドロップ率',
  };
  const sign = option.target === 'adventureCost' ? '-' : '+';
  return `${labels[option.target]} ${sign}${option.value}%`;
}

export function getEquipmentSellValue(item: EquipmentItem) {
  const base = { common: 12, uncommon: 28, rare: 70, epic: 160, legendary: 420 }[item.rarity];
  return base + item.options.reduce((sum, option) => sum + Math.ceil(option.value * 1.7), 0);
}

export function equipItem(prev: GameState, uid: string): GameState {
  const item = prev.equipmentInventory.find((candidate) => candidate.uid === uid);
  if (!item) return prev;
  const next = {
    ...prev,
    equipped: { ...(prev.equipped || {}), [item.slot]: uid },
    eventLog: [`装備変更：${item.name}を装備した。暮らしが少しだけ数値で楽になる。`, ...prev.eventLog].slice(0, 24),
  };
  return enqueueMusing(next, {
    id: 'first-equip-equipment',
    job: '勇者',
    area: '装備',
    text: `勇者は初めて装備を身につけた。\n\n勇者「強くなるというより、生活の待ち時間が少し短くなるのが一番助かる」`,
    category: 'firstTime',
    eventType: 'firstTime',
    eventSubType: 'first_equipment_equip',
    once: true,
  }).state;
}

export function sellEquipment(prev: GameState, uid: string): GameState {
  const item = prev.equipmentInventory.find((candidate) => candidate.uid === uid);
  if (!item || item.locked) return prev;
  const value = getEquipmentSellValue(item);
  const equipped = { ...(prev.equipped || {}) };
  if (equipped[item.slot] === uid) delete equipped[item.slot];
  const next = {
    ...prev,
    gold: prev.gold + value,
    equipped,
    equipmentInventory: prev.equipmentInventory.filter((candidate) => candidate.uid !== uid),
    feedbackEvents: [...(prev.feedbackEvents || []), { id: `sale-equipment-${Date.now()}`, type: 'sale', label: item.name }].slice(-24),
    eventLog: [`装備売却：${item.name}を+${value}Gにした。思い出より収納場所が勝った。`, ...prev.eventLog].slice(0, 24),
  };
  return enqueueMusing(next, {
    id: 'first-sell-equipment',
    job: '商人',
    area: '装備売却',
    text: `勇者は初めて装備を売った。\n\n勇者「強そうな名前でも、使わないなら収納を圧迫するだけだ。現実的すぎて嫌だな」`,
    category: 'firstTime',
    eventType: 'firstTime',
    eventSubType: 'first_equipment_sale',
    once: true,
  }).state;
}

export function toggleEquipmentLock(prev: GameState, uid: string): GameState {
  const item = prev.equipmentInventory.find((candidate) => candidate.uid === uid);
  if (!item) return prev;
  return {
    ...prev,
    equipmentInventory: prev.equipmentInventory.map((candidate) => (
      candidate.uid === uid ? { ...candidate, locked: !candidate.locked } : candidate
    )),
    eventLog: [`装備保護：${item.name}を${item.locked ? '売却できる状態に戻した' : 'うっかり売らないよう保護した'}。整理にも安全確認はいる。`, ...prev.eventLog].slice(0, 24),
  };
}

export function openTreasureChest(prev: GameState, uid: string): GameState {
  const chest = prev.treasureChests.find((candidate) => candidate.uid === uid);
  if (!chest || (prev.equipmentInventory?.length || 0) >= getEquipmentLimit(prev)) return prev;
  const equipment = generateEquipmentFromChest(chest);
  const equipmentText = `${EQUIPMENT_RARITY_LABELS[equipment.rarity]} ${equipment.name}`;
  const next: GameState = {
    ...prev,
    treasureChests: prev.treasureChests.filter((candidate) => candidate.uid !== uid),
    equipmentInventory: [equipment, ...(prev.equipmentInventory || [])].slice(0, getEquipmentLimit(prev)),
    seenEquipmentBaseIds: Array.from(new Set([equipment.baseId, ...(prev.seenEquipmentBaseIds || [])])),
    equipmentDropLog: [
      `${equipmentText}：${equipment.options.map(equipmentOptionText).join(' / ')}`,
      ...(prev.equipmentDropLog || []),
    ].slice(0, 40),
    openedChestLog: [
      `${chest.name} -> ${equipmentText}`,
      ...(prev.openedChestLog || []),
    ].slice(0, 40),
    feedbackEvents: [
      ...(prev.feedbackEvents || []),
      { id: `open-chest-${Date.now()}`, type: equipment.rarity === 'legendary' ? 'legendaryDrop' : 'equipmentDrop', label: equipment.name },
    ].slice(-24),
    achievements: equipment.rarity === 'legendary'
      ? Array.from(new Set([...(prev.achievements || []), 'first_chest_open', 'first_equipment', 'first_legendary_equipment']))
      : Array.from(new Set([...(prev.achievements || []), 'first_chest_open', 'first_equipment'])),
    eventLog: [
      `宝箱開封：${chest.name}から${equipmentText}。${equipment.description}`,
      ...prev.eventLog,
    ].slice(0, 24),
  };
  return enqueueMusing(next, {
    id: equipment.rarity === 'legendary' ? `legendary-equipment-${equipment.baseId}` : 'first-open-chest',
    job: '勇者',
    area: '宝箱',
    text: equipment.rarity === 'legendary'
      ? `勇者は${equipment.name}を引き当てた。\n\n勇者「レジェンダリー。名前だけで生活が少し改善した気がする。効果欄より先に気分が光ってる」`
      : `勇者は宝箱を開けた。\n\n勇者「労働以外から報酬が出る箱、思想がいい。もっと社会に普及してほしい」`,
    category: equipment.rarity === 'legendary' ? 'event' : 'firstTime',
    eventType: equipment.rarity === 'legendary' ? 'event' : 'firstTime',
    eventSubType: equipment.rarity === 'legendary' ? 'legendary_equipment_from_chest' : 'first_chest_open',
    eventTarget: equipment.baseId,
    once: equipment.rarity === 'legendary',
  }).state;
}

export function openAllTreasureChests(prev: GameState): GameState {
  let next = prev;
  const chests = [...(prev.treasureChests || [])];
  for (const chest of chests) {
    if ((next.equipmentInventory?.length || 0) >= getEquipmentLimit(next)) break;
    next = openTreasureChest(next, chest.uid);
  }
  return next;
}
