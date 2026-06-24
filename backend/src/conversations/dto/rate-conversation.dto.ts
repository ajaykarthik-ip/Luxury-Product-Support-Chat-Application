import { IsInt, Max, Min } from 'class-validator';

/** Body for `PATCH /conversations/:id/rating` — a 1–5 CSAT score. */
export class RateConversationDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
