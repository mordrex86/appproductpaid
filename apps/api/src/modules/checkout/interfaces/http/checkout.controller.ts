import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetProductUseCase } from '../../application/get-product.use-case';
import { GetTransactionUseCase } from '../../application/get-transaction.use-case';
import { CreatePendingTransactionUseCase } from '../../application/create-pending-transaction.use-case';
import { GetPaymentConfigurationUseCase } from '../../application/get-payment-configuration.use-case';
import { StartPaymentUseCase } from '../../application/start-payment.use-case';
import { SyncPaymentUseCase } from '../../application/sync-payment.use-case';
import {
  IdempotencyConflictError,
  InsufficientStockError,
  ProductNotFoundError,
  PaymentConfigurationError,
  PaymentProviderError,
  TransactionNotFoundError,
} from '../../application/checkout.errors';
import { CreatePendingTransactionDto, StartPaymentDto } from './checkout.dto';

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
  @ApiOkResponse({ description: 'Producto encontrado.' })
  @ApiNotFoundResponse({ description: 'Producto no encontrado.' })
  async findProduct(@Param('productId') productId: string) {
    try {
      return await this.getProduct.execute(productId);
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: error.message,
        });
      }
      throw error;
    }
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
  @ApiCreatedResponse({ description: 'Transacción pendiente creada.' })
  @ApiConflictResponse({
    description: 'Stock insuficiente o clave idempotente incompatible.',
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

    try {
      return await this.createPendingTransaction.execute({
        idempotencyKey,
        productId: body.productId,
        quantity: body.quantity,
        customer: body.customer,
        delivery: body.delivery,
      });
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: error.message,
        });
      }
      if (error instanceof InsufficientStockError) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: error.message,
        });
      }
      if (error instanceof IdempotencyConflictError) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Consultar el estado de una transacción' })
  @ApiOkResponse({ description: 'Transacción encontrada.' })
  @ApiNotFoundResponse({ description: 'Transacción no encontrada.' })
  async findTransaction(@Param('transactionId') transactionId: string) {
    try {
      return await this.getTransaction.execute(transactionId);
    } catch (error) {
      if (error instanceof TransactionNotFoundError) {
        throw new NotFoundException({
          code: 'TRANSACTION_NOT_FOUND',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Get('payments/config')
  @ApiOperation({
    summary: 'Consultar configuración pública y contratos de pago',
  })
  @ApiOkResponse({ description: 'Configuración Sandbox disponible.' })
  async paymentConfiguration() {
    try {
      return await this.getPaymentConfiguration.execute();
    } catch (error) {
      this.rethrowPaymentError(error);
    }
  }

  @Post('transactions/:transactionId/payment')
  @ApiOperation({ summary: 'Iniciar el pago de una transacción pendiente' })
  @ApiOkResponse({ description: 'Pago enviado al proveedor.' })
  async pay(
    @Param('transactionId') transactionId: string,
    @Body() body: StartPaymentDto,
  ) {
    try {
      return await this.startPayment.execute({
        transactionId,
        paymentToken: body.paymentToken,
        acceptanceToken: body.acceptanceToken,
        personalDataToken: body.personalDataToken,
      });
    } catch (error) {
      this.rethrowPaymentError(error);
    }
  }

  @Post('transactions/:transactionId/payment/status')
  @ApiOperation({
    summary: 'Sincronizar el estado del pago y actualizar inventario',
  })
  @ApiOkResponse({ description: 'Estado del pago sincronizado.' })
  async sync(@Param('transactionId') transactionId: string) {
    try {
      return await this.syncPayment.execute(transactionId);
    } catch (error) {
      this.rethrowPaymentError(error);
    }
  }

  private rethrowPaymentError(error: unknown): never {
    if (error instanceof TransactionNotFoundError) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: error.message,
      });
    }
    if (
      error instanceof PaymentConfigurationError ||
      error instanceof PaymentProviderError
    ) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_SERVICE_UNAVAILABLE',
        message: error.message,
      });
    }
    if (error instanceof InsufficientStockError) {
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: error.message,
      });
    }
    throw error;
  }
}
