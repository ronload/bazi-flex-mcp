/**
 * A failure here is never a wrong test. It is a behaviour change, to be reverted
 * or re-baselined deliberately with the reason recorded in the commit.
 *
 * Re-baseline with: bun run test/oracle/cli.ts baseline
 */

import { describe, expect, test } from "bun:test";
import { buildCorpus, CORPUS_VERSION } from "./corpus.js";
import { aggregateFingerprint, compareRun, readManifest, readSummary } from "./manifest.js";
import { FROZEN_INSTANT, runSurface, SURFACES, withFrozenClock } from "./surfaces.js";

const corpus = buildCorpus();
const runs = withFrozenClock(() => SURFACES.map((s) => [s, runSurface(s, corpus)] as const));

describe("manifest metadata", () => {
	test("summary matches the current corpus version and frozen clock", async () => {
		const summary = await readSummary();
		expect(summary).not.toBeNull();
		expect(summary?.corpusVersion).toBe(CORPUS_VERSION);
		// A moved freeze instant silently changes 大运[].当前 for every case.
		expect(summary?.frozenInstant).toBe(FROZEN_INSTANT);
	});

	test("every surface has an aggregate recorded", async () => {
		const summary = await readSummary();
		for (const [surface] of runs) {
			expect(summary?.surfaces[surface.name]).toBeDefined();
		}
	});
});

for (const [surface, run] of runs) {
	describe(`parity: ${surface.name}`, () => {
		test("every case matches the baselined fingerprint", async () => {
			const stored = await readManifest(surface.name);
			expect(
				stored,
				`no manifest for ${surface.name}. Run \`bun run test/oracle/cli.ts baseline\`.`,
			).not.toBeNull();

			const mismatches = compareRun(run, stored as Map<string, string>);
			const report = mismatches
				.slice(0, 15)
				.map(
					(m) =>
						`  ${m.id}: ${m.expected ?? "<new case>"} -> ${m.actual ?? "<dropped from corpus>"}`,
				)
				.join("\n");
			expect(
				mismatches.length,
				mismatches.length === 0
					? ""
					: `${mismatches.length} of ${run.ids.length} cases differ on the ${surface.name} surface:\n${report}\n` +
							"\nIf this change is intended, re-baseline with `bun run test/oracle/cli.ts baseline` " +
							"and say why in the commit message. Otherwise it is a regression.",
			).toBe(0);
		});

		test("aggregate fingerprint matches the summary", async () => {
			const summary = await readSummary();
			expect(summary?.surfaces[surface.name]?.aggregate).toBe(aggregateFingerprint(run));
			expect(summary?.surfaces[surface.name]?.cases).toBe(run.ids.length);
		});
	});
}
