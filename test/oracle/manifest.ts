/**
 * One plain-text file per surface, `<id>\t<fingerprint>` per line. Text rather
 * than JSON so a re-baseline reads in `git diff` as "these cases moved" instead
 * of one reflowed blob, and so a single case can be found with grep.
 */

import { join } from "node:path";
import type { SurfaceName, SurfaceRun } from "./surfaces.js";

export const MANIFEST_DIR = join(import.meta.dir, "manifest");

export interface ManifestSummary {
	corpusVersion: number;
	frozenInstant: string;
	surfaces: Record<string, { cases: number; deduped: number; aggregate: string }>;
}

export function manifestPath(surface: SurfaceName): string {
	return join(MANIFEST_DIR, `${surface}.fp.txt`);
}

export const SUMMARY_PATH = join(MANIFEST_DIR, "summary.json");

/** One fingerprint over the whole surface, so a mismatch is detectable in a single comparison. */
export function aggregateFingerprint(run: SurfaceRun): string {
	const hasher = new Bun.CryptoHasher("sha256");
	for (let i = 0; i < run.ids.length; i++) {
		hasher.update(`${run.ids[i]}\t${run.fingerprints[i]}\n`);
	}
	return hasher.digest("hex").slice(0, 16);
}

export function serialiseRun(run: SurfaceRun, corpusVersion: number): string {
	const lines = [
		`# surface: ${run.surface}`,
		`# corpusVersion: ${corpusVersion}`,
		`# cases: ${run.ids.length} (${run.deduped} corpus cases deduped by input projection)`,
		"#",
		"# Regenerate with: bun run test/oracle/cli.ts baseline",
		"# A line moving here means observable behaviour changed for that input.",
	];
	for (let i = 0; i < run.ids.length; i++) {
		lines.push(`${run.ids[i]}\t${run.fingerprints[i]}`);
	}
	return `${lines.join("\n")}\n`;
}

export function parseManifest(text: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const tab = line.indexOf("\t");
		if (tab < 0) throw new Error(`malformed manifest line: ${line}`);
		map.set(line.slice(0, tab), line.slice(tab + 1));
	}
	return map;
}

export async function readManifest(surface: SurfaceName): Promise<Map<string, string> | null> {
	const file = Bun.file(manifestPath(surface));
	if (!(await file.exists())) return null;
	return parseManifest(await file.text());
}

export async function readSummary(): Promise<ManifestSummary | null> {
	const file = Bun.file(SUMMARY_PATH);
	if (!(await file.exists())) return null;
	return (await file.json()) as ManifestSummary;
}

export interface Mismatch {
	id: string;
	expected: string | undefined;
	actual: string | undefined;
}

/** Order-insensitive, so adds, drops and changes are all reported. */
export function compareRun(run: SurfaceRun, stored: Map<string, string>): Mismatch[] {
	const out: Mismatch[] = [];
	const fresh = new Map<string, string>();
	for (let i = 0; i < run.ids.length; i++) {
		fresh.set(run.ids[i] as string, run.fingerprints[i] as string);
	}
	for (const [id, fp] of fresh) {
		const expected = stored.get(id);
		if (expected !== fp) out.push({ id, expected, actual: fp });
	}
	for (const [id, fp] of stored) {
		if (!fresh.has(id)) out.push({ id, expected: fp, actual: undefined });
	}
	return out;
}
