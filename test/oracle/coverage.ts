/**
 * Corpus coverage report.
 *
 * A fingerprint baseline only protects what the corpus actually reaches. The
 * single most useful number here is the set of distinct 神煞 names the corpus
 * triggers: several of the upstream tables fire on three of the sixty day
 * pillars, so "2000 random samples" says nothing about whether they are covered.
 * Coverage is measured from real outputs, not from inputs, because reaching a
 * table entry is a property of the result, not of the request.
 */

import { getBaziChart } from "shunshi-bazi-core";
import { buildCorpus, type OracleCase } from "./corpus.js";

export interface Coverage {
	cases: number;
	dayPillars: string[];
	yearPillars: string[];
	monthBranches: string[];
	hourBranches: string[];
	shensha: string[];
	ganRelations: string[];
	zhiRelations: string[];
	nayinElements: string[];
	cities: string[];
	sects: number[];
	trueSolarTimeCases: number;
}

const relationKind = (s: string): string => {
	// Upstream relation strings look like "午子相冲" or "子丑暗合"; the kind is the
	// trailing token, which is what the coverage question is actually about.
	// `暗合` is upstream's (wrong) label for 地支六合 in short mode; it is listed here
	// as an observed output, not as an endorsement. See 明確不做的事 in the plan.
	const m = /(相合|相冲|相害|相破|相刑|暗合|自刑|三刑|克)/.exec(s);
	return m?.[1] ?? s;
};

export function computeCoverage(corpus: readonly OracleCase[] = buildCorpus()): Coverage {
	const dayPillars = new Set<string>();
	const yearPillars = new Set<string>();
	const monthBranches = new Set<string>();
	const hourBranches = new Set<string>();
	const shensha = new Set<string>();
	const ganRelations = new Set<string>();
	const zhiRelations = new Set<string>();
	const nayinElements = new Set<string>();
	const cities = new Set<string>();
	const sects = new Set<number>();
	let trueSolarTimeCases = 0;

	for (const c of corpus) {
		if (c.core.city) cities.add(c.core.city);
		sects.add(c.core.sect ?? 1);
		let out: ReturnType<typeof getBaziChart>;
		try {
			out = getBaziChart(c.core);
		} catch {
			continue;
		}
		if (out.真太阳时) trueSolarTimeCases++;
		const p = out.八字.柱位详细;
		dayPillars.add(p.日柱.干支);
		yearPillars.add(p.年柱.干支);
		monthBranches.add(p.月柱.地支);
		hourBranches.add(p.时柱.地支);
		// 纳音 is a two-or-three character name whose LAST character is the element,
		// which is what 童子煞 and several other tables key on.
		nayinElements.add(p.年柱.纳音.slice(-1));
		for (const key of ["年柱", "月柱", "日柱", "时柱"] as const) {
			for (const s of p[key].神煞) shensha.add(s);
		}
		for (const r of out.八字.刑冲合会.天干) ganRelations.add(relationKind(r));
		for (const r of out.八字.刑冲合会.地支) zhiRelations.add(relationKind(r));
	}

	const sorted = (s: Set<string>) => [...s].sort();
	return {
		cases: corpus.length,
		dayPillars: sorted(dayPillars),
		yearPillars: sorted(yearPillars),
		monthBranches: sorted(monthBranches),
		hourBranches: sorted(hourBranches),
		shensha: sorted(shensha),
		ganRelations: sorted(ganRelations),
		zhiRelations: sorted(zhiRelations),
		nayinElements: sorted(nayinElements),
		cities: sorted(cities),
		sects: [...sects].sort(),
		trueSolarTimeCases,
	};
}

export function formatCoverage(cov: Coverage): string {
	const line = (label: string, items: readonly (string | number)[], expected?: number) => {
		const suffix = expected !== undefined ? ` / ${expected}` : "";
		return `${label.padEnd(18)} ${String(items.length).padStart(4)}${suffix}  ${items.join(" ")}`;
	};
	return [
		`corpus cases      ${cov.cases}`,
		`真太阳时 applied   ${cov.trueSolarTimeCases}`,
		line("日柱", cov.dayPillars, 60),
		line("年柱", cov.yearPillars, 60),
		line("月支", cov.monthBranches, 12),
		line("时支", cov.hourBranches, 12),
		line("纳音五行", cov.nayinElements, 5),
		line("sect", cov.sects, 2),
		line("天干关系", cov.ganRelations),
		line("地支关系", cov.zhiRelations),
		line("神煞", cov.shensha),
		`cities             ${cov.cities.length}`,
	].join("\n");
}
