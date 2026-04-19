import { describe, expect, test } from "bun:test";
import { getBaziChart } from "shunshi-bazi-core";
import { computeTenGodStats, enrichResult } from "./getBaziChart.js";

describe("computeTenGodStats", () => {
	test("separates transparent (年/月/时柱.主星) from hidden (all 副星)", () => {
		const stats = computeTenGodStats({
			年柱: { 主星: "正印", 副星: ["食神"] },
			月柱: { 主星: "偏财", 副星: ["偏财", "食神"] },
			日柱: { 副星: ["比肩", "劫财"] },
			时柱: { 主星: "七杀", 副星: [] },
		});

		expect(stats.正印).toEqual({ 透: 1, 藏: 0, 共: 1 });
		expect(stats.偏财).toEqual({ 透: 1, 藏: 1, 共: 2 });
		expect(stats.食神).toEqual({ 透: 0, 藏: 2, 共: 2 });
		expect(stats.七杀).toEqual({ 透: 1, 藏: 0, 共: 1 });
		expect(stats.比肩).toEqual({ 透: 0, 藏: 1, 共: 1 });
		expect(stats.劫财).toEqual({ 透: 0, 藏: 1, 共: 1 });
	});

	test("excludes 日柱.主星 from the transparent count", () => {
		const stats = computeTenGodStats({
			年柱: { 主星: "X", 副星: [] },
			月柱: { 主星: "X", 副星: [] },
			日柱: { 副星: [] },
			时柱: { 主星: "X", 副星: [] },
		});
		expect(stats.X).toBeDefined();
		expect(stats.X?.透).toBe(3);
	});
});

describe("enrichResult", () => {
	const sampleInput = {
		year: 1990,
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		gender: 1 as const,
	};
	const birth = { year: 1990, month: 6, day: 15 };

	test("nulls 日柱.主星 and attaches day-master markers", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		const 日柱 = enriched.八字.柱位详细.日柱;

		expect(日柱.主星).toBeNull();
		expect(日柱.label).toBe("日主");
		expect(日柱.isDayMaster).toBe(true);
	});

	test("keeps real ten-gods on non-day pillars", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		for (const k of ["年柱", "月柱", "时柱"] as const) {
			expect(typeof enriched.八字.柱位详细[k].主星).toBe("string");
			expect(enriched.八字.柱位详细[k].主星).not.toBe("");
		}
	});

	test("normalises empty 日主关系 to null", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		for (const yun of enriched.八字.大运) {
			expect(yun.日主关系 === null || typeof yun.日主关系 === "string").toBe(true);
			if (typeof yun.日主关系 === "string") expect(yun.日主关系).not.toBe("");
		}
	});

	test("exposes meta.referenceDateUsed and meta.scoringMethod", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		expect(enriched.meta.referenceDateUsed).toBe("2026-04-19");
		expect(enriched.meta.scoringMethod.algorithm).toBe("tiangan-canggan-weighted");
		expect(enriched.meta.scoringMethod.weights.tiangan).toBe(1.0);
		expect(enriched.meta.scoringMethod.weights.canggan.benqi).toBe(1.0);
	});

	test("recomputes 当前 from referenceDate", () => {
		const raw = getBaziChart(sampleInput);
		const past = enrichResult(raw, birth, "1950-01-01");
		const future = enrichResult(raw, birth, "2200-01-01");
		expect(past.八字.大运.every((y) => y.当前 === false)).toBe(true);
		expect(future.八字.大运.every((y) => y.当前 === false)).toBe(true);

		// At least one decade-cycle should match the birth year-range
		const native = enrichResult(raw, birth, "2020-06-15");
		const anyCurrent = native.八字.大运.some((y) => y.当前);
		expect(anyCurrent).toBe(true);
	});

	test("populates 十神统计 with 透/藏/共 structure", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		const stats = enriched.八字.十神统计;

		expect(Object.keys(stats).length).toBeGreaterThan(0);
		let totalTou = 0;
		let totalCang = 0;
		for (const v of Object.values(stats)) {
			expect(v.共).toBe(v.透 + v.藏);
			totalTou += v.透;
			totalCang += v.藏;
		}
		// 年/月/时柱 each contribute one 透; 日柱 is excluded.
		expect(totalTou).toBe(3);
		// Hidden-stem count depends on earth branches; at minimum 4 (one per pillar).
		expect(totalCang).toBeGreaterThanOrEqual(4);
	});

	test("does not expose '元男'/'元女' anywhere in 主星 fields", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		for (const k of ["年柱", "月柱", "日柱", "时柱"] as const) {
			const v = enriched.八字.柱位详细[k].主星;
			expect(v).not.toBe("元男");
			expect(v).not.toBe("元女");
		}
	});
});
