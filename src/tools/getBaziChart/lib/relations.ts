// ─── 柱间关系 (pair 化) ───────────────────────────────────────────────
// 上游 `shunshi-bazi-core` v0.1 的 `刑冲合会` 只是扁平字串 (例 "甲己相合")，
// 沒有柱位標籤 — 複雜盤 (多柱同干支) 會有 pair 歧義。這裡反推 pair，只做
// 解析與配對，不重新實作 relation 規則，沿用上游的判斷結果。
//
// TODO(upstream): shunshi-bazi-core v0.2+ 的 roadmap 可能暴露帶 `labels`
// 的 relation API，或直接在 output 帶 pair。屆時移除本段、改用 upstream
// 的 pair 輸出。參考：node_modules/shunshi-bazi-core/README.md 動態神煞段。

import { PILLAR_KEYS, type PillarKey } from "../../../ganzhi/data.js";
import type { Pillars } from "../types.js";

export type RelationType =
	| "相合"
	| "相冲"
	| "相害"
	| "相破"
	| "暗合"
	| "自刑"
	| "三刑"
	| "克"
	| "其他";

export interface PillarRelationPair {
	kind: "天干" | "地支";
	type: RelationType;
	pillars: PillarKey[];
	干支: string[];
	raw: string;
}

interface ParsedRelation {
	type: RelationType;
	involved: string[];
}

function parseRelationString(raw: string): ParsedRelation | null {
	// 克:X克Y (only 天干 uses this form in upstream)
	const keMatch = /^(.)克(.)$/.exec(raw);
	if (keMatch) return { type: "克", involved: [keMatch[1] ?? "", keMatch[2] ?? ""] };
	// 三刑:XYZ三刑
	const sanxingMatch = /^(.)(.)(.)三刑$/.exec(raw);
	if (sanxingMatch) {
		return {
			type: "三刑",
			involved: [sanxingMatch[1] ?? "", sanxingMatch[2] ?? "", sanxingMatch[3] ?? ""],
		};
	}
	// 兩字 + 二字尾詞
	const pairMatch = /^(.)(.)(相合|相冲|相害|相破|暗合|自刑)$/.exec(raw);
	if (pairMatch) {
		return {
			type: pairMatch[3] as RelationType,
			involved: [pairMatch[1] ?? "", pairMatch[2] ?? ""],
		};
	}
	return null;
}

function matchPairs(involved: string[], chars: readonly string[]): number[][] {
	const sorted = [...involved].sort();
	const out: number[][] = [];
	for (let i = 0; i < chars.length; i++) {
		for (let j = i + 1; j < chars.length; j++) {
			const pair = [chars[i] ?? "", chars[j] ?? ""].sort();
			if (pair[0] === sorted[0] && pair[1] === sorted[1]) out.push([i, j]);
		}
	}
	return out;
}

function matchTriples(involved: string[], chars: readonly string[]): number[][] {
	const sorted = [...involved].sort();
	const out: number[][] = [];
	for (let i = 0; i < chars.length; i++) {
		for (let j = i + 1; j < chars.length; j++) {
			for (let k = j + 1; k < chars.length; k++) {
				const trip = [chars[i] ?? "", chars[j] ?? "", chars[k] ?? ""].sort();
				if (trip[0] === sorted[0] && trip[1] === sorted[1] && trip[2] === sorted[2]) {
					out.push([i, j, k]);
				}
			}
		}
	}
	return out;
}

export function computePillarRelations(bazi: {
	刑冲合会: { 天干: string[]; 地支: string[] };
	柱位详细: Pillars;
}): PillarRelationPair[] {
	const gans = PILLAR_KEYS.map((k) => bazi.柱位详细[`${k}柱` as const].天干);
	const zhis = PILLAR_KEYS.map((k) => bazi.柱位详细[`${k}柱` as const].地支);
	const out: PillarRelationPair[] = [];

	const extend = (kind: "天干" | "地支", rawStrings: string[], chars: readonly string[]): void => {
		const unique = Array.from(new Set(rawStrings));
		for (const raw of unique) {
			const parsed = parseRelationString(raw);
			if (!parsed) {
				out.push({ kind, type: "其他", pillars: [], 干支: [], raw });
				continue;
			}
			const groups =
				parsed.involved.length === 3
					? matchTriples(parsed.involved, chars)
					: matchPairs(parsed.involved, chars);
			if (groups.length === 0) {
				// upstream says this relation exists but no pillar-pair matches - keep raw
				out.push({ kind, type: parsed.type, pillars: [], 干支: parsed.involved, raw });
				continue;
			}
			for (const idxs of groups) {
				out.push({
					kind,
					type: parsed.type,
					pillars: idxs.map((i) => PILLAR_KEYS[i] ?? ("年" as PillarKey)),
					干支: idxs.map((i) => chars[i] ?? ""),
					raw,
				});
			}
		}
	};

	extend("天干", bazi.刑冲合会.天干, gans);
	extend("地支", bazi.刑冲合会.地支, zhis);
	return out;
}
