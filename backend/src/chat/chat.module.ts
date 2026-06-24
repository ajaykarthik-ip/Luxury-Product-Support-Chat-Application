import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { AgentPresenceService } from './agent-presence.service';
import { ChatGateway } from './chat.gateway';

/**
 * Imports:
 * - AuthModule       → JwtService (to verify the handshake token)
 * - ConversationsModule → access checks + agent routing (reuses REST rules)
 * - MessagesModule   → persist messages (same logic as REST)
 *
 * Providers:
 * - ChatGateway         → the Socket.IO transport
 * - AgentPresenceService → in-memory "who's online" registry for auto-routing
 */
@Module({
  imports: [AuthModule, ConversationsModule, MessagesModule],
  providers: [ChatGateway, AgentPresenceService],
})
export class ChatModule {}
