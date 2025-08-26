"use client";
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { isPhone } from '@/lib/validation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof supabaseBrowser> | null>(null);

  useEffect(() => {
    setSupabase(supabaseBrowser());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const token = session.access_token;
        await fetch('/api/auth/ensureProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        router.replace('/jobs');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  const sendMagicLink = async () => {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase!.auth.signInWithOtp({ email });
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
        {process.env.NEXT_PUBLIC_E2E_MOCK === '1' && (
          <div className="rounded border bg-yellow-50 p-3 text-sm text-gray-800">
            <div className="mb-2 font-medium">Demo quick sign-in (mock)</div>
            <div className="flex gap-2">
              <button
                className="rounded bg-blue-600 px-2 py-1 text-white"
                onClick={async () => { await supabase!.auth.signInWithOtp({ email: 'owner@demo.local' }); }}
              >Sign in as Owner</button>
              <button
                className="rounded bg-gray-700 px-2 py-1 text-white"
                onClick={async () => { await supabase!.auth.signInWithOtp({ email: 'staff@demo.local' }); }}
              >Sign in as Staff</button>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="mt-1 w-full rounded-md border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button onClick={sendMagicLink} disabled={!email || loading} className="mt-2 rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Send magic link</button>
        </div>
        <div>
          <label className="block text-sm font-medium">Phone (WhatsApp/SMS)</label>
          <input
            type="tel"
            inputMode="numeric"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="91XXXXXXXXXX or +91XXXXXXXXXX"
          />
          {phone && !isPhone(phone) && (
            <div className="mt-1 text-xs text-red-600">Enter a valid phone number.</div>
          )}
          <button onClick={sendOtpSms} disabled={!isPhone(phone) || loading} className="mt-2 rounded bg-green-600 px-3 py-2 text-white disabled:opacity-50">Send OTP</button>
        </div>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
