/**
 * The three-pillar chart used to be produced by computing a full chart at a
 * placeholder 12:00 and stripping the hour pillar afterwards. It is now built
 * natively, so these tests pin what that switch was and was not allowed to move.
 *
 * On a day that carries no 節 the two paths must still agree exactly, down to
 * 神煞 and 起运日期: the window midpoint the native path uses as its reference
 * moment is 12:00 on those days. On a 節 day they deliberately disagree, and
 * `节气歧义` is what makes the disagreement legible.
 */

import { describe, expect, test } from "bun:test";
import { SolarDay } from "tyme4ts";
import { buildBaziChart } from "../src/calendar/chart.js";
import { termAmbiguityOf } from "../src/calendar/term.js";
import { getThreePillarChart } from "../src/getThreePillarChart.js";

const SWEEP_TIMEOUT_MS = 60_000;

const SWEEP_START_YEAR = 1950;
const SWEEP_END_YEAR = 2050;

function* sweepDays(): Generator<{ year: number; month: number; day: number }> {
	for (let year = SWEEP_START_YEAR; year <= SWEEP_END_YEAR; year++) {
		for (let month = 1; month <= 12; month++) {
			const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
			for (let day = 1; day <= daysInMonth; day++) yield { year, month, day };
		}
	}
}

function fullChartAtNoon(date: { year: number; month: number; day: number }) {
	return buildBaziChart({
		solarDt: { ...date, hour: 12, minute: 0, second: 0 },
		gender: 1,
	});
}

describe("three-pillar chart", () => {
	test(
		"on a day with no 節 every shared field matches the noon full chart",
		() => {
			const divergences: string[] = [];
			for (const date of sweepDays()) {
				const solarDay = SolarDay.fromYmd(date.year, date.month, date.day);
				if (termAmbiguityOf(solarDay) !== null) continue;

				const native = getThreePillarChart({ ...date, gender: 1 }).八字;
				const full = fullChartAtNoon(date);
				const label = `${date.year}-${date.month}-${date.day}`;

				const nativeShared = {
					日主: native.日主,
					生肖: native.生肖,
					年柱: native.柱位详细.年柱,
					月柱: native.柱位详细.月柱,
					日柱: native.柱位详细.日柱,
					起运: native.起运,
					起运日期: native.起运日期,
					大运: native.大运,
				};
				const fullShared = {
					日主: full.日主,
					生肖: full.生肖,
					年柱: full.柱位详细.年柱,
					月柱: full.柱位详细.月柱,
					日柱: full.柱位详细.日柱,
					起运: full.起运,
					起运日期: full.起运日期,
					大运: full.大运,
				};
				if (JSON.stringify(nativeShared) !== JSON.stringify(fullShared)) {
					divergences.push(label);
					if (divergences.length > 3) break;
				}
			}
			expect(divergences).toEqual([]);
		},
		SWEEP_TIMEOUT_MS,
	);

	test("五行分值 excludes the hour pillar, so it never equals the four-pillar score", () => {
		const native = getThreePillarChart({ year: 1990, month: 6, day: 15, gender: 1 }).八字;
		const full = fullChartAtNoon({ year: 1990, month: 6, day: 15 });
		expect(native.五行分值).not.toEqual(full.五行分值);
		const total = (["金", "木", "水", "火", "土"] as const).reduce(
			(sum, element) => sum + native.五行分值[element].分值,
			0,
		);
		// 3 stems at 1.0 plus each branch's hidden stems at 1.0 / 0.5 / 0.3.
		expect(total).toBeLessThanOrEqual(3 + 3 * 1.8);
	});

	test("刑冲合会 never mentions a relation the four-pillar chart does not have", () => {
		for (const date of [
			{ year: 1990, month: 6, day: 15 },
			{ year: 2002, month: 5, day: 17 },
			{ year: 1974, month: 11, day: 3 },
		]) {
			const native = getThreePillarChart({ ...date, gender: 1 }).八字;
			const full = fullChartAtNoon(date);
			for (const relation of native.刑冲合会.天干) {
				expect(full.刑冲合会.天干).toContain(relation);
			}
			for (const relation of native.刑冲合会.地支) {
				expect(full.刑冲合会.地支).toContain(relation);
			}
		}
	});

	test("hour-dependent fields are null and no placeholder hour leaks into the strings", () => {
		const chart = getThreePillarChart({ year: 2000, month: 2, day: 4, gender: 1 }).八字;
		expect(chart.命宫).toBeNull();
		expect(chart.身宫).toBeNull();
		expect(chart.胎元).toBeNull();
		expect(chart.胎息).toBeNull();
		expect(chart.三柱.split(" ")).toHaveLength(3);
		expect(chart.农历).toBe("农历己卯年十二月廿九");
		expect(chart.柱位详细).not.toHaveProperty("时柱");
	});
});

describe("节气歧义", () => {
	test("is null exactly on the days that carry no 節", () => {
		expect(
			getThreePillarChart({ year: 2000, month: 2, day: 5, gender: 1 }).八字.节气歧义,
		).toBeNull();

		const ambiguity = getThreePillarChart({ year: 2000, month: 2, day: 4, gender: 1 }).八字
			.节气歧义;
		expect(ambiguity).not.toBeNull();
		expect(ambiguity?.节气).toBe("立春");
		expect(ambiguity?.影响).toEqual(["年柱", "月柱"]);
		expect(ambiguity?.此刻之前).toEqual({ 年柱: "己卯", 月柱: "丁丑" });
		expect(ambiguity?.此刻之后).toEqual({ 年柱: "庚辰", 月柱: "戊寅" });
	});

	test(
		"此刻之后 is always what the chart reports, and 此刻之前 is what a midnight birth gets",
		() => {
			const divergences: string[] = [];
			for (const date of sweepDays()) {
				const solarDay = SolarDay.fromYmd(date.year, date.month, date.day);
				const ambiguity = termAmbiguityOf(solarDay);
				if (ambiguity === null) continue;

				const chart = getThreePillarChart({ ...date, gender: 1 }).八字;
				const midnight = buildBaziChart({
					solarDt: { ...date, hour: 0, minute: 0, second: 0 },
					gender: 1,
				});
				const label = `${date.year}-${date.month}-${date.day}`;
				if (
					chart.柱位详细.年柱.干支 !== ambiguity.此刻之后.年柱 ||
					chart.柱位详细.月柱.干支 !== ambiguity.此刻之后.月柱 ||
					midnight.柱位详细.年柱.干支 !== ambiguity.此刻之前.年柱 ||
					midnight.柱位详细.月柱.干支 !== ambiguity.此刻之前.月柱
				) {
					divergences.push(label);
					if (divergences.length > 3) break;
				}
			}
			expect(divergences).toEqual([]);
		},
		SWEEP_TIMEOUT_MS,
	);
});
