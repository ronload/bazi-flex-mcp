import { chineseDateTimeToIso, fmtDtToIso } from "../../time/iso.js";
import {
	type BirthDate,
	deriveXunKong,
	mapDayun,
	remapCorePillars,
	remapPillarKongWang,
} from "../shared/pillars.js";
import type { ResolvedChartRequest } from "../shared/request.js";
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
	upstream: "@bazi-flex/core",
} as const;

export function enrichResult(
	result: GetBaziChartResult,
	birth: BirthDate,
	req: ResolvedChartRequest,
) {
	const bazi = result.八字;
	const { referenceDate, liunianRange } = req;
	const tenGodStats = computeTenGodStats(bazi.柱位详细);
	const pillarRelations = computePillarRelations(bazi);
	const liunian = computeLiunian(bazi.日主, liunianRange, req.currentSexagenaryYear);
	const decisionAids = computeDecisionAids(bazi, tenGodStats);
	const solarIso = chineseDateTimeToIso(bazi.公历);
	const xunKong = deriveXunKong(bazi.柱位详细);

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
			旬空: xunKong,
			柱位详细: {
				...remapCorePillars(bazi.柱位详细, xunKong),
				时柱: remapPillarKongWang(bazi.柱位详细.时柱, xunKong),
			},
			十神统计: tenGodStats,
			柱间关系: pillarRelations,
			流年: liunian,
			流年范围: liunianRange,
			决策辅助: decisionAids,
			大运: mapDayun(bazi.大运, { xunKong, req, birth, 起运日期: bazi.起运日期 }),
		},
	};
}
