// @ts-check
import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { SITE } from './site.config.mjs';

// catalog.json is produced by `npm run sync` (runs automatically before dev and build).
const catalogFile = new URL('./src/generated/catalog.json', import.meta.url);
if (!existsSync(catalogFile)) throw new Error('Missing src/generated/catalog.json: run `npm run sync` first.');
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));

const byTitle = (items, lookup) => [...items].sort((a, b) => lookup[a].title.localeCompare(lookup[b].title));

const agentGroups = catalog.groups.map((g) => ({
  label: `${g.emoji} ${g.label}`,
  collapsed: true,
  items: g.agents.map((a) => ({ label: catalog.agents[a].title, slug: `agents/${a}` })),
}));

const skillGroups = catalog.groups
  .map((g) => ({
    label: `${g.emoji} ${g.label}`,
    collapsed: true,
    items: byTitle(
      Object.keys(catalog.skills).filter((s) => catalog.skills[s].group === g.id),
      catalog.skills,
    ).map((s) => ({ label: catalog.skills[s].title, slug: `skills/${s}` })),
  }))
  .filter((g) => g.items.length);

export default defineConfig({
  site: SITE.url,
  base: SITE.base,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: SITE.title,
      description: `${catalog.counts.agents} specialized AI agents and ${catalog.counts.skills} skills for Claude Code and GitHub Copilot, covering the whole software development lifecycle.`,
      logo: { src: './src/assets/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: SITE.repoUrl }],
      customCss: ['@fontsource-variable/inter', './src/styles/theme.css'],
      lastUpdated: false,
      // Languages Shiki does not bundle: render as plain text instead of warning.
      expressiveCode: { shiki: { langAlias: { logql: 'text', rego: 'text' } } },
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE.url}${SITE.base}/og.png` } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Getting started', slug: 'guides/getting-started' },
            { label: 'How a skill works', slug: 'guides/how-skills-work' },
            { label: 'Customizing', slug: 'guides/customizing' },
          ],
        },
        {
          label: `Agents`,
          badge: { text: String(catalog.counts.agents), variant: 'note' },
          items: [{ label: 'All agents', link: '/agents/' }, ...agentGroups],
        },
        {
          label: `Skills`,
          badge: { text: String(catalog.counts.skills), variant: 'tip' },
          collapsed: true,
          items: [{ label: 'Browse & search skills', link: '/skills/' }, ...skillGroups],
        },
      ],
    }),
  ],
});
