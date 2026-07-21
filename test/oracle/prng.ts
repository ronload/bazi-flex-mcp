/**
 * Deterministic PRNG for corpus generation.
 *
 * The corpus MUST be reproducible byte-for-byte on every machine and every run,
 * otherwise a fingerprint baseline is meaningless. `Math.random()` is therefore
 * banned everywhere under test/oracle/.
 *
 * mulberry32: 32-bit state, no dependencies, uniform enough for sampling a
 * parameter space. It is not cryptographic and does not need to be.
 */

export interface Rng {
	/** Uniform in [0, 1). */
	next(): number;
	/** Uniform integer in [min, max] inclusive. */
	int(min: number, max: number): number;
	/** Uniform element of a non-empty array. */
	pick<T>(items: readonly T[]): T;
	/** True with the given probability. */
	chance(p: number): boolean;
}

export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const rng: Rng = {
		next,
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		pick: (items) => {
			const v = items[Math.floor(next() * items.length)];
			if (v === undefined) throw new Error("pick() from an empty array");
			return v;
		},
		chance: (p) => next() < p,
	};
	return rng;
}
