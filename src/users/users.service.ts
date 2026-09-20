import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const SALT_ROUNDS = 10;

// Never expose the password hash.
const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: PUBLIC_USER,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER,
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  // A user editing their own profile: name and/or password. The email is the
  // account's identity and is not changeable here. Returns a fresh token so the
  // name inside it stays current.
  async updateMe(userId: number, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new one',
        );
      }
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const matches =
        !!current &&
        (await bcrypt.compare(dto.currentPassword, current.password));
      if (!matches) {
        throw new BadRequestException('Current password is incorrect');
      }
      data.password = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: PUBLIC_USER,
    });
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { user, access_token };
  }

  async adminUpdate(actorId: number, id: number, dto: AdminUpdateUserDto) {
    const target = await this.findOne(id);

    // Changing your own role could lock the last admin out.
    if (dto.role && dto.role !== target.role && id === actorId) {
      throw new BadRequestException("You can't change your own role");
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.role ? { role: dto.role } : {}),
      },
      select: PUBLIC_USER,
    });
  }

  // Their reservations and orders are kept (the link is just cleared), so the
  // restaurant's history isn't lost when an account goes away.
  async remove(actorId: number, id: number) {
    if (id === actorId) {
      throw new BadRequestException("You can't delete your own account");
    }
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }
}
