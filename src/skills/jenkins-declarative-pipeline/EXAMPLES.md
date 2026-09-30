# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Maven pipeline with Groovy logic in the Jenkinsfile
```groovy
// Jenkinsfile
def version
def modules = []

node('master') {
    stage('Checkout') {
        checkout scm
        def pom = readFile('pom.xml')
        def matcher = pom =~ /<version>(.+)<\/version>/
        version = matcher[0][1]
        new File("${env.WORKSPACE}/services").eachDir { modules << it.name }
    }
    stage('Build') {
        for (m in modules) {
            try {
                sh "mvn -f services/${m}/pom.xml clean install"
            } catch (err) {
                echo "Build of ${m} failed, continuing: ${err}"
            }
        }
    }
    stage('Deploy') {
        if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME.startsWith('release')) {
            input message: "Deploy ${version} to production?"
            sh "helm upgrade --install api ./chart --set image.tag=${version}"
        }
    }
}
```
**Why it's wrong:** Scripted Pipeline running on the controller (`master`) with no timeout or buildDiscarder; the `Matcher` is not serializable (`NotSerializableException`) and `java.io.File` reads the controller's filesystem, not the agent's; the `try/catch` turns failed builds into successes; the `input` inside `node` holds the executor for the entire wait.

### 2. Conditional stage execution
```groovy
pipeline {
    agent any
    stages {
        stage('Integration Test') {
            agent {
                kubernetes { yamlFile 'ci/pod-it.yaml' }
            }
            when {
                expression { env.BRANCH_NAME == 'main' || env.CHANGE_ID != null }
            }
            steps { sh 'mvn -B verify -Pintegration' }
        }
        stage('Publish') {
            when {
                expression { return env.GIT_BRANCH == 'origin/main' }
            }
            steps { sh "./publish.sh ${params.TARGET}" }
        }
        stage('Nightly') {
            steps {
                script {
                    if (currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause')) {
                        sh 'mvn -B verify -Pnightly'
                    } else {
                        echo 'Not a nightly build, skipping'
                    }
                }
            }
        }
    }
}
```
**Why it's wrong:** without `beforeAgent true` the pod is created even when the stage will be skipped; `expression` on `GIT_BRANCH` poorly replicates `branch`/`changeRequest`, and in Multibranch the value is not `origin/main`; the `if` inside `script` hides the skip (the stage shows green in Stage View); a top-level `agent any` holds an executor for the entire pipeline.

### 3. Global options and post block
```groovy
pipeline {
    agent {
        kubernetes { yamlFile 'ci/pod.yaml' }
    }
    stages {
        stage('Build') {
            steps {
                container('maven') {
                    sh 'mvn -B clean install'
                }
            }
        }
        stage('Integration') {
            steps {
                container('maven') {
                    sh 'mvn -B verify -Pintegration'
                }
            }
        }
    }
    post {
        success {
            junit '**/target/surefire-reports/*.xml'
            archiveArtifacts '**/target/*.jar'
        }
        failure {
            sleep 300 // keep the pod alive for debugging
            mail to: 'team-payments@acme.it', subject: 'Build failed', body: 'Please check'
        }
    }
}
```
**Why it's wrong:** no `timeout`, `buildDiscarder`, or concurrency control (endless builds, a full controller disk, builds of the same branch running in parallel); JUnit reports are published only on success, so they are missing exactly when you need to understand a failure; the `sleep` in `post` keeps the pod busy; the email contains no job, build number, or link.

## Best Practice (How to do it right)

