'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { isPhone } from '@/lib/validation';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<
    typeof supabaseBrowser
  > | null>(null);

  useEffect(() => {
    setSupabase(supabaseBrowser());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Fallback: explicitly set session from URL hash if magic-link tokens present
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash && /access_token=/.test(hash)) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const at = params.get('access_token');
        const rt = params.get('refresh_token');
        if (at && rt) {
          supabase.auth
            .setSession({ access_token: at, refresh_token: rt })
            .finally(() => {
              try {
                const url = new URL(window.location.href);
                url.hash = '';
                window.history.replaceState({}, '', url.toString());
              } catch {}
            });
        }
      }
    } catch {}
// Helper: after auth, try ensureProfile; if forbidden, allow bootstrap fallback
    const afterAuth = async (token?: string | null) => {
      try {
        if (token) {
          const res = await fetch('/api/auth/ensureProfile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            router.replace('/jobs');
            return;
          }
          // If invite-only (403), check whether DB bootstrap already created a profile
          if (res.status === 403) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('tenant_id')
              .maybeSingle();
            if (prof?.tenant_id) {
              router.replace('/jobs');
              return;
            }
            setMessage(
              'Invite required. Ask your admin to add you to their tenant.',
            );
            await supabase.auth.signOut();
            return;
          }
        }
        setMessage('Sign-in error. Please try again.');
        await supabase.auth.signOut();
      } catch {
        setMessage('Sign-in error. Please try again.');
        await supabase.auth.signOut();
      }
    };

    // Handle session present on initial load (e.g., after magic-link redirect)
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) await afterAuth(data.session.access_token);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) await afterAuth(session.access_token);
      },
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  const sendMagicLink = async () => {
    setLoading(true);
    setMessage(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const allowSelf = process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP === '1';
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: {
        // Ensure magic link lands back on this app in any environment
        emailRedirectTo: origin ? `${origin}/auth/signin` : undefined,
        shouldCreateUser: !!allowSelf,
      },
    });
    setLoading(false);
    setMessage(error ? error.message : 'Check your email for the magic link.');
  };

  const sendOtpSms = async () => {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase!.auth.signInWithOtp({ phone });
    setLoading(false);
    setMessage(error ? error.message : 'OTP sent to your phone.');
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="space-y-4">
        {process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP !== '1' && (
          <div className="rounded border bg-[var(--primary-50)] p-3 text-xs text-[var(--primary-700)]">
            Login only: You must be invited by an admin to access this app. If
            you are not invited, the magic link will not create a new account.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Email</label>
          <Input
            className="mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button
            onClick={sendMagicLink}
            disabled={!email || loading}
            className="mt-2"
          >
            Send magic link
          </Button>
        </div>
        <div>
          <label className="block text-sm font-medium">
            Phone (WhatsApp/SMS)
          </label>
          <Input
            type="tel"
            inputMode="numeric"
            className="mt-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="91XXXXXXXXXX or +91XXXXXXXXXX"
          />
          {phone && !isPhone(phone) && (
            <div className="mt-1 text-xs text-red-600">
              Enter a valid phone number.
            </div>
          )}
          <Button
            onClick={sendOtpSms}
            disabled={!isPhone(phone) || loading}
            className="mt-2"
            variant="secondary"
          >
            Send OTP
          </Button>
        </div>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
