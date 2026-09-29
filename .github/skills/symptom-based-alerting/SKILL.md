---
name: symptom-based-alerting
description: "Designing alerts that page humans only for user-impacting problems: symptom-based vs cause-based alerts, SLO burn-rate paging, alert severity levels and routing, actionable alerts with runbooks and context, reducing noise and fatigue, grouping, inhibition, and silencing in Alertmanager or equivalent tools, on-call health metrics, and testing alerts. Use it when creating, reviewing, or cleaning up alerting and on-call."
---

# Skill: Symptom-Based Alerting

## Implementation Rules:
- **[MANDATORY]** Page only for symptoms that affect users now or will imminently (SLO burn-rate alerts, total outage of a critical journey, data loss risk); cause-based signals (high CPU, a pod restart, disk at 70%) become tickets, dashboards, or auto-remediation, not pages.
- **[MANDATORY]** Every paging alert is actionable and urgent: it has an owner, a severity, a runbook link, a clear summary of user impact, and links to the relevant dashboard; if nobody needs to act within minutes, it is not a page.
- **[PATTERN]** Define severity levels and routing explicitly (for example page for critical user impact, ticket for degradations that can wait for business hours, informational for trends), and route alerts to the owning team's on-call rotation via labels.
- **[PATTERN]** Use SLO multi-window burn-rate alerts for services with SLOs, and for services without SLOs start with the golden signals at the edge (error rate, latency percentiles, saturation of critical resources, traffic drops).
- **[PATTERN]** Include context in the alert: affected service and region, current value vs threshold, time the condition started, recent deployments or flag changes, and query links; templates keep this consistent.
- **[PERFORMANCE]** Reduce noise: `for` durations to avoid flapping, grouping related alerts into one notification, inhibition of dependent alerts when an upstream outage alert fires, and deduplication across replicas and regions.
- **[FORBIDDEN]** Alerts without runbooks, alerts that routinely auto-resolve before anyone acts, email-only alerts for critical conditions, static thresholds copied between services without calibration, and silencing alerts indefinitely instead of fixing or deleting them.
- **[PATTERN]** Monitor the monitoring: alert when telemetry stops arriving (absent metrics, stale heartbeats), when the alerting pipeline fails, and with external synthetic checks independent of the platform being monitored.
- **[MANDATORY]** Review alert quality regularly: pages per on-call shift, percentage actionable, time to acknowledge, out-of-hours pages, and repeat offenders; delete or rework alerts that are not actionable.
- **[PATTERN]** Manage alert rules as code (Prometheus rules, Grafana alerting provisioning, Terraform for cloud alerts) with reviews, ownership labels, and consistent naming.
- **[TESTING]** Unit-test alert rules with `promtool test rules` or equivalent using synthetic series, and verify end-to-end routing (test pages to the right rotation) after changes to rules or receivers.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
