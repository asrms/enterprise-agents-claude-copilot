// Generates the site's content from the repository itself, so nothing is duplicated:
//   ../README.md            -> guides + agent groups
//   ../src/agents/*.md      -> one page per agent (the sources the playbooks are built from)
//   ../src/skills/*/        -> one page per skill (SKILL.md + EXAMPLES.md)
// Output (git-ignored): src/content/docs/** and src/generated/catalog.json
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../site.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '..');
const REPO = path.resolve(WEB, '..');
const AGENTS_DIR = path.join(REPO, 'src', 'agents');
const SKILLS_DIR = path.join(REPO, 'src', 'skills');
const DOCS_OUT = path.join(WEB, 'src', 'content', 'docs');
const GEN_OUT = path.join(WEB, 'src', 'generated');

const BASE = SITE.base.replace(/\/$/, '');
const url = (p) => `${BASE}/${p.replace(/^\//, '')}`;
const ghBlob = (p) => `${SITE.repoUrl}/blob/main/${p}`;

// ---------------------------------------------------------------- helpers
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = JSON.parse(v);
    else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    else if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    data[kv[1]] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

const yaml = (obj) =>
  '---\n' +
  Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : JSON.stringify(String(v))}`)
    .join('\n') +
  '\n---\n\n';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

const WORDS = {
  api: 'API', aws: 'AWS', gcp: 'GCP', llm: 'LLM', rag: 'RAG', ml: 'ML', ux: 'UX', ui: 'UI', qa: 'QA',
  sre: 'SRE', iac: 'IaC', owasp: 'OWASP', ios: 'iOS', cpp: 'C++', dotnet: '.NET', devsecops: 'DevSecOps',
  nextjs: 'Next.js', typescript: 'TypeScript', javascript: 'JavaScript', js: 'JS', ci: 'CI', gitlab: 'GitLab',
  github: 'GitHub', devops: 'DevOps', fastapi: 'FastAPI', php: 'PHP', ai: 'AI',
};
const shortDesc = (d) => d.split(/[:.](?:\s|$)/)[0].trim();
const humanize = (name) => name.split('-').map((w) => WORDS[w] ?? w[0].toUpperCase() + w.slice(1)).join(' ');

// Turns **[MANDATORY]** style rule tags into coloured badges.
const TAG_CLASS = {
  MANDATORY: 'mandatory', FORBIDDEN: 'forbidden', SECURITY: 'security', ARCHITECTURE: 'structure',
  PATTERN: 'structure', CONFIGURATION: 'guidance', PERFORMANCE: 'guidance', TESTING: 'guidance',
  REVIEW: 'review', CWE: 'review', REFERENCE: 'reference',
};
const badgeTags = (md) =>
  md.replace(/\*\*\[([A-Z][A-Z0-9 _/-]*)\]\*\*/g, (_, tag) => {
    const cls = TAG_CLASS[tag.split(/[ /]/)[0]] ?? 'guidance';
    return `<span class="rule-tag rule-${cls}">${esc(tag)}</span>`;
  });

// Rewrites repository-relative links so they work on the site.
function rewriteLinks(md) {
  return md.replace(/\]\(([^)\s]+)\)/g, (all, href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return all;
    let m;
    if ((m = href.match(/(?:^|\/)skills\/([\w-]+)\/SKILL\.md$/))) return `](${url(`skills/${m[1]}/`)})`;
    if ((m = href.match(/(?:^|\/)skills\/([\w-]+)\/EXAMPLES\.md$/))) return `](${url(`skills/${m[1]}/`)}#examples)`;
    if ((m = href.match(/(?:^|\/)agents\/([\w-]+?)(?:\.agent)?\.md$/))) return `](${url(`agents/${m[1]}/`)})`;
    if (href === 'LICENSE') return `](${ghBlob('LICENSE')})`;
    return all;
  });
}

// Keeps fenced code blocks untouched while transforming the prose around them.
function mapProse(md, fn) {
  return md
    .split(/(^```[\s\S]*?^```)/m)
    .map((chunk, i) => (i % 2 ? chunk : fn(chunk)))
    .join('');
}

