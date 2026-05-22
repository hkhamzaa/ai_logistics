import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root — must run before any process.env access
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  AGENT_DRY_RUN: z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),

  SIMULATION_TICK_MS: z.coerce.number().int().min(1000).default(5000),

  GOOGLE_MAPS_SERVER_KEY: z.string().min(1, 'GOOGLE_MAPS_SERVER_KEY is required'),
  GOOGLE_MAPS_BROWSER_KEY: z.string().min(1, 'GOOGLE_MAPS_BROWSER_KEY is required'),

  SLACK_BOT_TOKEN: z.string().min(1, 'SLACK_BOT_TOKEN is required'),
  SLACK_CHANNEL: z.string().default('#logistics-ops'),

  TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_FROM_NUMBER: z.string().min(1, 'TWILIO_FROM_NUMBER is required'),

  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYPAL_CLIENT_ID: z.string().min(1, 'PAYPAL_CLIENT_ID is required'),
  PAYPAL_CLIENT_SECRET: z.string().min(1, 'PAYPAL_CLIENT_SECRET is required'),

  REFUND_AUTO_APPROVE_LIMIT: z.coerce.number().positive().default(50),
  REFUND_MAX_PCT: z.coerce.number().min(1).max(100).default(50),
  REFUND_MAX_AMOUNT: z.coerce.number().positive().default(200),
  REFUND_DAILY_MAX_COUNT: z.coerce.number().int().positive().default(10),
  REFUND_DAILY_MAX_AMOUNT: z.coerce.number().positive().default(500),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error(`\n[CONFIG] Environment validation failed:\n${errors}\n`);
    process.exit(1);
  }

  const env = result.data;

  if (env.PAYPAL_ENV === 'live') {
    console.warn(
      '\n⚠️  WARNING: PAYPAL_ENV=live — autonomous refunds will use REAL MONEY. ' +
        'Ensure this is intentional.\n',
    );
  }

  if (env.AGENT_DRY_RUN) {
    console.info('[CONFIG] AGENT_DRY_RUN=true — no external API calls will be made.');
  }

  return env;
}

export const env = validateEnv();
export type Env = typeof env;
