#!/usr/bin/env bun
/**
 *   bun run test/oracle/cli.ts baseline              regenerate every manifest
 *   bun run test/oracle/cli.ts check                 compare against the manifests
 *   bun run test/oracle/cli.ts coverage              what the corpus reaches
 *   bun run test/oracle/cli.ts explain <caseId>      the inputs behind one case
 *   bun run test/oracle/cli.ts dump <caseId> <dir>   canonical payloads for one case
 *   bun run test/oracle/cli.ts diff <fileA> <fileB>  field-level diff of two dumps
 *
 * `check` says which cases moved; dump before, dump after and diff says what
 * moved inside them. That split is the price of storing fingerprints instead of
 * megabytes of payloads.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalize, diffValues, formatDiff } from "./canonical.js";
import { buildCorpus, CORPUS_VERSION } from "./corpus.js";
import { computeCoverage, formatCoverage } from "./coverage.js";
import {
	aggregateFingerprint,
	compareRun,
	type ManifestSummary,
	manifestPath,
	readManifest,
	SUMMARY_PATH,
	serialiseRun,
} from "./manifest.js";
import { FROZEN_INSTANT, runSurface, SURFACES, withFrozenClock } from "./surfaces.js";

function findCase(id: string) {
	const c = buildCorpus().find((x) => x.id === id);
	if (!c) throw new Error(`no corpus case with id "${id}"`);
	return c;
}

async function cmdBaseline(): Promise<number> {
	const corpus = buildCorpus();
	const summary: ManifestSummary = {
		corpusVersion: CORPUS_VERSION,
		frozenInstant: FROZEN_INSTANT,
		surfaces: {},
	};
	withFrozenClock(() => {
		for (const surface of SURFACES) {
			const run = runSurface(surface, corpus);
			summary.surfaces[surface.name] = {
				cases: run.ids.length,
				deduped: run.deduped,
				aggregate: aggregateFingerprint(run),
			};
			Bun.write(manifestPath(surface.name), serialiseRun(run, CORPUS_VERSION));
			console.log(
				`${surface.name.padEnd(12)} ${String(run.ids.length).padStart(5)} cases  ` +
					`${String(run.deduped).padStart(5)} deduped  ${summary.surfaces[surface.name]?.aggregate}`,
			);
		}
	});
	await Bun.write(SUMMARY_PATH, `${JSON.stringify(summary, null, "\t")}\n`);
	console.log(`\nbaselined corpus v${CORPUS_VERSION} over ${corpus.length} cases`);
	return 0;
}

async function cmdCheck(): Promise<number> {
	const corpus = buildCorpus();
	let failed = 0;
	const runs = withFrozenClock(() => SURFACES.map((s) => [s, runSurface(s, corpus)] as const));
	for (const [surface, run] of runs) {
		const stored = await readManifest(surface.name);
		if (!stored) {
			console.error(`${surface.name}: no manifest. Run \`baseline\` first.`);
			failed++;
			continue;
		}
		const mismatches = compareRun(run, stored);
		if (mismatches.length === 0) {
			console.log(`${surface.name.padEnd(12)} OK    ${run.ids.length} cases`);
			continue;
		}
		failed++;
		console.error(
			`${surface.name.padEnd(12)} FAIL  ${mismatches.length} of ${run.ids.length} cases differ`,
		);
		for (const m of mismatches.slice(0, 25)) {
			const what =
				m.actual === undefined
					? "dropped from corpus"
					: m.expected === undefined
						? "new case"
						: `${m.expected} -> ${m.actual}`;
			console.error(`  ${m.id}  ${what}`);
		}
		if (mismatches.length > 25) console.error(`  ... and ${mismatches.length - 25} more`);
		const firstChanged = mismatches.find((m) => m.expected && m.actual);
		if (firstChanged) {
			console.error(
				`\n  Investigate with:\n    bun run test/oracle/cli.ts explain ${firstChanged.id}\n` +
					`    bun run test/oracle/cli.ts dump ${firstChanged.id} /tmp/after`,
			);
		}
	}
	return failed === 0 ? 0 : 1;
}

function cmdCoverage(): number {
	console.log(formatCoverage(withFrozenClock(() => computeCoverage())));
	return 0;
}

function cmdExplain(id: string): number {
	const c = findCase(id);
	console.log(JSON.stringify(c, null, 2));
	return 0;
}

async function cmdDump(id: string, dir: string): Promise<number> {
	const c = findCase(id);
	await mkdir(dir, { recursive: true });
	await withFrozenClock(async () => {
		for (const surface of SURFACES) {
			let payload: unknown;
			try {
				payload = surface.run(c);
			} catch (err) {
				payload = { __throw: err instanceof Error ? err.message : String(err) };
			}
			const path = join(dir, `${id.replace(/[/\\]/g, "_")}.${surface.name}.json`);
			// Pretty-printed from the canonical form, so key order is stable across dumps.
			await Bun.write(path, `${JSON.stringify(JSON.parse(canonicalize(payload)), null, "\t")}\n`);
			console.log(path);
		}
	});
	return 0;
}

async function cmdDiff(a: string, b: string): Promise<number> {
	const [ja, jb] = await Promise.all([Bun.file(a).json(), Bun.file(b).json()]);
	const diffs = diffValues(ja, jb);
	if (diffs.length === 0) {
		console.log("identical");
		return 0;
	}
	console.log(`${diffs.length} difference(s):\n${formatDiff(diffs)}`);
	return 1;
}

async function main(): Promise<number> {
	const [cmd, ...rest] = Bun.argv.slice(2);
	switch (cmd) {
		case "baseline":
			return cmdBaseline();
		case "check":
			return cmdCheck();
		case "coverage":
			return cmdCoverage();
		case "explain":
			if (!rest[0]) throw new Error("explain needs a case id");
			return cmdExplain(rest[0]);
		case "dump":
			if (!rest[0] || !rest[1]) throw new Error("dump needs a case id and an output directory");
			return cmdDump(rest[0], rest[1]);
		case "diff":
			if (!rest[0] || !rest[1]) throw new Error("diff needs two file paths");
			return cmdDiff(rest[0], rest[1]);
		default:
			console.error(
				"usage: bun run test/oracle/cli.ts <baseline|check|coverage|explain|dump|diff> [args]",
			);
			return 2;
	}
}

process.exit(await main());
