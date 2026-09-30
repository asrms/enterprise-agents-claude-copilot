# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Cowboy debugging in production
```bash
ssh prod-app-03 -l root                          # shared root key
vi /opt/app/config/application.yml               # logging.level.root=DEBUG, left on for 3 weeks
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 ...   # remote debugger open to the network
psql -c "UPDATE orders SET status='PAID' WHERE id IN (...)"   # manual data fix, no review, no backup
scp prod-app-03:/tmp/heap.hprof ~/Downloads/     # heap dump with customer data on a laptop
```
**Why it's wrong:**
- Shared root access, manual config edits, and an exposed debugger create security and stability risks.
- Debug logging floods storage with personal data, unreviewed data changes corrupt state, and sensitive dumps leave production.

## Best Practice (How to do it right)

### 1. Targeted, reversible diagnostics
```bash
# 1. Mitigate: disable the new pricing path for all tenants
flagctl set pricing-v2-enabled false --reason "INC-482 mitigation"

# 2. Raise the log level of one logger, for 30 minutes, via the actuator (audited admin endpoint)
curl -X POST https://orders-api.internal.example.com/actuator/loggers/com.example.pricing \
  -H "Authorization: Bearer $JIT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"configuredLevel":"DEBUG"}'
at now + 30 minutes <<< './scripts/reset-logger.sh com.example.pricing'

# 3. Inspect one pod with an ephemeral debug container instead of a shell in the app image
kubectl -n orders label pod orders-api-7d9f-x2k4 serving=false --overwrite   # remove from Service endpoints
kubectl -n orders debug -it orders-api-7d9f-x2k4 --image=registry.example.com/debug-tools:2026.09 --target=app
# inside: jcmd 1 Thread.print > /tmp/threads-1.txt ; sleep 5 ; jcmd 1 Thread.print > /tmp/threads-2.txt
```
```text
Record in INC-482: actions, times, who; thread dumps show all request threads blocked on PricingRuleCache lock.
Cleanup: logger reset (verified), debug container exited, pod deleted and replaced, dumps deleted after analysis.
Follow-up: reproduction test with concurrent cache refresh (PRC-77); alert on request thread pool saturation (OBS-19).
```
**Why it's right:**
- User impact is mitigated first; diagnostics are narrow, time-limited, audited, and reversible.
- The pod is isolated from traffic, tools come from an approved debug image, and everything is cleaned up and documented.
