/**
 * Prescrição aeróbia calculada em CÓDIGO, não escrita pela IA.
 *
 * Até aqui, a coluna "Intensidade" da tabela aeróbia era texto livre que o
 * modelo inventava, inclusive os bpm: saía coisa como "60-70%FCmáx
 * (150-167bpm)" sem nenhuma conta por trás, e sem olhar a condição do aluno.
 * Não existia fórmula de FCmáx em lugar nenhum do servidor.
 *
 * Fonte única: Guia de Treinamento Aeróbio — PreceptorFISIC (2026), da Anna,
 * já ingerido na base de conhecimento. Tabela de zonas, as duas fórmulas e o
 * FITT de quinze condições saem de lá, com os números deste arquivo copiados
 * do documento. Mudou o documento, mudar PROTOCOLOS aqui.
 *
 * Função PURA e client-safe (sem $lib/server), igual a `condition-tags.ts`:
 * a ficha do aluno pode mostrar a zona ao vivo com a mesma conta que o
 * gerador usa, sem risco de divergirem.
 */

/** FCmáx estimada por idade. Fórmula do guia, não a de 220 − idade. */
export function fcMaxPorIdade(idade: number): number {
	return Math.round(208 - 0.7 * idade);
}

/**
 * Método da FC de reserva (Karvonen):
 *   FC-alvo = (FCmáx − FCrepouso) × %intensidade + FCrepouso
 */
export function fcAlvoPorFcr(fcMax: number, fcRepouso: number, pct: number): number {
	return Math.round((fcMax - fcRepouso) * (pct / 100) + fcRepouso);
}

/** Método da FCmáx: FC-alvo = FCmáx × %intensidade. */
export function fcAlvoPorFcMax(fcMax: number, pct: number): number {
	return Math.round(fcMax * (pct / 100));
}

/**
 * Zonas de intensidade do guia. `pse` é na escala de Borg 6-20, que é a que o
 * documento usa nesta tabela (o resto do sistema usa PSE 0-10 — ver
 * `pseBorgPara0a10`).
 */
export const ZONAS = [
	{ nome: 'Muito leve', fcrMax: 29, fcMaxPct: 56, pse: '< 9' },
	{ nome: 'Leve', fcrMin: 30, fcrMax: 39, fcMaxPct: 63, pse: '9-11' },
	{ nome: 'Moderada', fcrMin: 40, fcrMax: 59, fcMaxPct: 76, pse: '12-13' },
	{ nome: 'Vigorosa', fcrMin: 60, fcrMax: 89, fcMaxPct: 95, pse: '14-17' },
	{ nome: 'Quase máxima a máxima', fcrMin: 90, fcMaxPct: 100, pse: '≥ 18' }
] as const;

export function zonaPorFcr(pct: number): string {
	if (pct < 30) return 'Muito leve';
	if (pct < 40) return 'Leve';
	if (pct < 60) return 'Moderada';
	if (pct < 90) return 'Vigorosa';
	return 'Quase máxima a máxima';
}

/**
 * Borg 6-20 → PSE 0-10, que é a escala que o resto do produto usa (o prompt
 * manda escrever "PSE x-y"). Conversão linear simples: (borg − 6) / 1.4.
 * Aproximação de exibição, não equivalência fisiológica — por isso a
 * prescrição carrega SEMPRE a escala junto do número.
 */
export function pseBorgPara0a10(borg: number): number {
	return Math.round(((borg - 6) / 1.4) * 10) / 10;
}

type Metodo = 'fcr' | 'pse_borg' | 'pse_0_10' | 'fc_repouso_mais' | 'carga_maxima' | 'dor';

export type Protocolo = {
	/** Tags da condition_taxonomy que acionam este protocolo. */
	tags: string[];
	rotulo: string;
	frequencia: string;
	/** Faixa em % da FC de reserva, quando o protocolo prescreve assim. */
	fcr?: [number, number];
	metodo: Metodo;
	intensidadeTexto: string;
	tempo: string;
	volumeSemanal?: string;
	tipo: string;
	observacoes?: string[];
};

/**
 * ORDEM IMPORTA: o primeiro protocolo cujas tags casarem é o que vale.
 * Está da condição mais restritiva para a mais geral, então aluno com
 * cardiopatia E hipertensão recebe o protocolo cardíaco, que é o mais
 * conservador dos dois. Nunca somar ou fazer média de dois protocolos: a
 * média de duas prescrições corretas não é uma prescrição correta.
 */
