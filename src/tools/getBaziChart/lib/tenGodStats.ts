import type { Pillar } from "../types.js";

export interface TenGodStat {
	透: number;
	藏: number;
	共: number;
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
