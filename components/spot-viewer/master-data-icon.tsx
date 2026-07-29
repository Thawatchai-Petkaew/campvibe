import { getFacilityIcon } from "@/lib/facility-icon-map";

/**
 * components/spot-viewer/master-data-icon.tsx — CAM-664 (S2)
 *
 * A lowercase-named RENDER FUNCTION (not a component) wrapping
 * `getFacilityIcon`'s code -> lucide lookup — same shape as the
 * pre-existing `getIcon` helper in `CampgroundDetailClient.tsx`
 * (`const IconComponent = getFacilityIcon(code); return <IconComponent
 * .../>`, itself a lowercase local function for the same reason). Kept a
 * plain function (called as `{renderMasterDataIcon(code, className)}`,
 * never `<MasterDataIcon/>`) rather than a real component: assigning
 * `getFacilityIcon`'s return value to a capitalized local INSIDE a
 * component's own render body trips `react-hooks/static-components`
 * ("components created during render") even though every returned icon is
 * itself an already-stable, module-level lucide export — never a value
 * newly constructed per render. `code` is a MasterData facility code or a
 * `Spot.viewType` enum value; both share the same lookup.
 */
export function renderMasterDataIcon(code: string, className: string) {
    const Icon = getFacilityIcon(code);
    return <Icon className={className} aria-hidden="true" />;
}
