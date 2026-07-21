import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { resolveChartRequest } from "../shared/request.js";
import { toolDescriptionLines } from "./description.js";
import { enrichResult } from "./enrich.js";
import { inputShape } from "./schema.js";

export { toolDescriptionLines } from "./description.js";
export { enrichResult } from "./enrich.js";
export { computeDecisionAids } from "./lib/decisionAids.js";
export { computeLiunian } from "./lib/liunian.js";
export { computeTenGodStats } from "./lib/tenGodStats.js";
export { inputShape } from "./schema.js";

export function registerGetBaziChart(server: McpServer): void {
	server.registerTool(
		"getBaziChart",
		{
			title: "Get Bazi Chart (full time)",
			description: toolDescriptionLines.join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const { referenceDate, liunianStart, liunianEnd, ...coreInput } = input;
			const result = getBaziChart(coreInput);
			const req = resolveChartRequest({ referenceDate, liunianStart, liunianEnd });
			const enriched = enrichResult(
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
