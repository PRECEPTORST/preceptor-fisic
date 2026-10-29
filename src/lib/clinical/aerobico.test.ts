/**
 * A calculadora aeróbia. Os números conferidos aqui saem do Guia de
 * Treinamento Aeróbio (PreceptorFISIC, 2026) — mudou o guia, estes testes
 * têm que falhar.
 */
import { describe, it, expect } from 'vitest';
import {
	fcAlvoPorFcMax,
	fcAlvoPorFcr,
	fcMaxPorIdade,
	PROTOCOLOS,
	prescricaoAerobia,
	pseBorgPara0a10,
	zonaPorFcr
} from './aerobico';

describe('fórmulas', () => {
	it('FCmáx = 208 − 0,7 × idade, não 220 − idade', () => {
		expect(fcMaxPorIdade(68)).toBe(160); // 208 − 47.6 = 160.4
		expect(fcMaxPorIdade(30)).toBe(187); // 208 − 21 = 187
		expect(fcMaxPorIdade(20)).toBe(194);
		// A fórmula antiga daria 152 pra 68 anos. A diferença de 8 bpm é a
		// razão de o guia não usar 220 − idade.
		expect(fcMaxPorIdade(68)).not.toBe(220 - 68);
	});

	it('Karvonen: (FCmáx − FCrepouso) × % + FCrepouso', () => {
		// 68 anos, repouso 72: FCmáx 160, reserva 88. 40% → 35.2 + 72 = 107
		expect(fcAlvoPorFcr(160, 72, 40)).toBe(107);
		expect(fcAlvoPorFcr(160, 72, 59)).toBe(124);
	});

	it('método da FCmáx é só FCmáx × %', () => {
		expect(fcAlvoPorFcMax(160, 70)).toBe(112);
	});

	it('zonas da tabela do guia', () => {
		expect(zonaPorFcr(25)).toBe('Muito leve');
		expect(zonaPorFcr(35)).toBe('Leve');
		expect(zonaPorFcr(40)).toBe('Moderada');
		expect(zonaPorFcr(59)).toBe('Moderada');
		expect(zonaPorFcr(60)).toBe('Vigorosa');
		expect(zonaPorFcr(89)).toBe('Vigorosa');
		expect(zonaPorFcr(90)).toBe('Quase máxima a máxima');
	});

	it('Borg 6-20 vira PSE 0-10 pra bater com o resto do produto', () => {
		expect(pseBorgPara0a10(6)).toBe(0);
		expect(pseBorgPara0a10(13)).toBe(5);
		expect(pseBorgPara0a10(20)).toBe(10);
	});
});

const base = {
	idade: 68,
	fcRepouso: 72,
	conditionTags: ['populacao_geral'],
	usaBetabloqueador: false
};

describe('prescricaoAerobia — escolha do protocolo', () => {
	it('sem condição, cai na recomendação geral de adulto', () => {
		expect(prescricaoAerobia(base).condicao).toBe('Adulto (recomendação geral)');
	});

	it('hipertensão puxa o protocolo de HAS', () => {
		const p = prescricaoAerobia({ ...base, conditionTags: ['hipertensao_estagio_1'] });
		expect(p.condicao).toBe('Hipertensão arterial');
		expect(p.frequencia).toContain('5 a 7 dias');
	});

	it('cardiopatia vence hipertensão — a mais restritiva manda', () => {
		const p = prescricaoAerobia({
			...base,
			conditionTags: ['hipertensao_estagio_1', 'cardiopatia_isquemica']
		});
		expect(p.condicao).toContain('reabilitação cardíaca');
	});

	it('IC descompensada vence tudo e não prescreve', () => {
		const p = prescricaoAerobia({
			...base,
			conditionTags: ['ic_descompensada', 'hipertensao_estagio_1', 'diabetes_tipo_2']
		});
		expect(p.condicao).toBe('IC descompensada');
		expect(p.intensidade).toContain('não prescrever');
		expect(p.bpm).toBeNull();
	});

	it('HIV tem protocolo próprio', () => {
		const p = prescricaoAerobia({ ...base, conditionTags: ['hiv'] });
		expect(p.condicao).toBe('Pessoa vivendo com HIV');
		expect(p.volumeSemanal).toContain('150');
		expect(p.observacoes.join(' ')).toContain('progressiva');
	});
});

describe('prescricaoAerobia — a conta', () => {
	it('hipertenso de 68 anos, repouso 72: 40-59% FCR vira 107-124 bpm', () => {
		const p = prescricaoAerobia({ ...base, conditionTags: ['hipertensao_estagio_1'] });
		expect(p.fcMax).toBe(160);
		expect(p.bpm).toEqual({ min: 107, max: 124 });
		expect(p.intensidade).toContain('107-124 bpm');
		expect(p.semBpm).toBeNull();
	});

	it('a faixa de bpm cresce junto com a faixa de intensidade do protocolo', () => {
		const has = prescricaoAerobia({ ...base, conditionTags: ['hipertensao_estagio_1'] });
		const dm = prescricaoAerobia({ ...base, conditionTags: ['diabetes_tipo_2'] });
		// DM vai até 89% da FCR, HAS só até 59%
		expect(dm.bpm!.max).toBeGreaterThan(has.bpm!.max);
	});
});

