import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getBaziChart } from 'shunshi-bazi-core';

const inputShape = {
  year: z.number().int().describe('Gregorian year of birth'),
  month: z.number().int().min(1).max(12).describe('Gregorian month (1-12)'),
  day: z.number().int().min(1).max(31).describe('Gregorian day of month'),
  hour: z.number().int().min(0).max(23).describe('Hour of birth (0-23)'),
  minute: z
    .number()
    .int()
    .min(0)
    .max(59)
    .default(0)
    .describe('Minute of birth (0-59)'),
  gender: z
    .union([z.literal(0), z.literal(1)])
    .describe('0 = female, 1 = male'),
  city: z
    .string()
    .optional()
    .describe('Birth city (Chinese name preferred); enables true-solar-time correction'),
  longitude: z
    .number()
    .optional()
    .describe('Birth longitude in degrees east'),
  latitude: z
    .number()
    .optional()
    .describe('Birth latitude in degrees north'),
};

export function registerGetBaziChart(server: McpServer): void {
  server.registerTool(
    'getBaziChart',
    {
      title: 'Get Bazi Chart (full time)',
      description:
        'Compute a full Bazi chart from complete birth time. Requires year/month/day/hour. Use this when the birth hour is known.',
      inputSchema: inputShape,
    },
    async (input) => {
      const result = getBaziChart(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
