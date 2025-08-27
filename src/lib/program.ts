export type ProgramType = 'PM_Surya' | 'Commercial';

export const PROGRAM_LABEL: Record<ProgramType, string> = {
  PM_Surya: 'PM Surya',
  Commercial: 'Commercial',
};

export const PROGRAM_ALLOWED_SYSTEMS: Record<ProgramType, string[]> = {
  PM_Surya: ['On-grid', 'Hybrid'],
  Commercial: [
    'On-grid',
    'Hybrid',
    'Off-grid',
    'Inverter & Battery',
    'Solar Water Heater',
  ],
};

export function isSystemAllowed(program: ProgramType, system: string) {
  return PROGRAM_ALLOWED_SYSTEMS[program].includes(system);
}
