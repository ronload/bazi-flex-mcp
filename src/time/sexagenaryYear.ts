import { SolarTerm } from "tyme4ts";

/**
 * 立春界的干支年。
 *
 * 子平八字以立春為年界,不是元旦,也不是正月初一。所以 2026-01-15 這天雖然
 * 公曆已是 2026,干支年仍屬 2025 (乙巳),要到 2026-02-04 立春才換丙午。
 *
 * ── 粒度 ──────────────────────────────────────────────────────────────
 * 這裡採**日粒度**:立春當日整日算新干支年。
 *
 * 這是刻意的簡化,不是疏漏。`referenceDate` 的 schema 是純日期
 * (`YYYY-M-D`,見 tools/*\/schema.ts),`todayIsoDate()` 也只產日期,
 * 所以根本沒有可比對的時刻。立春的精確時刻在各年可以落在 00:09 到 16:42
 * 之間的任何位置,因此立春當日最多有 24 小時 (平均約 12 小時) 的歸屬誤差。
 *
 * 也不要試圖用固定的佔位小時 (例如 12:00) 來假裝有時刻精度:實測過,
 * 沒有任何固定小時能在所有年份給出正確答案,12:00 在 2021-02-03 與
 * 2025-02-03 就會算錯年。
 *
 * 這個殘留只能靠 referenceDate 升級為帶時區語義的完整 datetime 才能消除。
 *
 * ── 為什麼不用 tyme4ts 的導覽鏈 ────────────────────────────────────────
 * `SolarDay.fromYmd(y,m,d).getSixtyCycleDay().getSixtyCycleMonth()
 *  .getSixtyCycleYear().getYear()` 看似更直接,但它對 schema 合法的日期會拋例外:
 * 9999-12-16 到 9999-12-31 全部拋 `illegal sixty cycle year: 10000`,
 * 0001-01-01 拋 `illegal solar year: 0`。這些日期目前都能正常回應,
 * 改用導覽鏈會把它們變成未處理的 500。
 *
 * 同理不要用 `SixtyCycleYear.fromYear`:它對 y <= -2 拋例外,
 * 而且對非整數會靜默回傳 "undefined年" 而不報錯。
 *
 * 純數值日期比較則是全域的,且對通過 regex 但語意荒謬的月日輸入也不會爆炸。
 */
export function sexagenaryYearOfYmd(year: number, month: number, day: number): number {
	// tyme4ts 的 SolarTerm 定義域是 1..9999。域外原樣返回,維持既有行為而非拋例外。
	if (!Number.isInteger(year) || year < 1 || year > 9999) return year;
	const lichun = SolarTerm.fromName(year, "立春").getSolarDay();
	const probe = year * 10000 + month * 100 + day;
	const boundary = lichun.getYear() * 10000 + lichun.getMonth() * 100 + lichun.getDay();
	return probe >= boundary ? year : year - 1;
}

/** 由 ISO-like 日期字串 (`YYYY-M-D`) 取立春界的干支年。 */
export function sexagenaryYearOfDate(iso: string): number {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso.trim());
	if (!m) return Number(iso.slice(0, 4));
	return sexagenaryYearOfYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}
