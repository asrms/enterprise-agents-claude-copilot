---
name: k8s-networking-ingress
description: "Kubernetes networking: Services and DNS, Gateway API and Ingress controllers, TLS with cert-manager, default-deny NetworkPolicies, service mesh mTLS (Istio, Linkerd, Cilium), egress control, timeouts and retries at the edge, and exposing services safely. Use it when designing or reviewing traffic routing and network security in Kubernetes."
---

# Skill: Kubernetes Networking and Ingress

## Implementation Rules:
- **[ARCHITECTURE]** Expose workloads through `Service`s (ClusterIP by default) and route external traffic through the Gateway API (`Gateway`, `HTTPRoute`, `GRPCRoute`) or an Ingress controller; prefer Gateway API for new platforms because it separates infrastructure ownership (Gateway) from application routes.
- **[FORBIDDEN]** `NodePort` or one `LoadBalancer` Service per application for public exposure without a reason, exposing internal services (databases, admin endpoints, metrics) to the internet, and relying on pod IPs.
- **[MANDATORY]** TLS everywhere at the edge: certificates are issued and renewed automatically by cert-manager (ACME or an internal CA), HTTP redirects to HTTPS, and HSTS is set for public hosts; TLS keys are never committed.
- **[MANDATORY]** Every application namespace has a default-deny `NetworkPolicy` for ingress (and egress where the CNI supports it and the platform requires it), plus explicit allow rules per communication path, including DNS egress to kube-system.
- **[PATTERN]** Select peers in NetworkPolicies by labels (`podSelector`, `namespaceSelector` with `kubernetes.io/metadata.name`), not by IP ranges, except for external destinations; test policies because an unsupported CNI silently ignores them.
- **[PATTERN]** Service-to-service traffic uses mutual TLS with workload identity when a service mesh or Cilium is available (Istio `PeerAuthentication` STRICT, Linkerd automatic mTLS), with authorization policies based on service identities.
- **[PATTERN]** Configure resilience at the edge and mesh consistently with the application: request timeouts, limited retries only for idempotent requests, circuit breaking/outlier detection, and rate limiting at the gateway for public APIs.
- **[SECURITY]** Egress to the internet is controlled: allow-listed destinations through egress gateways, proxies, or FQDN-aware policies (Cilium, Calico), so a compromised pod cannot exfiltrate data freely.
- **[PATTERN]** Health and readiness integrate with routing: the gateway only sends traffic to ready endpoints, and graceful shutdown covers endpoint propagation delays.
- **[PATTERN]** Keep headers and client information correct behind proxies: configure trusted proxy hops for `X-Forwarded-For`/`Forwarded`, preserve source IP where needed (`externalTrafficPolicy: Local`), and propagate trace headers.
- **[TESTING]** Verify connectivity and isolation in CI or staging: allowed paths succeed and forbidden paths fail (netshoot, `kubectl exec` curl tests, Cilium connectivity tests), certificates are valid, and gateway routes are validated with `kubeconform` and the controller's status conditions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
