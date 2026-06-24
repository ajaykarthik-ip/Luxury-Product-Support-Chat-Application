import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { AgentView } from '../conversations.service';

/**
 * Query params for the agent dashboard list: which view, and a page window.
 * `@Type(() => Number)` is needed because query strings arrive as text — the
 * global ValidationPipe (transform: true) then coerces and validates them.
 */
export class ListConversationsDto {
  @IsOptional()
  @IsIn(['mine', 'waiting', 'all', 'closed'])
  view?: AgentView;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
