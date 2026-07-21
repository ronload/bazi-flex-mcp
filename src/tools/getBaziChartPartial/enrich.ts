import type { PillarKey } from "../../ganzhi/data.js";
import { computeDecisionAids } from "../getBaziChart/lib/decisionAids.js";
import { computeLiunian } from "../getBaziChart/lib/liunian.js";
import { computePillarRelations } from "../getBaziChart/lib/relations.js";
import { computeTenGodStats } from "../getBaziChart/lib/tenGodStats.js";
import type { GetThreePillarChartResult } from "../getBaziChart/types.js";
import { type BirthDate, deriveXunKong, mapDayun, remapCorePillars } from "../shared/pillars.js";
import type { ResolvedChartRequest } from "../shared/request.js";

const PARTIAL_PILLAR_KEYS: readonly PillarKey[] = ["年", "月", "日"] as const;

const SCORING_METHOD = {
	algorithm: "tiangan-canggan-weighted (3 pillars)",
	weights: {
		tiangan: 1.0,
		canggan: { benqi: 1.0, zhongqi: 0.5, yuqi: 0.3 },
	},
	notes:
		"Same weighting as the full-time chart, but summed over only 3 pillars (年/月/日) because the birth hour is unknown. Treat values as relative presence, not classical 旺衰 strength.",
	upstream: "@bazi-flex/core",
} as const;

const DISCLAIMER = {
	时辰: "未提供。命盘原生以三柱（年/月/日）计算，不引入任何占位时辰。",
	年月柱定法:
		"年柱/月柱采整日归属：交节当天的整日都算入新的月令（以及立春当天算入新的干支年）。若出生当天正好交节，见 八字.节气歧义 — 其中 此刻之前 才是交节前出生者的年/月柱。非交节日 八字.节气歧义 为 null。",
	依赖时辰为null: ["命宫", "身宫", "胎元", "胎息"],
	大运起运精度:
		"起运方向（顺/逆）只看年柱阴阳 + 性别，不受时辰影响。起运日期以「当天所属月令时段的中点」为基准推算，未知时辰时可能有 ±1 天到 ±数月误差，对应大运 起始年份/结束年份 也可能 ±1 年。请视为大略时间窗口而非精确边界。",
	十神统计: "只统计 3 柱：透 = 年柱.主星 + 月柱.主星；藏 = 年/月/日柱.副星。",
	刑冲合会: "只含 年/月/日 三柱之间的关系；带柱位标签的版本见 八字.柱间关系。",
	五行分值: "只累加 3 柱的天干与藏干；占比按 3 柱总分归一。",
	决策辅助: "日主根气 只看 3 柱地支藏干；日主得令 只依赖月柱，与 full-time 版相同。",
	真太阳时: "未输出。真太阳时校正只会移动时柱，未知时辰时没有意义。",
} as const;

export function enrichPartialResult(
	result: GetThreePillarChartResult,
	birth: BirthDate,
	req: ResolvedChartRequest,
) {
	const bazi = result.八字;
	const { referenceDate, liunianRange } = req;

	const tenGodStats = computeTenGodStats(bazi.柱位详细);
	const pillarRelations = computePillarRelations(bazi, PARTIAL_PILLAR_KEYS);
	const liunian = computeLiunian(bazi.日主, liunianRange, req.currentSexagenaryYear);
	const decisionAids = computeDecisionAids(bazi, tenGodStats, PARTIAL_PILLAR_KEYS);
	const xunKong = deriveXunKong(bazi.柱位详细);

	return {
		meta: {
			referenceDateUsed: referenceDate,
			scoringMethod: SCORING_METHOD,
			disclaimer: DISCLAIMER,
		},
		输入: {
			公历: result.输入.公历,
			性别: result.输入.性别,
			时辰: null,
		},
		八字: {
			...bazi,
			公历: result.输入.公历,
			旬空: xunKong,
			柱位详细: remapCorePillars(bazi.柱位详细, xunKong),
			十神统计: tenGodStats,
			柱间关系: pillarRelations,
			流年: liunian,
			流年范围: liunianRange,
			决策辅助: decisionAids,
			大运: mapDayun(bazi.大运, { xunKong, req, birth, 起运日期: bazi.起运日期 }),
		},
	};
}
