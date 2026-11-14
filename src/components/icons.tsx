/**
 * Breeze icon system — Lucide line icons (ISC licence), one consistent stroke style.
 * Screens refer to icons by a stable name; this map decides the artwork.
 * Names ending in a filled state (checkmark-circle, star, checkbox…) render filled.
 */
import { createElement, type ComponentType } from 'react'
import {
  ArrowRight, ArrowUp, Ban, BicepsFlexed, BookOpen, Bookmark, Building, Camera, Check, ChevronLeft, ChevronRight, Circle, CircleArrowUp,
  CircleCheck, CircleExclamationPoint, CircleMinus, CirclePlus, Clock, Copy, Dumbbell, Ellipsis, ExternalLink, Eye, FileText, Fish, Flag, Flame,
  Flashlight, FlashlightOff, Footprints, Hand, House, Images, Info, Leaf, Lightbulb, Lock, MessageCircleMore, MessagesSquare, Minus, Pause, PencilLine,
  PersonStanding, Play, Plus, RefreshCw, Rotate3d, Scale, ScanBarcode, ScanLine, Search, ShieldCheck, ShoppingBag, ShoppingBasket, ShoppingCart,
  Smartphone, Sparkles, Square, SquareCheck, Star, SwitchCamera, Timer, Trash, TrendingDown, Trophy, User, UserPlus, Users, UtensilsCrossed, Video,
  Droplet, X, Zap, Target, Award, Medal, Activity, Sunrise, Sun, Moon, CloudSun, Wind, Wheat, type LucideProps,
} from 'lucide-react-native'

type L = ComponentType<LucideProps>
const I = (Comp: L, filled = false) => ({ Comp, filled })

export const ICONS = {
  add: I(Plus), 'add-circle': I(CirclePlus, true), 'add-circle-outline': I(CirclePlus),
  'alert-circle': I(CircleExclamationPoint), 'alert-circle-outline': I(CircleExclamationPoint), 'information-circle': I(Info),
  'arrow-forward': I(ArrowRight), 'arrow-up': I(ArrowUp), 'arrow-up-circle': I(CircleArrowUp, true),
  'bag-handle-outline': I(ShoppingBag), 'ban-outline': I(Ban), barbell: I(Dumbbell), 'barbell-outline': I(Dumbbell),
  'barcode-outline': I(ScanBarcode), basket: I(ShoppingBasket), 'cart-outline': I(ShoppingCart), body: I(PersonStanding), muscle: I(BicepsFlexed),
  book: I(BookOpen), 'book-outline': I(BookOpen), 'bookmark-outline': I(Bookmark), 'bulb-outline': I(Lightbulb), 'business-outline': I(Building),
  camera: I(Camera), 'camera-outline': I(Camera), 'camera-reverse-outline': I(SwitchCamera), 'images-outline': I(Images), 'videocam-outline': I(Video),
  'chatbubble-ellipses-outline': I(MessageCircleMore), 'chatbubbles-outline': I(MessagesSquare),
  checkmark: I(Check), 'checkmark-circle': I(CircleCheck, true), checkbox: I(SquareCheck, true), 'square-outline': I(Square), 'ellipse-outline': I(Circle),
  'chevron-back': I(ChevronLeft), 'chevron-forward': I(ChevronRight), close: I(X), 'copy-outline': I(Copy), 'create-outline': I(PencilLine),
  'document-text-outline': I(FileText), 'ellipsis-horizontal': I(Ellipsis), 'eye-outline': I(Eye), 'open-outline': I(ExternalLink),
  fish: I(Fish), flag: I(Flag), 'flag-outline': I(Flag), flame: I(Flame), 'flame-outline': I(Flame), leaf: I(Leaf), grain: I(Wheat),
  flash: I(Flashlight), 'flash-outline': I(FlashlightOff), 'walk-outline': I(Footprints), 'hand-left-outline': I(Hand),
  home: I(House), 'home-outline': I(House), 'lock-closed': I(Lock), 'lock-closed-outline': I(Lock),
  people: I(Users), 'people-outline': I(Users), 'person-add-outline': I(UserPlus), 'person-outline': I(User), 'phone-portrait-outline': I(Smartphone),
  play: I(Play), pause: I(Pause), refresh: I(RefreshCw), remove: I(Minus), 'remove-circle': I(CircleMinus, true), 'remove-circle-outline': I(CircleMinus),
  restaurant: I(UtensilsCrossed), 'restaurant-outline': I(UtensilsCrossed), 'scale-outline': I(Scale), scan: I(ScanLine), 'scan-outline': I(ScanLine),
  search: I(Search), 'shield-checkmark': I(ShieldCheck), 'shield-checkmark-outline': I(ShieldCheck), sparkles: I(Sparkles), 'sparkles-outline': I(Sparkles),
  star: I(Star, true), 'star-outline': I(Star), 'sync-outline': I(Rotate3d), 'time-outline': I(Clock), 'timer-outline': I(Timer),
  'trash-outline': I(Trash), 'trending-down': I(TrendingDown), trophy: I(Trophy), 'trophy-outline': I(Trophy), water: I(Droplet), 'water-outline': I(Droplet),
  energy: I(Zap), target: I(Target), award: I(Award), medal: I(Medal), activity: I(Activity),
  sunrise: I(Sunrise), sun: I(Sun), moon: I(Moon), 'cloud-sun': I(CloudSun), breeze: I(Wind),
} satisfies Record<string, { Comp: L; filled: boolean }>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, color = '#0F2440', strokeWidth }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { Comp, filled } = ICONS[name]
  return filled
    ? createElement(Comp, { size, color: '#FFFFFF', fill: color, strokeWidth: strokeWidth ?? 2 })
    : createElement(Comp, { size, color, strokeWidth: strokeWidth ?? 1.9 })
}
