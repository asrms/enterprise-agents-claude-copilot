// Hero graphic: the agent groups orbiting the library, each linking to its section.
// Returned as an HTML string because Starlight's hero accepts `image.html`. Styles live in home.css.
import { groups, counts, href, shortLabel } from './catalog';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function orbitSvg(): string {
  const C = 250;
  const R = 188;
  const nodes = groups.map((g, i) => {
    const a = (-90 + (360 / groups.length) * i) * (Math.PI / 180);
    const label = shortLabel(g);
    return { g, label, x: C + R * Math.cos(a), y: C + R * Math.sin(a), w: Math.max(84, label.length * 9 + 34) };
  });
  const f = (n: number) => n.toFixed(1);
  return `<svg class="orbit" viewBox="-10 -10 520 520" role="img" aria-labelledby="orbit-title">
  <title id="orbit-title">${counts.agents} agents grouped in ${groups.length} areas of the software lifecycle</title>
  <defs>
    <linearGradient id="orbit-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F0875F"/><stop offset=".55" stop-color="#C86DD7"/><stop offset="1" stop-color="#6E8BFF"/>
    </linearGradient>
    <radialGradient id="orbit-glow">
      <stop offset="0" stop-color="#C86DD7" stop-opacity=".35"/><stop offset="1" stop-color="#C86DD7" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="210" fill="url(#orbit-glow)"/>
  <circle class="orbit-ring" cx="${C}" cy="${C}" r="${R}"/>
  <circle class="orbit-ring orbit-ring-inner" cx="${C}" cy="${C}" r="92"/>
  ${nodes.map((n) => `<line class="orbit-spoke" x1="${C}" y1="${C}" x2="${f(n.x)}" y2="${f(n.y)}"/>`).join('')}
  <g class="orbit-core">
    <circle cx="${C}" cy="${C}" r="66" stroke="url(#orbit-grad)" stroke-width="4"/>
    <text x="${C}" y="${C - 2}" text-anchor="middle" class="orbit-core-num">${counts.agents}</text>
    <text x="${C}" y="${C + 24}" text-anchor="middle" class="orbit-core-label">AGENTS</text>
  </g>
  ${nodes
    .map(
      (n) => `<a href="${href(`agents/#${n.g.id}`)}" class="orbit-node" aria-label="${esc(n.g.label)}">
    <rect x="${f(n.x - n.w / 2)}" y="${f(n.y - 17)}" width="${n.w}" height="34" rx="17"/>
    <text x="${f(n.x)}" y="${f(n.y + 5)}" text-anchor="middle">${esc(n.label)}</text>
  </a>`,
    )
    .join('\n  ')}
</svg>`;
}
