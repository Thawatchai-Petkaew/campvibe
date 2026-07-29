/**
 * lib/facility-icon-map.ts — CAM-450, unified CAM-525 (S9)
 *
 * The SINGLE source of truth for MasterData code -> lucide icon lookup.
 * Originally extracted from `components/CampgroundDetailClient.tsx`'s own
 * `facilityIconMap` (CAM-450) so the AI-chat detail drawer could reuse the
 * same icon-per-code treatment instead of re-guessing icons per component
 * (code.md "reuse before create" — CAM-220/221 already named
 * re-implementation as this codebase's #1 UI-drift source).
 *
 * CAM-525 (S9) finishes that unification: the camp detail page's inline copy
 * is gone (it now imports `getFacilityIcon` from here) and the drifted gaps
 * are closed — Campground type (CAGD/CACP/GLAMP/VIEW), POTA (had the wrong
 * fallback icon on both maps), MTNS (rendered with a raw code because the
 * locale carried the phantom key `MOUN` instead), and the 5 Activity codes
 * (HIKI/SURF/WILD/HORS/CLIM) the CAM-528 Activity section will need the
 * moment it ships. Every code below is verified against the seeded
 * MasterData rows in `prisma/seed.ts` — see
 * `__tests__/cam-525-icon-i18n-coverage.test.ts` for the enforced coverage.
 */
import {
  Accessibility,
  AlignHorizontalJustifyCenter,
  Anchor,
  Armchair,
  Bath,
  Bed,
  Binoculars,
  Box,
  CalendarCheck,
  Car,
  Coffee,
  CornerDownLeft,
  Droplet,
  Droplets,
  Dumbbell,
  Eye,
  Fan,
  Fish,
  Flame,
  Flower2,
  Footprints,
  GlassWater,
  type LucideIcon,
  Hand,
  HelpCircle,
  Home,
  Lamp,
  Layers,
  Lightbulb,
  Logs,
  Mountain,
  MoveRight,
  Music,
  Palmtree,
  PawPrint,
  Plug,
  Sailboat,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  ShowerHead,
  Signal,
  Snowflake,
  Sparkles,
  Store,
  Table,
  Table2,
  Tent,
  ThermometerSun,
  Trash,
  Trash2,
  Trees,
  TrendingUp,
  Truck,
  Umbrella,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wheat,
  Wifi,
  Wind,
  Wine,
  Zap,
} from 'lucide-react';

