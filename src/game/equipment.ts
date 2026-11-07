import type { EquipmentItem, EquipmentOption, EquipmentOptionTarget, EquipmentRarity, EquipmentSlot, FeedbackEvent, GameState, JobType, ResourceKey, TreasureChest, TreasureChestType } from '../types';
import { enqueueMusing } from './musings';
import { getSynergyEntryCostReductionPct, getSynergySellBonusPct } from './synergy';
import { getTraitSellBonusPct } from './traits';
import { getPrestigeChestMultiplier, getRebirthChestLimitBonus } from './prestige';
import { applyMilestoneAchievements, emptyLifetime } from './progression';
import { getCurrentSeason, type SeasonId } from './seasons';
import { loadUserSettings } from './settings';

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
  // 季節限定のお守り：この季節のときだけ抽選の候補に入る。
  // 未設定の土台はいつでも候補に入る（既存プレイヤーの抽選を変えない）。
  season?: SeasonId;
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
  { baseId: 'lunch_break_hammer', name: '昼休みのハンマー', slot: 'weapon', description: '叩く相手は敵ではなく、午後の眠気のほう。' },
  { baseId: 'weekend_bow', name: '週末の弓', slot: 'weapon', description: '矢はよく飛ぶ。予定だけは飛んでこない。' },
  { baseId: 'warm_sweater', name: '毛玉のセーター', slot: 'armor', description: '毛玉がつくほど着た。防御力より安心感が先に育った。' },
  { baseId: 'raincoat_of_days_off', name: '休日のレインコート', slot: 'armor', minRarity: 'rare', description: '雨の日でも、少しだけ出かけたくなる色をしている。' },
  { baseId: 'morning_coffee_charm', name: '朝コーヒーのお守り', slot: 'charm', description: '一口で、今日の最初の敵（眠気）が少し弱る。' },
  { baseId: 'receipt_charm', name: '領収書のお守り', slot: 'charm', description: '経費にできそうなものは、だいたい勇気になる。', jobs: ['merchant'] },
  { baseId: 'overtime_frying_pan', name: '残業明けのフライパン', slot: 'weapon', description: '晩ごはんのついでに敵もひっくり返す。油はねだけは勘弁。' },
  { baseId: 'punctual_boomerang', name: '定時ダッシュのブーメラン', slot: 'weapon', minRarity: 'rare', description: '投げれば必ず定時に戻ってくる。手元に戻る安心感が武器。' },
  { baseId: 'blanket_armor', name: '毛布の鎧', slot: 'armor', description: '包まれると戦う気より眠る気が勝つ。防御より安心感で守る。' },
  { baseId: 'rain_shelter_scarf', name: '雨宿りのマフラー', slot: 'armor', minRarity: 'rare', description: '雨宿りのあたたかさが残っている。濡れた心配だけ少し弾く。' },
  { baseId: 'front_door_key_charm', name: '玄関の鍵のお守り', slot: 'charm', description: '帰る場所があるだけで、今日の冒険は少しだけ軽くなる。' },
  { baseId: 'paid_leave_calendar_charm', name: '有給カレンダーのお守り', slot: 'charm', onlyRarity: 'legendary', description: 'カレンダーの休み欄だけがやけに光っている。見るだけで回復する。' },
  { baseId: 'nap_pillow_mace', name: '昼寝枕のメイス', slot: 'weapon', description: '振るたび、眠気が向こうへ飛んでいく。枕なのに意外と痛い。' },
  { baseId: 'last_train_spear', name: '終電の槍', slot: 'weapon', minRarity: 'rare', description: '乗り遅れまいとする速度で突く。帰る意思だけは誰にも負けない。' },
  { baseId: 'kotatsu_armor', name: 'こたつの鎧', slot: 'armor', description: '入ったら出られない。防御というより、戦う気の置き忘れ。' },
  { baseId: 'day_off_hoodie', name: '休日のパーカー', slot: 'armor', minRarity: 'rare', description: 'フードをかぶると、世界が少しだけ静かになる。' },
  { baseId: 'cat_nap_charm', name: '猫の昼寝のお守り', slot: 'charm', description: '猫が寝ている間だけ、運が少し上がる気がする。' },
  { baseId: 'evening_bath_charm', name: '晩風呂の湯気のお守り', slot: 'charm', onlyRarity: 'legendary', description: '湯気の向こうでは、今日の疲れが少しだけ溶けていく。' },
  { baseId: 'folding_umbrella_sword', name: '折りたたみ傘の剣', slot: 'weapon', description: '開けば雨よけ、閉じれば剣。天気に左右されない身軽さが武器。' },
  { baseId: 'midnight_fridge_axe', name: '深夜の冷蔵庫の斧', slot: 'weapon', minRarity: 'rare', description: '夜中に冷蔵庫を開ける勇気で振り下ろす。音だけは立てない。' },
  { baseId: 'bath_towel_armor', name: '湯上がりバスタオルの鎧', slot: 'armor', description: '包まれると今日の疲れが半分になる。防御より湯上がりの安心感。' },
  { baseId: 'zabuton_armor', name: '座布団の鎧', slot: 'armor', minRarity: 'rare', description: '座った瞬間、戦う気も一緒に座り込む。動かない強さがある。' },
  { baseId: 'toothbrush_charm', name: '寝る前の歯磨きのお守り', slot: 'charm', description: '一日をきちんと閉じる力がつく。明日への準備はもう済んでいる。' },
  { baseId: 'balcony_stargazing_charm', name: '星空のベランダのお守り', slot: 'charm', onlyRarity: 'legendary', description: '夜風に当たると、明日への元気が少し戻ってくる気がする。' },
  { baseId: 'alarm_clock_sword', name: '目覚まし時計の剣', slot: 'weapon', description: '鳴った瞬間に起きる決意だけは鋭い。スヌーズは許さない。' },
  { baseId: 'stationery_scissors_sword', name: '文房具のはさみの剣', slot: 'weapon', minRarity: 'rare', description: '紙も敵も、切れ味のいい線で片づける。' },
  { baseId: 'futon_armor', name: '布団の鎧', slot: 'armor', description: '朝、布団から出るのが惜しい温かさで守る。' },
  { baseId: 'loungewear_armor', name: '部屋着の鎧', slot: 'armor', minRarity: 'rare', description: 'くつろいだ姿勢のまま戦える。緊張だけは着替えた。' },
  { baseId: 'plant_watering_charm', name: '水やりのお守り', slot: 'charm', description: '少しずつ育てる力がつく。今日の一杯が明日の芽になる。' },
  { baseId: 'sunset_walk_charm', name: '夕方の散歩のお守り', slot: 'charm', onlyRarity: 'legendary', description: '夕日の下を歩くと、今日の疲れが少しだけほどける。' },
  { baseId: 'laundry_pole_sword', name: '物干し竿の剣', slot: 'weapon', description: 'ベランダの日常が、そのまま間合いになる。洗濯物は干したまま。' },
  { baseId: 'sticky_note_dagger', name: '付箋の短剣', slot: 'weapon', minRarity: 'rare', description: '「忘れるな」の一言が、意外と刺さる。貼れば貼るほど鋭い。' },
  { baseId: 'rain_boots_armor', name: '長靴の鎧', slot: 'armor', description: '水たまりを避けない勇気で守る。足元だけはもう濡れない。' },
  { baseId: 'apron_armor', name: 'エプロンの鎧', slot: 'armor', minRarity: 'rare', description: '台所の守りは、戦場でも同じくらい頼れる。ポケットに勇気が入っている。' },
  { baseId: 'morning_window_charm', name: '朝の窓辺のお守り', slot: 'charm', description: '朝日が入る窓辺に立つだけで、今日の出足が少し軽くなる。' },
  { baseId: 'first_snow_charm', name: '初雪のお守り', slot: 'charm', onlyRarity: 'legendary', description: '初雪が降った朝の静けさを閉じ込めた。見るだけで心が整う。' },
  { baseId: 'broom_spear', name: 'ほうきの槍', slot: 'weapon', description: '掃除のついでに敵も掃き出す。柄の長さがそのまま間合いになる。' },
  { baseId: 'extension_cord_whip', name: '延長コードの鞭', slot: 'weapon', minRarity: 'rare', description: 'コンセントの届く範囲だけは、誰にも負けない。絡め取ってから片づける。' },
  { baseId: 'rubber_gloves_armor', name: 'ゴム手袋の鎧', slot: 'armor', description: '水仕事の守りは戦場でも同じ。濡れも汚れも、ここでは通さない。' },
  { baseId: 'hot_water_bottle_armor', name: '湯たんぽの鎧', slot: 'armor', minRarity: 'rare', description: 'お腹に抱えた温かさで守る。冷えた夜の味方を、そのまま鎧にした。' },
  { baseId: 'evening_newspaper_charm', name: '夕刊のお守り', slot: 'charm', description: '今日のニュースを読み終えた安心感がつく。世の中が少しだけ分かる気がする。' },
  { baseId: 'streetlight_charm', name: '帰り道の街灯のお守り', slot: 'charm', onlyRarity: 'legendary', description: '帰り道を照らす明かりを閉じ込めた。暗い道でも、家までの道筋だけは見える。' },
  { baseId: 'mop_lance', name: 'モップのランス', slot: 'weapon', description: '床を拭くついでに、敵の足元も拭い去る。濡れた床は誰の味方でもない。' },
  { baseId: 'rice_cooker_hammer', name: '炊飯器のハンマー', slot: 'weapon', minRarity: 'rare', description: '炊き上がりの合図とともに振り下ろす。ほんのり米の匂いがする一撃。' },
  { baseId: 'cardboard_armor', name: '段ボールの鎧', slot: 'armor', description: '引っ越しの残りで作った鎧。軽さは正義だが、雨の日は解散する。' },
  { baseId: 'electric_blanket_armor', name: '電気毛布の鎧', slot: 'armor', minRarity: 'rare', description: '温度設定は「弱」。戦場でも、まず体が温かいことが正義になる。' },
  { baseId: 'grocery_list_charm', name: '買い物メモのお守り', slot: 'charm', description: '買うものを書いたメモ。持っていると、余計な出費と敵の見分けが少しつく。' },
  { baseId: 'dawn_silence_charm', name: '夜明けの静けさのお守り', slot: 'charm', onlyRarity: 'legendary', description: '誰も起きていない時間の静けさを閉じ込めた。世界が動き出す前の、短い自由。' },
  { baseId: 'waribashi_swords', name: '割り箸の双剣', slot: 'weapon', description: '割った瞬間から二刀流。折れても、もう一膳あるのが心強い。' },
  { baseId: 'tv_remote_wand', name: 'テレビリモコンの杖', slot: 'weapon', minRarity: 'rare', description: '向けた先の敵が、なぜか一時停止する。音量ボタンは威力調整に使える。' },
  { baseId: 'cardboard_box_armor', name: '段ボール箱の鎧', slot: 'armor', description: '入れば身を隠せるし、運べば引っ越しもできる。防御というより、箱の安心感。' },
  { baseId: 'sleeping_bag_armor', name: '寝袋の鎧', slot: 'armor', minRarity: 'rare', description: 'どこでも寝られる覚悟が、そのまま防御になる。朝露だけは少し染みる。' },
  { baseId: 'radio_exercise_charm', name: '朝のラジオ体操のお守り', slot: 'charm', description: 'ラジオの号令で体がほぐれる。腕を大きく回すと、運も少し回り出す。' },
  { baseId: 'midnight_convenience_charm', name: '深夜のコンビニのお守り', slot: 'charm', onlyRarity: 'legendary', description: '夜中の明かりと温かいおにぎりの安心感を閉じ込めた。何があっても、ここだけは開いている。' },
  // 季節限定のお守り（ロードマップ7）。今の季節のときだけ宝箱の抽選候補に入る。
  { baseId: 'spring_sprout_charm', name: '春の芽吹きのお守り', slot: 'charm', description: '芽吹きの季節の匂いがする。新しいことを始める勇気が少しだけ湧く。', season: 'spring' },
  { baseId: 'summer_lantern_charm', name: '夏の夜祭りのお守り', slot: 'charm', description: '夜祭りの提灯の明かりを閉じ込めた。暑い夜でも、少しだけ涼しい顔ができる。', season: 'summer' },
  { baseId: 'autumn_harvest_charm', name: '秋の収穫祭のお守り', slot: 'charm', description: '収穫祭の賑わいを閉じ込めた。実りの季節は、財布にも少しだけ優しい。', season: 'autumn' },
  { baseId: 'winter_lamp_charm', name: '冬の静かな灯りのお守り', slot: 'charm', description: '冬の夜の静かな灯りを閉じ込めた。寒い日ほど、帰る場所が恋しくなる。', season: 'winter' },
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

