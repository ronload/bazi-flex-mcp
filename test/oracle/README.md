# Oracle

"Oracle" is the testing term (test oracle): the source of truth a run is judged
against. Here that source is the current code's actual behaviour on top of
`tyme4ts@1.4.6`. Nothing to do with Oracle
Corporation; it is fully offline and touches no network service.

It exists because the calculation was vendored into this repo and the later
stages reshape the output. "Did that break anything" cannot be answered by
eyeballing a few charts.
It needs something that answers "byte-identical" or "these 41 cases moved" across
thousands of inputs.

## Usage

```
bun run oracle:check      # compare against the baseline; CI runs this, and bun test covers it too
bun run oracle:baseline   # rebuild the baseline, a deliberate act, see below
bun run oracle:coverage   # what the corpus reaches

bun run test/oracle/cli.ts explain lichun/2026+0001      # the inputs behind one case
bun run test/oracle/cli.ts dump  lichun/2026+0001 /tmp/a # full payloads to disk
bun run test/oracle/cli.ts diff  /tmp/a/x.json /tmp/b/x.json  # field-level diff
```

A typical investigation: `check` says which cases moved, then `dump` before and
after plus `diff` says what moved inside them. A fingerprint deliberately cannot
answer the second question, which is the price of keeping tens of megabytes of
generated payloads out of version control.

## Layout

| File | Responsibility |
| --- | --- |
| `corpus.ts` | The corpus: six layers, deterministic, gated by `CORPUS_VERSION` |
| `cities.ts` | Frozen snapshot of the city tables |
| `prng.ts` | mulberry32. `Math.random()` is banned in this directory |
| `surfaces.ts` | The three surfaces plus the clock freeze |
| `canonical.ts` | Canonical serialisation, fingerprints, deep diff |
| `manifest.ts` | Baseline file I/O and comparison |
| `coverage.ts` | Corpus coverage, measured from outputs rather than inputs |
| `versions.test.ts` | Installed-version guard |

## The three surfaces

- **`core`**: `@bazi-flex/core` `getBaziChart()`, including `sect` /
  `useTrueSolarTime` / `standardMeridian` which the MCP schema does not expose.
  This baseline was captured against the published package before vendoring, so
  an unmoved `core` aggregate is a standing proof that the in-repo calculation
  still agrees with it.
- **`toolFull`**: the full `getBaziChart` MCP payload.
- **`toolPartial`**: the `getBaziChartPartial` payload.

The latter two are expected to diverge in later stages. When they do it must be a
reviewed baseline change, not a surprise.

## What each corpus layer guards

| Layer | Cases | Guards |
| --- | --- | --- |
| `random` | 2000 | Broad regression across the full 1900-2100 span |
| `daypillar` | 60 | 60 consecutive days is one full 甲子, covering all 10 sparse 神煞 day-pillar sets and the whole 旬空 rotation |
| `midnight` | 296 | 早晚子 (`sect` 1/2), 时辰 rolling over 子时, 真太阳时 correction crossing midnight |
| `lichun` | 1407 | 立春 plus/minus 48h every year, including the plus/minus 1 minute pair, the only place a one-minute change must flip the 年柱 |
| `jieqi` | 1044 | The 月柱 boundary at each of the 12 節 |
| `city` | 152 | Every city key and alias, including the 5 standard-meridian overrides |

`daypillar` and `city` are exhaustive rather than sampled, because their spaces
are small and their triggers are sparse: some 神煞 fire on 3 of the 60 day
pillars, which random sampling over a 200-year span would almost never reach.

Measured coverage: 60/60 日柱, 60/60 年柱, 12/12 月支, 12/12 时支, 5/5 纳音五行,
both sects, 151 city strings, and all 50 神煞 names in `shensha.ts`.

## When the baseline may be rebuilt

Two cases only:

1. **The corpus changed** (`corpus.ts` or `cities.ts`). Bump `CORPUS_VERSION` too.
2. **Behaviour changed on purpose**, and that change has already been reviewed.

Rebuild and behaviour change must be separate commits. Mixed together, the few
thousand fingerprint lines in `git diff` no longer show which change caused what,
and the baseline stops being worth anything.

## Clock freeze

`buildDayun` computes `大运[].当前` from `new Date().getFullYear()` with no
injection point, so the harness freezes the system clock at
`2026-06-15T12:00:00Z`. Without it the baseline rots silently every January 1,
and a run straddling midnight gives two answers for one input.

Noon UTC keeps the local calendar date identical from UTC-11 to UTC+11, so
developers outside UTC+8 reproduce the same results.

## What the oracle cannot do

Full-corpus parity proves agreement with the conventions the calculation was
inherited with. It can never prove correctness as 命理. No test resolves that.

More to the point, the main value of this refactor (native three-pillar charts,
三合/三会/三刑, pillar-labelled relations, decision aids, the 立春 year boundary)
is exactly the new behaviour the oracle has no reference for. That needs
worked examples from the literature and equivalence tests, not this.
