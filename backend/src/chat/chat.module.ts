import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatGateway } from './chat.gateway';

/**
 * Imports:
 * - AuthModule       → JwtService (to verify the handshake token)
 * - ConversationsModule → access checks (reuses REST rules)
 * - MessagesModule   → persist messages (same logic as REST)
 */
@Module({
  imports: [AuthModule, ConversationsModule, MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}
