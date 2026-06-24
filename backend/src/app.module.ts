import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Loads .env into process.env once, app-wide. `isGlobal` saves us from
    // re-importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),
    // App-wide in-process event bus. Lets the persistence layer (services) raise
    // domain events like `message.created` without importing the WebSocket
    // gateway — the gateway subscribes with @OnEvent and owns all socket I/O.
    // This decouples "what happened" from "who broadcasts it".
    EventEmitterModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    MessagesModule,
    ConversationsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // APP_GUARD registers a guard globally (applies to every route).
    // Order matters: JwtAuthGuard runs first (authenticates + sets request.user),
    // then RolesGuard checks the role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
