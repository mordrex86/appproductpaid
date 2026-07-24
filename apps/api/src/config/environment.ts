import { z } from 'zod';

const environmentSchema = z.object({
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(environment);
}
