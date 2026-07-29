# ADR-014: What a campsite price is charged per — the host chooses the unit (CAM-649)

Status: **PROPOSED** (2026-07-29) · **Epic:** CAM-648 (Pricing unit — the host says whether the price is per person or per site, M1 Listing Truth) · **Story:** CAM-649 (this ADR) · **Depends on:** ADR-002 (money = Decimal + currency), ADR-003 (closed enum vs open MasterData), ADR-005 (Booking snapshot / crystallization)

## Context

### The report

The owner entered a camp at ฿250, booked 3 guests for 1 night, and the total came out ฿250. He expected ฿750.

### It is not a calculation bug

`computeBookingPrice` charges `unitPrice × nights` and multiplies by nothing else. The line is `lib/booking-pricing.ts:104`:

```ts
const subtotalAmount = unitPrice * safeNights;
```

That behaviour is deliberate, central, and tested. `lib/booking-pricing.ts:1` calls itself "single source of truth for booking price math (CAM-58)"; both the detail-page preview (`components/CampgroundDetailClient.tsx:240`) and the write path (`app/api/bookings/route.ts:150`) go through it, which is why the displayed total and the recorded total agree. The seed even states the absence of a guest multiplier as an invariant it is mirroring — `prisma/seed-bookings.ts:124`:

```ts
const totalPrice = unitPrice * nights; // mirror API price math (no guests multiplier) so unit*nights === total
```

The arithmetic is doing exactly what it was built to do.

### The actual gap: nobody ever wrote down what the price is *charged per*

**No document in this repo states the unit of `CampSite.priceLow`.** The column carries a classification tag and nothing else — `prisma/schema.prisma:302`:

```prisma
priceLow      Decimal? @db.Decimal(12, 2) // [Financial]
```

`Spot.pricePerSite` (`prisma/schema.prisma:447`) is the same: `// [Financial]`, no unit. Meanwhile `extraFeeAmount`, added to `CampSite` two lines below `priceLow` by CAM-268 (`prisma/schema.prisma:315`), got its semantics spelled out in the schema comment ("ONE-TIME-per-stay additive charge") **and** in host-facing helper copy in both languages — `locales/translations.json:318` "Charged once per stay, not per night" / `:1457` `เก็บครั้งเดียวต่อการเข้าพัก ไม่ใช่ต่อคืน`.

So the field that determines every total on the platform is the one field nobody documented, while the optional fee sitting next to it got two languages of explanation. The owner's ฿250 was not a miscalculation of a known rule; it was a guess at an unstated one.

### The lineage is code, not a decision

`unitPrice × nights` was never chosen. It pre-existed CAM-58; CAM-58 (whose actual subject was removing fake fee rows) extracted it into `lib/booking-pricing.ts` and froze it as "the single source of truth"; CAM-268 inherited it unexamined while adding `extraFeeAmount` around it; and CAM-643 cited the module as authority today. At no point did anyone decide the unit. **Extraction into a shared module is not ratification** — it made an accident load-bearing.

### The only two artifacts that state a unit both say *per person*

- **The owner's own prototype.** `docs/research/ai-chat/chat-prototype.html:912` computes `const total=camp.price*bk.people*(bk.nights||1)+bk.fee+sfee;` — with `bk.people` in the multiplication. Its receipt row (`:918`) reads `${bk.people} คน × ฿${THB(camp.price)}`, and four separate captions label the price `/คน/คืน` (`:738`, `:786`, `:853`, `:1419`).
- **The AI research corpus.** `docs/research/ai-chat/campvibe-conversation-to-booking-research.md:142` describes the price camper segments reason about as `ราคาต่อหัว`. `docs/research/ai-chat/campvibe-schema-gap-analysis.md` records `ไม่มีราคาเด็ก` **twice** as a known schema gap (`:38` P8 กลุ่มผสม, `:44` P14 นโยบาย/เงิน) — and a child price is a meaningless concept unless the price is per person.

