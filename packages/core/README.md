# @bazi-flex/core

Bazi calculation owned by this repository, so the MCP layer stops depending on
a package whose exports map closes off the internals it needs.

## Layout

`src/lib/` is vendored upstream code and is exempt from this repository's
Biome config, so it can stay diffable against its origin. Everything else is
written here: `src/calendar/` replaces upstream `lib/bazi.ts`, which was only a
carrier for `tyme4ts` calls, and `src/getBaziChart.ts` replaces the upstream
entry point minus its 黄历 half.

## Provenance

`src/lib/` is vendored from
[shunshi-ai/bazi-reader-mcp](https://github.com/shunshi-ai/bazi-reader-mcp),
`packages/bazi-core`, tag `v0.2.0`, commit
`53e64721eb341d7360d10e5873a2c8b4a3912e16`. Copyright (c) 2026 Shunshi.AI,
MIT licensed. `LICENSE` in this directory is that project's license file,
carried over unmodified.

The copies started byte-identical to upstream. Their git blob SHAs at the
vendoring commit were:

| file | blob SHA |
| --- | --- |
| `src/lib/cityCache.ts` | `ada10a488edc5b3c655cd0dfc7a6995f303e52db` |
| `src/lib/relations.ts` | `d69213fcedef766d2d5d74fb73322ba3fa3c60f8` |
| `src/lib/shensha.ts` | `c618e3473a191c22005c35e04e0855eb045c5e37` |
| `src/lib/solarTime.ts` | `53c695fad7299695d14a1e22afdb378ff8afef9f` |

The same MIT text ships in the published npm tarball, and its blob SHA there
matches the one in the upstream repository, at both the repository root and
this package's directory. That is what makes vendoring the TypeScript sources
rather than the compiled `dist` legitimate.

## Parity harnesses

`test/vendorParity.test.ts` compares every vendored module against the compiled
upstream artifact, reached by file path because the upstream exports map only
opens `.`. That is what licenses editing vendored code: an edit that changes
behaviour fails there.

`test/chartParity.test.ts` does the same job one level up, comparing
`getBaziChart` against the published package over a sweep of dates, hours,
locations, genders and both sects. It compares `JSON.stringify` output, so key
order counts too. That is what licenses `src/calendar/` being a rewrite rather
than a copy.

Keep both until this package stops tracking upstream.

## 子时分日法

`tyme4ts` resolves the eight char through `LunarHour.provider`, a static field,
and `ChildLimit` re-derives its own eight char internally, so 起运 direction
follows that field too. A per-call provider argument therefore cannot express
`sect` on its own. `src/calendar/sect.ts` is the single place that assigns it,
unconditionally, so no call inherits the previous call's sect.
