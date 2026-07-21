// ─── 流年 ─────────────────────────────────────────────────────────────
// 上游 `shunshi-bazi-core` 至 0.2.0 仍不提供流年/流月/流日 API (0.1.0 README
// 的 v0.2 roadmap 列過，0.2.0 跳票)。這裡以最小表驅動實作:只輸出年份、
// 干支、主星(對日主十神)、藏干十神、当前。不做流年 vs 四柱/大運 的 pair
// 關係 — LLM 可從本命 `柱间关系` 結構 + 流年干支自行推演。
//
// 年份 -> 干支 用 `sexagenaryOfYear` 的 `(year-4)%60`。這**不是**近似式:
// 已實測它與 tyme4ts `SixtyCycleYear` 在 1..9999 全部 9999 年零誤差,
// 且它是全域的,而 tyme4ts 的對應 API 對 y <= -2 會拋例外。不要「升級」它。
//
// `年份: N` 依子平慣例指立春界的干支年,即 立春(N) 到 立春(N+1) 前一日。
// 當前判定因此必須吃干支年 (見 time/sexagenaryYear.ts),不能吃公曆年 —
// 元旦到立春之間兩者相差一年,那是每年 33 至 35 天、佔全年 9.3% 的窗口。

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
	currentSexagenaryYear: number,
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
			当前: y === currentSexagenaryYear,
		});
	}
	return out;
}
