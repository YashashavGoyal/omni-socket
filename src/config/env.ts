import dotenv from 'dotenv';
import crypto from 'crypto';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  CORS_ORIGIN: z.string().default('*'),

  // Master Admin Authentication Key
  ADMIN_API_KEY: z
    .string()
    .min(16, { message: 'ADMIN_API_KEY must be at least 16 characters long' })
    .default(() => {
      if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_API_KEY environment variable is strictly required in production mode!');
      }
      // Auto-generate random secure dev token in development/test mode
      return `omni_dev_${crypto.randomBytes(8).toString('hex')}`;
    }),

  // Obfuscated Master Admin Dashboard Route Path
  ADMIN_PANEL_PATH: z.string().default('/omni-portal-k').refine((path) => {
    if (!path.startsWith('/') && path !== '') {
      throw new Error('ADMIN_PANEL_PATH must start with /');
    }
    return true;
  }),

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

if (config.NODE_ENV !== 'production' && !process.env.ADMIN_API_KEY) {
  console.log(`🔑 [Security Notice] ADMIN_API_KEY not set in .env. Auto-generated session key: ${config.ADMIN_API_KEY}`);
}