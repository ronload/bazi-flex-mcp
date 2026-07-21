import { DefaultEightCharProvider, LunarHour, LunarSect2EightCharProvider } from "tyme4ts";

/** 子时分日法: 1 = 23:00 belongs to the next day, 2 = it stays on the current day. */
export type Sect = 1 | 2;

export const DEFAULT_SECT: Sect = 1;

const NEXT_DAY_PROVIDER = new DefaultEightCharProvider();
const SAME_DAY_PROVIDER = new LunarSect2EightCharProvider();

/**
 * tyme4ts resolves the eight char through a static field rather than a
 * parameter, and `ChildLimit` re-derives its own eight char internally, so a
 * per-call provider argument cannot reach 起运. Assigning unconditionally is
 * what keeps one call from inheriting the previous call's sect.
 */
export function applySect(sect: Sect): void {
	LunarHour.provider = sect === 2 ? SAME_DAY_PROVIDER : NEXT_DAY_PROVIDER;
}
