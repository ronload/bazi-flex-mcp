import { todayIsoDate } from "../../time/iso.js";
import { sexagenaryYearOfDate } from "../../time/sexagenaryYear.js";

const DEFAULT_LIUNIAN_RADIUS = 3;

export interface ResolvedChartRequest {
	referenceDate: string;
	/** Gregorian year. Drives 大运 `当前`. */
	referenceYear: number;
	/** 立春-bounded 干支年. Drives 流年 `当前`, and differs from `referenceYear` between Jan 1 and 立春. */
	currentSexagenaryYear: number;
	liunianRange: { start: number; end: number };
}

export interface ChartRequestParams {
	referenceDate?: string | undefined;
	liunianStart?: number | undefined;
	liunianEnd?: number | undefined;
}

/** Single read point for the clock, so tests and the oracle harness can inject it. */
export function resolveChartRequest(
	params: ChartRequestParams,
	now: () => string = todayIsoDate,
): ResolvedChartRequest {
	const referenceDate = params.referenceDate ?? now();
	const currentSexagenaryYear = sexagenaryYearOfDate(referenceDate);
	return {
		referenceDate,
		referenceYear: Number(referenceDate.slice(0, 4)),
		currentSexagenaryYear,
		liunianRange: {
			start: params.liunianStart ?? currentSexagenaryYear - DEFAULT_LIUNIAN_RADIUS,
			end: params.liunianEnd ?? currentSexagenaryYear + DEFAULT_LIUNIAN_RADIUS,
		},
	};
}