Nothing in the repo argues for per-site. The code does per-site by inheritance; the design artifacts assume per-person.

### Owner decision, 2026-07-29

**The host chooses the unit.** Not the platform, not a global constant. Different Thai camps genuinely charge differently — per head, per tent pitched, or a flat rate for the pitch — and the platform's job is to let a host state which one they mean, not to pick for them.

### Load-bearing facts about where the unit can live (all grepped 2026-07-29, not recalled)

**1. No client sends `spotId` to `POST /api/bookings`.** The only POST in the app is `components/CampgroundDetailClient.tsx:445-455`, and its body is exactly `{ campSiteId, checkInDate, checkOutDate, guests, source? }`. The same component says so about itself at `:231`: *"No spot-selection state in this component — spotPricePerNight is null (uses priceLow)."* Consequently `resolveUnitPrice` (`lib/booking-pricing.ts:35-46`) always falls through its spot branch to the `campSitePriceLow` branch, and `Spot.pricePerNight` is, in the booking path, as unread as `pricePerSite`.

> **Therefore the unit must live at camp level to change anything.** A spot-level-only unit would be correct-looking and completely inert.

**2. `Spot.pricePerSite` is write-only.** Grepped across `app/ lib/ components/ types/ __tests__/ e2e/` — every reference writes, validates, types, or round-trips it through a form, and **not one reads it to compute or display a price**: `app/api/campsites/[id]/spots/route.ts:90` (create), `app/api/campsites/[id]/spots/[spotId]/route.ts:102` (update), `lib/validations/spot.ts:33` (zod), `components/spot-form-dialog.tsx:74/111/238/454-457` (form state + label), `types/api.ts`, `__tests__/cam-615-clearable-fields.test.ts`. Its 481 populated staging rows were generated, not entered by hosts — `scripts/gen-mock-data.mjs:458-459` fabricates it on ~65% of paid spots. And its own spec defines it as something that is not a unit at all: `docs/mock-data-generation-spec.md:252` — `ราคาเหมาทั้งจุด (ถ้ามี)`, a **whole-pitch buyout offer**, i.e. a rate plan. The matching product gap is already named elsewhere: `docs/research/ai-chat/campvibe-schema-gap-analysis.md:59` records `เหมาโซน (Zone มีแต่ไม่มี bookable-as-whole flag)`.

**3. `PER_TENT` is evidenced, not speculative.** Hosts already express per-tent pricing in free text — `docs/mock-data-generation-spec.md:347` carries `"feeInfo": "ค่าพื้นที่กางเต็นท์ 500 บาทต่อหลัง ..."` — and the quantity it would multiply already exists as Pixels: `Spot.maxTents` (`prisma/schema.prisma:444`) and `CampSite.maxTentsPerDay` (`:291`).

**4. Postgres can add an enum value but cannot drop one.** `ALTER TYPE ... ADD VALUE` exists; there is no `DROP VALUE`. This repo's own migration set proves the shape of the constraint: `prisma/migrations/20260704163511_image_kind_panorama/down.sql` can roll back cleanly **only because** its `CREATE TYPE "ImageKind"` lives in the same migration's `migration.sql`, so the down script drops the column and then `DROP TYPE "ImageKind"` wholesale. A value added to a type created in an *earlier* migration has no such escape.

## Decision

### 1. `PricingUnit` is a closed Prisma enum with **three** values, created in ONE migration

```prisma
enum PricingUnit {
  PER_PERSON
  PER_TENT
  PER_SITE
}
```

Closed enum rather than `MasterData`, per ADR-003: this is a logic-bearing state that drives money arithmetic and gets crystallized onto a financial document — exactly the class ADR-003 assigns to a Prisma enum ("a typo'd value is a bug"), not the ops-extensible taxonomy class.

