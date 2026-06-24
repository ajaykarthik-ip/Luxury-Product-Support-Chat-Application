import type {
  AgentView,
  AuthResponse,
  Conversation,
  ConversationCounts,
  Message,
  Paginated,
  Product,
  Role,
} from './types';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Thin fetch wrapper: attaches the JWT, sets JSON headers, and turns non-2xx
 * responses into thrown Errors carrying the backend's message (NestJS sends
 * validation errors as an array, which we join).
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      }
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (data: {
    email: string;
    password: string;
    name: string;
    role?: Role;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProducts: () => request<Product[]>('/products'),

  getProduct: (id: string) => request<Product>(`/products/${id}`),

  createProduct: (data: {
    name: string;
    description?: string;
    imageUrl?: string;
    category?: string;
  }) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Customer "Chat with Agent": find-or-create the conversation for this product.
  startConversation: (productId: string) =>
    request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),

  // Agents pass a view + page window; customers call it with no args (their own).
  getConversations: (params?: { view?: AgentView; skip?: number; take?: number }) => {
    const qs = new URLSearchParams();
    if (params?.view) qs.set('view', params.view);
    if (params?.skip != null) qs.set('skip', String(params.skip));
    if (params?.take != null) qs.set('take', String(params.take));
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<Paginated<Conversation>>(`/conversations${suffix}`);
  },

  // Per-view counts for the dashboard tab badges (agent only).
  getConversationCounts: () =>
    request<ConversationCounts>('/conversations/counts'),

  getConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}`),

  // Agent routing fallback: take over a chat, or hand it back to the pool.
  claimConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}/claim`, { method: 'PATCH' }),

  releaseConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}/release`, { method: 'PATCH' }),

  // Ticket lifecycle: resolve (close) or reopen.
  resolveConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}/resolve`, { method: 'PATCH' }),

  reopenConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}/reopen`, { method: 'PATCH' }),

  getMessages: (id: string) =>
    request<Message[]>(`/conversations/${id}/messages`),

  // REST send — used by the "Request a callback" form (the live chat uses the
  // socket instead).
  sendMessage: (id: string, content: string) =>
    request<Message>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
