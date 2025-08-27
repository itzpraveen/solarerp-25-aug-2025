import 'server-only';

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  whatsappToken: process.env.WHATSAPP_TOKEN!,
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
  cronSecret: process.env.CRON_SECRET!,
  depositDueDays: Number(process.env.NEXT_PUBLIC_DEPOSIT_DUE_DAYS || 7),
  rateLimitPdfPerMin: Number(process.env.RATE_LIMIT_PDF_PER_MIN || 5),
  rateLimitWhatsAppPerMin: Number(
    process.env.RATE_LIMIT_WHATSAPP_PER_MIN || 10,
  ),
  ksebFollowupDaysCsv: process.env.KSEB_FOLLOWUP_DAYS || '7,14',
};
