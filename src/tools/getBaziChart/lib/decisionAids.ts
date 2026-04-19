// ─── 决策辅助 (decision aids) ─────────────────────────────────────────
// Pure aggregation of already-available fields. No 旺衰/格局/用神 judgement
// is made here — that is intentionally left to the consumer. These helpers
// just surface the raw inputs (month-command relation, root presence,
// transparent/hidden balance) so an LLM does not have to recompute them.

import { BRANCH_HIDDEN, PILLAR_KEYS, type PillarKey, STEM_ELEMENT } from "../../../ganzhi/data.js";
import { elementRelation } from "../../../ganzhi/index.js";
import type { Pillars } from "../types.js";
import type { TenGodStat } from "./tenGodStats.js";

export interface DecisionAids {
	日主得令: {
		月支: string;
		月令主气: string;
		月令五行: string;
		日主五行: string;
		关系: string;
		得令: boolean;
	} | null;
	日主根气: {
		日主五行: string;
		柱位根: Array<{ 柱: PillarKey; 地支: string; 同类藏干: string[]; 分值: number }>;
		总根气: number;
	};
	透藏平衡: {
		比劫透: number;
		比劫藏: number;
		异类透: number;
		异类藏: number;
		比劫共: number;
		异类共: number;
	};
}

const CANG_WEIGHT = [1.0, 0.5, 0.3] as const;

export function computeDecisionAids(
	bazi: { 日主: string; 柱位详细: Pillars },
	tenGodStats: Record<string, TenGodStat>,
	pillarKeys: readonly PillarKey[] = PILLAR_KEYS,
): DecisionAids {
	const 日主五行 = STEM_ELEMENT[bazi.日主] ?? "";

	// 日主得令
	const 月支 = bazi.柱位详细.月柱.地支;
	const 月令主气 = BRANCH_HIDDEN[月支]?.[0] ?? "";
	const 月令五行 = STEM_ELEMENT[月令主气] ?? "";
	const rel = elementRelation(日主五行, 月令五行);
	const 日主得令 = rel
		? {
				月支,
				月令主气,
				月令五行,
				日主五行,
				关系: rel,
				得令: rel === "同我" || rel === "生我",
			}
		: null;

	// 日主根气
	const 柱位根: DecisionAids["日主根气"]["柱位根"] = [];
	let 总根气 = 0;
	for (const key of pillarKeys) {
		const pillar = bazi.柱位详细[`${key}柱` as const];
		const hidden = pillar.藏干;
		const matches: string[] = [];
		let score = 0;
		for (let i = 0; i < hidden.length; i++) {
			const stem = hidden[i];
			if (!stem) continue;
			if (STEM_ELEMENT[stem] === 日主五行) {
				matches.push(stem);
				score += CANG_WEIGHT[i] ?? 0.3;
			}
		}
		总根气 += score;
		if (matches.length > 0) {
			柱位根.push({
				柱: key,
				地支: pillar.地支,
				同类藏干: matches,
				分值: Math.round(score * 10) / 10,
			});
		}
	}

	// 透藏平衡 — 比劫 (same-element ten-gods) vs 异类 (everything else)
	let 比劫透 = 0;
	let 比劫藏 = 0;
	let 异类透 = 0;
	let 异类藏 = 0;
	for (const [k, v] of Object.entries(tenGodStats)) {
		if (k === "比肩" || k === "劫财") {
			比劫透 += v.透;
			比劫藏 += v.藏;
		} else {
			异类透 += v.透;
			异类藏 += v.藏;
		}
	}

	return {
		日主得令,
		日主根气: { 日主五行, 柱位根, 总根气: Math.round(总根气 * 10) / 10 },
		透藏平衡: {
			比劫透,
			比劫藏,
			异类透,
			异类藏,
			比劫共: 比劫透 + 比劫藏,
			异类共: 异类透 + 异类藏,
		},
	};
}
