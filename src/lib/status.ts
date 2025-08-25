export const JOB_STATUSES = [
  'Lead',
  'Qualified',
  'Quoted',
  'Won',
  'KSEB_Submitted',
  'Material_Ordered',
  'Installed',
  'Net_Metered',
  'Handover',
  'Closed',
  'Lost',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const statusLabel = (s: JobStatus) => s.replace(/_/g, ' ');
