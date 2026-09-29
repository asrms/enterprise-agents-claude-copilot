# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tests and coverage that do not block the pipeline
```groovy
stage('Test') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    steps {
        sh 'mvn -B test -Dmaven.test.failure.ignore=true || true'
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
            sh 'mvn -B verify -Pintegration'
        }
    }
    post {
        always {
            junit testResults: '**/target/surefire-reports/*.xml', allowEmptyResults: true
            recordCoverage(tools: [[parser: 'JACOCO', pattern: '**/jacoco.xml']])
        }
    }
}
stage('Deploy staging') {
    agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'helm' } }
    when { branch 'main' }
    steps {
        sh 'helm upgrade --install payments-api ./chart -n payments-staging'
    }
}
```
**Why it's wrong:** `-Dmaven.test.failure.ignore` and `|| true` let red tests pass; `catchError` with `buildResult: 'SUCCESS'` erases the integration test failure; `allowEmptyResults: true` accepts builds without any tests; coverage is published without thresholds and the deploy starts anyway.

### 2. SonarQube analysis and waiting for the Quality Gate
```groovy
stage('Sonar') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    steps {
        sh 'mvn -B sonar:sonar -Dsonar.host.url=https://sonarqube.acme.internal -Dsonar.token=squ_4f1b2c9d7e8a'
        sleep time: 60, unit: 'SECONDS'                   // "give the server some time"
        script {
            def qg = waitForQualityGate()                  // no timeout, inside the pod
            if (qg.status != 'OK') {
                echo "Quality gate ${qg.status}, continuing anyway"
            }
        }
    }
}
stage('Image') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'buildkit' } }
    steps {
        sh 'ci/scripts/build-image.sh'
    }
}
```
**Why it's wrong:** plaintext token in the Jenkinsfile; without `withSonarQubeEnv` the step does not know about the analysis task and fails or hangs, and without `timeout` it can block the pod for hours; the `sleep` is a race condition; the `ERROR` status is only printed, so the gate blocks nothing.

### 3. Dependency and image scanning
```groovy
stage('Security scan') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    steps {
        sh 'mvn -B org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=11 -DnvdApiKey=0a1b2c3d-4e5f-6789 || true'
        container('trivy') {
            sh 'trivy image --exit-code 0 --severity CRITICAL harbor.acme.internal/payments/api:latest'
            sh 'trivy fs . > trivy.txt || true'
        }
        catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
            sh 'ci/scripts/license-check.sh'
        }
    }
    post {
        always {
            echo 'Scans completed, see trivy.txt in the workspace'
        }
    }
}
```
**Why it's wrong:** `failBuildOnCVSS=11` can never trigger (the maximum CVSS is 10) and `|| true` ignores the outcome anyway; unpinned plugin and plaintext NVD API key; Trivy with `--exit-code 0` on the `latest` tag scans an image different from the one that will be deployed; text reports neither published nor archived.

## Best Practice (How to do it right)

### 1. Tests and coverage that do not block the pipeline
```groovy
pipeline {
    agent none
    options {
        timeout(time: 45, unit: 'MINUTES')
        skipStagesAfterUnstable()
    }
    stages {
        stage('CI') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            stages {
                stage('Test') {
                    steps {
                        // unit + integration tests with JaCoCo: a red test fails Maven
                        sh 'mvn -B -ntp verify -Pintegration'
                    }
                    post {
                        always {
                            junit testResults: '**/target/surefire-reports/*.xml, **/target/failsafe-reports/*.xml',
                                  allowEmptyResults: false
                            recordCoverage(
                                tools: [[parser: 'JACOCO', pattern: '**/target/site/jacoco/jacoco.xml']],
                                sourceCodeRetention: 'LAST_BUILD',
                                qualityGates: [
                                    [metric: 'LINE', baseline: 'PROJECT', threshold: 80.0, criticality: 'FAILURE'],
                                    [metric: 'BRANCH', baseline: 'PROJECT', threshold: 70.0, criticality: 'FAILURE'],
                                    [metric: 'LINE', baseline: 'MODIFIED_LINES', threshold: 85.0, criticality: 'FAILURE']
                                ])
                        }
                    }
                }
                stage('Enforce gates') {
                    steps {
                        script {
                            // plugin gates set the result but do not stop the pipeline
                            if (currentBuild.currentResult != 'SUCCESS') {
                                error "Quality gates not passed (result: ${currentBuild.currentResult})"
                            }
                        }
                    }
                }
            }
        }
        stage('Deploy staging') {
            when { beforeAgent true; branch 'main' }
            agent { kubernetes { yamlFile 'ci/pod-deploy-staging.yaml'; defaultContainer 'helm' } }
            steps {
                helmDeploy(release: 'payments-api', namespace: 'payments-staging', valuesFile: 'chart/values-staging.yaml')
            }
        }
    }
}
```
**Why it's right:** a red test fails Maven and therefore the stage; `allowEmptyResults: false` prevents builds without tests; coverage has thresholds on lines, branches, and modified code; `skipStagesAfterUnstable()` and the "Enforce gates" stage guarantee that a failed gate prevents the deploy.