describe('prescricaoAerobia — quando NÃO dá pra calcular bpm', () => {
	// Zona de FC errada é pior que zona nenhuma, porque parece precisa.
	it('betabloqueador zera o bpm e manda ir por PSE', () => {
		const p = prescricaoAerobia({
			...base,
			conditionTags: ['cardiopatia_isquemica'],
			usaBetabloqueador: true
		});
		expect(p.bpm).toBeNull();
		expect(p.semBpm).toBe('betabloqueador');
		expect(p.intensidade).toContain('PSE');
		expect(p.observacoes[0]).toContain('CARD-004');
	});

	it('sem idade não estima FCmáx', () => {
		const p = prescricaoAerobia({ ...base, idade: null });
		expect(p.fcMax).toBeNull();
		expect(p.bpm).toBeNull();
		expect(p.semBpm).toBe('sem_idade');
	});

	it('sem FC de repouso não dá Karvonen, e diz o que medir', () => {
		const p = prescricaoAerobia({ ...base, fcRepouso: null });
		expect(p.bpm).toBeNull();
		expect(p.semBpm).toBe('sem_fc_repouso');
		expect(p.observacoes.join(' ')).toContain('FC de repouso');
	});

	it('protocolo que não usa FC (gestante, idoso, DPOC) não devolve bpm', () => {
		for (const tag of ['gestante_segundo_trimestre', 'idoso_fragil', 'dpoc_moderada', 'crianca']) {
			const p = prescricaoAerobia({ ...base, conditionTags: [tag] });
			expect(p.bpm, `${tag} não deveria ter bpm`).toBeNull();
			expect(p.semBpm).toBe('metodo_nao_usa_fc');
		}
	});

	it('DAP para pela dor, não pela FC nem pelo relógio', () => {
		const p = prescricaoAerobia({ ...base, conditionTags: ['doenca_arterial_periferica'] });
		expect(p.intensidade).toContain('dor moderada');
		expect(p.observacoes.join(' ')).toContain('dor é o critério de parada');
	});
});

describe('prescricaoAerobia — sempre citável', () => {
	it('toda prescrição carrega a fonte e os quatro campos do FITT', () => {
		for (const tags of [
			['populacao_geral'],
			['hipertensao_estagio_1'],
			['hiv'],
			['gestante_segundo_trimestre'],
			['dpoc_grave'],
			['pos_avc']
		]) {
			const p = prescricaoAerobia({ ...base, conditionTags: tags });
			expect(p.fonte, `${tags}`).toContain('PreceptorFISIC');
			expect(p.frequencia.length, `frequência de ${tags}`).toBeGreaterThan(0);
			expect(p.intensidade.length, `intensidade de ${tags}`).toBeGreaterThan(0);
			expect(p.tempo.length, `tempo de ${tags}`).toBeGreaterThan(0);
			expect(p.tipo.length, `tipo de ${tags}`).toBeGreaterThan(0);
		}
	});
});

describe('ordem dos protocolos', () => {
	/**
	 * O primeiro protocolo que casa é o que vale, então a lista TEM que estar
	 * da condição mais restritiva para a mais geral. Eu errei isso na primeira
	 * versão: diabetes (teto de 89% da FCR) vinha antes de hipertensão (teto
	 * de 59%), e uma hipertensa diabética de 68 anos recebia zona até 150 bpm
	 * em vez de 124. Este teste é o que impede a ordem de voltar a quebrar.
	 */
	it('entre os protocolos crônicos, o teto de FCR só cresce', () => {
		// A parte de cima da lista (cardíaco, neuro, respiratório, DAP) tem
		// precedência clínica que não é só o teto numérico — por isso o
		// invariante vale da asma pra baixo, que é onde a escolha é por teto.
		const inicio = PROTOCOLOS.findIndex((p) => p.rotulo === 'Asma brônquica');
		const tetos = PROTOCOLOS.slice(inicio)
			// O último, o geral, fica de fora: ele só entra quando NENHUM outro
			// casou, então nunca disputa com os de cima.
			.filter((p) => p.fcr && p.tags.length > 0)
			.map((p) => ({ rotulo: p.rotulo, teto: p.fcr![1] }));

		for (let i = 1; i < tetos.length; i++) {
			expect(
				tetos[i]!.teto,
				`${tetos[i]!.rotulo} (teto ${tetos[i]!.teto}) não pode vir depois de ${tetos[i - 1]!.rotulo} (teto ${tetos[i - 1]!.teto}) com teto menor`
			).toBeGreaterThanOrEqual(tetos[i - 1]!.teto);
		}
	});

	it('o caso da Maria: hipertensa E diabética fica no teto da hipertensão', () => {
		const p = prescricaoAerobia({
			idade: 68,
			fcRepouso: 72,
			conditionTags: ['hipertensao_estagio_1', 'diabetes_tipo_2'],
			usaBetabloqueador: false
		});
		expect(p.condicao).toBe('Hipertensão arterial');
		expect(p.bpm).toEqual({ min: 107, max: 124 });
		// Sem o conserto saía 150 bpm, que é zona vigorosa pra uma hipertensa
		// sedentária de 68 anos.
		expect(p.bpm!.max).toBeLessThan(150);
	});

	it('o último protocolo é o geral, e casa com qualquer aluno', () => {
		const ultimo = PROTOCOLOS[PROTOCOLOS.length - 1]!;
		expect(ultimo.tags).toEqual([]);
		expect(ultimo.rotulo).toContain('geral');
	});
});
