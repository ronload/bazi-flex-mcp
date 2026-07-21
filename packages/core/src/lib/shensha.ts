/**
 * 八字神煞计算引擎 — faithful port of shunshi/shensha.py.
 *
 * Design goal: every table and every check is a 1:1 transcription from the
 * Python original so that results match byte-for-byte. Do not "clean up"
 * anything that differs from the Python — that divergence would silently
 * break parity with the shunshi backend.
 *
 * v0.1: natal chart only (calc_shensha_for_pillars).
 * v0.2: calc_dynamic_shensha for 大运/流年/流月.
 */

// ─── 基础常量 ────────────────────────────────────────────────────

const TIAN_GAN = '甲乙丙丁戊己庚辛壬癸';
const DI_ZHI = '子丑寅卯辰巳午未申酉戌亥';

const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);

function zhiIdx(zhi: string): number {
  return DI_ZHI.indexOf(zhi);
}

// 三合局归类
const SAN_HE: Record<string, number> = {
  寅: 0, 午: 0, 戌: 0, // 寅午戌
  巳: 1, 酉: 1, 丑: 1, // 巳酉丑
  申: 2, 子: 2, 辰: 2, // 申子辰
  亥: 3, 卯: 3, 未: 3, // 亥卯未
};

function sanHeGroup(zhi: string): number {
  return SAN_HE[zhi];
}

// 天干五合
const GAN_HE: Record<string, string> = {
  甲: '己', 乙: '庚', 丙: '辛', 丁: '壬', 戊: '癸',
  己: '甲', 庚: '乙', 辛: '丙', 壬: '丁', 癸: '戊',
};

// 地支六合
const ZHI_LIU_HE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 卯: '戌',
  辰: '酉', 巳: '申', 午: '未', 未: '午',
  申: '巳', 酉: '辰', 戌: '卯', 亥: '寅',
};

// ═══════════════════════════════════════════════════════════════════
//  神煞查表
// ═══════════════════════════════════════════════════════════════════

// ── 查日干 → 地支 ─────────────────────────────────────────────────

const YANG_REN: Record<string, string> = {
  甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午',
  己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥',
};

const FEI_REN: Record<string, string> = {
  甲: '酉', 乙: '申', 丙: '子', 丁: '亥', 戊: '子',
  己: '亥', 庚: '卯', 辛: '寅', 壬: '午', 癸: '巳',
};

const LU_SHEN: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

const LIU_XIA: Record<string, string> = {
  甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳',
  己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅',
};

const WEN_CHANG: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
  己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};

const XUE_TANG: Record<string, string> = {
  甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅',
  己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯',
};

// 血刃 (查月支 → 地支)
const XUE_REN: Record<string, string> = {
  子: '午', 丑: '子', 寅: '丑', 卯: '未',
  辰: '寅', 巳: '申', 午: '卯', 未: '酉',
  申: '辰', 酉: '戌', 戌: '巳', 亥: '亥',
};

// 天罗地网 (查日支)
const TIAN_LUO: Record<string, string> = { 戌: '辰', 亥: '巳' };
const DI_WANG: Record<string, string> = { 辰: '戌', 巳: '亥' };

// ── 查年干+日干 → 地支 ───────────────────────────────────────────

const TIAN_YI: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};

const FU_XING: Record<string, string[]> = {
  甲: ['寅', '子'], 丙: ['寅', '子'],
  乙: ['卯', '丑'], 癸: ['卯', '丑'],
  丁: ['亥'], 戊: ['申'], 己: ['未'],
  庚: ['午'], 辛: ['巳'], 壬: ['辰'],
};

const TAI_JI: Record<string, string[]> = {
  甲: ['子', '午'], 乙: ['子', '午'],
  丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'], 辛: ['寅', '亥'],
  壬: ['巳', '申'], 癸: ['巳', '申'],
};

const GUO_YIN: Record<string, string> = {
  甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑',
  己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申',
};

const TIAN_CHU: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '巳', 丁: '午', 戊: '申',
  己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};

const JIN_YU_GAN: Record<string, string> = {
  甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未',
  己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅',
};

// ── 查年支 → 地支 (三合局类) ──────────────────────────────────────