**Three values now, even though only two are exposed — and this is the strongest argument in this ADR.** Once `Booking` carries a crystallized `[Financial]` column of this type (§4, per ADR-005), the enum type is effectively permanent. Postgres has `ALTER TYPE ... ADD VALUE` and **no `DROP VALUE`**, so a value added in a later migration can never be removed by an honest `down.sql` — that migration would be documented as reversible and not be. The `image_kind_panorama` precedent above is the proof: it rolls back only because `CREATE TYPE` and the column live in the same migration. Creating all three values in the same migration that creates the columns keeps the whole change dropable as one unit. `PER_TENT` costs roughly 15 lines today and is evidenced by real host free-text (Context fact 3); adding it in six months costs an irreversible migration.

**Only `PER_PERSON` and `PER_SITE` are exposed at the zod boundary for now.** `PER_TENT` exists in the database and is rejected by `lib/validations/*` until a story ships the tent-quantity capture the camper flow does not have today (`POST /api/bookings` sends `guests`, never a tent count). See Consequences.

### 2. Column default `PER_SITE`; **form** default `PER_PERSON`

Add to both `CampSite` and `Spot`:

```prisma
pricingUnit PricingUnit @default(PER_SITE) // [Financial] the unit `priceLow` / `pricePerNight` is charged per
```

- **The column default is `PER_SITE` so the migration moves no money on any existing row.** Today's math *is* per-site: `unitPrice × nights`, no party-size factor. Backfilling every existing row to `PER_SITE` therefore asserts nothing false — it records what those rows have always been charged as. Every existing total stays byte-identical.
- **The form default for a NEW camp is `PER_PERSON`, deliberately different from the column default.** The next host who types ฿250 gets the total the owner expected, instead of walking into the same unstated rule. The two defaults answer two different questions: the column answers "what were the historical rows charged as?" (per site), the form answers "what does a host most likely mean?" (per person, per both artifacts in Context).

### 3. The unit travels **with** the price

`resolveUnitPrice` changes its return type from a bare number to a carrier:

```ts
{ unitPrice: number; unit: PricingUnit; source: 'spot' | 'campSite' | 'fallback' }
```

Two independent lookups — one for the amount, one for the unit — would eventually pair one row's price with another row's unit, and the detail page is already the place where that happens: it renders a spot's `pricePerNight` (`components/CampgroundDetailClient.tsx:996`) and the camp's `priceLow` (`:1337`) on one screen. `source` is kept because the existing function already has three branches (spot / camp / hardcoded ฿50 fallback at `lib/booking-pricing.ts:45`) and a caller that shows a unit label must not label the fallback as a host's choice.

`computeBookingPrice` takes the unit plus a quantity and multiplies:

| unit | multiplier | quantity source |
|---|---|---|
| `PER_SITE` | `unitPrice × nights` | — (unchanged from today) |
| `PER_PERSON` | `unitPrice × nights × guests` | the `guests` the POST body already sends |
| `PER_TENT` | `unitPrice × nights × tents` | **does not exist yet** — gated, see §1 |

`extraFeeAmount` is untouched: it remains added once per stay, never multiplied by nights and never by the party (`locales/translations.json:318`/`:1457` already promise that in two languages, and this ADR does not break that promise).

### 4. `Booking.snapshotPricingUnit` + `Booking.snapshotQuantity`, nullable, **never backfilled**

```prisma
snapshotPricingUnit PricingUnit? // [Financial] the unit in force when this booking was made; NULL = booked before CAM-648
snapshotQuantity    Int?         // [Financial] the multiplier actually applied (guests / tents); NULL = booked before CAM-648
```

Per ADR-005, a booking is a financial document and the values that determine what is owed are frozen onto it. The unit determines the total, so it is crystallized alongside the amounts already there.

**These are not backfilled, and the NULL is the honest answer.** Writing `PER_SITE` onto a pre-existing booking would assert that a host chose per-site pricing for that stay. No host chose anything — the field did not exist. `NULL` means precisely "booked before the unit was a concept," which is true. ADR-005's immutability rule is unchanged: nothing recomputes a stored booking, and a host later switching their camp to `PER_PERSON` does not touch a single historical row.

### 5. `Spot.pricePerSite` is marked DEPRECATED, not promoted and not backfilled

