import { getThreePillarChart } from "@bazi-flex/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonToolResult, splitChartInput } from "../shared/handler.js";
import { toolDescriptionLines } from "./description.js";
import { enrichPartialResult } from "./enrich.js";
import { inputShape } from "./schema.js";

export { toolDescriptionLines } from "./description.js";
export { enrichPartialResult } from "./enrich.js";
export { inputShape } from "./schema.js";

export function registerGetBaziChartPartial(server: McpServer): void {
	server.registerTool(
		"getBaziChartPartial",
		{
			title: "Get Bazi Chart (no hour)",
			description: toolDescriptionLines.join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const { coreInput, birth, req } = splitChartInput(input);
			return jsonToolResult(enrichPartialResult(getThreePillarChart(coreInput), birth, req));
		},
	);
}
