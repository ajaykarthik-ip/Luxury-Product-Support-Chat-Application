import { Injectable } from '@nestjs/common';

/**
 * In-memory registry of which agents are online and whether they're accepting
 * chats — the "who's available right now" input to auto-routing (the chat
 * equivalent of Swiggy knowing which riders are active).
 *
 * Two facts per agent:
 * - **online** — has ≥1 live socket (tracked per socket, since tabs multiply).
 * - **available** — an Away/Available toggle. Real desks route only to agents who
 *   are *online AND available*; an agent can stay connected but stop receiving new
 *   chats (e.g. finishing up, on break). Defaults to available on first connect.
 *
 * Why in-memory (not the DB)? Presence is ephemeral and high-churn. It belongs to
 * the running process; at multi-instance scale it'd move to Redis (noted as a step).
 */
@Injectable()
export class AgentPresenceService {
  /** socketId → agentId. The reverse lookup lets disconnect clean up by socket. */
  private readonly socketToAgent = new Map<string, string>();
  /** agentId → accepting new chats? */
  private readonly available = new Map<string, boolean>();

  connect(socketId: string, agentId: string): void {
    this.socketToAgent.set(socketId, agentId);
    // Default to available on the agent's first connection; keep their choice on
    // a reconnect from another tab.
    if (!this.available.has(agentId)) this.available.set(agentId, true);
  }

  disconnect(socketId: string): void {
    const agentId = this.socketToAgent.get(socketId);
    this.socketToAgent.delete(socketId);
    // Fully offline (no remaining sockets) → forget their availability.
    if (agentId && !this.hasSocket(agentId)) this.available.delete(agentId);
  }

  setAvailable(agentId: string, value: boolean): void {
    if (this.hasSocket(agentId)) this.available.set(agentId, value);
  }

  isAvailable(agentId: string): boolean {
    return this.available.get(agentId) === true;
  }

  /** Distinct agent ids with at least one open socket. */
  onlineAgentIds(): string[] {
    return [...new Set(this.socketToAgent.values())];
  }

  /** Online AND toggled available — the only agents eligible for routing. */
  availableAgentIds(): string[] {
    return this.onlineAgentIds().filter((id) => this.available.get(id) === true);
  }

  private hasSocket(agentId: string): boolean {
    for (const id of this.socketToAgent.values()) {
      if (id === agentId) return true;
    }
    return false;
  }
}
