import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReservationStatus, Role } from '@prisma/client';
import type { AuthUser } from '../auth/jwt.strategy';
import { Auth, CurrentUser } from '../auth/roles.decorator';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  // Any logged-in user (customers, and admins booking on someone's behalf).
  // The booking is linked to the caller's account.
  @Auth()
  @Post()
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthUser) {
    return this.reservationService.create(dto, user.userId);
  }

  // Customer self-service. Declared before ':id' so "me" isn't parsed as an id.
  @Auth()
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.reservationService.findMine(user.userId);
  }

  @Auth()
  @Delete('me/:id')
  cancelMine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservationService.cancelMine(user.userId, id);
  }

  // Admin-only below: these expose every customer's personal details.
  @Auth(Role.ADMIN)
  @Get()
  findAll(@Query('status') status?: ReservationStatus) {
    return this.reservationService.findAll(status);
  }

  @Auth(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.findOne(id);
  }

  @Auth(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationService.update(id, dto);
  }

  // Cancels the reservation (sets status = CANCELLED) rather than deleting it.
  @Auth(Role.ADMIN)
  @Delete(':id')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.cancel(id);
  }
}
