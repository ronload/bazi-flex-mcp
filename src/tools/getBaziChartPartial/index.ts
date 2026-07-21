import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { resolveChartRequest } from "../shared/request.js";
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
			const req = resolveChartRequest({ referenceDate, liunianStart, liunianEnd });
			const enriched = enrichPartialResult(
				result,
				{
					year: input.year,
					month: input.month,
					day: input.day,
				},
				req,
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
