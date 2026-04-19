import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { z } from "zod";

type GetBaziChartResult = ReturnType<typeof getBaziChart>;
type Pillars = GetBaziChartResult["八字"]["柱位详细"];
type Pillar = Pillars["年柱"];

export interface TenGodStat {
	透: number;
	藏: number;
	共: number;
}

function parseIsoLikeDate(s: string): { year: number; month: number; day: number } | null {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
	return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function pad2(n: number | string | undefined): string {
	return String(n ?? 0).padStart(2, "0");
}

/** Upstream `fmtDt` output ("YYYY-MM-DD HH:MM", always :00 seconds) → ISO 8601 */
function fmtDtToIso(s: string): string {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s.trim());
	if (!m) return s;
	return `${m[1] ?? ""}-${pad2(m[2])}-${pad2(m[3])}T${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6])}`;
}

/** Upstream `八字.公历` ("YYYY年M月D日 HH:MM:SS" from tyme4ts) → ISO 8601 */
function chineseDateTimeToIso(s: string): string {
	const m = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(s.trim());
	if (!m) return s;
	return `${m[1] ?? ""}-${pad2(m[2])}-${pad2(m[3])}T${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6])}`;
}

function todayIsoDate(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}

function actualAgeAt(
	birthYear: number,
	birthMonth: number,
	birthDay: number,
	atYear: number,
	atMonth: number,
	atDay: number,
): number {
	const before = atMonth < birthMonth || (atMonth === birthMonth && atDay < birthDay);
	return atYear - birthYear - (before ? 1 : 0);
}

export function computeTenGodStats(pillars: {
	年柱: Pick<Pillar, "主星" | "副星">;
	月柱: Pick<Pillar, "主星" | "副星">;
	日柱: Pick<Pillar, "副星">;
	时柱: Pick<Pillar, "主星" | "副星">;
}): Record<string, TenGodStat> {
	const transparent = [pillars.年柱.主星, pillars.月柱.主星, pillars.时柱.主星];
	const hidden = [
		...pillars.年柱.副星,
		...pillars.月柱.副星,
		...pillars.日柱.副星,
		...pillars.时柱.副星,
	];

	const stats: Record<string, TenGodStat> = {};
	const bump = (k: string, kind: "透" | "藏") => {
		if (!stats[k]) stats[k] = { 透: 0, 藏: 0, 共: 0 };
		stats[k][kind]++;
		stats[k].共++;
	};

	for (const g of transparent) bump(g, "透");
	for (const g of hidden) bump(g, "藏");

	return stats;
}

// ─── 柱间关系 (pair 化) ───────────────────────────────────────────────
// 上游 `shunshi-bazi-core` v0.1 的 `刑冲合会` 只是扁平字串 (例 "甲己相合")，
// 沒有柱位標籤 — 複雜盤 (多柱同干支) 會有 pair 歧義。這裡反推 pair，只做
// 解析與配對，不重新實作 relation 規則，沿用上游的判斷結果。
//
// TODO(upstream): shunshi-bazi-core v0.2+ 的 roadmap 可能暴露帶 `labels`
// 的 relation API，或直接在 output 帶 pair。屆時移除本段、改用 upstream
// 的 pair 輸出。參考：node_modules/shunshi-bazi-core/README.md 動態神煞段。

export type PillarKey = "年" | "月" | "日" | "时";
const PILLAR_KEYS: readonly PillarKey[] = ["年", "月", "日", "时"] as const;

export type RelationType =
	| "相合"
	| "相冲"
	| "相害"
	| "相破"
	| "暗合"
	| "自刑"
	| "三刑"
	| "克"
	| "其他";

export interface PillarRelationPair {
	kind: "天干" | "地支";
	type: RelationType;
	pillars: PillarKey[];
	干支: string[];
	raw: string;
}

interface ParsedRelation {
	type: RelationType;
	involved: string[];
}

