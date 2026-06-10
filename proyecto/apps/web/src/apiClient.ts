export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export type UserStats = {
  totalXp: number;
  levelsCompleted: number;
  currentStreakDays: number;
  lastActivityDate: string | null;
};

export type ProgressSnapshot = {
  completedLessons: string[];
  stats: UserStats;
};

export type AuthResponse = {
  token: string;
  user: SessionUser;
  completedLessons: string[];
  stats: UserStats;
};

export type AdminMetrics = {
  filters: {
    days: number;
    search: string;
  };
  totals: {
    users: number;
    visits: number;
    completions: number;
    totalXp: number;
    activeUsers7d: number;
    newUsers7d: number;
    avgXpPerUser: number;
  };
  dailyVisits: Array<{ date: string; visits: number }>;
  dailyCompletions: Array<{ date: string; completions: number }>;
  dailyNewUsers: Array<{ date: string; users: number }>;
  topLevels: Array<{ slug: string; title: string; completions: number; xpGenerated: number }>;
  users: Array<{
    id: number;
    displayName: string;
    email: string;
    totalXp: number;
    levelsCompleted: number;
    lastActivityDate: string | null;
    visitsInRange: number;
  }>;
};

export type LeaderboardWindow = '7d' | '30d' | 'all';

export type LeaderboardResponse = {
  window: LeaderboardWindow;
  limit: number;
  generatedAt: string;
  entries: Array<{
    rank: number;
    userId: number;
    displayName: string;
    email: string;
    totalXp: number;
    levelsCompleted: number;
    xpInWindow: number;
    completedInWindow: number;
    currentStreakDays: number;
  }>;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function buildHeaders(token?: string, includeJson = true) {
  const headers: Record<string, string> = {};

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const endpoint = `${API_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(endpoint, options);
  } catch {
    throw new Error(`No se pudo conectar con la API en ${endpoint}. Revisa CORS, URL y estado del servidor.`);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Error ${response.status} en ${endpoint}`);
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/google', {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify({ credential }),
  });
}

export async function getCurrentSession(token: string): Promise<{ user: SessionUser } & ProgressSnapshot> {
  return request<{ user: SessionUser } & ProgressSnapshot>('/api/auth/me', {
    headers: buildHeaders(token, false),
  });
}

export async function completeLesson(token: string, levelSlug: string): Promise<ProgressSnapshot> {
  return request<ProgressSnapshot>('/api/progress/complete', {
    method: 'POST',
    headers: buildHeaders(token, true),
    body: JSON.stringify({ levelSlug }),
  });
}

export async function trackVisit(visitorId: string, token?: string) {
  await request<{ ok: boolean }>('/api/visits', {
    method: 'POST',
    headers: buildHeaders(token, true),
    body: JSON.stringify({
      visitorId,
      path: window.location.pathname,
      source: 'web',
    }),
  });
}

export async function getAdminMetrics(token: string, options?: { days?: number; search?: string }): Promise<AdminMetrics> {
  const query = buildQuery({
    days: options?.days,
    search: options?.search,
  });

  return request<AdminMetrics>(`/api/admin/metrics${query}`, {
    headers: buildHeaders(token, false),
  });
}

export async function getAdminLeaderboard(
  token: string,
  options?: { window?: LeaderboardWindow; limit?: number },
): Promise<LeaderboardResponse> {
  const query = buildQuery({
    window: options?.window,
    limit: options?.limit,
  });

  return request<LeaderboardResponse>(`/api/admin/leaderboard${query}`, {
    headers: buildHeaders(token, false),
  });
}
