const itemModules = import.meta.glob<string>('../assets/sprites/hero/item-*.png', { eager: true, query: '?url', import: 'default' });
const equipModules = import.meta.glob<string>('../assets/sprites/hero/equip-*.png', { eager: true, query: '?url', import: 'default' });
const monsterModules = import.meta.glob<string>('../assets/sprites/hero/monster-*.png', { eager: true, query: '?url', import: 'default' });

function toMap(modules: Record<string, string>, prefix: string) {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(modules)) {
    const file = path.split('/').pop() || '';
    const id = file.replace(prefix, '').replace('.png', '');
    map[id] = url;
  }
  return map;
}

export const ITEM_SPRITES = toMap(itemModules, 'item-');
export const EQUIP_SPRITES = toMap(equipModules, 'equip-');
export const MONSTER_SPRITES = toMap(monsterModules, 'monster-');

export function ItemSprite({ id, size = 32, silhouette = false }: { id: string; size?: number; silhouette?: boolean }) {
  const src = ITEM_SPRITES[id] || ITEM_SPRITES.fallback;
  if (!src) return null;
  return <img className={`gameSprite ${silhouette ? 'silhouette' : ''}`} src={src} alt="" aria-hidden="true" width={size} height={size} style={{ width: size, height: size }} />;
}

export function EquipSprite({ baseId, size = 32 }: { baseId: string; size?: number }) {
  const src = EQUIP_SPRITES[baseId] || EQUIP_SPRITES.fallback;
  if (!src) return null;
  return <img className="gameSprite" src={src} alt="" aria-hidden="true" width={size} height={size} style={{ width: size, height: size }} />;
}

export function MonsterThumb({ id, size = 48, silhouette = false }: { id: string; size?: number; silhouette?: boolean }) {
  const src = MONSTER_SPRITES[id];
  if (!src) return null;
  return <span className={`monsterThumb ${silhouette ? 'silhouette' : ''}`} aria-hidden="true" style={{ width: size, height: size, backgroundImage: `url(${src})`, backgroundSize: `${size * 2}px ${size}px` }} />;
}
