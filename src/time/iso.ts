function pad2(n: number | string | undefined): string {
	return String(n ?? 0).padStart(2, "0");
}

export function parseIsoLikeDate(s: string): { year: number; month: number; day: number } | null {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
	return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

/** Upstream `fmtDt` output ("YYYY-MM-DD HH:MM", always :00 seconds) → ISO 8601 */
export function fmtDtToIso(s: string): string {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s.trim());
	if (!m) return s;
	return `${m[1] ?? ""}-${pad2(m[2])}-${pad2(m[3])}T${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6])}`;
}

/** Upstream `八字.公历` ("YYYY年M月D日 HH:MM:SS" from tyme4ts) → ISO 8601 */
export function chineseDateTimeToIso(s: string): string {
	const m = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(s.trim());
	if (!m) return s;
	return `${m[1] ?? ""}-${pad2(m[2])}-${pad2(m[3])}T${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6])}`;
}

export function todayIsoDate(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
