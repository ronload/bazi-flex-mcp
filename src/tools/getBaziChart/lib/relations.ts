// Upstream emits 刑冲合会 as flat strings like "甲己相合" with no pillar labels,
// so the pairs are recovered here by matching characters back against the four
// pillars. When two pillars share a stem or branch the recovery is genuinely
// ambiguous and every candidate pair is emitted.
//
// The information is not lost upstream: `findGanRelations(gans, short, labels)`
// takes pillar labels, but it sits behind an exports map that only opens ".".
// This layer therefore lives until the vendoring stage replaces it.

import { PILLAR_KEYS, type PillarKey } from "../../../ganzhi/data.js";
import type { PillarMap } from "../types.js";

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
	// Only 天干 uses the bare X克Y form upstream.
	const keMatch = /^(.)克(.)$/.exec(raw);
	if (keMatch) return { type: "克", involved: [keMatch[1] ?? "", keMatch[2] ?? ""] };
	const sanxingMatch = /^(.)(.)(.)三刑$/.exec(raw);
	if (sanxingMatch) {
		return {
			type: "三刑",
			involved: [sanxingMatch[1] ?? "", sanxingMatch[2] ?? "", sanxingMatch[3] ?? ""],
		};
	}
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

export function computePillarRelations(
	bazi: {
		刑冲合会: { 天干: string[]; 地支: string[] };
		柱位详细: PillarMap;
	},
	pillarKeys: readonly PillarKey[] = PILLAR_KEYS,
): PillarRelationPair[] {
	const present = pillarKeys.flatMap((k) => {
		const pillar = bazi.柱位详细[`${k}柱` as const];
		return pillar === undefined ? [] : [{ key: k, pillar }];
	});
	const gans = present.map((p) => p.pillar.天干);
	const zhis = present.map((p) => p.pillar.地支);
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
					pillars: idxs.map((i) => present[i]?.key ?? ("年" as PillarKey)),
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
