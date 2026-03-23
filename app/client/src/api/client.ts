const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function loadTokens(): void {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken || refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // On 401, try refreshing the token
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Auth
export const auth = {
  register: (data: { email: string; password: string; name: string }) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiRequest('/auth/me'),
};

// Projects
export const projects = {
  list: () => apiRequest<{ projects: any[] }>('/projects'),
  get: (id: string) => apiRequest<{ project: any }>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiRequest('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiRequest(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiRequest(`/projects/${id}`, { method: 'DELETE' }),
};

// Tasks
export const tasks = {
  listByProject: (projectId: string) =>
    apiRequest<{ tasks: any[] }>(`/tasks/project/${projectId}`),
  create: (data: any) =>
    apiRequest('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiRequest(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
  listComments: (taskId: string) =>
    apiRequest<{ comments: any[] }>(`/tasks/${taskId}/comments`),
  addComment: (taskId: string, data: { content: string }) =>
    apiRequest(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  updateComment: (taskId: string, commentId: string, data: { content: string }) =>
    apiRequest(`/tasks/${taskId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComment: (taskId: string, commentId: string) =>
    apiRequest(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),
};

// Dashboard
export const dashboard = {
  stats: () => apiRequest<any>('/dashboard/stats'),
};

// Activity
export const activity = {
  listByProject: (projectId: string, limit = 50, offset = 0) =>
    apiRequest<{ activities: any[] }>(`/activity/project/${projectId}?limit=${limit}&offset=${offset}`),
};

// Notifications
export const notifications = {
  list: () => apiRequest<{ notifications: any[]; unreadCount: number }>('/notifications'),
  markRead: (id: string) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
};
