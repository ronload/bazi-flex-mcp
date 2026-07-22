import { type SolarDay, SolarTime } from "tyme4ts";
import { formatDate, pad2 } from "../lib/datetime.js";

export interface TermSplitPillars {
	年柱: string;
	月柱: string;
}

/**
 * A 節 splits its own day: births before the exact moment carry the previous
 * month's pillars. With no birth hour the answer is genuinely undetermined, so
 * both sides are reported rather than one being guessed.
 */
export interface TermAmbiguity {
	节气: string;
	时刻: string;
	影响: string[];
	此刻之前: TermSplitPillars;
	此刻之后: TermSplitPillars;
}

const SECONDS_PER_HOUR = 3600;

const SECONDS_PER_DAY = 86400;

function toIso(time: SolarTime): string {
	const day = time.getSolarDay();
	const date = formatDate(day.getYear(), day.getMonth(), day.getDay());
	return `${date}T${pad2(time.getHour())}:${pad2(time.getMinute())}:${pad2(time.getSecond())}`;
}

function pillarsAt(time: SolarTime): TermSplitPillars {
	const eightChar = time.getLunarHour().getEightChar();
	return { 年柱: eightChar.getYear().toString(), 月柱: eightChar.getMonth().toString() };
}

function jieStartingOn(day: SolarDay): SolarTime | undefined {
	const term = day.getTerm();
	if (!term.isJie()) return undefined;
	const at = term.getJulianDay().getSolarTime();
	const on = at.getSolarDay();
	const sameDay =
		on.getYear() === day.getYear() &&
		on.getMonth() === day.getMonth() &&
		on.getDay() === day.getDay();
	return sameDay ? at : undefined;
}

function affectedPillars(before: TermSplitPillars, after: TermSplitPillars): string[] {
	const affected: string[] = [];
	if (before.年柱 !== after.年柱) affected.push("年柱");
	if (before.月柱 !== after.月柱) affected.push("月柱");
	return affected;
}

export function termAmbiguityOf(day: SolarDay): TermAmbiguity | null {
	const at = jieStartingOn(day);
	if (at === undefined) return null;
	const before = pillarsAt(at.next(-1));
	const after = pillarsAt(at);
	return {
		节气: day.getTerm().getName(),
		时刻: toIso(at),
		影响: affectedPillars(before, after),
		此刻之前: before,
		此刻之后: after,
	};
}

/**
 * The window the day-granular pillars actually describe: after a 節, only the
 * part of the day that follows it. Its midpoint is the reference moment for
 * anything that needs one, which keeps 大运 direction agreeing with 年柱 on the
 * days where the 節 lands after noon.
 */
export function midpointOfPillarWindow(day: SolarDay): SolarTime {
	const from =
		jieStartingOn(day) ??
		SolarTime.fromYmdHms(day.getYear(), day.getMonth(), day.getDay(), 0, 0, 0);
	const secondsIntoDay =
		from.getHour() * SECONDS_PER_HOUR + from.getMinute() * 60 + from.getSecond();
	return from.next(Math.floor((SECONDS_PER_DAY - secondsIntoDay) / 2));
}
