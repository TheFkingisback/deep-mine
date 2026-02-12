const isDefaultPort = !window.location.port || window.location.port === '80' || window.location.port === '443';
const API_BASE = isDefaultPort
  ? `${window.location.protocol}//${window.location.host}/api`
  : `${window.location.protocol}//${import.meta.env.VITE_WS_HOST || window.location.hostname || 'localhost'}:9001/api`;

interface AuthResponse {
  success: boolean;
  token?: string;
  nickname?: string;
  userId?: string;
  error?: string;
}

async function post(url: string, body: Record<string, string>): Promise<AuthResponse> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Could not connect to server' };
  }
}

export async function register(data: {
  email: string; password: string; firstName: string; lastName: string; nickname: string;
}): Promise<AuthResponse> {
  return post(`${API_BASE}/register`, data);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return post(`${API_BASE}/login`, { email, password });
}

export async function forgotPassword(email: string): Promise<AuthResponse> {
  return post(`${API_BASE}/forgot`, { email });
}

export async function resetPassword(token: string, password: string): Promise<AuthResponse> {
  return post(`${API_BASE}/reset`, { token, password });
}
