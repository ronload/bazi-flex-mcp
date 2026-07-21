import { SolarTerm } from "tyme4ts";

const TYME_MIN_YEAR = 1;
const TYME_MAX_YEAR = 9999;

/**
 * The 干支年 containing a date, bounded by 立春 rather than by Jan 1.
 *
 * Resolved at day granularity because `referenceDate` carries no time of day.
 * No fixed placeholder hour would work either: 立春 falls anywhere between
 * 00:09 and 16:42 depending on the year.
 */
export function sexagenaryYearOfYmd(year: number, month: number, day: number): number {
	// Outside tyme4ts's domain. Echo the year back rather than throw, because the
	// chart tools still answer for years this far out.
	if (!Number.isInteger(year) || year < TYME_MIN_YEAR || year > TYME_MAX_YEAR) return year;
	const lichun = SolarTerm.fromName(year, "立春").getSolarDay();
	const probe = year * 10000 + month * 100 + day;
	const boundary = lichun.getYear() * 10000 + lichun.getMonth() * 100 + lichun.getDay();
	return probe >= boundary ? year : year - 1;
}

export function sexagenaryYearOfDate(iso: string): number {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso.trim());
	if (!m) return Number(iso.slice(0, 4));
	return sexagenaryYearOfYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}