function parseRelationString(raw: string): ParsedRelation | null {
	// 克:X克Y (only 天干 uses this form in upstream)
	const keMatch = /^(.)克(.)$/.exec(raw);
	if (keMatch) return { type: "克", involved: [keMatch[1] ?? "", keMatch[2] ?? ""] };
	// 三刑:XYZ三刑
	const sanxingMatch = /^(.)(.)(.)三刑$/.exec(raw);
	if (sanxingMatch) {
		return {
			type: "三刑",
			involved: [sanxingMatch[1] ?? "", sanxingMatch[2] ?? "", sanxingMatch[3] ?? ""],
		};
	}
	// 兩字 + 二字尾詞
	const pairMatch = /^(.)(.)(相合|相冲|相害|相破|暗合|自刑)$/.exec(raw);
	if (pairMatch) {
		return {
			type: pairMatch[3] as RelationType,
			involved: [pairMatch[1] ?? "", pairMatch[2] ?? ""],
		};
	}
	return null;
}

function matchPairs(involved: string[], chars: readonly string[]): number[][] {
	const sorted = [...involved].sort();
	const out: number[][] = [];
	for (let i = 0; i < chars.length; i++) {
		for (let j = i + 1; j < chars.length; j++) {
			const pair = [chars[i] ?? "", chars[j] ?? ""].sort();
			if (pair[0] === sorted[0] && pair[1] === sorted[1]) out.push([i, j]);
		}
	}
	return out;
}

function matchTriples(involved: string[], chars: readonly string[]): number[][] {
	const sorted = [...involved].sort();
	const out: number[][] = [];
	for (let i = 0; i < chars.length; i++) {
		for (let j = i + 1; j < chars.length; j++) {
			for (let k = j + 1; k < chars.length; k++) {
				const trip = [chars[i] ?? "", chars[j] ?? "", chars[k] ?? ""].sort();
				if (trip[0] === sorted[0] && trip[1] === sorted[1] && trip[2] === sorted[2]) {
					out.push([i, j, k]);
				}
			}
		}
	}
	return out;
}

export function computePillarRelations(bazi: {
	刑冲合会: { 天干: string[]; 地支: string[] };
	柱位详细: Pillars;
}): PillarRelationPair[] {
	const gans = PILLAR_KEYS.map((k) => bazi.柱位详细[`${k}柱` as const].天干);
	const zhis = PILLAR_KEYS.map((k) => bazi.柱位详细[`${k}柱` as const].地支);
	const out: PillarRelationPair[] = [];

	const extend = (kind: "天干" | "地支", rawStrings: string[], chars: readonly string[]): void => {
		const unique = Array.from(new Set(rawStrings));
		for (const raw of unique) {
			const parsed = parseRelationString(raw);
			if (!parsed) {
				out.push({ kind, type: "其他", pillars: [], 干支: [], raw });
				continue;
			}
			const groups =
				parsed.involved.length === 3
					? matchTriples(parsed.involved, chars)
					: matchPairs(parsed.involved, chars);
			if (groups.length === 0) {
				// upstream says this relation exists but no pillar-pair matches - keep raw
				out.push({ kind, type: parsed.type, pillars: [], 干支: parsed.involved, raw });
				continue;
			}
			for (const idxs of groups) {
				out.push({
					kind,
					type: parsed.type,
					pillars: idxs.map((i) => PILLAR_KEYS[i] ?? ("年" as PillarKey)),
					干支: idxs.map((i) => chars[i] ?? ""),
					raw,
				});
			}
		}
	};

	extend("天干", bazi.刑冲合会.天干, gans);
	extend("地支", bazi.刑冲合会.地支, zhis);
	return out;
}

// ─── 流年 ─────────────────────────────────────────────────────────────
// 上游 `shunshi-bazi-core` v0.1 不提供流年/流月/流日 API (v0.2 roadmap
// 已列入，見 node_modules/shunshi-bazi-core/README.md)。這裡以最小表驅動
// 實作:只輸出年份、干支、主星(對日主十神)、藏干十神、当前。不做流年
// vs 四柱/大運 的 pair 關係 — LLM 可從本命 `柱间关系` 結構 + 流年干支
// 自行推演。
//
// TODO(upstream): 上游 v0.2 推出流年 API 後，移除本段 + 本地表，改用
// upstream。屆時流年界點也會由上游精確處理(立春),本地 `(year-4)%60`
// 算出的是「立春後主體那一年」，元旦~立春約 5 週屬於前一干支年。

