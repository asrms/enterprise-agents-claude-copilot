# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Detached, unreviewed documentation
```text
Confluence space "Orders Team" (last edited 2023):
  "Architecture v2 FINAL.docx" (attached), "How to deploy (old)", "How to deploy (new!!)"
API docs: exported PDF from 2024; endpoints renamed since
No owner, no review, broken links to decommissioned dashboards
```
**Why it's wrong:**
- Docs drift from the code because they are not changed or reviewed with it.
- Duplicated, contradictory pages and binary files make it impossible to know what is current.

## Best Practice (How to do it right)

### 1. Repository layout following Diataxis
```text
docs/
  index.md                       # landing page: routes readers by goal
  tutorials/first-order.md       # learn: place your first order via the API
  how-to/rotate-api-keys.md      # task: step-by-step
  how-to/restore-database.md
  reference/api.md               # generated from api/openapi.yaml
  reference/configuration.md     # generated from the settings schema
  explanation/architecture.md    # concepts, C4 diagrams
  adr/0007-use-outbox.md
mkdocs.yml
.vale.ini
.github/CODEOWNERS               # /docs/ @example/orders-docs-reviewers
```
### 2. MkDocs configuration and CI checks
`mkdocs.yml` (excerpt):
```yaml
site_name: Orders API
theme:
  name: material
  features: [navigation.sections, search.suggest, content.code.copy]
markdown_extensions:
  - admonition
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
nav:
  - Home: index.md
  - Tutorials: [tutorials/first-order.md]
  - How-to guides: [how-to/rotate-api-keys.md, how-to/restore-database.md]
  - Reference: [reference/api.md, reference/configuration.md]
  - Explanation: [explanation/architecture.md]
```
```bash
vale docs/                                   # style and terminology rules
npx markdownlint-cli2 "docs/**/*.md"
lychee --no-progress docs/                   # broken links
mkdocs build --strict                        # warnings fail the build
```
**Why it's right:**
- Docs live with the code, are organized by reader need, and are reviewed by owners through pull requests.
- Style, structure, links, and build warnings are checked automatically, and reference pages are generated from sources of truth.
