// gen-mock-data.mjs — generate themed mock campsites + hosts for staging seed.
//
// Approach (per docs/mock-data-generation-spec.md):
//   mood/theme first → location-plausible data → per-theme image PROMPTS (images generated later by Gemini).
//   Curated: 48 concepts (name + theme + province + coords + tagline + host). Mechanical fields are
//   filled to fit the theme with a SEEDED PRNG (reproducible: same output every run).
//
// Stage 0 (province coverage 10→77, CAM demand-seeding toolkit): the original 48 curated
// concepts only ever covered 10/77 provinces. This adds a SECOND, still-deterministic block
// that emits 2-3 camps for each of the other 67 provinces — a region-appropriate theme (from
// scripts/lib/thai-region-data.mjs), an approximate province-center coordinate (jittered per
// camp so siblings in the same province aren't stacked on one pin), and a shared per-region
// host. The 48 curated concepts are 100% UNCHANGED (same PRNG draw order → same output) so
// re-running this script never perturbs the original 10-province data; the new camps are
// purely additive, numbered AFTER the curated 48 (idx 49+) so slugs can never collide.
//
// Outputs:
//   prisma/data/mock-staging.json        — the data (hosts → campsites → spots + imageManifest)
//   docs/mock-data-image-prompts.md      — consolidated image-gen prompt sheet (take to Gemini)
//
// Run: node scripts/gen-mock-data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROVINCE_CENTER, PROVINCE_REGION } from './lib/thai-region-data.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- seeded PRNG (mulberry32) -------------------------------------------------
let _s = 0x9e3779b9;
function rnd() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const pickN = (a, n) => { const c = [...a]; const out = []; n = Math.min(n, c.length); for (let i = 0; i < n; i++) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };
const round50 = (x) => Math.round(x / 50) * 50;
const round4 = (x) => Math.round(x * 10000) / 10000;

// ---- province reference (the original 10 seeded in thailand-locations.json) ----
// Real, specific zip codes for the curated concepts' named areas (looked up by hand,
// e.g. เขาค้อ=67270 not the generic provincial 67000) — kept exactly as before.
const PROV = {
  Phetchabun:          { th: 'เพชรบูรณ์',   zip: '67270' },
  'Chiang Mai':        { th: 'เชียงใหม่',   zip: '50100' },
  'Chiang Rai':        { th: 'เชียงราย',    zip: '57000' },
  'Mae Hong Son':      { th: 'แม่ฮ่องสอน',  zip: '58000' },
  Loei:                { th: 'เลย',          zip: '42000' },
  'Nakhon Ratchasima': { th: 'นครราชสีมา',  zip: '30130' },
  Krabi:               { th: 'กระบี่',       zip: '81000' },
  Phuket:              { th: 'ภูเก็ต',       zip: '83100' },
  'Surat Thani':       { th: 'สุราษฎร์ธานี', zip: '84250' },
  Trat:                { th: 'ตราด',         zip: '23170' },
};

// ---- Stage 0: all-77-province reference (nameTh/code from the seeded SoT) ------
// thailand-locations.json is the SoT for province nameTh + the 2-digit `code` (which IS
// the real leading digits of every Thai postal code in that province — verified against
// the 10 PROV entries above: Phetchabun 67270/code 67, Chiang Mai 50100/code 50, etc.).
// For the 67 new provinces we don't have a specific named-area zip like the curated set
// does, so `${code}000` is used as an honest, correctly-prefixed APPROXIMATE zip.
const THAILAND_LOCATIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'prisma/data/thailand-locations.json'), 'utf8'));
const LOC_BY_EN = Object.fromEntries(THAILAND_LOCATIONS.map((p) => [p.nameEn, p]));

function provThZip(nameEn) {
  if (PROV[nameEn]) return PROV[nameEn];
  const loc = LOC_BY_EN[nameEn];
  if (!loc) throw new Error(`gen-mock-data: unknown province "${nameEn}" — not in prisma/data/thailand-locations.json`);
  return { th: loc.nameTh, zip: `${loc.code}000` };
}

