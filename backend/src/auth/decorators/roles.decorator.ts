import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Attaches a list of allowed roles to a route, e.g. @Roles(Role.AGENT).
 * RolesGuard reads this metadata to decide who may call the handler.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
