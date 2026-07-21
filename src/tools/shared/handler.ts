import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BirthDate } from "./pillars.js";
import {
	type ChartRequestParams,
	type ResolvedChartRequest,
	resolveChartRequest,
} from "./request.js";

interface ChartToolInput extends ChartRequestParams {
	year: number;
	month: number;
	day: number;
}

interface SplitChartInput<I> {
	coreInput: Omit<I, keyof ChartRequestParams>;
	birth: BirthDate;
	req: ResolvedChartRequest;
}

/** Separates the presentation-only params from what the upstream engine takes. */
export function splitChartInput<I extends ChartToolInput>(input: I): SplitChartInput<I> {
	const { referenceDate, liunianStart, liunianEnd, ...coreInput } = input;
	return {
		coreInput,
		birth: { year: input.year, month: input.month, day: input.day },
		req: resolveChartRequest({ referenceDate, liunianStart, liunianEnd }),
	};
}

const JSON_INDENT = 2;

export function jsonToolResult(payload: unknown): CallToolResult {
	return { content: [{ type: "text", text: JSON.stringify(payload, null, JSON_INDENT) }] };
}
