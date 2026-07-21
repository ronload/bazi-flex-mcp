import { setSystemTime } from "bun:test";
import { getBaziChart } from "shunshi-bazi-core";
import { enrichResult } from "../../src/tools/getBaziChart/enrich.js";
import { enrichPartialResult } from "../../src/tools/getBaziChartPartial/enrich.js";
import { resolveChartRequest } from "../../src/tools/shared/request.js";
import { canonicalize } from "./canonical.js";
import type { CoreInput, OracleCase } from "./corpus.js";

/**
 * Upstream `buildDayun` reads `new Date().getFullYear()` for `大运[].当前` with no
 * injection point, so every surface is clock-dependent. Without a freeze the
 * baseline rots at every new year, and a run straddling Dec 31 midnight gives two
 * answers for one input.
 *
 * Noon UTC keeps the local calendar date identical from UTC-11 to UTC+11, so
 * `todayIsoDate()` is stable for developers outside UTC+8 too.
 */
export const FROZEN_INSTANT = "2026-06-15T12:00:00.000Z";

/** Nesting is safe: the inner call restores to real time. */
export function withFrozenClock<T>(fn: () => T): T {
	setSystemTime(new Date(FROZEN_INSTANT));
	try {
		return fn();
	} finally {
		setSystemTime();
	}
}

/** The subset of `CoreInput` the MCP schema exposes. zod strips the rest. */
function toolVisibleInput(core: CoreInput) {
	return {
		year: core.year,
		month: core.month,
		day: core.day,
		hour: core.hour,
		minute: core.minute,
		gender: core.gender,
		...(core.city !== undefined ? { city: core.city } : {}),
		...(core.longitude !== undefined ? { longitude: core.longitude } : {}),
		...(core.latitude !== undefined ? { latitude: core.latitude } : {}),
	};
}

function requestOf(c: OracleCase) {
	return resolveChartRequest({
		referenceDate: c.referenceDate,
		liunianStart: c.liunianStart,
		liunianEnd: c.liunianEnd,
	});
}

export interface Surface {
	name: SurfaceName;
	description: string;
	/**
	 * The inputs this surface consumes. Cases with an identical projection produce
	 * an identical payload by construction, so only the first is fingerprinted.
	 */
	project(c: OracleCase): unknown;
	run(c: OracleCase): unknown;
}

export type SurfaceName = "core" | "toolFull" | "toolPartial";

export const SURFACES: readonly Surface[] = [
	{
		name: "core",
		description:
			"shunshi-bazi-core getBaziChart(), full input space including sect / standardMeridian",
		project: (c) => c.core,
		run: (c) => getBaziChart(c.core),
	},
	{
		name: "toolFull",
		description: "getBaziChart MCP tool payload (schema-visible input + enrichResult)",
		project: (c) => ({
			input: toolVisibleInput(c.core),
			referenceDate: c.referenceDate,
			liunianStart: c.liunianStart,
			liunianEnd: c.liunianEnd,
		}),
		run: (c) => {
			const input = toolVisibleInput(c.core);
			return enrichResult(
				getBaziChart(input),
				{ year: c.core.year, month: c.core.month, day: c.core.day },
				requestOf(c),
			);
		},
	},
	{
		name: "toolPartial",
		description: "getBaziChartPartial MCP tool payload (hour/minute ignored, 12:00 placeholder)",
		project: (c) => ({
			year: c.core.year,
			month: c.core.month,
			day: c.core.day,
			gender: c.core.gender,
			referenceDate: c.referenceDate,
			liunianStart: c.liunianStart,
			liunianEnd: c.liunianEnd,
		}),
		run: (c) => {
			const raw = getBaziChart({
				year: c.core.year,
				month: c.core.month,
				day: c.core.day,
				hour: 12,
				minute: 0,
				gender: c.core.gender,
			});
			return enrichPartialResult(
				raw,
				{ year: c.core.year, month: c.core.month, day: c.core.day },
				requestOf(c),
			);
		},
	},
];

export function surfaceByName(name: string): Surface {
	const s = SURFACES.find((x) => x.name === name);
	if (!s)
		throw new Error(`unknown surface "${name}". Known: ${SURFACES.map((x) => x.name).join(", ")}`);
	return s;
}

export interface SurfaceRun {
	surface: SurfaceName;
	/** Case ids in corpus order, after projection dedupe. */
	ids: string[];
	/** Fingerprint per id, same order. */
	fingerprints: string[];
	/** How many corpus cases collapsed onto an already-seen projection. */
	deduped: number;
}

/** The caller is responsible for freezing the clock. */
export function runSurface(surface: Surface, corpus: readonly OracleCase[]): SurfaceRun {
	const seen = new Set<string>();
	const ids: string[] = [];
	const fingerprints: string[] = [];
	let deduped = 0;
	for (const c of corpus) {
		const key = canonicalize(surface.project(c));
		if (seen.has(key)) {
			deduped++;
			continue;
		}
		seen.add(key);
		ids.push(c.id);
		fingerprints.push(fingerprintCase(surface, c));
	}
	return { surface: surface.name, ids, fingerprints, deduped };
}

function fingerprintCase(surface: Surface, c: OracleCase): string {
	try {
		return new Bun.CryptoHasher("sha256")
			.update(canonicalize(surface.run(c)))
			.digest("hex")
			.slice(0, 16);
	} catch (err) {
		// A throw is stable observable behaviour and part of the contract: upstream
		// throws on some out-of-domain calendar inputs, and a rewrite that stops
		// throwing, or starts throwing elsewhere, is a change.
		const message = err instanceof Error ? err.message : String(err);
		return new Bun.CryptoHasher("sha256").update(`THROW:${message}`).digest("hex").slice(0, 16);
	}
}
