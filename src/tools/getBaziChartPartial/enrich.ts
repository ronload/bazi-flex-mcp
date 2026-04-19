import { BRANCH_HIDDEN, type PillarKey, STEM_ELEMENT } from "../../ganzhi/data.js";
import { actualAgeAt } from "../../time/age.js";
import { parseIsoLikeDate } from "../../time/iso.js";
import { computeDecisionAids } from "../getBaziChart/lib/decisionAids.js";
import { computeLiunian } from "../getBaziChart/lib/liunian.js";
import { computePillarRelations } from "../getBaziChart/lib/relations.js";
import { computeTenGodStats } from "../getBaziChart/lib/tenGodStats.js";
import type { GetBaziChartResult } from "../getBaziChart/types.js";

const PARTIAL_PILLAR_KEYS: readonly PillarKey[] = ["年", "月", "日"] as const;

const SCORING_METHOD = {
	algorithm: "tiangan-canggan-weighted (3 pillars)",
	weights: {
		tiangan: 1.0,
		canggan: { benqi: 1.0, zhongqi: 0.5, yuqi: 0.3 },
	},
	notes:
		"Same weighting as the full-time chart, but summed over only 3 pillars (年/月/日) — time-pillar contributions are excluded because the birth hour is unknown. Treat values as relative presence, not classical 旺衰 strength.",
	upstream: "shunshi-bazi-core (post-processed: time pillar removed)",
} as const;

const DISCLAIMER = {
	时辰: "未提供。命盘以三柱（年/月/日）为准；时柱已从输出中剥除。",
	占位时辰:
		"上游 library 计算时使用 12:00 作为占位 hour（仅用于稳定取得日柱、避开 23:00 子时切换），随后在后处理中将所有依赖时辰的字段剥除或重算。",
	依赖时辰已置null: ["命宫", "身宫", "胎元", "胎息"],
	大运起运精度:
		"起运方向（顺/逆）只看年柱阴阳 + 性别，不受时辰影响。起运精确日期（八字.起运、八字.起运日期）依节气到出生时刻的距离计算，未提供时辰时可能有 ±1 天到 ±数月误差，对应大运 起始年份/结束年份 也可能 ±1 年。请将其视为大略时间窗口而非精确边界。",
	十神统计:
		"已重算：透 计数仅来自 年柱.主星 + 月柱.主星（不含时柱主星）；藏 计数仅来自 年/月/日柱.副星（不含时柱副星）。",
	柱间关系: "已过滤掉所有含 时 的 pair/triple；只保留 年/月/日 三柱之间的关系。",
	刑冲合会:
		"保留 upstream 的扁平字符串（无柱位标签），但其中可能仍含基于占位 12:00 时柱的关系条目，请改看已过滤的 八字.柱间关系。",
	决策辅助:
		"日主根气 已重算，只看 3 柱地支藏干；透藏平衡 自动随 十神统计 更新；日主得令 不依赖时辰，与 full-time 版相同。",
	五行分值:
		"已重算，扣除时柱天干（1.0）与时柱藏干（1.0/0.5/0.3）的贡献；占比按 3 柱新总分重新归一。",
	真太阳时: "未输出。真太阳时校正只在已知时辰时才有意义，partial mode 不计算。",
} as const;

const WUXING_KEYS = ["金", "木", "水", "火", "土"] as const;
const CANG_WEIGHT = [1.0, 0.5, 0.3] as const;

interface WuxingEntry {
	分值: number;
	占比: string;
}
type WuxingScore = Record<(typeof WUXING_KEYS)[number], WuxingEntry> & { 日主五行: string };

