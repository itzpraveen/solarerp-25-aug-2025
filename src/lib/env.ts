import 'server-only';
import { z } from 'zod';

// Validate and normalize server env once, with helpful error messages.
const Schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL is required' })
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY cannot be empty'),

  // Optional integrations
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Operations
  CRON_SECRET: z
    .string({ required_error: 'CRON_SECRET is required' })
    .min(1, 'CRON_SECRET cannot be empty'),

  // Username/password auth (optional)
  NEXT_PUBLIC_AUTH_USERNAME_DOMAIN: z.string().optional(),
  AUTH_USERNAME_DOMAIN: z.string().optional(),
  DEFAULT_USER_PASSWORD: z.string().optional(),

  // Tunables (coerced numbers with sensible defaults)
  NEXT_PUBLIC_DEPOSIT_DUE_DAYS: z.coerce.number().default(7),
  RATE_LIMIT_PDF_PER_MIN: z.coerce.number().default(5),
  RATE_LIMIT_WHATSAPP_PER_MIN: z.coerce.number().default(10),
  KSEB_FOLLOWUP_DAYS: z.string().default('7,14'),
  // Optional: Upstash Redis for production rate limiting
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  // Optional: outbound email webhook for notifications
  NOTIFY_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  NOTIFY_EMAIL_WEBHOOK_TOKEN: z.string().optional(),
});

const parsed = (() => {
  const input = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_AUTH_USERNAME_DOMAIN:
      process.env.NEXT_PUBLIC_AUTH_USERNAME_DOMAIN,
    AUTH_USERNAME_DOMAIN: process.env.AUTH_USERNAME_DOMAIN,
    DEFAULT_USER_PASSWORD: process.env.DEFAULT_USER_PASSWORD,
    NEXT_PUBLIC_DEPOSIT_DUE_DAYS: process.env.NEXT_PUBLIC_DEPOSIT_DUE_DAYS,
    RATE_LIMIT_PDF_PER_MIN: process.env.RATE_LIMIT_PDF_PER_MIN,
    RATE_LIMIT_WHATSAPP_PER_MIN:
      process.env.RATE_LIMIT_WHATSAPP_PER_MIN,
    KSEB_FOLLOWUP_DAYS: process.env.KSEB_FOLLOWUP_DAYS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NOTIFY_EMAIL_WEBHOOK_URL: process.env.NOTIFY_EMAIL_WEBHOOK_URL,
    NOTIFY_EMAIL_WEBHOOK_TOKEN: process.env.NOTIFY_EMAIL_WEBHOOK_TOKEN,
  } as Record<string, unknown>;

  const res = Schema.safeParse(input);
  if (!res.success) {
    const msgs = res.error.issues.map((i) => `- ${i.message}`).join('\n');
    // In development/build, warn instead of crashing to keep DX smooth.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Missing/invalid environment variables (non-fatal during dev/build):\n${msgs}`);
    }
    // Produce a permissive fallback; routes that require secrets should validate at use time.
    return {
      NEXT_PUBLIC_SUPABASE_URL: String(input.NEXT_PUBLIC_SUPABASE_URL || ''),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: String(
        input.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      ),
      SUPABASE_SERVICE_ROLE_KEY: String(input.SUPABASE_SERVICE_ROLE_KEY || ''),
      WHATSAPP_TOKEN: (input.WHATSAPP_TOKEN as string) || undefined,
      WHATSAPP_PHONE_NUMBER_ID:
        (input.WHATSAPP_PHONE_NUMBER_ID as string) || undefined,
      WHATSAPP_VERIFY_TOKEN:
        (input.WHATSAPP_VERIFY_TOKEN as string) || undefined,
      CRON_SECRET: String(input.CRON_SECRET || ''),
      NEXT_PUBLIC_AUTH_USERNAME_DOMAIN:
        (input.NEXT_PUBLIC_AUTH_USERNAME_DOMAIN as string) || undefined,
      AUTH_USERNAME_DOMAIN: (input.AUTH_USERNAME_DOMAIN as string) || undefined,
      DEFAULT_USER_PASSWORD:
        (input.DEFAULT_USER_PASSWORD as string) || undefined,
      NEXT_PUBLIC_DEPOSIT_DUE_DAYS: Number(
        input.NEXT_PUBLIC_DEPOSIT_DUE_DAYS || 7,
      ),
      RATE_LIMIT_PDF_PER_MIN: Number(input.RATE_LIMIT_PDF_PER_MIN || 5),
      RATE_LIMIT_WHATSAPP_PER_MIN: Number(
        input.RATE_LIMIT_WHATSAPP_PER_MIN || 10,
      ),
      KSEB_FOLLOWUP_DAYS: String(input.KSEB_FOLLOWUP_DAYS || '7,14'),
      UPSTASH_REDIS_REST_URL: (input.UPSTASH_REDIS_REST_URL as string) || undefined,
      UPSTASH_REDIS_REST_TOKEN: (input.UPSTASH_REDIS_REST_TOKEN as string) || undefined,
      NOTIFY_EMAIL_WEBHOOK_URL:
        (input.NOTIFY_EMAIL_WEBHOOK_URL as string) || undefined,
      NOTIFY_EMAIL_WEBHOOK_TOKEN:
        (input.NOTIFY_EMAIL_WEBHOOK_TOKEN as string) || undefined,
    } as z.infer<typeof Schema>;
  }
  return res.data;
})();

export const env = {
  supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnon: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseService: parsed.SUPABASE_SERVICE_ROLE_KEY,
  whatsappToken: parsed.WHATSAPP_TOKEN,
  whatsappPhoneId: parsed.WHATSAPP_PHONE_NUMBER_ID,
  whatsappVerifyToken: parsed.WHATSAPP_VERIFY_TOKEN,
  cronSecret: parsed.CRON_SECRET,
  authUsernameDomain:
    parsed.AUTH_USERNAME_DOMAIN || parsed.NEXT_PUBLIC_AUTH_USERNAME_DOMAIN,
  defaultUserPassword: parsed.DEFAULT_USER_PASSWORD,
  depositDueDays: parsed.NEXT_PUBLIC_DEPOSIT_DUE_DAYS,
  rateLimitPdfPerMin: parsed.RATE_LIMIT_PDF_PER_MIN,
  rateLimitWhatsAppPerMin: parsed.RATE_LIMIT_WHATSAPP_PER_MIN,
  ksebFollowupDaysCsv: parsed.KSEB_FOLLOWUP_DAYS,
  upstashUrl: parsed.UPSTASH_REDIS_REST_URL,
  upstashToken: parsed.UPSTASH_REDIS_REST_TOKEN,
  emailWebhookUrl: parsed.NOTIFY_EMAIL_WEBHOOK_URL,
  emailWebhookToken: parsed.NOTIFY_EMAIL_WEBHOOK_TOKEN,
};
