import type {
  AuthResponse,
  Conversation,
  Message,
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

  getConversations: () => request<Conversation[]>('/conversations'),

  getConversation: (id: string) =>
    request<Conversation>(`/conversations/${id}`),

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
