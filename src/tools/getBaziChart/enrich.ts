import { actualAgeAt } from "../../time/age.js";
import { chineseDateTimeToIso, fmtDtToIso, parseIsoLikeDate } from "../../time/iso.js";
import { computeDecisionAids } from "./lib/decisionAids.js";
import { computeLiunian } from "./lib/liunian.js";
import { computePillarRelations } from "./lib/relations.js";
import { computeTenGodStats } from "./lib/tenGodStats.js";
import type { GetBaziChartResult } from "./types.js";

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
	const effectiveLiunianRange = liunianRange ?? { start: refYear - 3, end: refYear + 3 };
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
