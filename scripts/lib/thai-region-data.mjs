// scripts/lib/thai-region-data.mjs — Stage 0 (province coverage 10→77) shared reference.
//
// Two plain-JS constants shared by scripts/gen-mock-data.mjs + scripts/merge-mock-data.mjs
// (both run under plain `node`, no TS transpilation, so they cannot `import` a .ts module
// directly — this file is the deliberate, single duplication point instead of two).
//
// REGION_TO_PROVINCES is copied VERBATIM from lib/thai-regions.ts (the app's own SoT for
// the 6-region partition, enforced there by __tests__/cam-463-thai-regions.test.ts against
// the seeded provinceNameEn set). If that partition ever changes, update both places.
//
// PROVINCE_CENTER supplies an APPROXIMATE province-capital lat/lon for the 67 provinces that
// have no curated per-camp coordinates in gen-mock-data.mjs — plausible for a map pin, not
// for routing. thailand-locations.json (the seeded SoT for nameTh/code/districts) carries no
// lat/lon at all, so this is the only source for it.

export const REGION_TO_PROVINCES = Object.freeze({
  NORTH: [
    'Chiang Mai', 'Lamphun', 'Lampang', 'Uttaradit', 'Phrae',
    'Nan', 'Phayao', 'Chiang Rai', 'Mae Hong Son',
  ],
  NORTHEAST: [
    'Nakhon Ratchasima', 'Buri Ram', 'Surin', 'Si Sa Ket', 'Ubon Ratchathani',
    'Yasothon', 'Chaiyaphum', 'Amnat Charoen', 'Bueng Kan', 'Nong Bua Lam Phu',
    'Khon Kaen', 'Udon Thani', 'Loei', 'Nong Khai', 'Maha Sarakham',
    'Roi Et', 'Kalasin', 'Sakon Nakhon', 'Nakhon Phanom', 'Mukdahan',
  ],
  CENTRAL: [
    'Bangkok', 'Samut Prakan', 'Nonthaburi', 'Pathum Thani', 'Phra Nakhon Si Ayutthaya',
    'Ang Thong', 'Lop Buri', 'Sing Buri', 'Chai Nat', 'Saraburi',
    'Nakhon Nayok', 'Nakhon Sawan', 'Uthai Thani', 'Kamphaeng Phet', 'Sukhothai',
    'Phitsanulok', 'Phichit', 'Phetchabun', 'Suphan Buri', 'Nakhon Pathom',
    'Samut Sakhon', 'Samut Songkhram',
  ],
  EAST: ['Chon Buri', 'Rayong', 'Chanthaburi', 'Trat', 'Chachoengsao', 'Prachin Buri', 'Sa Kaeo'],
  WEST: ['Tak', 'Kanchanaburi', 'Ratchaburi', 'Phetchaburi', 'Prachuap Khiri Khan'],
  SOUTH: [
    'Nakhon Si Thammarat', 'Krabi', 'Phang Nga', 'Phuket', 'Surat Thani',
    'Ranong', 'Chumphon', 'Songkhla', 'Satun', 'Trang',
    'Phatthalung', 'Pattani', 'Yala', 'Narathiwat',
  ],
});