Per `.claude/rules/api.md` §12 (retiring a field needs a deprecation plan with an ADR link) — the same treatment `Spot.zone` already carries at `prisma/schema.prisma:431-435`:

```prisma
pricePerSite  Decimal?  @db.Decimal(12, 2) // [Financial] DEPRECATED (CAM-649, ADR-014) — a whole-pitch
                                           // BUYOUT rate plan, never a pricing unit. Write-only today:
                                           // no reader computes or displays it. Do NOT add new readers,
                                           // and do NOT read it as if it were `pricingUnit = PER_SITE`.
                                           // Retirement: after the SpotRate design lands (out of scope).
```

It is tempting to read "per site" out of the name and treat 481 populated rows as hosts having already declared a unit. That reading is wrong twice over: the rows are machine-generated (`scripts/gen-mock-data.mjs:458-459`), and the field's own spec calls it `ราคาเหมาทั้งจุด` — a buyout **offer**, which is a rate plan, not a unit. A rate plan and a unit are different kinds of fact: a unit says how to multiply the base price; a buyout says "ignore the base price, pay this instead."

Its real future model is a `SpotRate` child row built from `PricingUnit` + an amount Pixel (ADR-002 pair) — explicitly **out of scope** here, so nobody re-derives it from `pricePerSite`.

### 6. Catalog: sort stays on raw `priceLow`; the filter **band** is translated per unit

- **The sort key and its composite index do not change.** `lib/catalog-cursor.ts:271-280` orders by `priceLow` (with `id` as the keyset tiebreaker), backed by `@@index([isPublished, deletedAt, priceLow, id])` at `prisma/schema.prisma:381`. "Cheapest first" is **undefined without a party size** — ฿250 per person is cheaper than ฿900 per site for a solo camper and more expensive for four. Sorting cannot ask the camper a question, so it sorts the stored number and the UI labels the unit per card.
- **A normalised "comparable price" column is refused.** It would be a `[Financial]` Pixel with no derivation from source Pixels — the missing input (party size) lives with the camper, not the camp — which `.claude/rules/architecture.md:133` forbids outright ("if you cannot point to the source Pixel = the design is wrong").
- **The filter band IS translated**, because there the camper has already told us the party size. `lib/campsite-filters.ts:164-167` applies `min`/`max` directly to `where.priceLow`, and `:178-183` already parses the `guests` param for the capacity filter. When `guests` is present, a `PER_PERSON` camp's band comparison divides by `guests` (or equivalently multiplies the band), so a camper filtering "≤ ฿1,000 for 4 people" sees a ฿200-per-person camp. When `guests` is absent, the band applies to the raw column as it does today.

## Alternatives

### (a) Two enum values now (`PER_PERSON | PER_SITE`), add `PER_TENT` when a story needs it

**Rejected — the `DROP VALUE` trap.** Postgres offers `ALTER TYPE ... ADD VALUE` and no `DROP VALUE`. The moment `Booking.snapshotPricingUnit` exists, the type is pinned by a crystallized `[Financial]` column; a later migration adding `PER_TENT` could never ship an honest `down.sql`, because dropping the value is not a supported operation and dropping the type is impossible while the booking column references it. `.claude/rules/api.md` §6 and `.claude/rules/ops.md` §4 both require every migration to be reversible and tested up→down→up — this alternative guarantees one that cannot be. The saved ~15 lines buy a permanently irreversible follow-up.

### (b) Backfill `Spot.pricePerSite` into the model as an existing per-site declaration

**Rejected — it moves real money on 481 staging rows on the strength of generated mock data.** The rows came from `scripts/gen-mock-data.mjs:458-459`, not from hosts, and the field is specified as a buyout rate plan (`docs/mock-data-generation-spec.md:252`), not a unit. Treating a generated buyout figure as a host's pricing declaration would change totals for camps whose hosts never said anything at all.

### (c) A normalised comparable-price column (e.g. `priceLowPerPerson`) for sorting and filtering

