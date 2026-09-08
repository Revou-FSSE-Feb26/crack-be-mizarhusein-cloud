import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: 'budi@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+62 812 3456 7890' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @IsPositive()
  partySize: number;

  @ApiProperty({ example: '2026-08-01T19:00:00.000Z' })
  @IsISO8601()
  date: string;

  @ApiProperty({ example: 'Window seat please', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
