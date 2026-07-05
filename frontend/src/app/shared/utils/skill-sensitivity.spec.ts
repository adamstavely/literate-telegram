import { computeSkillSensitivity } from './skill-sensitivity';
import { Server, Skill } from '../types';

function server(partial: Partial<Server>): Server {
  return {
    id: partial.slug ?? 'srv',
    type: 'server',
    name: partial.name ?? 'Srv',
    slug: partial.slug ?? 'srv',
    publisher: 'acme',
    verified: true,
    summary: '',
    description: '',
    installs: 0,
    sensitivity: partial.sensitivity ?? 'public',
    categories: [],
    createdAt: '',
    updatedAt: '',
    transports: ['http'],
    auth: 'None',
    tools: [],
    clients: [],
    license: 'MIT',
    source: '',
    rating: 0,
    ...partial,
  } as Server;
}

function skill(reaches: string[]): Skill {
  return {
    id: 'sk',
    type: 'skill',
    name: 'Skill',
    slug: 'skill',
    publisher: 'acme',
    verified: true,
    summary: '',
    description: '',
    installs: 0,
    sensitivity: 'public',
    categories: [],
    createdAt: '',
    updatedAt: '',
    triggers: [],
    reaches,
    tokens: 0,
  } as Skill;
}

describe('computeSkillSensitivity', () => {
  const servers = [
    server({ slug: 'db', sensitivity: 'restricted' }),
    server({ slug: 'wiki', sensitivity: 'internal' }),
  ];

  it('returns null when the skill reaches nothing known', () => {
    expect(computeSkillSensitivity(skill(['unknown / thing']), servers)).toBeNull();
    expect(computeSkillSensitivity(skill([]), servers)).toBeNull();
  });

  it('resolves a reach to its server tier by slug', () => {
    expect(computeSkillSensitivity(skill(['wiki / read']), servers)).toBe('internal');
  });

  it('returns the highest tier across multiple reaches', () => {
    expect(
      computeSkillSensitivity(skill(['wiki / read', 'DB / query']), servers),
    ).toBe('restricted');
  });
});
