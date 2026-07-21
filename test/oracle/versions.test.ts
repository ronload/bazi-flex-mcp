/**
 * Guards a real failure: a lockfile once recorded a version the installed
 * node_modules did not hold, so local and CI ran different calendar tables for
 * months. `--frozen-lockfile` cannot catch that, since it only asserts the
 * lockfile is unmodified by the install. These assertions read the installed
 * artefact.
 *
 * Exact string equality rather than semver satisfaction, because drift that
 * satisfies a range is exactly what this is defending against.
 */

import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import manifest from "./manifest/versions.json" with { type: "json" };

const REPO_ROOT = resolve(import.meta.dir, "../..");
const REPO_NODE_MODULES = join(REPO_ROOT, "node_modules");

async function installedVersion(pkg: string): Promise<string> {
	const pkgJson = join(REPO_NODE_MODULES, pkg, "package.json");
	const file = Bun.file(pkgJson);
	if (!(await file.exists())) {
		throw new Error(`${pkg} is not installed at ${pkgJson}. Run \`bun install\`.`);
	}
	const { version } = (await file.json()) as { version: string };
	return version;
}

describe("installed dependency versions", () => {
	for (const [pkg, expected] of Object.entries(manifest.dependencies)) {
		test(`${pkg} is exactly ${expected}`, async () => {
			const actual = await installedVersion(pkg);
			expect(
				actual,
				`node_modules/${pkg} is ${actual} but manifest/versions.json pins ${expected}. ` +
					"If this is an intentional upgrade, re-baseline the oracle and bump corpusVersion; " +
					"otherwise run `bun install --force` to repair node_modules.",
			).toBe(expected);
		});

		test(`${pkg} resolves inside this repo's node_modules`, () => {
			// Catches a hoisted or duplicated copy, which a version check alone misses.
			const resolved = Bun.resolveSync(pkg, import.meta.dir);
			expect(
				resolved.startsWith(`${REPO_NODE_MODULES}/`),
				`${pkg} resolved to ${resolved}, which is outside ${REPO_NODE_MODULES}.`,
			).toBe(true);
		});
	}

	test("tyme4ts is pinned without a range operator", async () => {
		// This is now the only declaration of tyme4ts in the tree, so a caret here
		// would let 1.5.x arrive silently and move every 節氣 boundary under src/.
		const root = (await Bun.file(join(REPO_ROOT, "package.json")).json()) as {
			dependencies: Record<string, string>;
		};
		expect(root.dependencies.tyme4ts).toBe(manifest.dependencies.tyme4ts);
	});

	test("tyme4ts is a direct runtime dependency, not only transitive", async () => {
		const root = (await Bun.file(join(REPO_ROOT, "package.json")).json()) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		expect(Object.keys(root.dependencies ?? {})).toContain("tyme4ts");
		expect(Object.keys(root.devDependencies ?? {})).not.toContain("tyme4ts");
	});
});