const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCH_ORDER = [
	"子",
	"丑",
	"寅",
	"卯",
	"辰",
	"巳",
	"午",
	"未",
	"申",
	"酉",
	"戌",
	"亥",
] as const;

const STEM_ELEMENT: Record<string, "木" | "火" | "土" | "金" | "水"> = {
	甲: "木",
	乙: "木",
	丙: "火",
	丁: "火",
	戊: "土",
	己: "土",
	庚: "金",
	辛: "金",
	壬: "水",
	癸: "水",
};
const STEM_YANG: Record<string, boolean> = {
	甲: true,
	乙: false,
	丙: true,
	丁: false,
	戊: true,
	己: false,
	庚: true,
	辛: false,
	壬: true,
	癸: false,
};
/** 本气/中气/余气 order — matches tyme4ts `EarthBranch.getHideHeavenStems()`. */
const BRANCH_HIDDEN: Record<string, string[]> = {
	子: ["癸"],
	丑: ["己", "癸", "辛"],
	寅: ["甲", "丙", "戊"],
	卯: ["乙"],
	辰: ["戊", "乙", "癸"],
	巳: ["丙", "庚", "戊"],
	午: ["丁", "己"],
	未: ["己", "乙", "丁"],
	申: ["庚", "壬", "戊"],
	酉: ["辛"],
	戌: ["戊", "辛", "丁"],
	亥: ["壬", "甲"],
};

const GEN_NEXT: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CTRL_NEXT: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

function tenStar(dayMaster: string, target: string): string {
	const dE = STEM_ELEMENT[dayMaster];
	const tE = STEM_ELEMENT[target];
	const dY = STEM_YANG[dayMaster];
	const tY = STEM_YANG[target];
	if (!dE || !tE || dY === undefined || tY === undefined) return "?";
	const same = dY === tY;
	if (dE === tE) return same ? "比肩" : "劫财";
	if (GEN_NEXT[dE] === tE) return same ? "食神" : "伤官";
	if (GEN_NEXT[tE] === dE) return same ? "偏印" : "正印";
	if (CTRL_NEXT[dE] === tE) return same ? "偏财" : "正财";
	if (CTRL_NEXT[tE] === dE) return same ? "七杀" : "正官";
	return "?";
}

function sexagenaryOfYear(year: number): { 干支: string; 天干: string; 地支: string } {
	const idx = (((year - 4) % 60) + 60) % 60;
	const 天干 = STEM_ORDER[idx % 10] ?? "";
	const 地支 = BRANCH_ORDER[idx % 12] ?? "";
	return { 干支: `${天干}${地支}`, 天干, 地支 };
}

export interface LiunianEntry {
	年份: number;
	干支: string;
	天干: string;
	地支: string;
	主星: string;
	藏干: string[];
	藏干十神: string[];
	当前: boolean;
}

export function computeLiunian(
	dayMaster: string,
	range: { start: number; end: number },
	referenceYear: number,
): LiunianEntry[] {
	const { start, end } = range;
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
	const out: LiunianEntry[] = [];
	for (let y = start; y <= end; y++) {
		const { 干支, 天干, 地支 } = sexagenaryOfYear(y);
		const hidden = BRANCH_HIDDEN[地支] ?? [];
		out.push({
			年份: y,
			干支,
			天干,
			地支,
			主星: tenStar(dayMaster, 天干),
			藏干: [...hidden],
			藏干十神: hidden.map((g) => tenStar(dayMaster, g)),
			当前: y === referenceYear,
		});
	}
	return out;
}

