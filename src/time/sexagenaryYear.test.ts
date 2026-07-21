import { describe, expect, test } from "bun:test";
import { SolarTerm } from "tyme4ts";
import { sexagenaryYearOfDate, sexagenaryYearOfYmd } from "./sexagenaryYear.js";

describe("sexagenaryYearOfYmd", () => {
	test("元旦至立春之間屬前一干支年", () => {
		// 立春 2026 落在 02-04
		expect(sexagenaryYearOfYmd(2026, 1, 1)).toBe(2025);
		expect(sexagenaryYearOfYmd(2026, 1, 15)).toBe(2025);
		expect(sexagenaryYearOfYmd(2026, 2, 3)).toBe(2025);
	});

	test("立春當日起算新干支年", () => {
		expect(sexagenaryYearOfYmd(2026, 2, 4)).toBe(2026);
		expect(sexagenaryYearOfYmd(2026, 2, 5)).toBe(2026);
		expect(sexagenaryYearOfYmd(2026, 12, 31)).toBe(2026);
	});

	test("立春落在 2/3 的年份", () => {
		// 立春 2025 落在 02-03,所以 02-02 仍屬 2024
		expect(sexagenaryYearOfYmd(2025, 2, 2)).toBe(2024);
		expect(sexagenaryYearOfYmd(2025, 2, 3)).toBe(2025);
	});

	test("日粒度:立春當日不論時刻一律算新干支年", () => {
		// 立春 2021 在 2/3 深夜 (約 22:59),但整個 2/3 都算 2021。
		// 這是刻意的日粒度簡化,因為 referenceDate 沒有時刻可比。
		expect(sexagenaryYearOfYmd(2021, 2, 3)).toBe(2021);
		expect(sexagenaryYearOfYmd(2021, 2, 2)).toBe(2020);
		// 立春 2050 與 2083 都落在 2/3 接近午夜處,同樣處理
		expect(sexagenaryYearOfYmd(2050, 2, 3)).toBe(2050);
		expect(sexagenaryYearOfYmd(2083, 2, 3)).toBe(2083);
	});

	test("涵蓋 tyme4ts 定義域兩端而不拋例外", () => {
		expect(sexagenaryYearOfYmd(9999, 12, 31)).toBe(9999);
		expect(sexagenaryYearOfYmd(1, 1, 1)).toBe(0);
		expect(sexagenaryYearOfYmd(1900, 2, 4)).toBe(1900);
		expect(sexagenaryYearOfYmd(2100, 2, 4)).toBe(2100);
	});

	test("定義域外原樣返回,不拋例外", () => {
		// getBaziChart.test.ts 有 computeLiunian 負數年份的案例,這條路徑必須是全域的
		expect(sexagenaryYearOfYmd(0, 1, 1)).toBe(0);
		expect(sexagenaryYearOfYmd(-4, 1, 1)).toBe(-4);
		expect(sexagenaryYearOfYmd(10000, 1, 1)).toBe(10000);
		expect(sexagenaryYearOfYmd(2026.7, 1, 1)).toBe(2026.7);
	});

	test("每一年的界點都自洽:立春前一日屬前年、立春日屬當年", () => {
		// 立春在 1900-2100 之間會落在 2/3、2/4 或 2/5 三種日期,不要寫死其中一個。
		for (let y = 1900; y <= 2100; y++) {
			const lichun = SolarTerm.fromName(y, "立春").getSolarDay();
			const m = lichun.getMonth();
			const d = lichun.getDay();
			expect(m).toBe(2);
			expect(d).toBeGreaterThanOrEqual(3);
			expect(d).toBeLessThanOrEqual(5);

			expect(sexagenaryYearOfYmd(y, m, d), `${y} 立春當日`).toBe(y);
			expect(sexagenaryYearOfYmd(y, m, d - 1), `${y} 立春前一日`).toBe(y - 1);
			// 1/1 恆在立春之前,12/31 恆在立春之後
			expect(sexagenaryYearOfYmd(y, 1, 1), `${y}-01-01`).toBe(y - 1);
			expect(sexagenaryYearOfYmd(y, 12, 31), `${y}-12-31`).toBe(y);
		}
	});

	test("立春日期分佈符合預期 (界定受影響視窗的寬度)", () => {
		const dist: Record<number, number> = {};
		for (let y = 1900; y <= 2100; y++) {
			const d = SolarTerm.fromName(y, "立春").getSolarDay().getDay();
			dist[d] = (dist[d] ?? 0) + 1;
		}
		// 立春最早 2/3、最晚 2/5,故每年被誤判的視窗是 33 至 35 天。
		expect(Object.keys(dist).map(Number).sort()).toEqual([3, 4, 5]);
	});
});

describe("sexagenaryYearOfDate", () => {
	test("解析 ISO-like 日期字串", () => {
		expect(sexagenaryYearOfDate("2026-01-15")).toBe(2025);
		expect(sexagenaryYearOfDate("2026-02-04")).toBe(2026);
		// schema 允許不補零的月日
		expect(sexagenaryYearOfDate("2026-2-4")).toBe(2026);
		expect(sexagenaryYearOfDate("2026-1-15")).toBe(2025);
	});

	test("無法解析時退回公曆年,不拋例外", () => {
		expect(sexagenaryYearOfDate("2026")).toBe(2026);
		expect(sexagenaryYearOfDate("garbage")).toBeNaN();
	});
});
