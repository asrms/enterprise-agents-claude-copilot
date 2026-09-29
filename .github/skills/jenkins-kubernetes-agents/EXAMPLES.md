# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Build agent pod template
```yaml
# ci/pod.yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins               # SA with a cluster-admin ClusterRoleBinding
  containers:
    - name: maven
      image: maven:latest
      command: ["cat"]
      tty: true
      securityContext:
        runAsUser: 0
    - name: docker
      image: docker:dind
      securityContext:
        privileged: true                    # effective root on the node
      env:
        - name: DOCKER_TLS_CERTDIR
          value: ""
    - name: tools
      image: alpine/k8s:latest
      command: ["cat"]
      tty: true
      volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
  volumes:
    - name: docker-sock
      hostPath:
        path: /var/run/docker.sock          # access to every container on the node
```
**Why it's wrong:** no requests/limits, hence unpredictable scheduling, saturated nodes, and `OOMKilled`; `latest` makes the build non-reproducible; root containers, `privileged`, and the node socket let any Jenkinsfile take control of the node; no cache, so every build re-downloads all dependencies.

### 2. Container image build and push
```groovy
stage('Image') {
    agent {
        kubernetes {
            yaml '''
                apiVersion: v1
                kind: Pod
                spec:
                  containers:
                    - name: docker
                      image: docker:latest
                      command: ["cat"]
                      tty: true
                      volumeMounts:
                        - name: sock
                          mountPath: /var/run/docker.sock
                  volumes:
                    - name: sock
                      hostPath:
                        path: /var/run/docker.sock
            '''
        }
    }
    steps {
        container('docker') {
            sh "docker login -u admin -p ${HARBOR_PASSWORD} harbor.acme.internal"
            sh 'docker build -t harbor.acme.internal/payments/api:latest .'
            sh 'docker push harbor.acme.internal/payments/api:latest'
        }
    }
}
```
**Why it's wrong:** it depends on the node's Docker daemon (absent on containerd nodes) and inherits its privileges; the password is interpolated by Groovy and passed with `-p`; the mutable `latest` tag has no digest, so the deployed image is neither traceable nor promotable; a new pod without layer cache and without the previous build's workspace.

### 3. ServiceAccount and RBAC for the deploy agent
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: jenkins-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: jenkins-cluster-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: jenkins
    namespace: jenkins-agents
---
# ci/pod-deploy.yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins               # same SA for build, staging, and prod
  containers:
    - name: helm
      image: alpine/helm:latest
      command: ["cat"]
      tty: true
```
**Why it's wrong:** every pod that uses the ServiceAccount, PR builds included, can read Secrets and modify any namespace in the cluster; no separation between environments; unpinned image, root container, and no resources.

## Best Practice (How to do it right)

### 1. Build agent pod template
```yaml
# ci/pod.yaml - jenkins-build namespace: PSA exception only for the buildkit container (Kyverno policy)
apiVersion: v1
kind: Pod
metadata:
  labels:
    acme.it/team: payments
spec:
  serviceAccountName: jenkins-agent-build
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: jnlp                            # inbound-agent image injected by the plugin
      resources:
        requests: { cpu: 100m, memory: 256Mi }
        limits: { memory: 512Mi }
    - name: maven
      image: harbor.acme.internal/ci/maven:3.9.9-eclipse-temurin-21
      command: ["sleep"]
      args: ["99d"]
      env:
        - name: HOME
          value: /home/jenkins/agent
        - name: MAVEN_OPTS
          value: >-
            -XX:MaxRAMPercentage=75.0 -Dmaven.repo.local=/home/jenkins/.m2/repository
            -Daether.syncContext.named.factory=file-lock -Daether.syncContext.named.nameMapper=file-gav
      resources:
        requests: { cpu: "1", memory: 2Gi }
        limits: { cpu: "2", memory: 3Gi }
      securityContext:
        allowPrivilegeEscalation: false
        capabilities: { drop: ["ALL"] }
      volumeMounts:
        - { name: maven-repo, mountPath: /home/jenkins/.m2/repository }
    - name: buildkit
      image: harbor.acme.internal/ci/buildkit:v0.18.2-rootless
      command: ["sleep"]
      args: ["99d"]
      env:
        - { name: BUILDKITD_FLAGS, value: "--oci-worker-no-process-sandbox" }
      resources:
        requests: { cpu: 500m, memory: 1Gi }
        limits: { cpu: "2", memory: 2Gi }
      securityContext:                      # rootless BuildKit requirements, on this container only
        seccompProfile: { type: Unconfined }
        appArmorProfile: { type: Unconfined }
      volumeMounts:
        - { name: buildkit-state, mountPath: /home/user/.local/share/buildkit }
  volumes:
    - name: maven-repo
      persistentVolumeClaim: { claimName: jenkins-maven-repo }   # shared RWX
    - name: buildkit-state
      emptyDir: {}
