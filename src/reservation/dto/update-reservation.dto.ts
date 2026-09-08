import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { CreateReservationDto } from './create-reservation.dto';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @ApiProperty({ enum: ReservationStatus, required: false })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
