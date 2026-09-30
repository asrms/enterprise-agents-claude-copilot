---
name: data-governance-lineage
description: "Data governance for analytics platforms: data ownership and domains, data contracts, catalogs (Unity Catalog, DataHub, OpenMetadata, cloud catalogs), column-level lineage with OpenLineage, classification and tagging of personal data, access control with RBAC/ABAC, masking and row filters, retention, and auditing. Use it when designing or reviewing governance, access, and lineage for a data platform."
---

# Skill: Data Governance and Lineage

## Implementation Rules:
- **[ARCHITECTURE]** Assign every dataset an owning team and domain, a steward, a description, and a criticality tier in the catalog; unowned datasets are not promoted to curated or production layers.
- **[MANDATORY]** Register all production datasets in a catalog (Unity Catalog, DataHub, OpenMetadata, AWS Glue Data Catalog, Microsoft Purview, Google Dataplex) with schema, owner, freshness expectations, and links to the producing pipeline, maintained automatically from pipeline metadata rather than by hand.
- **[PATTERN]** Define data contracts for datasets consumed across teams: schema with types and nullability, semantics, quality checks, SLAs (freshness, availability), and versioning rules; breaking changes follow a deprecation process with consumer notification.
- **[MANDATORY]** Capture lineage automatically: emit OpenLineage events from orchestrators and engines (Airflow, Spark, dbt, Flink integrations) or use the platform's built-in lineage, including column-level lineage for sensitive fields, so impact analysis and root-cause analysis are possible.
- **[SECURITY]** Classify data at ingestion (public, internal, confidential, restricted; personal and special-category data) with tags at table and column level, using automated scanners to detect personal data and human review to confirm.
- **[SECURITY]** Enforce access with groups and roles, not individual users: grant least privilege per layer and domain, use attribute- or tag-based policies (column masking and row filters based on classification tags and user attributes), and review access periodically.
- **[FORBIDDEN]** Copies of restricted data in personal sandboxes or unmanaged storage, shared service accounts used by humans, granting broad `SELECT` on raw layers to analysts, and exporting personal data without a documented purpose and approval.
- **[PATTERN]** Minimize and protect personal data in analytics: pseudonymize identifiers with keyed hashing at ingestion where identity is not needed, keep re-identification keys in a separate restricted store, and implement retention and deletion (including for data subject requests) across all layers and derived tables.
- **[MANDATORY]** Audit data access and changes: query and access logs retained and monitored, alerts on unusual exports or access to restricted data, and ownership changes recorded.
- **[PATTERN]** Manage governance as code: catalog objects, grants, tags, masking policies, and contracts are declared in version-controlled definitions (Terraform providers, dbt `grants` and `meta`, policy files) and applied by pipelines.
- **[TESTING]** Validate governance continuously: CI checks that new models declare owners, descriptions, and classification tags, contract tests run on producer changes, access policies are tested with representative users, and lineage completeness is monitored.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
