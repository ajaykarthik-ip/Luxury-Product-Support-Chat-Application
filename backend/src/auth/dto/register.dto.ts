import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Shape + validation rules for the register request body.
 *
 * The decorators are checked at runtime by the global ValidationPipe (set up in
 * main.ts). If the incoming JSON violates any rule, Nest returns 400 with the
 * reason — we never reach the controller with bad data.
 */
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  // Optional. Defaults to CUSTOMER in UsersService if omitted.
  // (In a stricter app you'd never let a client self-assign AGENT — noted in docs.)
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
