/**
 * Fingerprints rather than stored payloads: one chart is ~8KB of JSON and the
 * corpus is thousands of cases across three surfaces, which would put tens of
 * megabytes of generated JSON under version control and make every re-baseline
 * unreviewable. `diffValues` covers what a fingerprint cannot say, which is what
 * actually changed inside a case the manifest has already named.
 */

/**
 * Object keys are sorted because key order is an artefact of construction order,
 * not of meaning. Array order is preserved and load-bearing: 神煞 arrays are
 * order-sensitive by the parity contract, so a reordering there is a real diff.
 *
 * `undefined` values are dropped to match `JSON.stringify`, so an explicitly
 * undefined key and an absent key fingerprint alike. `null` is distinct from both.
 */
export function canonicalize(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "number") {
		// JSON.stringify would turn these into null, making a genuine arithmetic
		// bug indistinguishable from a legitimate null.
		if (!Number.isFinite(value)) throw new Error(`non-finite number in payload: ${value}`);
		return JSON.stringify(value === 0 ? 0 : value);
	}
	if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
	}
	throw new Error(`unserialisable value of type ${typeof value} in payload`);
}

/** Truncated to 16 hex chars purely to keep the manifest readable; 64 bits is ample for 10^4 cases. */
export function fingerprint(value: unknown): string {
	return new Bun.CryptoHasher("sha256").update(canonicalize(value)).digest("hex").slice(0, 16);
}

export interface Difference {
	/** For example `八字.柱位详细.年柱.神煞[2]`. */
	path: string;
	expected: unknown;
	actual: unknown;
	kind: "value" | "missing" | "extra" | "type" | "length";
}

const ABSENT = Symbol("absent");

function typeOf(v: unknown): string {
	if (v === null) return "null";
	if (Array.isArray(v)) return "array";
	return typeof v;
}

function walk(path: string, expected: unknown, actual: unknown, out: Difference[]): void {
	if (expected === ABSENT) {
		out.push({ path, expected: undefined, actual, kind: "extra" });
		return;
	}
	if (actual === ABSENT) {
		out.push({ path, expected, actual: undefined, kind: "missing" });
		return;
	}
	const te = typeOf(expected);
	const ta = typeOf(actual);
	if (te !== ta) {
		out.push({ path, expected, actual, kind: "type" });
		return;
	}
	if (Array.isArray(expected) && Array.isArray(actual)) {
		if (expected.length !== actual.length) {
			out.push({ path, expected: expected.length, actual: actual.length, kind: "length" });
		}
		const n = Math.max(expected.length, actual.length);
		for (let i = 0; i < n; i++) {
			walk(
				`${path}[${i}]`,
				i < expected.length ? expected[i] : ABSENT,
				i < actual.length ? actual[i] : ABSENT,
				out,
			);
		}
		return;
	}
	if (te === "object") {
		const eo = expected as Record<string, unknown>;
		const ao = actual as Record<string, unknown>;
		const keys = [...new Set([...Object.keys(eo), ...Object.keys(ao)])].sort();
		for (const k of keys) {
			const child = path ? `${path}.${k}` : k;
			walk(child, k in eo ? eo[k] : ABSENT, k in ao ? ao[k] : ABSENT, out);
		}
		return;
	}
	if (expected !== actual) {
		out.push({ path, expected, actual, kind: "value" });
	}
}

export function diffValues(expected: unknown, actual: unknown): Difference[] {
	const out: Difference[] = [];
	walk("", expected, actual, out);
	return out;
}

export function formatDiff(diffs: readonly Difference[], limit = 40): string {
	const shown = diffs.slice(0, limit);
	const lines = shown.map((d) => {
		const e = d.expected === undefined ? "<absent>" : JSON.stringify(d.expected);
		const a = d.actual === undefined ? "<absent>" : JSON.stringify(d.actual);
		return `  ${d.path || "<root>"}  [${d.kind}]\n    expected: ${e}\n    actual:   ${a}`;
	});
	if (diffs.length > shown.length) {
		lines.push(`  ... and ${diffs.length - shown.length} more`);
	}
	return lines.join("\n");
}
