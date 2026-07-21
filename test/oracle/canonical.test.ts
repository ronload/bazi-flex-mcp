import { describe, expect, test } from "bun:test";
import { canonicalize, diffValues, fingerprint } from "./canonical.js";

describe("canonicalize", () => {
	test("object key order does not affect the result", () => {
		expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
		expect(canonicalize({ 八字: { 日主: "甲", 四柱: "x" } })).toBe(
			canonicalize({ 八字: { 四柱: "x", 日主: "甲" } }),
		);
	});

	test("array order DOES affect the result", () => {
		// 神煞 arrays are order-sensitive by the parity contract. This is the single
		// assertion that stops a "harmless" sort from slipping through unnoticed.
		expect(canonicalize(["天乙贵人", "桃花"])).not.toBe(canonicalize(["桃花", "天乙贵人"]));
	});

	test("absent, undefined and null are graded correctly", () => {
		expect(canonicalize({ a: 1 })).toBe(canonicalize({ a: 1, b: undefined }));
		expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 1, b: null }));
	});

	test("-0 and 0 are the same value", () => {
		expect(canonicalize({ 修正分钟: -0 })).toBe(canonicalize({ 修正分钟: 0 }));
	});

	test("non-finite numbers throw rather than silently becoming null", () => {
		// JSON.stringify turns NaN into null, which would make a genuine計算 bug
		// fingerprint identically to a legitimate null. Refuse instead.
		expect(() => canonicalize({ 修正分钟: Number.NaN })).toThrow(/non-finite/);
		expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
	});

	test("nested structures round-trip through JSON.parse", () => {
		const value = { a: [1, { b: "x" }, null], c: { d: true } };
		expect(JSON.parse(canonicalize(value))).toEqual(value);
	});
});

describe("fingerprint", () => {
	test("is 16 hex chars and stable", () => {
		const fp = fingerprint({ a: 1 });
		expect(fp).toMatch(/^[0-9a-f]{16}$/);
		expect(fingerprint({ a: 1 })).toBe(fp);
	});

	test("differs for any value change", () => {
		expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
		expect(fingerprint({ 神煞: ["a", "b"] })).not.toBe(fingerprint({ 神煞: ["b", "a"] }));
	});
});

describe("diffValues", () => {
	test("identical payloads produce no differences", () => {
		expect(diffValues({ a: [1, 2], b: { c: "x" } }, { b: { c: "x" }, a: [1, 2] })).toEqual([]);
	});

	test("reports a changed leaf with its path", () => {
		const d = diffValues({ 八字: { 日主: "甲" } }, { 八字: { 日主: "乙" } });
		expect(d).toHaveLength(1);
		expect(d[0]).toMatchObject({ path: "八字.日主", expected: "甲", actual: "乙", kind: "value" });
	});

	test("reports missing and extra keys distinctly", () => {
		const d = diffValues({ a: 1, b: 2 }, { a: 1, c: 3 });
		expect(d.map((x) => [x.path, x.kind]).sort()).toEqual([
			["b", "missing"],
			["c", "extra"],
		]);
	});

	test("reports array length change plus the differing index", () => {
		const d = diffValues({ 神煞: ["x"] }, { 神煞: ["x", "y"] });
		expect(d.map((x) => x.kind).sort()).toEqual(["extra", "length"]);
		expect(d.find((x) => x.kind === "extra")?.path).toBe("神煞[1]");
	});

	test("a type change is reported as such and does not recurse", () => {
		const d = diffValues({ 空亡: "戌亥" }, { 空亡: ["戌", "亥"] });
		expect(d).toHaveLength(1);
		expect(d[0]?.kind).toBe("type");
	});
});
