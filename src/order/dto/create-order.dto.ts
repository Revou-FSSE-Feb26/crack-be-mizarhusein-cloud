import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 1, description: 'Id of a menu item' })
  @IsInt()
  @Min(1)
  menuId: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @ApiProperty({ example: 'No onions', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

// Prices are intentionally NOT accepted here: the server looks each menu item up
// and computes the totals itself, so a client cannot underpay by editing the request.
export class CreateOrderDto {
  @ApiProperty({ example: 'Budi', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  customerName?: string;

  @ApiProperty({ example: 'A12', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNumber?: string;

  @ApiProperty({ example: 'Please bring the drinks first', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
