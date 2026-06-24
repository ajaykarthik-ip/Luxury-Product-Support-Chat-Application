import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Conversation, ConversationStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONVERSATION_CHANGED,
  ConversationChangedEvent,
} from './events/conversation-changed.event';

// Shape we pull customer/product/agent details into for list/detail responses.
const conversationInclude = {
  product: true,
  customer: { select: { id: true, name: true, email: true } },
  agent: { select: { id: true, name: true, email: true } },
};

// List rows also carry the latest message for a preview (one extra row per
// conversation, served by the @@index([conversationId, createdAt]) on Message).
const listInclude = {
  ...conversationInclude,
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { sender: { select: { id: true, name: true, role: true } } },
  },
};

/** The agent dashboard's saved "views" — like Zendesk's My / Unassigned / All. */
export type AgentView = 'mine' | 'waiting' | 'all' | 'closed';

/**
 * Max concurrent OPEN chats one agent handles at once. Routing fills agents up to
 * this cap, then leaves the rest in the queue — the standard live-chat model
 * (Intercom/Zendesk call it the agent's "capacity"). Kept small and deliberate.
 */
export const MAX_CONCURRENT_CHATS = 5;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Customer starts (or re-opens) a chat about a product.
   *
   * This is where the core assignment rule lives. `upsert` on the composite
   * unique key (customerId, productId) means: if a conversation for this pair
   * already exists, return it; otherwise create it. One conversation per
   * customer-product pair — enforced atomically by the DB, so two rapid clicks
   * can't create duplicates.
   */
  async findOrCreate(customerId: string, productId: string) {
    // Validate the product first, else the FK would throw a raw DB error.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.conversation.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: {}, // nothing to change if it already exists
      create: { customerId, productId },
      include: conversationInclude,
    });
  }

  // --- Listing -------------------------------------------------------------

  /**
   * Agent dashboard list, scoped to a "view" and paginated.
   *
   * Real support desks never show one giant list of everything — agents work a
   * filtered slice (their open tickets, the unassigned pool, …) a page at a time.
   * We mirror that: `view` chooses the filter, `skip`/`take` page the results,
   * and we return `total` so the client knows whether more remain.
   */
  async findForAgent(agentId: string, view: AgentView, skip: number, take: number) {
    const where = this.viewWhere(agentId, view);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: listInclude,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return { items: rows.map(this.withLastMessage), total };
  }

  /** Per-view counts that drive the dashboard tab badges. */
  async countsForAgent(agentId: string) {
    const [mine, waiting, all, closed] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where: this.viewWhere(agentId, 'mine') }),
      this.prisma.conversation.count({
        where: this.viewWhere(agentId, 'waiting'),
      }),
      this.prisma.conversation.count({ where: this.viewWhere(agentId, 'all') }),
      this.prisma.conversation.count({
        where: this.viewWhere(agentId, 'closed'),
      }),
    ]);
    return { mine, waiting, all, closed };
  }

  /** A customer's own conversations (small set — no pagination needed). */
  async findForCustomer(customerId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
      include: listInclude,
    });
    return { items: rows.map(this.withLastMessage), total: rows.length };
  }

  async findOneForUser(id: string, user: AuthUser) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    this.assertAccess(conversation, user);
    return conversation;
  }

  /**
   * Lightweight access check used by the message endpoints and the WebSocket
   * gateway: confirms the conversation exists and the user may touch it. Returns
   * the row so callers can reuse it.
   */
  async getAccessibleConversation(id: string, user: AuthUser) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    this.assertAccess(conversation, user);
    return conversation;
  }

  // --- Agent routing (Option B: presence-aware least-busy auto-assignment) ---

  /** Current OPEN-chat load for each of the given agents (0 if none). */
  private async openLoadByAgent(agentIds: string[]): Promise<Map<string, number>> {
    const load = new Map(agentIds.map((id) => [id, 0]));
    if (agentIds.length === 0) return load;
    const grouped = await this.prisma.conversation.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds }, status: ConversationStatus.OPEN },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.agentId) load.set(row.agentId, row._count._all);
    }
    return load;
  }

  /**
   * Pick the eligible agent handling the FEWEST *open* chats — but only among those
   * still **under capacity**. Closed tickets don't count as load; idle agents (0)
   * get picked first. Returns null if everyone eligible is at capacity, so the chat
   * stays queued (the realistic outcome — busy agents don't get piled on).
   *
   * `eligibleAgentIds` comes from the gateway's presence (online + available).
   */
  async pickLeastBusyAgent(eligibleAgentIds: string[]): Promise<string | null> {
    if (eligibleAgentIds.length === 0) return null;
    const load = await this.openLoadByAgent(eligibleAgentIds);
    const underCap = [...load.entries()]
      .filter(([, n]) => n < MAX_CONCURRENT_CHATS)
      .sort((a, b) => a[1] - b[1]);
    return underCap.length ? underCap[0][0] : null;
  }

  /**
   * Drain the Waiting queue onto available agents — the "pull on availability"
   * behaviour real desks have. Called when an agent comes online/toggles available
   * or frees a slot (resolve/release). Assigns the oldest waiting chats to the
   * least-loaded available agent, never exceeding any agent's capacity, and stops
   * when capacity runs out (the rest correctly keep waiting).
   */
  async distributeWaiting(availableAgentIds: string[]) {
    if (availableAgentIds.length === 0) return;
    const load = await this.openLoadByAgent(availableAgentIds);

    const totalCapacity = availableAgentIds.reduce(
      (sum, id) => sum + Math.max(0, MAX_CONCURRENT_CHATS - (load.get(id) ?? 0)),
      0,
    );
    if (totalCapacity <= 0) return;

    // Fetch only as many waiting chats as we can actually place this round.
    const waiting = await this.prisma.conversation.findMany({
      where: { agentId: null, status: ConversationStatus.OPEN },
      orderBy: { updatedAt: 'asc' }, // longest-waiting first (fair)
      take: totalCapacity,
      select: { id: true },
    });

    for (const w of waiting) {
      const next = [...load.entries()]
        .filter(([, n]) => n < MAX_CONCURRENT_CHATS)
        .sort((a, b) => a[1] - b[1])[0];
      if (!next) break;
      const agentId = next[0];
      const { count } = await this.prisma.conversation.updateMany({
        where: { id: w.id, agentId: null },
        data: { agentId },
      });
      if (count > 0) {
        load.set(agentId, (load.get(agentId) ?? 0) + 1);
        await this.emitChanged(w.id);
      }
    }
  }

  /**
   * Handle a customer's incoming message at the routing level:
   * - if the ticket was CLOSED, reopen it (the customer came back), and
   * - if nobody owns it, auto-assign the least-busy available agent.
   * Called by the gateway when a customer message lands.
   */
  async handleIncomingCustomerMessage(
    conversationId: string,
    availableAgentIds: string[],
  ) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true, agentId: true },
    });
    if (!convo) return;

    if (convo.status === ConversationStatus.CLOSED) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConversationStatus.OPEN },
      });
      await this.emitChanged(conversationId);
    }

    if (!convo.agentId) {
      await this.autoAssignIfUnassigned(conversationId, availableAgentIds);
    }
  }

  /**
   * Auto-assign an unassigned conversation to the least-busy available agent.
   *
   * The `updateMany ... where agentId: null` is the concurrency guard: if two
   * customer messages race, only the first flips `agentId` (count === 1); the
   * loser sees count === 0 and bails, so we never double-assign or emit twice.
   */
  async autoAssignIfUnassigned(
    conversationId: string,
    availableAgentIds: string[],
  ) {
    const agentId = await this.pickLeastBusyAgent(availableAgentIds);
    if (!agentId) return null;

    const { count } = await this.prisma.conversation.updateMany({
      where: { id: conversationId, agentId: null },
      data: { agentId },
    });
    if (count === 0) return null; // lost the race — someone else assigned it

    return this.emitChanged(conversationId);
  }

  /** Manual fallback: an agent grabs a conversation (takes over ownership). */
  async claim(conversationId: string, agent: AuthUser) {
    await this.getAccessibleConversation(conversationId, agent);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { agentId: agent.id },
    });
    return this.emitChanged(conversationId);
  }

  /** Manual fallback: hand a conversation back to the unassigned pool. */
  async release(conversationId: string, agent: AuthUser) {
    await this.getAccessibleConversation(conversationId, agent);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { agentId: null },
    });
    return this.emitChanged(conversationId);
  }

  // --- Ticket lifecycle ----------------------------------------------------

  /** Mark a ticket resolved — it leaves the active views (Closed view keeps it). */
  async resolve(conversationId: string, agent: AuthUser) {
    await this.getAccessibleConversation(conversationId, agent);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
    return this.emitChanged(conversationId);
  }

  /** Reopen a resolved ticket back into the active queue. */
  async reopen(conversationId: string, agent: AuthUser) {
    await this.getAccessibleConversation(conversationId, agent);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.OPEN },
    });
    return this.emitChanged(conversationId);
  }

  // --- helpers -------------------------------------------------------------

  /** WHERE clause for each agent view. */
  private viewWhere(
    agentId: string,
    view: AgentView,
  ): Prisma.ConversationWhereInput {
    switch (view) {
      case 'mine':
        return { agentId, status: ConversationStatus.OPEN };
      case 'waiting':
        return { agentId: null, status: ConversationStatus.OPEN };
      case 'closed':
        return { status: ConversationStatus.CLOSED };
      case 'all':
      default:
        return { status: ConversationStatus.OPEN };
    }
  }

  /** Flatten the 1-element `messages` array into a tidy `lastMessage` field. */
  private withLastMessage<T extends { messages: unknown[] }>(row: T) {
    const { messages, ...rest } = row;
    return { ...rest, lastMessage: messages[0] ?? null };
  }

  /** Re-read the conversation with relations and announce the change. */
  private async emitChanged(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (conversation) {
      this.events.emit(
        CONVERSATION_CHANGED,
        new ConversationChangedEvent(conversation),
      );
    }
    return conversation;
  }

  /** Agents can access all conversations; a customer only their own. */
  private assertAccess(conversation: Conversation, user: AuthUser) {
    if (user.role === Role.AGENT) {
      return;
    }
    if (conversation.customerId !== user.id) {
      throw new ForbiddenException('Not your conversation');
    }
  }
}
