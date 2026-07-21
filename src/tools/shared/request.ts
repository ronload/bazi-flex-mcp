import { todayIsoDate } from "../../time/iso.js";

/**
 * The time-dependent inputs of a chart request, resolved once per call.
 *
 * 抽出來的理由有三個，都不只是整潔：
 *   1. 這八行原本在四個地方逐字重複（兩個 handler + 兩個 enrich 的 fallback），
 *      任何語意修正都得改四次，漂移只是時間問題。
 *   2. `new Date()` 原本散在請求路徑上。集中之後時鐘只有一個讀取點，
 *      測試與 oracle harness 可以注入它，`当前` 這類欄位才可能是決定性的。
 *   3. Stage 2 要把 referenceDate 升為帶時區語義的一級輸入，這是它的落點。
 */
export interface ResolvedChartRequest {
	/** ISO-like date (YYYY-M-D) actually used, echoed back as `meta.referenceDateUsed`. */
	referenceDate: string;
	/** Gregorian year of `referenceDate`. Drives 大运 `当前` and 流年 `当前`. */
	referenceYear: number;
	/** Inclusive 流年 window. */
	liunianRange: { start: number; end: number };
}

export interface ChartRequestParams {
	referenceDate?: string | undefined;
	liunianStart?: number | undefined;
	liunianEnd?: number | undefined;
}

export function resolveChartRequest(
	params: ChartRequestParams,
	now: () => string = todayIsoDate,
): ResolvedChartRequest {
	const referenceDate = params.referenceDate ?? now();
	const referenceYear = Number(referenceDate.slice(0, 4));
	return {
		referenceDate,
		referenceYear,
		liunianRange: {
			start: params.liunianStart ?? referenceYear - 3,
			end: params.liunianEnd ?? referenceYear + 3,
		},
	};
}
