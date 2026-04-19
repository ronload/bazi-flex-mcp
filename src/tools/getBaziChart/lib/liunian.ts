// ─── 流年 ─────────────────────────────────────────────────────────────
// 上游 `shunshi-bazi-core` v0.1 不提供流年/流月/流日 API (v0.2 roadmap
// 已列入，見 node_modules/shunshi-bazi-core/README.md)。這裡以最小表驅動
// 實作:只輸出年份、干支、主星(對日主十神)、藏干十神、当前。不做流年
// vs 四柱/大運 的 pair 關係 — LLM 可從本命 `柱间关系` 結構 + 流年干支
// 自行推演。
//
// TODO(upstream): 上游 v0.2 推出流年 API 後，移除本段 + 本地表，改用
// upstream。屆時流年界點也會由上游精確處理(立春),本地 `(year-4)%60`
// 算出的是「立春後主體那一年」，元旦~立春約 5 週屬於前一干支年。

import { BRANCH_HIDDEN } from "../../../ganzhi/data.js";
import { sexagenaryOfYear, tenStar } from "../../../ganzhi/index.js";

export interface LiunianEntry {
	年份: number;
	干支: string;
	天干: string;
	地支: string;
	主星: string;
	藏干: string[];
	藏干十神: string[];
	当前: boolean;
}

export function computeLiunian(
	dayMaster: string,
	range: { start: number; end: number },
	referenceYear: number,
): LiunianEntry[] {
	const { start, end } = range;
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
	const out: LiunianEntry[] = [];
	for (let y = start; y <= end; y++) {
		const { 干支, 天干, 地支 } = sexagenaryOfYear(y);
		const hidden = BRANCH_HIDDEN[地支] ?? [];
		out.push({
			年份: y,
			干支,
			天干,
			地支,
			主星: tenStar(dayMaster, 天干),
			藏干: [...hidden],
			藏干十神: hidden.map((g) => tenStar(dayMaster, g)),
			当前: y === referenceYear,
		});
	}
	return out;
}
