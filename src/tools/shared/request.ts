import { todayIsoDate } from "../../time/iso.js";
import { sexagenaryYearOfDate } from "../../time/sexagenaryYear.js";

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
	/** Gregorian year of `referenceDate`. Drives 大运 `当前`. */
	referenceYear: number;
	/**
	 * 立春界的干支年 (see time/sexagenaryYear.ts). Drives 流年 `当前` and the
	 * default 流年 window. Equals `referenceYear` for about 90.7% of days and
	 * `referenceYear - 1` between Jan 1 and 立春.
	 */
	currentSexagenaryYear: number;
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
	const currentSexagenaryYear = sexagenaryYearOfDate(referenceDate);
	return {
		referenceDate,
		referenceYear,
		currentSexagenaryYear,
		// 以干支年而非公曆年為中心。在元旦至立春之間這兩者相差一年,若仍以
		// 公曆年為心,預設視窗相對於真正的當前干支年會是 [-2, +4] 而非 [-3, +3]。
		liunianRange: {
			start: params.liunianStart ?? currentSexagenaryYear - 3,
			end: params.liunianEnd ?? currentSexagenaryYear + 3,
		},
	};
}
