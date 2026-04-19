# bazi-flex-mcp

A Bazi (八字 / Four Pillars) MCP server that works even when the birth hour is unknown.

Most real-world users don't know the exact hour they were born. Existing Bazi MCP servers require a complete birth timestamp (year / month / day / hour) and refuse to produce anything useful otherwise. `bazi-flex-mcp` is aiming to be the first open-source Bazi MCP server that handles the partial-time case directly, so an AI assistant can still reason about the chart when the user only knows the date.

Built on [`shunshi-bazi-core`](https://www.npmjs.com/package/shunshi-bazi-core), with true-solar-time correction.

## Status

Early WIP. Not published to npm yet. The scaffold ships the full-time tool today; the partial-time tool is the focus of the next milestone.

## Features

- [x] Full-time Bazi charting — `getBaziChart` (thin wrapper over `shunshi-bazi-core`)
- [x] stdio transport — for Claude Desktop and other local MCP clients
- [x] Streamable HTTP transport — for remote hosts (Railway, mobile Claude)
- [ ] Partial-time mode — chart computation when the birth hour is unknown
- [ ] OAuth / auth on HTTP transport

## Quick start

### Claude Desktop (stdio, local)

Clone the repo and point Claude Desktop's MCP config at it:

```json
{
  "mcpServers": {
    "bazi-flex": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/bazi-flex-mcp/src/stdio.ts"]
    }
  }
}
```

Restart Claude Desktop. You should see `getBaziChart` in the tool list.

### HTTP (remote)

```bash
bun install
bun dev
# → MCP server listening on http://localhost:3000
#   /health  — health check
#   /mcp     — MCP Streamable HTTP endpoint
```

Set `PORT` to override the default port.

### Inspector

```bash
bunx @modelcontextprotocol/inspector bun run src/stdio.ts
```

## The `getBaziChart` tool

Computes a full Bazi chart from a complete birth time.

| Field       | Type           | Required | Notes                               |
| ----------- | -------------- | -------- | ----------------------------------- |
| `year`      | int            | yes      | Gregorian                           |
| `month`     | int 1-12       | yes      |                                     |
| `day`       | int 1-31       | yes      |                                     |
| `hour`      | int 0-23       | yes      |                                     |
| `minute`    | int 0-59       | no       | default 0                           |
| `gender`    | 0 \| 1         | yes      | 0 = female, 1 = male                |
| `city`      | string         | no       | enables true-solar-time correction  |
| `longitude` | number (°E)    | no       |                                     |
| `latitude`  | number (°N)    | no       |                                     |

## Development

```bash
bun install
bun run typecheck
bun dev           # HTTP on :3000
bun run dev:stdio # stdio
```

## Tech stack

- Runtime: Bun
- MCP: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)
- HTTP: [Hono](https://hono.dev) + [`@hono/mcp`](https://www.npmjs.com/package/@hono/mcp)
- Validation: Zod 3
- Bazi engine: [`shunshi-bazi-core`](https://www.npmjs.com/package/shunshi-bazi-core)

## Credits

- [`shunshi-bazi-core`](https://github.com/shunshi-ai/bazi-reader-mcp) — calculation engine
- [`cantian-ai/bazi-mcp`](https://github.com/cantian-ai/bazi-mcp) — prior art in the Bazi MCP space

## License

MIT
