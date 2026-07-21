/**
 * 城市 → (纬度, 经度, 时区标准经线?) 静态缓存。
 * Originally ported from shunshi/solar_time.py::_CITY_CACHE, then extended
 * with 🇯🇵 日本 / 🇰🇷 韓國 / 🇨🇦 加拿大 / 🇦🇺 澳洲 / 🇪🇺 欧洲 cities for
 * Shunshi.AI's international markets.
 *
 * Canonical keys are Simplified Chinese. Traditional Chinese (`CITY_ALIASES`)
 * and Japanese kanji / Korean Hangul forms that differ from the canonical key
 * are registered as aliases so users can pass either form.
 *
 * The optional 3rd element is the clock-timezone standard meridian (in °E)
 * and is ONLY specified for cities where `Math.round(longitude/15)*15` gives
 * the wrong answer. The vast majority of cities don't need it:
 *   - 🇨🇳 Chinese cities: longitude rounds to 120° = CST ✓
 *   - 🇯🇵 Japanese cities: longitude rounds to 135° = JST ✓
 *   - 🇺🇸 US cities: rounds to -75/-90/-105/-120 = EST/CST/MST/PST ✓
 *   - 🇬🇧 London: rounds to 0° = GMT ✓
 * The exceptions (listed explicitly below) are:
 *   - 🇰🇷 most of Korea: longitude 126-128°, rounds to 120°, but KST = 135°
 *     (busan 129° and daegu 128.6° happen to round to 135° by luck)
 *   - 🇫🇷 Paris: longitude 2.35°, rounds to 0°, but CET = 15°
 *     (Frankfurt 8.68° rounds to 15° correctly by luck)
 * Without this override, clock-time → solar-time correction is off by ~60 min
 * for these cities, which shifts the 时辰 (and therefore the hour pillar).
 */

