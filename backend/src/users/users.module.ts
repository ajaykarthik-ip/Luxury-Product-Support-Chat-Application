import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Exports UsersService so other modules (e.g. AuthModule) can inject it.
 * A provider is only visible outside its module if it's listed in `exports`.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
