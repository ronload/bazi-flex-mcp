# bazi-flex-mcp

A Bazi (八字 / Four Pillars) MCP server that works even when the birth hour is unknown.

Most real-world users don't know the exact hour they were born. Existing Bazi MCP servers require a complete birth timestamp (year / month / day / hour) and refuse to produce anything useful otherwise. `bazi-flex-mcp` is aiming to be the first open-source Bazi MCP server that handles the partial-time case directly, so an AI assistant can still reason about the chart when the user only knows the date.

Built on [`shunshi-bazi-core`](https://www.npmjs.com/package/shunshi-bazi-core), with true-solar-time correction.

## Status

Early WIP. Not published to npm yet. The scaffold ships the full-time tool today; the partial-time tool is the focus of the next milestone.

## Features

- [x] Full-time Bazi charting — `getBaziChart` (thin wrapper over `shunshi-bazi-core`)
- [x] stdio transport — for Claude Desktop and other local MCP clients
- [x] Streamable HTTP transport — for remote hosts (Cloudflare Workers, mobile Claude)
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
# → serves on http://localhost:3000
#   /health  — health check
#   /mcp     — MCP Streamable HTTP endpoint
```

### Inspector

```bash
bunx @modelcontextprotocol/inspector bun run src/stdio.ts
```

## The `getBaziChart` tool

Computes a full Bazi chart from a complete birth time.

### Input

| Field           | Type           | Required | Notes                                                                              |
| --------------- | -------------- | -------- | ---------------------------------------------------------------------------------- |
| `year`          | int            | yes      | Gregorian                                                                          |
| `month`         | int 1-12       | yes      |                                                                                    |
| `day`           | int 1-31       | yes      |                                                                                    |
| `hour`          | int 0-23       | yes      |                                                                                    |
| `minute`        | int 0-59       | no       | default 0                                                                          |
| `gender`        | 0 \| 1         | yes      | 0 = female, 1 = male                                                               |
| `city`          | string         | no       | enables true-solar-time correction                                                 |
| `longitude`     | number (°E)    | no       |                                                                                    |
| `latitude`      | number (°N)    | no       |                                                                                    |
| `referenceDate` | `YYYY-MM-DD`   | no       | decides which decade-cycle is marked `当前`; defaults to today                      |

### Output shape (post-processing on top of `shunshi-bazi-core`)

This server is a thin wrapper around [`shunshi-bazi-core`](https://www.npmjs.com/package/shunshi-bazi-core). The raw engine output is kept intact and augmented with a few fields to make the chart more LLM-friendly:

- `八字.柱位详细.日柱.主星` is `null` (the day-master carries no ten-god against itself). Identify the day-pillar via `日柱.isDayMaster === true`; `日柱.label` is `"日主"` for display. The raw engine puts `"元男"` / `"元女"` here — this server replaces that with a cleaner signal.
- `八字.十神统计` — aggregate counts keyed by ten-god, each `{ 透, 藏, 共 }`. `透` comes from year/month/hour pillars' `主星`; `藏` comes from all four pillars' `副星` (earth-branch hidden stems). The day-master itself is excluded.
- `八字.大运[].日主关系` is `null` when there is no day-master-to-decade-stem relation (instead of `""`).
- `八字.大运[].当前` is recomputed against `meta.referenceDateUsed` so historical / hypothetical scenarios (e.g. "if I look at this chart at age 30") are supported.
- `meta.referenceDateUsed` — echoes the effective reference date.
- `meta.scoringMethod` — documents how `八字.五行分值` is computed (see below).
- All time strings (`输入.公历`, `真太阳时.钟表时间`, `真太阳时.真太阳时`, `八字.公历`) are normalised to ISO 8601 with second precision (`YYYY-MM-DDTHH:MM:SS`). The raw engine uses a mix of minute-precision (`"YYYY-MM-DD HH:MM"`) and Chinese-formatted second-precision (`"YYYY年M月D日 HH:MM:SS"`); this server unifies them so consumers do not have to reconcile formats or lose seconds. `真太阳时.修正秒数` is added as an integer companion to `修正分钟`.

### 空亡 (empty death) — two complementary surfaces

`shunshi-bazi-core` exposes 空亡 in two places with different semantics. The wrapper keeps both and documents the distinction:

- `柱位详细.{柱}.空亡` — the two earth branches that are void in **that pillar's own 旬** (e.g. 壬午 is in 甲戌 旬 → `"申酉"`). This is pure reference data; it does not mean the pillar itself is falling into 空亡.
- `柱位详细.{柱}.神煞` containing `"空亡"` — upstream tags a pillar when its own earth branch falls into the **union of 日柱旬空 and 年柱旬空**. This bakes in two traditional conventions at once: modern practice "以日起空亡" uses day-xun; some older schools use year-xun. If you specifically want strict modern behaviour, ignore the `神煞` tag and check each pillar's branch against `日柱.空亡` yourself.

### Wuxing score method

`八字.五行分值` uses `shunshi-bazi-core`'s built-in weighting:

| Source                         | Weight                         |
| ------------------------------ | ------------------------------ |
| Each heavenly stem (4 pillars) | 1.0                            |
| Earth-branch 本气 (primary)    | 1.0                            |
| Earth-branch 中气 (secondary)  | 0.5                            |
| Earth-branch 余气 (residual)   | 0.3                            |

No month-command bonus and no transparent-stem bonus are applied. The raw numbers are a measure of **relative presence**, not classical 旺衰 strength — a higher score does not automatically mean the day-master is strong. Consumers that need 旺衰 judgement should factor in month-command, 得地/失地, 得势/失势 themselves. `meta.scoringMethod` repeats this information in machine-readable form.

## Development

```bash
bun install
bun run typecheck
bun dev            # HTTP on :3000 (Bun)
bun run dev:worker # HTTP on :8787 via local workerd (Wrangler)
bun run dev:stdio  # stdio
```

## Deployment (Cloudflare Workers)

The HTTP transport is built on Hono + Web Standards, so it runs on Cloudflare Workers without code changes. This repo ships a `wrangler.jsonc` with two deploy modes.

### Deploy your own instance

```bash
bunx wrangler login   # first time only
bun run deploy
```

Your worker will be served from `https://bazi-flex-mcp.<your-subdomain>.workers.dev`, with MCP at `/mcp`.

### Custom domain

To bind the worker to a domain managed on Cloudflare, override the `production` env in `wrangler.jsonc`:

```jsonc
"env": {
  "production": {
    "name": "your-worker-name",
    "routes": [
      { "pattern": "bazi.example.com", "custom_domain": true }
    ]
  }
}
```

Then:

```bash
bun run deploy:prod
```

Wrangler will create the DNS record and provision the certificate automatically.

### Auto-deploy on push

`.github/workflows/deploy.yml` runs typecheck + tests on every push to `main`, then deploys with `deploy:prod`. Configure these repo secrets:

- `CLOUDFLARE_API_TOKEN` — create at https://dash.cloudflare.com/profile/api-tokens with `Workers Scripts: Edit`, `Workers Routes: Edit`, `DNS: Edit` on your zone, plus `Account Settings: Read`
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard sidebar

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