// ─── 决策辅助 (decision aids) ─────────────────────────────────────────
// Pure aggregation of already-available fields. No 旺衰/格局/用神 judgement
// is made here — that is intentionally left to the consumer. These helpers
// just surface the raw inputs (month-command relation, root presence,
// transparent/hidden balance) so an LLM does not have to recompute them.

const ELEMENT_RELATION_LABEL: Record<string, string> = {
	同我: "同我",
	生我: "生我",
	我生: "我生",
	我克: "我克",
	克我: "克我",
};

function elementRelation(from: string, to: string): keyof typeof ELEMENT_RELATION_LABEL | null {
	if (!from || !to) return null;
	if (from === to) return "同我";
	if (GEN_NEXT[to] === from) return "生我";
	if (GEN_NEXT[from] === to) return "我生";
	if (CTRL_NEXT[from] === to) return "我克";
	if (CTRL_NEXT[to] === from) return "克我";
	return null;
}

export interface DecisionAids {
	日主得令: {
		月支: string;
		月令主气: string;
		月令五行: string;
		日主五行: string;
		关系: string;
		得令: boolean;
	} | null;
	日主根气: {
		日主五行: string;
		柱位根: Array<{ 柱: PillarKey; 地支: string; 同类藏干: string[]; 分值: number }>;
		总根气: number;
	};
	透藏平衡: {
		比劫透: number;
		比劫藏: number;
		异类透: number;
		异类藏: number;
		比劫共: number;
		异类共: number;
	};
}

const CANG_WEIGHT = [1.0, 0.5, 0.3] as const;

export function computeDecisionAids(
	bazi: { 日主: string; 柱位详细: Pillars },
	tenGodStats: Record<string, TenGodStat>,
): DecisionAids {
	const 日主五行 = STEM_ELEMENT[bazi.日主] ?? "";

	// 日主得令
	const 月支 = bazi.柱位详细.月柱.地支;
	const 月令主气 = BRANCH_HIDDEN[月支]?.[0] ?? "";
	const 月令五行 = STEM_ELEMENT[月令主气] ?? "";
	const rel = elementRelation(日主五行, 月令五行);
	const 日主得令 = rel
		? {
				月支,
				月令主气,
				月令五行,
				日主五行,
				关系: rel,
				得令: rel === "同我" || rel === "生我",
			}
		: null;

	// 日主根气
	const 柱位根: DecisionAids["日主根气"]["柱位根"] = [];
	let 总根气 = 0;
	for (const key of PILLAR_KEYS) {
		const pillar = bazi.柱位详细[`${key}柱` as const];
		const hidden = pillar.藏干;
		const matches: string[] = [];
		let score = 0;
		for (let i = 0; i < hidden.length; i++) {
			const stem = hidden[i];
			if (!stem) continue;
			if (STEM_ELEMENT[stem] === 日主五行) {
				matches.push(stem);
				score += CANG_WEIGHT[i] ?? 0.3;
			}
		}
		总根气 += score;
		if (matches.length > 0) {
			柱位根.push({
				柱: key,
				地支: pillar.地支,
				同类藏干: matches,
				分值: Math.round(score * 10) / 10,
			});
		}
	}

	// 透藏平衡 — 比劫 (same-element ten-gods) vs 异类 (everything else)
	let 比劫透 = 0;
	let 比劫藏 = 0;
	let 异类透 = 0;
	let 异类藏 = 0;
	for (const [k, v] of Object.entries(tenGodStats)) {
		if (k === "比肩" || k === "劫财") {
			比劫透 += v.透;
			比劫藏 += v.藏;
		} else {
			异类透 += v.透;
			异类藏 += v.藏;
		}
	}

	return {
		日主得令,
		日主根气: { 日主五行, 柱位根, 总根气: Math.round(总根气 * 10) / 10 },
		透藏平衡: {
			比劫透,
			比劫藏,
			异类透,
			异类藏,
			比劫共: 比劫透 + 比劫藏,
			异类共: 异类透 + 异类藏,
		},
	};
}