**Rejected — no derivation.** It would be a stored `[Financial]` value that cannot be recomputed from source Pixels, because the missing input is the camper's party size, not anything the camp knows. That is precisely the cached-aggregate-as-second-source-of-truth anti-pattern in `.claude/rules/architecture.md:133`, and ADR-002 already refused the analogous move for FX ("the converted value is never persisted as the price").

### (d) Leave pricing per-site and fix only the labels

**Rejected — it contradicts the owner's 2026-07-29 decision, and it contradicts his own design artifacts.** A label saying `ต่อจุด` would make the ฿250 total correct-looking and still wrong: the prototype he wrote multiplies by `bk.people` (`chat-prototype.html:912`) and labels the price `/คน/คืน` four times, and the research corpus assumes `ราคาต่อหัว` with a child-price gap logged twice. Labelling would freeze the accident described in Context and call it a decision.

## Consequences

### Stated plainly

- **Until a host opts in, nothing changes for anyone — including the owner's own reported case.** Every existing camp lands on the `PER_SITE` column default, so 3 guests × 1 night × ฿250 still totals ฿250 on that camp until its host changes the setting. This ADR does not fix the reported number; it makes the number explainable and makes the host able to change it. That is the whole scope. The follow-up story that surfaces the field to existing hosts is what will actually move totals.
- **`PER_TENT` will exist in the database and not in the product.** It is created by the migration (§1) and rejected by the zod boundary in `lib/validations/*` (camp and spot schemas), because `POST /api/bookings` sends `guests` and has no tent count to multiply by (`components/CampgroundDetailClient.tsx:445-455`). Anyone reading the Prisma enum will see a third value that no form can produce. That is intentional and is written down here so it does not read as a bug: the gate is the zod schema, not the database.
- **Whole-pitch buyout (`เหมาโซน` / `ราคาเหมาทั้งจุด`) is out of scope.** Its future home is a `SpotRate` child model composed of `PricingUnit` + an ADR-002 amount pair, not `Spot.pricePerSite` and not a fourth enum value. The gap is already logged at `campvibe-schema-gap-analysis.md:59`.

### Positive

- The unit becomes a queryable Pixel with a classification tag instead of an unwritten convention, so the AI assistant, the catalog, and the host form all read the same fact from one place.
- The migration moves no money: additive columns with defaults, no backfill, no recomputation of any existing booking (ADR-005 immutability intact).
- The enum is dropable in one reversible migration for as long as it needs to be, because all three values ship together with the columns.
- The unit travelling with the price (§3) makes the price/unit mismatch on the detail page structurally impossible rather than merely unlikely.

### Negative / risks

- **Every consumer of a price string becomes a consumer of a unit.** Any surface showing a price without its unit is now actively misleading in a way it was not before, because units will differ between camps. The reader/writer sweep required by `.claude/rules/architecture.md` §15b must enumerate every price display (detail page `:996` and `:1337`, catalog cards, AI chat cards via `components/ai-chat/booking-view.ts` and `AiChatDetailCard.tsx:278`, booking confirmation, host forms) and tag each NOW/LATER/NO-CHANGE before the build story ships.
- `resolveUnitPrice`'s return type changes from `number` to an object — a compile-breaking change across its call sites (`app/api/bookings/route.ts:134`, `components/CampgroundDetailClient.tsx:232`, `components/ai-chat/AiChatDetailCard.tsx:278`, plus the mock in `__tests__/cam-355-per-spot-capacity-enforcement.test.ts:64`). Bounded and compiler-caught, but real.
- Catalog "cheapest first" remains a mixed-unit sort (§6) and will look wrong to some campers. This is accepted rather than solved, because solving it means inventing a party size the camper has not given.
- Two different defaults (column `PER_SITE`, form `PER_PERSON`) is a deliberate asymmetry that will look like a bug to a future reader. It is documented in §2 and should carry a code comment at both sites.

## Confirmation