const TAO_HUA = ['卯', '午', '酉', '子']; // 咸池
const YI_MA = ['申', '亥', '寅', '巳'];
const JIE_SHA = ['亥', '寅', '巳', '申'];
const ZAI_SHA = ['子', '卯', '午', '酉'];
const WANG_SHEN = ['巳', '申', '亥', '寅'];
const HUA_GAI = ['戌', '丑', '辰', '未'];
const JIANG_XING = ['午', '酉', '子', '卯'];

function bySanHe(zhi: string, table: string[]): string {
  return table[sanHeGroup(zhi)];
}

// ── 查年支 → 地支 (逐支类) ───────────────────────────────────────

const TIAN_XI: Record<string, string> = {
  子: '酉', 丑: '申', 寅: '未', 卯: '午',
  辰: '巳', 巳: '辰', 午: '卯', 未: '寅',
  申: '丑', 酉: '子', 戌: '亥', 亥: '戌',
};

const HONG_LUAN: Record<string, string> = {
  子: '卯', 丑: '寅', 寅: '丑', 卯: '子',
  辰: '亥', 巳: '戌', 午: '酉', 未: '申',
  申: '未', 酉: '午', 戌: '巳', 亥: '辰',
};

function piMa(yearZhi: string): string {
  return DI_ZHI[(zhiIdx(yearZhi) + 9) % 12];
}

function sangMen(yearZhi: string): string {
  return DI_ZHI[(zhiIdx(yearZhi) + 2) % 12];
}

function diaoKe(yearZhi: string): string {
  return DI_ZHI[(zhiIdx(yearZhi) + 10) % 12];
}

function gouJiao(yearZhi: string): string {
  return DI_ZHI[(zhiIdx(yearZhi) + 3) % 12];
}

// 孤辰 (三支分组)
const GU_CHEN_MAP: Record<string, string> = {
  亥: '寅', 子: '寅', 丑: '寅',
  寅: '巳', 卯: '巳', 辰: '巳',
  巳: '申', 午: '申', 未: '申',
  申: '亥', 酉: '亥', 戌: '亥',
};

// ── 查月支 → 天干/地支 (天德/月德) ─────────────────────────────────

const YUE_DE_GAN = ['丙', '庚', '壬', '甲']; // 寅午戌, 巳酉丑, 申子辰, 亥卯未
const YUE_DE_HE_GAN = ['辛', '乙', '丁', '己'];

const TIAN_DE: Record<string, string> = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛',
  午: '亥', 未: '甲', 申: '癸', 酉: '寅',
  戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
};

function tianDeHe(monthZhi: string): string {
  const td = TIAN_DE[monthZhi];
  if (td in GAN_HE) return GAN_HE[td];
  if (td in ZHI_LIU_HE) return ZHI_LIU_HE[td];
  return '';
}

// ── 查日干 → 地支 (单查) ──────────────────────────────────────────

const HONG_YAN: Record<string, string> = {
  甲: '午', 乙: '申', 丙: '寅', 丁: '未', 戊: '辰',
  己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申',
};

const GUA_SU: Record<string, string> = {
  甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳',
  己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅',
};

// ── 特殊日柱 / 特殊干支 ──────────────────────────────────────────

const LIU_XIU_RI = new Set(['戊子', '己丑', '丙午', '丁未', '戊午', '己未']);
const JIU_CHOU_RI = new Set([
  '己卯', '壬午', '戊子', '辛卯', '丁酉', '己酉', '壬子', '戊午', '辛酉',
]);
const KUI_GANG_RI = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const SHI_E_DA_BAI_RI = new Set([
  '甲辰', '乙巳', '壬申', '丙申', '丁亥',
  '庚辰', '戊戌', '壬戌', '癸亥', '辛巳',
]);
const YIN_CHA_YANG_CUO = new Set([
  '丙子', '丁丑', '戊寅', '辛卯', '壬辰',
  '丙午', '丁未', '戊申', '辛酉', '壬戌',
  '癸亥', '癸巳',
]);
const GU_LUAN_SHA = new Set([
  '丁巳', '乙巳', '丙午', '戊申', '辛亥', '壬子', '甲寅', '戊午',
]);
const BA_ZHUAN_RI = new Set([
  '戊戌', '丁未', '癸丑', '甲寅', '乙卯', '己未', '庚申', '辛酉',
]);
const JIN_SHEN = new Set(['乙丑', '癸酉', '己巳']);
const SHI_LING_RI = new Set([
  '乙亥', '癸未', '庚寅', '丁酉', '壬寅',
  '甲辰', '庚戌', '辛亥', '丙辰', '戊午',
]);
const TIAN_SHE_RI: Record<string, string> = {
  寅: '戊寅', 卯: '戊寅', 辰: '戊寅',
  巳: '甲午', 午: '甲午', 未: '甲午',
  申: '戊申', 酉: '戊申', 戌: '戊申',
  亥: '甲子', 子: '甲子', 丑: '甲子',
};

