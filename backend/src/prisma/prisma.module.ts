import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Makes PrismaService available app-wide.
 *
 * `@Global()` means we register this module once (in AppModule) and every
 * other module can inject PrismaService without re-importing PrismaModule.
 * `exports` is what makes the provider visible outside this module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
