export function isAdminishRole(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export function canManageRequestedRole(
  callerRole: string | null | undefined,
  requestedRole: string | null | undefined,
) {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') {
    return requestedRole !== 'owner';
  }
  return false;
}

export function canManageTargetRole(
  callerRole: string | null | undefined,
  targetRole: string | null | undefined,
) {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') {
    return targetRole !== 'owner';
  }
  return false;
}