export const CITY_CACHE: Record<string, [number, number] | [number, number, number]> = {
  // ───────────────────────────── 🇨🇳 中国大陆 ─────────────────────────────
  北京: [39.9042, 116.4074], 上海: [31.2304, 121.4737],
  广州: [23.1291, 113.2644], 深圳: [22.5431, 114.0579],
  杭州: [30.2741, 120.1551], 南京: [32.0603, 118.7969],
  成都: [30.5728, 104.0668], 重庆: [29.4316, 106.9123],
  武汉: [30.5928, 114.3055], 西安: [34.3416, 108.9398],
  天津: [39.3434, 117.3616], 苏州: [31.2990, 120.5853],
  长沙: [28.2282, 112.9388], 郑州: [34.7466, 113.6254],
  青岛: [36.0671, 120.3826], 大连: [38.9140, 121.6147],
  沈阳: [41.8057, 123.4315], 哈尔滨: [45.8038, 126.5350],
  长春: [43.8171, 125.3235], 济南: [36.6512, 117.1201],
  厦门: [24.4798, 118.0894], 福州: [26.0745, 119.2965],
  昆明: [25.0389, 102.7183], 贵阳: [26.6470, 106.6302],
  南宁: [22.8170, 108.3665], 海口: [20.0174, 110.3492],
  合肥: [31.8206, 117.2272], 太原: [37.8706, 112.5489],
  石家庄: [38.0428, 114.5149], 兰州: [36.0611, 103.8343],
  银川: [38.4872, 106.2309], 西宁: [36.6171, 101.7782],
  拉萨: [29.6520, 91.1721], 乌鲁木齐: [43.8256, 87.6168],
  呼和浩特: [40.8424, 111.7490], 南昌: [28.6820, 115.8579],
  无锡: [31.4912, 120.3119], 宁波: [29.8683, 121.5440],
  温州: [28.0006, 120.6722], 鸡西: [45.3000, 130.9696],

  // ───────────────────────────── 🇭🇰🇲🇴🇹🇼 港澳台 ──────────────────────────
  香港: [22.3193, 114.1694], 澳门: [22.1987, 113.5439],
  台北: [25.0330, 121.5654], 高雄: [22.6273, 120.3014],
  台中: [24.1477, 120.6736],

  // ───────────────────────────── 🌏 东南亚 ───────────────────────────────
  新加坡: [1.3521, 103.8198], 吉隆坡: [3.1390, 101.6869],
  曼谷: [13.7563, 100.5018], 雅加达: [-6.2088, 106.8456],
  胡志明市: [10.8231, 106.6297], 马尼拉: [14.5995, 120.9842],
  金边: [11.5564, 104.9282], 仰光: [16.8661, 96.1951],
  河内: [21.0278, 105.8342], 清迈: [18.7061, 98.9817],
  槟城: [5.4164, 100.3327], 巴厘岛: [-8.3405, 115.0920],

  // ───────────────────────────── 🇯🇵 日本 ───────────────────────────────
  // Japanese 四柱推命 user base. Canonical keys are Simplified Chinese;
  // Japanese kanji forms (東京, 大阪, 横浜, 神戸, 広島, 福岡) are registered
  // as aliases in CITY_ALIASES below.
  东京: [35.6762, 139.6503], 大阪: [34.6937, 135.5023],
  京都: [35.0116, 135.7681], 横滨: [35.4437, 139.6380],
  名古屋: [35.1815, 136.9066], 福冈: [33.5904, 130.4017],
  札幌: [43.0618, 141.3545], 神户: [34.6901, 135.1956],
  仙台: [38.2682, 140.8694], 广岛: [34.3853, 132.4553],

  // ───────────────────────────── 🇰🇷 韓國 ───────────────────────────────
  // Korean 사주 user base. Canonical keys are Simplified Chinese;
  // Hangul forms (서울, 부산, etc.) and traditional Chinese forms (首爾)
  // are registered as aliases in CITY_ALIASES below.
  // Entries with an explicit 135 (3rd element) are for KST cities whose
  // longitude rounds to 120° by default — see header comment.
  首尔: [37.5665, 126.9780, 135], 釜山: [35.1796, 129.0756],
  仁川: [37.4563, 126.7052, 135], 大邱: [35.8714, 128.6014],
  光州: [35.1595, 126.8526, 135], 大田: [36.3504, 127.3845, 135],

  // ───────────────────────────── 🇺🇸 北美 ───────────────────────────────
  纽约: [40.7128, -74.0060], 洛杉矶: [34.0522, -118.2437],
  旧金山: [37.7749, -122.4194], 西雅图: [47.6062, -122.3321],
  芝加哥: [41.8781, -87.6298], 休斯顿: [29.7604, -95.3698],
  波士顿: [42.3601, -71.0589], 华盛顿: [38.9072, -77.0369],
  // 🇨🇦 加拿大 (华人命理大市场)
  多伦多: [43.6532, -79.3832], 温哥华: [49.2827, -123.1207],
  蒙特利尔: [45.5017, -73.5673],

  // ───────────────────────────── 🇦🇺 大洋洲 ──────────────────────────────
  悉尼: [-33.8688, 151.2093], 墨尔本: [-37.8136, 144.9631],
  布里斯班: [-27.4698, 153.0251],

  // ───────────────────────────── 🇪🇺 欧洲 ───────────────────────────────
  // Paris needs an explicit meridian (CET=15°) because its longitude 2.35°
  // rounds to 0° (=GMT) by default. Frankfurt 8.68° happens to round to 15°
  // correctly, London is at 0° already.
  伦敦: [51.5074, -0.1278], 巴黎: [48.8566, 2.3522, 15],
  法兰克福: [50.1109, 8.6821],

  // 默认兜底 — 北京
  默认: [39.9042, 116.4074],
};

/**
 * Non-canonical city name → canonical (Simplified Chinese) name.
 *
 * Covers:
 * - 繁體中文 alternates for any canonical name whose characters differ
 *   (e.g. `廣州 → 广州`, `哈爾濱 → 哈尔滨`)
 * - 日本漢字 forms where they differ from Simplified Chinese
 *   (e.g. `東京 → 东京`, `横浜 → 横滨`, `神戸 → 神户`, `広島 → 广岛`)
 * - 한국어 Hangul forms (e.g. `서울 → 首尔`, `부산 → 釜山`)
 *
 * Identity aliases (where the traditional and simplified forms are the same
 * character — 京都, 札幌, 仙台, 大阪, 巴黎, etc.) are not listed here; the
 * canonical key already matches.
 */
