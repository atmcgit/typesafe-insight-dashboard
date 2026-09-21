import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const readRequestBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => resolve(body));
  request.on('error', reject);
});

const typeSafeProxy = (env) => ({
  name: 'typesafe-local-proxy',
  configureServer(server) {
    server.middlewares.use('/api/typesafe', async (request, response, next) => {
      if (request.method !== 'POST') return next();
      const apiKey = env.VITE_TYPESAFE_API_KEY || env.TYPESAFE_API_KEY;
      if (!apiKey) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: 'VITE_TYPESAFE_API_KEY .env içinde bulunamadı.' }));
        return;
      }

      try {
        const upstream = await fetch(env.VITE_TYPESAFE_API_URL || 'https://api.typesafe.ai/v1/systemone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: await readRequestBody(request),
        });
        response.statusCode = upstream.status;
        response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        response.end(await upstream.text());
      } catch (error) {
        response.statusCode = 502;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: error.message || 'TypeSafe API proxy bağlantısı başarısız.' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react(), typeSafeProxy(env)] };
});
