# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Independent checks run sequentially
```groovy
pipeline {
    agent none
    stages {
        stage('Lint') {
            agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
            steps {
                sh 'npm install'
                sh 'npm run lint'
            }
        }
        stage('Test Node 20') {
            agent { kubernetes { yamlFile 'ci/pod-node20.yaml'; defaultContainer 'node' } }
            steps {
                sh 'npm install'
                sh 'npm test'
            }
        }
        stage('Test Node 22') {
            agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
            steps {
                sh 'npm install'
                sh 'npm test'
            }
        }
        stage('Audit') {
            agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
            steps {
                sh 'npm install'
                sh 'npm audit'
            }
        }
        stage('Build') {
            agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }
    }
}
```
**Why it's wrong:** five pods created one after another, each with a full checkout and `npm install` from scratch (no cache, lockfile not honored); stages duplicated per version instead of `matrix`; no fail fast, so a red lint is discovered only after waiting for everything else; no timeout.

### 2. Checkout and dependencies downloaded on every build
```groovy
pipeline {
    agent none
    stages {
        stage('Build') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps {
                // full implicit checkout (history and tags) plus a second manual clone
                sh 'git clone https://git.acme.internal/payments/payments-api.git src'
                dir('src') {
                    sh 'mvn -B clean install -U'            // empty local repository: downloads everything
                }
                stash name: 'build', includes: 'src/**'      // sources, target, and jar on the controller
            }
        }
        stage('Deploy dev') {
            agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'helm' } }
            steps {
                unstash 'build'
                sh 'helm upgrade --install payments-api src/chart -n payments-dev --atomic --wait'
            }
        }
    }
}
```
**Why it's wrong:** two full clones with all history and all tags; an ephemeral Maven repository and `-U` force downloading every dependency on every build; stashing the entire workspace (hundreds of MB) passes through and is stored on the controller; the dev deploy starts from any branch.

### 3. Heavy processing in Groovy on the controller
```groovy
stage('Report') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    steps {
        script {
            def files = findFiles(glob: '**/*')                       // entire workspace
            def failures = []
            for (f in files) {
                if (f.name.endsWith('.xml') && f.path.contains('surefire-reports')) {
                    def xml = readFile(f.path)                         // every file transferred to the controller
                    def suite = new XmlSlurper().parseText(xml)        // parsing in the controller's memory
                    suite.testcase.each { tc ->
                        if (tc.failure.size() > 0) {
                            failures << "${tc.@classname}.${tc.@name}"
                        }
                    }
                }
            }
            def deps = sh(script: 'mvn -B dependency:tree', returnStdout: true)   // MBs of output
            deps.eachLine { line -> if (line.contains('SNAPSHOT')) { echo "SNAPSHOT: ${line}" } }
            for (int i = 0; i < 200; i++) {
                sh "curl -s https://nexus.acme.internal/service/rest/v1/search?name=payments-${i}"
            }
            currentBuild.description = "Failed tests: ${failures.size()}"
        }
    }
}
```
**Why it's wrong:** thousands of files enumerated and read by the controller, with XML parsing in CPS that consumes heap and CPU of the whole instance; MBs of output returned to Groovy to be filtered line by line; 200 `sh` steps mean 200 round trips and checkpoints; JUnit reports are not published.

## Best Practice (How to do it right)

### 1. Independent checks run sequentially
```groovy
pipeline {
    agent none
    options {
        timeout(time: 30, unit: 'MINUTES')
        parallelsAlwaysFailFast()
        durabilityHint('PERFORMANCE_OPTIMIZED')   // CI-only pipeline for PRs and branches
    }
    stages {
        stage('Verify') {
            matrix {
                axes {
                    axis {
                        name 'NODE_VERSION'
                        values '20', '22'
                    }
                }
                agent {
                    kubernetes {
                        yamlFile "ci/pod-node${NODE_VERSION}.yaml"   // npm cache on a PVC in /cache/npm
                        defaultContainer 'node'
                    }
                }
                stages {
                    stage('Lint and test') {
                        steps {
                            sh '''
                                npm ci --cache /cache/npm --prefer-offline --no-audit --no-fund
                                npm run lint
                                npm test -- --ci
                            '''
                        }
                        post {
                            always { junit testResults: 'reports/junit/*.xml', allowEmptyResults: false }
                        }
                    }
                }
            }
        }
        stage('Package') {
            failFast true
            parallel {
                stage('Bundle') {
                    agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
                    steps {
                        sh 'npm ci --cache /cache/npm --prefer-offline --no-audit --no-fund && npm run build'
                    }
                }
                stage('Dependency audit') {
                    agent { kubernetes { yamlFile 'ci/pod-node22.yaml'; defaultContainer 'node' } }
                    steps { sh 'npm audit --omit=dev --audit-level=high' }
                }
            }
        }
    }
}
```
**Why it's right:** the `matrix` cells and `parallel` branches run concurrently and the first failure stops the others; `npm ci` with a persistent cache and `--prefer-offline` is deterministic and fast; a single `sh` per cell; `PERFORMANCE_OPTIMIZED` reduces controller I/O where resuming after a crash is not needed.

