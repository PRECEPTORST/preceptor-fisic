import { describe, it, expect } from 'vitest';
import { deriveTagsFromDiagnosisLabels } from './condition-tags';

describe('deriveTagsFromDiagnosisLabels — estadiação da hipertensão', () => {
	it('"hipertensão grau II" → estágio 2', () => {
		expect(deriveTagsFromDiagnosisLabels(['hipertensão grau II'])).toContain(
			'hipertensao_estagio_2'
		);
	});
	it('"HAS grau 2" → estágio 2', () => {
		expect(deriveTagsFromDiagnosisLabels(['HAS grau 2'])).toContain('hipertensao_estagio_2');
	});
	it('"hipertensão estágio 2" → estágio 2', () => {
		expect(deriveTagsFromDiagnosisLabels(['hipertensão estágio 2'])).toContain(
			'hipertensao_estagio_2'
		);
	});
	it('"hipertensão grau I" → estágio 1', () => {
		const tags = deriveTagsFromDiagnosisLabels(['hipertensão grau I']);
		expect(tags).toContain('hipertensao_estagio_1');
		expect(tags).not.toContain('hipertensao_estagio_2');
	});
	it('"HAS" genérico → estágio 1', () => {
		expect(deriveTagsFromDiagnosisLabels(['HAS'])).toContain('hipertensao_estagio_1');
	});
	it('não confunde "Hashimoto" com hipertensão', () => {
		expect(deriveTagsFromDiagnosisLabels(['tireoidite de Hashimoto'])).not.toContain(
			'hipertensao_estagio_1'
		);
	});
});

describe('deriveTagsFromDiagnosisLabels — tags que as regras clínicas esperam', () => {
	// As regras comparam o nome da tag por igualdade exata. Enquanto a derivação
	// devolvia só `dpoc_moderada` e `gestante_segundo_trimestre`, as regras
	// DPOC-002 (dpoc_grave) e GEST-002 (primeiro trimestre) nunca disparavam.
	it('DPOC grave → dpoc_grave, que é o que DPOC-002 procura', () => {
		expect(deriveTagsFromDiagnosisLabels(['DPOC grave'])).toContain('dpoc_grave');
	});
	it('DPOC leve → dpoc_leve', () => {
		const tags = deriveTagsFromDiagnosisLabels(['DPOC leve']);
		expect(tags).toContain('dpoc_leve');
		expect(tags).not.toContain('dpoc_moderada');
	});
	it('DPOC sem gravidade no label → moderada', () => {
		expect(deriveTagsFromDiagnosisLabels(['enfisema pulmonar'])).toContain('dpoc_moderada');
	});
	it('gestante sem trimestre → segundo, o mais restritivo dos dois primeiros', () => {
		expect(deriveTagsFromDiagnosisLabels(['gestante'])).toContain('gestante_segundo_trimestre');
	});
	it('gestante 1º trimestre → primeiro trimestre, e não o segundo', () => {
		const tags = deriveTagsFromDiagnosisLabels(['gestante 1º trimestre']);
		expect(tags).toContain('gestante_primeiro_trimestre');
		expect(tags).not.toContain('gestante_segundo_trimestre');
	});
	it('gestante 3º trimestre → terceiro trimestre', () => {
		expect(deriveTagsFromDiagnosisLabels(['gravidez 3o trimestre'])).toContain(
			'gestante_terceiro_trimestre'
		);
	});
	it('toda tag derivada é nome canônico da taxonomia', () => {
		// Lista da condition_taxonomy em produção (41 tags). O que a derivação
		// produz fora dela é tag que nenhuma regra alcança.
		const CANONICAS = new Set([
			'cardiopatia_isquemica',
			'dislipidemia',
			'fibrilacao_atrial',
			'hipertensao_estagio_1',
			'hipertensao_estagio_2',
			'hipertensao_nao_controlada',
			'ic_compensada',
			'ic_descompensada',
			'pcd',
			'idoso_fragil',
			'idoso_robusto',
			'sarcopenia',
			'populacao_geral',
			'gestante_primeiro_trimestre',
			'gestante_segundo_trimestre',
			'gestante_terceiro_trimestre',
			'doenca_hepatica_compensada',
			'doenca_hepatica_descompensada',
			'diabetes_descompensado',
			'diabetes_tipo_1',
			'diabetes_tipo_2',
			'obesidade_grau_1',
			'obesidade_grau_2',
			'obesidade_grau_3',
			'esclerose_multipla',
			'parkinson_leve',
			'parkinson_moderada',
			'pos_avc',
			'cancer_em_tratamento',
			'pos_cancer',
			'dor_lombar_cronica',
			'lca_pos_cirurgico',
			'lca_tratamento_conservador',
			'osteoartrite_joelho',
			'osteoartrite_quadril',
			'tendinopatia_patelar',
			'adolescente',
			'crianca',
			'dpoc_grave',
			'dpoc_leve',
			'dpoc_moderada'
		]);
		const labels = [
			'hipertensão grau II',
			'diabetes tipo 2',
			'DPOC grave',
			'DPOC leve',
			'bronquite crônica',
			'gestante',
			'gestante 1º trimestre',
			'gravidez 3o trimestre',
			'pós-AVC',
			'Parkinson',
			'esclerose múltipla',
			'idoso frágil',
			'LCA pós-cirúrgico',
			'osteoartrite de joelho',
			'artrose quadril',
			'lombalgia crônica',
			'obesidade mórbida',
			'obesidade',
			'câncer de mama',
			'dislipidemia',
			'insuficiência cardíaca',
			'infarto prévio',
			'DHGNA'
		];
		for (const t of deriveTagsFromDiagnosisLabels(labels)) {
			expect(CANONICAS, `tag "${t}" não existe na taxonomia`).toContain(t);
		}
	});
});

