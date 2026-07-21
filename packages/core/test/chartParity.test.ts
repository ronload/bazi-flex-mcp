import { afterAll, beforeAll, expect, setSystemTime, test } from "bun:test";
import { getBaziChart as upstreamGetBaziChart } from "shunshi-bazi-core";
import { type GetBaziChartInput, getBaziChart } from "../src/index.js";

const FROZEN_NOW = new Date("2026-07-21T00:00:00.000Z");

const SWEEP_TIMEOUT_MS = 60_000;

beforeAll(() => setSystemTime(FROZEN_NOW));
afterAll(() => setSystemTime());

const DATES: Array<[number, number, number]> = [
	[1900, 1, 31],
	[1912, 2, 4],
	[1949, 10, 1],
	[1984, 2, 2],
	[1984, 2, 4],
	[1984, 2, 5],
	[1987, 12, 31],
	[1990, 6, 15],
	[1996, 2, 29],
	[2000, 2, 29],
	[2000, 12, 31],
	[2004, 5, 5],
	[2011, 8, 8],
	[2019, 11, 30],
	[2020, 2, 3],
	[2020, 2, 4],
	[2023, 4, 20],
	[2024, 2, 29],
	[2026, 1, 1],
	[2031, 7, 21],
];

const HOURS: Array<[number, number]> = [
	[0, 0],
	[0, 59],
	[1, 0],
	[11, 30],
	[12, 0],
	[18, 45],
	[22, 59],
	[23, 0],
	[23, 30],
];

const LOCATIONS: Array<Partial<GetBaziChartInput>> = [
	{},
	{ city: "北京" },
	{ city: "首尔" },
	{ city: "巴黎" },
	{ city: "台北" },
	{ city: "纽约" },
	{ city: "默认" },
	{ latitude: 35.6762, longitude: 139.6503 },
	{ latitude: -33.8688, longitude: 151.2093 },
	{ latitude: 37.5665, longitude: 126.978, standardMeridian: 135 },
	{ city: "上海", useTrueSolarTime: false },
	{ latitude: 51.5074, longitude: -0.1278, useTrueSolarTime: false },
];

const GENDERS: Array<0 | 1> = [0, 1];
const SECTS: Array<1 | 2> = [1, 2];

function* inputs(): Generator<GetBaziChartInput> {
	for (const [year, month, day] of DATES) {
		for (const [hour, minute] of HOURS) {
			for (const location of LOCATIONS) {
				for (const gender of GENDERS) {
					for (const sect of SECTS) {
						yield { year, month, day, hour, minute, gender, sect, ...location };
					}
				}
			}
		}
	}
}

test(
	"getBaziChart matches the upstream package byte for byte",
	() => {
		let compared = 0;
		for (const input of inputs()) {
			const label = JSON.stringify(input);
			const ours = JSON.stringify(getBaziChart(input));
			const theirs = JSON.stringify(upstreamGetBaziChart(input));
			if (ours !== theirs) throw new Error(`chart differs for ${label}\n${ours}\n${theirs}`);
			compared++;
		}
		expect(compared).toBe(DATES.length * HOURS.length * LOCATIONS.length * 4);
	},
	SWEEP_TIMEOUT_MS,
);

test("omitting sect matches upstream omitting sect", () => {
	for (const [year, month, day] of DATES) {
		for (const gender of GENDERS) {
			const input: GetBaziChartInput = { year, month, day, hour: 23, gender, city: "北京" };
			expect(JSON.stringify(getBaziChart(input))).toBe(JSON.stringify(upstreamGetBaziChart(input)));
		}
	}
});

test("sect does not leak between calls", () => {
	const base: GetBaziChartInput = {
		year: 2000,
		month: 6,
		day: 15,
		hour: 23,
		minute: 30,
		gender: 1,
		city: "北京",
	};
	const sect1 = JSON.stringify(getBaziChart({ ...base, sect: 1 }));
	const sect2 = JSON.stringify(getBaziChart({ ...base, sect: 2 }));
	expect(sect1).not.toBe(sect2);

	expect(JSON.stringify(getBaziChart({ ...base, sect: 1 }))).toBe(sect1);
	expect(JSON.stringify(getBaziChart({ ...base, sect: 2 }))).toBe(sect2);
	expect(JSON.stringify(getBaziChart({ ...base, sect: 1 }))).toBe(sect1);
	expect(JSON.stringify(getBaziChart(base))).toBe(sect1);
});
