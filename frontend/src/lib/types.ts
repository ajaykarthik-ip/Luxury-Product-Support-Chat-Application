// Mirrors the shapes the NestJS backend returns over HTTP/WebSocket.
// (The backend's Prisma types don't cross the network — JSON has no types —
// so we re-declare the response shapes here. See CLAUDE.md notes.)

export type Role = 'CUSTOMER' | 'AGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string;
  createdAt: string;
}

export interface PartyRef {
  id: string;
  name: string;
  email: string;
}

export type ConversationStatus = 'OPEN' | 'CLOSED';

export interface Conversation {
  id: string;
  customerId: string;
  productId: string;
  agentId?: string | null;
  status?: ConversationStatus;
  // Customer satisfaction score (1–5), null until the customer rates it.
  rating?: number | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  customer?: PartyRef;
  agent?: PartyRef | null;
  // Most recent message in the thread (agent list preview). Null if none yet.
  lastMessage?: Message | null;
}

// Agent dashboard views and their tab-count badges.
export type AgentView = 'mine' | 'waiting' | 'all' | 'closed';
export interface ConversationCounts {
  mine: number;
  waiting: number;
  all: number;
  closed: number;
}

// Paginated list response (agents) — customers get the same shape, unpaginated.
export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: { id: string; name: string; role: Role };
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// Payload of the `conversation:updated` socket event (ownership or status changed).
export interface ConversationUpdate {
  conversationId: string;
  agentId: string | null;
  agent: PartyRef | null;
  status: ConversationStatus;
  rating?: number | null;
}
