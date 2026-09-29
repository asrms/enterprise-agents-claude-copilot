# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Promotion across environments with manual approval
```groovy
pipeline {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    options {
        disableConcurrentBuilds(abortPrevious: true)   // a new build interrupts the in-progress deploy
    }
    stages {
        stage('Deploy staging') {
            when { branch 'main' }
            steps {
                sh 'mvn -B package -DskipTests'
                sh 'ci/scripts/build-image.sh harbor.acme.internal/payments/api:staging'
                sh 'helm upgrade --install payments-api ./chart -n payments-staging --set image.tag=staging'
            }
        }
        stage('Deploy prod') {
            when { branch 'main' }
            steps {
                input message: 'Deploy to production?'           // pod and executor blocked for hours
                sh 'mvn -B package -DskipTests'                  // new build: artifact different from the tested one
                sh 'ci/scripts/build-image.sh harbor.acme.internal/payments/api:latest'
                sh 'helm upgrade --install payments-api ./chart -n payments-prod --set image.tag=latest'
            }
        }
    }
}
```
**Why it's wrong:** the image is rebuilt for every environment with mutable tags, so code never tested in staging ends up in prod; the `input` inside the agent keeps the pod alive with no `submitter` or `timeout`; without `lock` and `milestone` two builds can deploy at the same time, or an old build can be approved after a new one; `abortPrevious` can interrupt a `helm upgrade` halfway through.

### 2. Helm deploy with smoke tests and rollback
```groovy
stage('Deploy staging') {
    agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'helm' } }
    steps {
        sh "helm upgrade --install payments-api ./chart -n payments-staging --set image.tag=${env.BUILD_NUMBER}"
        sleep 30                                                  // "the pod should have started"
        sh 'curl -s https://payments-staging.acme.internal/health || echo "health check failed"'
        script {
            try {
                sh 'kubectl -n payments-staging get pods | grep payments-api | grep Running'
            } catch (e) {
                echo 'Pod not Running, check manually'
                currentBuild.result = 'UNSTABLE'
            }
        }
    }
}
stage('Deploy prod') {
    agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'helm' } }
    steps {
        sh "helm upgrade --install payments-api ./chart -n payments-prod --set image.tag=${env.BUILD_NUMBER}"
    }
}
```
**Why it's wrong:** without `--atomic --wait` Helm marks the release "deployed" even if the pods go into `CrashLoopBackOff`; `sleep` and `grep Running` do not verify readiness; the health check result is ignored and, with no rollback, staging is left broken; the prod stage runs anyway and with a different tag for every build.

### 3. Production promotion with a GitOps approach
```groovy
stage('Deploy prod') {
    agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'kubectl' } }
    steps {
        withCredentials([file(credentialsId: 'prod-cluster-admin-kubeconfig', variable: 'KUBECONFIG')]) {
            sh 'sed -i "s|image: .*|image: harbor.acme.internal/payments/api:latest|" k8s/deployment.yaml'
            sh 'kubectl apply -f k8s/ -n payments-prod'
            // manual hotfix that the GitOps repository does not know about
            sh 'kubectl -n payments-prod set image deployment/payments-api api=harbor.acme.internal/payments/api:latest'
        }
        sh '''
            git clone https://jenkins:ghp_9aF3kL0pQ2xY7@git.acme.internal/platform/gitops-payments.git gitops
            cd gitops
            git commit -am "update"
            git push origin HEAD:main
        '''
    }
}
```
**Why it's wrong:** the pipeline writes directly to the prod cluster with a cluster-admin kubeconfig and creates drift from the GitOps repository, which Argo CD will revert on the next sync; plaintext token in the URL; direct push to `main` without review; a commit with no digest, build, or source commit, and therefore not traceable.

## Best Practice (How to do it right)

### 1. Promotion across environments with manual approval
```groovy
@Library('platform-lib@v2.3.1') _

pipeline {
    agent none
    options {
        timeout(time: 6, unit: 'HOURS')                    // includes the approval window
        buildDiscarder(logRotator(numToKeepStr: '50', artifactNumToKeepStr: '20'))
        timestamps()
    }
    environment { IMAGE_REPO = 'harbor.acme.internal/payments/api' }
    stages {
        stage('CI') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps {
                javaBuildAndPublishImage(imageRepo: env.IMAGE_REPO)   // tests, gates, image: writes image-digest.txt
                script { env.IMAGE_REF = readFile('image-digest.txt').trim() }
                archiveArtifacts artifacts: 'image-digest.txt', fingerprint: true
            }
        }
        stage('Deploy staging') {
            when { beforeAgent true; branch 'main' }
            options { lock(resource: 'payments-api-staging', inversePrecedence: true) }
            agent { kubernetes { yamlFile 'ci/pod-deploy-staging.yaml'; defaultContainer 'helm' } }
            steps {
                milestone(ordinal: 10, label: 'deploy-staging')
                helmDeploy(release: 'payments-api', namespace: 'payments-staging',
                           imageRef: env.IMAGE_REF, valuesFile: 'chart/values-staging.yaml')
            }
        }
        stage('Approve prod') {
            when { beforeInput true; branch 'main' }
            options { timeout(time: 4, unit: 'HOURS') }
            input {
                message 'Promote the digest validated in staging to production?'
                ok 'Promote'
                submitter 'payments-release-managers'
                submitterParameter 'APPROVER'
            }
            steps {
                milestone(ordinal: 20, label: 'prod-approved')
                script { currentBuild.description = "${env.IMAGE_REF} approved by ${env.APPROVER}" }
            }
        }
        stage('Deploy prod') {
            when { beforeAgent true; branch 'main' }
            options { lock(resource: 'payments-api-prod') }
            agent { kubernetes { cloud 'k8s-prod'; yamlFile 'ci/pod-deploy-prod.yaml'; defaultContainer 'helm' } }
            steps {
                milestone(ordinal: 30, label: 'deploy-prod')
                helmDeploy(release: 'payments-api', namespace: 'payments-prod',
                           imageRef: env.IMAGE_REF, valuesFile: 'chart/values-prod.yaml')
            }
        }
    }
}
```
**Why it's right:** the image is built only once and promoted by digest; approval happens in a stage without an agent, restricted to a group, with a timeout and the approver recorded; `lock` serializes each environment and the `milestone`s guarantee that an obsolete build is never deployed after a newer one; prod uses a dedicated cloud and ServiceAccount.