// 土台が今の季節の抽選候補に入るか。季節が付いていない土台はいつでも候補。
export function isEquipmentBaseInSeason(baseId: string, seasonId: SeasonId): boolean {
  const base = BASES.find((candidate) => candidate.baseId === baseId);
  if (!base) return false;
  return !base.season || base.season === seasonId;
}

export function equipmentBaseName(baseId: string): string {
  return BASES.find((candidate) => candidate.baseId === baseId)?.name || baseId;
}

function pickBase(rarity: EquipmentRarity, jobId: string, jobType: JobType, seasonId: SeasonId = getCurrentSeason().id) {
  const candidates = BASES.filter((base) => {
    if (base.onlyRarity && base.onlyRarity !== rarity) return false;
    if (base.minRarity && rarityRank(rarity) < rarityRank(base.minRarity)) return false;
    if (base.jobs && !base.jobs.includes(jobId)) return false;
    if (base.jobTypes && !base.jobTypes.includes(jobType)) return false;
    if (base.season && base.season !== seasonId) return false;
    return true;
  });
  const fallback = BASES.filter((base) => !base.onlyRarity && (!base.minRarity || rarityRank(rarity) >= rarityRank(base.minRarity)) && (!base.season || base.season === seasonId));
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
  const chance = baseChance * (1 + getEquipmentBonus(state, 'dropRate') / 100) * getPrestigeChestMultiplier(state);
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
  // 転生の宝箱運があると、上限が +2/段階で広がる（収納棚とは別枠）。
  return 40 + ((state.items?.upgrade_small_shelf || 0) ? 15 : 0) + getRebirthChestLimitBonus(state);
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
  // 連鎖：釣りLvが商人の売却額を押し上げる（装備ボーナスとは別枠）。
  // 特性：商人気質ならさらに +15%（シナジーとは別枠）。
  return 1 + getEquipmentBonus(state, 'sellPrice') / 100 + getSynergySellBonusPct(state) / 100 + getTraitSellBonusPct(state) / 100;
}