const shiftHeadings = (md, by) => mapProse(md, (t) => t.replace(/^(#{1,5}) /gm, (_, h) => '#'.repeat(Math.min(6, h.length + by)) + ' '));

// GitHub alerts and 💡 quotes -> Starlight asides
function toAsides(md) {
  const KIND = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note[Important]', WARNING: 'caution', CAUTION: 'danger' };
  md = md.replace(/^> \[!(\w+)\]\r?\n((?:> .*\r?\n?)+)/gm, (_, k, body) =>
    `:::${KIND[k] ?? 'note'}\n${body.replace(/^> ?/gm, '').trim()}\n:::\n`);
  md = md.replace(/^> 💡 (.*)$/gm, (_, t) => `:::tip\n${t}\n:::`);
  return md;
}

// ---------------------------------------------------------------- README
const readme = await readFile(path.join(REPO, 'README.md'), 'utf8');
const sections = {};
for (const part of readme.split(/^## /m).slice(1)) {
  const nl = part.indexOf('\n');
  const heading = part.slice(0, nl).trim();
  const key = slugify(heading);
  sections[key] = { heading: heading.replace(/^\P{L}+/u, '').trim(), body: part.slice(nl + 1).replace(/\n---\s*$/, '').trim() };
}
const section = (key) => {
  if (!sections[key]) throw new Error(`README section "${key}" not found. Found: ${Object.keys(sections).join(', ')}`);
  return sections[key];
};

// Agent groups, "What it does" summaries, and agent -> skills from the README tables.
const groups = [];
const readmeSummary = {};
const readmeSkills = {};
for (const block of section('agents').body.split(/^### /m).slice(1)) {
  const title = block.slice(0, block.indexOf('\n')).trim();
  const emoji = title.match(/^\P{L}+/u)?.[0].trim() ?? '';
  const label = title.slice(emoji.length).trim();
  const group = { id: slugify(label.replace(/^Build:\s*/, '')), label, emoji, agents: [] };
  const [summaryPart, skillsPart = ''] = block.split('<details>');
  for (const row of summaryPart.matchAll(/^\|\s*`([\w-]+)`\s*\|\s*(.+?)\s*\|\s*$/gm)) {
    group.agents.push(row[1]);
    readmeSummary[row[1]] = row[2];
  }
  for (const row of skillsPart.matchAll(/^\|\s*`([\w-]+)`\s*\|\s*(.+?)\s*\|\s*$/gm)) {
    readmeSkills[row[1]] = [...row[2].matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
  }
  groups.push(group);
}

// ---------------------------------------------------------------- agents
const agents = {};
for (const file of (await readdir(AGENTS_DIR)).filter((f) => f.endsWith('.md')).sort()) {
  const src = await readFile(path.join(AGENTS_DIR, file), 'utf8');
  const { data, body } = parseFrontmatter(src);
  const name = data.name ?? file.replace(/(\.agent)?\.md$/, '');
  const role = body.match(/^# Role:\s*(.+)$/m)?.[1].trim() ?? '';
  const capabilities = body.match(/^# Capabilities:\s*\r?\n((?:- .+\r?\n?)+)/m)?.[1] ?? '';
  const skills = [...capabilities.matchAll(/^- ([\w-]+)\s*$/gm)].map((m) => m[1]);
  const objectiveRaw = body.match(/^# Objective:\s*([\s\S]*?)(?:^Acceptance Criteria:|$(?![\s\S]))/m)?.[1].trim() ?? '';
  const criteria = body.match(/^Acceptance Criteria:\s*\n([\s\S]*)$/m)?.[1].trim() ?? '';
  const group = groups.find((g) => g.agents.includes(name));
  agents[name] = {
    name, file, title: humanize(name), description: data.description ?? '', summary: readmeSummary[name] ?? data.description ?? '',
    tools: Array.isArray(data.tools) ? data.tools : String(data.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean), role, objective: objectiveRaw, criteria,
    skills: skills.length ? skills : readmeSkills[name] ?? [], group: group?.id ?? 'other',
  };
}
// Agents present on disk but missing from the README still get a page.
const orphanAgents = Object.keys(agents).filter((n) => !groups.some((g) => g.agents.includes(n)));
if (orphanAgents.length) groups.push({ id: 'other', label: 'Other', emoji: '🧩', agents: orphanAgents });

// ---------------------------------------------------------------- skills
const skills = {};
for (const dir of (await readdir(SKILLS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
  if (!existsSync(skillPath)) continue;
  const { data, body } = parseFrontmatter(await readFile(skillPath, 'utf8'));
  const examplesPath = path.join(SKILLS_DIR, dir, 'EXAMPLES.md');
  const examples = existsSync(examplesPath) ? await readFile(examplesPath, 'utf8') : '';
  const usedBy = Object.values(agents).filter((a) => a.skills.includes(dir)).map((a) => a.name);
  const firstGroup = groups.find((g) => g.agents.some((a) => usedBy.includes(a)));
  const ruleCount = (body.match(/^\s*-\s+\*\*\[/gm) ?? []).length;
  skills[dir] = {
    name: dir, title: body.match(/^# Skill:\s*(.+)$/m)?.[1].trim() ?? humanize(dir),
    description: data.description ?? '', usedBy, group: firstGroup?.id ?? 'other', ruleCount, body, examples,
  };
}

// ---------------------------------------------------------------- write pages
await rm(DOCS_OUT, { recursive: true, force: true });
await rm(GEN_OUT, { recursive: true, force: true });
await mkdir(path.join(DOCS_OUT, 'agents'), { recursive: true });
await mkdir(path.join(DOCS_OUT, 'skills'), { recursive: true });
await mkdir(path.join(DOCS_OUT, 'guides'), { recursive: true });
await mkdir(GEN_OUT, { recursive: true });

const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
const chip = (href, text, cls = '') => `<a class="chip ${cls}" href="${href}">${esc(text)}</a>`;

for (const a of Object.values(agents)) {
  const g = groupById[a.group];
  const skillCards = a.skills
    .map((s) => {
      const sk = skills[s];
      return `<a class="mini-card" href="${url(`skills/${s}/`)}"><span class="mini-card-title">${esc(sk?.title ?? humanize(s))}</span><span class="mini-card-desc">${esc(shortDesc(sk?.description ?? ''))}</span></a>`;
    })
    .join('\n');
  const md =
    yaml({ title: a.title, description: a.summary, editUrl: ghBlob(`src/agents/${a.file}`) }) +
    `<div class="page-meta">${chip(url(`agents/#${g.id}`), `${g.emoji} ${g.label}`, 'chip-group')}<code class="agent-id">${esc(a.name)}</code>${a.tools.map((t) => `<span class="chip chip-tool">${esc(t)}</span>`).join('')}</div>\n\n` +
    `<p class="lead">${esc(a.description)}</p>\n\n` +
    `## Role\n\n${a.role}\n\n` +
    `## Skills\n\nThis agent applies the rules of these ${a.skills.length} skills as binding. They are installed together as one playbook, \`${a.name}-playbook\`.\n\n<div class="mini-grid">\n${skillCards}\n</div>\n\n` +
    (a.objective ? `## Objective\n\n${rewriteLinks(a.objective)}\n\n` : '') +
    (a.criteria ? `## Acceptance criteria\n\n${rewriteLinks(a.criteria)}\n\n` : '') +
    `## Install only this agent\n\n` +
    `Clone the library once, then copy the agent file and its playbook into your project.\n\n` +
    '```bash title="Claude Code"\n' +
    `git clone --depth 1 ${SITE.repoUrl}.git /tmp/enterprise-agents\n` +
    `mkdir -p .claude/agents .claude/skills\n` +
    `cp /tmp/enterprise-agents/.claude/agents/${a.name}.md .claude/agents/\n` +
    `cp -r /tmp/enterprise-agents/.claude/skills/${a.name}-playbook .claude/skills/\n` +
    '```\n\n' +
    '```bash title="GitHub Copilot"\n' +
    `git clone --depth 1 ${SITE.repoUrl}.git /tmp/enterprise-agents\n` +
    `mkdir -p .github/agents .github/skills\n` +
    `cp /tmp/enterprise-agents/.github/agents/${a.name}.agent.md .github/agents/\n` +
    `cp -r /tmp/enterprise-agents/.github/skills/${a.name}-playbook .github/skills/\n` +
    '```\n\n' +
    `Source: [\`src/agents/${a.file}\`](${ghBlob(`src/agents/${a.file}`)}) · Generated: [\`.claude/agents/${a.name}.md\`](${ghBlob(`.claude/agents/${a.name}.md`)}) · [\`.github/agents/${a.name}.agent.md\`](${ghBlob(`.github/agents/${a.name}.agent.md`)})\n`;
  await writeFile(path.join(DOCS_OUT, 'agents', `${a.name}.md`), md);
}

for (const s of Object.values(skills)) {
  let body = s.body.replace(/^# Skill:.*\r?\n+/m, '');
  body = body.replace(/^## Implementation Rules:?\s*$/m, '## Rules');
  body = body.replace(/^(\s*-\s+\*\*\[REFERENCE\]\*\*).*EXAMPLES\.md.*$/m, `$1 See the [examples below](#examples) for reference anti-patterns and best practices.`);
  body = mapProse(body, (t) => badgeTags(rewriteLinks(t)));
  let examples = s.examples.replace(/^# .*\r?\n+/m, '');
  examples = shiftHeadings(mapProse(examples, rewriteLinks), 1);
  const usedBy = s.usedBy.length
    ? `<div class="page-meta"><span class="meta-label">Used by</span>${s.usedBy.map((a) => chip(url(`agents/${a}/`), agents[a].title)).join('')}</div>\n\n`
    : '';
  const md =
    yaml({ title: s.title, description: s.description, editUrl: ghBlob(`src/skills/${s.name}/SKILL.md`) }) +
    usedBy +
    `<p class="lead">${esc(s.description)}</p>\n\n` +
    `${body.trim()}\n\n` +
    (examples.trim() ? `## Examples\n\n${examples.trim()}\n\n` : '') +
    `---\n\nSource: [\`src/skills/${s.name}/SKILL.md\`](${ghBlob(`src/skills/${s.name}/SKILL.md`)})` +
    (s.examples ? ` · [\`EXAMPLES.md\`](${ghBlob(`src/skills/${s.name}/EXAMPLES.md`)})` : '') +
    '\n';
  await writeFile(path.join(DOCS_OUT, 'skills', `${s.name}.md`), md);
}

// ---------------------------------------------------------------- guides from README
const guideLinks = (md) =>
  md
    .replace(/\]\(#-agents\)/g, `](${url('agents/')})`)
    .replace(/\]\(#-how-a-skill-works\)/g, `](${url('guides/how-skills-work/')})`)
    .replace(/\]\(#-customizing\)/g, `](${url('guides/customizing/')})`)
    .replace(/\]\(#-quick-start\)/g, `](${url('guides/getting-started/')})`)
    .replace(/\]\(#-usage\)/g, `](${url('guides/getting-started/')}#usage)`);
const codeTagsToBadges = (md) =>
  mapProse(md, (t) => t.replace(/`\[([A-Z]+)\]`/g, (_, tag) => `<span class="rule-tag rule-${TAG_CLASS[tag] ?? 'guidance'}">${tag}</span>`));
const prepGuide = (md) => codeTagsToBadges(toAsides(rewriteLinks(guideLinks(md))));

const flowDiagram = `<div class="flow" aria-label="An agent preloads one playbook that bundles its seven skills; the playbook has a SKILL.md with every tagged rule and a references folder with anti-patterns and fixes">
  <div class="flow-node flow-agent"><strong>🤖 Agent</strong><span>expert role + acceptance criteria</span></div>
  <div class="flow-arrow" aria-hidden="true"></div>
  <div class="flow-node flow-skills"><strong>📘 1 playbook</strong><span>7 skills, loaded as binding rules</span></div>
  <div class="flow-arrow" aria-hidden="true"></div>
  <div class="flow-stack">
    <div class="flow-node"><strong>SKILL.md</strong><span>tagged rules</span></div>
    <div class="flow-node"><strong>references/</strong><span>anti-pattern vs fix</span></div>
  </div>
</div>`;

const guides = [
  {
    slug: 'getting-started', title: 'Getting started', description: 'Install the agents and skills for Claude Code or GitHub Copilot, then call them from chat.',
    body: `${section('quick-start').body}\n\n## Usage\n\n${section('usage').body}`,
  },
  {
    slug: 'how-skills-work', title: 'How a skill works', description: 'What an agent is made of, how its skills are bundled into one playbook, and what each rule tag means.',
    body: section('how-a-skill-works').body.replace(/```mermaid[\s\S]*?```/, flowDiagram),
  },
  {
    slug: 'customizing', title: 'Customizing', description: 'Adapt the rules and examples to your own stack and conventions.',
    body: section('customizing').body,
  },
];
for (const [i, g] of guides.entries()) {
  const md = yaml({ title: g.title, description: g.description, editUrl: ghBlob('README.md'), sidebar: { order: i } }) + prepGuide(g.body) + '\n';
  await writeFile(path.join(DOCS_OUT, 'guides', `${g.slug}.md`), md);
}

// ---------------------------------------------------------------- catalog for pages + sidebar
const catalog = {
  groups,
  agents: Object.fromEntries(Object.values(agents).map(({ objective, criteria, role, ...a }) => [a.name, a])),
  skills: Object.fromEntries(Object.values(skills).map(({ body, examples, ...s }) => [s.name, s])),
  counts: { agents: Object.keys(agents).length, skills: Object.keys(skills).length, playbooks: Object.keys(agents).length },
};
await writeFile(path.join(GEN_OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));

const unknown = Object.values(agents).flatMap((a) => a.skills.filter((s) => !skills[s]).map((s) => `${a.name} -> ${s}`));
if (unknown.length) console.warn(`⚠ Agents reference missing skills:\n  ${unknown.join('\n  ')}`);
console.log(`✓ Synced ${catalog.counts.agents} agents, ${catalog.counts.skills} skills, ${groups.length} groups, ${guides.length} guides`);
