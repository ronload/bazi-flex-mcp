import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { todayIsoDate } from "../../time/iso.js";
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
			const effectiveRef = referenceDate ?? todayIsoDate();
			const refYear = Number(effectiveRef.slice(0, 4));
			const range = {
				start: liunianStart ?? refYear - 3,
				end: liunianEnd ?? refYear + 3,
			};
			const enriched = enrichResult(
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