// ---- theme config (valid codes only, per spec §4/§5) ---------------------------
// CAM-492: every theme now also carries `accomm` (accommodationTypes pool — real
// codes from lib/validations/campsite.ts AccommodationTypeEnum: CABI/DISP/GROU/
// HORS/RECR/TENT, NOT a MasterData group) and enough facExtra/equip/activities/ext
// spread that all 5 previously-dead MasterData codes (WATE/CART/MIMT/LSTV/OFFR)
// get a natural chance of being drawn (a deterministic closing pass below still
// GUARANTEES ≥1 each regardless of luck — see "closeDeadCodes").
const THEMES = {
  mist: {
    label: 'ทะเลหมอกภูเขา', terrain: ['MTNS', 'FORE'], view: 'MOUNTAIN',
    activities: ['HIKI', 'WILD', 'CLIM', 'OFFR'], access: ['DRIV', 'HIKE'],
    facBase: ['TOIL', 'SHOW', 'POTA'], facExtra: ['WIFI', 'CAFE', 'ELEC', 'REST', 'PICN', 'FEDW', 'GRIL', 'MIMT'],
    equip: ['TENT', 'BLKT', 'TFAN', 'LEDL', 'GDST', 'CHAI', 'POWE'], ext: ['SVEL', 'MAKT'],
    ground: ['GRASS', 'STONE', 'WOOD'], tier: [450, 1200], type: ['CAGD', 'CACP'],
    accomm: ['TENT', 'CABI', 'DISP'],
    tags: ['ทะเลหมอก', 'วิวภูเขา', 'อากาศเย็น', 'พระอาทิตย์ขึ้น'],
    desc: 'อากาศหนาวเย็นและทะเลหมอกยามเช้า เหมาะกับสายธรรมชาติที่หลงรักวิวภูเขา',
    scene: 'misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees',
    time: 'golden sunrise with low fog',
  },
  beach: {
    label: 'ริมทะเล/ชายหาด', terrain: ['BEAC'], view: 'BEACH',
    activities: ['SWIM', 'SURF', 'BOAT', 'FISH'], access: ['DRIV', 'BAOT'],
    facBase: ['TOIL', 'SHOW', 'POTA'], facExtra: ['WIFI', 'CAFE', 'REST', 'FEIC', 'SINK', 'GRIL', 'CART'],
    equip: ['TENT', 'FYST', 'CHAI', 'ICBK', 'POWE'], ext: ['SVEL', 'LOTS', 'MIBC'],
    ground: ['GRASS', 'WOOD'], tier: [600, 2000], type: ['CAGD', 'CACP'],
    accomm: ['TENT', 'RECR', 'CABI'],
    tags: ['ริมทะเล', 'วิวทะเล', 'พระอาทิตย์ตก', 'เล่นน้ำทะเล'],
    desc: 'กางเต็นท์ริมหาดฟังเสียงคลื่น ชมพระอาทิตย์ตกเหนือผืนทะเล',
    scene: 'beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water',
    time: 'warm sunset over the sea',
  },
  river: {
    label: 'ริมน้ำ/ลำธาร', terrain: ['RIVE', 'FORE'], view: 'RIVER',
    activities: ['BOAT', 'FISH', 'SWIM', 'HIKI'], access: ['DRIV', 'WALK'],
    facBase: ['TOIL', 'SHOW', 'POTA', 'PICN'], facExtra: ['CAFE', 'WIFI', 'GRIL', 'SINK', 'FEDW', 'WATE'],
    equip: ['TENT', 'GDST', 'CHAI', 'SSTV', 'ICBK', 'FYST', 'LSTV'], ext: ['SVEL', 'MAKT'],
    ground: ['GRASS', 'STONE', 'WOOD'], tier: [350, 900], type: ['CAGD', 'CACP'],
    accomm: ['TENT', 'CABI'],
    tags: ['ริมน้ำ', 'ลำธารใส', 'ร่มรื่น', 'พายเรือ'],
    desc: 'ลานกางเต็นท์ริมลำธารน้ำใส ใต้ร่มไม้ร่มรื่น เสียงน้ำไหลทั้งวัน',
    scene: 'campsite beside a clear shallow stream over smooth rocks, shady riverbank forest',
    time: 'soft morning light through trees',
  },
  forest: {
    label: 'ป่าลึก/ผจญภัย', terrain: ['FORE', 'MTNS'], view: 'FOREST',
    activities: ['HIKI', 'WILD', 'CLIM', 'OFFR'], access: ['DRIV', 'HIKE'],
    facBase: ['TOIL', 'POTA'], facExtra: ['SHOW', 'PICN', 'TRAS', 'SANI', 'FEDW'],
    equip: ['TENT', 'GDST', 'LEDL', 'LSTV'], ext: ['MAKT'],
    ground: ['GRASS', 'WOOD'], tier: [200, 700], type: ['CAGD'],
    accomm: ['TENT', 'DISP', 'GROU'],
    tags: ['ป่าธรรมชาติ', 'ส่องสัตว์ป่า', 'เดินป่า', 'ร่มครึ้ม'],
    desc: 'โอบล้อมด้วยป่าใหญ่ที่อุดมสมบูรณ์ เหมาะกับการเดินป่าและส่องสัตว์',
    scene: 'deep jungle clearing campsite, towering rainforest canopy, morning mist between trees',
    time: 'misty early morning',
  },
  lake: {
    label: 'ริมทะเลสาบ', terrain: ['RIVE', 'FORE'], view: 'LAKE',
    activities: ['BOAT', 'FISH', 'SWIM', 'WILD'], access: ['DRIV', 'BAOT'],
    facBase: ['TOIL', 'SHOW', 'POTA'], facExtra: ['CAFE', 'REST', 'WIFI', 'PICN', 'FEDW', 'WATE', 'CART'],
    equip: ['TENT', 'CHAI', 'ICBK', 'FYST', 'GDST'], ext: ['SVEL'],
    ground: ['GRASS', 'WOOD'], tier: [450, 1300], type: ['CAGD', 'CACP'],
    accomm: ['TENT', 'CABI', 'RECR'],
    tags: ['ริมทะเลสาบ', 'วิวน้ำสงบ', 'บรรยากาศสงบ', 'แพกลางน้ำ'],
    desc: 'ริมทะเลสาบน้ำนิ่งสะท้อนเงาภูเขา บรรยากาศเงียบสงบราวกับต่างแดน',
    scene: 'lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses',
    time: 'still dawn with mist on the water',
  },
  meadow: {
    label: 'ทุ่งหญ้า/ชมดาว', terrain: ['MTNS', 'FORE'], view: 'GENERAL',
    activities: ['HIKI', 'HORS', 'WILD', 'LIVE'], access: ['DRIV'],
    facBase: ['TOIL', 'SHOW', 'POTA'], facExtra: ['CAFE', 'WIFI', 'ELEC', 'REST', 'FEDW', 'GRIL', 'MIMT'],
    equip: ['TENT', 'BLKT', 'CHAI', 'LEDL', 'TFAN', 'POWE'], ext: ['SVEL', 'MAKT'],
    ground: ['GRASS', 'CONCRETE'], tier: [350, 950], type: ['CACP', 'CAGD'],
    accomm: ['TENT', 'GROU', 'HORS'],
    tags: ['ทุ่งหญ้ากว้าง', 'กางเต็นท์ชมดาว', 'วิวเขากว้าง', 'ลมเย็น'],
    desc: 'ลานหญ้ากว้างเปิดโล่งรับลม กลางคืนนอนนับดาวเต็มท้องฟ้า',
    scene: 'wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky',
    time: 'clear starry night',
  },
};

