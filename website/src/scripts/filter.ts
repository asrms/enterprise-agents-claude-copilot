// Client-side filtering for the agents and skills catalog pages.
// Keeps the query in the URL (?q=...&area=...) so filtered views can be shared.
export function setupFilter(noun: string) {
  const root = document.querySelector<HTMLElement>('[data-filter-root]');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>('[data-filter-input]')!;
  const count = root.querySelector<HTMLElement>('[data-filter-count]')!;
  const pills = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-pill]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-filter-group]')];
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
  const total = document.querySelectorAll('[data-filter-item]').length;

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') ?? '';
  let area = params.get('area') ?? '';

  const apply = () => {
    const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const group of groups) {
      const inArea = !area || group.dataset.filterGroup === area;
      let visibleInGroup = 0;
      for (const item of group.querySelectorAll<HTMLElement>('[data-filter-item]')) {
        const hay = item.dataset.search ?? '';
        const match = inArea && terms.every((t) => hay.includes(t));
        item.hidden = !match;
        if (match) visibleInGroup++;
      }
      group.hidden = visibleInGroup === 0;
      shown += visibleInGroup;
    }
    for (const p of pills) p.setAttribute('aria-pressed', String((p.dataset.filterPill ?? '') === area));
    count.textContent = shown === total ? `${total} ${noun}` : `Showing ${shown} of ${total} ${noun}`;
    if (empty) empty.hidden = shown !== 0;

    const next = new URLSearchParams();
    if (input.value.trim()) next.set('q', input.value.trim());
    if (area) next.set('area', area);
    const qs = next.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  };

  input.addEventListener('input', apply);
  for (const p of pills) {
    p.addEventListener('click', () => {
      area = p.dataset.filterPill ?? '';
      apply();
    });
  }
  // "/" focuses the filter, like many docs sites; Starlight's own search stays on Ctrl/Cmd+K.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      input.focus();
    }
  });
  apply();
}
