import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { todayIsoDate } from "../../time/iso.js";
import { toolDescriptionLines } from "./description.js";
import { enrichPartialResult } from "./enrich.js";
import { inputShape } from "./schema.js";

export { toolDescriptionLines } from "./description.js";
export { enrichPartialResult } from "./enrich.js";
export { inputShape } from "./schema.js";

const PLACEHOLDER_HOUR = 12;
const PLACEHOLDER_MINUTE = 0;

export function registerGetBaziChartPartial(server: McpServer): void {
	server.registerTool(
		"getBaziChartPartial",
		{
			title: "Get Bazi Chart (no hour)",
			description: toolDescriptionLines.join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const { referenceDate, liunianStart, liunianEnd, ...dateInput } = input;
			const result = getBaziChart({
				...dateInput,
				hour: PLACEHOLDER_HOUR,
				minute: PLACEHOLDER_MINUTE,
			});
			const effectiveRef = referenceDate ?? todayIsoDate();
			const refYear = Number(effectiveRef.slice(0, 4));
			const range = {
				start: liunianStart ?? refYear - 3,
				end: liunianEnd ?? refYear + 3,
			};
			const enriched = enrichPartialResult(
				result,
				{
					year: input.year,
					month: input.month,
					day: input.day,
				},
				effectiveRef,
				range,
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(enriched, null, 2),
					},
				],
			};
		},
	);
}
