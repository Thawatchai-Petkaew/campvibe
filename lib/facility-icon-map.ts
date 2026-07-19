/**
 * lib/facility-icon-map.ts — CAM-450
 *
 * Shared code -> lucide icon lookup for a MasterData amenity/facility/activity
 * code. Extracted from `components/CampgroundDetailClient.tsx`'s own
 * `facilityIconMap` (~L470-537) so the AI-chat detail drawer (CAM-450) can
 * reuse the SAME icon-per-code treatment instead of re-guessing icons per
 * component (code.md "reuse before create" — CAM-220/221 already named
 * re-implementation as this codebase's #1 UI-drift source). The camp detail
 * page itself is left untouched by this story (out of surface); a follow-up
 * cleanup can point it at this shared map too.
 */
import {
  Anchor,
  Armchair,
  Bath,
  Car,
  Coffee,
  Droplets,
  Fish,
  type LucideIcon,
  Home,
  Layers,
  Mountain,
  Music,
  ShieldCheck,
  ShoppingBasket,
  ShowerHead,
  Snowflake,
  Store,
  Table,
  Tent,
  Trash2,
  Truck,
  Umbrella,
  Utensils,
  Waves,
  Wifi,
  Wind,
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
  '711': Store,
  BOAT: Anchor,
  FISH: Fish,
  SWIM: Waves,
  HIKG: Mountain,
  HIKE: Mountain,
  LIVE: Music,
  OFFR: Truck,
  RV: Car,
  DRIV: Car,
  WALK: Mountain,
  BAOT: Anchor,
  FOREST: Mountain,
  FORE: Mountain,
  LAKE: Waves,
  MOUNTAIN: Mountain,
  MOUN: Mountain,
  BEACH: Waves,
  BEAC: Waves,
  RIVE: Waves,
  FEDW: Droplets,
  FEIC: Snowflake,
  GRIL: Utensils,
  SANI: Trash2,
  SHTR: ShieldCheck,
  SINK: Droplets,
  TRAS: Trash2,
  WATE: Droplets,
  MIMT: Store,
  PICN: Table,
  SVEL: Store,
  TENT: Tent,
  MATT: Layers,
  CHAI: Armchair,
  FYST: Umbrella,
  ICBK: Snowflake,
  LEDL: Zap,
  STOV: Utensils,
  BLANKET: Home,
  BLKT: Home,
  GDST: Layers,
  LSTV: Utensils,
  SSTV: Utensils,
  POWE: Zap,
  TFAN: Wind,
};

/** Falls back to `ShieldCheck` for any code not in the map (a generic "amenity" glyph). */
export function getFacilityIcon(code: string): LucideIcon {
  return FACILITY_ICON_MAP[code] ?? ShieldCheck;
}
