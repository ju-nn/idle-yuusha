export type ResourceKey = 'fish' | 'wood' | 'ore';

export type JobType = 'idle' | 'farming' | 'combat' | 'adventure';

export type MusingType = 'event' | 'firstTime' | 'failure' | 'milestone' | 'state' | 'idle' | 'daily';

export type EquipmentSlot = 'weapon' | 'armor' | 'charm';

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type EquipmentOptionTarget =
  | 'jobSpeed'
  | 'resourceGain'
  | 'sellPrice'
  | 'attack'
  | 'defense'
  | 'hpRegen'
  | 'mpRegen'
  | 'adventureCost'
  | 'dropRate';

export type EquipmentOption = {
  id: string;
  target: EquipmentOptionTarget;
  scope?: string;
  value: number;
};

export type EquipmentItem = {
  uid: string;
  baseId: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  options: EquipmentOption[];
  obtainedAt: number;
  locked?: boolean;
};

export type TreasureChestType = 'worn' | 'life' | 'adventure' | 'castle' | 'legendary';

export type TreasureChest = {
  uid: string;
  type: TreasureChestType;
  name: string;
  description: string;
  obtainedAt: number;
  sourceJob?: string;
  sourceArea?: string;
};

export type FeedbackEventType =
  | 'workComplete'
  | 'multiReward'
  | 'sale'
  | 'rareDrop'
  | 'equipmentDrop'
  | 'legendaryDrop'
  | 'adventureStart'
  | 'adventureSuccess'
  | 'failure';

export type FeedbackEvent = {
  id: string;
  type: FeedbackEventType;
  label?: string;
};

export type Requirement =
  | { type: 'start' }
  | { type: 'item'; item: string; amount: number }
  | { type: 'jobLevel'; job: string; level: number };

export type Musing = {
  id?: string;
  job?: string;
  area?: string;
  category?: string;
  text: string;
  rewardItems?: Array<{ item: string; amount: number }>;
  claimed?: boolean;
  readAt?: number;
  eventType?: MusingType;
  eventSubType?: string;
  eventLevel?: number;
  eventTarget?: string;
  once?: boolean;
  priority?: number;
  cooldownSec?: number;
  conditionKey?: string;
};

export type Monster = {
  id: string;
  name: string;
  hp: number;
  attack: number;
  rewards: Partial<Record<ResourceKey, [number, number]>> & {
    gold?: [number, number];
    xp?: number;
  };
  drops: Array<{ item: string; chance: number; amount: [number, number] }>;
};

export type Area = {
  id: string;
  name: string;
  summary: string;
  seconds: number;
  unlock?: Requirement;
  rewards: Partial<Record<ResourceKey, [number, number]>> & {
    gold?: [number, number];
    xp?: number;
    hp?: number;
    mp?: number;
  };
  adventureCost?: number;
  drops: Array<{ item: string; chance: number; amount: [number, number] }>;
  musings: Musing[];
  sell?: { resource: ResourceKey; amount: [number, number]; price: number };
  sellItems?: Array<{ item: string; amount: [number, number]; price: number }>;
  failChance?: number;
  failMusings?: string[];
  encounterChance?: number;
  monsters?: Monster[];
};

export type Upgrade = {
  id: string;
  name: string;
  description: string;
  cost: { gold: number; resources: Partial<Record<ResourceKey, number>> };
  effects: { maxHp?: number; maxMp?: number; failReduction?: number };
  log: string;
  level?: number;
};

export type Job = {
  name: string;
  type: JobType;
  description: string;
  unlock: Requirement;
  areas: Area[];
  upgrades: Upgrade[];
  levelMusings?: Record<number, Musing[]>;
};

export type GameState = {
  saveVersion?: number;
  offlineSummary?: {
    elapsedText: string;
    goldGain: number;
    resourceGains: Partial<Record<ResourceKey, number>>;
    itemGains: Record<string, number>;
    chestGain?: number;
    cycles: number;
  } | null;
  combo?: {
    lastJob?: string;
    streak: number;
    boons: Record<string, number>;
  };
  dailyBonus?: {
    lastClaimDate?: string;
    streak: number;
  };
  activeJob: string;
  activeArea: string;
  tick: number;
  gold: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  resources: Record<ResourceKey, number>;
  items: Record<string, number>;
  jobData: Record<string, { level: number; xp: number; seenMusings: string[] }>;
  currentMusing: Musing;
  readMusings: Musing[];
  musingQueue: Musing[];
  eventLog: string[];
  combatLog: string[];
  farming: { plantedAt: number | null; cropId: string | null; readyAt: number | null };
  tutorialStep: string;
  achievements: string[];
  equipmentInventory: EquipmentItem[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  seenEquipmentBaseIds: string[];
  equipmentDropLog: string[];
  treasureChests: TreasureChest[];
  openedChestLog: string[];
  feedbackEvents: FeedbackEvent[];
  progressBreaking: boolean;
  inCombat: boolean;
  currentMonster: Monster | null;
  monsterHp: number;
  visitedAreas: string[];
  defeatedMonsters: string[];
  unlockedJobs: string[];
  seenMusingIds: string[];
  recentMusingIds: string[];
  musingCooldowns: Record<string, number>;
  lastAmbientMusingAt?: number;
  lastCertainMusingAt?: number;
  lastSavedAt?: number;
};

export type Achievement = {
  name: string;
  description: string;
};
