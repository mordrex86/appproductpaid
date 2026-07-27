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
    CreatePendingTransactionUseCase,
    GetPaymentConfigurationUseCase,
    GetProductUseCase,
    GetTransactionUseCase,
    StartPaymentUseCase,
    SyncPaymentUseCase,
  ],
})
export class CheckoutModule {}
