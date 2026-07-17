/**
 * Calculadora de risco cardiovascular da SBC — Escore de Risco Global (ERG).
 *
 * Função pura, sem DB. Base: Framingham "General CVD" (D'Agostino et al., 2008,
 * Circulation 117:743-753) — o mesmo modelo adotado pela Sociedade Brasileira de
 * Cardiologia nas Diretrizes de Prevenção Cardiovascular / Dislipidemias. Estima
 * o risco de evento cardiovascular global em 10 anos e classifica em
 * baixo · intermediário · alto · muito alto (cortes por sexo da SBC).
 *
 * Coeficientes conferidos com o código-fonte do pacote CVrisk (ascvd_10y_frs).
 * Caso de referência validado contra o teste unitário do pacote: ♂ 55a, CT 213,
 * HDL 50, PAS 140, sem trat/tabaco/DM → 13,53%.
 *
 * IMPORTANTE — é uma ferramenta de apoio; a conduta final é do profissional.
 * Requer exames (colesterol total e HDL) — sem eles não há ERG.
 */

export type ErgSex = 'masculino' | 'feminino';

export type ErgInput = {
	sex: ErgSex;
	/** Idade em anos. O modelo é válido para 30–74 (valores fora são limitados). */
	age: number;
	/** Colesterol total (mg/dL). */
	totalCholesterol: number;
	/** HDL colesterol (mg/dL). */
	hdl: number;
	/** Pressão arterial sistólica (mmHg). */
	systolicBp: number;
	/** Em uso de anti-hipertensivo. */
	onBpMed: boolean;
	smoker: boolean;
	diabetes: boolean;
};

export type SbcCategory = 'baixo' | 'intermediario' | 'alto' | 'muito_alto';
/** Faixa do campo do app (mesma enum do risco CV armazenado). */
export type SbcLevel = 'baixo' | 'moderado' | 'alto' | 'muito_alto';

// Coeficientes do modelo (D'Agostino 2008), por sexo. Fonte: CVrisk::frs_coef.
const COEF = {
	masculino: {
		lnAge: 3.06117,
		lnTotChol: 1.1237,
		lnHdl: -0.93263,
		lnUntreatedSbp: 1.93303,
		lnTreatedSbp: 1.99881,
		smoker: 0.65451,
		diabetes: 0.57367,
		groupMean: 23.9802,
		baselineSurvival: 0.88936
	},
	feminino: {
		lnAge: 2.32888,
		lnTotChol: 1.20904,
		lnHdl: -0.70833,
		lnUntreatedSbp: 2.76157,
		lnTreatedSbp: 2.82263,
		smoker: 0.52873,
		diabetes: 0.69154,
		groupMean: 26.1931,
		baselineSurvival: 0.95012
	}
} as const;

const AGE_MIN = 30;
const AGE_MAX = 74;

/**
 * Calcula o risco cardiovascular global em 10 anos (%) pelo ERG/Framingham 2008.
 * Retorna número (0–100), arredondado a 1 casa. Idade é limitada a [30,74]
 * (faixa de validade do modelo).
 */
export function ergRiskPercent(input: ErgInput): number {
	const c = COEF[input.sex];
	const age = Math.min(AGE_MAX, Math.max(AGE_MIN, input.age));

	// SBP entra em dois termos mutuamente exclusivos; o inativo recebe 1 (ln 1 = 0).
	const sbpTreated = input.onBpMed ? input.systolicBp : 1;
	const sbpUntreated = input.onBpMed ? 1 : input.systolicBp;

	const sum =
		Math.log(age) * c.lnAge +
		Math.log(input.hdl) * c.lnHdl +
		Math.log(input.totalCholesterol) * c.lnTotChol +
		Math.log(sbpTreated) * c.lnTreatedSbp +
		Math.log(sbpUntreated) * c.lnUntreatedSbp +
		(input.smoker ? c.smoker : 0) +
		(input.diabetes ? c.diabetes : 0);

	const risk = (1 - Math.pow(c.baselineSurvival, Math.exp(sum - c.groupMean))) * 100;
	return Math.round(risk * 10) / 10;
}

/**
 * Classifica o % do ERG na categoria da SBC (cortes por sexo):
 *   baixo <5% · intermediário 5–10% (♀) / 5–20% (♂) · alto >10% (♀) / >20% (♂).
 */
export function sbcCategoryFromErg(riskPct: number, sex: ErgSex): SbcCategory {
	if (riskPct < 5) return 'baixo';
	const highCut = sex === 'masculino' ? 20 : 10;
	return riskPct > highCut ? 'alto' : 'intermediario';
}

/** Mapeia a categoria SBC para a faixa do campo do app. */
export function sbcCategoryToLevel(cat: SbcCategory): SbcLevel {
	return cat === 'intermediario' ? 'moderado' : cat;
}

export type SbcResult = {
	riskPct: number;
	category: SbcCategory;
	level: SbcLevel;
	/** true se algum reclassificador direto elevou a categoria (não pelo escore). */
	reclassified: boolean;
	notes: string[];
};

export type SbcReclassifiers = {
	/** Doença aterosclerótica estabelecida (prevenção secundária) → muito alto. */
	establishedCvd?: boolean;
	/**
	 * Condição de alto risco independente do escore (aterosclerose subclínica,
	 * aneurisma de aorta, DRC TFG<60, LDL≥190, DM com lesão de órgão-alvo).
	 */
	highRiskCondition?: boolean;
};

/**
 * Estratificação SBC completa: aplica os reclassificadores diretos e, na
 * ausência deles, classifica pelo ERG. `age` fora de [30,74] gera uma nota.
 */
export function stratifySbc(input: ErgInput, flags: SbcReclassifiers = {}): SbcResult {
	const notes: string[] = [];
	if (input.age < AGE_MIN || input.age > AGE_MAX)
		notes.push(`Idade ${input.age}a fora da faixa do modelo (30–74) — risco limitado à borda.`);

	const riskPct = ergRiskPercent(input);

	if (flags.establishedCvd) {
		notes.push('Doença aterosclerótica estabelecida → muito alto risco (prevenção secundária).');
		return { riskPct, category: 'muito_alto', level: 'muito_alto', reclassified: true, notes };
	}
	if (flags.highRiskCondition) {
		notes.push('Condição de alto risco independente do escore.');
		return { riskPct, category: 'alto', level: 'alto', reclassified: true, notes };
	}

	const category = sbcCategoryFromErg(riskPct, input.sex);
	return { riskPct, category, level: sbcCategoryToLevel(category), reclassified: false, notes };
}

const CATEGORY_LABEL: Record<SbcCategory, string> = {
	baixo: 'Baixo',
	intermediario: 'Intermediário',
	alto: 'Alto',
	muito_alto: 'Muito alto'
};

export function sbcCategoryLabel(cat: SbcCategory): string {
	return CATEGORY_LABEL[cat];
}
