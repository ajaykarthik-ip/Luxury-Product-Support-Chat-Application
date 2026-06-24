import type { Message, Role } from '@prisma/client';

/** Event name — referenced by both the emitter (service) and listener (gateway). */
export const MESSAGE_CREATED = 'message.created';

/**
 * Payload for the `message.created` domain event. Carries the persisted message
 * (with its sender) so the gateway can broadcast without another DB round-trip.
 * Raised by MessagesService regardless of origin (REST or WebSocket), so the
 * gateway is the single place that turns a saved message into socket traffic.
 */
export class MessageCreatedEvent {
  constructor(
    public readonly message: Message & {
      sender: { id: string; name: string; role: Role };
    },
  ) {}
}
