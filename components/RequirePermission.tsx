'use client';
import { ReactNode } from 'react';
import { useProfile } from '@/lib/useProfile';
import { can, type Permission } from '@/lib/authz';

export default function RequirePermission({
  perm,
  children,
  fallback,
}: {
  perm: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { profile, loading } = useProfile();
  if (loading) return null;
  if (!can(profile?.role, perm)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