### 2. SonarQube analysis and waiting for the Quality Gate
```groovy
stage('Static analysis') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    options { timeout(time: 20, unit: 'MINUTES') }
    steps {
        withSonarQubeEnv('sonarqube') {
            // URL and token injected by the plugin; sonar-maven-plugin pinned in pluginManagement
            sh 'mvn -B -ntp sonar:sonar -Dsonar.projectKey=payments-api'
        }
    }
    post {
        always {
            recordIssues(
                enabledForFailure: true,
                tools: [java(), spotBugs(pattern: '**/target/spotbugsXml.xml'),
                        checkStyle(pattern: '**/target/checkstyle-result.xml')],
                qualityGates: [
                    [threshold: 1, type: 'NEW', criticality: 'FAILURE'],
                    [threshold: 1, type: 'TOTAL_ERROR', criticality: 'FAILURE']
                ])
        }
    }
}
stage('Quality Gate') {
    // no agent: waiting for the SonarQube webhook occupies no pod or executor
    steps {
        timeout(time: 10, unit: 'MINUTES') {
            waitForQualityGate abortPipeline: true
        }
    }
}
```
**Why it's right:** `withSonarQubeEnv` handles URL and token and registers the task that `waitForQualityGate` waits for via webhook, with no `sleep`; `abortPipeline: true` inside `timeout` makes the gate blocking and time-bounded; the wait happens outside the pod; Warnings NG blocks new warnings and errors with browsable reports.

### 3. Dependency and image scanning
```groovy
stage('Dependency check') {
    options { timeout(time: 20, unit: 'MINUTES') }
    steps {
        withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_API_KEY')]) {
            // CVSS >= 7 blocks; NVD DB cached on a PVC (<dataDirectory> in the pom), versioned suppressions
            sh '''
                mvn -B -ntp org.owasp:dependency-check-maven:12.1.0:check \
                  -DfailBuildOnCVSS=7 -Dformat=ALL -DnvdApiKey="$NVD_API_KEY"
            '''
        }
        container('trivy') {
            sh '''
                trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --ignore-unfixed \
                  --exit-code 1 --cache-dir /cache/trivy --format json --output trivy-fs.json .
            '''
        }
    }
    post {
        always {
            recordIssues(tools: [owaspDependencyCheck(pattern: '**/target/dependency-check-report.json'),
                                 trivy(id: 'trivy-fs', name: 'Trivy filesystem', pattern: 'trivy-fs.json')])
            archiveArtifacts artifacts: '**/target/dependency-check-report.html, trivy-fs.json', allowEmptyArchive: false
        }
    }
}
stage('Image scan') {
    // after the Image stage: scan the just-pushed digest, not a tag
    steps {
        container('trivy') {
            withCredentials([usernamePassword(credentialsId: 'harbor-payments-pull',
                                              usernameVariable: 'TRIVY_USERNAME', passwordVariable: 'TRIVY_PASSWORD')]) {
                sh '''
                    trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
                      --cache-dir /cache/trivy --format json --output trivy-image.json "$IMAGE_REPO@$IMAGE_DIGEST"
                '''
            }
        }
    }
    post {
        always {
            recordIssues(tools: [trivy(id: 'trivy-image', name: 'Trivy image', pattern: 'trivy-image.json')])
        }
    }
}
```
**Why it's right:** real thresholds (CVSS 7, HIGH/CRITICAL severity) with a non-zero exit code that stop the pipeline; pinned plugin, API key, and registry credentials via bindings; the scanned image is exactly the one that will be promoted (by digest); JSON reports are published with Warnings NG and archived even on failure.
