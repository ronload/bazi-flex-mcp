import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { z } from "zod";

type GetBaziChartResult = ReturnType<typeof getBaziChart>;
type Pillars = GetBaziChartResult["八字"]["柱位详细"];
type Pillar = Pillars["年柱"];

export interface TenGodStat {
	透: number;
	藏: number;
	共: number;
}

function parseIsoLikeDate(s: string): { year: number; month: number; day: number } | null {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
	return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function todayIsoDate(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}

function actualAgeAt(
	birthYear: number,
	birthMonth: number,
	birthDay: number,
	atYear: number,
	atMonth: number,
	atDay: number,
): number {
	const before = atMonth < birthMonth || (atMonth === birthMonth && atDay < birthDay);
	return atYear - birthYear - (before ? 1 : 0);
}

export function computeTenGodStats(pillars: {
	年柱: Pick<Pillar, "主星" | "副星">;
	月柱: Pick<Pillar, "主星" | "副星">;
	日柱: Pick<Pillar, "副星">;
	时柱: Pick<Pillar, "主星" | "副星">;
}): Record<string, TenGodStat> {
	const transparent = [pillars.年柱.主星, pillars.月柱.主星, pillars.时柱.主星];
	const hidden = [
		...pillars.年柱.副星,
		...pillars.月柱.副星,
		...pillars.日柱.副星,
		...pillars.时柱.副星,
	];

	const stats: Record<string, TenGodStat> = {};
	const bump = (k: string, kind: "透" | "藏") => {
		if (!stats[k]) stats[k] = { 透: 0, 藏: 0, 共: 0 };
		stats[k][kind]++;
		stats[k].共++;
	};

	for (const g of transparent) bump(g, "透");
	for (const g of hidden) bump(g, "藏");

	return stats;
}

const SCORING_METHOD = {
	algorithm: "tiangan-canggan-weighted",
	weights: {
		tiangan: 1.0,
		canggan: { benqi: 1.0, zhongqi: 0.5, yuqi: 0.3 },
	},
	notes:
		"Score = sum of heavenly-stem weights (1.0 per stem, four pillars) + sum of earth-branch hidden-stem weights by position (本气/中气/余气 = 1.0 / 0.5 / 0.3). No month-command bonus; no transparent-stem bonus. Treat values as relative presence, not classical 旺衰 strength.",
	upstream: "shunshi-bazi-core",
} as const;

export function enrichResult(
	result: GetBaziChartResult,
	birth: { year: number; month: number; day: number },
	referenceDate: string,
) {
	const bazi = result.八字;
	const refYear = Number(referenceDate.slice(0, 4));
	const startMd = parseIsoLikeDate(bazi.起运日期);
	const tenGodStats = computeTenGodStats(bazi.柱位详细);

	return {
		...result,
		meta: {
			referenceDateUsed: referenceDate,
			scoringMethod: SCORING_METHOD,
		},
		八字: {
			...bazi,
			柱位详细: {
				...bazi.柱位详细,
				日柱: {
					...bazi.柱位详细.日柱,
					主星: null,
					label: "日主",
					isDayMaster: true,
				},
			},
			十神统计: tenGodStats,
			大运: bazi.大运.map((yun) => ({
				...yun,
				日主关系: yun.日主关系 === "" ? null : yun.日主关系,
				当前: refYear >= yun.起始年份 && refYear <= yun.结束年份,
				起始虚岁: yun.起始年龄,
				起始实岁: startMd
					? actualAgeAt(
							birth.year,
							birth.month,
							birth.day,
							yun.起始年份,
							startMd.month,
							startMd.day,
						)
					: yun.起始年龄 - 1,
			})),
		},
	};
}

const inputShape = {
	year: z.number().int().describe("Gregorian year of birth"),
	month: z.number().int().min(1).max(12).describe("Gregorian month (1-12)"),
	day: z.number().int().min(1).max(31).describe("Gregorian day of month"),
	hour: z.number().int().min(0).max(23).describe("Hour of birth (0-23)"),
	minute: z.number().int().min(0).max(59).default(0).describe("Minute of birth (0-59)"),
	gender: z.union([z.literal(0), z.literal(1)]).describe("0 = female, 1 = male"),
	city: z
		.string()
		.optional()
		.describe("Birth city (Chinese name preferred); enables true-solar-time correction"),
	longitude: z.number().optional().describe("Birth longitude in degrees east"),
	latitude: z.number().optional().describe("Birth latitude in degrees north"),
	referenceDate: z
		.string()
		.regex(/^\d{4}-\d{1,2}-\d{1,2}$/)
		.optional()
		.describe(
			"ISO date (YYYY-MM-DD) used to decide which decade-cycle is marked `当前`. Defaults to system today. Echoed back as `meta.referenceDateUsed`.",
		),
};

export function registerGetBaziChart(server: McpServer): void {
	server.registerTool(
		"getBaziChart",
		{
			title: "Get Bazi Chart (full time)",
			description: [
				"Compute a full Bazi chart from complete birth time. Requires year/month/day/hour. Use this when the birth hour is known.",
				"",
				"Output notes:",
				'- `八字.柱位详细.日柱.主星` is `null` (日主 carries no ten-god against itself). Identify the day-pillar via `日柱.isDayMaster === true`; `日柱.label` is `"日主"` for display. Only year/month/hour pillars carry real ten-god strings in `主星`.',
				"- `八字.十神统计[十神]` aggregates ten-god counts as `{ 透, 藏, 共 }`. `透` counts from year/month/hour pillars' `主星`; `藏` counts from all four pillars' `副星` (earth-branch hidden stems). 日主 itself is excluded.",
				'- `八字.大运[].日主关系` is `null` when there is no relation (previously `""`).',
				"- `八字.大运[].当前` is computed from `meta.referenceDateUsed` (defaults to today). Override via the `referenceDate` input for historical or hypothetical scenarios.",
				"- `meta.scoringMethod` documents how `八字.五行分值` is computed, so consumers do not need to guess the weighting scheme.",
				'- `八字.起运` is the precise duration from birth to the first decade cycle (e.g., `"6年7月22日起运"`), derived from the solar-term distance. `八字.起运日期` is the corresponding Gregorian date.',
				"- Each `八字.大运` entry exposes `起始虚岁` (East-Asian nominal age; equals the original `起始年龄`) and `起始实岁` (completed years at that decade-cycle start, derived from `起运日期` aligned to the birth month/day). They typically differ by 1-2.",
			].join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const { referenceDate, ...coreInput } = input;
			const result = getBaziChart(coreInput);
			const enriched = enrichResult(
				result,
				{
					year: input.year,
					month: input.month,
					day: input.day,
				},
				referenceDate ?? todayIsoDate(),
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(enriched, null, 2),
					},
				],
			};
		},
	);
}