export const PROTOCOLOS: Protocolo[] = [
	{
		tags: ['ic_descompensada'],
		rotulo: 'IC descompensada',
		metodo: 'pse_borg',
		frequencia: 'não iniciar sem liberação cardiológica',
		intensidadeTexto: 'não prescrever até estabilização e liberação',
		tempo: '—',
		tipo: '—',
		observacoes: [
			'Contraindicação absoluta enquanto descompensada. A regra CARD-003 exige liberação médica.'
		]
	},
	{
		tags: ['ic_compensada'],
		rotulo: 'Insuficiência cardíaca compensada',
		metodo: 'fcr',
		fcr: [40, 50],
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto:
			'começar em 40-50% e progredir para 70-80% da FCR, titulando pelo esforço percebido',
		tempo: 'aumentar progressivamente para 20 a 60 min/dia',
		tipo: 'caminhada em esteira ou ao ar livre e bicicleta ergométrica',
		observacoes: [
			'Na presença de fibrilação atrial, usar SÓ percepção de esforço (Borg 11-14) ou teste da fala.'
		]
	},
	{
		tags: ['cardiopatia_isquemica', 'pos_iam'],
		rotulo: 'Doença cardiovascular em reabilitação cardíaca ambulatorial',
		metodo: 'fcr',
		fcr: [40, 80],
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto: '40 a 80% da capacidade de exercício (FCR), quando houver teste de esforço',
		tempo: '20 a 60 minutos',
		tipo: 'esteira, bicicleta vertical ou horizontal, elíptico, remo, ergômetro de braços, stepper',
		observacoes: [
			'SEM teste de esforço: usar FC de repouso + 20 a 30 bpm, ou PSE 12 a 16 na escala de 6 a 20.',
			'A regra CARD-001 limita a PSE em 7 (escala 0-10) para este grupo.'
		]
	},
	{
		tags: ['pos_avc'],
		rotulo: 'Pós-AVC',
		metodo: 'fcr',
		fcr: [40, 70],
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto: '40 a 70% da FCR, quando houver teste de esforço progressivo recente',
		tempo: 'aumentar progressivamente de 20 para 60 min/dia; considerar sessões de 10 min',
		tipo: 'bicicleta e stepper semirreclináveis; esteira se houver equilíbrio e marcha suficientes',
		observacoes: [
			'Sem teste de esforço, ou com fibrilação atrial, usar PSE 11 a 14 na escala de 6 a 20.'
		]
	},
	{
		tags: ['dpoc_leve', 'dpoc_moderada', 'dpoc_grave'],
		rotulo: 'DPOC',
		metodo: 'carga_maxima',
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto: '50 a 80% da taxa de trabalho máximo, ou 4 a 6 na escala CR10 de Borg',
		tempo:
			'20 a 60 min/dia conforme tolerado; se não alcançar, acumular ≥20 min intercalando repouso',
		tipo: 'caminhada livre ou em esteira, bicicleta estacionária, ergometria de membros superiores',
		observacoes: [
			'A regra DPOC-001 exige oximetria: suspender se SpO2 < 88% durante o esforço.',
			'DPOC grave: a regra DPOC-002 limita a PSE em 6 (escala 0-10).'
		]
	},
	{
		tags: ['doenca_arterial_periferica'],
		rotulo: 'Doença arterial periférica sintomática',
		metodo: 'dor',
		fcr: [40, 59],
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto:
			'moderada (40 a 59% do VO2R) até o ponto de dor moderada (3 de 4 na escala de claudicação), ou 50 a 80% da velocidade máxima de caminhada',
		tempo: '30 a 45 min/dia excluindo descansos, por no mínimo 12 semanas; pode progredir até 60',
		tipo: 'caminhada com descarga de peso, parando no ponto de dor moderada e retomando quando aliviar',
		observacoes: ['A dor é o critério de parada, não o relógio nem a FC.']
	},
	{
		tags: [
			'gestante_primeiro_trimestre',
			'gestante_segundo_trimestre',
			'gestante_terceiro_trimestre'
		],
		rotulo: 'Gestante',
		metodo: 'pse_0_10',
		frequencia: 'distribuídos ao longo da semana',
		intensidadeTexto:
			'leve a moderada, PSE 5 a 6 na escala de 0 a 10, com teste da fala preservado',
		tempo: '≥ 150 min/semana',
		volumeSemanal: '≥ 150 min/semana',
		tipo: 'caminhada, natação, bicicleta estacionária, aeróbio de baixo impacto',
		observacoes: [
			'Quem já praticava atividade vigorosa pode manter, se seguir saudável e de acordo com o médico.'
		]
	},
	{
		tags: ['asma'],
		rotulo: 'Asma brônquica',
		metodo: 'fcr',
		fcr: [40, 59],
		frequencia: 'mínimo 3 dias/semana, preferencialmente até 5',
		intensidadeTexto:
			'começar moderada (40 a 59% da FCR); se bem tolerada, progredir para 60 a 70% depois de 1 mês',
		tempo: 'aumentar progressivamente para pelo menos 30 a 40 min/dia',
		tipo: 'caminhada, corrida, ciclismo, natação ou exercícios em piscina',
		observacoes: []
	},
	{
		tags: ['hipertensao_estagio_1', 'hipertensao_estagio_2', 'hipertensao_nao_controlada'],
		rotulo: 'Hipertensão arterial',
		metodo: 'fcr',
		fcr: [40, 59],
		frequencia: '5 a 7 dias/semana',
		intensidadeTexto: 'moderada: 40 a 59% da FCR, ou PSE 12 a 13 na escala de 6 a 20',
		tempo: '≥ 30 min/dia, contínuo ou acumulado',
		tipo: 'atividades rítmicas de grandes grupos (caminhar, pedalar, nadar)',
		observacoes: ['A regra HTA-003 exige PA pré e pós-sessão.']
	},
	{
		tags: ['hiv'],
		rotulo: 'Pessoa vivendo com HIV',
		metodo: 'fcr',
		fcr: [40, 60],
		frequencia: '3 a 5 dias/semana',
		intensidadeTexto: 'leve a moderada: 40 a 60% da FCR, ou PSE 3 a 5 na escala de 0 a 10',
		tempo: '20 a 60 min/sessão, contínuo ou fracionado',
		volumeSemanal: '≥ 150 min/semana, de forma progressiva',
		tipo: 'caminhada, bicicleta ergométrica, elíptico, natação adaptada',
		observacoes: [
			'A meta de 150 min/semana é progressiva, não exigência imediata para pessoa debilitada.',
			'Regularidade importa mais que intensidade elevada.'
		]
	},
	{
		tags: ['dislipidemia'],
		rotulo: 'Dislipidemia',
		metodo: 'fcr',
		fcr: [40, 75],
		frequencia: '≥ 5 dias/semana, para maximizar o gasto calórico',
		intensidadeTexto: '40 a 75% da FCR',
		tempo: '30 a 60 min/dia; 50 a 60 min ou mais para promover ou manter perda de massa corporal',
		tipo: 'atividades rítmicas de grandes grupos (caminhar, pedalar, nadar)',
		observacoes: []
	},
	// Diabetes vai DEPOIS da hipertensão de propósito: sozinho ele permite até
	// 89% da FCR, e hipertensão limita em 59%. Aluno com as duas (que é o caso
	// comum) tem que receber o teto da hipertensão. Ordenar errado aqui fazia
	// uma hipertensa de 68 anos receber zona até 150 bpm em vez de 124.
	{
		tags: ['diabetes_tipo_1', 'diabetes_tipo_2', 'diabetes_descompensado'],
		rotulo: 'Diabetes mellitus',
		metodo: 'fcr',
		fcr: [40, 89],
		frequencia: '3 a 7 dias/semana, sem passar 2 dias consecutivos sem atividade',
		intensidadeTexto: 'moderada a vigorosa (40 a 89% da FCR)',
		tempo: '150 min/semana em intensidade moderada a vigorosa',
		volumeSemanal: '150 min/semana',
		tipo: 'atividades rítmicas de grandes grupos (caminhada, ciclismo, natação), contínuo ou HIIT',
		observacoes: [
			'A regra DM-001 exige glicemia pré-treino: suspender se < 100 mg/dL sem ingestão de carboidrato.'
		]
	},
	{
		tags: ['idoso_fragil', 'sarcopenia', 'idoso_robusto'],
		rotulo: 'Idoso',
		metodo: 'pse_0_10',
		frequencia: '≥ 5 dias/semana moderada, ≥ 3 vigorosa, 3 a 5 combinando as duas',
		intensidadeTexto: 'PSE 5 a 6 (moderada) ou 7 a 8 (vigorosa), na escala de 0 a 10',
		tempo: '30 a 60 min/dia moderada, 20 a 30 min vigorosa; pode acumular ao longo do dia',
		tipo: 'modalidade sem estresse ortopédico excessivo; aquático e bicicleta estacionária quando a tolerância à descarga de peso for limitada',
		observacoes: []
	},
	{
		tags: ['crianca', 'adolescente'],
		rotulo: 'Criança e adolescente',
		metodo: 'pse_0_10',
		frequencia: 'diariamente, com vigorosa pelo menos 3 dias/semana',
		intensidadeTexto: 'moderada (aumento perceptível de FC e FR) a vigorosa (aumento substancial)',
		tempo: 'como parte de ≥ 60 min/dia de atividade física',
		tipo: 'atividades agradáveis e apropriadas ao desenvolvimento: pega-pega, caminhada rápida, saltos, corda, natação, dança, ciclismo, esportes',
		observacoes: []
	},
	{
		tags: [],
		rotulo: 'Adulto (recomendação geral)',
		metodo: 'fcr',
		fcr: [40, 59],
		frequencia: 'pelo menos 3 dias/semana; 3 a 5 é a estratégia mais propícia',
		intensidadeTexto: 'moderada (40 a 59% da FCR) e/ou vigorosa (60 a 89%)',
		tempo: '30 a 60 min/dia moderada (≥150 min/sem) ou 20 a 60 min vigorosa (≥75 min/sem)',
		volumeSemanal: '≥ 150 min/semana moderada, ou ≥ 75 min/semana vigorosa',
		tipo: 'aeróbio contínuo ou intermitente envolvendo grandes grupos musculares',
		observacoes: []
	}
];

