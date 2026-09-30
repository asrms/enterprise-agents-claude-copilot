# Website

The documentation site for this repository, built with [Astro Starlight](https://starlight.astro.build) and published to GitHub Pages by `.github/workflows/deploy-site.yml`.

Pages are **generated at build time** from the repository itself, so there is nothing to keep in sync by hand:

| Source | Becomes |
|---|---|
| `../README.md` | Guides (Getting started, How a skill works, Customizing) and the agent groups |
| `../src/agents/*.md` | One page per agent under `/agents/` |
| `../src/skills/*/SKILL.md` + `EXAMPLES.md` | One page per skill under `/skills/` |

`scripts/sync-content.mjs` writes them to `src/content/docs/` and `src/generated/` (both git-ignored). Hand-written pages live in `src/pages/` (home, agents index, searchable skills index).

## Run locally

```bash
cd website
npm ci
npm run dev      # http://localhost:4321/enterprise-agents-claude-copilot/
npm run build    # static site in dist/
```

Requires Node.js 22.12 or later. URLs and repository links are set in `site.config.mjs`.
