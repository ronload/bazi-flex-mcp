import type { getBaziChart, getThreePillarChart } from "@bazi-flex/core";

export type GetBaziChartResult = ReturnType<typeof getBaziChart>;
export type Pillars = GetBaziChartResult["八字"]["柱位详细"];
export type Pillar = Pillars["年柱"];

export type GetThreePillarChartResult = ReturnType<typeof getThreePillarChart>;

/** The hour pillar is absent when the birth hour is unknown, so the derivations
 * below take this shape rather than the four-pillar one. */
export interface PillarMap {
	年柱: Pillar;
	月柱: Pillar;
	日柱: Pillar;
	时柱?: Pillar;
}
