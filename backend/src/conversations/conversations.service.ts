import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

// Shape we pull customer/product details into for list/detail responses.
const conversationInclude = {
  product: true,
  customer: { select: { id: true, name: true, email: true } },
  agent: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Agents see EVERY conversation (their whole queue); customers see only their
   * own. Sorted by most recent activity so active chats float to the top.
   */
  findAllForUser(user: AuthUser) {
    const where = user.role === Role.AGENT ? {} : { customerId: user.id };
    return this.prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: conversationInclude,
    });
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
   * Lightweight access check used by the message endpoints (and later the
   * WebSocket gateway): confirms the conversation exists and the user may touch
   * it. Returns the row so callers can reuse it.
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
