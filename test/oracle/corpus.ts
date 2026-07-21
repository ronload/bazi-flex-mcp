/**
 * The fixed set of inputs the parity contract is evaluated over.
 *
 * Editing this file moves every downstream fingerprint, so growing the corpus is
 * an explicit act: bump `CORPUS_VERSION`, re-baseline, and never do it in the
 * same commit as a behaviour change or the diff becomes unreadable.
 *
 * Nothing here may consult the clock, the filesystem, or `Math.random()`.
 */

import { SolarTerm } from "tyme4ts";
import { ALL_CITY_NAMES, CANONICAL_CITIES, MERIDIAN_OVERRIDE_CITIES } from "./cities.js";
import { mulberry32 } from "./prng.js";

/** Recorded in the manifest so a stale baseline reads as "different corpus", not "regression". */
export const CORPUS_VERSION = 1;

/** The full upstream input space, including the fields the MCP schema does not expose. */
export interface CoreInput {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	gender: 0 | 1;
	city?: string;
	longitude?: number;
	latitude?: number;
	useTrueSolarTime?: boolean;
	standardMeridian?: number;
	sect?: 1 | 2;
}

export type Layer = "random" | "daypillar" | "midnight" | "lichun" | "jieqi" | "city";

export interface OracleCase {
	id: string;
	layer: Layer;
	core: CoreInput;
	/** Drives 流年/大运 `当前` on the tool surfaces. The core surface ignores it. */
	referenceDate: string;
	liunianStart?: number;
	liunianEnd?: number;
}

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

interface Wall {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

/** `Date` is used purely as a civil-calendar calculator over UTC; no timezone semantics apply. */
function addMinutes(w: Wall, delta: number): Wall {
	const d = new Date(0);
	d.setUTCFullYear(w.year, w.month - 1, w.day);
	d.setUTCHours(w.hour, w.minute + delta, 0, 0);
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
	};
}

function isValidYmd(year: number, month: number, day: number): boolean {
	const d = new Date(0);
	d.setUTCFullYear(year, month - 1, day);
	return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

function termInstant(year: number, name: string): Wall {
	const t = SolarTerm.fromName(year, name).getJulianDay().getSolarTime();
	return {
		year: t.getYear(),
		month: t.getMonth(),
		day: t.getDay(),
		hour: t.getHour(),
		minute: t.getMinute(),
	};
}

/** The 12 節 that open a 干支 month, in calendar order from 立春. */
export const JIE_NAMES = [
	"立春",
	"惊蛰",
	"清明",
	"立夏",
	"芒种",
	"小暑",
	"立秋",
	"白露",
	"寒露",
	"立冬",
	"大雪",
	"小寒",
] as const;

/**
 * Deliberately spans the Jan 1 to 立春 window, the only region where the
 * 立春-bounded 干支年 differs from the Gregorian year.
 */
const REFERENCE_DATES = [
	"2026-01-01",
	"2026-01-20",
	"2026-02-03",
	"2026-02-04",
	"2026-02-05",
	"2026-06-15",
	"2026-10-08",
	"2026-12-31",
] as const;

const RANDOM_CASES = 2000;
const RANDOM_SEED = 0x5eed_1a02;

function randomLayer(): OracleCase[] {
	const rng = mulberry32(RANDOM_SEED);
	const cases: OracleCase[] = [];
	for (let i = 0; i < RANDOM_CASES; i++) {
		let year = 0;
		let month = 0;
		let day = 0;
		do {
			year = rng.int(YEAR_MIN, YEAR_MAX);
			month = rng.int(1, 12);
			day = rng.int(1, 31);
		} while (!isValidYmd(year, month, day));

		const core: CoreInput = {
			year,
			month,
			day,
			hour: rng.int(0, 23),
			minute: rng.int(0, 59),
			gender: rng.chance(0.5) ? 1 : 0,
			sect: rng.chance(0.5) ? 1 : 2,
		};

		// Enter the 真太阳时 path by city lookup, by raw coordinates, and not at all.
		const mode = rng.int(0, 2);
		if (mode === 0) {
			core.city = rng.chance(0.2) ? rng.pick(MERIDIAN_OVERRIDE_CITIES) : rng.pick(ALL_CITY_NAMES);
			core.useTrueSolarTime = rng.chance(0.85);
		} else if (mode === 1) {
			core.longitude = Math.round((rng.next() * 360 - 180) * 10000) / 10000;
			core.latitude = Math.round((rng.next() * 140 - 70) * 10000) / 10000;
			core.useTrueSolarTime = rng.chance(0.85);
			if (rng.chance(0.15)) core.standardMeridian = rng.int(-12, 12) * 15;
		}

		cases.push({
			id: `random/${String(i).padStart(4, "0")}`,
			layer: "random",
			core,
			referenceDate: rng.pick(REFERENCE_DATES),
		});
	}
	return cases;
}

/**
 * 60 consecutive days is exactly one 甲子 cycle of 日柱, which covers all ten
 * sparse 神煞 day-pillar sets and every position of the 旬空 rotation. Random
 * sampling would miss most of them: some fire on three day pillars out of sixty.
 */
function dayPillarLayer(): OracleCase[] {
	const start: Wall = { year: 1984, month: 2, day: 2, hour: 10, minute: 30 };
	const cases: OracleCase[] = [];
	for (let i = 0; i < 60; i++) {
		const w = addMinutes(start, i * 24 * 60);
		cases.push({
			id: `daypillar/${String(i).padStart(2, "0")}`,
			layer: "daypillar",
			core: {
				year: w.year,
				month: w.month,
				day: w.day,
				hour: w.hour,
				minute: w.minute,
				gender: i % 2 === 0 ? 1 : 0,
				city: "北京",
			},
			referenceDate: "2026-06-15",
		});
	}
	return cases;
}

/**
 * 22:30 to 01:30 at 5-minute steps. Three things interact in this band and
 * nowhere else: 早子/晚子 (`sect` 1 puts 23:00 on the next day's pillar, `sect` 2
 * on today's), the 时辰 index rolling over 子时, and a true-solar-time correction
 * large enough to push the corrected instant into a different calendar day.
 *
 * 首尔 is the corrected variant because its standard-meridian override produces
 * the largest correction in the table.
 */
function midnightLayer(): OracleCase[] {
	const bases: Wall[] = [
		{ year: 1990, month: 6, day: 15, hour: 22, minute: 30 },
		{ year: 2024, month: 12, day: 31, hour: 22, minute: 30 },
	];
	const cases: OracleCase[] = [];
	for (const [b, base] of bases.entries()) {
		for (let step = 0; step <= 36; step++) {
			const w = addMinutes(base, step * 5);
			for (const sect of [1, 2] as const) {
				for (const city of [undefined, "首尔"] as const) {
					cases.push({
						id: `midnight/${b}-${String(step).padStart(2, "0")}-s${sect}-${city ?? "none"}`,
						layer: "midnight",
						core: {
							year: w.year,
							month: w.month,
							day: w.day,
							hour: w.hour,
							minute: w.minute,
							gender: 1,
							sect,
							...(city ? { city } : {}),
						},
						referenceDate: "2026-06-15",
					});
				}
			}
		}
	}
	return cases;
}

/**
 * The +/-1 minute pair is the reason this layer exists: it is the only place a
 * one-minute input difference must flip the 年柱, so a rounding error in the
 * solar-term computation surfaces here first.
 */
const LICHUN_OFFSETS_MINUTES = [-2880, -60, -1, 0, 1, 60, 2880] as const;

function lichunLayer(): OracleCase[] {
	const cases: OracleCase[] = [];
	for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
		const at = termInstant(y, "立春");
		for (const off of LICHUN_OFFSETS_MINUTES) {
			const w = addMinutes(at, off);
			cases.push({
				id: `lichun/${y}${off >= 0 ? "+" : "-"}${String(Math.abs(off)).padStart(4, "0")}`,
				layer: "lichun",
				core: {
					year: w.year,
					month: w.month,
					day: w.day,
					hour: w.hour,
					minute: w.minute,
					gender: y % 2 === 0 ? 1 : 0,
				},
				// 立春-adjacent charts read against 立春-adjacent reference dates, where
				// 干支年 arithmetic is most likely to be off by one.
				referenceDate: REFERENCE_DATES[y % REFERENCE_DATES.length] as string,
			});
		}
	}
	return cases;
}

