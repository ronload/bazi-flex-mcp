import { actualAgeAt } from "../../time/age.js";
import { parseIsoLikeDate } from "../../time/iso.js";
import type { Pillar } from "../getBaziChart/types.js";
import type { ResolvedChartRequest } from "./request.js";

export interface BirthDate {
	year: number;
	month: number;
	day: number;
}

/** The void branches of the two traditional reference 旬. */
export interface XunKong {
	日柱旬空: string[];
	年柱旬空: string[];
}

interface KongWangBearing {
	地支: string;
	空亡: string;
}

/** Upstream states each pillar's own 旬 voids as a two-character string. */
export function deriveXunKong(pillars: { 年柱: KongWangBearing; 日柱: KongWangBearing }): XunKong {
	return {
		日柱旬空: [...pillars.日柱.空亡],
		年柱旬空: [...pillars.年柱.空亡],
	};
}

/**
 * Upstream's single `空亡` string conflates two different facts, which consumers
 * read as one. Split them: `所在旬空亡` is the pillar's own 旬 voids, pure
 * reference, while `落空亡` is whether the pillar's branch actually falls into
 * either reference 旬.
 */
export function remapPillarKongWang<P extends KongWangBearing>(
	pillar: P,
	xunKong: XunKong,
): Omit<P, "空亡"> & { 所在旬空亡: string[]; 落空亡: { 日柱旬: boolean; 年柱旬: boolean } } {
	const { 空亡, ...rest } = pillar;
	return {
		...rest,
		所在旬空亡: [...空亡],
		落空亡: {
			日柱旬: xunKong.日柱旬空.includes(pillar.地支),
			年柱旬: xunKong.年柱旬空.includes(pillar.地支),
		},
	};
}

/**
 * The three pillars both tools always emit. Shared so the day-master markers,
 * which the tool descriptions tell consumers to key on, are declared once.
 */
export function remapCorePillars(
	pillars: { 年柱: Pillar; 月柱: Pillar; 日柱: Pillar },
	xunKong: XunKong,
) {
	return {
		年柱: remapPillarKongWang(pillars.年柱, xunKong),
		月柱: remapPillarKongWang(pillars.月柱, xunKong),
		日柱: {
			...remapPillarKongWang(pillars.日柱, xunKong),
			主星: null,
			label: "日主",
			isDayMaster: true,
		},
	};
}

interface DayunEntry extends KongWangBearing {
	日主关系: string;
	起始年份: number;
	结束年份: number;
	起始年龄: number;
}

export interface DayunContext {
	xunKong: XunKong;
	req: ResolvedChartRequest;
	birth: BirthDate;
	起运日期: string;
}

export function mapDayun<Y extends DayunEntry>(
	entries: readonly Y[],
	{ xunKong, req, birth, 起运日期 }: DayunContext,
) {
	const startMd = parseIsoLikeDate(起运日期);
	return entries.map((yun) => {
		const remapped = remapPillarKongWang(yun, xunKong);
		return {
			...remapped,
			日主关系: remapped.日主关系 === "" ? null : remapped.日主关系,
			当前: req.referenceYear >= remapped.起始年份 && req.referenceYear <= remapped.结束年份,
			起始虚岁: remapped.起始年龄,
			起始实岁: startMd
				? actualAgeAt(
						birth.year,
						birth.month,
						birth.day,
						remapped.起始年份,
						startMd.month,
						startMd.day,
					)
				: remapped.起始年龄 - 1,
		};
	});
}
