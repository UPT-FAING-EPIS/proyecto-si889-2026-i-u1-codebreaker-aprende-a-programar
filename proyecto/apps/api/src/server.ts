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

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

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
    endpoints: ['/health', '/api/meta', '/api/auth/google', '/api/progress/me', '/api/admin/metrics', '/api/admin/leaderboard'],
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

  const query = request.query as { days?: string; search?: string } | undefined;
  const days = parsePositiveInt(query?.days, 30, 180);
  const search = (query?.search ?? '').trim();
  const likeSearch = `%${search}%`;

  const [totalsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS usersCount,
      (SELECT COUNT(*) FROM visit_events) AS visitsCount,
      (SELECT COUNT(*) FROM user_level_progress WHERE status = 'completed') AS completionsCount,
      (SELECT COALESCE(SUM(total_xp), 0) FROM user_stats) AS totalXp,
      (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newUsers7d,
      (SELECT COUNT(DISTINCT user_id) FROM visit_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS activeUsers7d,
      (SELECT COALESCE(AVG(total_xp), 0) FROM user_stats) AS avgXpPerUser`,
  );

  const [dailyVisitsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS visits
     FROM visit_events
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC
     LIMIT ?`,
    [days, days],
  );

  const [dailyCompletionsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT DATE(completed_at) AS date, COUNT(*) AS completions
     FROM user_level_progress
     WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(completed_at)
     ORDER BY DATE(completed_at) DESC
     LIMIT ?`,
    [days, days],
  );

  const [dailyUsersRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS users
     FROM users
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC
     LIMIT ?`,
    [days, days],
  );

  const [topLevelsRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT
      l.slug,
      l.title,
      COUNT(*) AS completions,
      COALESCE(SUM(l.xp_reward), 0) AS xpGenerated
     FROM user_level_progress p
     INNER JOIN levels l ON l.id = p.level_id
     WHERE p.status = 'completed'
       AND p.completed_at IS NOT NULL
       AND p.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY l.id, l.slug, l.title
     ORDER BY completions DESC, xpGenerated DESC
     LIMIT 8`,
    [days],
  );

  const [usersRows] = await mysqlPool.query<mysql.RowDataPacket[]>(
    `SELECT
      u.id,
      u.display_name,
      u.email,
      COALESCE(us.total_xp, 0) AS totalXp,
      COALESCE(us.levels_completed, 0) AS levelsCompleted,
      us.last_activity_date AS lastActivityDate,
      COALESCE(v.visits, 0) AS visitsInRange
     FROM users u
     LEFT JOIN user_stats us ON us.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS visits
       FROM visit_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY user_id
     ) v ON v.user_id = u.id
     WHERE (? = '' OR u.display_name LIKE ? OR u.email LIKE ?)
     ORDER BY totalXp DESC, levelsCompleted DESC, u.display_name ASC
     LIMIT 120`,
    [days, search, likeSearch, likeSearch],
  );

  return {
    filters: {
      days,
      search,
    },
    totals: {
      users: Number(totalsRows[0]?.usersCount ?? 0),
      visits: Number(totalsRows[0]?.visitsCount ?? 0),
      completions: Number(totalsRows[0]?.completionsCount ?? 0),
      totalXp: Number(totalsRows[0]?.totalXp ?? 0),
      activeUsers7d: Number(totalsRows[0]?.activeUsers7d ?? 0),
      newUsers7d: Number(totalsRows[0]?.newUsers7d ?? 0),
      avgXpPerUser: Number(totalsRows[0]?.avgXpPerUser ?? 0),
    },
    dailyVisits: dailyVisitsRows.map((row) => ({
      date: String(row.date),
      visits: Number(row.visits),
    })),
    dailyCompletions: dailyCompletionsRows.map((row) => ({
      date: String(row.date),
      completions: Number(row.completions),
    })),
    dailyNewUsers: dailyUsersRows.map((row) => ({
      date: String(row.date),
      users: Number(row.users),
    })),
    topLevels: topLevelsRows.map((row) => ({
      slug: String(row.slug),
      title: String(row.title),
      completions: Number(row.completions),
      xpGenerated: Number(row.xpGenerated),
    })),
    users: usersRows.map((row) => ({
      id: Number(row.id),
      displayName: String(row.display_name),
      email: String(row.email),
      totalXp: Number(row.totalXp),
      levelsCompleted: Number(row.levelsCompleted),
      lastActivityDate: row.lastActivityDate ?? null,
      visitsInRange: Number(row.visitsInRange),
    })),
  };
});

server.get('/api/admin/leaderboard', async (request, reply) => {
  const auth = await authUser(request);

  if (!auth || !adminEmails.has(auth.email.toLowerCase())) {
    return reply.code(403).send({ message: 'Solo administradores.' });
  }

  const query = request.query as { limit?: string; window?: string } | undefined;
  const limit = parsePositiveInt(query?.limit, 20, 100);
  const windowRaw = (query?.window ?? 'all').toLowerCase();
  const window: '7d' | '30d' | 'all' = windowRaw === '7d' || windowRaw === '30d' ? windowRaw : 'all';
  const days = window === '7d' ? 7 : window === '30d' ? 30 : null;

  const leaderboardQuery = days
    ? `SELECT
        u.id,
        u.display_name,
        u.email,
        COALESCE(us.total_xp, 0) AS totalXp,
        COALESCE(us.levels_completed, 0) AS levelsCompleted,
        COALESCE(xp.xpEarned, 0) AS xpInWindow,
        COALESCE(c.completedInWindow, 0) AS completedInWindow,
        COALESCE(us.current_streak_days, 0) AS currentStreakDays
      FROM users u
      LEFT JOIN user_stats us ON us.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COALESCE(SUM(xp_delta), 0) AS xpEarned
        FROM xp_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY user_id
      ) xp ON xp.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS completedInWindow
        FROM user_level_progress
        WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY user_id
      ) c ON c.user_id = u.id
      ORDER BY xpInWindow DESC, completedInWindow DESC, totalXp DESC, u.display_name ASC
      LIMIT ?`
    : `SELECT
        u.id,
        u.display_name,
        u.email,
        COALESCE(us.total_xp, 0) AS totalXp,
        COALESCE(us.levels_completed, 0) AS levelsCompleted,
        COALESCE(us.total_xp, 0) AS xpInWindow,
        COALESCE(us.levels_completed, 0) AS completedInWindow,
        COALESCE(us.current_streak_days, 0) AS currentStreakDays
      FROM users u
      LEFT JOIN user_stats us ON us.user_id = u.id
      ORDER BY totalXp DESC, levelsCompleted DESC, u.display_name ASC
      LIMIT ?`;

  const leaderboardParams = days ? [days, days, limit] : [limit];
  const [rows] = await mysqlPool.query<mysql.RowDataPacket[]>(leaderboardQuery, leaderboardParams);

  return {
    window,
    limit,
    generatedAt: new Date().toISOString(),
    entries: rows.map((row, index) => ({
      rank: index + 1,
      userId: Number(row.id),
      displayName: String(row.display_name),
      email: String(row.email),
      totalXp: Number(row.totalXp),
      levelsCompleted: Number(row.levelsCompleted),
      xpInWindow: Number(row.xpInWindow),
      completedInWindow: Number(row.completedInWindow),
      currentStreakDays: Number(row.currentStreakDays),
    })),
  };
});

try {
  await server.listen({ port: apiPort, host: '0.0.0.0' });
  server.log.info({ apiPort }, 'API iniciada. Verificando conexión con MySQL...');

  try {
    await mysqlPool.query('SELECT 1');
    await seedGameCatalog();
    server.log.info('MySQL conectado y catálogo sembrado.');
  } catch (dbError) {
    // No detenemos la API para poder diagnosticar desde /health y logs en producción.
    server.log.error(dbError, 'MySQL no disponible durante el arranque.');
  }
} catch (error) {
  server.log.error(error, 'No se pudo iniciar el servidor HTTP.');
  process.exit(1);
}
