import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { RateConversationDto } from './dto/rate-conversation.dto';

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

  // Role-aware list. Agents get a paginated, filtered "view" of the queue;
  // customers get their own conversations. Both return `{ items, total }`.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListConversationsDto) {
    if (user.role === Role.AGENT) {
      return this.conversations.findForAgent(
        user.id,
        query.view ?? 'all',
        query.skip ?? 0,
        query.take ?? 30,
      );
    }
    return this.conversations.findForCustomer(user.id);
  }

  // Per-view counts for the dashboard tab badges. Declared before `:id` so the
  // literal path wins over the param route.
  @Roles(Role.AGENT)
  @Get('counts')
  counts(@CurrentUser() user: AuthUser) {
    return this.conversations.countsForAgent(user.id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.findOneForUser(id, user);
  }

  // --- Agent routing + ticket lifecycle (agent-only) ---

  // Take over a waiting/unassigned chat. Broadcasts the new owner.
  @Roles(Role.AGENT)
  @Patch(':id/claim')
  claim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.claim(id, user);
  }

  // Hand a chat back to the unassigned pool.
  @Roles(Role.AGENT)
  @Patch(':id/release')
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.release(id, user);
  }

  // Resolve (close) a ticket — leaves the active views.
  @Roles(Role.AGENT)
  @Patch(':id/resolve')
  resolve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.resolve(id, user);
  }

  // Reopen a resolved ticket back into the queue.
  @Roles(Role.AGENT)
  @Patch(':id/reopen')
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.reopen(id, user);
  }

  // Customer rates their resolved ticket (CSAT, 1–5).
  @Roles(Role.CUSTOMER)
  @Patch(':id/rating')
  rate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RateConversationDto,
  ) {
    return this.conversations.rate(id, user, dto.rating);
  }

  // --- Messages, nested under a conversation so access is checked in one place ---

  @Get(':id/messages')
  async listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.conversations.getAccessibleConversation(id, user);
    return this.messages.findForConversation(id);
  }

  // REST send (fallback / callback form). Real-time delivery is via the gateway,
  // which reuses this same MessagesService.
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
