import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Payload for joining/leaving a conversation room. */
export class JoinConversationDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;
}

/** Payload for sending a message over the socket. */
export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
