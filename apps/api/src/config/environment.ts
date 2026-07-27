import { z } from 'zod';

const environmentSchema = z
  .object({
    CORS_ORIGIN: z.url().default('http://localhost:5173'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PAYMENTS_TABLE_NAME: z.string().trim().min(1).optional(),
    PORT: z.coerce.number().int().positive().max(65_535).default(3000),
    WOMPI_API_URL: z.url().default('https://api-sandbox.co.uat.wompi.dev/v1'),
    WOMPI_INTEGRITY_SECRET: z.string().trim().min(8).optional(),
    WOMPI_PRIVATE_KEY: z.string().trim().min(8).optional(),
    WOMPI_PUBLIC_KEY: z.string().trim().min(8).optional(),
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
    if (environment.NODE_ENV === 'production') {
      for (const key of [
        'WOMPI_INTEGRITY_SECRET',
        'WOMPI_PRIVATE_KEY',
        'WOMPI_PUBLIC_KEY',
      ] as const) {
        if (environment[key] === undefined) {
          context.addIssue({
            code: 'custom',
            message: `${key} is required in production`,
            path: [key],
          });
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(environment);
}
