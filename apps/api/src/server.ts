import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });
const apiPort = Number(process.env.API_PORT ?? 4000);

await server.register(cors, {
  origin: true,
});

server.get('/health', async () => {
  return {
    name: 'codebreaker-api',
    status: 'ok',
    database: 'mysql',
  };
});

server.get('/api/meta', async () => {
  return {
    game: 'Codebreaker',
    routes: ['python', 'php'],
    phase: 'foundation',
  };
});

try {
  await server.listen({ port: apiPort, host: '0.0.0.0' });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
