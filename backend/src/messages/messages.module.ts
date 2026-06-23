import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';

/**
 * No controller here — message HTTP routes live under ConversationsController
 * (nested as /conversations/:id/messages) so the conversation access check
 * happens in one place. We only export the service for reuse.
 */
@Module({
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
