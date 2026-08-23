import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  CORS_ORIGIN: z.string().default('*'),

  // Database Configuration
  DATABASE_URL: z.string().default(''),

  // Dual-Tier Rate Limiting Configuration
  RATE_LIMIT_SOCKET_WINDOW_MS: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_SOCKET_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_APP_WINDOW_MS: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_APP_MAX: z.coerce.number().int().positive().default(1000),

  // Presence & Heartbeat Defaults
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
export type AppConfig = z.infer<typeof envSchema>;