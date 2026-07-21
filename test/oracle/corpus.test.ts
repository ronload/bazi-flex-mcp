import { describe, expect, setSystemTime, test } from "bun:test";
import { canonicalize } from "./canonical.js";
import { ALL_CITY_NAMES, MERIDIAN_OVERRIDE_CITIES } from "./cities.js";
import { buildCorpus, buildCorpusUncached, CORPUS_EXPECTATIONS, JIE_NAMES } from "./corpus.js";
import { computeCoverage } from "./coverage.js";
import { mulberry32 } from "./prng.js";
import { FROZEN_INSTANT, runSurface, surfaceByName, withFrozenClock } from "./surfaces.js";

describe("prng", () => {
	test("is reproducible from a seed", () => {
		const a = Array.from({ length: 8 }, () => mulberry32(42).next());
		expect(new Set(a).size).toBe(1);
		const b = Array.from({ length: 8 }, mulberry32(42).next);
		expect(new Set(b).size).toBe(8);
	});

	test("different seeds give different streams", () => {
		const r1 = mulberry32(1);
		const r2 = mulberry32(2);
		expect(Array.from({ length: 5 }, r1.next)).not.toEqual(Array.from({ length: 5 }, r2.next));
	});

	test("int() is inclusive at both ends", () => {
		const r = mulberry32(7);
		const seen = new Set<number>();
		for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
		expect([...seen].sort()).toEqual([1, 2, 3]);
	});
});

