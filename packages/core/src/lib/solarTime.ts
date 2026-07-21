/**
 * 真太阳时 (True Solar Time) 计算 & 时辰映射。
 * Ported from shunshi/solar_time.py — identical formulas to guarantee parity.
 */

import { getLocation } from './cityCache.js';

export const SHICHEN_NAMES = [
  '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
  '午时', '未时', '申时', '酉时', '戌时', '亥时',
] as const;

/**
 * 小时/分钟 → 时辰索引 (0=子 ... 11=亥)
 * Matches shunshi/solar_time.py::hour_to_shichen_index.
 */
export function hourToShichenIndex(hour: number, minute: number = 0): number {
  const total = hour * 60 + minute;
  if (total >= 23 * 60 || total < 1 * 60) return 0; // 子时
  return Math.floor((hour + 1) / 2);
}

/**
 * 时差方程 (Equation of Time), 返回分钟数。
 * EOT(t) = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B), B = 2π(N−81)/365
 */
export function equationOfTime(dayOfYear: number): number {
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / 86400_000) + 1;
}

export interface ClockDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

/**
 * 钟表时间 → 真太阳时。
 * standardMeridian 未指定时按经度四舍五入到 15° 倍数。
 */
export function trueSolarTime(
  dt: ClockDateTime,
  longitude: number,
  standardMeridian?: number,
): ClockDateTime {
  const sm = standardMeridian ?? Math.round(longitude / 15) * 15.0;
  const doy = dayOfYear(dt.year, dt.month, dt.day);
  const lngCorrection = (longitude - sm) * 4; // 每 1° = 4 分钟
  const eot = equationOfTime(doy);
  const offsetMinutes = lngCorrection + eot;

  // 用 UTC 时间戳做加法，避免本地时区干扰
  const base = Date.UTC(
    dt.year, dt.month - 1, dt.day,
    dt.hour, dt.minute, dt.second ?? 0,
  );
  const shifted = new Date(base + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export interface SolarTimeInfo {
  lat: number;
  lon: number;
  clockDt: ClockDateTime;
  solarDt: ClockDateTime;
  shichenIndex: number;
  shichenName: string;
  correctionMinutes: number;
}

/**
 * 一次性计算真太阳时 + 时辰。等价于 shunshi/solar_time.py::calc_solar_time_info。
 * 至少提供 city 或 {lat, lon} 其一。
 *
 * `standardMeridian` (°E) — explicit override for the clock-time reference
 * meridian. Precedence: opts.standardMeridian > cityCache override > default
 * (Math.round(longitude/15)*15). Pass this when lat/lon are in a region where
 * the default rounding is wrong — e.g. Korea (KST=135° but most longitudes
 * round to 120°) or continental Europe west of 7.5°E (CET=15° but rounds
 * to 0°).
 */
export function calcSolarTimeInfo(
  dt: ClockDateTime,
  opts: {
    city?: string;
    lat?: number;
    lon?: number;
    standardMeridian?: number;
  },
): SolarTimeInfo {
  let lat = opts.lat;
  let lon = opts.lon;
  let sm = opts.standardMeridian;
  if (lat === undefined || lon === undefined) {
    if (!opts.city) {
      throw new Error('calcSolarTimeInfo requires either city or {lat, lon}');
    }
    const loc = getLocation(opts.city);
    lat = loc[0];
    lon = loc[1];
    // cache-level meridian override only applies if caller didn't pass one
    if (sm === undefined && loc.length === 3) sm = loc[2];
  }
  const clockDt: ClockDateTime = { ...dt, second: dt.second ?? 0 };
  const solarDt = trueSolarTime(clockDt, lon, sm);

  const clockMs = Date.UTC(
    clockDt.year, clockDt.month - 1, clockDt.day,
    clockDt.hour, clockDt.minute, clockDt.second ?? 0,
  );
  const solarMs = Date.UTC(
    solarDt.year, solarDt.month - 1, solarDt.day,
    solarDt.hour, solarDt.minute, solarDt.second ?? 0,
  );
  const correctionMinutes = Math.round((solarMs - clockMs) / 600) / 100; // 2 decimals, matches shunshi

  const idx = hourToShichenIndex(solarDt.hour, solarDt.minute);
  return {
    lat,
    lon,
    clockDt,
    solarDt,
    shichenIndex: idx,
    shichenName: SHICHEN_NAMES[idx],
    correctionMinutes,
  };
}