function recomputeWuxingScore(
	pillars: {
		年柱: { 天干: string; 地支: string };
		月柱: { 天干: string; 地支: string };
		日柱: { 天干: string; 地支: string };
	},
	dayMaster: string,
): WuxingScore {
	const scores: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
	const keys = ["年", "月", "日"] as const;
	for (const key of keys) {
		const p = pillars[`${key}柱` as const];
		const stemEl = STEM_ELEMENT[p.天干];
		if (stemEl) scores[stemEl] = (scores[stemEl] ?? 0) + 1.0;
		const hidden = BRANCH_HIDDEN[p.地支] ?? [];
		hidden.forEach((h, idx) => {
			const el = STEM_ELEMENT[h];
			const w = CANG_WEIGHT[idx] ?? 0.3;
			if (el) scores[el] = (scores[el] ?? 0) + w;
		});
	}
	const total = Object.values(scores).reduce((a, b) => a + b, 0);
	const out = {} as Record<(typeof WUXING_KEYS)[number], WuxingEntry>;
	for (const wx of WUXING_KEYS) {
		const v = scores[wx] ?? 0;
		out[wx] = {
			分值: Math.round(v * 10) / 10,
			占比: total > 0 ? `${Math.round((v / total) * 100)}%` : "0%",
		};
	}
	return { ...out, 日主五行: STEM_ELEMENT[dayMaster] ?? "" };
}

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

export function enrichPartialResult(
	result: GetBaziChartResult,
	birth: { year: number; month: number; day: number },
	referenceDate: string,
	liunianRange?: { start: number; end: number },
) {
	const bazi = result.八字;
	const refYear = Number(referenceDate.slice(0, 4));
	const startMd = parseIsoLikeDate(bazi.起运日期);

	const partialPillars = {
		年柱: bazi.柱位详细.年柱,
		月柱: bazi.柱位详细.月柱,
		日柱: bazi.柱位详细.日柱,
	};

	const tenGodStats = computeTenGodStats(partialPillars);
	const allPillarRelations = computePillarRelations(bazi);
	const pillarRelations = allPillarRelations.filter((r) => !r.pillars.includes("时"));
	const effectiveLiunianRange = liunianRange ?? { start: refYear - 3, end: refYear + 3 };
	const liunian = computeLiunian(bazi.日主, effectiveLiunianRange, refYear);
	const decisionAids = computeDecisionAids(bazi, tenGodStats, PARTIAL_PILLAR_KEYS);
	const wuxingScore = recomputeWuxingScore(partialPillars, bazi.日主);

	const dayKong = [...bazi.柱位详细.日柱.空亡];
	const yearKong = [...bazi.柱位详细.年柱.空亡];
	const dayKongSet = new Set(dayKong);
	const yearKongSet = new Set(yearKong);

	const birthDateIso = `${birth.year.toString().padStart(4, "0")}-${birth.month.toString().padStart(2, "0")}-${birth.day.toString().padStart(2, "0")}`;

	const { 真太阳时: _omitTrueSolar, 八字: _omitBazi, 输入: _omitInput, ...restResult } = result;

	return {
		...restResult,
		meta: {
			referenceDateUsed: referenceDate,
			scoringMethod: SCORING_METHOD,
			disclaimer: DISCLAIMER,
		},
		输入: {
			公历: birthDateIso,
			性别: result.输入.性别,
			时辰: null,
		},
		八字: {
			...bazi,
			公历: birthDateIso,
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
			},
			十神统计: tenGodStats,
			柱间关系: pillarRelations,
			流年: liunian,
			流年范围: effectiveLiunianRange,
			决策辅助: decisionAids,
			五行分值: wuxingScore,
			命宫: null,
			身宫: null,
			胎元: null,
			胎息: null,
			大运: bazi.大运.map((yun) => {
				const remapped = remapPillarKongWang(yun, dayKongSet, yearKongSet);
				return {
					...remapped,
					日主关系: remapped.日主关系 === "" ? null : remapped.日主关系,
					当前: refYear >= remapped.起始年份 && refYear <= remapped.结束年份,
					起始虚岁: remapped.起始年龄,
					起始实岁: startMd
						? actualAgeAt(
								birth.year,
								birth.month,
								birth.day,
								remapped.起始年份,
								startMd.month,
								startMd.day,
							)
						: remapped.起始年龄 - 1,
				};
			}),
		},
	};
}
