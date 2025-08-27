'use client';
import { ReactNode } from 'react';
import { useProfile } from '@/lib/useProfile';
import { isAdminish } from '@/lib/authz';

export default function RequireOwner({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { profile, loading } = useProfile();
  if (loading) return null;
  if (!isAdminish(profile?.role)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
