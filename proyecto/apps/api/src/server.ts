import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { OAuth2Client } from 'google-auth-library';

const server = Fastify({ logger: true });
const apiPort = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const jwtSecret = process.env.APP_JWT_SECRET ?? 'dev-secret-change-me';
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';
const oauthClient = new OAuth2Client(googleClientId);
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: (process.env.MYSQL_SSL ?? 'true') === 'true' ? { rejectUnauthorized: true } : undefined,
});

type JwtPayload = {
  userId: number;
  email: string;
  displayName: string;
};

const levelSeeds = [
  { trackSlug: 'python', slug: 'python-1', title: 'Hola, Python', order: 1, xpReward: 10, difficulty: 'beginner', isBoss: 0 },
  { trackSlug: 'python', slug: 'python-2', title: 'Variables de energía', order: 2, xpReward: 15, difficulty: 'beginner', isBoss: 0 },
  { trackSlug: 'python', slug: 'python-3', title: 'Jefe: Hydra de Cadenas', order: 3, xpReward: 60, difficulty: 'advanced', isBoss: 1 },
  { trackSlug: 'php', slug: 'php-1', title: 'Hola, PHP', order: 1, xpReward: 10, difficulty: 'beginner', isBoss: 0 },
  { trackSlug: 'php', slug: 'php-2', title: 'Arrays del puerto', order: 2, xpReward: 15, difficulty: 'beginner', isBoss: 0 },
  { trackSlug: 'php', slug: 'php-3', title: 'Jefe: Kraken de Formularios', order: 3, xpReward: 60, difficulty: 'intermediate', isBoss: 1 },
];

function getBearerToken(authHeader?: string) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

