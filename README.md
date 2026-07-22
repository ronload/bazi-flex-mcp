# bazi-flex-mcp

[![CI](https://github.com/ronload/bazi-flex-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ronload/bazi-flex-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.1.0-000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Biome](https://img.shields.io/badge/Biome-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev)
[![MCP](https://img.shields.io/badge/MCP-1.0-5b5bd6)](https://modelcontextprotocol.io)

A Bazi (八字 / Four Pillars) MCP server that works even when the birth hour is unknown.

Most real-world users don't know the exact hour they were born. Existing Bazi MCP servers require a complete birth timestamp (year / month / day / hour) and refuse to produce anything useful otherwise. `bazi-flex-mcp` is aiming to be the first open-source Bazi MCP server that handles the partial-time case directly, so an AI assistant can still reason about the chart when the user only knows the date.

The calculation lives in this repository (`packages/core`, on top of [`tyme4ts`](https://www.npmjs.com/package/tyme4ts)), with true-solar-time correction.

## Status

Early WIP. Not published to npm yet. Both the full-time and partial-time tools are now available; auth on the HTTP transport is the next milestone.

## Features

- [x] Full-time Bazi charting — `getBaziChart`
- [x] Partial-time mode — `getBaziChartPartial`, chart computation when the birth hour is unknown
- [x] stdio transport — for Claude Desktop and other local MCP clients
- [x] Streamable HTTP transport — for remote hosts (Cloudflare Workers, mobile Claude)
- [ ] OAuth / auth on HTTP transport

## Quick start

### Claude Desktop (stdio, local)

Clone the repo and point Claude Desktop's MCP config at it:

```json
{
  "mcpServers": {
    "bazi-flex": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/bazi-flex-mcp/src/transports/stdio.ts"]
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
bunx @modelcontextprotocol/inspector bun run src/transports/stdio.ts
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
| `liunianStart`  | int (year)     | no       | first Gregorian year for `八字.流年`; defaults to `referenceDate - 3`               |
| `liunianEnd`    | int (year)     | no       | last Gregorian year for `八字.流年`; defaults to `referenceDate + 3`                |

### Output shape (post-processing on top of the calculation core)

The chart comes from `@bazi-flex/core` in this repository. Its output is kept intact and augmented with a few fields to make the chart more LLM-friendly:

- `八字.柱位详细.日柱.主星` is `null` (the day-master carries no ten-god against itself). Identify the day-pillar via `日柱.isDayMaster === true`; `日柱.label` is `"日主"` for display. The raw engine puts `"元男"` / `"元女"` here — this server replaces that with a cleaner signal.
- `八字.十神统计` — aggregate counts keyed by ten-god, each `{ 透, 藏, 共 }`. `透` comes from year/month/hour pillars' `主星`; `藏` comes from all four pillars' `副星` (earth-branch hidden stems). The day-master itself is excluded.
- `八字.大运[].日主关系` is `null` when there is no day-master-to-decade-stem relation (instead of `""`).
- `八字.大运[].当前` is recomputed against `meta.referenceDateUsed` so historical / hypothetical scenarios (e.g. "if I look at this chart at age 30") are supported.
- `meta.referenceDateUsed` — echoes the effective reference date.
- `meta.scoringMethod` — documents how `八字.五行分值` is computed (see below).
- `八字.柱间关系` — pair-wise (and triple-wise for 三刑) expansion of upstream's flat `刑冲合会`. Each entry carries `pillars` (which pillars are involved) and `干支` so complex charts with duplicate stems/branches (e.g. two 乙 across month/day) surface all candidate pairs instead of hiding the ambiguity. Parses upstream's short-form strings — does not re-implement relation rules.
- `八字.流年` / `八字.流年范围` — year-by-year 流年 table spanning `[liunianStart, liunianEnd]` (defaults `[referenceDate - 3, +3]` = 7 years; widen via inputs if you need a longer horizon). Each entry: `{ 年份, 干支, 天干, 地支, 主星, 藏干, 藏干十神, 当前 }`. 流年 year boundaries follow the 立春-based 干支年 convention (first ~5 weeks of a Gregorian year before 立春 technically belong to the previous 干支年). Relations against 四柱/大运 are **not** pre-computed — combine `流年[].干支` with `柱间关系` logic or `大运[].干支` yourself.
- `八字.决策辅助` — three derived metrics so consumers do not recompute them: `日主得令` (day-master element vs month-command element, `得令` boolean), `日主根气` (day-master-element presence across all four earth-branch hidden-stems using 本/中/余 weights 1.0/0.5/0.3), `透藏平衡` (比劫 vs 异类 transparent/hidden counts). These are **raw inputs** — no 旺衰/格局/用神 judgement is made. Feed them into your own reasoning rules.
- All time strings (`输入.公历`, `真太阳时.钟表时间`, `真太阳时.真太阳时`, `八字.公历`) are normalised to ISO 8601 with second precision (`YYYY-MM-DDTHH:MM:SS`). The raw engine uses a mix of minute-precision (`"YYYY-MM-DD HH:MM"`) and Chinese-formatted second-precision (`"YYYY年M月D日 HH:MM:SS"`); this server unifies them so consumers do not have to reconcile formats or lose seconds. `真太阳时.修正秒数` is added as an integer companion to `修正分钟`.

### Where the enrichment layer still works around the core

- **Pair-wise 柱间关系** — the core emits `刑冲合会` as a flat short-form list without pillar labels, and the enrichment layer recovers the pairs by matching characters back against the four pillars. Now that the core is in this repository it can emit the pairs directly, which also removes the ambiguity when two pillars share a stem.
- **流年 table** — the core has no 流年 API, so the table is built from the canonical `(year - 4) mod 60` year-ganzhi rule plus a local 藏干 lookup, both of which duplicate tables `tyme4ts` already holds.
- **决策辅助** — pure aggregation of already-computed fields, nothing to move.

### 空亡 (empty death) — structured surface

Upstream packed 空亡 into a single per-pillar string (`柱.空亡`) plus a tag inside `柱.神煞`. Because the two surfaces used different semantics (reference data vs. void judgement based on a union of 日柱旬 and 年柱旬), consumer LLMs conflated them. This server restructures 空亡 into three explicit fields:

- **`八字.旬空`** — top-level index of the void branches for the two traditional reference 旬s:

  ```json
  "旬空": { "日柱旬空": ["午", "未"], "年柱旬空": ["申", "酉"] }
  ```

- **`柱位详细.{柱}.所在旬空亡: string[]`** — the two branches void in *that pillar's own* 旬. Reference data only; does **not** mean the pillar itself is falling into 空亡.
- **`柱位详细.{柱}.落空亡: { 日柱旬: boolean, 年柱旬: boolean }`** — does this pillar's earth branch actually fall into day-xun void / year-xun void. **This is the authoritative "is this pillar in 空亡" signal.**
- **`大运[].所在旬空亡` / `大运[].落空亡`** — the same two structured fields are applied to every decade-cycle entry, so 大运 and 柱位详细 share a single 空亡 surface. The upstream `大运[].空亡: string` field is removed in favour of these.

Conventions:

- Modern practice (以日起空亡): use `落空亡.日柱旬` alone.
- Traditional schools using year-xun: use `落空亡.年柱旬`.
- Upstream's `神煞` array still contains a `"空亡"` string for back-compat; it equals the boolean-OR of the two `落空亡` flags.

Upstream's original `柱.空亡` and `大运[].空亡` single-string fields have been removed from the wrapper output — the structured fields above supersede them.

### Wuxing score method

`八字.五行分值` uses the calculation core's weighting:

| Source                         | Weight                         |
| ------------------------------ | ------------------------------ |
| Each heavenly stem (4 pillars) | 1.0                            |
| Earth-branch 本气 (primary)    | 1.0                            |
| Earth-branch 中气 (secondary)  | 0.5                            |
| Earth-branch 余气 (residual)   | 0.3                            |

No month-command bonus and no transparent-stem bonus are applied. The raw numbers are a measure of **relative presence**, not classical 旺衰 strength — a higher score does not automatically mean the day-master is strong. Consumers that need 旺衰 judgement should factor in month-command, 得地/失地, 得势/失势 themselves. `meta.scoringMethod` repeats this information in machine-readable form.

## The `getBaziChartPartial` tool

For callers who know only the birth date (year/month/day) but not the hour. Returns a 3-pillar chart (年/月/日) with all hour-dependent fields stripped, nulled, or recomputed.

### Input

| Field           | Type           | Required | Notes                                                                              |
| --------------- | -------------- | -------- | ---------------------------------------------------------------------------------- |
| `year`          | int            | yes      | Gregorian                                                                          |
| `month`         | int 1-12       | yes      |                                                                                    |
| `day`           | int 1-31       | yes      |                                                                                    |
| `gender`        | 0 \| 1         | yes      | 0 = female, 1 = male                                                               |
| `referenceDate` | `YYYY-MM-DD`   | no       | decides which decade-cycle is marked `当前`; defaults to today                      |
| `liunianStart`  | int (year)     | no       | first Gregorian year for `八字.流年`; defaults to `referenceDate - 3`               |
| `liunianEnd`    | int (year)     | no       | last Gregorian year for `八字.流年`; defaults to `referenceDate + 3`                |

`hour`, `minute`, `city`, `longitude`, `latitude` are **not accepted** — they are only meaningful when the birth hour is known. If you have an hour, use `getBaziChart` instead.

### How it works

The chart is built natively from three pillars. No placeholder hour is invented, so nothing in the response is derived from a time that was never supplied.

- `八字.三柱` replaces `八字.四柱` and holds exactly three 干支.
- `时柱` is **absent** from `八字.柱位详细` (not nulled: the key does not exist).
- `命宫`, `身宫`, `胎元`, `胎息` are `null` (these formulas require the birth hour).
- `真太阳时` is **omitted** from the response; the correction only ever moves the hour pillar.
- `输入.公历` and `八字.公历` are date-only `YYYY-MM-DD`; `输入.时辰` is `null`; `八字.农历` carries no 时辰 suffix.
- `八字.十神统计`, `八字.五行分值`, `八字.刑冲合会`, `八字.柱间关系` and `八字.决策辅助.日主根气` all cover 年/月/日 only. `占比` in `八字.五行分值` is normalised over the 3-pillar total.
- `八字.大运` is **kept**: the decade-cycle direction (顺/逆) depends only on year-pillar polarity + gender, both unaffected by hour. **However**, 起运 and 起运日期 are measured from the birth moment to the neighbouring solar term, and the reference moment here is the midpoint of the day's month-command window, so they may carry **±1 day to ±1-2 month error**, and the resulting 起始年份/结束年份 may shift by ±1 year. Treat decade boundaries as approximate windows. See `meta.disclaimer.大运起运精度`.
- `八字.流年` is unchanged: derivation depends only on the day-master stem and the 干支年.
- `八字.旬空` and per-pillar `所在旬空亡` / `落空亡` are unchanged in semantics; the day pillar depends on the hour only across the `23:00` 子时 switch, which no date-only input can reach.

### 节气歧义

年柱 and 月柱 use day-granular attribution: the whole calendar day on which a 節 falls belongs to the new month, and 立春 day to the new 干支年. That is a convention, not a fact, and on the ~1.6% of dates that carry a 節 the true answer depends on an hour nobody supplied.

Rather than hide the choice, `八字.节气歧义` reports both candidates:

```jsonc
"节气歧义": {
  "节气": "立春",
  "时刻": "2000-02-04T20:40:24",
  "影响": ["年柱", "月柱"],
  "此刻之前": { "年柱": "己卯", "月柱": "丁丑" },
  "此刻之后": { "年柱": "庚辰", "月柱": "戊寅" }
}
```

`此刻之后` is what the rest of the response uses. On ordinary days the field is `null`. If the caller can narrow the birth time to one side of `时刻`, prefer the matching branch and say so.

### `meta.disclaimer`

The response includes a `meta.disclaimer` object enumerating exactly which fields are absent, null, or 3-pillar-only and why. Surface it to the end user when explaining the chart's confidence level: it is the single source of truth on what is and isn't trustworthy in a partial-time chart.

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
- Validation: Zod 4
- Bazi engine: `packages/core` in this repository, on [`tyme4ts`](https://www.npmjs.com/package/tyme4ts)

## Credits

- [`shunshi-bazi-core`](https://github.com/shunshi-ai/bazi-reader-mcp) — the 神煞, 刑冲合会, city and true-solar-time modules in `packages/core/src/lib` are vendored from it under MIT. See [`packages/core/README.md`](./packages/core/README.md) for provenance.
- [`cantian-ai/bazi-mcp`](https://github.com/cantian-ai/bazi-mcp) — prior art in the Bazi MCP space

## License

MIT