```
**Why it's right:** every container has requests/limits and a heap proportional to the limit; non-root user at the pod level, capabilities dropped, and no Kubernetes token mounted; pinned images from the internal registry; a Maven repository shared on a PVC with safe locks for concurrent builds; the image builder is not privileged and the security exception is confined to the only container that needs it.

### 2. Container image build and push
```groovy
// stage nested in the 'CI' stage, which uses ci/pod.yaml (maven + buildkit containers)
stage('Image') {
    steps {
        container('buildkit') {
            withCredentials([file(credentialsId: 'harbor-payments-push-dockerconfig', variable: 'DOCKER_AUTH')]) {
                sh '''
                    set -eu
                    export DOCKER_CONFIG="$(mktemp -d)"
                    trap 'rm -rf "$DOCKER_CONFIG"' EXIT
                    cp "$DOCKER_AUTH" "$DOCKER_CONFIG/config.json"
                    buildctl-daemonless.sh build \
                      --frontend dockerfile.v0 \
                      --local context=. \
                      --local dockerfile=. \
                      --opt label:org.opencontainers.image.revision="$GIT_COMMIT" \
                      --opt label:org.opencontainers.image.source="$GIT_URL" \
                      --import-cache type=registry,ref="$IMAGE_REPO:buildcache" \
                      --export-cache type=registry,ref="$IMAGE_REPO:buildcache",mode=max \
                      --output type=image,name="$IMAGE_REPO:$GIT_COMMIT",push=true \
                      --metadata-file build-metadata.json
                '''
            }
        }
        script {
            // immutable digest: the only reference used by the scan and deploy stages
            env.IMAGE_DIGEST = readJSON(file: 'build-metadata.json')['containerimage.digest']
        }
        writeFile file: 'image-digest.txt', text: "${env.IMAGE_REPO}@${env.IMAGE_DIGEST}\n"
        archiveArtifacts artifacts: 'image-digest.txt', fingerprint: true
    }
}
```
**Why it's right:** daemonless, rootless build in the same pod as the compilation, so no need to transfer the jar; registry credentials in a temporary `DOCKER_CONFIG` removed by `trap` and never interpolated; OCI labels with commit and source; layer cache in the registry; the digest read from BuildKit metadata is archived with a fingerprint for promotion.

### 3. ServiceAccount and RBAC for the deploy agent
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins-deployer-payments-staging
  namespace: jenkins-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: helm-deployer
  namespace: payments-staging
rules:
  - apiGroups: ["", "apps", "networking.k8s.io", "autoscaling", "policy"]
    resources: ["deployments", "replicasets", "services", "configmaps", "secrets", "pods",
                "serviceaccounts", "ingresses", "horizontalpodautoscalers", "poddisruptionbudgets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jenkins-deployer-payments-staging
  namespace: payments-staging
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: Role, name: helm-deployer }
subjects:
  - { kind: ServiceAccount, name: jenkins-deployer-payments-staging, namespace: jenkins-agents }
---
# ci/pod-deploy-staging.yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer-payments-staging
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: helm
      image: harbor.acme.internal/ci/helm:3.16.4
      command: ["sleep"]
      args: ["99d"]
      env:
        - { name: HOME, value: /home/jenkins/agent }   # writable Helm cache and config
      resources:
        requests: { cpu: 100m, memory: 128Mi }
        limits: { cpu: 500m, memory: 256Mi }
      securityContext:
        allowPrivilegeEscalation: false
        capabilities: { drop: ["ALL"] }
```
**Why it's right:** one ServiceAccount per team and environment, with permissions limited to the chart's resources in the `payments-staging` namespace only (Helm needs Secrets for release history); no cluster-wide role; the deploy pod is non-root, with resources and a pinned image, and needs no kubeconfig or token in the Jenkins credentials.
