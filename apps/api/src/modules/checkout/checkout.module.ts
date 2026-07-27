import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHECKOUT_REPOSITORY } from './application/checkout.repository';
import { CreatePendingTransactionUseCase } from './application/create-pending-transaction.use-case';
import { GetProductUseCase } from './application/get-product.use-case';
import { GetTransactionUseCase } from './application/get-transaction.use-case';
import { GetPaymentConfigurationUseCase } from './application/get-payment-configuration.use-case';
import { PAYMENT_GATEWAY } from './application/payment.gateway';
import type { PaymentGateway } from './application/payment.gateway';
import type { CheckoutRepository } from './application/checkout.repository';
import { StartPaymentUseCase } from './application/start-payment.use-case';
import { SyncPaymentUseCase } from './application/sync-payment.use-case';
import { CatalogSeedService } from './infrastructure/catalog-seed.service';
import { DynamoDbCheckoutRepository } from './infrastructure/dynamodb-checkout.repository';
import { InMemoryCheckoutRepository } from './infrastructure/in-memory-checkout.repository';
import { WompiPaymentGateway } from './infrastructure/wompi-payment.gateway';
import { CheckoutController } from './interfaces/http/checkout.controller';

@Module({
  controllers: [CheckoutController],
  providers: [
    {
      provide: CHECKOUT_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const tableName = config.get<string>('PAYMENTS_TABLE_NAME');
        if (tableName === undefined) {
          return new InMemoryCheckoutRepository();
        }

        const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
          marshallOptions: {
            removeUndefinedValues: true,
          },
        });
        return new DynamoDbCheckoutRepository(client, tableName);
      },
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new WompiPaymentGateway(
          config.getOrThrow<string>('WOMPI_API_URL'),
          config.get<string>('WOMPI_PUBLIC_KEY'),
          config.get<string>('WOMPI_PRIVATE_KEY'),
          config.get<string>('WOMPI_INTEGRITY_SECRET'),
        ),
    },
    CatalogSeedService,
    {
      provide: CreatePendingTransactionUseCase,
      inject: [CHECKOUT_REPOSITORY],
      useFactory: (repository: CheckoutRepository) =>
        new CreatePendingTransactionUseCase(repository),
    },
    {
      provide: GetProductUseCase,
      inject: [CHECKOUT_REPOSITORY],
      useFactory: (repository: CheckoutRepository) =>
        new GetProductUseCase(repository),
    },
    {
      provide: GetTransactionUseCase,
      inject: [CHECKOUT_REPOSITORY],
      useFactory: (repository: CheckoutRepository) =>
        new GetTransactionUseCase(repository),
    },
    {
      provide: GetPaymentConfigurationUseCase,
      inject: [PAYMENT_GATEWAY],
      useFactory: (gateway: PaymentGateway) =>
        new GetPaymentConfigurationUseCase(gateway),
    },
    {
      provide: StartPaymentUseCase,
      inject: [CHECKOUT_REPOSITORY, PAYMENT_GATEWAY],
      useFactory: (repository: CheckoutRepository, gateway: PaymentGateway) =>
        new StartPaymentUseCase(repository, gateway),
    },
    {
      provide: SyncPaymentUseCase,
      inject: [CHECKOUT_REPOSITORY, PAYMENT_GATEWAY],
      useFactory: (repository: CheckoutRepository, gateway: PaymentGateway) =>
        new SyncPaymentUseCase(repository, gateway),
    },
  ],
})
export class CheckoutModule {}