export type EntradaAerobia = {
	idade: number | null;
	/** FC de repouso medida na avaliação física. Sem ela, não dá Karvonen. */
	fcRepouso: number | null;
	conditionTags: string[];
	/** Ver `usaBetabloqueador`. Achata a FC e invalida a zona calculada. */
	usaBetabloqueador: boolean;
};

export type PrescricaoAerobia = {
	condicao: string;
	frequencia: string;
	intensidade: string;
	/** Faixa de bpm, quando foi possível E é válido calcular. */
	bpm: { min: number; max: number } | null;
	fcMax: number | null;
	tempo: string;
	volumeSemanal: string | null;
	tipo: string;
	observacoes: string[];
	/** Por que não saiu bpm. `null` quando saiu. */
	semBpm: 'betabloqueador' | 'sem_idade' | 'sem_fc_repouso' | 'metodo_nao_usa_fc' | null;
	fonte: string;
};

const FONTE = 'Guia de Treinamento Aeróbio — PreceptorFISIC (2026)';

function escolheProtocolo(tags: string[]): Protocolo {
	for (const p of PROTOCOLOS) {
		if (p.tags.length === 0) return p;
		if (p.tags.some((t) => tags.includes(t))) return p;
	}
	return PROTOCOLOS[PROTOCOLOS.length - 1]!;
}

