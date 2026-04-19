import { BRANCH_ORDER, CTRL_NEXT, GEN_NEXT, STEM_ELEMENT, STEM_ORDER, STEM_YANG } from "./data.js";

export function tenStar(dayMaster: string, target: string): string {
	const dE = STEM_ELEMENT[dayMaster];
	const tE = STEM_ELEMENT[target];
	const dY = STEM_YANG[dayMaster];
	const tY = STEM_YANG[target];
	if (!dE || !tE || dY === undefined || tY === undefined) return "?";
	const same = dY === tY;
	if (dE === tE) return same ? "比肩" : "劫财";
	if (GEN_NEXT[dE] === tE) return same ? "食神" : "伤官";
	if (GEN_NEXT[tE] === dE) return same ? "偏印" : "正印";
	if (CTRL_NEXT[dE] === tE) return same ? "偏财" : "正财";
	if (CTRL_NEXT[tE] === dE) return same ? "七杀" : "正官";
	return "?";
}

export function sexagenaryOfYear(year: number): { 干支: string; 天干: string; 地支: string } {
	const idx = (((year - 4) % 60) + 60) % 60;
	const 天干 = STEM_ORDER[idx % 10] ?? "";
	const 地支 = BRANCH_ORDER[idx % 12] ?? "";
	return { 干支: `${天干}${地支}`, 天干, 地支 };
}

export type ElementRelation = "同我" | "生我" | "我生" | "我克" | "克我";

export function elementRelation(from: string, to: string): ElementRelation | null {
	if (!from || !to) return null;
	if (from === to) return "同我";
	if (GEN_NEXT[to] === from) return "生我";
	if (GEN_NEXT[from] === to) return "我生";
	if (CTRL_NEXT[from] === to) return "我克";
	if (CTRL_NEXT[to] === from) return "克我";
	return null;
}
