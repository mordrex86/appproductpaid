import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CustomerDto {
  @ApiProperty({ example: 'Ana Torres' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName!: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail()
  @Length(5, 254)
  email!: string;

  @ApiProperty({ example: '+573001234567' })
  @IsPhoneNumber()
  phone!: string;
}

export class DeliveryDto {
  @ApiProperty({ example: 'Carrera 7 # 80-10, apartamento 301' })
  @IsString()
  @Length(5, 160)
  addressLine!: string;

  @ApiProperty({ example: 'Bogotá' })
  @IsString()
  @Length(2, 80)
  city!: string;

  @ApiProperty({ example: 'Cundinamarca' })
  @IsString()
  @Length(2, 80)
  region!: string;

  @ApiProperty({ example: '110221' })
  @IsString()
  @Length(3, 12)
  postalCode!: string;
}

export class CreatePendingTransactionDto {
  @ApiProperty({ example: 'wireless-headphones' })
  @IsString()
  @Length(3, 80)
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: DeliveryDto })
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;
}
