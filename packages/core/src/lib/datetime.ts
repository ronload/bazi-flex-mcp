import type { ClockDateTime } from "./solarTime.js";

export function pad2(value: number): string {
	return value.toString().padStart(2, "0");
}

export function formatDate(year: number, month: number, day: number): string {
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatMinutePrecision(dt: ClockDateTime): string {
	return `${formatDate(dt.year, dt.month, dt.day)} ${pad2(dt.hour)}:${pad2(dt.minute)}`;
}
