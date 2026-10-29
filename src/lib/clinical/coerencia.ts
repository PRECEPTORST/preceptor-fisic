/**
 * Coerência entre o que o plano DIZ e o que o plano PRESCREVE.
 *
 * Num teste real, o resumo mandava começar entre 40% e 50% de 1RM e os
 * exercícios saíram com 50% a 60%. As duas partes são geradas em chamadas
 * diferentes (metadados numa, exercícios em outra, em paralelo), nenhuma vê o
 * texto da outra, e nada confere. O doutor só descobre lendo as duas pontas.
 *
 * Esta checagem é PURA e conservadora: só acusa quando o número do exercício
 * está fora da faixa que o próprio plano declarou, e a faixa é a UNIÃO de
 * tudo que o texto menciona. Assim "começar em 40-50% e progredir até 70%"
 * aceita qualquer coisa de 40 a 70, em vez de acusar a progressão.
 *
 * Não corrige nada: vira restrição amarela pro doutor decidir qual das duas
 * pontas está certa. Corrigir automaticamente exigiria saber a intenção
 * clínica, e isso é dele.
 */

export type Faixa = { min: number; max: number };

/**
 * Todas as porcentagens de 1RM citadas num texto, como faixa única.
 * Pega "40% de 1RM", "40-50% 1RM", "40 a 50% de 1RM".
 */
export function faixaPercent1RM(texto: string): Faixa | null {
	// Ancora na FRASE que menciona 1RM e pega todas as porcentagens dela.
	// Casar só o padrão "N% 1RM" perdia as formas que a IA de fato escreve:
	// "entre 40% e 50% de 1RM" (símbolo nos dois números, separador "e") e
	// "começar em 40-50% e progredir até 70% de 1RM" (a primeira faixa não
	// encosta no "1RM"). Fora da frase com 1RM nada é lido, então "progressão
	// de 5% semanal" numa frase vizinha não entra na conta.
	const nums: number[] = [];
	for (const frase of texto.split(/[.;\n]+/)) {
		if (!/1\s*RM/i.test(frase)) continue;
		// Faixa com o símbolo só no fim ("40-50%", "40 a 50%"): o primeiro
		// número não casa em `N%` e se perderia.
		for (const m of frase.matchAll(/(\d{1,3})\s*(?:[-–]|\ba\b)\s*(\d{1,3})\s*%/g)) {
			nums.push(Number(m[1]), Number(m[2]));
		}
		for (const m of frase.matchAll(/(\d{1,3})\s*%/g)) nums.push(Number(m[1]));
	}
	const validos = nums.filter((n) => n > 0 && n <= 100);
	if (validos.length === 0) return null;
	return { min: Math.min(...validos), max: Math.max(...validos) };
}

/** Mesma ideia para PSE. Aceita RPE por causa de planos antigos. */
export function faixaPse(texto: string): Faixa | null {
	const nums: number[] = [];
	for (const m of texto.matchAll(
		/(?:PSE|RPE)\s*(\d{1,2})(?:[.,]\d)?\s*(?:[-–]|a)\s*(\d{1,2})(?:[.,]\d)?/gi
	)) {
		nums.push(Number(m[1]), Number(m[2]));
	}
	for (const m of texto.matchAll(/(?:PSE|RPE)\s*(\d{1,2})(?:[.,]\d)?/gi)) nums.push(Number(m[1]));
	const validos = nums.filter((n) => n >= 0 && n <= 20);
	if (validos.length === 0) return null;
	return { min: Math.min(...validos), max: Math.max(...validos) };
}

export type ExercicioLido = { nome: string; texto: string };

export type Incoerencia = {
	metrica: '% 1RM' | 'PSE';
	declarado: Faixa;
	exercicios: Array<{ nome: string; valor: number }>;
};

/**
 * Compara a faixa declarada no texto do programa com o que cada exercício traz.
 *
 * Só acusa quem está FORA da faixa declarada. Exercício sem número na métrica
 * é ignorado: peso corporal e isometria legitimamente não têm % de 1RM.
 */
export function checarCoerencia(
	textoDoPrograma: string,
	exercicios: ExercicioLido[]
): Incoerencia[] {
	const achados: Incoerencia[] = [];

	for (const [metrica, extrai] of [
		['% 1RM', faixaPercent1RM],
		['PSE', faixaPse]
	] as const) {
		const declarado = extrai(textoDoPrograma);
		if (!declarado) continue;

		const fora: Array<{ nome: string; valor: number }> = [];
		for (const ex of exercicios) {
			const f = extrai(ex.texto);
			if (!f) continue;
			// Usa os dois extremos do exercício: "50-60% 1RM" com declarado
			// 40-50 acusa pelo 60, não pelo 50.
			for (const v of [f.min, f.max]) {
				if (v < declarado.min || v > declarado.max) {
					fora.push({ nome: ex.nome, valor: v });
					break;
				}
			}
		}

		if (fora.length > 0) achados.push({ metrica, declarado, exercicios: fora });
	}

	return achados;
}

/** Texto da restrição amarela, pronto pro plano. */
export function descreveIncoerencia(i: Incoerencia): string {
	const lista = i.exercicios
		.slice(0, 6)
		.map((e) => `${e.nome} (${e.valor}${i.metrica === '% 1RM' ? '%' : ''})`)
		.join('; ');
	const resto = i.exercicios.length > 6 ? ` e mais ${i.exercicios.length - 6}` : '';
	return `O programa declara ${i.declarado.min}${i.declarado.max !== i.declarado.min ? ` a ${i.declarado.max}` : ''}${i.metrica === '% 1RM' ? '% de 1RM' : ' de PSE'}, e há exercício prescrito fora dessa faixa: ${lista}${resto}. Conferir qual das duas pontas vale e alinhar antes de publicar.`;
}
