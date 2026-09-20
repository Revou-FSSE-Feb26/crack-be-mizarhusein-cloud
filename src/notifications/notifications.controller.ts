import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/jwt.strategy';
import { Auth, CurrentUser } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('admin')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Unread count plus the latest reservations and orders (each flagged isNew).
  // The dashboard polls this every few seconds.
  @Auth(Role.ADMIN)
  @Get()
  getFeed(@CurrentUser() admin: AuthUser) {
    return this.notificationsService.getFeed(admin.userId);
  }

  // The admin opened the bell: mark everything so far as seen.
  @Auth(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('seen')
  markSeen(@CurrentUser() admin: AuthUser) {
    return this.notificationsService.markSeen(admin.userId);
  }
}
