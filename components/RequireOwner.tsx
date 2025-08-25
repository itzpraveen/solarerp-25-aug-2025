"use client";
import { ReactNode } from 'react';
import { useProfile } from '@/lib/useProfile';

export default function RequireOwner({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { profile, loading } = useProfile();
  if (loading) return null;
  if (profile?.role !== 'owner') return <>{fallback ?? null}</>;
  return <>{children}</>;
}