export const CITY_ALIASES: Record<string, string> = {
  // 🇨🇳 大陆城市的繁體写法
  廣州: '广州', 重慶: '重庆', 長沙: '长沙', 長春: '长春',
  瀋陽: '沈阳', 沈陽: '沈阳', 哈爾濱: '哈尔滨', 青島: '青岛',
  濟南: '济南', 廈門: '厦门', 無錫: '无锡', 溫州: '温州',
  蘭州: '兰州', 銀川: '银川', 烏魯木齊: '乌鲁木齐', 石家莊: '石家庄',
  鄭州: '郑州', 貴陽: '贵阳', 寧波: '宁波', 蘇州: '苏州',
  呼和浩特市: '呼和浩特',

  // 🇭🇰🇲🇴 繁體
  澳門: '澳门',

  // 🇯🇵 日本漢字 (when different from Simplified Chinese)
  東京: '东京', '東京都': '东京',
  横浜: '横滨', '横浜市': '横滨',
  '大阪市': '大阪', '京都市': '京都',
  神戸: '神户', 神戶: '神户',
  広島: '广岛', 廣島: '广岛',
  福岡: '福冈',
  '名古屋市': '名古屋',
  '札幌市': '札幌',
  '仙台市': '仙台',
  '横濱': '横滨', '橫濱': '横滨',

  // 🇰🇷 韓文 Hangul + 한자 繁體
  서울: '首尔', 首爾: '首尔',
  부산: '釜山',
  인천: '仁川',
  대구: '大邱',
  광주: '光州',
  대전: '大田',

  // 🌏 东南亚繁體
  檳城: '槟城', 河內: '河内', 馬尼拉: '马尼拉',
  '胡志明': '胡志明市',

  // 🇺🇸 北美繁體
  紐約: '纽约', 舊金山: '旧金山', 洛杉磯: '洛杉矶',
  華盛頓: '华盛顿', 芝加哥: '芝加哥',

  // 🇨🇦 加拿大繁體
  多倫多: '多伦多', 溫哥華: '温哥华', 蒙特利爾: '蒙特利尔',

  // 🇦🇺 大洋洲繁體
  雪梨: '悉尼', // Taiwan/HK call Sydney 雪梨
  墨爾本: '墨尔本',

  // 🇪🇺 欧洲繁體
  倫敦: '伦敦', 法蘭克福: '法兰克福',
};

/**
 * Returns [latitude, longitude, standardMeridian?] for the city.
 * The third element is only present for cities whose clock-time reference
 * meridian doesn't match `Math.round(longitude/15)*15` — callers should
 * pass it to `trueSolarTime(..., standardMeridian)` when present.
 */
export function getLocation(
  city: string,
): [number, number] | [number, number, number] {
  if (city in CITY_CACHE) return CITY_CACHE[city];
  if (city in CITY_ALIASES) {
    const canonical = CITY_ALIASES[city];
    if (canonical in CITY_CACHE) return CITY_CACHE[canonical];
  }
  if (!city || city.includes('默认') || city.includes('預設') || city.includes('默認')) {
    return CITY_CACHE['默认'];
  }
  throw new Error(
    `City "${city}" not in built-in cache. ` +
      `Pass longitude/latitude explicitly, or add the city to cityCache.ts. ` +
      `Currently supported: ~90 cities across 🇨🇳🇭🇰🇲🇴🇹🇼 Greater China, ` +
      `🇯🇵 Japan, 🇰🇷 Korea, 🌏 SE Asia, 🇺🇸🇨🇦 North America, ` +
      `🇦🇺 Oceania, and 🇪🇺 Europe. Traditional Chinese, Japanese kanji, ` +
      `and Korean Hangul aliases are also accepted.`,
  );
}
