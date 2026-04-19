import { describe, expect, test } from "bun:test";
import { getBaziChart } from "shunshi-bazi-core";
import { computeTenGodStats } from "./getBaziChart/index.js";
import { enrichPartialResult } from "./getBaziChartPartial/index.js";

describe("computeTenGodStats (时柱 optional)", () => {
	test("works without 时柱 — 透 counts only 年/月柱", () => {
		const stats = computeTenGodStats({
			年柱: { 主星: "正印", 副星: ["食神"] },
			月柱: { 主星: "偏财", 副星: ["偏财", "食神"] },
			日柱: { 副星: ["比肩", "劫财"] },
		});

		expect(stats.正印).toEqual({ 透: 1, 藏: 0, 共: 1 });
		expect(stats.偏财).toEqual({ 透: 1, 藏: 1, 共: 2 });
		expect(stats.食神).toEqual({ 透: 0, 藏: 2, 共: 2 });
		expect(stats.比肩).toEqual({ 透: 0, 藏: 1, 共: 1 });
		expect(stats.劫财).toEqual({ 透: 0, 藏: 1, 共: 1 });
		// 时柱 absent → no 七杀 contribution
		expect(stats.七杀).toBeUndefined();
	});

	test("totalTou with 时柱 omitted is at most 2", () => {
		const stats = computeTenGodStats({
			年柱: { 主星: "X", 副星: [] },
			月柱: { 主星: "X", 副星: [] },
			日柱: { 副星: [] },
		});
		expect(stats.X?.透).toBe(2);
	});
});

describe("enrichPartialResult", () => {
	const partialInput = {
		year: 1990,
		month: 6,
		day: 15,
		gender: 1 as const,
	};
	const placeholderInput = { ...partialInput, hour: 12, minute: 0 };
	const birth = { year: 1990, month: 6, day: 15 };

	const buildPartial = (referenceDate = "2026-04-19") => {
		const raw = getBaziChart(placeholderInput);
		return enrichPartialResult(raw, birth, referenceDate);
	};

	test("omits 时柱 from 柱位详细", () => {
		const enriched = buildPartial();
		expect(enriched.八字.柱位详细).not.toHaveProperty("时柱");
		expect(enriched.八字.柱位详细.年柱).toBeDefined();
		expect(enriched.八字.柱位详细.月柱).toBeDefined();
		expect(enriched.八字.柱位详细.日柱).toBeDefined();
	});

	test("nulls 命宫/身宫/胎元/胎息", () => {
		const enriched = buildPartial();
		expect(enriched.八字.命宫).toBeNull();
		expect(enriched.八字.身宫).toBeNull();
		expect(enriched.八字.胎元).toBeNull();
		expect(enriched.八字.胎息).toBeNull();
	});

	test("strips 真太阳时 entirely", () => {
		const enriched = buildPartial();
		expect("真太阳时" in enriched).toBe(false);
	});

	test("输入.公历 and 八字.公历 are date-only YYYY-MM-DD; 输入.时辰 is null", () => {
		const enriched = buildPartial();
		const dateRe = /^\d{4}-\d{2}-\d{2}$/;
		expect(enriched.输入.公历).toMatch(dateRe);
		expect(enriched.八字.公历).toMatch(dateRe);
		expect(enriched.输入.公历).toBe("1990-06-15");
		expect(enriched.八字.公历).toBe("1990-06-15");
		expect(enriched.输入.时辰).toBeNull();
	});

	test("十神统计 透 count is at most 2 (only 年/月.主星)", () => {
		const enriched = buildPartial();
		let totalTou = 0;
		for (const v of Object.values(enriched.八字.十神统计)) {
			totalTou += v.透;
		}
		expect(totalTou).toBe(2);
	});

	test("柱间关系 contains no entries involving 时", () => {
		// pick a chart known to have time-pillar relations in full mode
		const raw = getBaziChart({ year: 2002, month: 5, day: 17, hour: 6, minute: 0, gender: 1 });
		const enriched = enrichPartialResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");
		for (const rel of enriched.八字.柱间关系) {
			expect(rel.pillars).not.toContain("时");
		}
	});

	test("决策辅助.日主根气.柱位根 has at most 3 entries (no 时)", () => {
		const enriched = buildPartial();
		const 柱位根 = enriched.八字.决策辅助.日主根气.柱位根;
		expect(柱位根.length).toBeLessThanOrEqual(3);
		for (const r of 柱位根) {
			expect(r.柱).not.toBe("时");
		}
	});

	test("partial vs full(hour=12) — 年/月/日柱 are identical", () => {
		const partial = buildPartial();
		const fullRaw = getBaziChart(placeholderInput);
		for (const k of ["年柱", "月柱", "日柱"] as const) {
			expect(partial.八字.柱位详细[k].干支).toBe(fullRaw.八字.柱位详细[k].干支);
			expect(partial.八字.柱位详细[k].天干).toBe(fullRaw.八字.柱位详细[k].天干);
			expect(partial.八字.柱位详细[k].地支).toBe(fullRaw.八字.柱位详细[k].地支);
		}
		expect(partial.八字.日主).toBe(fullRaw.八字.日主);
	});

	test("五行分值 has all 5 elements + 日主五行 and 占比 sums to ~100%", () => {
		const enriched = buildPartial();
		const score = enriched.八字.五行分值;
		expect(score.日主五行).toBeTruthy();
		const elements: ("金" | "木" | "水" | "火" | "土")[] = ["金", "木", "水", "火", "土"];
		let totalShare = 0;
		for (const el of elements) {
			expect(score[el]).toBeDefined();
			expect(typeof score[el].分值).toBe("number");
			expect(score[el].占比).toMatch(/^\d+%$/);
			totalShare += Number.parseInt(score[el].占比, 10);
		}
		// rounding may make total 99-101
		expect(totalShare).toBeGreaterThanOrEqual(99);
		expect(totalShare).toBeLessThanOrEqual(101);
	});

	test("preserves 流年 (date-only inputs unaffected)", () => {
		const raw = getBaziChart({ year: 2002, month: 5, day: 17, hour: 12, minute: 0, gender: 1 });
		const enriched = enrichPartialResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19", {
			start: 2024,
			end: 2028,
		});
		expect(enriched.八字.流年范围).toEqual({ start: 2024, end: 2028 });
		expect(enriched.八字.流年.map((e) => e.干支)).toEqual(["甲辰", "乙巳", "丙午", "丁未", "戊申"]);
	});

	test("exposes meta.disclaimer with key fields", () => {
		const enriched = buildPartial();
		expect(enriched.meta.disclaimer).toBeDefined();
		expect(enriched.meta.disclaimer.依赖时辰已置null).toEqual(["命宫", "身宫", "胎元", "胎息"]);
		expect(enriched.meta.scoringMethod.algorithm).toBe("tiangan-canggan-weighted (3 pillars)");
	});

	test("大运 still present (direction unaffected by hour)", () => {
		const enriched = buildPartial();
		expect(Array.isArray(enriched.八字.大运)).toBe(true);
		expect(enriched.八字.大运.length).toBeGreaterThan(0);
		// each entry should still have 起始虚岁/起始实岁 attached
		for (const yun of enriched.八字.大运) {
			expect(typeof yun.起始虚岁).toBe("number");
			expect(typeof yun.起始实岁).toBe("number");
		}
	});
});
