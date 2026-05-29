import {
  Axe,
  Badge,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  CircleDot,
  Compass,
  Coins,
  Fish,
  Gift,
  Heart,
  Home,
  KeyRound,
  Leaf,
  Lock,
  MapPin,
  MessageCircle,
  Moon,
  Pickaxe,
  Play,
  RotateCcw,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  ShoppingCart,
  Sprout,
  Swords,
  Sun,
  TreePine,
  Truck,
  Video,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const icons = {
  axe: Axe,
  badge: Badge,
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  chevronRight: ChevronRight,
  coin: Coins,
  compass: Compass,
  fish: Fish,
  gift: Gift,
  heart: Heart,
  home: Home,
  key: KeyRound,
  leaf: Leaf,
  lock: Lock,
  mapPin: MapPin,
  message: MessageCircle,
  moon: Moon,
  pickaxe: Pickaxe,
  play: Play,
  reset: RotateCcw,
  settings: Settings,
  shieldAlert: ShieldAlert,
  sliders: SlidersHorizontal,
  shoppingCart: ShoppingCart,
  sprout: Sprout,
  swords: Swords,
  sun: Sun,
  target: CircleDot,
  tree: TreePine,
  truck: Truck,
  video: Video,
  volume: Volume2,
  x: X,
  zap: Zap,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = '', 'aria-hidden': ariaHidden = true, ...props }: IconProps) {
  const Component = icons[name];
  return <Component className={`icon ${className}`.trim()} aria-hidden={ariaHidden} {...props} />;
}

const jobIcons: Record<string, IconName> = {
  combat: 'swords',
  adventure: 'compass',
  delivery: 'truck',
  farming: 'sprout',
  fishing: 'fish',
  merchant: 'shoppingCart',
  mining: 'pickaxe',
  office: 'briefcase',
  remote: 'home',
  rest: 'moon',
  shady: 'shieldAlert',
  streaming: 'video',
  woodcutting: 'tree',
};

export function JobIcon({ id }: { id: string }) {
  return <Icon name={jobIcons[id] ?? 'target'} />;
}