describe("corpus determinism", () => {
	test("two independent builds are byte-identical", () => {
		expect(canonicalize(buildCorpusUncached())).toBe(canonicalize(buildCorpusUncached()));
	});

	test("case ids are unique and non-empty", () => {
		const corpus = buildCorpus();
		expect(corpus.length).toBeGreaterThan(0);
		expect(new Set(corpus.map((c) => c.id)).size).toBe(corpus.length);
		for (const c of corpus) expect(c.id).toMatch(/^[a-z]+\/\S+$/);
	});

	test("every case carries an explicit referenceDate", () => {
		// A case without one falls back to the real clock, rotting the tool-surface
		// fingerprints at midnight.
		for (const c of buildCorpus()) expect(c.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("corpus layers", () => {
	const corpus = buildCorpus();
	const count = (layer: string) => corpus.filter((c) => c.layer === layer).length;

	test("exhaustive layers are the expected size", () => {
		expect(count("daypillar")).toBe(CORPUS_EXPECTATIONS.dayPillarCount);
		expect(count("city")).toBe(CORPUS_EXPECTATIONS.cityCount);
		expect(count("lichun")).toBe(CORPUS_EXPECTATIONS.lichunYears * 7);
	});

	test("every city name appears exactly once in the city layer", () => {
		const used = corpus.filter((c) => c.layer === "city").map((c) => c.core.city);
		expect(used).toEqual([...ALL_CITY_NAMES]);
	});

	test("the standard-meridian override cities are reached", () => {
		const cities = new Set(corpus.map((c) => c.core.city));
		for (const city of MERIDIAN_OVERRIDE_CITIES) expect(cities).toContain(city);
	});

	test("the 立春 layer probes plus/minus one minute around the instant", () => {
		const ids = corpus.filter((c) => c.layer === "lichun").map((c) => c.id);
		expect(ids).toContain("lichun/2026+0001");
		expect(ids).toContain("lichun/2026-0001");
	});

	test("the 節氣 layer covers all 12 month-opening terms", () => {
		const names = new Set(
			corpus
				.filter((c) => c.layer === "jieqi")
				.map((c) => /^jieqi\/\d+-(.+?)[+-]\d+$/.exec(c.id)?.[1]),
		);
		expect([...names].sort()).toEqual([...JIE_NAMES].sort());
	});

	test("the midnight layer spans 22:30 to 01:30 across both 子时分日法", () => {
		const mid = corpus.filter((c) => c.layer === "midnight");
		const hours = new Set(
			mid.map((c) => `${c.core.hour}:${String(c.core.minute).padStart(2, "0")}`),
		);
		expect(hours).toContain("22:30");
		expect(hours).toContain("23:00");
		expect(hours).toContain("0:00");
		expect(hours).toContain("1:30");
		expect(new Set(mid.map((c) => c.core.sect))).toEqual(new Set([1, 2]));
	});

	test("reference dates straddle 立春", () => {
		// Without pre-立春 reference dates the corpus has zero coverage of the window
		// `time/sexagenaryYear.ts` exists to get right.
		const refs = new Set(buildCorpus().map((c) => c.referenceDate));
		expect(refs).toContain("2026-01-20");
		expect(refs).toContain("2026-02-03");
		expect(refs).toContain("2026-02-04");
	});
});

describe("corpus coverage", () => {
	const cov = withFrozenClock(() => computeCoverage());

	test("all 60 日柱 are reached, hence every sparse 神煞 day-pillar set", () => {
		expect(cov.dayPillars).toHaveLength(60);
	});

	test("all 60 年柱, 12 月支, 12 时支 and 5 纳音五行 are reached", () => {
		expect(cov.yearPillars).toHaveLength(60);
		expect(cov.monthBranches).toHaveLength(12);
		expect(cov.hourBranches).toHaveLength(12);
		expect(cov.nayinElements).toHaveLength(5);
	});

	test("both 子时分日法 are exercised", () => {
		expect(cov.sects).toEqual([1, 2]);
	});

	test("真太阳时 correction is applied by a meaningful share of cases", () => {
		expect(cov.trueSolarTimeCases).toBeGreaterThan(1000);
	});

	test("every 神煞 upstream can emit is triggered", () => {
		// Taken from the 神煞 string literals in shunshi-bazi-core@0.2.0
		// dist/lib/shensha.js. If upstream adds one, this list must grow with it or
		// the new table entry ships with no coverage.
		const expected = [
			"丧门",
			"九丑日",
			"亡神",
			"元辰",
			"八专日",
			"六秀日",
			"劫煞",
			"勾绞煞",
			"十恶大败",
			"十灵日",
			"华盖",
			"吊客",
			"国印贵人",
			"地网",
			"天乙贵人",
			"天医",
			"天厨贵人",
			"天喜",
			"天德合",
			"天德贵人",
			"天赦日",
			"太极贵人",
			"孤辰",
			"孤鸾煞",
			"寡宿",
			"将星",
			"德秀贵人",
			"披麻",
			"文昌贵人",
			"月德合",
			"月德贵人",
			"桃花",
			"正学堂",
			"流霞",
			"灾煞",
			"禄神",
			"福星贵人",
			"空亡",
			"童子煞",
			"红艳煞",
			"红鸾",
			"羊刃",
			"血刃",
			"词馆",
			"金神",
			"金舆",
			"阴差阳错",
			"飞刃",
			"驿马",
			"魁罡日",
		];
		expect(cov.shensha).toEqual(expected.sort());
	});

	test("all 天干 relation kinds and every 地支 relation kind are triggered", () => {
		// 天干 have only 合/冲/克, so three is complete. Order is UTF-16 code units.
		expect(cov.ganRelations).toEqual(["克", "相冲", "相合"]);
		// `暗合` is upstream's short-mode label for 地支六合. Recorded as an observed
		// output, not endorsed; correcting the term is a later deliberate divergence.
		expect(cov.zhiRelations).toEqual(["暗合", "相冲", "相刑", "相害", "相破"]);
	});
});

describe("clock freeze", () => {
	test("the frozen instant is what the harness claims", () => {
		withFrozenClock(() => {
			expect(new Date().toISOString()).toBe(FROZEN_INSTANT);
		});
	});

	test("fingerprints do not move when the real clock does", () => {
		// Upstream computes 大运[].当前 from `new Date().getFullYear()` with no
		// injection point, so without the freeze the baseline rots every January 1.
		const sample = buildCorpus()
			.filter((c) => c.layer === "daypillar")
			.slice(0, 12);
		const core = surfaceByName("core");
		const first = withFrozenClock(() => runSurface(core, sample));

		setSystemTime(new Date("2099-12-31T23:59:59.000Z"));
		try {
			const second = withFrozenClock(() => runSurface(core, sample));
			expect(second.fingerprints).toEqual(first.fingerprints);
		} finally {
			setSystemTime();
		}
	});

	test("the clock is restored after withFrozenClock, even on throw", () => {
		const before = Date.now();
		expect(() =>
			withFrozenClock(() => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		expect(Date.now()).toBeGreaterThanOrEqual(before);
		expect(new Date().toISOString()).not.toBe(FROZEN_INSTANT);
	});
});