// ---- 48 curated concepts (UNCHANGED — Stage 0 never edits this array) ---------
// th, en, theme, prov, areaTh, coord:[lat,lon], host, tagline; opt: own='NATIONAL_PARK', free=true
const C = [
  // T1 mist mountain (14)
  ['ม่านหมอกภูทับเบิก', 'Phu Thap Boek Mist', 'mist', 'Phetchabun', 'ภูทับเบิก', [16.974, 101.080], 'C3', 'จุดชมทะเลหมอกบนยอดเขาสูงที่สุดของเพชรบูรณ์'],
  ['ระเบียงดาวเขาค้อ', 'Khao Kho Star Terrace', 'mist', 'Phetchabun', 'เขาค้อ', [16.660, 101.040], 'C3', 'ระเบียงไม้ยื่นรับวิวภูเขาและทะเลหมอกเขาค้อ'],
  ['ดอยอ่างขางไฮแลนด์', 'Doi Ang Khang Highland', 'mist', 'Chiang Mai', 'ดอยอ่างขาง', [19.903, 99.045], 'C1', 'ลานบนดอยอากาศหนาวจัด วิวสวนดอกไม้เมืองหนาว'],
  ['ม่อนแจ่มวิวหมอก', 'Mon Jam Mist View', 'mist', 'Chiang Mai', 'ม่อนแจ่ม', [18.910, 98.820], 'C1', 'สันเขาม่อนแจ่มมองเห็นไร่ขั้นบันไดและทะเลหมอก'],
  ['ภูชี้ฟ้าอรุณรุ่ง', 'Phu Chi Fa Sunrise', 'mist', 'Chiang Rai', 'ภูชี้ฟ้า', [19.851, 100.428], 'P3', 'จุดชมพระอาทิตย์ขึ้นเหนือทะเลหมอกชายแดน'],
  ['ดอยแม่สลองหมอกเช้า', 'Doi Mae Salong Morning Mist', 'mist', 'Chiang Rai', 'ดอยแม่สลอง', [20.163, 99.627], 'P3', 'ไร่ชาบนดอยกับสายหมอกบางยามเช้า'],
  ['บ้านรักไทยม่านหมอก', 'Ban Rak Thai Misty', 'mist', 'Mae Hong Son', 'บ้านรักไทย', [19.622, 98.062], 'P2', 'หมู่บ้านชาริมทะเลสาบกลางหุบเขาชายแดน'],
  ['ภูเรือลมหนาว', 'Phu Ruea Cold Breeze', 'mist', 'Loei', 'ภูเรือ', [17.462, 101.350], 'P1', 'ยอดดอยที่หนาวที่สุดแห่งหนึ่งของเมืองไทย'],
  ['ภูป่าเปาะฟูจิเมืองเลย', 'Phu Pa Po Fuji', 'mist', 'Loei', 'ภูป่าเปาะ', [17.250, 101.450], 'P1', 'วิวภูเขาทรงคล้ายฟูจิกับทุ่งหญ้าเชิงเขา'],
  ['ดอยม่อนล้านทะเลหมอก', 'Doi Mon Lan Sea of Mist', 'mist', 'Chiang Mai', 'ม่อนล้าน', [19.080, 98.770], 'C1', 'จุดกางเต็นท์ชมทะเลหมอก 360 องศา'],
  ['ภูลมโลทุ่งหมอก', 'Phu Lom Lo Mist Field', 'mist', 'Phetchabun', 'ภูลมโล', [16.990, 101.150], 'C3', 'ทุ่งดอกนางพญาเสือโคร่งกับสายหมอกบนสันเขา'],
  ['ยอดดอยผาตั้ง', 'Doi Pha Tang Peak', 'mist', 'Chiang Rai', 'ผาตั้ง', [19.950, 100.420], 'P3', 'หน้าผาริมโขงชมหมอกและพระอาทิตย์ขึ้น'],
  ['ม่อนเงาะวิวเขา', 'Mon Ngo Hill View', 'mist', 'Chiang Mai', 'ม่อนเงาะ', [18.900, 98.700], 'C1', 'สันเขาเล็กเงียบสงบ วิวภูเขาสลับซับซ้อน'],
  ['ดอยสุเทพระเบียงเมือง', 'Doi Suthep City Terrace', 'mist', 'Chiang Mai', 'ดอยสุเทพ', [18.805, 98.922], 'I2', 'จุดกางเต็นท์มองเห็นไฟเมืองเชียงใหม่ยามค่ำ'],
  // T6 meadow (8)
  ['ทุ่งกังหันเขาค้อ', 'Khao Kho Windmill Meadow', 'meadow', 'Phetchabun', 'เขาค้อ', [16.640, 101.060], 'C3', 'ลานหญ้ากว้างใต้กังหันลมยักษ์บนเขาค้อ'],
  ['ไร่ดาวลับฟ้าวังน้ำเขียว', 'Wang Nam Khiao Stargaze Farm', 'meadow', 'Nakhon Ratchasima', 'วังน้ำเขียว', [14.450, 101.710], 'C4', 'ไร่บนเนินอากาศดีที่สุดของอีสาน เหมาะนอนดูดาว'],
  ['ทุ่งหญ้าภูสวนทราย', 'Phu Suan Sai Meadow', 'meadow', 'Loei', 'ภูสวนทราย', [17.560, 100.980], 'P1', 'ทุ่งหญ้าเปิดโล่งในเขตป่าเลย วิวเขาสุดลูกหูลูกตา'],
  ['ลานเล่นลมเชียงราย', 'Chiang Rai Windplay Field', 'meadow', 'Chiang Rai', 'ดอยช้าง', [19.910, 99.840], 'P3', 'ลานหญ้ารับลมบนไร่กาแฟดอยช้าง'],
  ['ทุ่งดอกไม้เขาค้อ', 'Khao Kho Flower Field', 'meadow', 'Phetchabun', 'เขาค้อ', [16.670, 101.030], 'I1', 'ลานเล็กของครอบครัวท่ามกลางทุ่งดอกไม้'],
  ['วิวกว้างวังน้ำเขียว', 'Wang Nam Khiao Wide View', 'meadow', 'Nakhon Ratchasima', 'วังน้ำเขียว', [14.470, 101.690], 'C4', 'เนินหญ้ากว้างมองเห็นทิวเขาดงพญาเย็น'],
  ['ลานตะวันรอนภูเรือ', 'Phu Ruea Sunset Lawn', 'meadow', 'Loei', 'ภูเรือ', [17.480, 101.360], 'I5', 'สนามหญ้าเล็กชมพระอาทิตย์ตกหลังแนวเขา'],
  ['ทุ่งหญ้าเลี้ยงดาวเชียงราย', 'Chiang Rai Star Pasture', 'meadow', 'Chiang Rai', 'ดอยตุง', [20.050, 99.880], 'P3', 'ทุ่งเลี้ยงสัตว์เปลี่ยนเป็นลานกางเต็นท์ชมดาว'],
  // T2 beach (9)
  ['หาดไร่เลย์แคมป์', 'Railay Beach Camp', 'beach', 'Krabi', 'หาดไร่เลย์', [8.011, 98.838], 'C2', 'หาดทรายขาวล้อมด้วยหน้าผาหินปูน เข้าถึงด้วยเรือ'],
  ['อ่าวนางริมเล', 'Ao Nang Seaside', 'beach', 'Krabi', 'อ่าวนาง', [8.032, 98.823], 'C2', 'ริมหาดอ่าวนางใกล้แหล่งท่องเที่ยวและร้านอาหาร'],
  ['เกาะลันตาซันเซ็ต', 'Koh Lanta Sunset', 'beach', 'Krabi', 'เกาะลันตา', [7.624, 99.049], 'I3', 'หาดเงียบฝั่งตะวันตกชมพระอาทิตย์ตกทุกเย็น'],
  ['หาดในหานภูเก็ต', 'Nai Harn Beach Phuket', 'beach', 'Phuket', 'หาดในหาน', [7.774, 98.305], 'C2', 'อ่าวน้ำใสเงียบสงบทางใต้สุดของภูเก็ต'],
  ['ไม้ขาวบีชแคมป์', 'Mai Khao Beach Camp', 'beach', 'Phuket', 'หาดไม้ขาว', [8.137, 98.303], 'C2', 'หาดยาวเงียบใกล้สนามบิน เหมาะดูเครื่องบินลงจอด'],
  ['เกาะกูดทะเลใส', 'Koh Kood Clearwater', 'beach', 'Trat', 'เกาะกูด', [11.659, 102.553], 'C2', 'น้ำทะเลใสที่สุดของอ่าวไทยฝั่งตะวันออก'],
  ['เกาะหมากเงียบสงบ', 'Koh Mak Serene', 'beach', 'Trat', 'เกาะหมาก', [11.819, 102.470], 'I3', 'เกาะเล็กบรรยากาศช้า ๆ ไร้รถยนต์'],
  ['หาดทรายเกาะช้าง', 'Koh Chang Sandy Bay', 'beach', 'Trat', 'เกาะช้าง', [12.043, 102.336], 'C2', 'อ่าวทรายขาวบนเกาะใหญ่อันดับสองของไทย'],
  ['เกาะเต่าใต้ดาว', 'Koh Tao Under Stars', 'beach', 'Surat Thani', 'เกาะเต่า', [10.095, 99.840], 'C2', 'เกาะดำน้ำชื่อดัง กลางคืนฟ้าใสเต็มไปด้วยดาว'],
  // T5 lake (5)
  ['ปางอุ๋งริมทะเลสาบ', 'Pang Ung Lakeside', 'lake', 'Mae Hong Son', 'ปางอุ๋ง', [19.494, 97.992], 'P2', 'ทะเลสาบกลางหุบเขาบรรยากาศคล้ายสวิตเซอร์แลนด์'],
  ['เชี่ยวหลานกุ้ยหลินเมืองไทย', 'Cheow Lan Guilin', 'lake', 'Surat Thani', 'เขื่อนเชี่ยวหลาน', [8.943, 98.604], 'C5', 'เขาหินปูนโผล่กลางน้ำเขียวมรกตราวกุ้ยหลิน'],
  ['แพริมเขื่อนเชี่ยวหลาน', 'Cheow Lan Raft Stay', 'lake', 'Surat Thani', 'เขื่อนเชี่ยวหลาน', [8.960, 98.620], 'C5', 'พักแพลอยน้ำตื่นมาเจอม่านหมอกเหนือทะเลสาบ'],
  ['ทะเลสาบสายหมอกปางอุ๋ง', 'Pang Ung Misty Lake', 'lake', 'Mae Hong Son', 'ปางอุ๋ง', [19.500, 98.000], 'P2', 'ริมน้ำแนวสนกับหงส์ขาวและไอหมอกยามเช้า'],
  ['อ่างเก็บน้ำภูสวรรค์', 'Phu Sawan Reservoir', 'lake', 'Loei', 'ภูสวรรค์', [17.400, 101.500], 'P1', 'อ่างเก็บน้ำเงียบสงบโอบด้วยทิวเขาเมืองเลย'],
  // T3 river (6)
  ['ปายริมธารแคมป์', 'Pai Riverside Camp', 'river', 'Mae Hong Son', 'ปาย', [19.358, 98.440], 'P2', 'ริมแม่น้ำปายใจกลางเมืองเล็กในหุบเขา'],
  ['เชียงคานริมโขง', 'Chiang Khan Mekong Bank', 'river', 'Loei', 'เชียงคาน', [17.892, 101.662], 'I5', 'ลานริมแม่น้ำโขงชมพระอาทิตย์ขึ้นและตักบาตรเช้า'],
  ['ลำธารใสวังน้ำเขียว', 'Wang Nam Khiao Clear Stream', 'river', 'Nakhon Ratchasima', 'วังน้ำเขียว', [14.440, 101.720], 'C4', 'ลำธารน้ำใสไหลผ่านป่าชุ่มชื้นโอโซนสูง'],
  ['ห้วยน้ำดังสายหมอก', 'Huai Nam Dang Stream', 'river', 'Mae Hong Son', 'ห้วยน้ำดัง', [19.330, 98.520], 'P2', 'ต้นน้ำบนดอยกับจุดชมหมอกชื่อดัง'],
  ['ริมธารภูกระดึงน้อย', 'Little Phu Kradueng Stream', 'river', 'Loei', 'ภูกระดึง', [16.880, 101.840], 'P1', 'ลำธารเชิงเขาภูกระดึงร่มรื่นเหมาะพักผ่อน'],
  ['แก่งน้ำใสปากช่อง', 'Pak Chong Clearwater Rapids', 'river', 'Nakhon Ratchasima', 'ปากช่อง', [14.490, 101.420], 'C4', 'แก่งหินลำธารใสใกล้เขาใหญ่ เล่นน้ำได้ทั้งวัน'],
  // T4 forest (6)
  ['ป่าใหญ่เขาใหญ่แคมป์', 'Khao Yai Jungle Camp', 'forest', 'Nakhon Ratchasima', 'เขาใหญ่', [14.440, 101.372], 'C4', 'กางเต็นท์ในผืนป่ามรดกโลกเขาใหญ่', 'NATIONAL_PARK'],
  ['เขาสกป่าฝนแคมป์', 'Khao Sok Rainforest', 'forest', 'Surat Thani', 'เขาสก', [8.910, 98.530], 'C5', 'ป่าฝนเก่าแก่อายุกว่าร้อยล้านปี', 'NATIONAL_PARK'],
  ['ภูกระดึงยอดป่า', 'Phu Kradueng Summit Forest', 'forest', 'Loei', 'ภูกระดึง', [16.860, 101.850], 'P1', 'ลานกางเต็นท์บนยอดภูกระดึงท่ามกลางทุ่งหญ้าและป่าสน', 'NATIONAL_PARK'],
  ['ไพรพนาวังน้ำเขียว', 'Wang Nam Khiao Woodland', 'forest', 'Nakhon Ratchasima', 'วังน้ำเขียว', [14.460, 101.700], 'I4', 'ลานเล็กกลางสวนป่าปลูกอากาศบริสุทธิ์'],
  ['ป่าดิบชื้นเขาสก', 'Khao Sok Evergreen', 'forest', 'Surat Thani', 'เขาสก', [8.930, 98.560], 'C5', 'ป่าดิบชื้นริมลำน้ำกับเสียงสัตว์ป่ายามค่ำ'],
  ['พงไพรเขาใหญ่', 'Khao Yai Wildwood', 'forest', 'Nakhon Ratchasima', 'เขาใหญ่', [14.430, 101.390], 'C4', 'ชายป่าเขาใหญ่จุดส่องสัตว์และดูนก'],
];