const SCORING_METHOD = {
	algorithm: "tiangan-canggan-weighted",
	weights: {
		tiangan: 1.0,
		canggan: { benqi: 1.0, zhongqi: 0.5, yuqi: 0.3 },
	},
	notes:
		"Score = sum of heavenly-stem weights (1.0 per stem, four pillars) + sum of earth-branch hidden-stem weights by position (本气/中气/余气 = 1.0 / 0.5 / 0.3). No month-command bonus; no transparent-stem bonus. Treat values as relative presence, not classical 旺衰 strength.",
	upstream: "shunshi-bazi-core",
} as const;

/**
 * Restructure a pillar's 空亡 surface:
 *   - original `空亡` (joined-string of the pillar's own 旬 voids) → `所在旬空亡: string[]`
 *   - new `落空亡: { 日柱旬, 年柱旬 }` — does this pillar's earth branch fall into
 *     day-xun void / year-xun void. This mirrors the boolean test that upstream
 *     applies when injecting the `"空亡"` tag into 神煞, but surfaces the result
 *     as a structured field so consumers don't conflate it with `所在旬空亡`.
 */
function remapPillarKongWang<P extends { 地支: string; 空亡: string }>(
	pillar: P,
	dayKongSet: ReadonlySet<string>,
	yearKongSet: ReadonlySet<string>,
): Omit<P, "空亡"> & { 所在旬空亡: string[]; 落空亡: { 日柱旬: boolean; 年柱旬: boolean } } {
	const { 空亡, ...rest } = pillar;
	return {
		...rest,
		所在旬空亡: [...空亡],
		落空亡: {
			日柱旬: dayKongSet.has(pillar.地支),
			年柱旬: yearKongSet.has(pillar.地支),
		},
	};
}

export function enrichResult(
	result: GetBaziChartResult,
	birth: { year: number; month: number; day: number },
	referenceDate: string,
	liunianRange?: { start: number; end: number },
) {
	const bazi = result.八字;
	const refYear = Number(referenceDate.slice(0, 4));
	const startMd = parseIsoLikeDate(bazi.起运日期);
	const tenGodStats = computeTenGodStats(bazi.柱位详细);
	const pillarRelations = computePillarRelations(bazi);
	const effectiveLiunianRange = liunianRange ?? { start: refYear - 5, end: refYear + 15 };
	const liunian = computeLiunian(bazi.日主, effectiveLiunianRange, refYear);
	const decisionAids = computeDecisionAids(bazi, tenGodStats);
	const solarIso = chineseDateTimeToIso(bazi.公历);

	// 旬空 — derive from per-pillar 空亡 strings (each is already a 2-char xun-void pair).
	const dayKong = [...bazi.柱位详细.日柱.空亡];
	const yearKong = [...bazi.柱位详细.年柱.空亡];
	const dayKongSet = new Set(dayKong);
	const yearKongSet = new Set(yearKong);

	return {
		...result,
		meta: {
			referenceDateUsed: referenceDate,
			scoringMethod: SCORING_METHOD,
		},
		输入: {
			...result.输入,
			公历: fmtDtToIso(result.输入.公历),
		},
		真太阳时: result.真太阳时
			? {
					...result.真太阳时,
					钟表时间: fmtDtToIso(result.真太阳时.钟表时间),
					真太阳时: solarIso,
					修正秒数: Math.round(result.真太阳时.修正分钟 * 60),
				}
			: undefined,
		八字: {
			...bazi,
			公历: solarIso,
			旬空: { 日柱旬空: dayKong, 年柱旬空: yearKong },
			柱位详细: {
				年柱: remapPillarKongWang(bazi.柱位详细.年柱, dayKongSet, yearKongSet),
				月柱: remapPillarKongWang(bazi.柱位详细.月柱, dayKongSet, yearKongSet),
				日柱: {
					...remapPillarKongWang(bazi.柱位详细.日柱, dayKongSet, yearKongSet),
					主星: null,
					label: "日主",
					isDayMaster: true,
				},
				时柱: remapPillarKongWang(bazi.柱位详细.时柱, dayKongSet, yearKongSet),
			},
			十神统计: tenGodStats,
			柱间关系: pillarRelations,
			流年: liunian,
			流年范围: effectiveLiunianRange,
			决策辅助: decisionAids,
			大运: bazi.大运.map((yun) => ({
				...yun,
				日主关系: yun.日主关系 === "" ? null : yun.日主关系,
				当前: refYear >= yun.起始年份 && refYear <= yun.结束年份,
				起始虚岁: yun.起始年龄,
				起始实岁: startMd
					? actualAgeAt(
							birth.year,
							birth.month,
							birth.day,
							yun.起始年份,
							startMd.month,
							startMd.day,
						)
					: yun.起始年龄 - 1,
			})),
		},
	};
}

