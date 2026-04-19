import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetBaziChart } from "./tools/getBaziChart.js";

export function createServer(): McpServer {
	const server = new McpServer({
		name: "bazi-flex-mcp",
		version: "0.0.1",
	});

	registerGetBaziChart(server);

	return server;
}
