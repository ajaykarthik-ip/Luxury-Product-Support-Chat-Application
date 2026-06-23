import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns the `message` table. Deliberately separate from ConversationsService so
 * the WebSocket gateway (Phase 5) can reuse `create()` for real-time sends —
 * REST and WebSocket will share the exact same persistence logic.
 */
@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // Full history for a conversation, oldest first (natural reading order).
  // Uses the @@index([conversationId, createdAt]) we defined on Message.
  findForConversation(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  async create(params: {
    conversationId: string;
    sender: AuthUser;
    content: string;
  }) {
    const { conversationId, sender, content } = params;

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: sender.id, content },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    // Bump the conversation's updatedAt so "active chats" sort by recent activity,
    // and claim it for the agent who replies (helps the agent's thread list).
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(sender.role === Role.AGENT
          ? { agent: { connect: { id: sender.id } } }
          : {}),
      },
    });

    return message;
  }
}
