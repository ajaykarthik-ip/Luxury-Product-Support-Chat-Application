import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns everything about User records. Auth logic lives in AuthService;
 * this service is the only place that touches the `user` table, so the
 * password-hashing rule lives in exactly one spot.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    email: string;
    password: string;
    name: string;
    role?: Role;
  }): Promise<User> {
    // Friendly 409 instead of letting the DB unique constraint throw a raw error.
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Never store the plaintext password. 10 = bcrypt salt rounds (cost factor).
    const passwordHash = await bcrypt.hash(input.password, 10);

    return this.prisma.user.create({
      data: {
        email: input.email,
        password: passwordHash,
        name: input.name,
        role: input.role ?? Role.CUSTOMER,
      },
    });
  }

  // Returns the full record (incl. password hash) — used by login to verify.
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
