export type Exercise = {
	id: string;
	name: string;
	group: string;
	equip: string;
	level: string;
	pattern: string;
	uses: number;
};

export const EXERCISES: Exercise[] = [
	{
		id: 'EX001',
		name: 'Agachamento livre',
		group: 'Membros inferiores',
		equip: 'Barra',
		level: 'Avançado',
		pattern: 'Squat',
		uses: 312
	},
	{
		id: 'EX002',
		name: 'Agachamento goblet',
		group: 'Membros inferiores',
		equip: 'Halter',
		level: 'Iniciante',
		pattern: 'Squat',
		uses: 187
	},
	{
		id: 'EX003',
		name: 'Leg press 45°',
		group: 'Membros inferiores',
		equip: 'Máquina',
		level: 'Intermediário',
		pattern: 'Squat',
		uses: 245
	},
	{
		id: 'EX004',
		name: 'Cadeira extensora',
		group: 'Membros inferiores',
		equip: 'Máquina',
		level: 'Iniciante',
		pattern: 'Isolado',
		uses: 198
	},
	{
		id: 'EX005',
		name: 'Mesa flexora',
		group: 'Membros inferiores',
		equip: 'Máquina',
		level: 'Iniciante',
		pattern: 'Isolado',
		uses: 156
	},
	{
		id: 'EX006',
		name: 'Stiff com barra',
		group: 'Posterior',
		equip: 'Barra',
		level: 'Intermediário',
		pattern: 'Hinge',
		uses: 142
	},
	{
		id: 'EX007',
		name: 'Bom dia',
		group: 'Posterior',
		equip: 'Barra',
		level: 'Avançado',
		pattern: 'Hinge',
		uses: 78
	},
	{
		id: 'EX008',
		name: 'Levantamento terra',
		group: 'Posterior',
		equip: 'Barra',
		level: 'Avançado',
		pattern: 'Hinge',
		uses: 167
	},
	{
		id: 'EX009',
		name: 'Supino reto',
		group: 'Peito',
		equip: 'Barra',
		level: 'Intermediário',
		pattern: 'Push',
		uses: 289
	},
	{
		id: 'EX010',
		name: 'Supino inclinado halteres',
		group: 'Peito',
		equip: 'Halter',
		level: 'Intermediário',
		pattern: 'Push',
		uses: 234
	},
	{
		id: 'EX011',
		name: 'Crucifixo no banco',
		group: 'Peito',
		equip: 'Halter',
		level: 'Iniciante',
		pattern: 'Isolado',
		uses: 145
	},
	{
		id: 'EX012',
		name: 'Remada curvada',
		group: 'Costas',
		equip: 'Barra',
		level: 'Intermediário',
		pattern: 'Pull',
		uses: 256
	},
	{
		id: 'EX013',
		name: 'Puxada alta frente',
		group: 'Costas',
		equip: 'Polia',
		level: 'Iniciante',
		pattern: 'Pull',
		uses: 312
	},
	{
		id: 'EX014',
		name: 'Remada baixa neutra',
		group: 'Costas',
		equip: 'Polia',
		level: 'Iniciante',
		pattern: 'Pull',
		uses: 278
	},
	{
		id: 'EX015',
		name: 'Desenvolvimento militar',
		group: 'Ombros',
		equip: 'Barra',
		level: 'Avançado',
		pattern: 'Push',
		uses: 156
	},
	{
		id: 'EX016',
		name: 'Elevação lateral',
		group: 'Ombros',
		equip: 'Halter',
		level: 'Iniciante',
		pattern: 'Isolado',
		uses: 234
	},
	{
		id: 'EX017',
		name: 'Prancha frontal',
		group: 'Core',
		equip: 'Peso corporal',
		level: 'Iniciante',
		pattern: 'Anti-ext',
		uses: 423
	},
	{
		id: 'EX018',
		name: 'Dead bug',
		group: 'Core',
		equip: 'Peso corporal',
		level: 'Iniciante',
		pattern: 'Anti-ext',
		uses: 198
	},
	{
		id: 'EX019',
		name: 'Pallof press',
		group: 'Core',
		equip: 'Polia',
		level: 'Intermediário',
		pattern: 'Anti-rot',
		uses: 145
	},
	{
		id: 'EX020',
		name: 'Mobilidade · cat-cow',
		group: 'Mobilidade',
		equip: 'Solo',
		level: 'Iniciante',
		pattern: 'Mob',
		uses: 367
	}
];

export const EX_GROUPS = [
	'Todos',
	'Membros inferiores',
	'Posterior',
	'Peito',
	'Costas',
	'Ombros',
	'Core',
	'Mobilidade'
];
export const EX_EQUIP = ['Todos', 'Barra', 'Halter', 'Máquina', 'Polia', 'Peso corporal', 'Solo'];
