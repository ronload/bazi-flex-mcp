import { buildThreePillarChart, type ThreePillarChart } from "./calendar/chart.js";
import { formatDate } from "./lib/datetime.js";

/**
 * No location and no `useTrueSolarTime`: the correction shifts the clock by
 * minutes, which can only ever move the hour pillar, and there is none here.
 */
export interface GetThreePillarChartInput {
	year: number;
	/** 1-12 */
	month: number;
	day: number;
	/** 0 = 女, 1 = 男 */
	gender: 0 | 1;
}

export interface GetThreePillarChartOutput {
	输入: {
		公历: string;
		性别: "男" | "女";
	};
	八字: ThreePillarChart;
}

export function getThreePillarChart(input: GetThreePillarChartInput): GetThreePillarChartOutput {
	const { year, month, day, gender } = input;
	return {
		输入: {
			公历: formatDate(year, month, day),
			性别: gender === 1 ? "男" : "女",
		},
		八字: buildThreePillarChart({ year, month, day, gender }),
	};
}