### 2. Helm deploy with smoke tests and rollback
```groovy
stage('Staging') {
    when { beforeAgent true; branch 'main' }
    options {
        lock(resource: 'payments-api-staging', inversePrecedence: true)
        timeout(time: 30, unit: 'MINUTES')
    }
    agent { kubernetes { yamlFile 'ci/pod-deploy-staging.yaml'; defaultContainer 'helm' } }
    environment {
        RELEASE = 'payments-api'
        NS = 'payments-staging'
    }
    stages {
        stage('Deploy staging') {
            steps {
                milestone(ordinal: 10, label: 'deploy-staging')
                // --atomic: if the rollout does not become Ready, Helm restores the previous revision on its own
                sh '''
                    helm upgrade --install "$RELEASE" ./chart --namespace "$NS" \
                      -f chart/values-staging.yaml --set image.ref="$IMAGE_REF" \
                      --atomic --wait --timeout 10m --history-max 10 \
                      --description "commit $GIT_COMMIT build $BUILD_NUMBER"
                '''
            }
        }
        stage('Smoke staging') {
            steps {
                sh '''
                    helm test "$RELEASE" --namespace "$NS" --logs --timeout 5m
                    curl --fail --silent --show-error --retry 10 --retry-delay 6 --retry-all-errors \
                      https://payments-staging.acme.internal/actuator/health/readiness
                '''
            }
            post {
                failure {
                    // upgrade succeeded but smoke test failed: go back to the previous revision
                    sh 'helm rollback "$RELEASE" 0 --namespace "$NS" --wait --timeout 10m'
                }
                success {
                    script { currentBuild.description = "staging: ${env.IMAGE_REF}" }
                }
            }
        }
    }
}
```
**Why it's right:** `--atomic --wait` covers rollout failures and the separate smoke test stage covers functional failures with `helm rollback ... 0`, without double rollbacks; no `sleep`, readiness verified with explicit retries; `lock`, `milestone`, and `timeout` protect the environment; `--description` and `currentBuild.description` tie the Helm revision to commit, build, and digest.

### 3. Production promotion with a GitOps approach
```groovy
// IMAGE_REF and SOURCE_COMMIT set in the CI stage
stage('Promote prod (GitOps)') {
    when { beforeAgent true; branch 'main' }
    options {
        lock(resource: 'gitops-payments-prod')
        skipDefaultCheckout()
        timeout(time: 10, unit: 'MINUTES')
    }
    agent { kubernetes { yamlFile 'ci/pod-gitops.yaml'; defaultContainer 'tools' } }   // pinned git, yq, and gh
    steps {
        milestone(ordinal: 40, label: 'promote-prod')
        dir('gitops') {
            git url: 'https://git.acme.internal/platform/gitops-payments.git', branch: 'main', credentialsId: 'gitops-bot'
            withCredentials([gitUsernamePassword(credentialsId: 'gitops-bot', gitToolName: 'Default'),
                             usernamePassword(credentialsId: 'gitops-bot', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                sh '''
                    set -eu
                    BRANCH="promote/payments-api-${BUILD_NUMBER}"
                    git checkout -b "$BRANCH"
                    # change only the digest: the same image validated in staging
                    yq -i '.image.ref = strenv(IMAGE_REF)' envs/prod/payments-api/values.yaml
                    git add envs/prod/payments-api/values.yaml
                    git -c user.name="jenkins-bot" -c user.email="jenkins-bot@acme.it" commit \
                      -m "promote(payments-api): ${IMAGE_REF}" \
                      -m "Source-Commit: ${SOURCE_COMMIT}" -m "Jenkins-Build: ${BUILD_URL}"
                    git push origin "$BRANCH"
                    # the PR is the approval: Argo CD syncs prod after the merge
                    GH_HOST=git.acme.internal gh pr create --base main --head "$BRANCH" \
                      --title "Promote payments-api to prod" --body "Build: ${BUILD_URL}"
                '''
            }
        }
    }
}
```
**Why it's right:** the pipeline has no access to the prod cluster and the desired state stays in the GitOps repository, with no drift; only the already-validated digest changes; the bot's credentials come from bindings and not from URLs; the PR with source commit, digest, and build link makes the promotion reviewable, traceable, and reversible with a revert.
