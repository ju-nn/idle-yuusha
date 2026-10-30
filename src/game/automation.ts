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
