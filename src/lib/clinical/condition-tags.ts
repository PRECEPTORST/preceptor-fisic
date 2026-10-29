/**
 * Derivação de tags de condição canônicas a partir de labels de diagnóstico.
 *
 * Fonte ÚNICA dos regexes de derivação — consumida pelo generator
 * (deriveConditionTags), pela revalidação em planos/[id]/+page.server.ts, pelo
 * motor de risco CV e pelo cálculo ao vivo no cadastro de aluno. Função PURA e
 * client-safe (sem imports de $lib/server) — por isso vive em $lib/clinical.
 * CONTRATO estável: deriveTagsFromDiagnosisLabels(labels: string[]): string[].
 * Retorna SÓ as tags derivadas (pode ser vazio) — default populacao_geral é
 * responsabilidade do chamador.
 *
 * Word boundaries importantes: \bhas\b (senão "Hashimoto" vira hipertensão)
 * e \blca\b (senão "calcaneo" digitado sem acento vira LCA pós-cirúrgico).
 */
export function deriveTagsFromDiagnosisLabels(labels: string[]): string[] {
	const tags = new Set<string>();
	for (const raw of labels) {
		const label = (raw ?? '').toLowerCase();
		if (!label) continue;
		if (/hipertens|press[aã]o alta|\bhas\b/.test(label)) {
			// Severidade pode vir embutida no label (o generator anexa "(grave)").
			// Estágio 2 = "estágio 2/II" OU "grau 2/II" (fraseado comum no Brasil).
			tags.add(
				/\bgrave\b|est[aá]gio\s*(2|ii)\b|grau\s*(2|ii)\b/.test(label)
					? 'hipertensao_estagio_2'
					: 'hipertensao_estagio_1'
			);
		}
		// Um label genérico "diabetes" casava nas DUAS regras → marcava o aluno
		// como tipo 1 E tipo 2 ao mesmo tempo (contraindicações conflitantes).
		// Tipo só quando explícito; diabetes genérico → tipo 2 (~90% dos casos).
		if (/diabetes|diabet|\bdm\b|dm[12]|dm [12]/.test(label)) {
			const isDm1 = /dm1|dm 1|tipo 1|tipo i\b/.test(label);
			const isDm2 = /dm2|dm 2|tipo 2|tipo ii\b/.test(label);
			if (isDm1) tags.add('diabetes_tipo_1');
			if (isDm2 || !isDm1) tags.add('diabetes_tipo_2');
			// Descompensado ACUMULA com o tipo, não substitui: o tipo define a
			// conduta de base e a descompensação acrescenta cautela. Antes essa
			// informação estava no label e o sistema jogava fora.
			if (
				/descompensad|descontrolad|mal\s*controlad|hba1c\s*(>|acima|maior)|cetoacidose/.test(label)
			)
				tags.add('diabetes_descompensado');
		}
		if (/cardiopat|coronar|iam|infarto|dac/.test(label)) tags.add('cardiopatia_isquemica');
		if (/insufici[eê]ncia card|icc/.test(label)) tags.add('ic_compensada');
		// Severidade importa: a regra DPOC-002 (sem alta intensidade) só vale pro
		// grave, e antes NINGUÉM recebia `dpoc_grave` — qualquer label pulmonar
		// virava moderada, então a regra nunca disparava pra ninguém.
		if (/dpoc|enfisema|bronquite|pulmona/.test(label)) {
			if (/\bgrave\b|grau\s*(4|iv)\b|est[aá]gio\s*(4|iv)\b|avan[çc]ad/.test(label))
				tags.add('dpoc_grave');
			else if (/\bleve\b|grau\s*(1|i)\b|est[aá]gio\s*(1|i)\b/.test(label)) tags.add('dpoc_leve');
			else tags.add('dpoc_moderada');
		}
		// \bhiv\b e \baids\b com borda: senão "HIVES" ou um nome próprio com
		// "aids" dentro marcariam o aluno como soropositivo. "sida" fica de
		// fora de propósito: é palavra comum demais em português (sofrida,
		// comprimida, guarida) e o ganho não paga o falso positivo num dado
		// desta sensibilidade. TARV e antirretroviral vêm do campo de
		// medicamentos, que o generator anexa aos labels.
		if (/\bhiv\b|\baids\b|\btarv\b|antirretroviral|soropositiv/.test(label)) tags.add('hiv');
		if (/avc|acidente vascular/.test(label)) tags.add('pos_avc');
		// Antes, "Parkinson moderado" virava parkinson_leve: o estágio estava no
		// label e a derivação ignorava, marcando a pessoa como menos grave do
		// que é. Hoehn & Yahr 3+ já tem instabilidade postural.
		if (/parkinson/.test(label)) {
			tags.add(
				/moderad|avan[çc]ad|est[aá]gio\s*(3|4|5|iii|iv|v)\b|h&y\s*(3|4|5)|instabilidade postural/.test(
					label
				)
					? 'parkinson_moderada'
					: 'parkinson_leve'
			);
		}
		if (/esclerose m/.test(label)) tags.add('esclerose_multipla');
		// FA só com "atrial" junto: \bfa\b sozinho casaria com "fa" de qualquer
		// abreviação e com "FA" de nome próprio.
		if (/fibrila[çc][aã]o\s*atrial|\bfa\s*cr[oô]nica\b|\bfibrila[çc][aã]o\b/.test(label))
			tags.add('fibrilacao_atrial');
		if (
			/defici[êe]ncia\s*(f[íi]sica|intelectual|visual|auditiva|m[úu]ltipla)|\bpcd\b|amputa[çc]|cadeirante|paraplegi|tetraplegi|para\s*atleta/.test(
				label
			)
		)
			tags.add('pcd');
		// Trimestre quando o label disser; sem informação, assume o segundo, que é
		// o mais restritivo dos dois primeiros (GEST-001 já vale a partir dele).
		if (/gestante|gr[aá]vid|gravidez|gesta[çc][aã]o/.test(label)) {
			if (/\b(1|1º|1o|i|primeiro)\s*tri/.test(label)) tags.add('gestante_primeiro_trimestre');
			else if (/\b(3|3º|3o|iii|terceiro)\s*tri/.test(label))
				tags.add('gestante_terceiro_trimestre');
			else tags.add('gestante_segundo_trimestre');
		}
		if (/idoso|fr[aá]gil|sarcopen/.test(label)) tags.add('idoso_fragil');
		// Tratamento conservador NÃO é pós-cirúrgico. Antes, "ruptura de LCA sem
		// cirurgia" caía em lca_pos_cirurgico e, como não há data de cirurgia,
		// o aluno ficava na fase 0-6 meses: regra VERMELHA bloqueando salto e
		// pliometria em alguém que nunca operou.
		if (/\blca\b|cruzado/.test(label)) {
			tags.add(
				/conservador|sem\s*cirurgia|n[aã]o\s*(operat[oó]ri|cir[uú]rgic)|incruent/.test(label)
					? 'lca_tratamento_conservador'
					: 'lca_pos_cirurgico'
			);
		}
		if (/tendinopatia\s*patelar|tendinite\s*patelar|joelho\s*de\s*saltador|jumper/.test(label))
			tags.add('tendinopatia_patelar');
		if (/osteoartr|artrose joelho/.test(label)) tags.add('osteoartrite_joelho');
		if (/osteoartr.*quadril|artrose quadril/.test(label)) tags.add('osteoartrite_quadril');
		if (/dor lombar|lombalgia/.test(label)) tags.add('dor_lombar_cronica');
		// Os três graus. Antes só existiam o 1 e o 3, então "obesidade grau II"
		// virava grau I — um degrau abaixo do que a pessoa tem.
		if (/obesidade|obeso|obesa/.test(label)) {
			if (/\biii\b|grau\s*3|classe\s*3|m[oó]rbida/.test(label)) tags.add('obesidade_grau_3');
			else if (/\bii\b|grau\s*2|classe\s*2/.test(label)) tags.add('obesidade_grau_2');
			else tags.add('obesidade_grau_1');
		}
		// Quem terminou o tratamento não pode carregar a restrição de quem está
		// em quimio: a ONC-001 limita a PSE em 6, e isso travaria um
		// sobrevivente saudável na intensidade leve pra sempre.
		if (/c[aâ]ncer|oncolog|neoplasia|tumor/.test(label)) {
			tags.add(
				/remiss[aã]o|sobreviv|p[oó]s[\s-]*(c[aâ]ncer|tratamento)|curad|em\s*seguimento|livre\s*de\s*doen[çc]a/.test(
					label
				)
					? 'pos_cancer'
					: 'cancer_em_tratamento'
			);
		}
		if (/dislipid|colesterol/.test(label)) tags.add('dislipidemia');
		if (/dhgna|hep[aá]ti|cirrose/.test(label)) {
			tags.add(
				/descompensad|child[\s-]*pugh\s*[bc]|ascite|encefalopatia|varizes\s*esof/.test(label)
					? 'doenca_hepatica_descompensada'
					: 'doenca_hepatica_compensada'
			);
		}
	}
	return Array.from(tags);
}
