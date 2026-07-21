import { describe, expect, test } from "bun:test";
import { resolveChartRequest } from "./request.js";

describe("resolveChartRequest", () => {
	test("referenceYear 是公曆年,currentSexagenaryYear 是立春界干支年", () => {
		const midYear = resolveChartRequest({ referenceDate: "2026-07-21" });
		expect(midYear.referenceYear).toBe(2026);
		expect(midYear.currentSexagenaryYear).toBe(2026);

		const preLichun = resolveChartRequest({ referenceDate: "2026-01-15" });
		expect(preLichun.referenceYear).toBe(2026);
		expect(preLichun.currentSexagenaryYear).toBe(2025);
	});

	test("預設 流年 視窗以干支年為中心而非公曆年", () => {
		expect(resolveChartRequest({ referenceDate: "2026-07-21" }).liunianRange).toEqual({
			start: 2023,
			end: 2029,
		});
		// 立春前:以 2025 為心,不是 2026。若以公曆年為心會是 [2023, 2029],
		// 相對真正的當前干支年 2025 就成了 [-2, +4] 的偏心視窗。
		expect(resolveChartRequest({ referenceDate: "2026-01-15" }).liunianRange).toEqual({
			start: 2022,
			end: 2028,
		});
	});

	test("預設視窗永遠包含當前干支年", () => {
		for (const d of ["2026-01-01", "2026-02-03", "2026-02-04", "2026-07-21", "2026-12-31"]) {
			const r = resolveChartRequest({ referenceDate: d });
			expect(r.currentSexagenaryYear).toBeGreaterThanOrEqual(r.liunianRange.start);
			expect(r.currentSexagenaryYear).toBeLessThanOrEqual(r.liunianRange.end);
		}
	});

	test("liunianStart / liunianEnd 各自獨立覆寫", () => {
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

	test("未提供 referenceDate 時使用注入的時鐘", () => {
		const r = resolveChartRequest({}, () => "2026-01-15");
		expect(r.referenceDate).toBe("2026-01-15");
		expect(r.currentSexagenaryYear).toBe(2025);
	});

	test("明確的 referenceDate 優先於時鐘,且時鐘不被呼叫", () => {
		let called = 0;
		const r = resolveChartRequest({ referenceDate: "2026-07-21" }, () => {
			called++;
			return "1999-01-01";
		});
		expect(r.referenceDate).toBe("2026-07-21");
		expect(called).toBe(0);
	});
});