async function authUser(request: typeof server extends { route: (opts: infer _T) => any } ? any : never) {
  const token = getBearerToken(request.headers.authorization);

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

async function seedGameCatalog() {
  await mysqlPool.query(
    'INSERT IGNORE INTO tracks (slug, name, description) VALUES (?, ?, ?), (?, ?, ?)',
    [
      'python',
      'Python Orbit',
      'Ruta inicial para sintaxis y lógica en Python',
      'php',
      'PHP Harbor',
      'Ruta inicial de backend clásico con PHP',
    ],
  );

  for (const level of levelSeeds) {
    const [trackRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM tracks WHERE slug = ? LIMIT 1',
      [level.trackSlug],
    );

    if (trackRows.length === 0) {
      continue;
    }

    await mysqlPool.query(
      `INSERT INTO levels (track_id, slug, title, level_order, xp_reward, difficulty, is_boss, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE title = VALUES(title), xp_reward = VALUES(xp_reward), difficulty = VALUES(difficulty), is_boss = VALUES(is_boss)`,
      [
        trackRows[0].id,
        level.slug,
        level.title,
        level.order,
        level.xpReward,
        level.difficulty,
        level.isBoss,
      ],
    );
  }
}

async function buildUserSnapshot(userId: number) {
  const [statsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    'SELECT total_xp, levels_completed, current_streak_days, last_activity_date FROM user_stats WHERE user_id = ? LIMIT 1',
    [userId],
  );

  const [progressRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT l.slug
     FROM user_level_progress p
     INNER JOIN levels l ON l.id = p.level_id
     WHERE p.user_id = ? AND p.status = 'completed'`,
    [userId],
  );

  return {
    completedLessons: progressRows.map((row) => row.slug as string),
    stats: {
      totalXp: Number(statsRows[0]?.total_xp ?? 0),
      levelsCompleted: Number(statsRows[0]?.levels_completed ?? 0),
      currentStreakDays: Number(statsRows[0]?.current_streak_days ?? 0),
      lastActivityDate: statsRows[0]?.last_activity_date ?? null,
    },
  };
}

await server.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? '*').split(',').map((item) => item.trim()),
});

server.get('/', async () => {
  return {
    name: 'codebreaker-api',
    status: 'ok',
    message: 'API activa con progreso en MySQL, login y métricas.',
    endpoints: ['/health', '/api/meta', '/api/auth/google', '/api/progress/me', '/api/admin/metrics'],
  };
});

server.get('/health', async () => {
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    await mysqlPool.query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }

  return {
    name: 'codebreaker-api',
    status: 'ok',
    database: dbStatus,
  };
});

server.get('/api/meta', async () => {
  return {
    game: 'Codebreaker',
    routes: ['python', 'php'],
    phase: 'azure-ready',
    auth: 'google',
  };
});

server.post('/api/auth/google', async (request, reply) => {
  const body = request.body as { credential?: string } | undefined;

  if (!googleClientId) {
    return reply.code(500).send({
      message: 'GOOGLE_CLIENT_ID no configurado en el servidor.',
    });
  }

  if (!body?.credential) {
    return reply.code(400).send({
      message: 'Falta credential de Google.',
    });
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: body.credential,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    return reply.code(401).send({
      message: 'Token de Google inválido.',
    });
  }

  const email = payload.email.toLowerCase();
  const displayName = payload.name ?? email;
  const avatarUrl = payload.picture ?? null;

  await mysqlPool.query(
    `INSERT INTO users (email, display_name, avatar_url, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), avatar_url = VALUES(avatar_url), is_active = 1`,
    [email, displayName, avatarUrl],
  );

  const [userRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, display_name, avatar_url FROM users WHERE email = ? LIMIT 1',
    [email],
  );

  const user = userRows[0];

  await mysqlPool.query(
    `INSERT INTO auth_accounts (user_id, provider, provider_user_id, provider_email)
     VALUES (?, 'google', ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), provider_email = VALUES(provider_email)`,
    [user.id, payload.sub, email],
  );

  await mysqlPool.query(
    `INSERT INTO user_stats (user_id, total_xp, levels_completed, current_streak_days)
     VALUES (?, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [user.id],
  );

  const snapshot = await buildUserSnapshot(Number(user.id));
  const token = jwt.sign(
    {
      userId: Number(user.id),
      email,
      displayName,
    },
    jwtSecret,
    { expiresIn: '7d' },
  );

  return {
    token,
    user: {
      id: Number(user.id),
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: adminEmails.has(email),
    },
    ...snapshot,
  };
});

server.get('/api/auth/me', async (request, reply) => {
  const auth = await authUser(request);

  if (!auth) {
    return reply.code(401).send({ message: 'No autenticado.' });
  }

  const [userRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = ? LIMIT 1',
    [auth.userId],
  );

  if (!userRows[0]) {
    return reply.code(401).send({ message: 'Usuario no encontrado.' });
  }

  const snapshot = await buildUserSnapshot(auth.userId);

  return {
    user: {
      id: Number(userRows[0].id),
      email: userRows[0].email,
      displayName: userRows[0].display_name,
      avatarUrl: userRows[0].avatar_url,
      isAdmin: adminEmails.has(String(userRows[0].email).toLowerCase()),
    },
    ...snapshot,
  };
});

server.post('/api/visits', async (request) => {
  const body = request.body as
    | { visitorId?: string; path?: string; source?: string }
    | undefined;
  const auth = await authUser(request);
  const visitorId = body?.visitorId?.trim() || 'anonymous';
  const path = body?.path?.trim() || '/';
  const source = body?.source?.trim() || 'web';

  await mysqlPool.query(
    'INSERT INTO visit_events (visitor_id, user_id, path, source) VALUES (?, ?, ?, ?)',
    [visitorId.slice(0, 120), auth?.userId ?? null, path.slice(0, 220), source.slice(0, 120)],
  );

  return { ok: true };
});

server.get('/api/progress/me', async (request, reply) => {
  const auth = await authUser(request);
  if (!auth) {
    return reply.code(401).send({ message: 'No autenticado.' });
  }

  return buildUserSnapshot(auth.userId);
});

server.post('/api/progress/complete', async (request, reply) => {
  const auth = await authUser(request);

  if (!auth) {
    return reply.code(401).send({ message: 'Inicia sesión con Google para guardar progreso.' });
  }

  const body = request.body as { levelSlug?: string } | undefined;
  const levelSlug = body?.levelSlug?.trim();

  if (!levelSlug) {
    return reply.code(400).send({ message: 'Falta levelSlug.' });
  }

  const [levelRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    'SELECT id, xp_reward FROM levels WHERE slug = ? LIMIT 1',
    [levelSlug],
  );

  if (!levelRows[0]) {
    return reply.code(404).send({ message: 'Nivel no encontrado.' });
  }

  const levelId = Number(levelRows[0].id);
  const xpReward = Number(levelRows[0].xp_reward ?? 0);
  const idempotencyKey = `complete:${auth.userId}:${levelId}`;

  await mysqlPool.query(
    `INSERT INTO user_level_progress (user_id, level_id, status, attempts, first_started_at, completed_at, last_activity_at)
     VALUES (?, ?, 'completed', 1, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       status = IF(status = 'completed', status, 'completed'),
       attempts = attempts + 1,
       completed_at = IF(completed_at IS NULL, NOW(), completed_at),
       last_activity_at = NOW()`,
    [auth.userId, levelId],
  );

  const [xpResult] = await mysqlPool.query<mysql.ResultSetHeader>(
    `INSERT IGNORE INTO xp_events (user_id, source_type, source_ref, xp_delta, idempotency_key)
     VALUES (?, 'level_completion', ?, ?, ?)`,
    [auth.userId, levelSlug, xpReward, idempotencyKey],
  );

  if (xpResult.affectedRows > 0) {
    await mysqlPool.query(
      `INSERT INTO user_stats (user_id, total_xp, levels_completed, current_streak_days, last_activity_date)
       VALUES (?, ?, 1, 1, CURRENT_DATE)
       ON DUPLICATE KEY UPDATE total_xp = total_xp + VALUES(total_xp), levels_completed = levels_completed + 1, last_activity_date = CURRENT_DATE`,
      [auth.userId, xpReward],
    );
  }

  const snapshot = await buildUserSnapshot(auth.userId);
  return {
    saved: true,
    alreadyCounted: xpResult.affectedRows === 0,
    ...snapshot,
  };
});

server.get('/api/admin/metrics', async (request, reply) => {
  const auth = await authUser(request);

  if (!auth || !adminEmails.has(auth.email.toLowerCase())) {
    return reply.code(403).send({ message: 'Solo administradores.' });
  }

  const [totalsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS usersCount,
      (SELECT COUNT(*) FROM visit_events) AS visitsCount,
      (SELECT COUNT(*) FROM user_level_progress WHERE status = 'completed') AS completionsCount,
      (SELECT COALESCE(SUM(total_xp), 0) FROM user_stats) AS totalXp`,
  );

  const [dailyRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS visits
     FROM visit_events
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC
     LIMIT 30`,
  );

  return {
    totals: {
      users: Number(totalsRows[0]?.usersCount ?? 0),
      visits: Number(totalsRows[0]?.visitsCount ?? 0),
      completions: Number(totalsRows[0]?.completionsCount ?? 0),
      totalXp: Number(totalsRows[0]?.totalXp ?? 0),
    },
    dailyVisits: dailyRows.map((row) => ({
      date: String(row.date),
      visits: Number(row.visits),
    })),
  };
});

try {
  await mysqlPool.query('SELECT 1');
  await seedGameCatalog();
  await server.listen({ port: apiPort, host: '0.0.0.0' });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
