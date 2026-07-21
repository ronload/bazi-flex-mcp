import { describe, expect, test } from "bun:test";
import { SolarTerm } from "tyme4ts";
import { sexagenaryYearOfDate, sexagenaryYearOfYmd } from "./sexagenaryYear.js";

describe("sexagenaryYearOfYmd", () => {
	test("Jan 1 through the day before 立春 belongs to the previous 干支年", () => {
		expect(sexagenaryYearOfYmd(2026, 1, 1)).toBe(2025);
		expect(sexagenaryYearOfYmd(2026, 1, 15)).toBe(2025);
		expect(sexagenaryYearOfYmd(2026, 2, 3)).toBe(2025);
	});

	test("立春 day starts the new 干支年", () => {
		expect(sexagenaryYearOfYmd(2026, 2, 4)).toBe(2026);
		expect(sexagenaryYearOfYmd(2026, 2, 5)).toBe(2026);
		expect(sexagenaryYearOfYmd(2026, 12, 31)).toBe(2026);
	});

	test("handles years whose 立春 falls on Feb 3", () => {
		expect(sexagenaryYearOfYmd(2025, 2, 2)).toBe(2024);
		expect(sexagenaryYearOfYmd(2025, 2, 3)).toBe(2025);
	});

	test("立春 day counts in full regardless of the instant", () => {
		// 立春 2021 lands near 22:59, 2050 and 2083 similarly close to midnight.
		expect(sexagenaryYearOfYmd(2021, 2, 3)).toBe(2021);
		expect(sexagenaryYearOfYmd(2021, 2, 2)).toBe(2020);
		expect(sexagenaryYearOfYmd(2050, 2, 3)).toBe(2050);
		expect(sexagenaryYearOfYmd(2083, 2, 3)).toBe(2083);
	});

	test("covers both ends of tyme4ts's domain without throwing", () => {
		expect(sexagenaryYearOfYmd(9999, 12, 31)).toBe(9999);
		expect(sexagenaryYearOfYmd(1, 1, 1)).toBe(0);
		expect(sexagenaryYearOfYmd(1900, 2, 4)).toBe(1900);
		expect(sexagenaryYearOfYmd(2100, 2, 4)).toBe(2100);
	});

	test("echoes out-of-domain years back instead of throwing", () => {
		expect(sexagenaryYearOfYmd(0, 1, 1)).toBe(0);
		expect(sexagenaryYearOfYmd(-4, 1, 1)).toBe(-4);
		expect(sexagenaryYearOfYmd(10000, 1, 1)).toBe(10000);
		expect(sexagenaryYearOfYmd(2026.7, 1, 1)).toBe(2026.7);
	});

	test("every boundary from 1900 to 2100 is self-consistent", () => {
		for (let y = 1900; y <= 2100; y++) {
			const lichun = SolarTerm.fromName(y, "立春").getSolarDay();
			const m = lichun.getMonth();
			const d = lichun.getDay();
			expect(m).toBe(2);
			expect(d).toBeGreaterThanOrEqual(3);
			expect(d).toBeLessThanOrEqual(5);

			expect(sexagenaryYearOfYmd(y, m, d), `${y} on 立春`).toBe(y);
			expect(sexagenaryYearOfYmd(y, m, d - 1), `${y} day before 立春`).toBe(y - 1);
			expect(sexagenaryYearOfYmd(y, 1, 1), `${y}-01-01`).toBe(y - 1);
			expect(sexagenaryYearOfYmd(y, 12, 31), `${y}-12-31`).toBe(y);
		}
	});

	test("立春 spans Feb 3 to Feb 5, bounding the affected window at 33 to 35 days", () => {
		const dist: Record<number, number> = {};
		for (let y = 1900; y <= 2100; y++) {
			const d = SolarTerm.fromName(y, "立春").getSolarDay().getDay();
			dist[d] = (dist[d] ?? 0) + 1;
		}
		expect(Object.keys(dist).map(Number).sort()).toEqual([3, 4, 5]);
	});
});

describe("sexagenaryYearOfDate", () => {
	test("parses ISO-like dates, with or without zero padding", () => {
		expect(sexagenaryYearOfDate("2026-01-15")).toBe(2025);
		expect(sexagenaryYearOfDate("2026-02-04")).toBe(2026);
		expect(sexagenaryYearOfDate("2026-2-4")).toBe(2026);
		expect(sexagenaryYearOfDate("2026-1-15")).toBe(2025);
	});

	test("falls back to the leading Gregorian year when unparseable", () => {
		expect(sexagenaryYearOfDate("2026")).toBe(2026);
		expect(sexagenaryYearOfDate("garbage")).toBeNaN();
	});
});