### 2. Checkout and dependencies downloaded on every build
```groovy
pipeline {
    agent none
    options {
        skipDefaultCheckout()
        timeout(time: 30, unit: 'MINUTES')
    }
    stages {
        stage('Build') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps {
                // shallow clone of only the commit to build, without tags
                checkout([
                    $class: 'GitSCM',
                    branches: scm.branches,
                    userRemoteConfigs: scm.userRemoteConfigs,
                    extensions: scm.extensions + [
                        [$class: 'CloneOption', shallow: true, depth: 1, noTags: true, honorRefspec: true, timeout: 5]
                    ]
                ])
                // Maven repository on a PVC and Nexus proxy in settings.xml
                withCredentials([file(credentialsId: 'maven-settings-xml', variable: 'MAVEN_SETTINGS')]) {
                    sh 'mvn -B -ntp -T 1C -s "$MAVEN_SETTINGS" -Dmaven.repo.local=/home/jenkins/.m2/repository verify'
                }
                container('buildkit') {
                    sh 'ci/scripts/build-image.sh'           // pushes the image and writes image-digest.txt
                }
                // chart and digest only: a few KB
                stash name: 'deploy-bundle', includes: 'chart/**, image-digest.txt'
            }
        }
        stage('Deploy dev') {
            when { beforeAgent true; branch 'main' }
            agent { kubernetes { yamlFile 'ci/pod-deploy-dev.yaml'; defaultContainer 'helm' } }
            steps {
                unstash 'deploy-bundle'
                sh '''
                    helm upgrade --install payments-api ./chart -n payments-dev \
                      --set image.ref="$(cat image-digest.txt)" --atomic --wait --timeout 10m
                '''
            }
        }
    }
}
```
**Why it's right:** a single shallow clone (depth 1, no tags) only in the stage that compiles; dependencies served from the PVC cache and the Nexus proxy, with a parallel `-T 1C` Maven build; the stash contains only the chart and digest; the deploy stage does not check out, creates no pod if the branch is not `main`, and uses the already-built image.

### 3. Heavy processing in Groovy on the controller
```groovy
stage('Report') {
    agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
    steps {
        script {
            // parsing delegated to the JUnit plugin: only the summary reaches the controller
            def tests = junit testResults: '**/target/surefire-reports/*.xml', allowEmptyResults: false
            currentBuild.description = "Tests ${tests.totalCount}, failed ${tests.failCount}"
        }
        // filtering and HTTP calls in a single sh on the agent
        sh '''
            mvn -B -ntp -q dependency:list -DoutputFile=target/deps.txt
            find . -path '*/target/deps.txt' -exec awk '/SNAPSHOT/' {} + > snapshot-deps.txt
            ci/scripts/nexus-check.sh payments > nexus-check.json
        '''
        script {
            // a file of a few lines: reading it on the controller is acceptable
            def snapshots = readFile('snapshot-deps.txt').readLines().findAll { it.trim() }
            if (snapshots) {
                error "SNAPSHOT dependencies not allowed: ${snapshots.take(10)}"
            }
        }
        archiveArtifacts artifacts: 'snapshot-deps.txt, nexus-check.json', allowEmptyArchive: false
    }
}
```
**Why it's right:** the JUnit plugin analyzes the reports and returns `totalCount`/`failCount` with no CPS code; search, filtering, and Nexus calls happen in a single `sh` on the agent; only a file of a few lines reaches the controller; the HTTP script is versioned and testable separately.