/**
 * Monta a prescrição aeróbia. Nunca inventa bpm: quando falta idade, falta FC
 * de repouso, o protocolo não usa FC, ou o aluno usa betabloqueador, devolve
 * `bpm: null` e diz o motivo em `semBpm`. Zona de FC errada é pior que zona
 * nenhuma, porque parece precisa.
 */
export function prescricaoAerobia(e: EntradaAerobia): PrescricaoAerobia {
	const p = escolheProtocolo(e.conditionTags);
	const fcMax = e.idade != null && e.idade > 0 ? fcMaxPorIdade(e.idade) : null;
	const observacoes = [...(p.observacoes ?? [])];

	let bpm: PrescricaoAerobia['bpm'] = null;
	let semBpm: PrescricaoAerobia['semBpm'] = null;
	let intensidade = p.intensidadeTexto;

	if (e.usaBetabloqueador) {
		semBpm = 'betabloqueador';
		intensidade = `${p.intensidadeTexto} — PRESCREVER POR PSE OU TESTE DA FALA`;
		observacoes.unshift(
			'Betabloqueador em uso: a FC não reflete o esforço, então a zona por FC não vale. Prescrever por percepção de esforço ou teste da fala. Monitorar a FC segue indicado, como acompanhamento (regra CARD-004).'
		);
	} else if (!p.fcr || p.metodo === 'pse_borg' || p.metodo === 'pse_0_10') {
		semBpm = 'metodo_nao_usa_fc';
	} else if (fcMax == null) {
		semBpm = 'sem_idade';
		observacoes.push('Sem data de nascimento no cadastro não dá para estimar a FCmáx.');
	} else if (e.fcRepouso == null || e.fcRepouso <= 0) {
		semBpm = 'sem_fc_repouso';
		observacoes.push(
			'Sem FC de repouso na avaliação física não dá para usar Karvonen. Medir em repouso sentado para a zona sair em bpm.'
		);
	} else {
		const [min, max] = p.fcr;
		bpm = {
			min: fcAlvoPorFcr(fcMax, e.fcRepouso, min),
			max: fcAlvoPorFcr(fcMax, e.fcRepouso, max)
		};
		intensidade = `${p.intensidadeTexto} — ${min}-${max}% FCR = ${bpm.min}-${bpm.max} bpm (${zonaPorFcr(min)} a ${zonaPorFcr(max)})`;
	}

	return {
		condicao: p.rotulo,
		frequencia: p.frequencia,
		intensidade,
		bpm,
		fcMax,
		tempo: p.tempo,
		volumeSemanal: p.volumeSemanal ?? null,
		tipo: p.tipo,
		observacoes,
		semBpm,
		fonte: FONTE
	};
}
