import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  MESSAGE_CREATED,
  MessageCreatedEvent,
} from './events/message-created.event';

/**
 * Owns the `message` table. Deliberately separate from ConversationsService so
 * the WebSocket gateway (Phase 5) can reuse `create()` for real-time sends —
 * REST and WebSocket will share the exact same persistence logic.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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

    // Bump the conversation's updatedAt so "active chats" sort by recent activity.
    // (Assignment-on-reply is handled by the gateway's `claimIfUnassigned`, which
    // also broadcasts `conversation:updated` — keeping every socket emit in one
    // place so the dashboard updates live instead of only after a refresh.)
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Raise a domain event. The ChatGateway listens and does the socket
    // broadcast — so REST sends (callback form) and WebSocket sends share one
    // real-time path, and this service never has to know sockets exist.
    this.events.emit(MESSAGE_CREATED, new MessageCreatedEvent(message));

    return message;
  }
}