/** Sampled rather than all 201 years, because 12 節 x 3 offsets is already 36 cases per year. */
const JIEQI_YEAR_STEP = 7;
const JIEQI_OFFSETS_MINUTES = [-1, 0, 1] as const;

function jieqiLayer(): OracleCase[] {
	const cases: OracleCase[] = [];
	for (let y = YEAR_MIN; y <= YEAR_MAX; y += JIEQI_YEAR_STEP) {
		for (const name of JIE_NAMES) {
			const at = termInstant(y, name);
			for (const off of JIEQI_OFFSETS_MINUTES) {
				const w = addMinutes(at, off);
				cases.push({
					id: `jieqi/${y}-${name}${off >= 0 ? "+" : "-"}${Math.abs(off)}`,
					layer: "jieqi",
					core: {
						year: w.year,
						month: w.month,
						day: w.day,
						hour: w.hour,
						minute: w.minute,
						gender: 1,
					},
					referenceDate: "2026-06-15",
				});
			}
		}
	}
	return cases;
}

/**
 * Every accepted city string, canonical and alias. Exhaustive because a single
 * wrong coordinate in the table is invisible to sampling yet shifts that city's
 * hour pillar forever. The instant sits near a 时辰 boundary so a correction of a
 * few minutes is enough to change the visible output.
 */
function cityLayer(): OracleCase[] {
	return ALL_CITY_NAMES.map((city, i) => ({
		id: `city/${String(i).padStart(3, "0")}-${city}`,
		layer: "city" as const,
		core: {
			year: 1988,
			month: 9,
			day: 21,
			hour: 12,
			minute: 58,
			gender: (i % 2 === 0 ? 1 : 0) as 0 | 1,
			city,
		},
		referenceDate: "2026-06-15",
	}));
}

let cached: OracleCase[] | null = null;

/** Only the determinism test needs this: `buildCorpus()` against itself proves nothing. */
export function buildCorpusUncached(): OracleCase[] {
	const all = [
		...randomLayer(),
		...dayPillarLayer(),
		...midnightLayer(),
		...lichunLayer(),
		...jieqiLayer(),
		...cityLayer(),
	];
	const seen = new Set<string>();
	for (const c of all) {
		if (seen.has(c.id)) throw new Error(`duplicate corpus case id: ${c.id}`);
		seen.add(c.id);
	}
	return all;
}

/** Memoised: building the corpus costs ~2500 solar-term computations. */
export function buildCorpus(): OracleCase[] {
	if (!cached) cached = buildCorpusUncached();
	return cached;
}

/** Exposed so the tests can assert the exhaustive layers really are exhaustive. */
export const CORPUS_EXPECTATIONS = {
	dayPillarCount: 60,
	cityCount: ALL_CITY_NAMES.length,
	canonicalCityCount: CANONICAL_CITIES.length,
	lichunYears: YEAR_MAX - YEAR_MIN + 1,
	jieCount: JIE_NAMES.length,
} as const;

export function isoDateOf(w: { year: number; month: number; day: number }): string {
	return isoDate(w.year, w.month, w.day);
}
