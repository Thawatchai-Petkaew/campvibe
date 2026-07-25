# Master Data & CampSite structure — reference

Generated from the live DB + `prisma/schema.prisma` (2026-07-26). The canonical "what data exists" reference for the `/ai-chat-improve` MAP step (existing-data-first). A camp's searchable characteristics live in **two places**: the `MasterData` codes attached via the `options` many-to-many, and scalar columns on `CampSite`.

## 1. MasterData factors — 52 codes across 7 groups

Each row is one `MasterData` record (`code` · `nameTh` · `nameEn` · `icon`). The **AI filter** column shows the `searchCampsites` argument that filters on that group (— = not exposed to the assistant yet).

### Access type — 4 · AI filter: `access`
| code | ไทย | English | icon |
|---|---|---|---|
| BAOT | เรือ | boat | Anchor |
| DRIV | ขับรถ | drive | Car |
| HIKE | ไต่เขา | hike | Mountain |
| WALK | เดิน | walk | Footprints |

### Activity — 10 · AI filter: `activities`
| code | ไทย | English | icon |
|---|---|---|---|
| BOAT | พายเรือ | Boating | Anchor |
| CLIM | ปีนเขา | Climbing | Mountain |
| FISH | ตกปลา | Fishing | Fish |
| HIKI | เดินเล่น | Hiking | Mountain |
| HORS | ขี่ม้า | Horseback riding | PawPrint |
| LIVE | ดนตรีสด | Live music | Music |
| OFFR | เส้นทางออฟโรด | Off-roading (OHV) | Car |
| SURF | เล่นเซิร์ฟ | Surfing | Waves |
| SWIM | ว่ายน้ำ | Swimming | Waves |
| WILD | ส่องสัตว์ป่า | Wildlife watching | Binoculars |

### Campground type — 2 · AI filter: `type`
| code | ไทย | English | icon |
|---|---|---|---|
| CACP | รถเต็นท์ | Car camp | Car |
| CAGD | ลานกางกับพื้น | Campground | Tent |

### Equipment for rent — 11 · AI filter: `equipment` (added CAM-511)
| code | ไทย | English | icon |
|---|---|---|---|
| BLKT | ผ้าห่ม | Blanket | Bed |
| CHAI | เก้าอี้ | Chair | Armchair |
| FYST | ผ้าฟลายชีท | Fly sheet | Umbrella |
| GDST | ผ้าปูรองเต็นท์ | Ground sheet | Layers |
| ICBK | กระติกน้ำแข็ง | Ice bucket | Box |
| LEDL | หลอดไฟ Led | LED light | Lightbulb |
| LSTV | เตาถ่าน ขนาดใหญ่ | Large stove | Flame |
| POWE | ปลั๊กสนาม | Power plug | Plug |
| SSTV | เตาถ่าน ขนาดเล็ก | Small stove | Flame |
| TENT | เต็นท์ | Tent | Tent |
| TFAN | พัดลม | Table fan | Fan |

### Internal facility — 17 · AI filter: `facilities`
| code | ไทย | English | icon |
|---|---|---|---|
| CAFE | คาเฟ่ | Cafe | Coffee |
| CART | รถเข็น | Cart | ShoppingCart |
| ELEC | จุดจ่ายไฟฟ้า | Electric hookups | Zap |
| FEDW | น้ำดื่มฟรี | Free drinking water | GlassWater |
| FEIC | น้ำแข็งฟรี | Free ice | Snowflake |
| GRIL | หมูกระทะ | Grilled pork | UtensilsCrossed |
| MIMT | ร้านขายของชำ | Mini mart | Store |
| PICN | โต๊ะปิคนิค | Picnic table | Table2 |
| POTA | ก๊อกน้ำ | Potable water | Droplets |
| REST | ร้านอาหาร | Restaurant | Utensils |
| SANI | จุดทิ้งสิ่งปฏิกูล | Sanitary dump | Trash |
| SHOW | ห้องอาบน้ำ | Showers | ShowerHead |
| SINK | อ่างล้างจาน | Sink | Utensils |
| TOIL | ห้องน้ำ | Toilet | Bath |
| TRAS | ถังขยะ | Trash | Trash2 |
| WATE | จุดจ่ายน้ำ | Water hookups | Droplet |
| WIFI | ไวไฟ | Wifi | Wifi |

