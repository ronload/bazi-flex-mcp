import { z } from "zod";

export const inputShape = {
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
			"Optional ISO date (YYYY-MM-DD). Accept this as an INPUT from the caller — pass it explicitly for historical reconstructions or hypothetical 'what if I looked at this chart at time T' queries. Defaults to system today when omitted. Controls which `八字.大运[].当前` is true and which `八字.流年[].当前` is true. Echoed back as `meta.referenceDateUsed`.",
		),
	liunianStart: z
		.number()
		.int()
		.optional()
		.describe("Start year (Gregorian) for the 流年 table. Defaults to referenceDate year - 3."),
	liunianEnd: z
		.number()
		.int()
		.optional()
		.describe("End year (Gregorian) for the 流年 table. Defaults to referenceDate year + 3."),
};