// ---- hosts (13: 5 COMPANY, 3 PARTNERSHIP, 5 INDIVIDUAL — UNCHANGED) ------------
const HOSTS = {
  C1: { type: 'COMPANY', biz: 'บริษัท นอร์ทเทิร์นแคมป์ จำกัด', name: 'ธนวัฒน์ ดอยคำ', email: 'contact@northerncamp.co.th', area: 'เชียงใหม่' },
  C2: { type: 'COMPANY', biz: 'บริษัท ซีไซด์แคมป์ปิ้ง จำกัด', name: 'ปวีณา ทะเลใส', email: 'booking@seasidecamping.co.th', area: 'กระบี่' },
  C3: { type: 'COMPANY', biz: 'บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด', name: 'สมชาย ภูคำ', email: 'info@khaokhocamp.co.th', area: 'เพชรบูรณ์' },
  C4: { type: 'COMPANY', biz: 'บริษัท อีสานแอดเวนเจอร์ จำกัด', name: 'อนุชา ดงพญา', email: 'hello@isanadventure.co.th', area: 'นครราชสีมา' },
  C5: { type: 'COMPANY', biz: 'บริษัท เลคแอนด์เลเชอร์ จำกัด', name: 'ชญานิษฐ์ ธารน้ำ', email: 'stay@lakeleisure.co.th', area: 'สุราษฎร์ธานี' },
  P1: { type: 'PARTNERSHIP', biz: 'ห้างหุ้นส่วนจำกัด เลยไฮแลนด์', name: 'บุญส่ง ภูเรือ', email: 'loeihighland@example.com', area: 'เลย' },
  P2: { type: 'PARTNERSHIP', biz: 'ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์', name: 'แสงเดือน สายหมอก', email: 'mhscamp@example.com', area: 'แม่ฮ่องสอน' },
  P3: { type: 'PARTNERSHIP', biz: 'ห้างหุ้นส่วนจำกัด เชียงรายวิว', name: 'กิตติ ดอยสูง', email: 'chiangraiview@example.com', area: 'เชียงราย' },
  I1: { type: 'INDIVIDUAL', biz: 'ไร่ลุงนวลแคมป์', name: 'นวล แสงทอง', email: 'lung.nuan@example.com', area: 'เพชรบูรณ์' },
  I2: { type: 'INDIVIDUAL', biz: '', name: 'พิมพ์ใจ ใจดี', email: 'pimjai.cm@example.com', area: 'เชียงใหม่' },
  I3: { type: 'INDIVIDUAL', biz: 'บ้านเลริมหาด', name: 'สุชาติ เลริม', email: 'baanlay@example.com', area: 'ตราด' },
  I4: { type: 'INDIVIDUAL', biz: '', name: 'ประภาส ไพรวัลย์', email: 'prapas.korat@example.com', area: 'นครราชสีมา' },
  I5: { type: 'INDIVIDUAL', biz: 'ลานริมโขงน้องแอน', name: 'อรอุมา ริมโขง', email: 'aon.loei@example.com', area: 'เลย' },
};

// ---- Stage 0: one new host per region for the province-fill camps (6 new) ------
// Kept to ONE host per region (not one per camp) to avoid host-count blowup while
// still giving every region a plausible, distinct operator identity.
const REGION_HOSTS = {
  NORTH:     { type: 'COMPANY',     biz: 'บริษัท ภาคเหนือแคมป์ปิ้ง เน็ตเวิร์ก จำกัด', name: 'ศิริพงษ์ ดอยหลวง',   email: 'north@regioncamp.co.th',     area: 'ภาคเหนือ' },
  NORTHEAST: { type: 'PARTNERSHIP', biz: 'ห้างหุ้นส่วนจำกัด อีสานฟาร์มสเตย์',          name: 'บัวลี ทุ่งกุลา',      email: 'northeast@regioncamp.co.th', area: 'ภาคอีสาน' },
  CENTRAL:   { type: 'INDIVIDUAL',  biz: '',                                            name: 'อัครเดช ที่ราบกลาง',  email: 'central@regioncamp.co.th',   area: 'ภาคกลาง' },
  EAST:      { type: 'COMPANY',     biz: 'บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด',           name: 'วรรณา ชายฝั่งบูรพา',  email: 'east@regioncamp.co.th',      area: 'ภาคตะวันออก' },
  WEST:      { type: 'PARTNERSHIP', biz: 'ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์',          name: 'ประเสริฐ แควน้อย',    email: 'west@regioncamp.co.th',      area: 'ภาคตะวันตก' },
  SOUTH:     { type: 'INDIVIDUAL',  biz: '',                                            name: 'สุนิสา ทะเลใต้',      email: 'south@regioncamp.co.th',     area: 'ภาคใต้' },
};
const REGION_HOST_KEY = { NORTH: 'RGN', NORTHEAST: 'RGNE', CENTRAL: 'RGC', EAST: 'RGE', WEST: 'RGW', SOUTH: 'RGS' };
for (const [region, h] of Object.entries(REGION_HOSTS)) HOSTS[REGION_HOST_KEY[region]] = h;

