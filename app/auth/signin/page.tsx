'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { normalizeLoginIdentifier } from '@/lib/authUsername';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import Card from '~/components/ui/Card';
import PageHeader from '~/components/ui/PageHeader';

export default function SignIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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

    // Handle session present on initial load
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

  const signIn = async () => {
    setLoading(true);
    setMessage(null);
    const normalized = normalizeLoginIdentifier(identifier);
    if (!normalized.ok) {
      setLoading(false);
      setMessage(normalized.error);
      return;
    }
    const { error } = await supabase!.auth.signInWithPassword({
      email: normalized.email,
      password,
    });
    setLoading(false);
    setMessage(error ? 'Invalid username or password.' : null);
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Sign in"
        subtitle="Access your SolarERP workspace."
      />
      <Card>
        <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Username</label>
          <Input
            className="mt-1"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="username"
            autoComplete="username"
          />
          <div className="mt-1 text-xs text-gray-600">
            Use your username (no @). Existing accounts can also use email.
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <Input
            type="password"
            className="mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <Button
          onClick={signIn}
          disabled={!identifier || !password || loading}
          className="mt-2"
        >
          Sign in
        </Button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>
      </Card>
    </div>
  );
}
