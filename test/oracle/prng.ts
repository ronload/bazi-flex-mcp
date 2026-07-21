/**
 * The corpus must be reproducible byte for byte on every machine, otherwise a
 * fingerprint baseline means nothing. `Math.random()` is banned under test/oracle/.
 */

export interface Rng {
	next(): number;
	/** Inclusive at both ends. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
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
