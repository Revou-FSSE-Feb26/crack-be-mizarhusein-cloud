import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReservationDto) {
    return this.prisma.reservation.create({
      data: { ...dto, date: new Date(dto.date) },
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
