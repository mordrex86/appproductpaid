import {
  GetCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { TransactionSnapshot } from '../domain/transaction';
import {
  expiredPaymentClaimItems,
  type StoredTransaction,
  transactionKey,
} from './dynamodb-checkout.items';

export const PAYMENT_CLAIM_TIMEOUT_MS = 60_000;

export async function reclaimExpiredPaymentClaim(
  client: DynamoDBDocumentClient,
  tableName: string,
  transaction: TransactionSnapshot,
  claimedAt: string,
  timeoutMs = PAYMENT_CLAIM_TIMEOUT_MS,
): Promise<boolean> {
  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: transactionKey(transaction.id), SK: 'TRANSACTION' },
      ConsistentRead: true,
    }),
  );
  const stored = response.Item as StoredTransaction | undefined;
  const previousClaimedAt = Date.parse(stored?.paymentClaimedAt ?? '');
  if (
    stored?.paymentClaimedAt === undefined ||
    Number.isNaN(previousClaimedAt) ||
    previousClaimedAt > Date.parse(claimedAt) - timeoutMs
  ) {
    return false;
  }

  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: expiredPaymentClaimItems(
          tableName,
          transaction,
          stored.paymentClaimedAt,
          claimedAt,
        ),
      }),
    );
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'TransactionCanceledException'
    ) {
      return false;
    }
    throw error;
  }
}
