/**
 * Cuidados do dia: o que faz o personal adiar ou interromper a sessão.
 *
 * Veio de uma pergunta ao Jonas. O guia de HIV dos doutores lista febre,
 * infecção ativa e dor torácica como motivo de suspender a sessão, e nada
 * disso é condição crônica: é como a pessoa está HOJE. Perguntei se eles
 * queriam um campo pra registrar isso antes do treino, e a resposta foi:
 *
 *   "Ao gerar o treino, deixar como informações de cuidado. O personal que
 *    receber essa prescrição tem a responsabilidade de considerar isso ao
 *    monitorar o treino e de passar essa informação para o seu aluno."
 *
 * Ou seja, sem campo novo e sem o sistema perguntando nada ao aluno. O plano
 * sai com os critérios escritos, e quem aplica decide na hora.
 *
 * Por que isto é código e não só prompt: critério de suspensão que some
 * porque o modelo resolveu resumir é exatamente o tipo de falha silenciosa
 * que a gente vem tirando do sistema. O prompt pede, e esta função garante.
 * Mesma ideia do `ensureWarmup`.
 *
 * Cada item cita a fonte que o sustenta, e todas estão na base de
 * conhecimento. Nada aqui é número inventado.
 */

export type CuidadoDoDia = {
	/** Vira `monitoring_parameters[].parameter` no plano. */
	parameter: string;
	/** Quando verificar. Vira `frequency`. */
	frequency: string;
	/** O que faz adiar ou interromper. Vira `alert_threshold`. */
	alert_threshold: string;
	/** Título da fonte na base, pro doutor conseguir procurar. */
	fonte: string;
};

const ACSM10 = 'Diretrizes do ACSM — 10ª edição';
const GUIA_HIV = 'Guia de Prescrição de Exercício Físico para PVHIV — PreceptorFISIC (2026)';
const ADA_COLBERG =
	'Physical Activity/Exercise and Diabetes: A Position Statement of the American Diabetes Association (Colberg et al., 2016)';

/**
 * Vale pra qualquer aluno, com ou sem diagnóstico. São os sinais que mandam
 * parar na hora e encaminhar, independente do que o plano diga.
 */
export const CUIDADOS_GERAIS: CuidadoDoDia[] = [
	{
		parameter: 'Sinais de alarme durante a sessão',
		frequency: 'durante toda a sessão',
		alert_threshold:
			'Interromper na hora e encaminhar: dor no peito, falta de ar desproporcional ao esforço, tontura, desmaio ou quase desmaio, palpitação com mal-estar, palidez ou suor frio.',
		fonte: ACSM10
	}
];

/**
 * Por tag de condição. A chave é a tag canônica; o aluno recebe a união dos
 * cuidados de todas as tags que ele tem, sem repetir.
 */
export const CUIDADOS_POR_TAG: Record<string, CuidadoDoDia[]> = {
	hiv: [
		{
			parameter: 'Temperatura e sinais de infecção',
			frequency: 'antes de cada sessão',
			alert_threshold:
				'Não treinar e encaminhar: febre com comprometimento sistêmico, infecção aguda grave ou infecção oportunista ativa, vômito ou diarreia intensos, desidratação grave.',
			fonte: GUIA_HIV
		},
		{
			parameter: 'Sintomas cardiorrespiratórios e metabólicos',
			frequency: 'antes e durante a sessão',
			alert_threshold:
				'Suspender e encaminhar: dor torácica sugestiva de isquemia, síncope inexplicada, dispneia intensa em repouso, instabilidade hemodinâmica, arritmia sintomática, hipoglicemia sintomática ou hiperglicemia com sinais de descompensação.',
			fonte: GUIA_HIV
		}
	],
	diabetes_tipo_1: [
		{
			parameter: 'Glicemia capilar',
			frequency: 'antes de cada sessão',
			alert_threshold:
				'Abaixo de 100 mg/dL, oferecer carboidrato antes de começar. Hiperglicemia inexplicada a partir de 250 mg/dL pede teste de cetona.',
			fonte: ADA_COLBERG
		}
	],
	diabetes_tipo_2: [
		{
			parameter: 'Glicemia capilar',
			frequency: 'antes de cada sessão',
			alert_threshold: 'Abaixo de 100 mg/dL, oferecer carboidrato antes de começar.',
			fonte: ADA_COLBERG
		}
	],
	diabetes_descompensado: [
		{
			parameter: 'Glicemia capilar e cetona',
			frequency: 'antes de cada sessão',
			alert_threshold:
				'Cetona moderada ou alta: não treinar. Glicemia acima de 250 mg/dL: adiar o esforço intenso e manter leve a moderado, porque o esforço intenso pode agravar a hiperglicemia.',
			fonte: ADA_COLBERG
		}
	],
	dpoc_leve: [cuidadoSpO2()],
	dpoc_moderada: [cuidadoSpO2()],
	dpoc_grave: [cuidadoSpO2()],
	pos_covid_longo: [cuidadoSpO2()],
	hipertensao_nao_controlada: [
		{
			parameter: 'Pressão arterial de repouso',
			frequency: 'antes de cada sessão',
			alert_threshold:
				'Acima de 180/110 mmHg, não iniciar a sessão e encaminhar para avaliação médica.',
			fonte: 'ACC/AHA — Diretriz de Hipertensão'
		}
	],
	reabilitacao_cardiaca_internado: [
		{
			parameter: 'Frequência cardíaca e sintomas',
			frequency: 'durante toda a sessão',
			alert_threshold:
				'Teto de 120 bpm. Interromper com angina, dispneia acentuada, queda da pressão sistólica durante o esforço com aumento de carga, arritmia ou bloqueio.',
			fonte: ACSM10
		}
	],
	pos_transplante_cardiaco: [
		{
			parameter: 'Percepção de esforço e sinais de rejeição',
			frequency: 'antes e durante a sessão',
			alert_threshold:
				'Intensidade pela percepção, não pela frequência cardíaca. Suspender e encaminhar diante de queda súbita de tolerância ao esforço, febre, ganho rápido de peso ou edema novo.',
			fonte: ACSM10
		}
	],
	gestante_primeiro_trimestre: [cuidadoGestante()],
	gestante_segundo_trimestre: [cuidadoGestante()],
	gestante_terceiro_trimestre: [cuidadoGestante()],
	cancer_em_tratamento: [
		{
			parameter: 'Estado geral no dia do treino',
			frequency: 'antes de cada sessão',
			alert_threshold:
				'Adiar a sessão em dia de infusão com mal-estar, febre, vômito, sangramento ou fadiga incapacitante.',
			fonte: ACSM10
		}
	]
};

