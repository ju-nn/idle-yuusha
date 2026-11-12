import { itemKind, itemName } from '../data/catalog';

// 自動売却の単価表。対象は「素材」アイテムだけに絞る（安全側）。
// 重要（★）・記録・拠点整備は絶対に売らない。
// 商人の買い取り価格が定義されている品（スライムゼリー等）はその価格に合わせ、
// それ以外は控えめな固定価格にする。
export const ITEM_SELL_PRICES: Record<string, number> = {
  small_fish: 3,
  twig: 2,
  pebble_ore: 4,
  daikon_seed: 2,
  daikon: 3,
  sleepy_herb: 5,
  safe_potato: 4,
  moonbean: 6,
  rent_rice: 8,
  slime_jelly: 7,
  goblin_ear: 16,
  wolf_fang: 22,
  rusty_armor_plate: 28,
  bike_upgrade: 10,
  rusty_hook: 2,
  acorn: 1,
  glimmer_pebble: 2,
  mossy_coin: 6,
  echo_stone: 4,
  cold_coffee: 1,
  tower_shard: 30,
  single_glove: 4,
  faded_towel: 5,
  burnt_wick: 4,
  sunken_key: 6,
  rusty_nail: 2,
  dried_ink: 3,
  // コンテンツ小バッチ（2026-11-10 09時台）：置き去りの日用品シリーズの続き。
  broken_mug: 4,
  dented_mug: 3,
  broken_hiking_boots: 5,
  frayed_hiking_boot_lace: 2,
  broken_pocket_watch: 6,
  stopped_pocket_watch: 3,
  // コンテンツ小バッチ（2026-11-10 09時台の統合分。08時台バッチから移植）。
  frayed_plushie: 4,
  plushie_button: 2,
  broken_radio: 5,
  broken_radio_dial: 2,
  pocket_watch_hand: 3,
  // 置き去りの日用品シリーズ（2026-11-10 05時台・11時台の小バッチ素材。従来は未登録で自動売却の対象外だった）。
  cracked_watering_can: 4,
  dented_watering_can: 3,
  cracked_telescope: 5,
  cracked_telescope_lens: 3,
  torn_sleeping_bag: 4,
  broken_sleeping_bag_zipper: 2,
  cracked_wristwatch: 5,
  stopped_wristwatch: 3,
  cracked_camera: 6,
  cracked_camera_lens: 4,
  bent_shovel: 5,
  broken_shovel_handle: 2,
  // コンテンツ小バッチ（2026-11-10 15時台）：置き去りの日用品シリーズの続き。
  frayed_ribbon: 5,
  faded_ribbon: 3,
  dented_bottle: 6,
  bottle_cap: 4,
  tangled_rope: 5,
  snapped_rope: 2,
  // コンテンツ小バッチ（2026-11-10 17時台）：置き去りの日用品シリーズの続き。
  chipped_comb: 5,
  missing_comb_tooth: 3,
  single_work_glove: 5,
  frayed_work_glove: 3,
  bent_spoon: 6,
  rusty_spoon: 4,
  // コンテンツ小バッチ（2026-11-10 19時台）：置き去りの日用品シリーズの続き。
  worn_slipper: 5,
  faded_slipper: 3,
  empty_wallet: 5,
  loose_coins: 4,
  // コンテンツ小バッチ（2026-11-10 21時台）：置き去りの日用品シリーズの続き。
  single_earring: 5,
  rusty_earring: 3,
  parasol_rib: 6,
  broken_parasol: 4,
  music_box_spring: 5,
  stopped_music_box: 2,
  // コンテンツ小バッチ（2026-11-10 22時台）：置き去りの日用品シリーズの続き。
  bent_hairpin: 5,
  tarnished_hairpin: 3,
  scratched_sunglasses: 6,
  cracked_sunglasses: 4,
  torn_diary: 6,
  faded_diary: 4,
  cracked_wind_chime: 5,
  faded_wind_chime_paper: 3,
  torn_kite: 6,
  snapped_kite_string: 4,
  cracked_yutanpo: 6,
  faded_yutanpo_cover: 4,
  holey_socks: 5,
  single_sock: 3,
  cracked_magnifier: 6,
  foggy_magnifier: 4,
  torn_blanket: 6,
  faded_blanket: 4,
  stained_apron: 6,
  torn_apron: 4,
  bent_trekking_pole: 6,
  worn_trekking_pole: 4,
  worn_sandal: 6,
  single_sandal: 3,
  faded_bandana: 6,
  torn_bandana: 4,
  broken_headlamp: 6,
  dim_headlamp: 4,
  rusty_harmonica: 6,
  silent_harmonica: 4,
  frayed_yarn_ball: 6,
  yarn_scrap: 4,
  faded_postcard: 6,
  torn_postcard: 4,
  rusty_alarm_clock: 6,
  stopped_alarm_clock: 4,
  broken_fishing_rod: 6,
  frayed_fishing_line: 4,
  empty_first_aid_kit: 6,
  used_bandage: 4,
  worn_pillow: 6,
  torn_pillowcase: 4,
};

export function isAutoSellTarget(itemId: string) {
  return itemKind(itemId) === '素材' && (ITEM_SELL_PRICES[itemId] || 0) > 0;
}

export type AutoSoldEntry = { item: string; amount: number; gold: number };

// before → after の増加分のうち、自動売却対象の素材だけを売却する。
// 初めて手に入れた品は、図鑑・実績の判定が従来どおり働くよう1個だけ手元に残す。
export function autoSellGainedItems(
  beforeItems: Record<string, number>,
  afterItems: Record<string, number>,
  priceMultiplier = 1,
): { items: Record<string, number>; gold: number; sold: AutoSoldEntry[] } {
  const items = { ...afterItems };
  const sold: AutoSoldEntry[] = [];
  let gold = 0;
  Object.keys(afterItems).forEach((itemId) => {
    if (!isAutoSellTarget(itemId)) return;
    const before = beforeItems[itemId] || 0;
    const after = afterItems[itemId] || 0;
    const gained = after - before;
    if (gained <= 0) return;
    const keep = before === 0 ? 1 : 0;
    const sellAmount = gained - keep;
    if (sellAmount <= 0) return;
    const entryGold = Math.max(1, Math.floor(sellAmount * ITEM_SELL_PRICES[itemId] * priceMultiplier));
    items[itemId] = after - sellAmount;
    gold += entryGold;
    sold.push({ item: itemId, amount: sellAmount, gold: entryGold });
  });
  return { items, gold, sold };
}

export function autoSellLogText(sold: AutoSoldEntry[]) {
  const total = sold.reduce((sum, entry) => sum + entry.gold, 0);
  const detail = sold.map((entry) => `${itemName(entry.item)}×${entry.amount}`).join(' / ');
  return `自動売却：${detail} → +${total}G。素材が手間ゼロで財布に変わった。`;
}
