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
  @ApiProperty({ example: 'Ana Torres', type: String })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName!: string;

  @ApiProperty({ example: 'ana@example.com', type: String })
  @IsEmail()
  @Length(5, 254)
  email!: string;

  @ApiProperty({ example: '+573001234567', type: String })
  @IsPhoneNumber()
  phone!: string;
}

export class DeliveryDto {
  @ApiProperty({
    example: 'Carrera 7 # 80-10, apartamento 301',
    type: String,
  })
  @IsString()
  @Length(5, 160)
  addressLine!: string;

  @ApiProperty({ example: 'Bogotá', type: String })
  @IsString()
  @Length(2, 80)
  city!: string;

  @ApiProperty({ example: 'Cundinamarca', type: String })
  @IsString()
  @Length(2, 80)
  region!: string;

  @ApiProperty({ example: '110221', type: String })
  @IsString()
  @Length(3, 12)
  postalCode!: string;
}

export class CreatePendingTransactionDto {
  @ApiProperty({ example: 'wireless-headphones', type: String })
  @IsString()
  @Length(3, 80)
  productId!: string;

  @ApiProperty({ example: 1, maximum: 10, minimum: 1, type: Number })
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
  @ApiProperty({
    description: 'Token de tarjeta generado por Wompi',
    type: String,
  })
  @IsString()
  @Length(8, 180)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  paymentToken!: string;

  @ApiProperty({
    description: 'Token de aceptación de términos',
    type: String,
  })
  @IsString()
  @Length(8, 2_000)
  acceptanceToken!: string;

  @ApiProperty({
    description: 'Token de autorización de datos personales',
    type: String,
  })
  @IsString()
  @Length(8, 2_000)
  personalDataToken!: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: 'wireless-headphones', type: String })
  id!: string;

  @ApiProperty({ example: 'Audífonos inalámbricos', type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ example: 12_990_000, type: Number })
  priceInCents!: number;

  @ApiProperty({ example: 12, type: Number })
  stock!: number;
}

export class TransactionAmountsResponseDto {
  @ApiProperty({ example: 12_990_000, type: Number })
  product!: number;

  @ApiProperty({ example: 200_000, type: Number })
  baseFee!: number;

  @ApiProperty({ example: 800_000, type: Number })
  deliveryFee!: number;

  @ApiProperty({ example: 13_990_000, type: Number })
  total!: number;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'wireless-headphones', type: String })
  productId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  customerId!: string;

  @ApiProperty({ example: 1, minimum: 1, type: Number })
  quantity!: number;

  @ApiProperty({ enum: Object.values(TRANSACTION_STATUS), type: String })
  status!: string;

  @ApiPropertyOptional({ type: String })
  providerTransactionId?: string;

  @ApiProperty({ type: TransactionAmountsResponseDto })
  amounts!: TransactionAmountsResponseDto;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class PaymentAgreementResponseDto {
  @ApiProperty({ type: String })
  acceptanceToken!: string;

  @ApiProperty({ format: 'uri', type: String })
  permalink!: string;
}

export class PaymentConfigurationResponseDto {
  @ApiProperty({ type: String })
  publicKey!: string;

  @ApiProperty({ format: 'uri', type: String })
  tokenizationUrl!: string;

  @ApiProperty({ type: PaymentAgreementResponseDto })
  terms!: PaymentAgreementResponseDto;

  @ApiProperty({ type: PaymentAgreementResponseDto })
  personalData!: PaymentAgreementResponseDto;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 'PRODUCT_NOT_FOUND', type: String })
  code!: string;

  @ApiProperty({ example: 'Product not found', type: String })
  message!: string;
}
