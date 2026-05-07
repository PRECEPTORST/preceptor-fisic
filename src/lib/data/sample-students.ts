// Dados mockados — usados na UI até o banco BR estar configurado.
// Substituir por queries Drizzle quando .env.local apontar pro Supabase.

export type SampleStudent = {
	id: number;
	name: string;
	age: number;
	goal: string;
	plan: string;
	adherence: number;
	sessions7: number;
	last: string;
	streak: number;
	status: 'active' | 'paused';
};

export const SAMPLE_STUDENTS: SampleStudent[] = [
	{
		id: 1,
		name: 'Ana Beatriz Silva',
		age: 34,
		goal: 'Hipertrofia',
		plan: 'Push/Pull/Legs · S2',
		adherence: 92,
		sessions7: 5,
		last: '5 mai',
		streak: 14,
		status: 'active'
	},
	{
		id: 2,
		name: 'Bruno Henrique',
		age: 28,
		goal: 'Performance',
		plan: 'Powerbuilding · S4',
		adherence: 88,
		sessions7: 4,
		last: '5 mai',
		streak: 22,
		status: 'active'
	},
	{
		id: 3,
		name: 'Camila Ferreira',
		age: 41,
		goal: 'Emagrecimento',
		plan: 'Full body 3x · S6',
		adherence: 76,
		sessions7: 3,
		last: '4 mai',
		streak: 8,
		status: 'active'
	},
	{
		id: 4,
		name: 'Diego Almeida',
		age: 26,
		goal: 'Reabilitação',
		plan: 'Pós-LCA · Fase 3',
		adherence: 95,
		sessions7: 5,
		last: '6 mai',
		streak: 36,
		status: 'active'
	},
	{
		id: 5,
		name: 'Eduarda Santos',
		age: 52,
		goal: 'Saúde geral',
		plan: 'Adapt · Fibromialgia',
		adherence: 71,
		sessions7: 2,
		last: '3 mai',
		streak: 4,
		status: 'active'
	},
	{
		id: 6,
		name: 'Felipe Cardoso',
		age: 67,
		goal: 'Reabilitação',
		plan: 'Cardiorrespiratório · S2',
		adherence: 84,
		sessions7: 3,
		last: '5 mai',
		streak: 11,
		status: 'active'
	},
	{
		id: 7,
		name: 'Giovanna Lima',
		age: 22,
		goal: 'Hipertrofia',
		plan: '— · pausado',
		adherence: 0,
		sessions7: 0,
		last: '12 abr',
		streak: 0,
		status: 'paused'
	},
	{
		id: 8,
		name: 'Henrique Rocha',
		age: 31,
		goal: 'Performance',
		plan: 'Push/Pull/Legs · S5',
		adherence: 90,
		sessions7: 4,
		last: '6 mai',
		streak: 18,
		status: 'active'
	}
];

export type Clinical = {
	medical: string[];
	meds: string[];
	limitations: string[];
	height: number;
	weight: number;
	bf: number;
	waist: number;
	lastWeight: number[];
};

export const CLINICAL: Record<number, Clinical> = {
	1: {
		medical: ['Hipertensão controlada', 'Asma leve'],
		meds: ['Losartana 50mg/dia', 'Bombinha SOS'],
		limitations: ['Lombalgia crônica leve'],
		height: 165,
		weight: 62.4,
		bf: 22.4,
		waist: 71,
		lastWeight: [64.1, 63.8, 63.5, 63.2, 62.9, 62.7, 62.5, 62.4]
	},
	2: {
		medical: [],
		meds: [],
		limitations: [],
		height: 178,
		weight: 78.1,
		bf: 14.2,
		waist: 82,
		lastWeight: [80.5, 80.0, 79.6, 79.2, 78.8, 78.5, 78.3, 78.1]
	},
	3: {
		medical: ['Diabetes tipo 2', 'Sobrepeso'],
		meds: ['Metformina 850mg 2x/dia'],
		limitations: ['Joelho direito · condromalácia'],
		height: 168,
		weight: 71.8,
		bf: 28.1,
		waist: 84,
		lastWeight: [74.2, 73.8, 73.4, 73.0, 72.6, 72.3, 72.0, 71.8]
	},
	4: {
		medical: [],
		meds: [],
		limitations: ['LCA rompido (joelho esq) · pós-cirúrgico 8 meses'],
		height: 182,
		weight: 82.5,
		bf: 16.0,
		waist: 84,
		lastWeight: [82.0, 82.1, 82.3, 82.4, 82.5, 82.5, 82.5, 82.5]
	},
	5: {
		medical: ['Fibromialgia'],
		meds: ['Pregabalina 75mg/noite'],
		limitations: ['Dor cervical', 'Limitação ombro direito'],
		height: 162,
		weight: 58.2,
		bf: 25.0,
		waist: 70,
		lastWeight: [58.5, 58.4, 58.4, 58.3, 58.3, 58.2, 58.2, 58.2]
	},
	6: {
		medical: ['Cardiopatia · stent 2023', 'Hipertensão'],
		meds: ['AAS 100mg', 'Atenolol 25mg'],
		limitations: ['Restrição cardiológica · FC máx 130bpm'],
		height: 175,
		weight: 91.4,
		bf: 27.5,
		waist: 98,
		lastWeight: [94.2, 93.8, 93.4, 92.9, 92.4, 92.0, 91.7, 91.4]
	},
	7: {
		medical: [],
		meds: [],
		limitations: [],
		height: 170,
		weight: 65.0,
		bf: 19.5,
		waist: 73,
		lastWeight: [65.3, 65.2, 65.1, 65.0, 65.0, 65.0, 65.0, 65.0]
	},
	8: {
		medical: ['Tendinopatia patelar bilateral'],
		meds: [],
		limitations: ['Evitar agachamentos profundos com carga máx'],
		height: 180,
		weight: 86.9,
		bf: 17.8,
		waist: 85,
		lastWeight: [85.2, 85.4, 85.7, 86.0, 86.3, 86.5, 86.7, 86.9]
	}
};

export const HIGH_RISK_KEYS = [
	'Cardiopatia',
	'Insuficiência',
	'AVC',
	'DPOC',
	'Diabetes tipo 1',
	'stent'
];
export const isHighRisk = (c: string) =>
	HIGH_RISK_KEYS.some((r) => c.toLowerCase().includes(r.toLowerCase()));
