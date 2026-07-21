import { ChildLimit, type Gender, type HeavenStem, type SolarTime } from "tyme4ts";
import { findGanRelations } from "../lib/relations.js";
import { hiddenTenStarsOf, mainStarOf, voidBranchString } from "./pillar.js";

const DECADE_FORTUNE_COUNT = 9;

export interface DayunEntry {
	起始年龄: number;
	结束年龄: number;
	起始年份: number;
	结束年份: number;
	干支: string;
	天干: string;
	地支: string;
	天干五行: string;
	纳音: string;
	主星: string;
	藏干十神: string[];
	自坐: string;
	星运: string;
	空亡: string;
	日主关系: string;
	当前: boolean;
}

export interface Dayun {
	起运: string;
	起运日期: string;
	大运: DayunEntry[];
}

function dayMasterRelation(dayMaster: HeavenStem, fortuneStem: HeavenStem): string {
	const me = dayMaster.toString();
	const other = fortuneStem.toString();
	if (me === other) return "";
	return findGanRelations([me, other], true, ["日主", "大运"]).join(",");
}

export function buildDayun(
	solarTime: SolarTime,
	gender: Gender,
	dayMaster: HeavenStem,
	currentYear: number = new Date().getFullYear(),
): Dayun {
	const childLimit = ChildLimit.fromSolarTime(solarTime, gender);
	const 大运: DayunEntry[] = [];

	let fortune = childLimit.getStartDecadeFortune();
	for (let index = 0; index < DECADE_FORTUNE_COUNT; index++) {
		const cycle = fortune.getSixtyCycle();
		const stem = cycle.getHeavenStem();
		const branch = cycle.getEarthBranch();
		const startYear = fortune.getStartSixtyCycleYear().getYear();
		const endYear = fortune.getEndSixtyCycleYear().getYear();

		大运.push({
			起始年龄: fortune.getStartAge(),
			结束年龄: fortune.getEndAge(),
			起始年份: startYear,
			结束年份: endYear,
			干支: cycle.toString(),
			天干: stem.toString(),
			地支: branch.toString(),
			天干五行: stem.getElement().toString(),
			纳音: cycle.getSound().toString(),
			主星: mainStarOf(cycle, dayMaster),
			藏干十神: hiddenTenStarsOf(cycle, dayMaster),
			自坐: stem.getTerrain(branch).toString(),
			星运: dayMaster.getTerrain(branch).toString(),
			空亡: voidBranchString(cycle),
			日主关系: dayMasterRelation(dayMaster, stem),
			当前: currentYear >= startYear && currentYear <= endYear,
		});
		fortune = fortune.next(1);
	}

	const onset = childLimit.getEndTime();
	return {
		起运: `${childLimit.getYearCount()}年${childLimit.getMonthCount()}月${childLimit.getDayCount()}日起运`,
		起运日期: `${onset.getYear()}-${onset.getMonth()}-${onset.getDay()}`,
		大运,
	};
}
