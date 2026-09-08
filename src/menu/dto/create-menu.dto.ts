import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 'Chicken Kebab' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example:
      'Grilled chicken kebab dengan rempah khas Timur Tengah, disajikan dengan nasi dan salad segar.',
    required: false,
  })
  @IsString()
  description: string;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: '/menu/pizza/margherita.png', required: false })
  @IsString()
  image: string;

  @ApiProperty({ example: 'pizza' })
  @IsString()
  @IsNotEmpty()
  category: string;
}
