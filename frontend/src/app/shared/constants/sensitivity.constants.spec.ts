import { maxSensitivity, SENS_RANK } from './sensitivity.constants';

describe('maxSensitivity', () => {
  it('defaults to public for an empty list', () => {
    expect(maxSensitivity([])).toBe('public');
  });

  it('returns the highest-ranked tier present', () => {
    expect(maxSensitivity(['public', 'restricted', 'internal'])).toBe('restricted');
    expect(maxSensitivity(['public', 'internal'])).toBe('internal');
  });

  it('is consistent with SENS_RANK ordering', () => {
    expect(SENS_RANK.restricted).toBeGreaterThan(SENS_RANK.confidential);
    expect(SENS_RANK.confidential).toBeGreaterThan(SENS_RANK.internal);
    expect(SENS_RANK.internal).toBeGreaterThan(SENS_RANK.public);
  });
});
