import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [MessagesModule], // to inject MessagesService into the controller
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService], // the WebSocket gateway (Phase 5) will need it
})
export class ConversationsModule {}
