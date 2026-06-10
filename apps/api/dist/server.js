import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const server = Fastify({ logger: true });
const apiPort = Number(process.env.API_PORT ?? 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyticsFilePath = path.join(__dirname, 'analytics-store.json');
const storeDir = path.dirname(analyticsFilePath);
const FALLBACK_SUMMARY_LIMIT = 30;

function nowIso() {
        return new Date().toISOString();
}

function toDateKey(dateLike) {
        return new Date(dateLike).toISOString().slice(0, 10);
}

function createInitialStore() {
        return {
                totalVisits: 0,
                uniqueVisitors: 0,
                firstVisitAt: null,
                lastVisitAt: null,
                visitors: {},
                daily: {},
        };
}

async function readStore() {
        try {
                const raw = await readFile(analyticsFilePath, 'utf-8');
                return JSON.parse(raw);
        }
        catch {
                return createInitialStore();
        }
}

async function writeStore(store) {
        await mkdir(storeDir, { recursive: true });
        await writeFile(analyticsFilePath, JSON.stringify(store, null, 2), 'utf-8');
}

function buildVisitorId(request, body) {
        if (body?.visitorId && typeof body.visitorId === 'string' && body.visitorId.trim().length > 0) {
                return body.visitorId.trim().slice(0, 120);
        }
        const ip = request.ip ?? 'unknown-ip';
        const ua = (request.headers['user-agent'] ?? 'unknown-ua').toString();
        const raw = `${ip}|${ua}`;
        return `fallback-${createHash('sha256').update(raw).digest('hex').slice(0, 18)}`;
}

function registerVisit(store, visit) {
        const currentAt = visit.at;
        const dayKey = toDateKey(currentAt);
        if (!store.daily[dayKey]) {
                store.daily[dayKey] = {
                        visits: 0,
                        uniqueVisitors: 0,
                        firstVisitAt: currentAt,
                        lastVisitAt: currentAt,
                };
        }
        if (!store.visitors[visit.visitorId]) {
                store.visitors[visit.visitorId] = {
                        firstSeenAt: currentAt,
                        lastSeenAt: currentAt,
                        visits: 0,
                        lastPage: visit.page,
                        source: visit.source,
                };
                store.uniqueVisitors += 1;
                store.daily[dayKey].uniqueVisitors += 1;
        }
        const visitor = store.visitors[visit.visitorId];
        visitor.lastSeenAt = currentAt;
        visitor.visits += 1;
        visitor.lastPage = visit.page;
        visitor.source = visit.source;
        store.totalVisits += 1;
        store.lastVisitAt = currentAt;
        if (!store.firstVisitAt) {
                store.firstVisitAt = currentAt;
        }
        store.daily[dayKey].visits += 1;
        store.daily[dayKey].lastVisitAt = currentAt;
}

function makeSummary(store, limit = FALLBACK_SUMMARY_LIMIT) {
        const rows = Object.entries(store.daily)
                .map(([date, values]) => ({ date, ...values }))
                .sort((a, b) => b.date.localeCompare(a.date));
        const today = toDateKey(new Date());
        const todayMetrics = store.daily[today] ?? {
                visits: 0,
                uniqueVisitors: 0,
                firstVisitAt: null,
                lastVisitAt: null,
        };
        const peak = rows.reduce((acc, row) => {
                if (!acc || row.visits > acc.visits) {
                        return row;
                }
                return acc;
        }, null);
        return {
                generatedAt: nowIso(),
                totalVisits: store.totalVisits,
                uniqueVisitors: store.uniqueVisitors,
                firstVisitAt: store.firstVisitAt,
                lastVisitAt: store.lastVisitAt,
                today: {
                        date: today,
                        visits: todayMetrics.visits,
                        uniqueVisitors: todayMetrics.uniqueVisitors,
                },
                peakDay: peak
                        ? {
                                date: peak.date,
                                visits: peak.visits,
                                uniqueVisitors: peak.uniqueVisitors,
                        }
                        : null,
                daily: rows.slice(0, limit),
        };
}

function adminHtml() {
        return `<!doctype html>
<html lang="es">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Codebreaker | Admin Métricas</title>
        <style>
            :root {
                --bg: #0b1320;
                --panel: #12233d;
                --panel-2: #173154;
                --text: #eaf1ff;
                --muted: #9fb4d8;
                --accent: #58d7ff;
                --ok: #63e6be;
            }
            * { box-sizing: border-box; }
            body {
                margin: 0;
                font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
                color: var(--text);
                background: radial-gradient(circle at 20% 10%, #173258, var(--bg) 55%);
            }
            .wrap {
                max-width: 1100px;
                margin: 0 auto;
                padding: 24px;
            }
            h1 { margin: 0 0 8px; font-size: 1.6rem; }
            p { margin: 0; color: var(--muted); }
            .top {
                display: flex;
                justify-content: space-between;
                align-items: end;
                gap: 16px;
                margin-bottom: 18px;
            }
            .badge {
                background: rgba(88, 215, 255, 0.16);
                color: var(--accent);
                border: 1px solid rgba(88, 215, 255, 0.38);
                border-radius: 999px;
                padding: 7px 12px;
                font-size: 0.86rem;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 12px;
                margin-bottom: 16px;
            }
            .card {
                background: linear-gradient(145deg, var(--panel), var(--panel-2));
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 14px;
            }
            .k {
                margin-top: 6px;
                font-size: 1.5rem;
                font-weight: 700;
            }
            .k.small { font-size: 1.1rem; }
            .panel {
                background: rgba(8, 19, 33, 0.65);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 14px;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td {
                text-align: left;
                padding: 10px 8px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            th { color: var(--muted); font-weight: 600; }
            .status { color: var(--ok); font-size: 0.9rem; }
            .muted { color: var(--muted); }
        </style>
    </head>
    <body>
        <div class="wrap">
            <div class="top">
                <div>
                    <h1>Zona Administrador: Métricas de Uso</h1>
                    <p>Visitas acumuladas, usuarios únicos y afluencia por fecha.</p>
                </div>
                <span class="badge" id="refresh">Actualizando...</span>
            </div>
            <section class="grid">
                <article class="card"><div>Total de ingresos</div><div class="k" id="totalVisits">0</div></article>
                <article class="card"><div>Usuarios únicos</div><div class="k" id="uniqueVisitors">0</div></article>
                <article class="card"><div>Ingresos hoy</div><div class="k" id="todayVisits">0</div></article>
                <article class="card"><div>Únicos hoy</div><div class="k" id="todayUnique">0</div></article>
                <article class="card"><div>Pico histórico</div><div class="k small" id="peakDay">-</div></article>
            </section>
            <section class="panel">
                <h2 style="margin:0 0 10px; font-size:1.05rem;">Afluencia por fecha</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Ingresos</th>
                            <th>Usuarios únicos</th>
                            <th>Primera visita</th>
                            <th>Última visita</th>
                        </tr>
                    </thead>
                    <tbody id="dailyRows"></tbody>
                </table>
                <p class="muted" id="emptyState" style="display:none; margin-top:12px;">Todavía no hay visitas registradas.</p>
            </section>
            <p class="status" id="updatedAt" style="margin-top: 12px;"></p>
        </div>
        <script>
            function fmtDateTime(v) {
                if (!v) return '-';
                const d = new Date(v);
                return d.toLocaleString('es-PE');
            }
            function fmtNum(v) {
                return Number(v || 0).toLocaleString('es-PE');
            }
            async function loadSummary() {
                const res = await fetch('/api/analytics/summary?limit=90');
                if (!res.ok) throw new Error('No se pudo leer métricas');
                return res.json();
            }
            function paint(data) {
                document.getElementById('totalVisits').textContent = fmtNum(data.totalVisits);
                document.getElementById('uniqueVisitors').textContent = fmtNum(data.uniqueVisitors);
                document.getElementById('todayVisits').textContent = fmtNum(data.today?.visits);
                document.getElementById('todayUnique').textContent = fmtNum(data.today?.uniqueVisitors);
                const peak = data.peakDay ? (data.peakDay.date + ' (' + fmtNum(data.peakDay.visits) + ')') : '-';
                document.getElementById('peakDay').textContent = peak;

                const tbody = document.getElementById('dailyRows');
                const empty = document.getElementById('emptyState');
                tbody.innerHTML = '';
                if (!data.daily || data.daily.length === 0) {
                    empty.style.display = 'block';
                } else {
                    empty.style.display = 'none';
                    data.daily.forEach((row) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = '<td>' + row.date + '</td><td>' + fmtNum(row.visits) + '</td><td>' + fmtNum(row.uniqueVisitors) + '</td><td>' + fmtDateTime(row.firstVisitAt) + '</td><td>' + fmtDateTime(row.lastVisitAt) + '</td>';
                        tbody.appendChild(tr);
                    });
                }

                document.getElementById('updatedAt').textContent = 'Última actualización: ' + fmtDateTime(data.generatedAt);
                document.getElementById('refresh').textContent = 'Auto-refresh cada 15s';
            }
            async function tick() {
                try {
                    const data = await loadSummary();
                    paint(data);
                } catch (error) {
                    document.getElementById('refresh').textContent = 'Error de lectura';
                }
            }
            tick();
            setInterval(tick, 15000);
        </script>
    </body>
</html>`;
}

await server.register(cors, {
    origin: true,
});
server.get('/', async (request, reply) => {
    return reply.redirect('/admin');
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
server.post('/api/analytics/visit', async (request, reply) => {
    const body = (request.body && typeof request.body === 'object') ? request.body : {};
    const visitorId = buildVisitorId(request, body);
    const page = typeof body.page === 'string' && body.page.trim() ? body.page.trim().slice(0, 220) : '/';
    const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 120) : 'web';
    const store = await readStore();
    registerVisit(store, {
        visitorId,
        page,
        source,
        at: nowIso(),
    });
    await writeStore(store);
    reply.code(201);
    return {
        ok: true,
        visitorId,
        totalVisits: store.totalVisits,
        uniqueVisitors: store.uniqueVisitors,
    };
});
server.get('/api/analytics/summary', async (request) => {
    const limitRaw = Number(request.query?.limit ?? FALLBACK_SUMMARY_LIMIT);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 365) : FALLBACK_SUMMARY_LIMIT;
    const store = await readStore();
    return makeSummary(store, limit);
});
server.get('/admin', async (request, reply) => {
    reply.type('text/html; charset=utf-8');
    return adminHtml();
});
server.get('/api/analytics/client-id', async () => {
    return {
        visitorId: randomUUID(),
    };
});
try {
    await server.listen({ port: apiPort, host: '0.0.0.0' });
}
catch (error) {
    server.log.error(error);
    process.exit(1);
}
