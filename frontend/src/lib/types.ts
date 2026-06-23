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

interface PartyRef {
  id: string;
  name: string;
  email: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  productId: string;
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  customer?: PartyRef;
  agent?: PartyRef | null;
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
