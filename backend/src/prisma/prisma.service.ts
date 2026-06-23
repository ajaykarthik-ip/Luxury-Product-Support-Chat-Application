import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps Prisma's generated client as an injectable NestJS provider.
 *
 * - Extending `PrismaClient` means this service IS the client: you call
 *   `this.prisma.user.findMany()` etc. from anywhere it's injected.
 * - `OnModuleInit` is a NestJS lifecycle hook; `$connect()` opens the DB
 *   connection pool when the module boots (instead of lazily on first query).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