// deterministic 13-digit fake tax id (juristic leads 0, citizen leads 1-3)
function taxId(type) { const lead = type === 'INDIVIDUAL' ? String(ri(1, 3)) : '0'; let s = lead; for (let i = 0; i < 12; i++) s += ri(0, 9); return s; }
function phone() { return '0' + pick(['6', '8', '9']) + String(ri(0, 99999999)).padStart(8, '0'); }
function slugify(s) { return s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, ''); }

// ---- build hosts + campsites --------------------------------------------------
const hostObj = {};
for (const [key, h] of Object.entries(HOSTS)) {
  hostObj[key] = {
    key, email: h.email, password: 'password123', name: h.name, phone: phone(),
    image: `/seed/hosts/${key}/avatar.jpg`, role: 'OPERATOR', isHostRegistered: true,
    hostRegisteredAt: `2025-0${ri(3, 9)}-${String(ri(1, 28)).padStart(2, '0')}T03:00:00Z`,
    businessType: h.type, businessName: h.biz || h.name,
    taxId: taxId(h.type), businessAddress: `${ri(1, 199)}/${ri(1, 9)} ต.${h.area} จ.${h.area}`,
    campsites: [],
    _avatarPrompt: h.type === 'COMPANY'
      ? `Clean professional brand emblem logo for an outdoor camping company "${h.biz}", tent + ${h.area} nature motif, 2-tone earthy green palette, flat vector, white background, no photo`
      : (h.type === 'PARTNERSHIP'
        ? `Simple rustic camp brand logo "${h.biz}", hand-drawn tent and mountain mark, warm earthy tones, flat vector, white background`
        : `Friendly avatar mark for a small local Thai camp owner "${h.name}", simple circular badge with a tent icon, soft natural colors, flat illustration, white background`),
  };
}

let freeLeft = 2;
const imageSheet = [];

