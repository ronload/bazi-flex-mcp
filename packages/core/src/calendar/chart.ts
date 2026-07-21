import { Gender, type SixtyCycle, SolarTime } from "tyme4ts";
import { findGanRelations, findZhiRelations } from "../lib/relations.js";
import { calcShenshaForPillars, type ShenshaResult } from "../lib/shensha.js";
import type { ClockDateTime } from "../lib/solarTime.js";
import { buildDayun, type DayunEntry } from "./dayun.js";
import { buildPillar, dayMasterStarOf, mainStarOf, type Pillar, voidBranchesOf } from "./pillar.js";
import { applySect, DEFAULT_SECT, type Sect } from "./sect.js";
import { calcWuxingScore, type WuxingScore } from "./wuxing.js";

export interface BaziChartInput {
	/** The true-solar-corrected civil datetime, or the raw clock time when correction is off. */
	solarDt: ClockDateTime;
	/** 0 = 女, 1 = 男 */
	gender: 0 | 1;
	sect?: Sect;
}

export interface BaziChart {
	四柱: string;
	日主: string;
	生肖: string;
	柱位详细: {
		年柱: Pillar;
		月柱: Pillar;
		日柱: Pillar;
		时柱: Pillar;
	};
	五行分值: WuxingScore;
	刑冲合会: {
		天干: string[];
		地支: string[];
	};
	起运: string;
	起运日期: string;
	大运: DayunEntry[];
	命宫: string;
	身宫: string;
	胎元: string;
	胎息: string;
	农历: string;
	公历: string;
}

const PILLAR_KEYS = ["年柱", "月柱", "日柱", "时柱"] as const;

type PillarKey = (typeof PILLAR_KEYS)[number];

/** 日柱旬 and 年柱旬 voids are both marked back onto whichever pillars fall in them. */
function markVoidPillars(shensha: ShenshaResult, cycles: Record<PillarKey, SixtyCycle>): void {
	const voids = new Set([...voidBranchesOf(cycles.日柱), ...voidBranchesOf(cycles.年柱)]);
	for (const key of PILLAR_KEYS) {
		const branch = cycles[key].getEarthBranch().toString();
		if (voids.has(branch) && !shensha[key].includes("空亡")) shensha[key].push("空亡");
	}
}

export function buildBaziChart(input: BaziChartInput): BaziChart {
	const { solarDt, gender, sect = DEFAULT_SECT } = input;

	applySect(sect);

	const solarTime = SolarTime.fromYmdHms(
		solarDt.year,
		solarDt.month,
		solarDt.day,
		solarDt.hour,
		solarDt.minute,
		solarDt.second ?? 0,
	);
	const lunarHour = solarTime.getLunarHour();
	const eightChar = lunarHour.getEightChar();

	const cycles: Record<PillarKey, SixtyCycle> = {
		年柱: eightChar.getYear(),
		月柱: eightChar.getMonth(),
		日柱: eightChar.getDay(),
		时柱: eightChar.getHour(),
	};
	const dayMaster = cycles.日柱.getHeavenStem();

	const shensha = calcShenshaForPillars({
		yearGan: cycles.年柱.getHeavenStem().toString(),
		yearZhi: cycles.年柱.getEarthBranch().toString(),
		monthGan: cycles.月柱.getHeavenStem().toString(),
		monthZhi: cycles.月柱.getEarthBranch().toString(),
		dayGan: dayMaster.toString(),
		dayZhi: cycles.日柱.getEarthBranch().toString(),
		timeGan: cycles.时柱.getHeavenStem().toString(),
		timeZhi: cycles.时柱.getEarthBranch().toString(),
		yearNayin: cycles.年柱.getSound().toString(),
		gender,
	});
	markVoidPillars(shensha, cycles);

	const ordered = PILLAR_KEYS.map((key) => cycles[key]);
	const dayun = buildDayun(solarTime, gender === 1 ? Gender.MAN : Gender.WOMAN, dayMaster);

	return {
		四柱: ordered.map((cycle) => cycle.toString()).join(" "),
		日主: dayMaster.toString(),
		生肖: cycles.年柱.getEarthBranch().getZodiac().toString(),
		柱位详细: {
			年柱: buildPillar(cycles.年柱, dayMaster, mainStarOf(cycles.年柱, dayMaster), shensha.年柱),
			月柱: buildPillar(cycles.月柱, dayMaster, mainStarOf(cycles.月柱, dayMaster), shensha.月柱),
			日柱: buildPillar(cycles.日柱, dayMaster, dayMasterStarOf(gender), shensha.日柱),
			时柱: buildPillar(cycles.时柱, dayMaster, mainStarOf(cycles.时柱, dayMaster), shensha.时柱),
		},
		五行分值: calcWuxingScore(ordered, dayMaster),
		刑冲合会: {
			天干: findGanRelations(ordered.map((cycle) => cycle.getHeavenStem().toString())),
			地支: findZhiRelations(ordered.map((cycle) => cycle.getEarthBranch().toString())),
		},
		起运: dayun.起运,
		起运日期: dayun.起运日期,
		大运: dayun.大运,
		命宫: eightChar.getOwnSign().toString(),
		身宫: eightChar.getBodySign().toString(),
		胎元: eightChar.getFetalOrigin().toString(),
		胎息: eightChar.getFetalBreath().toString(),
		农历: lunarHour.toString(),
		公历: solarTime.toString(),
	};
}
