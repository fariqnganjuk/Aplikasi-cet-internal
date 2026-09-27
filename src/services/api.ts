import { Conversation, Message, User } from '../types/chat';

export interface RealtimeEvent {
  type: 'CONNECTED' | 'NEW_MESSAGE' | 'MESSAGES_READ';
  payload?: unknown;
}

/**
 * Token sesi dipegang hanya oleh httpOnly cookie (akselera_token),
 * tidak ada localStorage token. Semua fetch otomatis mengirim cookie
 * berkat credentials: 'same-origin'. Halaman tidak bisa membaca token,
 * sehingga XSS tidak bisa mencurinya.
 */

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (response.status === 401) {
    window.location.replace('/login');
    throw new Error('Sesi telah berakhir. Silakan login kembali.');
  }

  if (!response.ok) {
    let errorMsg = `Request gagal dengan status ${response.status}`;
    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error) errorMsg = errorData.error;
    }
    const err = new Error(errorMsg);
    (err as unknown as { status?: number }).status = response.status;
    throw err;
  }

  if (!isJson) {
    throw new Error(`Respons server bukan JSON (Content-Type: ${contentType})`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  async login(email: string, password: string): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(name: string, email: string, password: string): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/login');
    }
  },

  async getUsers(): Promise<{ users: User[] }> {
    return request<{ users: User[] }>('/api/users');
  },

  async getConversations(): Promise<{ conversations: Conversation[] }> {
    return request<{ conversations: Conversation[] }>('/api/conversations');
  },

  async startConversation(recipientId: string): Promise<{ conversationId: string }> {
    return request<{ conversationId: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    });
  },

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
    await request<void>(`/api/conversations/${conversationId}/read`, { method: 'POST' });
  },

  async getSecurityAudit(): Promise<unknown> {
    return request<unknown>('/api/security-audit');
  },

  /**
   * SSE real-time via fetch streaming.
   * Cookie otomatis dikirim (credentials: 'same-origin'), tidak ada
   * token di query string/URL.
   */
  subscribeToEvents(onEvent: (event: RealtimeEvent) => void): () => void {
    const controller = new AbortController();
    let closed = false;

    const connect = async () => {
      while (!closed) {
        try {
          const response = await fetch('/api/events', {
            credentials: 'same-origin',
            signal: controller.signal,
            cache: 'no-store',
          });

          if (!response.ok || !response.body) {
            throw new Error(`SSE failed: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!closed) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
              const rawEvent = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              boundary = buffer.indexOf('\n\n');

              for (const line of rawEvent.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload) continue;
                try {
                  onEvent(JSON.parse(payload));
                } catch {
                  // ignore malformed frame
                }
              }
            }
          }
        } catch (err) {
          if (closed || (err as Error)?.name === 'AbortError') return;
        }
        if (closed) return;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    };

    void connect();
    return () => {
      closed = true;
      controller.abort();
    };
  },
};
