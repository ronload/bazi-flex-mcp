import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { createServer } from "./mcp/server.js";

const app = new Hono();

app.get("/health", (c) => c.text("ok"));

app.all("/mcp", async (c) => {
	const server = createServer();
	const transport = new StreamableHTTPTransport();
	await server.connect(transport);
	return transport.handleRequest(c);
});

export default app;
