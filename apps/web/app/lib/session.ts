export interface MasSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    accountType: string;
    profile: { fullName: string; nrp?: string; memberNumber?: string } | null;
    roles: { name: string }[];
    permissions: string[];
  };
}

const SESSION_KEY = "mas-session";

export function saveSession(session: MasSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readSession(): MasSession | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) as MasSession : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = readSession();
  const headers = new Headers(init.headers);
  if (session?.accessToken) headers.set("authorization", `Bearer ${session.accessToken}`);

  const response = await fetch(`/api/v1${path}`, { ...init, headers });
  if (response.status !== 401 || !session?.refreshToken || path === "/auth/refresh") {
    return response;
  }

  const refreshed = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!refreshed.ok) {
    clearSession();
    return response;
  }

  const result = await refreshed.json() as {
    data?: { accessToken: string; refreshToken: string; expiresIn: number };
  };
  if (!result.data) {
    clearSession();
    return response;
  }

  const updated = { ...session, ...result.data };
  saveSession(updated);
  headers.set("authorization", `Bearer ${updated.accessToken}`);
  return fetch(`/api/v1${path}`, { ...init, headers });
}