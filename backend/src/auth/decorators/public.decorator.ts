import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as open (no JWT required).
 *
 * We make JwtAuthGuard global (in AppModule), so EVERY route requires a token by
 * default — the safe default. Routes like register/login opt out with @Public().
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
