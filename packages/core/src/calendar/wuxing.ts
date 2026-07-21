import type { HeavenStem, SixtyCycle } from "tyme4ts";
import { hiddenStemsOf } from "./pillar.js";

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;

type Element = (typeof ELEMENTS)[number];

const STEM_WEIGHT = 1.0;

/** 本气, 中气, 余气. */
const HIDDEN_STEM_WEIGHTS = [1.0, 0.5, 0.3];

const SMALLEST_HIDDEN_STEM_WEIGHT = 0.3;

const SCORE_DECIMALS = 1;

export interface ElementScore {
	分值: number;
	占比: string;
}

export interface WuxingScore {
	金: ElementScore;
	木: ElementScore;
	水: ElementScore;
	火: ElementScore;
	土: ElementScore;
	日主五行: string;
}

function toElement(name: string): Element {
	const element = ELEMENTS.find((candidate) => candidate === name);
	if (element === undefined) throw new Error(`Not a five-element name: ${name}`);
	return element;
}

function accumulate(cycles: SixtyCycle[]): Record<Element, number> {
	const scores: Record<Element, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
	for (const cycle of cycles) {
		scores[toElement(cycle.getHeavenStem().getElement().toString())] += STEM_WEIGHT;
		hiddenStemsOf(cycle).forEach((hidden, index) => {
			const weight = HIDDEN_STEM_WEIGHTS[index] ?? SMALLEST_HIDDEN_STEM_WEIGHT;
			scores[toElement(hidden.getElement().toString())] += weight;
		});
	}
	return scores;
}

function toScore(value: number, total: number): ElementScore {
	const factor = 10 ** SCORE_DECIMALS;
	return {
		分值: Math.round(value * factor) / factor,
		占比: `${Math.round((value / total) * 100)}%`,
	};
}

export function calcWuxingScore(cycles: SixtyCycle[], dayMaster: HeavenStem): WuxingScore {
	const scores = accumulate(cycles);
	const total = ELEMENTS.reduce((sum, element) => sum + scores[element], 0);
	return {
		金: toScore(scores.金, total),
		木: toScore(scores.木, total),
		水: toScore(scores.水, total),
		火: toScore(scores.火, total),
		土: toScore(scores.土, total),
		日主五行: dayMaster.getElement().toString(),
	};
}
