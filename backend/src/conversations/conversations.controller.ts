import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  // Only a customer initiates a chat. customerId comes from the token.
  @Roles(Role.CUSTOMER)
  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversations.findOrCreate(user.id, dto.productId);
  }

  // Role-aware: agents get all conversations, customers get their own.
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversations.findAllForUser(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.findOneForUser(id, user);
  }

  // --- Messages, nested under a conversation so access is checked in one place ---

  @Get(':id/messages')
  async listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.conversations.getAccessibleConversation(id, user);
    return this.messages.findForConversation(id);
  }

  // REST send (a fallback / for testing). Real-time delivery comes via the
  // WebSocket gateway in Phase 5, which will reuse this same MessagesService.
  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    await this.conversations.getAccessibleConversation(id, user);
    return this.messages.create({
      conversationId: id,
      sender: user,
      content: dto.content,
    });
  }
}
