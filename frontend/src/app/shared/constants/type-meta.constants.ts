import { EntryType } from '../types';

export const TYPE_META: Record<EntryType, { icon: string; label: string }> = {
  server: { icon: 'server', label: 'Server' },
  api: { icon: 'api', label: 'API' },
  tool: { icon: 'tool', label: 'Tool' },
  skill: { icon: 'skill', label: 'Skill' },
  agent: { icon: 'agent', label: 'Agent' },
};
