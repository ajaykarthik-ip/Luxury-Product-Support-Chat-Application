import type { Conversation } from '@prisma/client';

/** Event name — shared by the emitter (service) and listener (gateway). */
export const CONVERSATION_CHANGED = 'conversation.changed';

/**
 * Raised whenever a conversation's metadata changes in a way the UI must reflect
 * live: ownership (auto-assign / claim / release) or status (resolve / reopen).
 * The gateway listens and broadcasts `conversation:updated` to the conversation
 * room (so the customer sees who joined / that it reopened) and the `agents` room
 * (so every dashboard moves the thread between views and refreshes counts).
 *
 * Keeping this a domain event means the assignment/status logic never touches
 * sockets directly — one broadcaster, no divergence.
 */
export class ConversationChangedEvent {
  constructor(
    public readonly conversation: Conversation & {
      agent: { id: string; name: string; email: string } | null;
    },
  ) {}
}
