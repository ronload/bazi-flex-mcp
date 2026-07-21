import type { HeavenStem, SixtyCycle } from "tyme4ts";

export interface HiddenStem {
	干: string;
	五行: string;
}

export interface Pillar {
	干支: string;
	天干: string;
	地支: string;
	纳音: string;
	五行: string;
	主星: string;
	副星: string[];
	藏干: string[];
	藏干详情: HiddenStem[];
	星运: string;
	自坐: string;
	空亡: string;
	神煞: string[];
}

/** 本气, 中气, 余气 — branches without a 中气 or 余气 simply yield fewer entries. */
export function hiddenStemsOf(cycle: SixtyCycle): HeavenStem[] {
	return cycle
		.getEarthBranch()
		.getHideHeavenStems()
		.map((hidden) => hidden.getHeavenStem());
}

/** 副星 — the ten stars of the hidden stems, read against the day master. */
export function hiddenTenStarsOf(cycle: SixtyCycle, dayMaster: HeavenStem): string[] {
	return hiddenStemsOf(cycle).map((stem) => dayMaster.getTenStar(stem).toString());
}

export function voidBranchesOf(cycle: SixtyCycle): string[] {
	return cycle.getExtraEarthBranches().map((branch) => branch.toString());
}

export function voidBranchString(cycle: SixtyCycle): string {
	return voidBranchesOf(cycle).join("");
}

export function mainStarOf(cycle: SixtyCycle, dayMaster: HeavenStem): string {
	return dayMaster.getTenStar(cycle.getHeavenStem()).toString();
}

export function dayMasterStarOf(gender: 0 | 1): string {
	return gender === 1 ? "元男" : "元女";
}

export function buildPillar(
	cycle: SixtyCycle,
	dayMaster: HeavenStem,
	mainStar: string,
	shensha: string[],
): Pillar {
	const stem = cycle.getHeavenStem();
	const branch = cycle.getEarthBranch();
	const hidden = hiddenStemsOf(cycle);
	return {
		干支: cycle.toString(),
		天干: stem.toString(),
		地支: branch.toString(),
		纳音: cycle.getSound().toString(),
		五行: stem.getElement().toString() + branch.getElement().toString(),
		主星: mainStar,
		副星: hidden.map((hiddenStem) => dayMaster.getTenStar(hiddenStem).toString()),
		藏干: hidden.map((hiddenStem) => hiddenStem.toString()),
		藏干详情: hidden.map((hiddenStem) => ({
			干: hiddenStem.toString(),
			五行: hiddenStem.getElement().toString(),
		})),
		星运: dayMaster.getTerrain(branch).toString(),
		自坐: stem.getTerrain(branch).toString(),
		空亡: voidBranchString(cycle),
		神煞: shensha,
	};
}