const inputShape = {
	year: z.number().int().describe("Gregorian year of birth"),
	month: z.number().int().min(1).max(12).describe("Gregorian month (1-12)"),
	day: z.number().int().min(1).max(31).describe("Gregorian day of month"),
	hour: z.number().int().min(0).max(23).describe("Hour of birth (0-23)"),
	minute: z.number().int().min(0).max(59).default(0).describe("Minute of birth (0-59)"),
	gender: z.union([z.literal(0), z.literal(1)]).describe("0 = female, 1 = male"),
	city: z
		.string()
		.optional()
		.describe("Birth city (Chinese name preferred); enables true-solar-time correction"),
	longitude: z.number().optional().describe("Birth longitude in degrees east"),
	latitude: z.number().optional().describe("Birth latitude in degrees north"),
	referenceDate: z
		.string()
		.regex(/^\d{4}-\d{1,2}-\d{1,2}$/)
		.optional()
		.describe(
			"Optional ISO date (YYYY-MM-DD). Accept this as an INPUT from the caller — pass it explicitly for historical reconstructions or hypothetical 'what if I looked at this chart at time T' queries. Defaults to system today when omitted. Controls which `八字.大运[].当前` is true and which `八字.流年[].当前` is true. Echoed back as `meta.referenceDateUsed`.",
		),
	liunianStart: z
		.number()
		.int()
		.optional()
		.describe("Start year (Gregorian) for the 流年 table. Defaults to referenceDate year - 5."),
	liunianEnd: z
		.number()
		.int()
		.optional()
		.describe("End year (Gregorian) for the 流年 table. Defaults to referenceDate year + 15."),
};

