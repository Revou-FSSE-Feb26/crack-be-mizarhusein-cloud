import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import type { AuthUser } from '../auth/jwt.strategy';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { Auth, CurrentUser } from '../auth/roles.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Public: the digital menu at the venue lets guests order without an account.
  // If a valid token is sent, the order is linked to that customer's account.
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser | null) {
    return this.orderService.create(dto, user?.userId ?? null);
  }

  // A logged-in customer's own order history. Declared before ':id'.
  @Auth()
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orderService.findMine(user.userId);
  }

  // Admin-only below: orders show what and how much each guest ordered.
  @Auth(Role.ADMIN)
  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.orderService.findAll(status);
  }

  @Auth(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOne(id);
  }

  @Auth(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto.status);
  }
}
