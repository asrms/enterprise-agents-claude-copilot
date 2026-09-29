import catalog from '../generated/catalog.json';

export type Group = { id: string; label: string; emoji: string; agents: string[] };
export type Agent = {
  name: string; title: string; description: string; summary: string;
  tools: string[]; skills: string[]; group: string; file: string;
};
export type Skill = {
  name: string; title: string; description: string; usedBy: string[]; group: string; ruleCount: number;
};

export const groups = catalog.groups as Group[];
export const agents = catalog.agents as Record<string, Agent>;
export const skills = catalog.skills as Record<string, Skill>;
export const counts = catalog.counts as { agents: number; skills: number };

/** Prefixes a site-relative path with the configured base. */
export const href = (p = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;

/** Short labels for tight spaces (orbit diagram, filters). */
export const SHORT: Record<string, string> = {
  'plan-and-design': 'Plan',
  'backend-and-systems': 'Backend',
  frontend: 'Frontend',
  mobile: 'Mobile',
  'data-and-ai': 'Data & AI',
  'quality-performance-and-security': 'Quality',
  'maintain-and-document': 'Maintain',
  'deliver-and-operate': 'Deliver',
  'cloud-platforms': 'Cloud',
};
export const shortLabel = (g: Group) => SHORT[g.id] ?? g.label;

export const skillsInGroup = (id: string) =>
  Object.values(skills).filter((s) => s.group === id).sort((a, b) => a.title.localeCompare(b.title));

/** Headline of a description: the part before the first colon or full stop. */
export const headline = (d: string) => d.split(/[:.](?:\s|$)/)[0].trim();
