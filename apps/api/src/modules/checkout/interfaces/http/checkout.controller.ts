import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetProductUseCase } from '../../application/get-product.use-case';
import { GetTransactionUseCase } from '../../application/get-transaction.use-case';
import { CreatePendingTransactionUseCase } from '../../application/create-pending-transaction.use-case';
import { GetPaymentConfigurationUseCase } from '../../application/get-payment-configuration.use-case';
import { StartPaymentUseCase } from '../../application/start-payment.use-case';
import { SyncPaymentUseCase } from '../../application/sync-payment.use-case';
import type { Result } from '../../application/result';
import {
  CreatePendingTransactionDto,
  ErrorResponseDto,
  PaymentConfigurationResponseDto,
  ProductResponseDto,
  StartPaymentDto,
  TransactionResponseDto,
} from './checkout.dto';
import { rethrowCheckoutHttpError } from './checkout-http-error';

@ApiTags('checkout')
@Controller()
export class CheckoutController {
  constructor(
    @Inject(GetProductUseCase)
    private readonly getProduct: GetProductUseCase,
    @Inject(CreatePendingTransactionUseCase)
    private readonly createPendingTransaction: CreatePendingTransactionUseCase,
    @Inject(GetTransactionUseCase)
    private readonly getTransaction: GetTransactionUseCase,
    @Inject(GetPaymentConfigurationUseCase)
    private readonly getPaymentConfiguration: GetPaymentConfigurationUseCase,
    @Inject(StartPaymentUseCase)
    private readonly startPayment: StartPaymentUseCase,
    @Inject(SyncPaymentUseCase)
    private readonly syncPayment: SyncPaymentUseCase,
  ) {}

  @Get('products/:productId')
  @ApiOperation({ summary: 'Consultar un producto y su stock disponible' })
  @ApiParam({
    name: 'productId',
    description: 'Identificador del producto',
    example: 'wireless-headphones',
  })
  @ApiOkResponse({
    description: 'Producto encontrado.',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado.',
    type: ErrorResponseDto,
  })
  async findProduct(@Param('productId') productId: string) {
    return this.handle(() => this.getProduct.execute(productId));
  }

  @Post('transactions')
  @ApiOperation({
    summary: 'Crear una transacción pendiente con cliente y entrega',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID único por intento de compra',
    required: true,
  })
  @ApiBody({ type: CreatePendingTransactionDto })
  @ApiCreatedResponse({
    description: 'Transacción pendiente creada.',
    type: TransactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Solicitud o clave de idempotencia inválida.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Stock insuficiente o clave idempotente incompatible.',
    type: ErrorResponseDto,
  })
  async createTransaction(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreatePendingTransactionDto,
  ) {
    if (
      idempotencyKey === undefined ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)
    ) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message:
          'Idempotency-Key must contain between 16 and 128 safe characters',
      });
    }

    return this.handle(() =>
      this.createPendingTransaction.execute({
        idempotencyKey,
        productId: body.productId,
        quantity: body.quantity,
        customer: body.customer,
        delivery: body.delivery,
      }),
    );
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Consultar el estado de una transacción' })
  @ApiParam({
    name: 'transactionId',
    description: 'Identificador de la transacción',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Transacción encontrada.',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  async findTransaction(@Param('transactionId') transactionId: string) {
    return this.handle(() => this.getTransaction.execute(transactionId));
  }

  @Get('payments/config')
  @ApiOperation({
    summary: 'Consultar configuración pública y contratos de pago',
  })
  @ApiOkResponse({
    description: 'Configuración Sandbox disponible.',
    type: PaymentConfigurationResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'El proveedor de pagos no está disponible.',
    type: ErrorResponseDto,
  })
  async paymentConfiguration() {
    return this.handle(() => this.getPaymentConfiguration.execute());
  }

  @Post('transactions/:transactionId/payment')
  @ApiOperation({ summary: 'Iniciar el pago de una transacción pendiente' })
  @ApiParam({
    name: 'transactionId',
    description: 'Identificador de la transacción',
    format: 'uuid',
  })
  @ApiBody({ type: StartPaymentDto })
  @ApiOkResponse({
    description: 'Pago enviado al proveedor.',
    type: TransactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de pago inválidos.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Stock insuficiente para procesar el pago.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'El proveedor de pagos no está disponible.',
    type: ErrorResponseDto,
  })
  async pay(
    @Param('transactionId') transactionId: string,
    @Body() body: StartPaymentDto,
  ) {
    return this.handle(() =>
      this.startPayment.execute({
        transactionId,
        paymentToken: body.paymentToken,
        acceptanceToken: body.acceptanceToken,
        personalDataToken: body.personalDataToken,
      }),
    );
  }

  @Post('transactions/:transactionId/payment/status')
  @ApiOperation({
    summary: 'Sincronizar el estado del pago y actualizar inventario',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Identificador de la transacción',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Estado del pago sincronizado.',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'El proveedor de pagos no está disponible.',
    type: ErrorResponseDto,
  })
  async sync(@Param('transactionId') transactionId: string) {
    return this.handle(() => this.syncPayment.execute(transactionId));
  }

  private async handle<T>(
    action: () => Promise<Result<T, unknown>>,
  ): Promise<T> {
    try {
      const result = await action();
      if (!result.ok) rethrowCheckoutHttpError(result.error);
      return result.value;
    } catch (error) {
      rethrowCheckoutHttpError(error);
    }
  }
}
