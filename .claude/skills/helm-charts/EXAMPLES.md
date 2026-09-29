# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unsafe defaults and fragile templating
`values.yaml`:
```yaml
image: myapp:latest
dbPassword: admin123
resources: {}
```
`templates/deployment.yaml`:
```yaml
metadata:
  name: {{ .Release.Name }}
spec:
  template:
    spec:
      containers:
        - name: app
          image: {{ .Values.image }}
          env:
            - name: DB_PASSWORD
              value: {{ .Values.dbPassword }}
          resources: {{ .Values.resources }}
```
**Why it's wrong:**
- Default password and `latest` image; empty resources; no schema, so typos in values are silently ignored.
- Unquoted values and inline maps break YAML for special characters or nested structures.

## Best Practice (How to do it right)

### 1. Helpers, schema-validated values, and safe rendering
`values.yaml`:
```yaml
image:
  repository: registry.example.com/orders-api
  tag: ""            # defaults to .Chart.AppVersion
  digest: ""
replicaCount: 3
resources:
  requests: { cpu: 250m, memory: 384Mi }
  limits: { memory: 512Mi }
database:
  existingSecret: ""  # name of a Secret managed outside the chart (required)
```
`values.schema.json` (excerpt):
```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["image", "database"],
  "properties": {
    "replicaCount": { "type": "integer", "minimum": 1 },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": { "tag": { "type": "string", "not": { "const": "latest" } } }
    },
    "database": {
      "type": "object",
      "required": ["existingSecret"],
      "properties": { "existingSecret": { "type": "string", "minLength": 1 } }
    }
  }
}
```
`templates/deployment.yaml` (excerpt):
```yaml
metadata:
  name: {{ include "orders-api.fullname" . }}
  labels:
    {{- include "orders-api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "orders-api.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
      labels:
        {{- include "orders-api.selectorLabels" . | nindent 8 }}
    spec:
      automountServiceAccountToken: false
      securityContext: { runAsNonRoot: true, seccompProfile: { type: RuntimeDefault } }
      containers:
        - name: api
          image: {{ include "orders-api.image" . | quote }}
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ required "database.existingSecret is required" .Values.database.existingSecret | quote }}
                  key: password
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          securityContext: { allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: { drop: [ALL] } }
```
```bash
helm lint --strict charts/orders-api
helm template t charts/orders-api -f charts/orders-api/ci/test-values.yaml | kubeconform -strict -summary
helm unittest charts/orders-api
```
**Why it's right:**
- Values are validated by a schema, secrets are referenced rather than embedded, and defaults are secure.
- Helpers keep names and labels consistent; `toYaml | nindent` and `quote` render safely; config changes roll pods.
- The chart is linted, schema-checked, and unit-tested in CI.
