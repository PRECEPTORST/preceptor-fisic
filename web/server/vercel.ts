import { getRequestListener } from '@hono/node-server';
import { app } from './app';

// Handler (req, res) do runtime Node da Vercel. O build (scripts/build-api.mjs)
// empacota este arquivo em .vercel/output/functions/api.func.
export default getRequestListener(app.fetch);