// ---- shared camp builder (factored out so the curated block AND the Stage 0
// province-fill block emit mechanically-identical fields — same pricing/equipment/
// spot/image-manifest logic either way). `concept` is the same tuple shape as a
// row of `C`; `idx` is the GLOBAL 1-based index used for slug uniqueness. -------
function buildCamp(concept, idx) {
  const [th, en, themeKey, prov, areaTh, coord, hostKey, tagline, own] = concept;
  const T = THEMES[themeKey];
  const H = HOSTS[hostKey];
  const big = H.type === 'COMPANY', small = H.type === 'INDIVIDUAL';
  const slug = `${slugify(en)}-${idx}`;
  const slugTh = `${slugify(en)}-th-${idx}`;
  const P = provThZip(prov);

  // taxonomies (theme base + plausible random extras)
  const facilities = [...new Set([...T.facBase, ...pickN(T.facExtra, big ? ri(3, 5) : small ? ri(1, 2) : ri(2, 4))])];
  const equipment = small ? pickN(T.equip, ri(2, 3)) : pickN(T.equip, ri(3, T.equip.length));
  const activities = pickN(T.activities, ri(2, T.activities.length));
  const accessTypes = pickN(T.access, T.access.length === 1 ? 1 : ri(1, 2));
  // BR-5: min 1 (was ri(0, …)) — externalFacilities must never be blank (was 44%/50% blank
  // because `forest` had an empty ext[] and every theme allowed a 0-pick draw).
  const externalFacilities = pickN(T.ext, ri(1, T.ext.length));
  const terrain = T.terrain;
  // BR-4: accommodationTypes CSV (real AccommodationTypeEnum codes: CABI/DISP/GROU/HORS/
  // RECR/TENT — NOT a MasterData group, see lib/validations/campsite.ts), theme-appropriate.
  const accommodationTypes = pickN(T.accomm, ri(1, Math.min(2, T.accomm.length))).join(',');

  // pricing by tier × business type
  let lo = T.tier[0], hi = T.tier[1];
  const fac = big ? 1.15 : small ? 0.78 : 1.0;
  let priceLow = round50(lo * fac * (0.9 + rnd() * 0.2));
  let priceHigh = round50(Math.max(priceLow + 200, hi * fac * (0.85 + rnd() * 0.3)));
  let isFree = false;
  if (own !== 'NATIONAL_PARK' && small && freeLeft > 0 && chance(0.5)) { isFree = true; freeLeft--; priceLow = 0; priceHigh = 0; }
  // BR-4: premium tier — a slice of COMPANY-run camps (glamping/rimtalay-หรู reality) push
  // the ceiling well past the old ~2350 cap so a >3,000 price filter has real results
  // (AC-4: priceHigh ceiling ≥ ~15,000 for some).
  let isPremium = false;
  if (!isFree && big && chance(0.16)) {
    isPremium = true;
    priceLow = round50(priceLow * ri(3, 5));
    priceHigh = round50(Math.max(priceLow + 3000, priceHigh * ri(7, 13)));
  }

  // ground type
  const gk = pickN(T.ground, ri(1, T.ground.length));
  const ground = {}; gk.forEach((k) => { ground[k] = ri(3, 20); });

  // spots
  const nSpots = big ? ri(3, 6) : small ? ri(2, 3) : ri(3, 5);
  const zonePool = ['โซน A', 'โซน B', 'โซน C', 'ริมน้ำ', 'วิวหลัก', 'โซนเงียบ', 'โซนครอบครัว', 'โซน VIP'];
  const zones = pickN(zonePool, nSpots);
  // BR-5: nearFacilities was drawn only from T.facBase (4 codes total across every theme,
  // dataset-wide). Widen to facBase+facExtra so the distinct-code count actually varies.
  const nearPool = [...new Set([...T.facBase, ...T.facExtra])];
  const spots = [];
  for (let s = 0; s < nSpots; s++) {
    const base = isFree ? 0 : Math.max(150, round50(priceLow * (0.85 + rnd() * 0.5)));
    // BR-5: pricePerSite (Spot, optional flat per-site rate) — populate on most paid spots.
    const pricePerSite = (!isFree && chance(0.65)) ? round50(base * (1.3 + rnd() * 0.9)) : null;
    spots.push({
      zone: zones[s], name: `จุด ${String.fromCharCode(65 + s)}${ri(1, 4)}`,
      viewType: chance(0.75) ? T.view : 'GENERAL',
      maxCampers: ri(2, big ? 8 : 5), maxTents: ri(1, 4),
      environment: pick(['ใต้ร่มไม้ใหญ่', 'พื้นที่เปิดโล่งรับวิว', 'มุมเงียบสงบ', 'ติดวิวหลักของลาน', 'ใกล้สิ่งอำนวยความสะดวก']),
      pricePerNight: base, pricePerSite, priceCurrency: 'THB',
      nearFacilities: pickN(nearPool, ri(1, Math.min(4, nearPool.length))).join(','),
    });
  }

  // images + prompts — gallery count is RANDOM 1..7 per campsite (logo is a separate brand asset)
  const galleryN = ri(1, 7);
  const manifest = [];
  manifest.push({ path: `/seed/camps/${slug}/cover.jpg`, role: 'logo', aspect: '1:1', alt: `โลโก้ ${th}`,
    prompt: `Minimal flat vector logo for a campsite "${en}" (${th}), ${T.label} motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism` });
  // 7 distinct camera angles so each of the (up to 7) gallery shots gets its own prompt
  const shots = [
    { tag: 'wide', alt: `ภาพมุมกว้าง ${th}`, p: `${T.scene}, wide establishing shot at ${areaTh} ${prov} Thailand, ${T.time}, photorealistic, highly detailed, 16:9` },
    { tag: 'tent', alt: `เต็นท์ที่ ${th}`, p: `cozy dome camping tents pitched at a ${T.label} site, ${areaTh} Thailand, ${T.time}, lifestyle photo, shallow depth of field, 16:9` },
    { tag: 'signature', alt: `วิวเด่น ${th}`, p: `signature hero view of ${en}: ${T.scene}, dramatic ${T.time}, no people, travel photography, 16:9` },
    { tag: 'life', alt: `บรรยากาศ ${th}`, p: `Thai campers relaxing around a campfire and camp chairs at a ${T.label} campsite in ${areaTh}, warm evening glow, candid lifestyle photo, 16:9` },
    { tag: 'detail', alt: `รายละเอียดธรรมชาติ ${th}`, p: `close detail of the ${T.label} surroundings at ${areaTh} ${prov} (${terrain.join('+')} terrain), natural textures and foliage, soft light, 16:9` },
    { tag: 'aerial', alt: `มุมสูง ${th}`, p: `aerial drone top-down view of the ${T.label} campsite at ${areaTh}, tents arranged on the ground, surrounding ${terrain.join(' and ')} landscape, ${T.time}, 16:9` },
    { tag: 'night', alt: `ยามค่ำคืน ${th}`, p: `night scene of ${en}, glowing tents and warm string lights at a ${T.label} site in ${areaTh}, starry sky, long exposure, cozy mood, 16:9` },
  ];
  for (let g = 0; g < galleryN; g++) {
    const sh = shots[g % shots.length];
    manifest.push({ path: `/seed/camps/${slug}/${String(g + 1).padStart(2, '0')}.jpg`, role: 'gallery', aspect: '16:9', tag: sh.tag, alt: sh.alt, prompt: sh.p });
  }

  const checkIn = pick(['13:00', '14:00']);
  const checkOut = pick(['10:00', '11:00', '12:00']);
  const remote = themeKey === 'beach' && /เกาะ/.test(areaTh);
  // BR-5: cancellationPolicy (null = host hasn't set one yet, per schema comment — kept as a
  // deliberate minority so that state is still represented, not eliminated).
  const cancellationPolicy = chance(0.9) ? pick(['FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE']) : null;
  // BR-5: extraFeeAmount/extraFeeLabel — a one-time additive fee. NATIONAL_PARK camps always
  // carry the real Thai park-entrance fee (deterministic, guarantees non-zero coverage);
  // other paid camps get one by a coin flip from a plausible label pool; free camps never do.
  const EXTRA_FEE_POOL = [
    ['ค่าทำความสะอาดพื้นที่', 50, 150],
    ['ค่าไฟฟ้าเพิ่มเติม', 30, 100],
    ['ค่าฟืน/ถ่านสำหรับก่อไฟ', 50, 100],
    ['ค่าจอดรถเพิ่มเติม', 50, 100],
  ];
  let extraFeeAmount = null, extraFeeLabel = null;
  if (own === 'NATIONAL_PARK') { extraFeeAmount = ri(40, 400); extraFeeLabel = 'ค่าธรรมเนียมเข้าอุทยานแห่งชาติ'; }
  else if (!isFree && chance(0.5)) { const [label, lo2, hi2] = pick(EXTRA_FEE_POOL); extraFeeAmount = ri(lo2, hi2); extraFeeLabel = label; }
  const camp = {
    nameTh: th, nameEn: en, nameThSlug: slugTh, nameEnSlug: slug,
    description: `${tagline} ${T.desc}`,
    campSiteType: pick(T.type), accommodationTypes,
    accessTypes: accessTypes.join(','), facilities: facilities.join(','),
    externalFacilities: externalFacilities.join(','), equipment: equipment.join(','),
    activities: activities.join(','), terrain: terrain.join(','),
    province: prov,
    address: `${areaTh} อ.${areaTh} จ.${P.th} ${P.zip}`,
    directions: `เดินทางสู่${areaTh} จ.${P.th} แนะนำใช้รถยนต์ส่วนตัว สอบถามเส้นทางก่อนเดินทาง`,
    latitude: coord[0], longitude: coord[1],
    checkInTime: checkIn, checkOutTime: checkOut,
    bookingMethod: remote ? pick(['ONCA', 'ONLI']) : (chance(0.8) ? 'ONLI' : pick(['ONCA', 'ONST'])),
    priceLow, priceHigh, priceCurrency: 'THB', isPremium,
    cancellationPolicy, extraFeeAmount, extraFeeLabel,
    ownershipType: own || 'PRIVATE', isFree, petFriendly: chance(0.5),
    // BR-5: minimumAge — was chance(0.7)→0 (67% clustered at 0). Widened value set (8
    // distinct incl. 3/5) and cut the zero-cluster to ~35%.
    minimumAge: chance(0.35) ? 0 : pick([3, 5, 7, 10, 12, 15, 18]),
    maxGuestsPerDay: round50(ri(30, big ? 120 : 60)), maxTentsPerDay: ri(15, big ? 60 : 30),
    groundType: JSON.stringify(ground),
    feeInfo: isFree ? 'ไม่มีค่าบริการ กางเต็นท์ฟรี' : `ค่าพื้นที่กางเต็นท์เริ่มต้น ${priceLow} บาทต่อคืน สอบถามโปรโมชั่นเพิ่มเติมได้`,
    toiletInfo: facilities.includes('SHOW') ? 'มีห้องน้ำและห้องอาบน้ำสะอาด แยกชายหญิง' : 'มีห้องน้ำพื้นฐาน แนะนำเตรียมของใช้ส่วนตัว',
    phone: phone(), lineId: '@' + slugify(en).replace(/-/g, '').slice(0, 18),
    facebookUrl: `https://facebook.com/${slugify(en)}`,
    tags: pickN(T.tags, ri(3, T.tags.length)).join(','),
    isActive: true, isPublished: true,
    logo: `/seed/camps/${slug}/cover.jpg`,
    images: manifest.filter((m) => m.role === 'gallery').map((m) => m.path).join(','),
    // Stage 1 (demand-seeding toolkit) — explicit "named/real-destination" marker so a
    // downstream consumer (scripts/gen-review-text.mjs's ~30-40 hero-camp pick) never has
    // to infer curated-vs-generated from slug string shape. true for idx 1-48 (the curated
    // concepts, real Thai destinations); false for the Stage 0 province-fill camps (idx 49+,
    // templated names from AREA_LABELS).
    curated: idx <= C.length,
    spots, imageManifest: manifest,
  };
  if (chance(0.4)) camp.tiktokUrl = `https://tiktok.com/@${slugify(en).replace(/-/g, '')}`;
  if (chance(0.3)) camp.videoUrl = `https://www.youtube.com/watch?v=${slugify(en).slice(0, 8)}${idx}`;

  hostObj[hostKey].campsites.push(camp);
  imageSheet.push({ host: hostKey, camp, manifest, themeLabel: T.label, galleryN });
  return camp;
}

