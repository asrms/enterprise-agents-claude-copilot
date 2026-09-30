---
name: zero-trust-network
description: "Zero trust architecture for networks and services following NIST SP 800-207: identity-based access instead of network location, strong device and user verification, micro-segmentation, service-to-service mTLS with workload identity, identity-aware proxies and ZTNA replacing broad VPN access, private connectivity to cloud services, egress control, and continuous monitoring. Use it when designing or reviewing network security and access architecture."
---

# Skill: Zero Trust Network Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Follow the zero trust principles of NIST SP 800-207: no implicit trust from network location, every access request authenticated and authorized per session based on identity, device posture, and context, with least privilege and continuous verification.
- **[MANDATORY]** Replace flat VPN access to internal networks with identity-aware access (ZTNA or identity-aware proxies such as cloud IAP, Cloudflare Access, Zscaler Private Access, Tailscale with ACLs), granting users access to specific applications rather than network ranges.
- **[MANDATORY]** Authenticate and encrypt service-to-service traffic with mutual TLS based on workload identity (service mesh with SPIFFE identities, Istio, Linkerd, Cilium, or cloud-native equivalents) and authorize calls with policies between named services, not IP allow-lists.
- **[PATTERN]** Micro-segment environments: separate networks or accounts per environment and sensitivity, default-deny security groups, firewall rules, and Kubernetes NetworkPolicies, with explicit allowed flows documented from the architecture's data flow diagram.
- **[PATTERN]** Include device trust for workforce access: managed and compliant devices (MDM, disk encryption, OS patch level, EDR running) as a condition in access policies, with stricter requirements for administrative applications.
- **[SECURITY]** Reach cloud services privately (VPC endpoints/PrivateLink, Private Endpoints, Private Service Connect) and disable public endpoints for databases, storage, and internal APIs where possible.
- **[SECURITY]** Control egress: workloads reach only allow-listed destinations through egress gateways, proxies, or FQDN-based policies, and DNS is monitored, so compromised workloads cannot freely exfiltrate data or reach command-and-control servers.
- **[FORBIDDEN]** Trusting requests because they originate from an internal IP range, shared bastion hosts with long-lived SSH keys (use just-in-time, identity-based access such as cloud session managers), and exposing administrative interfaces to the internet.
- **[PATTERN]** Administrative access is just-in-time and time-bound with approval for production, sessions recorded, and break-glass accounts protected and monitored.
- **[MANDATORY]** Log and monitor every access decision (proxy, mesh, firewall, and identity provider logs) centrally, with alerts for denied-access spikes, unusual lateral movement, and policy changes.
- **[PATTERN]** Migrate incrementally: inventory applications and flows, start with high-value applications behind identity-aware access, enable mTLS in permissive mode then strict, and remove legacy broad network rules as each step completes.
- **[TESTING]** Verify segmentation and policies continuously: automated connectivity tests for allowed and denied paths, periodic lateral movement exercises, and configuration checks that public endpoints remain disabled.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