export const FACILITY_ICON_MAP: Record<string, LucideIcon> = {
  WIFI: Wifi,
  ELEC: Zap,
  TOIL: Bath,
  SHOW: ShowerHead,
  CAFE: Coffee,
  REST: Utensils,
  CART: ShoppingBasket,
  LOTS: Store,
  MIBC: Store,
  MAKT: Store,
  SVEL: Store,
  BOAT: Anchor,
  FISH: Fish,
  SWIM: Waves,
  HIKE: Mountain,
  LIVE: Music,
  OFFR: Truck,
  DRIV: Car,
  WALK: Mountain,
  BAOT: Anchor,
  FORE: Mountain,
  LAKE: Waves,
  BEAC: Waves,
  RIVE: Waves,
  // CAM-513 (S1) — 8 new Terrain codes
  SEA: Sailboat,
  COAS: Anchor,
  WATF: Droplets,
  SWMH: Droplet,
  FILD: Flower2,
  CAVE: Mountain,
  FARM: Wheat,
  // CAM-514 (S2) — 2 new comfort Facility codes
  HOTW: ThermometerSun,
  LIGT: Lamp,
  FEDW: Droplets,
  FEIC: Snowflake,
  GRIL: Utensils,
  SANI: Trash2,
  SINK: Droplets,
  TRAS: Trash2,
  WATE: Droplets,
  MIMT: Store,
  PICN: Table,
  TENT: Tent,
  CHAI: Armchair,
  FYST: Umbrella,
  ICBK: Snowflake,
  LEDL: Zap,
  BLKT: Home,
  GDST: Layers,
  LSTV: Utensils,
  SSTV: Utensils,
  POWE: Zap,
  TFAN: Wind,
  // CAM-515 (S3) — Annotated features, the FIRST new MasterData group
  ALCO: Wine,
  FIRE: Flame,
  FIWD: Logs,
  ADAA: Accessibility,
  RESV: CalendarCheck,
  // CAM-516 (S4) — Camper style, the SECOND new MasterData group
  CHIC: Sparkles,
  GENR: Users,
  DIFT: TrendingUp,
  IDMT: Dumbbell,
  // CAM-521 (S8) — final taxonomy slice, 3 NEW MasterData groups (host-input +
  // camper-detail-display only, NOT searchable — see BR-4)
  SAIS: Signal,
  SDTC: Signal,
  STRU: Signal,
  YUSF: Hand,
  OWNE: UserCheck,
  BACK: CornerDownLeft,
  PARA: AlignHorizontalJustifyCenter,
  PTHG: MoveRight,
  // CAM-525 (S9) — Campground type (CAGD/CACP/GLAMP/VIEW, the detail page's
  // scalar campSiteType field) + POTA (wrong fallback icon on both maps) +
  // MTNS (rendered raw — the locale carried the phantom key `MOUN`) + the
  // 5 Activity codes CAM-528's detail section will need.
  CAGD: Tent,
  CACP: Car,
  GLAMP: Sparkles,
  VIEW: Eye,
  POTA: Droplets,
  MTNS: Mountain,
  HIKI: Mountain,
  SURF: Waves,
  WILD: Binoculars,
  HORS: PawPrint,
  CLIM: Mountain,
  // CAM-526 (S10) — Accommodation type, the 4 codes that never collided.
  // Reuses icons already imported for other codes; no new import added.
  CABI: Bed,
  DISP: Trees,
  GROU: Users,
  RECR: Car,
  // CAM-536 (fix) — Accommodation type: TSIT replaces the old TENT member
  // that collided with the Equipment code above (TENT stays owned by that
  // group, unchanged). Reuses the SAME icon already imported/used for TENT
  // above — no new import. (CAM-538 dropped the sibling HCMP member
  // entirely — no icon entry needed.)
  TSIT: Tent,
  // CAM-664 (S2) — `Spot.viewType`, a real Prisma ENUM (not a MasterData
  // row, so it never appeared in prisma/seed.ts's masterData array or the
  // CAM-525 coverage sweep). Keyed by the enum's own literal values
  // (GENERAL/RIVER/MOUNTAIN/LAKE/FOREST/BEACH) — a DIFFERENT key space from
  // the 4-letter Terrain MasterData codes above (RIVE/FORE/BEAC/MTNS), so
  // there is no collision except LAKE, which already exists above (the
  // Terrain code IS the full word) and is intentionally left as-is. All 4
  // new icons below reuse an already-imported glyph — no new import.
  GENERAL: Eye,
  RIVER: Waves,
  MOUNTAIN: Mountain,
  FOREST: Trees,
  BEACH: Waves,
};

/** Falls back to `ShieldCheck` for any code not in the map (a generic "amenity" glyph). */
export function getFacilityIcon(code: string): LucideIcon {
  return FACILITY_ICON_MAP[code] ?? ShieldCheck;
}

/**
 * CAM-525 (S9) — a small, explicitly-named lookup for `MasterData.icon`
 * (a lucide icon NAME, e.g. "ShowerHead" — see `prisma/seed.ts`'s `icon:`
 * field), consumed by `CampgroundForm.tsx` to render each option's icon.
 * This replaces the form's `import * as LucideIcons from "lucide-react"`
 * wildcard (the CAM-200 regression class: ~1400 icons into the client
 * bundle) with a closed, named set — every name here is one actually used
 * by a seeded MasterData row.
 */
export const ICON_BY_NAME: Record<string, LucideIcon> = {
  Accessibility,
  AlignHorizontalJustifyCenter,
  Anchor,
  Armchair,
  Bath,
  Bed,
  Binoculars,
  Box,
  CalendarCheck,
  Car,
  Coffee,
  CornerDownLeft,
  Droplet,
  Droplets,
  Dumbbell,
  Eye,
  Fan,
  Fish,
  Flame,
  Flower2,
  Footprints,
  GlassWater,
  Hand,
  Lamp,
  Layers,
  Lightbulb,
  Logs,
  Mountain,
  MoveRight,
  Music,
  Palmtree,
  PawPrint,
  Plug,
  Sailboat,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  ShowerHead,
  Signal,
  Snowflake,
  Sparkles,
  Store,
  Table2,
  Tent,
  ThermometerSun,
  Trash,
  Trash2,
  Trees,
  TrendingUp,
  Umbrella,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wheat,
  Wifi,
  Wine,
  Zap,
};

/** Falls back to `HelpCircle` for any icon name not in the map (matches the form's old wildcard fallback). */
export function getIconByName(name?: string | null): LucideIcon {
  return (name && ICON_BY_NAME[name]) || HelpCircle;
}
