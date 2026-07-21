/**
 * Installed-dependency version guard.
 *
 * 這個測試存在的理由是一次真實故障：`bun.lock` 記 shunshi-bazi-core@0.2.0，
 * 但 node_modules 實際躺著 0.1.0，而 CI 用 `bun install --frozen-lockfile`
 * 裝的是 0.2.0 — 本機與 production 跑在不同版本上好幾個月沒被發現。
 *
 * `--frozen-lockfile` 抓不到這種故障：它只保證 install 過程不修改 lockfile，
 * 對磁碟上已存在的殘骸沒有任何斷言。所以這裡讀的是**實裝的 package.json**。
 *
 * 版本比對用精確字串相等而非 semver 範圍滿足 — 會滿足範圍的漂移正是要防的東西。
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
			// Catches a hoisted-elsewhere or duplicated copy, which a version check alone misses.
			const resolved = Bun.resolveSync(pkg, import.meta.dir);
			expect(
				resolved.startsWith(`${REPO_NODE_MODULES}/`),
				`${pkg} resolved to ${resolved}, which is outside ${REPO_NODE_MODULES}.`,
			).toBe(true);
		});
	}

	test("tyme4ts is pinned without a range operator", async () => {
		// tyme4ts is the calendar engine. shunshi-bazi-core declares ^1.3.4, so a caret
		// here would let 1.5.x arrive silently and move every 節氣 boundary under src/.
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