// 德秀贵人 (月支 → 天干集合)
const DE_XIU: Record<string, Set<string>> = {
  寅: new Set(['丙', '丁', '戊', '癸']),
  午: new Set(['丙', '丁', '戊', '癸']),
  戌: new Set(['丙', '丁', '戊', '癸']),
  申: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']),
  子: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']),
  辰: new Set(['壬', '癸', '戊', '己', '丙', '辛', '甲']),
  巳: new Set(['乙', '庚', '辛']),
  酉: new Set(['乙', '庚', '辛']),
  丑: new Set(['乙', '庚', '辛']),
  亥: new Set(['甲', '乙', '丁', '壬']),
  卯: new Set(['甲', '乙', '丁', '壬']),
  未: new Set(['甲', '乙', '丁', '壬']),
};

// 词馆 (年纳音 → 地支)
const CI_GUAN: Record<string, string> = {
  金: '申', 木: '寅', 水: '亥', 土: '亥', 火: '巳',
};

// 正学堂 (年纳音 → 干支)
const ZHENG_XUE_TANG: Record<string, string> = {
  金: '辛巳', 木: '己亥', 水: '甲申', 土: '戊申', 火: '丙寅',
};

// ── 童子煞 ───────────────────────────────────────────────────────

/**
 * 童子煞判定 (口诀版)
 * 春秋寅子贵, 冬夏卯未辰;
 * 金木马卯合, 水火酉戌多;
 * 土命逢辰巳, 童子定不错。
 *
 * @returns trigger locations: 'day' and/or 'time'
 */
function isTongzi(
  monthZhi: string,
  yearNayin: string,
  dayZhi: string,
  timeZhi: string,
): Array<'day' | 'time'> {
  const targets = new Set<string>();
  // 春(寅卯辰)/秋(申酉戌)
  if ('寅卯辰申酉戌'.includes(monthZhi)) {
    targets.add('寅');
    targets.add('子');
  }
  // 夏(巳午未)/冬(亥子丑)
  if ('巳午未亥子丑'.includes(monthZhi)) {
    targets.add('卯');
    targets.add('未');
    targets.add('辰');
  }
  // 年纳音五行
  if (yearNayin) {
    const last = yearNayin.slice(-1);
    if (last === '金' || last === '木') {
      targets.add('午');
      targets.add('卯');
    } else if (last === '水' || last === '火') {
      targets.add('酉');
      targets.add('戌');
    } else if (last === '土') {
      targets.add('辰');
      targets.add('巳');
    }
  }
  const hits: Array<'day' | 'time'> = [];
  if (targets.has(dayZhi)) hits.push('day');
  if (targets.has(timeZhi)) hits.push('time');
  return hits;
}

// ═══════════════════════════════════════════════════════════════════
//  主计算函数
// ═══════════════════════════════════════════════════════════════════

export interface ShenshaResult {
  年柱: string[];
  月柱: string[];
  日柱: string[];
  时柱: string[];
}

export interface ShenshaInput {
  yearGan: string;
  yearZhi: string;
  monthGan: string;
  monthZhi: string;
  dayGan: string;
  dayZhi: string;
  timeGan: string;
  timeZhi: string;
  /** 年柱纳音, 例如 "大林木" (末字用于五行判定) */
  yearNayin?: string;
  /** 1 = 男, 0 = 女 (用于元辰) */
  gender?: 0 | 1;
}

/**
 * 计算原局四柱神煞。Port of shunshi/shensha.py::calc_shensha_for_pillars.
 */
