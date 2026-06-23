import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The shape JwtStrategy.validate() puts on request.user. */
export interface AuthUser {
  id: string;
  email: string;
  role: import('@prisma/client').Role;
}

/**
 * Lets a controller grab the authenticated user directly:
 *   me(@CurrentUser() user: AuthUser) { ... }
 * instead of reaching into the raw request object.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