export function registerGetBaziChart(server: McpServer): void {
	server.registerTool(
		"getBaziChart",
		{
			title: "Get Bazi Chart (full time)",
			description: [
				"Compute a full Bazi chart from complete birth time. Requires year/month/day/hour. Use this when the birth hour is known.",
				"",
				"Output notes:",
				'- `八字.柱位详细.日柱.主星` is `null` (日主 carries no ten-god against itself). Identify the day-pillar via `日柱.isDayMaster === true`; `日柱.label` is `"日主"` for display. Only year/month/hour pillars carry real ten-god strings in `主星`.',
				"- `八字.柱位详细.日柱.副星` intentionally still contains ten-god strings (the day-pillar's earth-branch hidden stems carry real ten-god relations to the day-master — e.g. 辛 in 酉 is 七杀 to 乙 day-master). Only `主星` is nulled because 日主 has no ten-god against itself; 副星 is unaffected.",
				"- `八字.十神统计[十神]` aggregates ten-god counts as `{ 透, 藏, 共 }`. `透` counts from year/month/hour pillars' `主星`; `藏` counts from all four pillars' `副星` (earth-branch hidden stems). 日主 itself is excluded.",
				'- `八字.柱间关系` lists pair-wise (or triple-wise, for 三刑) relations between the four pillars, derived from upstream `刑冲合会`. Each entry is `{ kind: "天干"|"地支", type: "相合"|"相冲"|"相害"|"相破"|"暗合"|"自刑"|"三刑"|"克", pillars: [年|月|日|时, ...], 干支: [...], raw }`. When two pillars share the same stem/branch (e.g. two 乙 in month and day), a single upstream relation expands to multiple entries covering each possible pillar pair — the ambiguity is surfaced rather than hidden.',
				"- `八字.决策辅助` surfaces three derived metrics so consumers do not recompute them: `日主得令` (day-master element relation to month-command element + `得令` boolean), `日主根气` (day-master-element presence across all four earth-branch hidden-stems using canonical 本/中/余 weights 1.0/0.5/0.3), and `透藏平衡` (比劫 vs 异类 transparent/hidden counts). These are raw inputs — no 旺衰/格局/用神 judgement is baked in. Feed them into your own reasoning rules.",
				"- `八字.流年` is an array of year-by-year 流年 entries covering `八字.流年范围` (default: `[referenceDate year - 5, referenceDate year + 15]`, configurable via `liunianStart`/`liunianEnd`). Each entry is `{ 年份, 干支, 天干, 地支, 主星, 藏干, 藏干十神, 当前 }`; `主星` is the ten-god of the year stem against the day-master. 流年 vs 四柱/大运 relations are NOT pre-computed — derive them yourself by combining `流年[].干支` with `柱间关系` logic or `大运[].干支`. Year boundaries follow the 立春-based 干支年 convention (the first ~5 weeks of a Gregorian year before 立春 technically belong to the previous 干支年 — consult 八字.起运日期 semantics if this matters for your use case).",
				'- `八字.大运[].日主关系` is `null` when there is no relation (previously `""`).',
				"- `八字.大运[].当前` is computed from `meta.referenceDateUsed` (defaults to today). Override via the `referenceDate` input for historical or hypothetical scenarios.",
				"- `meta.scoringMethod` documents how `八字.五行分值` is computed, so consumers do not need to guess the weighting scheme.",
				"- Time strings (`输入.公历`, `真太阳时.钟表时间`, `真太阳时.真太阳时`, `八字.公历`) are all ISO 8601 with second precision (`YYYY-MM-DDTHH:MM:SS`). `真太阳时.修正分钟` is the original decimal-minute correction; `真太阳时.修正秒数` is the same value as a rounded integer number of seconds.",
				"- 空亡 is surfaced as three complementary fields (this server restructures upstream's ambiguous single-string surface). `八字.旬空 = { 日柱旬空: [...], 年柱旬空: [...] }` is the top-level index of void branches for the two traditional reference 旬s. Each pillar exposes `所在旬空亡: string[]` (the two branches void in *that pillar's own* 旬 — pure reference, does NOT imply this pillar is void) and `落空亡: { 日柱旬: boolean, 年柱旬: boolean }` (does this pillar's earth branch actually fall into day-xun / year-xun void). Prefer `落空亡` as the authoritative \"is this pillar in 空亡\" signal; upstream's `神煞` array still contains a `\"空亡\"` string for compatibility but it's the boolean-OR of `落空亡.日柱旬` and `落空亡.年柱旬`. For strict modern 以日起空亡 convention, use `落空亡.日柱旬` alone.",
				'- `八字.起运` is the precise duration from birth to the first decade cycle (e.g., `"6年7月22日起运"`), derived from the solar-term distance. `八字.起运日期` is the corresponding Gregorian date.',
				"- Each `八字.大运` entry exposes `起始虚岁` (East-Asian nominal age; equals the original `起始年龄`) and `起始实岁` (completed years at that decade-cycle start, derived from `起运日期` aligned to the birth month/day). They typically differ by 1-2.",
			].join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const { referenceDate, liunianStart, liunianEnd, ...coreInput } = input;
			const result = getBaziChart(coreInput);
			const effectiveRef = referenceDate ?? todayIsoDate();
			const refYear = Number(effectiveRef.slice(0, 4));
			const range = {
				start: liunianStart ?? refYear - 5,
				end: liunianEnd ?? refYear + 15,
			};
			const enriched = enrichResult(
				result,
				{
					year: input.year,
					month: input.month,
					day: input.day,
				},
				effectiveRef,
				range,
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(enriched, null, 2),
					},
				],
			};
		},
	);
}
