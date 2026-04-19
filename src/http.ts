import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { createServer } from "./server.js";

const app = new Hono();

app.get("/health", (c) => c.text("ok"));

app.all("/mcp", async (c) => {
	const server = createServer();
	const transport = new StreamableHTTPTransport();
	await server.connect(transport);
	return transport.handleRequest(c);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`MCP server listening on http://localhost:${port}`);

export default { port, fetch: app.fetch };