export function getAdventureEntryCost(state: GameState, baseCost = 0) {
  if (baseCost <= 0) return 0;
  const multiplier = Math.max(0.5, 1 - getEquipmentBonus(state, 'adventureCost') / 100);
  // 連鎖：夜間警備Lvが出発費をさらに下げる（装備ボーナスとは別枠）。
  const synergyMultiplier = 1 - getSynergyEntryCostReductionPct(state) / 100;
  return Math.max(1, Math.floor(baseCost * multiplier * synergyMultiplier));
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

// 装備の総合力。自動装備の比較用で、物差しは既存の売却額算出
// （レアリティ基礎値＋オプション値の合計＝効果の総量）と揃える。
export function getEquipmentPower(item: EquipmentItem) {
  return getEquipmentSellValue(item);
}

// 自動装備（設定ONのとき）: 手に入れた装備が、同じ枠の現在の装備より強い場合だけ付け替える。
// 枠が空いていれば無条件で装備する。同等以下なら何もしない（既存の遊び方を変えない）。
export function maybeAutoEquip(state: GameState, item: EquipmentItem): GameState {
  if (!loadUserSettings().autoEquip) return state;
  const currentUid = state.equipped?.[item.slot];
  const current = currentUid ? (state.equipmentInventory || []).find((candidate) => candidate.uid === currentUid) : undefined;
  if (current && getEquipmentPower(item) <= getEquipmentPower(current)) return state;
  const autoEvent: FeedbackEvent = { id: `auto-equip-${item.uid}`, type: 'equipmentDrop', label: `自動装備 ${item.name}` };
  return {
    ...state,
    equipped: { ...(state.equipped || {}), [item.slot]: item.uid },
    feedbackEvents: [...(state.feedbackEvents || []), autoEvent].slice(-24),
    eventLog: [
      `自動装備：${item.name}を装備した。${current ? `今までの${current.name}より強い。` : '空いていた枠に、そのまま入れた。'}付け替えの手間が消えた。`,
      ...(state.eventLog || []),
    ].slice(0, 24),
  };
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
  const saleEvent: FeedbackEvent = { id: `sale-equipment-${Date.now()}`, type: 'sale', label: item.name };
  const next = {
    ...prev,
    gold: prev.gold + value,
    equipped,
    equipmentInventory: prev.equipmentInventory.filter((candidate) => candidate.uid !== uid),
    feedbackEvents: [...(prev.feedbackEvents || []), saleEvent].slice(-24),
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
  const openEvent: FeedbackEvent = {
    id: `chest-open-${Date.now()}`,
    type: 'chestOpen',
    label: chest.name,
  };
  const dropEvent: FeedbackEvent = {
    id: `open-chest-${Date.now()}`,
    type: equipment.rarity === 'legendary' ? 'legendaryDrop' : 'equipmentDrop',
    label: equipment.name,
  };
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
      openEvent,
      dropEvent,
    ].slice(-24),
    achievements: equipment.rarity === 'legendary'
      ? Array.from(new Set([...(prev.achievements || []), 'first_chest_open', 'first_equipment', 'first_legendary_equipment']))
      : Array.from(new Set([...(prev.achievements || []), 'first_chest_open', 'first_equipment'])),
    lifetime: { ...(prev.lifetime || emptyLifetime()), chestsOpened: (prev.lifetime?.chestsOpened || 0) + 1 },
    eventLog: [
      `宝箱開封：${chest.name}から${equipmentText}。${equipment.description}`,
      ...prev.eventLog,
    ].slice(0, 24),
  };
  return enqueueMusing(maybeAutoEquip(applyMilestoneAchievements(next), equipment), {
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
