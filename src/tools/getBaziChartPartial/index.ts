import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "@bazi-flex/core";
import { jsonToolResult, splitChartInput } from "../shared/handler.js";
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
			const { coreInput, birth, req } = splitChartInput(input);
			const result = getBaziChart({
				...coreInput,
				hour: PLACEHOLDER_HOUR,
				minute: PLACEHOLDER_MINUTE,
			});
			return jsonToolResult(enrichPartialResult(result, birth, req));
		},
	);
}
