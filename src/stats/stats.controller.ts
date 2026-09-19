import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/roles.decorator';
import { StatsService } from './stats.service';

@ApiTags('admin')
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // Powers the admin dashboard; includes customer names and order totals.
  @Auth(Role.ADMIN)
  @Get()
  getDashboard() {
    return this.statsService.getDashboard();
  }
}