describe('deriveTagsFromDiagnosisLabels — HIV', () => {
	// HIV não existia no sistema: sem tag, sem regra, sem fonte. O aluno
	// declarava e nada disparava, com o plano saindo como se ele não tivesse
	// a condição. No fluxo do aluno direto o doutor é o único filtro, então
	// condição não reconhecida passa silenciosa.
	it.each([
		'HIV',
		'hiv+',
		'Pessoa vivendo com HIV',
		'AIDS',
		'soropositivo',
		'em uso de TARV',
		'terapia antirretroviral'
	])('reconhece "%s"', (l) => {
		expect(deriveTagsFromDiagnosisLabels([l])).toContain('hiv');
	});

	it.each(['hives', 'tireoidite de Hashimoto', 'dor na virilha', 'fratura consolidada', 'artrose'])(
		'não marca "%s" como HIV',
		(l) => {
			expect(deriveTagsFromDiagnosisLabels([l])).not.toContain('hiv');
		}
	);

	it('convive com outras condições no mesmo aluno', () => {
		const tags = deriveTagsFromDiagnosisLabels(['HIV', 'hipertensão estágio 1', 'dislipidemia']);
		expect(tags).toContain('hiv');
		expect(tags).toContain('hipertensao_estagio_1');
		expect(tags).toContain('dislipidemia');
	});
});

describe('deriveTagsFromDiagnosisLabels — gravidade e estágio que se perdiam', () => {
	// Seis tags da taxonomia nunca eram atribuídas, então regra escrita pra
	// elas jamais dispararia. E duas classificações estavam ERRADAS em
	// direções opostas.

	it('sobrevivente em remissão NÃO é câncer em tratamento', () => {
		// O erro mais caro: a ONC-001 limita a PSE em 6, o que travaria um
		// sobrevivente saudável na intensidade leve para sempre.
		const t = deriveTagsFromDiagnosisLabels(['sobrevivente de câncer, em remissão']);
		expect(t).toContain('pos_cancer');
		expect(t).not.toContain('cancer_em_tratamento');
	});

	it('câncer em tratamento continua sendo tratamento', () => {
		const t = deriveTagsFromDiagnosisLabels(['câncer de mama em quimioterapia']);
		expect(t).toContain('cancer_em_tratamento');
		expect(t).not.toContain('pos_cancer');
	});

	it('LCA sem cirurgia NÃO é pós-cirúrgico', () => {
		// Sem data de cirurgia, lca_pos_cirurgico joga o aluno na fase 0-6
		// meses: regra VERMELHA proibindo salto em quem nunca operou.
		const t = deriveTagsFromDiagnosisLabels(['ruptura de LCA sem cirurgia']);
		expect(t).toContain('lca_tratamento_conservador');
		expect(t).not.toContain('lca_pos_cirurgico');
	});

	it('reconstrução de LCA continua pós-cirúrgica', () => {
		expect(deriveTagsFromDiagnosisLabels(['reconstrução de LCA'])).toContain('lca_pos_cirurgico');
	});

	it.each([
		['obesidade grau II', 'obesidade_grau_2'],
		['obesidade classe 2', 'obesidade_grau_2'],
		['obesidade grau III', 'obesidade_grau_3'],
		['obesidade mórbida', 'obesidade_grau_3'],
		['obesidade', 'obesidade_grau_1']
	])('"%s" → %s', (label, esperado) => {
		expect(deriveTagsFromDiagnosisLabels([label])).toContain(esperado);
	});

	it('os três graus de obesidade são mutuamente exclusivos', () => {
		for (const l of ['obesidade grau II', 'obesidade grau III', 'obesidade']) {
			const graus = deriveTagsFromDiagnosisLabels([l]).filter((t) => t.startsWith('obesidade_'));
			expect(graus, `"${l}" gerou ${graus.join(' + ')}`).toHaveLength(1);
		}
	});

	it('Parkinson moderado não vira leve', () => {
		const t = deriveTagsFromDiagnosisLabels(['Parkinson moderado']);
		expect(t).toContain('parkinson_moderada');
		expect(t).not.toContain('parkinson_leve');
	});

	it('diabetes descompensado ACUMULA com o tipo', () => {
		const t = deriveTagsFromDiagnosisLabels(['diabetes tipo 2 descompensado']);
		expect(t).toContain('diabetes_tipo_2');
		expect(t).toContain('diabetes_descompensado');
	});

	it.each([
		['fibrilação atrial', 'fibrilacao_atrial'],
		['deficiência física', 'pcd'],
		['amputação transtibial', 'pcd'],
		['tendinopatia patelar', 'tendinopatia_patelar'],
		['cirrose descompensada', 'doenca_hepatica_descompensada'],
		['esteatose hepática', 'doenca_hepatica_compensada']
	])('"%s" → %s', (label, esperado) => {
		expect(deriveTagsFromDiagnosisLabels([label])).toContain(esperado);
	});

	it('hepática descompensada exclui a compensada', () => {
		const t = deriveTagsFromDiagnosisLabels(['cirrose descompensada com ascite']);
		expect(t).toContain('doenca_hepatica_descompensada');
		expect(t).not.toContain('doenca_hepatica_compensada');
	});
});
