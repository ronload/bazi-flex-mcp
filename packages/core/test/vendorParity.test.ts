import { describe, expect, test } from "bun:test";
import * as upstreamCityCache from "../../../node_modules/shunshi-bazi-core/dist/lib/cityCache.js";
import * as upstreamRelations from "../../../node_modules/shunshi-bazi-core/dist/lib/relations.js";
import * as upstreamShensha from "../../../node_modules/shunshi-bazi-core/dist/lib/shensha.js";
import * as upstreamSolarTime from "../../../node_modules/shunshi-bazi-core/dist/lib/solarTime.js";
import { CITY_ALIASES, CITY_CACHE, getLocation } from "../src/lib/cityCache.js";
import { findGanRelations, findZhiRelations } from "../src/lib/relations.js";
import { calcShenshaForPillars } from "../src/lib/shensha.js";
import { calcSolarTimeInfo, type ClockDateTime, trueSolarTime } from "../src/lib/solarTime.js";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = [
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

const SEXAGENARY = Array.from({ length: 60 }, (_, i) => ({
	gan: STEMS[i % 10] as string,
	zhi: BRANCHES[i % 12] as string,
}));

const NAYIN_SAMPLES = ["", "大林木", "炉中火", "壁上土", "剑锋金", "涧下水"];

/**
 * Compares each vendored module against the compiled upstream artifact it was
 * copied from. The upstream exports map only opens ".", so the internals are
 * reached by file path. This is what licenses editing the vendored source: a
 * narrowing or refactor that changes behaviour shows up here.
 */
function expectSame(actual: unknown, expected: unknown, label: string) {
	expect(`${label}: ${JSON.stringify(actual)}`).toBe(`${label}: ${JSON.stringify(expected)}`);
}

describe("shensha", () => {
	test("every 日柱 against every 年柱, both genders", () => {
		for (const day of SEXAGENARY) {
			for (const year of SEXAGENARY) {
				for (const gender of [0, 1] as const) {
					const input = {
						yearGan: year.gan,
						yearZhi: year.zhi,
						monthGan: "丙",
						monthZhi: "寅",
						dayGan: day.gan,
						dayZhi: day.zhi,
						timeGan: "戊",
						timeZhi: "子",
						gender,
					};
					expectSame(
						calcShenshaForPillars(input),
						upstreamShensha.calcShenshaForPillars(input),
						`${year.gan}${year.zhi}/${day.gan}${day.zhi}/${gender}`,
					);
				}
			}
		}
	});

	test("every 月柱 against every 时柱", () => {
		for (const month of SEXAGENARY) {
			for (const time of SEXAGENARY) {
				const input = {
					yearGan: "甲",
					yearZhi: "子",
					monthGan: month.gan,
					monthZhi: month.zhi,
					dayGan: "庚",
					dayZhi: "午",
					timeGan: time.gan,
					timeZhi: time.zhi,
				};
				expectSame(
					calcShenshaForPillars(input),
					upstreamShensha.calcShenshaForPillars(input),
					`${month.gan}${month.zhi}/${time.gan}${time.zhi}`,
				);
			}
		}
	});

	test("每个纳音 drives 年柱 五行 lookups the same way", () => {
		for (const yearNayin of NAYIN_SAMPLES) {
			for (const day of SEXAGENARY) {
				const input = {
					yearGan: "壬",
					yearZhi: "申",
					monthGan: "丙",
					monthZhi: "寅",
					dayGan: day.gan,
					dayZhi: day.zhi,
					timeGan: "戊",
					timeZhi: "子",
					yearNayin,
				};
				expectSame(
					calcShenshaForPillars(input),
					upstreamShensha.calcShenshaForPillars(input),
					`${yearNayin}/${day.gan}${day.zhi}`,
				);
			}
		}
	});
});

describe("relations", () => {
	test("all four-stem combinations, short and labelled", () => {
		for (const a of STEMS) {
			for (const b of STEMS) {
				for (const c of STEMS) {
					const gans = [a, b, c, "癸"];
					for (const short of [true, false]) {
						expectSame(
							findGanRelations(gans, short),
							upstreamRelations.findGanRelations(gans, short),
							`${gans.join("")}/${short}`,
						);
					}
				}
			}
		}
	});

	test("all four-branch combinations, short and labelled", () => {
		for (const a of BRANCHES) {
			for (const b of BRANCHES) {
				for (const c of BRANCHES) {
					const zhis = [a, b, c, "亥"];
					for (const short of [true, false]) {
						expectSame(
							findZhiRelations(zhis, short),
							upstreamRelations.findZhiRelations(zhis, short),
							`${zhis.join("")}/${short}`,
						);
					}
				}
			}
		}
	});

	test("arity other than four", () => {
		for (const n of [0, 1, 2, 3, 5]) {
			const gans = STEMS.slice(0, n);
			const zhis = BRANCHES.slice(0, n);
			expectSame(
				findGanRelations([...gans], false),
				upstreamRelations.findGanRelations([...gans], false),
				`gan arity ${n}`,
			);
			expectSame(
				findZhiRelations([...zhis], false),
				upstreamRelations.findZhiRelations([...zhis], false),
				`zhi arity ${n}`,
			);
		}
	});
});

describe("cityCache", () => {
	test("every cached city and alias resolves identically", () => {
		for (const city of [...Object.keys(CITY_CACHE), ...Object.keys(CITY_ALIASES)]) {
			expectSame(getLocation(city), upstreamCityCache.getLocation(city), city);
		}
	});

	test("unknown cities throw on both sides", () => {
		for (const city of ["", "  ", "Atlantis", "默认city", "預設", "默認"]) {
			let mine: string | [number, number] | [number, number, number];
			let theirs: string | [number, number] | [number, number, number];
			try {
				mine = getLocation(city);
			} catch (e) {
				mine = `threw: ${(e as Error).message}`;
			}
			try {
				theirs = upstreamCityCache.getLocation(city);
			} catch (e) {
				theirs = `threw: ${(e as Error).message}`;
			}
			expectSame(mine, theirs, city);
		}
	});
});

describe("solarTime", () => {
	const CITIES = ["北京", "首尔", "巴黎", "东京", "纽约", "台北", "悉尼"];
	const DATES: ClockDateTime[] = [];
	for (const month of [1, 3, 6, 9, 12]) {
		for (const day of [1, 15, 28]) {
			for (const hour of [0, 5, 11, 12, 18, 23]) {
				DATES.push({ year: 1990, month, day, hour, minute: 37, second: 0 });
			}
		}
	}

	test("calcSolarTimeInfo over cities, dates and hours", () => {
		for (const city of CITIES) {
			for (const dt of DATES) {
				expectSame(
					calcSolarTimeInfo(dt, { city }),
					upstreamSolarTime.calcSolarTimeInfo(dt, { city }),
					`${city}/${dt.month}-${dt.day}T${dt.hour}`,
				);
			}
		}
	});

	test("trueSolarTime across the longitude range", () => {
		for (let lon = -180; lon <= 180; lon += 5) {
			for (const dt of DATES) {
				expectSame(
					trueSolarTime(dt, lon),
					upstreamSolarTime.trueSolarTime(dt, lon),
					`${lon}/${dt.month}-${dt.day}T${dt.hour}`,
				);
			}
		}
	});

	test("explicit standardMeridian overrides the cache", () => {
		for (const sm of [0, 15, 120, 135]) {
			for (const dt of DATES) {
				const opts = { lat: 37.57, lon: 126.98, standardMeridian: sm };
				expectSame(
					calcSolarTimeInfo(dt, opts),
					upstreamSolarTime.calcSolarTimeInfo(dt, opts),
					`${sm}/${dt.month}-${dt.day}T${dt.hour}`,
				);
			}
		}
	});
});
