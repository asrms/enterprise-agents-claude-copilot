# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Everything public, flat network
```yaml
apiVersion: v1
kind: Service
metadata: { name: postgres, namespace: shop }
spec:
  type: LoadBalancer                 # database reachable from the internet
  selector: { app: postgres }
  ports: [{ port: 5432 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: api }
spec:
  rules:
    - host: api.example.com          # plain HTTP, no TLS
      http:
        paths:
          - { path: /, pathType: Prefix, backend: { service: { name: api, port: { number: 80 } } } }
```
**Why it's wrong:**
- The database has a public IP; without NetworkPolicies any pod in the cluster can reach any other pod.
- The API is served without TLS, exposing credentials and data in transit.

## Best Practice (How to do it right)

### 1. Gateway API with cert-manager TLS
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public
  namespace: gateway
  annotations: { cert-manager.io/cluster-issuer: letsencrypt-prod }
spec:
  gatewayClassName: envoy
  listeners:
    - name: https
      hostname: api.example.com
      protocol: HTTPS
      port: 443
      tls: { mode: Terminate, certificateRefs: [{ name: api-example-com-tls }] }
      allowedRoutes: { namespaces: { from: Selector, selector: { matchLabels: { exposure: public } } } }
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: orders-api, namespace: shop }
spec:
  parentRefs: [{ name: public, namespace: gateway, sectionName: https }]
  hostnames: [api.example.com]
  rules:
    - matches: [{ path: { type: PathPrefix, value: /v1/orders } }]
      backendRefs: [{ name: orders-api, port: 8080 }]
      timeouts: { request: 10s }
```
### 2. Default deny plus explicit allows
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: shop }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  egress:
    - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }, podSelector: { matchLabels: { k8s-app: kube-dns } } }]
      ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: orders-api, namespace: shop }
spec:
  podSelector: { matchLabels: { app.kubernetes.io/name: orders-api } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: gateway } } }]
      ports: [{ port: 8080 }]
  egress:
    - to: [{ podSelector: { matchLabels: { app.kubernetes.io/name: postgres } } }]
      ports: [{ port: 5432 }]
```
**Why it's right:**
- Only the gateway is public, with automatically managed TLS; routes are owned by application namespaces that are explicitly allowed.
- Traffic is denied by default; the API accepts connections only from the gateway and may reach only DNS and its database.
