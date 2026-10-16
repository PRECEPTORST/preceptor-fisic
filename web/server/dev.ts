// Entrada do servidor de desenvolvimento (vite dev): só /api passa por aqui.
// VITE_DEMO=1 troca a API real pela de fixtures (sem banco, sem sessão).
// Import dinâmico: no demo, o módulo do banco nem carrega.
const mod = process.env.VITE_DEMO === '1' ? await import('./demo/app').then((m) => m.demo) : await import('./app').then((m) => m.app);
export default mod;
