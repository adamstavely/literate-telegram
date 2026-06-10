import { Server, Skill, SensitivityLevel } from '../types';
import { SENS_RANK } from '../constants/sensitivity.constants';

/** Effective data tier for a skill — max tier of servers it reaches for. */
export function computeSkillSensitivity(
  skill: Skill,
  servers: Server[],
): SensitivityLevel | null {
  let best: SensitivityLevel | null = null;
  for (const r of skill.reaches ?? []) {
    const id = r.split('/')[0].trim().toLowerCase().replace(/\s+/g, '-');
    const sv = servers.find(
      (s) => s.slug === id || s.id === id || s.name.toLowerCase() === id,
    );
    if (sv && (best === null || SENS_RANK[sv.sensitivity] > SENS_RANK[best])) {
      best = sv.sensitivity;
    }
  }
  return best;
}
