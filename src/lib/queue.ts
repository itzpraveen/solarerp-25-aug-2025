import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export type BackgroundJob = {
  id: string;
  tenant_id: string;
  type: string;
  payload: any;
  run_at: string;
  attempts: number;
  last_error: string | null;
};

export async function enqueueJob(
  tenantId: string,
  type: string,
  payload: any,
  runAt?: Date,
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  return supabase.from('background_jobs').insert({
    tenant_id: tenantId,
    type,
    payload,
    run_at: runAt || new Date(),
  });
}

export async function processDueJobs() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const nowIso = new Date().toISOString();
  // Process in small batches to avoid timeouts and reduce contention
  const { data: jobs, error } = await supabase
    .from('background_jobs')
    .select('id, tenant_id, type, payload, run_at, attempts, last_error')
    .lte('run_at', nowIso)
    .lte('attempts', 5)
    .order('run_at', { ascending: true })
    .limit(50);
  if (error) throw error;

  for (const job of (jobs || []) as BackgroundJob[]) {
    try {
      // Claim the job: atomically bump run_at into near future to prevent double-processing.
      const lockUntil = new Date(Date.now() + 60_000).toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from('background_jobs')
        .update({ run_at: lockUntil, attempts: job.attempts + 1 })
        .eq('id', job.id)
        .lte('run_at', nowIso)
        .select('id, attempts')
        .maybeSingle();
      if (claimErr) throw claimErr;
      if (!claimed) {
        // Another worker claimed it; skip.
        continue;
      }
      const attemptNo = claimed.attempts ?? job.attempts + 1;

      switch (job.type) {
        case 'whatsapp_template': {
          const { to, templateName, variables } = job.payload || {};
          // Send directly to WhatsApp Graph API using server credentials
          const token = env.whatsappToken;
          const phoneId = env.whatsappPhoneId;
          if (!token || !phoneId) {
            throw new Error(
              'WhatsApp credentials missing (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID)',
            );
          }
          const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: (variables || []).map((v: string) => ({
                      type: 'text',
                      text: v,
                    })),
                  },
                ],
              },
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`WA send failed: ${res.status} ${txt}`);
          }
          break;
        }
        case 'create_followup_task': {
          const { tenant_id, job_id, title, due_date } = job.payload || {};
          await supabase
            .from('tasks')
            .insert({ tenant_id, job_id, title, due_date });
          break;
        }
        default:
          break;
      }
      await supabase.from('background_jobs').delete().eq('id', job.id);
    } catch (err: any) {
      const currentAttempts = (job.attempts ?? 0) + 1; // claimed increased it by 1
      const backoffMinutes = Math.pow(2, Math.min(currentAttempts, 5));
      const nextRun = new Date(Date.now() + backoffMinutes * 60 * 1000);
      await supabase
        .from('background_jobs')
        .update({
          last_error: String(err?.message || err),
          run_at: nextRun.toISOString(),
        })
        .eq('id', job.id);
    }
  }
}
