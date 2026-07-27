import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TRANSACTION_STATUS } from '../../domain/transaction';

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

export class StartPaymentDto {
  @ApiProperty({ description: 'Token de tarjeta generado por Wompi' })
  @IsString()
  @Length(8, 180)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  paymentToken!: string;

  @ApiProperty({ description: 'Token de aceptación de términos' })
  @IsString()
  @Length(8, 2_000)
  acceptanceToken!: string;

  @ApiProperty({ description: 'Token de autorización de datos personales' })
  @IsString()
  @Length(8, 2_000)
  personalDataToken!: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: 'wireless-headphones' })
  id!: string;

  @ApiProperty({ example: 'Audífonos inalámbricos' })
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: 12_990_000 })
  priceInCents!: number;

  @ApiProperty({ example: 12 })
  stock!: number;
}

export class TransactionAmountsResponseDto {
  @ApiProperty({ example: 12_990_000 })
  product!: number;

  @ApiProperty({ example: 200_000 })
  baseFee!: number;

  @ApiProperty({ example: 800_000 })
  deliveryFee!: number;

  @ApiProperty({ example: 13_990_000 })
  total!: number;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'wireless-headphones' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ minimum: 1, example: 1 })
  quantity!: number;

  @ApiProperty({ enum: Object.values(TRANSACTION_STATUS) })
  status!: string;

  @ApiPropertyOptional()
  providerTransactionId?: string;

  @ApiProperty({ type: TransactionAmountsResponseDto })
  amounts!: TransactionAmountsResponseDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PaymentAgreementResponseDto {
  @ApiProperty()
  acceptanceToken!: string;

  @ApiProperty({ format: 'uri' })
  permalink!: string;
}

export class PaymentConfigurationResponseDto {
  @ApiProperty()
  publicKey!: string;

  @ApiProperty({ format: 'uri' })
  tokenizationUrl!: string;

  @ApiProperty({ type: PaymentAgreementResponseDto })
  terms!: PaymentAgreementResponseDto;

  @ApiProperty({ type: PaymentAgreementResponseDto })
  personalData!: PaymentAgreementResponseDto;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 'PRODUCT_NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Product not found' })
  message!: string;
}
