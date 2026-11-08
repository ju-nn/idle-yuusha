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
  | 'failure'
  | 'levelUp'
  | 'battleLose'
  | 'chestOpen'
  | 'retire';

export type FeedbackEvent = {
  id: string;
  type: FeedbackEventType;
  label?: string;
};

export type Requirement =
  | { type: 'start' }
  | { type: 'item'; item: string; amount: number }
  | { type: 'jobLevel'; job: string; level: number }
  // 転生専用（2026-11-07 / ロードマップ5の残り）: 転生回数が条件。転生した勇者だけが開く。
  | { type: 'rebirth'; count: number };

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
  // ボス: 玉座の間の連戦対象。戦闘ログと図鑑で「ボス」として区別する。
  boss?: boolean;
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

export type PrestigeState = {
  memoryPoints: number;
  totalEarned: number;
  retireCount: number;
  upgrades: Record<string, number>;
  // 転生（第2層）: 引退を3回重ねた先の区切り。思い出ポイントと第1層の強化を
  // 置いていく代わりに「転生の証」を得て、より強い永続強化を買う。
  rebirthPoints: number;
  totalRebirthEarned: number;
  rebirthCount: number;
  rebirthUpgrades: Record<string, number>;
};

export type OfflineTier = 'short' | 'hours' | 'overnight' | 'days';

// 特性（Trait）: ビルドの方向性。1つだけ有効。未選択は null。
export type TraitId = 'craftsman' | 'adventurer' | 'merchant' | 'easygoing';

// 週間目標（ロードマップ7「リテンション施策」）。
export type WeeklyGoalTier = 'easy' | 'medium' | 'hard';
export type WeeklyGoalKind = 'cycles' | 'goldEarned' | 'kills' | 'salesGold' | 'harvests' | 'chestsOpened' | 'musingsRead' | 'discovered';
export type WeeklyGoal = {
  id: string;
  label: string;
  kind: WeeklyGoalKind;
  target: number;
  rewardGold: number;
  tier: WeeklyGoalTier;
};
// 週間目標の起点：週の始まり時点の通算カウンタ。進捗は lifetime との差分で測る。
export type WeeklyBaseline = {
  cycles: number;
  goldEarned: number;
  kills: number;
  salesGold: number;
  harvests: number;
  chestsOpened: number;
  musingsRead: number;
  discovered: number;
};
export type WeeklyState = {
  weekKey: string;
  baseline: WeeklyBaseline;
  claimed: string[];
};

// 相棒の猫「ミケ」（登場人物施策）。来訪はランダム出現＋短時間バフ。
// visit は「猫が来ている」状態（5分で帰る）、buff は「なでた」後の効果。
// 旧セーブは未記録扱い（来訪なし）。引退・転生でも引き継ぐ。
export type CatBuffId = 'gold_rush' | 'focus' | 'gift';
export type CatVisit = { buffId: CatBuffId; appearedAt: number; expiresAt: number };
export type CatState = {
  visits: number;
  lastRollAt: number;
  lastVisitAt: number;
  // ミケを呼んだ最終時刻（能動操作「呼ぶ」のクールダウン管理用）。
  lastCallAt: number;
  visit: CatVisit | null;
  buff: { id: CatBuffId; expiresAt: number } | null;
};

// ぼやきハイブリッド表示：日常の繰り返しぼやき（idle/daily）は
// メインのぼやきキューには入れず、画面の端を流れるティッカー専用にする。
// 出来事ぼやき（event/firstTime/failure/milestone/state）は従来通り
// スタックして「次へ」で読む。ティッカーは見逃し損なしの雰囲気専用。
export type TickerMusing = { text: string; at: number };

export type GameState = {
  saveVersion?: number;
  offlineSummary?: {
    elapsedText: string;
    goldGain: number;
    resourceGains: Partial<Record<ResourceKey, number>>;
    itemGains: Record<string, number>;
    chestGain?: number;
    cycles: number;
    tier?: OfflineTier;
    capped?: boolean;
    // 帰還サマリの詳細化（ロードマップ11「オフライン深化」）：
    // 不在中に積もった XP・レベルアップ・討伐・新発見も帰還カードに載せる。
    xpGain?: number;
    levelUps?: string[];
    killsGain?: number;
    discoveredGain?: number;
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
  // 通算の歩み（累計カウンタ）。旧セーブは未記録扱い。
  lifetime?: LifetimeStats;
  // 週間目標の進行。旧セーブは未記録扱い（次の tick で今週の起点が作られる）。
  // 引退・転生でも引き継ぐ。
  weekly?: WeeklyState;
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
  // ボス連勝数: 玉座の間でボスに連勝した回数。敗北・遭遇なし・玉座の間以外での
  // サイクル完了で 0 に戻る。旧セーブは未記録扱い（0）。
  bossStreak?: number;
  unlockedJobs: string[];
  seenMusingIds: string[];
  recentMusingIds: string[];
  musingCooldowns: Record<string, number>;
  lastAmbientMusingAt?: number;
  lastCertainMusingAt?: number;
  lastSavedAt?: number;
  // 自動休憩の復帰先: HP/MP不足で休憩へ自動切替したとき、回復後に戻る仕事とエリア。
  // 手動で仕事を選ぶと消える（プレイヤーの意思を優先する）。旧セーブは未設定扱い。
  autoRestReturn?: { job: string; area: string } | null;
  // 相棒の猫: 旧セーブは未記録扱い（来訪なし）。引退・転生でも引き継ぐ。
  cat?: CatState;
  // 出会った人物（商店の店主・大家さん・元勇者仲間の隣人）: 旧セーブは未記録扱い
  // （条件を満たせば次の tick で自動で出会う）。引退・転生でも引き継ぐ。
  metPeople?: string[];
  // ティッカー表示中の日常ぼやき: 雰囲気専用で、リロード時に消える一時的な表示。
  tickerMusing?: TickerMusing | null;
  prestige?: PrestigeState;
  // 特性: 選択中のビルド方向（未選択は null）と変更回数。旧セーブは未選択扱い。
  trait?: TraitId | null;
  traitChanges?: number;
};

export type Achievement = {
  name: string;
  description: string;
  // 未解禁のときに図鑑で見せるヒント（条件の言い換え）。無い場合は定型文を表示する。
  hint?: string;
  // 図鑑でのグルーピング用。'仕事' | '戦闘' | '収集' | '生活' | '周回' | '実績' | '連鎖'。
  category?: string;
};

// 通算の歩み: 実績の節目判定に使う累計カウンタ。引退・転生でも引き継ぐ
// （周回でリセットされる進行とは別枠）。旧セーブは未記録扱い（すべて 0）。
export type LifetimeStats = {
  cycles: number;
  goldEarned: number;
  kills: number;
  salesGold: number;
  harvests: number;
  chestsOpened: number;
  musingsRead: number;
  maxCombo: number;
  discovered: string[];
};
