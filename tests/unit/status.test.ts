import { describe, it, expect } from 'vitest';
import { JOB_STATUSES, statusLabel } from '@/lib/status';

describe('status', () => {
  it('has expected statuses and labels', () => {
    expect(JOB_STATUSES.includes('KSEB_Submitted')).toBe(true);
    expect(statusLabel('KSEB_Submitted' as any)).toBe('KSEB Submitted');
    expect(statusLabel('Net_Metered' as any)).toBe('Net Metered');
  });
});