### External facility (nearby) — 4 · AI filter: — (not exposed yet)
| code | ไทย | English | icon |
|---|---|---|---|
| LOTS | โลตัส | Lotus express | ShoppingBag |
| MAKT | ตลาดนัด | Market | ShoppingBasket |
| MIBC | บิ๊กซี | Mini Big C | ShoppingCart |
| SVEL | เซเว่น | 7-Eleven | Store |

### Terrain — 4 · AI filter: `terrain`
| code | ไทย | English | icon |
|---|---|---|---|
| BEAC | ชายหาด | Beach | Palmtree |
| FORE | ป่า | Forest | Trees |
| MTNS | ภูเขา (ล้อมรอบด้วยภูเขา) | Mountainous | Mountain |
| RIVE | แม่น้ำ ลำธาร คลองเล็ก | River, stream, or creek | Waves |

> All seven groups attach to a camp through the same `CampSite.options MasterData[]` m2m. A concept-map/filter therefore just selects codes from these groups.

## 2. CampSite columns

| column | type | note |
|---|---|---|
| id | String (uuid) | PK |
| nameTh / nameEn | String / String? | display name |
| nameThSlug / nameEnSlug | String unique | URL slug |
| description | String? | |
| campSiteType | String | → MasterData `Campground type` (CAGD/CACP) |
| logo | String? | logo URL |
| videoUrl | String? | |
| accommodationTypes | String | CSV of AccommodationTypeEnum (CABI/DISP/GROU/HORS/…) — e.g. glamping/cabin |
| latitude / longitude | Float | geo |
| address / directions | String? | geo |
| checkInTime / checkOutTime | String | |
| bookingMethod | BookingMethod (enum) | |
| feeInfo / toiletInfo | String? | |
| minimumAge | Int? | |
| maxGuestsPerDay / maxTentsPerDay | Int? | capacity |
| groundType | String? (JSON) | `{"GRASS":10,"STONE":5,...}` pitch surface counts |
| phone | String? | PII |
| lineId / facebookUrl / facebookMessageUrl / tiktokUrl | String? | contact/social |
| priceLow / priceHigh | Decimal? | THB (priceCurrency) |
| priceCurrency | String | ISO 4217, default THB |
| extraFeeAmount / extraFeeLabel | Decimal? / String? | one-time additive fee (e.g. ค่าเข้าอุทยาน) |
| cancellationPolicy | CancellationPolicy? (enum) | |
| isVerified / verifiedDate | Boolean / DateTime? | |
| isActive / isPublished / publicDate | Boolean / Boolean / DateTime? | visibility gate (AI only sees isActive+isPublished, not deleted) |
| tags | String? (CSV) | |
| partner / nationalPark | String? | |
| ownershipType | OwnershipType? (enum) | เอกชน / อุทยานแห่งชาติ |
| isFree | Boolean | free-of-charge camp |
| petFriendly | Boolean | → AI filter `petFriendly` |
| useSpotView | Boolean | display mode flag |
| avgRating / reviewCount | Decimal? / Int | public, null rating when 0 reviews |
| createdAt / updatedAt / deletedAt / version | timestamps | deletedAt = soft-delete |
| locationId → location | Location | province/region source (geo) |
| operatorId → operator | User | host/owner |
| **options** | MasterData[] | ⭐ the 7-group m2m above (all searchable factors) |
| spots / zones / reviews / bookings / images / holds / blockedDates / wishlists / teamMembers | relations | |

## 3. The AI search filter surface (`searchCampsites`)

What the assistant can filter on today, mapped to the source above:

| arg | source | notes |
|---|---|---|
| `province` / `region` / `near` | `location` + geo (place-resolver) | exact / regional / proximity |
| `type` | Campground type group | CAGD / CACP |
| `terrain` | Terrain group | BEAC/FORE/RIVE/MTNS (array) |
| `activities` | Activity group | 10 codes (array) |
| `facilities` | Internal facility group | 17 codes (array) |
| `equipment` | Equipment-for-rent group | 11 codes (array, AND — added CAM-511) |
| `access` | Access type group | BAOT/DRIV/HIKE/WALK |
| `petFriendly` | `petFriendly` column | boolean |
| `priceMin` / `priceMax` | `priceLow` / `priceHigh` | THB |
| `keyword` | name/description text | specific camp NAMES only |

**Not yet filterable (gaps):** External-facility (nearby stores), `accommodationTypes` (glamping/cabin), `groundType`, `minimumAge`, `ownershipType`/`nationalPark`, `isFree` — candidates for a future concept-map/filter if the loop surfaces demand (see `data-suggestions.md`).
