import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// maxDuration = teto da função na Vercel. 300s (máx do plano Pro) pra
		// a geração de plano TERMINAR completa mesmo em paciente complexo —
		// antes, com 60s, a IA não fechava o plano inteiro e caía em falha.
		// O `export const config` por rota só vale com adapter split; aqui o
		// adapter empacota tudo numa função só, então setamos global.
		// IMPORTANTE: 300 exige plano Vercel Pro. No Hobby o teto é 60 e o
		// deploy falha se passar disso — nesse caso, voltar pra 60.
		adapter: adapter({ regions: ['gru1'], runtime: 'nodejs22.x', maxDuration: 300 }),
		alias: {
			$lib: './src/lib'
		}
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
