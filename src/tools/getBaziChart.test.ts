import { describe, expect, test } from "bun:test";
import { getBaziChart } from "shunshi-bazi-core";
import {
	computeDecisionAids,
	computeLiunian,
	computeTenGodStats,
	enrichResult,
} from "./getBaziChart.js";

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

	test("normalises time strings to ISO 8601 with second precision", () => {
		const raw = getBaziChart({ ...sampleInput, city: "北京" });
		const enriched = enrichResult(raw, birth, "2026-04-19");
		const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

		expect(enriched.输入.公历).toMatch(isoRe);
		expect(enriched.八字.公历).toMatch(isoRe);
		expect(enriched.真太阳时).toBeDefined();
		expect(enriched.真太阳时?.钟表时间).toMatch(isoRe);
		expect(enriched.真太阳时?.真太阳时).toMatch(isoRe);

		// 真太阳时 must equal 八字.公历 (both are the true solar time)
		expect(enriched.真太阳时?.真太阳时).toBe(enriched.八字.公历);
	});

	test("adds 修正秒数 rounded from 修正分钟", () => {
		const raw = getBaziChart({ ...sampleInput, city: "北京" });
		const enriched = enrichResult(raw, birth, "2026-04-19");
		expect(enriched.真太阳时).toBeDefined();
		const 修正分钟 = enriched.真太阳时?.修正分钟 ?? 0;
		expect(enriched.真太阳时?.修正秒数).toBe(Math.round(修正分钟 * 60));
	});

	test("omits 真太阳时 block when no location is provided", () => {
		const raw = getBaziChart(sampleInput);
		const enriched = enrichResult(raw, birth, "2026-04-19");
		expect(enriched.真太阳时).toBeUndefined();
		// 八字.公历 still normalised even without 真太阳时
		expect(enriched.八字.公历).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
	});

	test("expands duplicate relations across all matching pillar pairs", () => {
		// 2002-05-17 06:00 男 → 壬午 乙巳 乙酉 己卯, upstream emits "乙克己" twice.
		// Both 月乙→时己 and 日乙→时己 should surface as distinct entries.
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const enriched = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");
		const keClashes = enriched.八字.柱间关系.filter(
			(r) => r.kind === "天干" && r.type === "克" && r.raw === "乙克己",
		);
		expect(keClashes).toHaveLength(2);
		const pairSignatures = keClashes.map((r) => r.pillars.join("-")).sort();
		expect(pairSignatures).toEqual(["日-时", "月-时"]);
	});

	test("emits 流年 table over the configured range with correct ganzhi", () => {
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const enriched = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19", {
			start: 2024,
			end: 2028,
		});
		expect(enriched.八字.流年范围).toEqual({ start: 2024, end: 2028 });
		expect(enriched.八字.流年.map((e) => e.干支)).toEqual(["甲辰", "乙巳", "丙午", "丁未", "戊申"]);
		const current = enriched.八字.流年.find((e) => e.当前);
		expect(current?.年份).toBe(2026);
		expect(current?.干支).toBe("丙午");
		// 日主乙,2026丙午:乙生丙,乙陰丙陽 → 伤官
		expect(current?.主星).toBe("伤官");
		// 午藏干 丁,己 → 乙對丁 生同陰=食神;乙對己 克同陰=偏财
		expect(current?.藏干).toEqual(["丁", "己"]);
		expect(current?.藏干十神).toEqual(["食神", "偏财"]);
	});

	test("computeLiunian covers all ten-god rules (生剋陰陽)", () => {
		// 日主 甲 (木陽) — 窮舉十神
		const entries = computeLiunian("甲", { start: 1984, end: 1993 }, 1984);
		// 甲 vs 流年天干 -> 主星
		const 主星 = entries.map((e) => `${e.天干}:${e.主星}`);
		expect(主星).toEqual([
			"甲:比肩", // 甲 vs 甲 同木同陽 → 比肩
			"乙:劫财", // 甲 vs 乙 同木異陽 → 劫财
			"丙:食神", // 甲生丙 同陽 → 食神
			"丁:伤官", // 甲生丁 異陽 → 伤官
			"戊:偏财", // 甲克戊 同陽 → 偏财
			"己:正财", // 甲克己 異陽 → 正财
			"庚:七杀", // 庚克甲 同陽 → 七杀
			"辛:正官", // 辛克甲 異陽 → 正官
			"壬:偏印", // 壬生甲 同陽 → 偏印
			"癸:正印", // 癸生甲 異陽 → 正印
		]);
	});

	test("computeLiunian handles pre-epoch / negative years without crashing", () => {
		const entries = computeLiunian("甲", { start: -4, end: 4 }, 0);
		expect(entries).toHaveLength(9);
		expect(entries.every((e) => e.干支.length === 2)).toBe(true);
	});

	test("restructures 空亡 with top-level 旬空 index and per-pillar 落空亡", () => {
		// 2002-05-17 06:00 男 → 壬午 乙巳 乙酉 己卯
		// 日柱乙酉 → 所在旬 = 甲申旬 → 旬空午未 (written as 所在旬空亡)
		// 年柱壬午 → 所在旬 = 甲戌旬 → 旬空申酉
		// 日支酉 ∈ 年柱旬空(申酉) → 日柱.落空亡.年柱旬 true
		// 年支午 ∈ 日柱旬空(午未) → 年柱.落空亡.日柱旬 true
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const e = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");

		expect(e.八字.旬空).toEqual({
			日柱旬空: ["午", "未"],
			年柱旬空: ["申", "酉"],
		});

		const 年 = e.八字.柱位详细.年柱;
		const 日 = e.八字.柱位详细.日柱;
		const 月 = e.八字.柱位详细.月柱;
		const 时 = e.八字.柱位详细.时柱;

		// 所在旬空亡 = pillar's own xun-voids (reference only, not a judgement)
		expect(日.所在旬空亡).toEqual(["午", "未"]);
		expect(年.所在旬空亡).toEqual(["申", "酉"]);

		// 落空亡 = actual void judgement (branch ∈ day-xun / year-xun)
		expect(日.落空亡).toEqual({ 日柱旬: false, 年柱旬: true });
		expect(年.落空亡).toEqual({ 日柱旬: true, 年柱旬: false });
		expect(月.落空亡).toEqual({ 日柱旬: false, 年柱旬: false });
		expect(时.落空亡).toEqual({ 日柱旬: false, 年柱旬: false });

		// Invariant: 神煞 "空亡" tag ⇔ any(落空亡.*) — upstream uses the union rule.
		for (const pillar of [年, 月, 日, 时]) {
			const anyVoid = pillar.落空亡.日柱旬 || pillar.落空亡.年柱旬;
			expect(pillar.神煞.includes("空亡")).toBe(anyVoid);
		}
	});

	test("drops the original 柱.空亡 field in favour of 所在旬空亡 + 落空亡", () => {
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const e = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");
		for (const k of ["年柱", "月柱", "日柱", "时柱"] as const) {
			expect((e.八字.柱位详细[k] as Record<string, unknown>).空亡).toBeUndefined();
			expect((e.八字.柱位详细[k] as Record<string, unknown>).所在旬空亡).toBeDefined();
			expect((e.八字.柱位详细[k] as Record<string, unknown>).落空亡).toBeDefined();
		}
	});

	test("populates 决策辅助 with 日主得令 / 日主根气 / 透藏平衡", () => {
		// 2002-05-17 06:00 男 → 壬午 乙巳 乙酉 己卯, 日主 乙木,
		// 巳月 (丙火主气) → 乙生丙 → 我生 → 不得令;時柱卯含乙 = 唯一根.
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const e = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");
		const aid = e.八字.决策辅助;

		expect(aid.日主得令?.日主五行).toBe("木");
		expect(aid.日主得令?.月令五行).toBe("火");
		expect(aid.日主得令?.关系).toBe("我生");
		expect(aid.日主得令?.得令).toBe(false);

		expect(aid.日主根气.日主五行).toBe("木");
		expect(aid.日主根气.柱位根).toHaveLength(1);
		expect(aid.日主根气.柱位根[0]?.柱).toBe("时");
		expect(aid.日主根气.柱位根[0]?.同类藏干).toEqual(["乙"]);
		expect(aid.日主根气.总根气).toBe(1);

		// 透藏平衡 transparent totals must equal 十神统计 counts summed.
		const stats = e.八字.十神统计;
		const totalTou = Object.values(stats).reduce((a, s) => a + s.透, 0);
		expect(aid.透藏平衡.比劫透 + aid.透藏平衡.异类透).toBe(totalTou);
	});

	test("computeDecisionAids handles 日主得令 when 日主 == 月令五行", () => {
		// Synthetic minimal pillars — 日主丙 (火), 月柱丙午 (巳午未都可), use 巳.
		const pillars = {
			年柱: {
				干支: "甲午",
				天干: "甲",
				地支: "午",
				纳音: "",
				五行: "",
				主星: "偏印",
				副星: [],
				藏干: ["丁", "己"],
				藏干详情: [],
				星运: "",
				自坐: "",
				空亡: "",
				神煞: [],
			},
			月柱: {
				干支: "乙巳",
				天干: "乙",
				地支: "巳",
				纳音: "",
				五行: "",
				主星: "正印",
				副星: [],
				藏干: ["丙", "庚", "戊"],
				藏干详情: [],
				星运: "",
				自坐: "",
				空亡: "",
				神煞: [],
			},
			日柱: {
				干支: "丙戌",
				天干: "丙",
				地支: "戌",
				纳音: "",
				五行: "",
				主星: "元男",
				副星: [],
				藏干: ["戊", "辛", "丁"],
				藏干详情: [],
				星运: "",
				自坐: "",
				空亡: "",
				神煞: [],
			},
			时柱: {
				干支: "丁酉",
				天干: "丁",
				地支: "酉",
				纳音: "",
				五行: "",
				主星: "劫财",
				副星: [],
				藏干: ["辛"],
				藏干详情: [],
				星运: "",
				自坐: "",
				空亡: "",
				神煞: [],
			},
		};
		const stats = computeTenGodStats(pillars);
		// biome-ignore lint/suspicious/noExplicitAny: synthetic fixture for unit test
		const aid = computeDecisionAids({ 日主: "丙", 柱位详细: pillars as any }, stats);
		// 巳 本气 丙 → 火. 日主 丙 → 火. 同我 → 得令 true.
		expect(aid.日主得令?.关系).toBe("同我");
		expect(aid.日主得令?.得令).toBe(true);
	});

	test("parses 相冲/相破/相害/暗合 and attaches correct pillars", () => {
		// 1984-02-02 00:00 男 → picks up several zhi relations.
		const raw = getBaziChart({
			year: 1984,
			month: 2,
			day: 2,
			hour: 0,
			minute: 0,
			gender: 1,
		});
		const enriched = enrichResult(raw, { year: 1984, month: 2, day: 2 }, "2026-04-19");
		// Every entry parses to a known type and carries at least 2 pillars
		for (const rel of enriched.八字.柱间关系) {
			expect(["相合", "相冲", "相害", "相破", "暗合", "自刑", "三刑", "克"]).toContain(rel.type);
			expect(rel.pillars.length).toBeGreaterThanOrEqual(2);
			expect(rel.干支.length).toBe(rel.pillars.length);
		}
	});

	test("restructures 大运 空亡 into 所在旬空亡 + 落空亡 (same shape as 柱位详细)", () => {
		// 2002-05-17 06:00 男 → 日柱乙酉 (旬空午未), 年柱壬午 (旬空申酉).
		const raw = getBaziChart({
			year: 2002,
			month: 5,
			day: 17,
			hour: 6,
			minute: 0,
			gender: 1,
		});
		const e = enrichResult(raw, { year: 2002, month: 5, day: 17 }, "2026-04-19");

		const dayKong = new Set(e.八字.旬空.日柱旬空);
		const yearKong = new Set(e.八字.旬空.年柱旬空);

		for (const yun of e.八字.大运) {
			const record = yun as Record<string, unknown>;
			expect(record.空亡).toBeUndefined();
			expect(Array.isArray(record.所在旬空亡)).toBe(true);
			expect(record.落空亡).toBeDefined();
			expect(yun.落空亡.日柱旬).toBe(dayKong.has(yun.地支));
			expect(yun.落空亡.年柱旬).toBe(yearKong.has(yun.地支));
			expect(yun.所在旬空亡).toHaveLength(2);
		}
	});
});
