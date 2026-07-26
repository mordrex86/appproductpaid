import { z } from 'zod';

const environmentSchema = z
  .object({
    CORS_ORIGIN: z.url().default('http://localhost:5173'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PAYMENTS_TABLE_NAME: z.string().trim().min(1).optional(),
    PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.PAYMENTS_TABLE_NAME === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'PAYMENTS_TABLE_NAME is required in production',
        path: ['PAYMENTS_TABLE_NAME'],
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(environment);
}
