import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';

/**
 * Teaches Passport how to read and verify our JWTs.
 *
 * - `jwtFromRequest`: pull the token from the `Authorization: Bearer <token>` header.
 * - `secretOrKey`: the same secret we signed with — used to verify the signature.
 * - `validate()`: runs only AFTER the signature + expiry check passes. Whatever it
 *   returns is attached to the request as `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // getOrThrow: fail loudly at boot if JWT_SECRET is missing, rather than
      // silently signing/verifying with `undefined`.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
