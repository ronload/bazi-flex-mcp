import { describe, expect, test } from "bun:test";
import { resolveChartRequest } from "./request.js";

describe("resolveChartRequest", () => {
	test("referenceYear is Gregorian, currentSexagenaryYear is 立春-bounded", () => {
		const midYear = resolveChartRequest({ referenceDate: "2026-07-21" });
		expect(midYear.referenceYear).toBe(2026);
		expect(midYear.currentSexagenaryYear).toBe(2026);

		const preLichun = resolveChartRequest({ referenceDate: "2026-01-15" });
		expect(preLichun.referenceYear).toBe(2026);
		expect(preLichun.currentSexagenaryYear).toBe(2025);
	});

	test("the default 流年 window centres on the 干支年, not the Gregorian year", () => {
		expect(resolveChartRequest({ referenceDate: "2026-07-21" }).liunianRange).toEqual({
			start: 2023,
			end: 2029,
		});
		// Centring on the Gregorian year here would give [2023, 2029], which is
		// [-2, +4] around the actual current 干支年 of 2025.
		expect(resolveChartRequest({ referenceDate: "2026-01-15" }).liunianRange).toEqual({
			start: 2022,
			end: 2028,
		});
	});

	test("the default window always contains the current 干支年", () => {
		for (const d of ["2026-01-01", "2026-02-03", "2026-02-04", "2026-07-21", "2026-12-31"]) {
			const r = resolveChartRequest({ referenceDate: d });
			expect(r.currentSexagenaryYear).toBeGreaterThanOrEqual(r.liunianRange.start);
			expect(r.currentSexagenaryYear).toBeLessThanOrEqual(r.liunianRange.end);
		}
	});

	test("liunianStart and liunianEnd override independently", () => {
		const onlyStart = resolveChartRequest({ referenceDate: "2026-07-21", liunianStart: 2000 });
		expect(onlyStart.liunianRange).toEqual({ start: 2000, end: 2029 });

		const onlyEnd = resolveChartRequest({ referenceDate: "2026-07-21", liunianEnd: 2040 });
		expect(onlyEnd.liunianRange).toEqual({ start: 2023, end: 2040 });

		const both = resolveChartRequest({
			referenceDate: "2026-07-21",
			liunianStart: 2024,
			liunianEnd: 2028,
		});
		expect(both.liunianRange).toEqual({ start: 2024, end: 2028 });
	});

	test("falls back to the injected clock when referenceDate is absent", () => {
		const r = resolveChartRequest({}, () => "2026-01-15");
		expect(r.referenceDate).toBe("2026-01-15");
		expect(r.currentSexagenaryYear).toBe(2025);
	});

	test("an explicit referenceDate wins and the clock is never read", () => {
		let called = 0;
		const r = resolveChartRequest({ referenceDate: "2026-07-21" }, () => {
			called++;
			return "1999-01-01";
		});
		expect(r.referenceDate).toBe("2026-07-21");
		expect(called).toBe(0);
	});
});