### 1. Maven pipeline with Groovy logic in the Jenkinsfile
```groovy
@Library('platform-lib@v2.3.1') _

pipeline {
    agent none
    options {
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '5'))
        disableConcurrentBuilds(abortPrevious: true)
        timestamps()
    }
    environment {
        IMAGE_REPO = 'harbor.acme.internal/payments/api'
    }
    stages {
        stage('CI') {
            agent {
                kubernetes {
                    yamlFile 'ci/pod.yaml'
                    defaultContainer 'maven'
                }
            }
            stages {
                stage('Build') {
                    steps {
                        // the library handles settings, local repository, and modules
                        mavenBuild(goals: 'verify')
                    }
                    post {
                        always {
                            junit testResults: '**/target/surefire-reports/*.xml', allowEmptyResults: false
                        }
                    }
                }
                stage('Version') {
                    steps {
                        script {
                            // the only logic allowed: reading data with dedicated steps
                            env.APP_VERSION = readMavenPom(file: 'pom.xml').version
                        }
                    }
                }
            }
        }
    }
}
```
**Why it's right:** Declarative with `agent none` and an ephemeral pod shared by the nested stages; `options` guarantee timeout, retention, and cancellation of superseded builds; parsing and modules are delegated to `readMavenPom` and the `mavenBuild` global var, with no fragile CPS code; a Maven failure stops the pipeline and reports are always published.

### 2. Conditional stage execution
```groovy
pipeline {
    agent none
    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
        timestamps()
    }
    triggers {
        cron(env.BRANCH_NAME == 'main' ? 'H 2 * * 1-5' : '')
    }
    stages {
        stage('Integration Test') {
            when {
                beforeAgent true
                anyOf {
                    branch 'main'
                    changeRequest target: 'main'
                }
            }
            agent { kubernetes { yamlFile 'ci/pod-it.yaml'; defaultContainer 'maven' } }
            steps { sh 'mvn -B -ntp verify -Pintegration' }
        }
        stage('Publish') {
            when {
                beforeAgent true
                tag pattern: 'v\\d+\\.\\d+\\.\\d+', comparator: 'REGEXP'
            }
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps { sh 'mvn -B -ntp deploy -Drevision="${TAG_NAME#v}"' }
        }
        stage('Nightly') {
            when {
                beforeAgent true
                allOf {
                    branch 'main'
                    triggeredBy 'TimerTrigger'
                }
            }
            agent { kubernetes { yamlFile 'ci/pod-it.yaml'; defaultContainer 'maven' } }
            steps { sh 'mvn -B -ntp verify -Pnightly' }
        }
    }
}
```
**Why it's right:** the native `branch`, `changeRequest`, `tag`, and `triggeredBy` directives are readable and correct in Multibranch; `beforeAgent true` avoids creating pods for skipped stages, which show as "skipped" in Stage View; the nightly schedule is active only on `main` and uses the `H` hash; the tag version is expanded by the shell, not by Groovy.

### 3. Global options and post block
```groovy
pipeline {
    agent none
    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', daysToKeepStr: '60', artifactNumToKeepStr: '5'))
        disableConcurrentBuilds(abortPrevious: true)
        timestamps()
    }
    stages {
        stage('Build') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            options { timeout(time: 20, unit: 'MINUTES') }
            steps {
                sh 'mvn -B -ntp verify'
            }
            post {
                always {
                    junit testResults: '**/target/surefire-reports/*.xml', allowEmptyResults: false
                }
                success {
                    archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
                }
            }
        }
        stage('Integration') {
            agent { kubernetes { yamlFile 'ci/pod-it.yaml'; defaultContainer 'maven' } }
            options { timeout(time: 25, unit: 'MINUTES') }
            steps {
                sh 'mvn -B -ntp verify -Pintegration'
            }
            post {
                always {
                    junit testResults: '**/target/failsafe-reports/*.xml', allowEmptyResults: false
                }
            }
        }
    }
    post {
        failure {
            mail to: 'team-payments@acme.it',
                 subject: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 body: "Failed stage and logs: ${env.BUILD_URL}"
        }
        fixed {
            mail to: 'team-payments@acme.it',
                 subject: "FIXED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 body: "The build is green again: ${env.BUILD_URL}"
        }
    }
}
```
**Why it's right:** global and per-stage timeouts, limited retention, and superseded builds canceled; `junit` in `post { always }` publishes results even when tests fail, while archiving and fingerprinting happen only on success; notifications run in the top-level `post` without holding a pod and include a link to the build; `fixed` reports the recovery without noise on green builds.
