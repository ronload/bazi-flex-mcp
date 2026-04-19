import type { getBaziChart } from "shunshi-bazi-core";

export type GetBaziChartResult = ReturnType<typeof getBaziChart>;
export type Pillars = GetBaziChartResult["八字"]["柱位详细"];
export type Pillar = Pillars["年柱"];
