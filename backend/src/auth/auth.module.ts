import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule, // gives us UsersService
    PassportModule,
    // registerAsync so we can pull the secret/expiry from ConfigService (.env)
    // instead of hardcoding them.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // `ms` types expiresIn as a template-literal (e.g. "1d"); our env value
          // is a plain string, so we assert it to the option's expected type.
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
            '1d',
          ) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // Export JwtModule so other modules (e.g. ChatModule's gateway) can inject
  // JwtService to verify the handshake token with the same secret/config.
  exports: [JwtModule],
})
export class AuthModule {}