The decision is violated if any of these stop holding; each is machine-checkable and belongs in the build story's test matrix (CAM-648 follow-up):

1. `grep -c "PER_TENT" prisma/migrations/*_pricing_unit/migration.sql` ≥ 1 — all three values ship in the migration that creates the columns.
2. The corresponding `down.sql` contains `DROP TYPE "PricingUnit"` and the up→down→up cycle passes on the local dev DB.
3. A test asserts a `PricingUnit` column default of `PER_SITE` and a form/zod default of `PER_PERSON` — the asymmetry is intentional, so a test must fail if someone "fixes" it.
4. A test asserts `PER_TENT` is rejected by the camp and spot zod schemas while accepted by Prisma.
5. A test asserts a Booking created before the change (both snapshot columns `NULL`) is never rewritten by a later host unit change (ADR-005 immutability).
6. `grep -rn "pricePerSite" app lib components` finds no **read** consumer of `pricePerSite` in any price computation or display.

## Open trade-offs — for the human at G2

1. **Exposing `PER_TENT` at the boundary.** This ADR gates it because no client sends a tent count. Enabling it needs a tent-quantity field in the booking flow — a separate story with its own AC. Confirm the gate is acceptable rather than shipping a half-usable third option.
2. **Spot-level `pricingUnit`.** §2 adds the column to `Spot` as well as `CampSite` for symmetry, but Context fact 1 shows the spot price is unreachable from the only booking client that exists. The column is inert until spot selection ships. The alternative — camp-level only, add `Spot.pricingUnit` when spot booking lands — avoids an inert column at the cost of a second migration on a `[Financial]` enum. Recommendation: **ship both now**, because the second migration would be the one that cannot be honestly reversed once bookings snapshot the type.
3. **Migrating an existing host who meant per-person all along.** Some current camps were priced by hosts thinking per head. This ADR cannot detect that and deliberately does not guess: they land on `PER_SITE` and must change it themselves. If the owner wants an outreach/prompt flow ("confirm what your ฿X means"), that is a product story, not a data-model one.

## Links

- `ADR-002-money-decimal-currency.md` — money is a Decimal amount + ISO-4217 currency Pixel pair; the unit is a third Pixel beside them, never folded into a string.
- `ADR-003-enum-vs-masterdata.md` — closed, logic-bearing sets are Prisma enums; the boundary is the commitment (why `PricingUnit` is not `MasterData`).
- `ADR-005-booking-snapshot.md` — crystallization: the unit and quantity that determined the total are frozen onto the Booking; host edits never mutate an existing booking.
- `ADR-012-hostos-data-model.md` — `QuoteLine.unitAmount` sources from `Spot.pricePerNight`/`CampSite.priceLow`; a future quote line must carry the unit too.
- `.claude/rules/architecture.md` §11 (classification), §12/`:133` (compute-on-the-fly — why no normalised price column), §13 (crystallization), §15b (reader/writer sweep required before build).
- `.claude/rules/api.md` §6 (reversible migrations), §12 (deprecation plan for `pricePerSite`).
- Verified reuse points (grepped 2026-07-29, not recalled): `lib/booking-pricing.ts:35-46,104` · `app/api/bookings/route.ts:134,150` · `components/CampgroundDetailClient.tsx:231,240,445-455,996,1337` · `lib/campsite-filters.ts:164-167,178-183` · `lib/catalog-cursor.ts:271-280` · `prisma/schema.prisma:291,302,315,381,431-435,444,447` · `prisma/migrations/20260704163511_image_kind_panorama/{migration,down}.sql` · `prisma/seed-bookings.ts:124` · `scripts/gen-mock-data.mjs:458-459` · `locales/translations.json:318,1457` · `docs/mock-data-generation-spec.md:252,347` · `docs/research/ai-chat/chat-prototype.html:738,786,853,912,918,1419` · `docs/research/ai-chat/campvibe-conversation-to-booking-research.md:142` · `docs/research/ai-chat/campvibe-schema-gap-analysis.md:38,44,59`
