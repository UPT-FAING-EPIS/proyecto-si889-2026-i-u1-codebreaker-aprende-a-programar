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
  totals: {
    users: number;
    visits: number;
    completions: number;
    totalXp: number;
  };
  dailyVisits: Array<{ date: string; visits: number }>;
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
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Error ${response.status}`);
  }

  return response.json() as Promise<T>;
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

export async function getAdminMetrics(token: string): Promise<AdminMetrics> {
  return request<AdminMetrics>('/api/admin/metrics', {
    headers: buildHeaders(token, false),
  });
}