C.forEach((row, i) => buildCamp(row, i + 1));

// ---- Stage 0: province-fill — 2-3 camps for each of the 67 uncovered provinces -
const THEME_EN_LABEL = { mist: 'Misty Highland', beach: 'Beachside', river: 'Riverside', forest: 'Forest', lake: 'Lakeside', meadow: 'Meadow' };
// CAM-492 (BR-2 realism fix): 'beach' is NEVER in a region's base pool anymore — the old
// pool put 'beach' in the whole CENTRAL/EAST/WEST/SOUTH bucket, which included landlocked
// provinces (e.g. Nonthaburi, Lop Buri, Saraburi, Sa Kaeo, Phatthalung) getting "beach" camps,
// which is geographically wrong. 'beach' is added ONLY per-province, ONLY when the province is
// in COASTAL_PROVINCES (real Thai coastline — verified against the standard 23-province coastal
// list), via the guarantee below. 'lake' (เขื่อน/อ่างเก็บน้ำ) is added to CENTRAL/EAST/WEST for
// the "กลาง/ตะวันตก→แม่น้ำ/เขื่อน/ป่า" realism the spec calls for (BR-2).
const REGION_THEME_POOL = {
  NORTH: ['mist', 'river', 'forest'],
  NORTHEAST: ['meadow', 'river', 'forest'],
  CENTRAL: ['river', 'forest', 'meadow', 'lake'],
  EAST: ['river', 'forest', 'lake'],
  WEST: ['river', 'forest', 'mist', 'lake'],
  SOUTH: ['lake', 'forest', 'river'],
};
// The real Thai coastal provinces (Gulf of Thailand + Andaman Sea) among the 67 province-fill
// provinces (the curated 10 already cover Krabi/Phuket/Surat Thani/Trat with real beach concepts).
// Every coastal province below is GUARANTEED at least one 'beach' camp (see the k===0 branch)
// so AC-2 (≥25 beach camps, spread across real sea provinces incl. ชุมพร/ประจวบ/สงขลา) never
// depends on PRNG luck.
const COASTAL_PROVINCES = new Set([
  // CENTRAL (Bangkok Metropolitan coastline on the upper Gulf of Thailand)
  'Bangkok', 'Samut Prakan', 'Samut Sakhon', 'Samut Songkhram',
  // WEST (Gulf of Thailand)
  'Phetchaburi', 'Prachuap Khiri Khan',
  // EAST (Gulf of Thailand, eastern seaboard)
  'Chon Buri', 'Rayong', 'Chanthaburi', 'Trat', 'Chachoengsao',
  // SOUTH (Gulf side + Andaman side) — Phatthalung and Yala are landlocked, deliberately excluded
  'Nakhon Si Thammarat', 'Krabi', 'Phang Nga', 'Phuket', 'Surat Thani',
  'Ranong', 'Chumphon', 'Songkhla', 'Satun', 'Trang', 'Pattani', 'Narathiwat',
]);
// Real districts are only seeded for the original 12 (10 curated + Bangkok/Samut
// Prakan) provinces in thailand-locations.json — the other 65 have an empty
// `districts` array, so generated area names use a generic per-theme Thai label
// instead of a real district (still deterministic; never a fabricated place name).
const AREA_LABELS = {
  mist: ['ดอยชายแดน', 'สันเขาเหนือหมู่บ้าน', 'เนินเขาแนวชายป่า', 'ยอดดอยเงียบสงบ'],
  beach: ['หาดชายฝั่งเงียบ', 'อ่าวเล็กปลายแหลม', 'ริมทะเลนอกเมือง', 'แหลมหาดทราย'],
  river: ['ริมแม่น้ำสายหลัก', 'ต้นน้ำชานเมือง', 'ฝั่งลำธารชนบท', 'ริมคลองร่มรื่น'],
  forest: ['ชายป่าอนุรักษ์', 'ป่าชุมชนใกล้เมือง', 'แนวป่าเขตรักษาพันธุ์', 'ป่าเบญจพรรณชานเมือง'],
  lake: ['อ่างเก็บน้ำชานเมือง', 'ริมบึงธรรมชาติ', 'ทะเลสาบเขื่อน', 'แหล่งน้ำใหญ่กลางหุบเขา'],
  meadow: ['ทุ่งโล่งชานเมือง', 'เนินหญ้าชายทุ่ง', 'ที่ราบเชิงเขา', 'ทุ่งกว้างริมหมู่บ้าน'],
};
const taglineFor = (themeKey, provTh) => `บรรยากาศ${THEMES[themeKey].label}ในจังหวัด${provTh} เหมาะกับการพักผ่อนใกล้ธรรมชาติ`;

const CURATED_PROVINCE_SET = new Set(C.map((row) => row[3]));
const ALL_PROVINCE_EN = THAILAND_LOCATIONS.map((p) => p.nameEn);
const MISSING_PROVINCES = ALL_PROVINCE_EN.filter((p) => !CURATED_PROVINCE_SET.has(p));

let globalIdx = C.length; // continue numbering after the curated 48 (idx 49+) — slugs can never collide
let pfCamps = 0;
const pfSkipped = [];
for (const provEn of MISSING_PROVINCES) {
  const region = PROVINCE_REGION[provEn];
  const center = PROVINCE_CENTER[provEn];
  if (!region || !center) { pfSkipped.push(provEn); continue; } // defensive — should never fire if the two reference maps stay in sync
  const { th: provTh } = provThZip(provEn);
  const nCamps = ri(2, 3);
  const isCoastal = COASTAL_PROVINCES.has(provEn);
  // BR-2/AC-2: a coastal province's FIRST camp is deterministically 'beach' — guarantees
  // real-sea-province beach coverage regardless of PRNG luck; later camps in the same
  // province draw from the region pool + 'beach' (coastal provinces get extra beach variety,
  // landlocked provinces never see 'beach' at all).
  const pool = isCoastal ? [...REGION_THEME_POOL[region], 'beach'] : REGION_THEME_POOL[region];
  for (let k = 0; k < nCamps; k++) {
    globalIdx++; pfCamps++;
    const themeKey = (isCoastal && k === 0) ? 'beach' : pick(pool);
    const hostKey = REGION_HOST_KEY[region];
    const areaTh = pick(AREA_LABELS[themeKey]);
    const nameTh = `${areaTh}${provTh}`;
    const nameEn = `${provEn} ${THEME_EN_LABEL[themeKey]} Camp ${k + 1}`;
    const lat = round4(center[0] + (rnd() - 0.5) * 0.35);
    const lon = round4(center[1] + (rnd() - 0.5) * 0.35);
    buildCamp([nameTh, nameEn, themeKey, provEn, areaTh, [lat, lon], hostKey, taglineFor(themeKey, provTh)], globalIdx);
  }
}
if (pfSkipped.length) console.warn(`⚠️  province-fill skipped (no region/center mapping): ${pfSkipped.join(', ')}`);

