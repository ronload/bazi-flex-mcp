import { getBaziChart } from "@bazi-flex/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonToolResult, splitChartInput } from "../shared/handler.js";
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
			const { coreInput, birth, req } = splitChartInput(input);
			return jsonToolResult(enrichResult(getBaziChart(coreInput), birth, req));
		},
	);
}
