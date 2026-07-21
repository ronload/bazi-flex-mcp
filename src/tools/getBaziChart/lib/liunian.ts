// shunshi-bazi-core has no 流年 API as of 0.2.0, so this table is built here.

import { BRANCH_HIDDEN } from "../../../ganzhi/data.js";
import { sexagenaryOfYear, tenStar } from "../../../ganzhi/index.js";

export interface LiunianEntry {
	/** 立春-bounded 干支年: 立春 of N through the day before 立春 of N+1. */
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
	currentSexagenaryYear: number,
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
			当前: y === currentSexagenaryYear,
		});
	}
	return out;
}