// ---- BR-3 closing pass: GUARANTEE every MasterData filter-option code has ≥1 camp ---------
// Deterministic (no rnd() — fixed array-index selection), so re-runs are always identical
// (EC-3) regardless of how the probabilistic theme pools above land. This is the actual
// AC-3 guarantee; the pool tweaks above (WATE/CART/MIMT/LSTV/OFFR added into theme facExtra/
// equip/activities) just give them a *natural*, non-forced presence too.
const MASTERDATA_GROUPS = [
  { field: 'facilities', codes: ['SHOW', 'TOIL', 'PICN', 'WIFI', 'TRAS', 'SANI', 'POTA', 'ELEC', 'WATE', 'SINK', 'CART', 'MIMT', 'GRIL', 'CAFE', 'REST', 'FEIC', 'FEDW'] },
  { field: 'equipment', codes: ['TENT', 'POWE', 'TFAN', 'BLKT', 'LEDL', 'GDST', 'SSTV', 'LSTV', 'CHAI', 'FYST', 'ICBK'] },
  { field: 'externalFacilities', codes: ['SVEL', 'LOTS', 'MAKT', 'MIBC'] },
  { field: 'accessTypes', codes: ['BAOT', 'DRIV', 'HIKE', 'WALK'] },
  { field: 'activities', codes: ['SWIM', 'HIKI', 'SURF', 'FISH', 'WILD', 'BOAT', 'HORS', 'OFFR', 'LIVE', 'CLIM'] },
  { field: 'terrain', codes: ['BEAC', 'FORE', 'RIVE', 'MTNS'] },
];
const allCamps = Object.values(hostObj).flatMap((h) => h.campsites);
// Target ONLY province-fill camps (curated:false) — the 48 hand-authored curated concepts
// stay byte-identical to their PRNG-drawn taxonomy (per the file-header invariant above);
// there are 170+ province-fill camps, plenty of room to close a code without ever touching one.
const pfPool = allCamps.filter((c) => !c.curated);
let closedDeadCodes = 0;
for (const { field, codes } of MASTERDATA_GROUPS) {
  for (const code of codes) {
    const has = allCamps.some((c) => (c[field] || '').split(',').includes(code));
    if (has) continue;
    closedDeadCodes++;
    // Deterministic target: spread across up to 5 camps (idx spaced by pfPool.length/5)
    // so the closed code gets a modest, non-single-camp presence, not just one occurrence.
    const nTargets = Math.min(5, pfPool.length);
    for (let t = 0; t < nTargets; t++) {
      const camp = pfPool[Math.floor((t * pfPool.length) / nTargets)];
      const cur = camp[field] ? camp[field].split(',').filter(Boolean) : [];
      if (!cur.includes(code)) { cur.push(code); camp[field] = cur.join(','); }
    }
  }
}

// ---- emit JSON ----------------------------------------------------------------
const hosts = Object.values(hostObj);
hosts.forEach((h) => delete h._avatarPrompt);
const totalCampsites = C.length + pfCamps;
const data = { meta: { generatedFor: 'campvibe-staging', version: 2, totalCampsites, totalHosts: hosts.length, curatedCampsites: C.length, provinceFillCampsites: pfCamps, provinceFillProvinces: MISSING_PROVINCES.length }, hosts };
const outJson = path.join(ROOT, 'prisma/data/mock-staging.json');
fs.writeFileSync(outJson, JSON.stringify(data, null, 2));

// ---- emit image-prompt sheet (md) ---------------------------------------------
let md = `# Image Generation Prompts — CampVibe staging mock (${totalCampsites} camps, 77 provinces)\n\n`;
md += `> เอา prompt เหล่านี้ไปให้ Gemini generate รูป แล้วบันทึกตาม **path** ที่ระบุ (ให้ตรงกับ field ใน \`prisma/data/mock-staging.json\`)\n>\n`;
md += `> **สไตล์รวม:** ภาพถ่ายเสมือนจริง (photorealistic) บรรยากาศแคมป์ปิ้งในประเทศไทย แสงธรรมชาติ ไม่มีตัวอักษร/ลายน้ำบนภาพถ่าย (เฉพาะโลโก้เป็น flat vector ได้) ไม่มีคนหันหน้าชัด\n\n`;
md += `## Host avatars (${hosts.length})\n\n`;
for (const [key, h] of Object.entries(HOSTS)) {
  md += `- \`/seed/hosts/${key}/avatar.jpg\` (1:1) — **${h.biz || h.name}** (${h.type}): ${getAvatarPrompt(key, h)}\n`;
}
md += `\n## Campsite images\n`;
let curHost = '';
for (const { host, camp, manifest, themeLabel, galleryN } of imageSheet) {
  if (host !== curHost) { md += `\n### โฮสต์ ${host} — ${HOSTS[host].biz || HOSTS[host].name} (${HOSTS[host].type})\n`; curHost = host; }
  md += `\n#### ${camp.nameTh} — ${camp.nameEn}  \n`;
  md += `ธีม: ${themeLabel} · จังหวัด: ${camp.province} · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี ${galleryN}**\n\n`;
  for (const m of manifest) {
    md += `- \`${m.path}\` (${m.aspect}, ${m.role}${m.tag ? `/${m.tag}` : ''}) — _alt:_ ${m.alt}  \n  ${m.prompt}\n`;
  }
}
function getAvatarPrompt(key, h) {
  return h.type === 'COMPANY'
    ? `Clean professional brand emblem for outdoor camping company, tent + ${h.area} nature motif, 2-tone earthy green, flat vector, white background`
    : h.type === 'PARTNERSHIP'
      ? `Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background`
      : `Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background`;
}
const outMd = path.join(ROOT, 'docs/mock-data-image-prompts.md');
fs.writeFileSync(outMd, md);

// ---- summary --------------------------------------------------------------------
const byType = { COMPANY: 0, PARTNERSHIP: 0, INDIVIDUAL: 0 };
const campsByType = { COMPANY: 0, PARTNERSHIP: 0, INDIVIDUAL: 0 };
const byTheme = {};
let nSpots = 0, nImgs = 0, nGallery = 0, nFree = 0, nNP = 0;
const galleryHist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
const provincesSeen = new Set();
const byRegion = { NORTH: 0, NORTHEAST: 0, CENTRAL: 0, EAST: 0, WEST: 0, SOUTH: 0 };
for (const h of hosts) {
  byType[h.businessType]++; campsByType[h.businessType] += h.campsites.length;
  for (const c of h.campsites) {
    nSpots += c.spots.length; nImgs += c.imageManifest.length;
    const g = c.imageManifest.filter((m) => m.role === 'gallery').length;
    nGallery += g; galleryHist[g]++;
    if (c.isFree) nFree++; if (c.ownershipType === 'NATIONAL_PARK') nNP++;
    provincesSeen.add(c.province);
    const region = PROVINCE_REGION[c.province];
    if (region) byRegion[region]++;
  }
}
C.forEach((r) => { byTheme[r[2]] = (byTheme[r[2]] || 0) + 1; });
console.log('✅ wrote', path.relative(ROOT, outJson));
console.log('✅ wrote', path.relative(ROOT, outMd));
console.log(`hosts=${hosts.length}  (COMPANY ${byType.COMPANY}, PARTNERSHIP ${byType.PARTNERSHIP}, INDIVIDUAL ${byType.INDIVIDUAL})`);
console.log(`campsites=${totalCampsites}  (curated ${C.length} + province-fill ${pfCamps})  camps by host type:`, campsByType);
console.log('camps by theme (curated only):', byTheme);
console.log(`gallery per camp = random 1..7 →`, galleryHist, `(total gallery=${nGallery})`);
console.log(`images total = ${nGallery} gallery + ${totalCampsites} logos + ${hosts.length} avatars = ${nGallery + totalCampsites + hosts.length}  (manifest entries=${nImgs})  | spots=${nSpots}  free=${nFree}  nationalPark=${nNP}`);
console.log(`STAGE 0 — distinct provinces = ${provincesSeen.size}/77  | camps by region:`, byRegion);
const beachCamps = allCamps.filter((c) => (c.terrain || '').includes('BEAC')).length;
const premiumCamps = allCamps.filter((c) => c.isPremium).length;
console.log(`CAM-492 — beach terrain camps=${beachCamps}  premium-tier camps=${premiumCamps}  MasterData codes force-closed=${closedDeadCodes}`);
