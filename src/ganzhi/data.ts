export type PillarKey = "年" | "月" | "日" | "时";

export const PILLAR_KEYS: readonly PillarKey[] = ["年", "月", "日", "时"] as const;

export const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

export const BRANCH_ORDER = [
	"子",
	"丑",
	"寅",
	"卯",
	"辰",
	"巳",
	"午",
	"未",
	"申",
	"酉",
	"戌",
	"亥",
] as const;

export const STEM_ELEMENT: Record<string, "木" | "火" | "土" | "金" | "水"> = {
	甲: "木",
	乙: "木",
	丙: "火",
	丁: "火",
	戊: "土",
	己: "土",
	庚: "金",
	辛: "金",
	壬: "水",
	癸: "水",
};

export const STEM_YANG: Record<string, boolean> = {
	甲: true,
	乙: false,
	丙: true,
	丁: false,
	戊: true,
	己: false,
	庚: true,
	辛: false,
	壬: true,
	癸: false,
};

/** 本气/中气/余气 order — matches tyme4ts `EarthBranch.getHideHeavenStems()`. */
export const BRANCH_HIDDEN: Record<string, string[]> = {
	子: ["癸"],
	丑: ["己", "癸", "辛"],
	寅: ["甲", "丙", "戊"],
	卯: ["乙"],
	辰: ["戊", "乙", "癸"],
	巳: ["丙", "庚", "戊"],
	午: ["丁", "己"],
	未: ["己", "乙", "丁"],
	申: ["庚", "壬", "戊"],
	酉: ["辛"],
	戌: ["戊", "辛", "丁"],
	亥: ["壬", "甲"],
};

export const GEN_NEXT: Record<string, string> = {
	木: "火",
	火: "土",
	土: "金",
	金: "水",
	水: "木",
};

export const CTRL_NEXT: Record<string, string> = {
	木: "土",
	土: "水",
	水: "火",
	火: "金",
	金: "木",
};
