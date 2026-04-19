import { expect, test } from "bun:test";
import { createServer } from "./server.js";

test("createServer returns an MCP server instance", () => {
	const server = createServer();
	expect(server).toBeDefined();
});
