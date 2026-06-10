import { SensitivityLevel } from '../types';

export interface SensitivityTierMeta {
  label: string;
  rank: number;
  icon: string;
  tip: string;
  example: string;
}

export const SENSITIVITY: Record<SensitivityLevel, SensitivityTierMeta> = {
  public: {
    label: 'Public',
    rank: 0,
    icon: 'globe',
    tip: 'Approved for public, non-sensitive data only.',
    example: 'Open docs, public APIs, marketing content',
  },
  internal: {
    label: 'Internal',
    rank: 1,
    icon: 'shield',
    tip: 'Approved for internal business data.',
    example: 'Team metadata, internal wikis, non-customer ops data',
  },
  confidential: {
    label: 'Confidential',
    rank: 2,
    icon: 'lock',
    tip: 'Approved for confidential data — restricted access.',
    example: 'Customer records, source code, private messages',
  },
  restricted: {
    label: 'Restricted',
    rank: 3,
    icon: 'lock',
    tip: 'Approved for restricted data: PII, secrets, financial.',
    example: 'PII, secrets, credentials, financial records',
  },
};

export const SENS_ORDER: SensitivityLevel[] = [
  'public',
  'internal',
  'confidential',
  'restricted',
];

export const SENS_RANK: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export function maxSensitivity(
  levels: SensitivityLevel[],
): SensitivityLevel {
  if (levels.length === 0) return 'public';
  return levels.reduce((max, l) =>
    SENS_RANK[l] > SENS_RANK[max] ? l : max,
  );
}
