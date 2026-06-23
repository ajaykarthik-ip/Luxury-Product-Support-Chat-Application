import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * The customer only needs to say WHICH product they want to chat about.
 * The customer id comes from the JWT, never the request body — a client must
 * not be able to open a conversation "as" someone else.
 */
export class CreateConversationDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;
}
