// 季節イベント（ロードマップ7「リテンション施策」）。
// 4季節を月で区切り、それぞれ限定イベント・限定アイテム・限定お守りを持つ。
// 期間外は入手不可のため、季節限定アイテムは図鑑コンプリートの分母に含めない。
import type { Musing } from '../types';

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export type SeasonInfo = {
  id: SeasonId;
  name: string;
  eventName: string;
  description: string;
  // その季節の末日（ローカル日付）と、末日までの残り日数。
  endDate: Date;
  daysLeft: number;
  year: number;
  month: number;
  // 季節の帰属年（冬は12月〜2月をひとつの季節として扱うため、1・2月は前年）。
  seasonYear: number;
  itemId: string;
  charmBaseId: string;
};

const SEASON_DEFS: Record<SeasonId, { name: string; eventName: string; description: string; itemId: string; charmBaseId: string }> = {
  spring: {
    name: '春',
    eventName: '春の芽吹きまつり',
    description: '芽吹きの季節。畑も勇者も、少しだけ伸びる。',
    itemId: 'spring_sprout',
    charmBaseId: 'spring_sprout_charm',
  },
  summer: {
    name: '夏',
    eventName: '夏の夜祭り',
    description: '夜祭りの季節。明かりはきれいで、財布の中は静か。',
    itemId: 'summer_cicada_shell',
    charmBaseId: 'summer_lantern_charm',
  },
  autumn: {
    name: '秋',
    eventName: '秋の収穫祭',
    description: '実りの季節。貯金は実らないけど、栗は拾える。',
    itemId: 'autumn_chestnut',
    charmBaseId: 'autumn_harvest_charm',
  },
  winter: {
    name: '冬',
    eventName: '冬の静かな灯り',
    description: '静かな灯りの季節。寒い夜ほど、灯りが少しだけ優しい。',
    itemId: 'winter_yuzu',
    charmBaseId: 'winter_lamp_charm',
  },
};

function seasonIdForMonth(month: number): SeasonId {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 季節の末月：春は5月、夏は8月、秋は11月、冬は2月（年をまたぐ）。
function seasonEndMonthYear(month: number, year: number): { month: number; year: number } {
  if (month >= 3 && month <= 5) return { month: 5, year };
  if (month >= 6 && month <= 8) return { month: 8, year };
  if (month >= 9 && month <= 11) return { month: 11, year };
  return month === 12 ? { month: 2, year: year + 1 } : { month: 2, year };
}

// 現在の季節とイベント情報。now を注入できる。
export function getCurrentSeason(now: Date | number = new Date()): SeasonInfo {
  const date = typeof now === 'number' ? new Date(now) : new Date(now.getTime());
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const id = seasonIdForMonth(month);
  const def = SEASON_DEFS[id];
  const end = seasonEndMonthYear(month, year);
  const endDate = new Date(end.year, end.month, 0); // 末月の末日
  const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
  const daysLeft = Math.max(0, Math.ceil((endOfDay.getTime() - date.getTime()) / (24 * 3600 * 1000)));
  const seasonYear = id === 'winter' && month <= 2 ? year - 1 : year;
  return { id, ...def, endDate, daysLeft, year, month, seasonYear };
}

export const SEASONAL_ITEM_IDS = Object.values(SEASON_DEFS).map((def) => def.itemId);

export const SEASONAL_CHARM_BASE_IDS = Object.values(SEASON_DEFS).map((def) => def.charmBaseId);

// 季節が変わった最初の tick で一度だけ出すぼやき（id は季節+年で once）。
export function seasonStartMusingId(season: SeasonInfo): string {
  return `season-${season.id}-${season.seasonYear}`;
}

const SEASON_START_TEXTS: Record<SeasonId, string> = {
  spring: '春の芽吹きまつりが始まった。\n\n勇者「芽が出る季節。俺のやる気はまだ土の中」',
  summer: '夏の夜祭りが始まった。\n\n勇者「祭りの明かりはきれいだ。財布の中は静かだけど」',
  autumn: '秋の収穫祭が始まった。\n\n勇者「実りの季節。貯金は実らないけど、栗は拾える」',
  winter: '冬の静かな灯りが始まった。\n\n勇者「寒い。布団と灯りだけが、今日の味方だ」',
};

export function seasonStartMusing(season: SeasonInfo): Musing {
  return {
    id: seasonStartMusingId(season),
    job: '勇者',
    area: season.eventName,
    text: SEASON_START_TEXTS[season.id],
    category: 'event',
    eventType: 'event',
    eventSubType: 'season_start',
    eventTarget: season.id,
    once: true,
  };
}

// 季節アイテムを初めて手に入れたときのぼやき（id はアイテム単位で once）。
export function seasonItemMusingId(itemId: string): string {
  return `season-item-${itemId}`;
}

const SEASON_ITEM_TEXTS: Record<string, string> = {
  spring_sprout: '勇者は初めて春の若芽を手に入れた。\n\n勇者「芽を摘むのは少し気が引ける。でも味噌汁の具は季節の味がする」',
  summer_cicada_shell: '勇者は初めて蝉の抜け殻を手に入れた。\n\n勇者「抜け殻だけ置いていく生き方、ちょっと羨ましい」',
  autumn_chestnut: '勇者は初めて秋の栗を手に入れた。\n\n勇者「拾うだけなら無料。茹でれば甘い。秋、かなり良心的だ」',
  winter_yuzu: '勇者は初めて冬の柚子を手に入れた。\n\n勇者「柚子風呂に入れば、寒さも少しだけ許せる気がする」',
};

export function seasonItemMusing(itemId: string, season: SeasonInfo): Musing {
  return {
    id: seasonItemMusingId(itemId),
    job: '勇者',
    area: season.eventName,
    text: SEASON_ITEM_TEXTS[itemId] || `勇者は初めて季節の品を手に入れた。\n\n勇者「季節限定の品。期間限定という言葉に、財布より先に心が反応する」`,
    category: 'event',
    eventType: 'event',
    eventSubType: 'season_item',
    eventTarget: itemId,
    once: true,
  };
}

// 季節限定アイテムのドロップ確率（サイクル完了時、未所持のときだけ抽選）。
export const SEASON_ITEM_DROP_CHANCE = 0.015;
