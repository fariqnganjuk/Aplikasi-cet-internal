import { Conversation, Message, User } from '../types/chat';

const TOKEN_KEY = 'akselera_tech_token';
const USER_KEY = 'akselera_tech_user';
const THEME_KEY = 'akselera_tech_theme';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

export function getStoredTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // Check system preference
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function setStoredTheme(theme: 'light' | 'dark') {
  localStorage.setItem(THEME_KEY, theme);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('auth:unauthorized'));
    let errorMsg = 'Sesi telah berakhir. Silakan login kembali.';
    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error) errorMsg = errorData.error;
    }
    throw new Error(errorMsg);
  }

  if (!response.ok) {
    let errorMsg = `Request gagal dengan status ${response.status}`;
    let errorCode: string | undefined;
    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error) errorMsg = errorData.error;
      errorCode = errorData.code;
    }
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).code = errorCode;
    throw err;
  }

  if (!isJson) {
    throw new Error(`Respons server bukan JSON (Content-Type: ${contentType})`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  },

  // Users for "+ Chat Baru"
  async getUsers(): Promise<{ users: User[] }> {
    return request<{ users: User[] }>('/api/users');
  },

  // Conversations
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    return request<{ conversations: Conversation[] }>('/api/conversations');
  },

  async startConversation(recipientId: string): Promise<{ conversationId: string }> {
    return request<{ conversationId: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    });
  },

  // Messages
  async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
    return request<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`);
  },

  async sendMessage(conversationId: string, text: string): Promise<{ message: Message }> {
    return request<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async markAsRead(conversationId: string): Promise<void> {
    return request<void>(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  },

  // Security audit tool for candidate demo
  async getSecurityAudit(): Promise<any> {
    return request<any>('/api/security-audit');
  },

  // Setup real-time event source
  subscribeToEvents(onEvent: (event: any) => void): () => void {
    const token = getToken();
    if (!token) return () => {};

    try {
      const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // EventSource will auto-retry
      };

      return () => {
        eventSource.close();
      };
    } catch (e) {
      return () => {};
    }
  },
};
