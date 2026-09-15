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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  // Public: customers submit a booking from the site without logging in.
  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationService.create(dto);
  }

  // Admin-only below: reservation lists/details contain customer PII.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('status') status?: ReservationStatus) {
    return this.reservationService.findAll(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationService.update(id, dto);
  }

  // Cancels the reservation (sets status = CANCELLED) rather than deleting it.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.cancel(id);
  }
}
