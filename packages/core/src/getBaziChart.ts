import { type BaziChart, buildBaziChart } from "./calendar/chart.js";
import type { Sect } from "./calendar/sect.js";
import { formatMinutePrecision } from "./lib/datetime.js";
import { type ClockDateTime, calcSolarTimeInfo, type SolarTimeInfo } from "./lib/solarTime.js";

export interface GetBaziChartInput {
	year: number;
	month: number;
	/** 1-12 */
	day: number;
	hour: number;
	minute?: number;
	/** 0 = 女, 1 = 男 */
	gender: 0 | 1;
	/** Chinese city name, resolved through the built-in coordinate cache. */
	city?: string;
	longitude?: number;
	latitude?: number;
	/** Only takes effect when a city or longitude/latitude pair is given. */
	useTrueSolarTime?: boolean;
	/**
	 * The clock timezone's standard meridian (°E). Defaults to
	 * `Math.round(longitude / 15) * 15`, which is wrong for Korea (KST is 135°
	 * while most Korean longitudes round to 120°) and for continental Europe
	 * west of 7.5°E (CET is 15° while those longitudes round to 0°).
	 */
	standardMeridian?: number;
	sect?: Sect;
}

export interface TrueSolarTime {
	钟表时间: string;
	真太阳时: string;
	修正分钟: number;
	时辰: string | undefined;
	时辰索引: number;
}

export interface GetBaziChartOutput {
	输入: {
		公历: string;
		性别: "男" | "女";
		城市?: string;
		经度?: number;
		纬度?: number;
	};
	真太阳时?: TrueSolarTime;
	八字: BaziChart;
}

const COORDINATE_DECIMALS = 4;

function roundCoordinate(value: number): number {
	const factor = 10 ** COORDINATE_DECIMALS;
	return Math.round(value * factor) / factor;
}

export function getBaziChart(input: GetBaziChartInput): GetBaziChartOutput {
	const {
		year,
		month,
		day,
		hour,
		minute = 0,
		gender,
		city,
		longitude,
		latitude,
		useTrueSolarTime = true,
		standardMeridian,
		sect,
	} = input;

	const clockDt: ClockDateTime = { year, month, day, hour, minute, second: 0 };
	const hasLocation = (longitude !== undefined && latitude !== undefined) || !!city;

	let solarDt = clockDt;
	let info: SolarTimeInfo | undefined;
	let lat = hasLocation ? latitude : undefined;
	let lon = hasLocation ? longitude : undefined;

	if (useTrueSolarTime && hasLocation) {
		info = calcSolarTimeInfo(clockDt, {
			city,
			lat: latitude,
			lon: longitude,
			standardMeridian,
		});
		solarDt = info.solarDt;
		lat = info.lat;
		lon = info.lon;
	}

	return {
		输入: {
			公历: formatMinutePrecision(clockDt),
			性别: gender === 1 ? "男" : "女",
			...(city !== undefined ? { 城市: city } : {}),
			...(lon !== undefined ? { 经度: roundCoordinate(lon) } : {}),
			...(lat !== undefined ? { 纬度: roundCoordinate(lat) } : {}),
		},
		...(info
			? {
					真太阳时: {
						钟表时间: formatMinutePrecision(info.clockDt),
						真太阳时: formatMinutePrecision(info.solarDt),
						修正分钟: info.correctionMinutes,
						时辰: info.shichenName,
						时辰索引: info.shichenIndex,
					},
				}
			: {}),
		八字: buildBaziChart({ solarDt, gender, sect }),
	};
}