export function calcShenshaForPillars(input: ShenshaInput): ShenshaResult {
  const {
    yearGan, yearZhi, monthGan, monthZhi,
    dayGan, dayZhi, timeGan, timeZhi,
    yearNayin = '', gender = 1,
  } = input;

  const result: ShenshaResult = {
    年柱: [], 月柱: [], 日柱: [], 时柱: [],
  };
  const pillarKeys: Array<keyof ShenshaResult> = ['年柱', '月柱', '日柱', '时柱'];
  const allZhi = [yearZhi, monthZhi, dayZhi, timeZhi];
  const allGan = [yearGan, monthGan, dayGan, timeGan];

  const appendUnique = (idx: number, name: string) => {
    const arr = result[pillarKeys[idx]];
    if (!arr.includes(name)) arr.push(name);
  };

  // ── 1. 查日干 → 看四柱地支 ────────────────────────────────────

  const checkGanToZhi = (name: string, target: string) => {
    for (let i = 0; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, name);
    }
  };

  checkGanToZhi('羊刃', YANG_REN[dayGan]);
  checkGanToZhi('飞刃', FEI_REN[dayGan]);
  checkGanToZhi('禄神', LU_SHEN[dayGan]);
  checkGanToZhi('流霞', LIU_XIA[dayGan]);
  checkGanToZhi('血刃', XUE_REN[monthZhi]);
  checkGanToZhi('红艳煞', HONG_YAN[dayGan]);
  checkGanToZhi('寡宿', GUA_SU[dayGan]);

  // ── 2. 查年干+日干 → 看四柱地支 ──────────────────────────────

  const checkByGanKeys = (
    name: string,
    table: Record<string, string | string[]>,
    keys: string[] = [yearGan, dayGan],
  ) => {
    const targets = new Set<string>();
    for (const k of keys) {
      const val = table[k];
      if (val === undefined) continue;
      if (Array.isArray(val)) {
        for (const v of val) targets.add(v);
      } else {
        targets.add(val);
      }
    }
    for (let i = 0; i < 4; i++) {
      if (targets.has(allZhi[i])) appendUnique(i, name);
    }
  };

  checkByGanKeys('天乙贵人', TIAN_YI);
  checkByGanKeys('福星贵人', FU_XING);
  checkByGanKeys('太极贵人', TAI_JI);
  checkByGanKeys('国印贵人', GUO_YIN);
  checkByGanKeys('文昌贵人', WEN_CHANG);
  checkByGanKeys('天厨贵人', TIAN_CHU);
  checkByGanKeys('金舆', JIN_YU_GAN);

  // ── 3. 三合局类: 年支+日支双键, 匹配时排除键自身所在柱 ───────

  const checkSanHeEx = (name: string, table: string[]) => {
    for (const [keyZhi, keyIdx] of [[yearZhi, 0], [dayZhi, 2]] as const) {
      const target = bySanHe(keyZhi, table);
      for (let i = 0; i < 4; i++) {
        if (i === keyIdx) continue;
        if (allZhi[i] === target) appendUnique(i, name);
      }
    }
  };

  checkSanHeEx('桃花', TAO_HUA);
  checkSanHeEx('驿马', YI_MA);
  checkSanHeEx('华盖', HUA_GAI);
  checkSanHeEx('将星', JIANG_XING);
  checkSanHeEx('劫煞', JIE_SHA);
  checkSanHeEx('亡神', WANG_SHEN);

  // 灾煞: 仅用年支为键, 排除年柱
  {
    const target = bySanHe(yearZhi, ZAI_SHA);
    for (let i = 1; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, '灾煞');
    }
  }

  // ── 4. 查年支(逐支类) → 看四柱地支 ───────────────────────────

  checkGanToZhi('天喜', TIAN_XI[yearZhi]);

  // 天医 (月支前一位)
  {
    const target = DI_ZHI[(zhiIdx(monthZhi) - 1 + 12) % 12];
    for (let i = 0; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, '天医');
    }
  }

  checkGanToZhi('红鸾', HONG_LUAN[yearZhi]);
  checkGanToZhi('披麻', piMa(yearZhi));
  checkGanToZhi('丧门', sangMen(yearZhi));
  checkGanToZhi('吊客', diaoKe(yearZhi));

  // 勾绞煞 (排除年柱)
  {
    const target = gouJiao(yearZhi);
    for (let i = 1; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, '勾绞煞');
    }
  }

  // 孤辰 (排除年柱)
  {
    const target = GU_CHEN_MAP[yearZhi];
    for (let i = 1; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, '孤辰');
    }
  }

  // 元辰 (阳男/阴女→+7, 阴男/阳女→+5)
  {
    const isYangYear = YANG_GAN.has(yearGan);
    const isMale = gender === 1;
    const offset = isYangYear === isMale ? 7 : 5;
    const target = DI_ZHI[(zhiIdx(yearZhi) + offset) % 12];
    for (let i = 0; i < 4; i++) {
      if (allZhi[i] === target) appendUnique(i, '元辰');
    }
  }

  // ── 5. 查月支 → 天德/月德系列 ────────────────────────────────

  {
    const yueDe = YUE_DE_GAN[sanHeGroup(monthZhi)];
    for (let i = 0; i < 4; i++) {
      if (allGan[i] === yueDe) appendUnique(i, '月德贵人');
    }
  }
  {
    const yueDeHe = YUE_DE_HE_GAN[sanHeGroup(monthZhi)];
    for (let i = 0; i < 4; i++) {
      if (allGan[i] === yueDeHe) appendUnique(i, '月德合');
    }
  }
  {
    const td = TIAN_DE[monthZhi];
    for (let i = 0; i < 4; i++) {
      if (allGan[i] === td || allZhi[i] === td) appendUnique(i, '天德贵人');
    }
  }
  {
    const tdh = tianDeHe(monthZhi);
    if (tdh) {
      for (let i = 0; i < 4; i++) {
        if (allGan[i] === tdh || allZhi[i] === tdh) appendUnique(i, '天德合');
      }
    }
  }
  {
    const targets = DE_XIU[monthZhi] ?? new Set<string>();
    for (let i = 0; i < 4; i++) {
      if (targets.has(allGan[i])) appendUnique(i, '德秀贵人');
    }
  }

  // ── 6. 特殊日柱 ──────────────────────────────────────────────

  const dayGz = dayGan + dayZhi;
  const timeGz = timeGan + timeZhi;

  if (LIU_XIU_RI.has(dayGz)) result.日柱.push('六秀日');
  if (JIU_CHOU_RI.has(dayGz)) result.日柱.push('九丑日');
  if (KUI_GANG_RI.has(dayGz)) result.日柱.push('魁罡日');
  if (SHI_E_DA_BAI_RI.has(dayGz)) result.日柱.push('十恶大败');
  if (YIN_CHA_YANG_CUO.has(dayGz)) result.日柱.push('阴差阳错');
  if (GU_LUAN_SHA.has(dayGz)) result.日柱.push('孤鸾煞');
  if (BA_ZHUAN_RI.has(dayGz)) result.日柱.push('八专日');
  if (SHI_LING_RI.has(dayGz)) result.日柱.push('十灵日');

  // 金神 (日柱+时柱)
  if (JIN_SHEN.has(dayGz)) result.日柱.push('金神');
  if (JIN_SHEN.has(timeGz)) result.时柱.push('金神');

  // 天赦日
  if (TIAN_SHE_RI[monthZhi] === dayGz) result.日柱.push('天赦日');

  // 地网 (年纳音水/土, 日支辰/巳)
  if (yearNayin) {
    const nx = yearNayin.slice(-1);
    if ((nx === '水' || nx === '土') && (dayZhi === '辰' || dayZhi === '巳')) {
      result.日柱.push('地网');
    }
  }

  // 词馆 (检查月日时, 排除年柱)
  if (yearNayin) {
    const nx = yearNayin.slice(-1);
    if (nx in CI_GUAN) {
      const target = CI_GUAN[nx];
      for (let i = 1; i < 4; i++) {
        if (allZhi[i] === target) appendUnique(i, '词馆');
      }
    }
  }

  // 正学堂 (检查月日时, 排除年柱)
  if (yearNayin) {
    const nx = yearNayin.slice(-1);
    if (nx in ZHENG_XUE_TANG) {
      const target = ZHENG_XUE_TANG[nx];
      for (let i = 1; i < 4; i++) {
        if (allGan[i] + allZhi[i] === target) appendUnique(i, '正学堂');
      }
    }
  }

  // ── 7. 童子煞 ────────────────────────────────────────────────

  const tongziHits = isTongzi(monthZhi, yearNayin, dayZhi, timeZhi);
  for (const h of tongziHits) {
    if (h === 'day') result.日柱.push('童子煞');
    else result.时柱.push('童子煞');
  }

  return result;
}
