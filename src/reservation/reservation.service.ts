import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReservationDto, userId: number) {
    return this.prisma.reservation.create({
      data: { ...dto, date: new Date(dto.date), userId },
    });
  }

  // A customer's own bookings, soonest first.
  findMine(userId: number) {
    return this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  // Customers may cancel their own upcoming bookings. A booking that belongs to
  // someone else is reported as 404 so ids of other people's bookings can't be probed.
  async cancelMine(userId: number, id: number) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, userId },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation with id ${id} not found`);
    }
    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Only pending or confirmed reservations can be cancelled (this one is ${reservation.status.toLowerCase()})`,
      );
    }
    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  findAll(status?: ReservationStatus) {
    return this.prisma.reservation.findMany({
      where: status ? { status } : undefined,
      orderBy: { date: 'asc' },
    });
  }

  async findOne(id: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation with id ${id} not found`);
    }
    return reservation;
  }

  async update(id: number, dto: UpdateReservationDto) {
    await this.findOne(id);
    const { date, ...rest } = dto;
    return this.prisma.reservation.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    });
  }

  // DELETE /reservations/:id cancels the booking instead of removing the row,
  // so reservation history is preserved for reporting.
  async cancel(id: number) {
    await this.findOne(id);
    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }
}
