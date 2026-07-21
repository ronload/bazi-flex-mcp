import { describe, expect, test } from "bun:test";
import { resolveChartRequest } from "./request.js";

describe("resolveChartRequest", () => {
	test("referenceYear 取自 referenceDate 的前四碼", () => {
		expect(resolveChartRequest({ referenceDate: "2026-07-21" }).referenceYear).toBe(2026);
		expect(resolveChartRequest({ referenceDate: "2026-01-15" }).referenceYear).toBe(2026);
	});

	test("預設 流年 視窗是 ±3 年", () => {
		expect(resolveChartRequest({ referenceDate: "2026-07-21" }).liunianRange).toEqual({
			start: 2023,
			end: 2029,
		});
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
		expect(r.referenceYear).toBe(2026);
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