/** provinceNameEn -> [lat, lon] — approximate provincial-capital center, 77/77. */
export const PROVINCE_CENTER = Object.freeze({
  Bangkok: [13.7563, 100.5018],
  'Samut Prakan': [13.5991, 100.5998],
  'Nakhon Ratchasima': [14.9799, 102.0977],
  'Chiang Mai': [18.7883, 98.9853],
  'Chiang Rai': [19.9105, 99.8406],
  'Mae Hong Son': [19.3020, 97.9654],
  Phetchabun: [16.4189, 101.1591],
  Loei: [17.4860, 101.7223],
  Krabi: [8.0863, 98.9063],
  Phuket: [7.8804, 98.3923],
  'Surat Thani': [9.1382, 99.3215],
  Trat: [12.2428, 102.5178],
  Nonthaburi: [13.8622, 100.5134],
  'Pathum Thani': [14.0208, 100.5253],
  'Phra Nakhon Si Ayutthaya': [14.3532, 100.5686],
  'Ang Thong': [14.5896, 100.4549],
  'Lop Buri': [14.7995, 100.6534],
  'Sing Buri': [14.8908, 100.3968],
  'Chai Nat': [15.1851, 100.1251],
  Saraburi: [14.5289, 100.9101],
  'Chon Buri': [13.3611, 100.9847],
  Rayong: [12.6813, 101.2816],
  Chanthaburi: [12.6113, 102.1039],
  Chachoengsao: [13.6904, 101.0779],
  'Prachin Buri': [14.0509, 101.3673],
  'Nakhon Nayok': [14.2069, 101.2130],
  'Sa Kaeo': [13.8244, 102.0645],
  'Buri Ram': [14.9951, 103.1029],
  Surin: [14.8828, 103.4936],
  'Si Sa Ket': [15.1186, 104.3220],
  'Ubon Ratchathani': [15.2287, 104.8564],
  Yasothon: [15.7927, 104.1450],
  Chaiyaphum: [15.8068, 102.0316],
  'Amnat Charoen': [15.8656, 104.6257],
  'Bueng Kan': [18.3609, 103.6466],
  'Nong Bua Lam Phu': [17.2216, 102.4260],
  'Khon Kaen': [16.4322, 102.8236],
  'Udon Thani': [17.4156, 102.7859],
  'Nong Khai': [17.8783, 102.7420],
  'Maha Sarakham': [16.1852, 103.3005],
  'Roi Et': [16.0538, 103.6520],
  Kalasin: [16.4315, 103.5057],
  'Sakon Nakhon': [17.1545, 104.1450],
  'Nakhon Phanom': [17.4029, 104.7791],
  Mukdahan: [16.5450, 104.7228],
  Lamphun: [18.5744, 99.0087],
  Lampang: [18.2855, 99.5122],
  Uttaradit: [17.6200, 100.0993],
  Phrae: [18.1445, 100.1405],
  Nan: [18.7756, 100.7730],
  Phayao: [19.1664, 99.9018],
  'Nakhon Sawan': [15.7030, 100.1370],
  'Uthai Thani': [15.3835, 100.0248],
  'Kamphaeng Phet': [16.4827, 99.5227],
  Tak: [16.8840, 99.1258],
  Sukhothai: [17.0072, 99.8236],
  Phitsanulok: [16.8211, 100.2659],
  Phichit: [16.4406, 100.3486],
  Ratchaburi: [13.5282, 99.8134],
  Kanchanaburi: [14.0022, 99.5328],
  'Suphan Buri': [14.4744, 100.1177],
  'Nakhon Pathom': [13.8199, 100.0621],
  'Samut Sakhon': [13.5475, 100.2740],
  'Samut Songkhram': [13.4098, 100.0022],
  Phetchaburi: [13.1119, 99.9459],
  'Prachuap Khiri Khan': [11.8125, 99.7957],
  'Nakhon Si Thammarat': [8.4304, 99.9631],
  'Phang Nga': [8.4509, 98.5296],
  Ranong: [9.9658, 98.6348],
  Chumphon: [10.4930, 99.1800],
  Songkhla: [7.1897, 100.5951],
  Satun: [6.6238, 100.0674],
  Trang: [7.5645, 99.6239],
  Phatthalung: [7.6167, 100.0742],
  Pattani: [6.8695, 101.2500],
  Yala: [6.5410, 101.2800],
  Narathiwat: [6.4254, 101.8253],
});

/** provinceNameEn -> region, derived from REGION_TO_PROVINCES (built once, reused). */
export const PROVINCE_REGION = Object.freeze(
  Object.fromEntries(
    Object.entries(REGION_TO_PROVINCES).flatMap(([region, provs]) => provs.map((p) => [p, region])),
  ),
);