function cuidadoSpO2(): CuidadoDoDia {
	return {
		parameter: 'Saturação de oxigênio (SpO2)',
		frequency: 'antes e durante a sessão',
		alert_threshold:
			'Interromper o esforço se a SpO2 cair abaixo de 88%. Atenção também a dispneia desproporcional e aumento da tosse ou do catarro em relação ao habitual.',
		fonte:
			'GOLD 2025 — Global Strategy for Prevention, Diagnosis and Management of COPD (2025 Report)'
	};
}

function cuidadoGestante(): CuidadoDoDia {
	return {
		parameter: 'Sinais obstétricos de interrupção',
		frequency: 'antes e durante a sessão',
		alert_threshold:
			'Parar e procurar atendimento: sangramento vaginal, perda de líquido, contração dolorosa regular, dor abdominal, dor de cabeça forte, alteração visual, dor na panturrilha ou inchaço assimétrico, falta de ar antes do esforço.',
		fonte:
			'ACOG Committee Opinion 804 — Physical Activity and Exercise During Pregnancy and the Postpartum Period (reafirmado 2024)'
	};
}

/** Os cuidados que valem pra este aluno, sem repetir parâmetro. */
export function cuidadosDoDia(conditionTags: string[]): CuidadoDoDia[] {
	const vistos = new Set<string>();
	const out: CuidadoDoDia[] = [];
	for (const c of [
		...CUIDADOS_GERAIS,
		...conditionTags.flatMap((t) => CUIDADOS_POR_TAG[t] ?? [])
	]) {
		const chave = c.parameter.toLowerCase();
		if (vistos.has(chave)) continue;
		vistos.add(chave);
		out.push(c);
	}
	return out;
}

/**
 * Garante que os cuidados estejam no monitoramento do plano.
 *
 * Não sobrescreve o que a IA escreveu: se ela já criou um parâmetro com o
 * mesmo nome, o dela fica e o nosso é descartado. O que a função impede é a
 * AUSÊNCIA, que é o caso em que o personal recebe o plano sem saber quando
 * não treinar.
 */
export function garanteCuidadosDoDia<
	T extends { parameter?: string; frequency?: string; alert_threshold?: string }
>(monitoring: T[], conditionTags: string[]): T[] {
	const existentes = new Set(
		(monitoring ?? []).map((m) => (m?.parameter ?? '').trim().toLowerCase()).filter(Boolean)
	);
	const faltando = cuidadosDoDia(conditionTags)
		.filter((c) => !existentes.has(c.parameter.toLowerCase()))
		.map(
			(c) =>
				({
					parameter: c.parameter,
					frequency: c.frequency,
					alert_threshold: c.alert_threshold,
					source_refs: [{ type: 'guideline', note: c.fonte }]
				}) as unknown as T
		);
	return [...(monitoring ?? []), ...faltando];
}
