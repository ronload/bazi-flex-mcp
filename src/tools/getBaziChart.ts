import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaziChart } from "shunshi-bazi-core";
import { z } from "zod";

type GetBaziChartResult = ReturnType<typeof getBaziChart>;

function parseIsoLikeDate(s: string): { month: number; day: number } | null {
	const m = /^\d{4}-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
	return m ? { month: Number(m[1]), day: Number(m[2]) } : null;
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

function enrichResult(
	result: GetBaziChartResult,
	birth: { year: number; month: number; day: number },
) {
	const bazi = result.八字;
	const startMd = parseIsoLikeDate(bazi.起运日期);
	return {
		...result,
		八字: {
			...bazi,
			柱位详细: {
				...bazi.柱位详细,
				日柱: {
					...bazi.柱位详细.日柱,
					isDayMaster: true,
				},
			},
			大运: bazi.大运.map((yun) => ({
				...yun,
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
				'- `八字.柱位详细.日柱.主星` is "元男"/"元女", a day-master marker (the subject of the reading), NOT a ten-god. Detect via `日柱.isDayMaster === true`. Only year/month/hour pillars carry real ten-god strings in `主星`.',
				'- `八字.起运` is the precise duration from birth to the first decade cycle (e.g., "6年7月22日起运"), derived from the solar-term distance. `八字.起运日期` is the corresponding Gregorian date.',
				"- Each `八字.大运` entry exposes `起始虚岁` (East-Asian nominal age; equals the original `起始年龄`) and `起始实岁` (completed years at that decade-cycle start, derived from `起运日期` aligned to the birth month/day). They typically differ by 1–2.",
			].join("\n"),
			inputSchema: inputShape,
		},
		async (input) => {
			const result = getBaziChart(input);
			const enriched = enrichResult(result, {
				year: input.year,
				month: input.month,
				day: input.day,
			});
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
