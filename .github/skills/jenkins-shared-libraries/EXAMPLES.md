# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Consuming the library from a Jenkinsfile
```groovy
// Jenkinsfile of the payments-api service
@Library('platform-lib') _   // no version: uses the default "main", a floating branch

// second copy loaded dynamically, always from the main branch
library identifier: 'platform-lib@main', retriever: modernSCM([
    $class: 'GitSCMSource',
    remote: 'https://git.acme.internal/platform/jenkins-lib.git',
    credentialsId: 'git-readonly'
])

pipeline {
    agent none
    stages {
        stage('Build') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps {
                script {
                    // helper copied into every repository and diverging over time
                    def utils = load 'ci/utils.groovy'
                    utils.prepareSettings()
                    mavenBuild('verify', true, '17', 'payments-api')   // positional signature
                }
            }
        }
    }
}
```
**Why it's wrong:** the same application commit produces different builds depending on what is on the library's `main` (not reproducible); a merge into the library breaks every pipeline at once; helpers loaded with `load` duplicate untested code; the positional signature is not extensible and a swapped argument goes unnoticed.

### 2. Global variable with parameters and file access
```groovy
// vars/mavenBuild.groovy
import groovy.json.JsonSlurper

def call(String goals, boolean skipTests, String jdk, String module) {
    def pom = new File("${env.WORKSPACE}/pom.xml")      // controller filesystem
    if (!pom.exists()) {
        echo 'pom.xml not found, skipping the build'
        return
    }
    def modules = parseModules(pom.text)
    for (m in modules) {
        sh "mvn -B ${goals} -pl ${m} -DskipTests=${skipTests}"
    }
    def info = new JsonSlurper().parseText(readFile('target/build-info.json'))
    sh "echo build completed"                          // info (LazyMap) outlives a step
    env.BUILD_INFO = info.toString()
}

@NonCPS
def parseModules(String xml) {
    def result = []
    (xml =~ /<module>(.+)<\/module>/).each { result << it[1] }
    sh "echo 'modules found: ${result}'"               // step inside @NonCPS
    return result
}
```
**Why it's wrong:** `java.io.File` reads the controller's disk, so on Kubernetes agents the file "does not exist" and the build is silently skipped; `JsonSlurper`'s `LazyMap` outlives a step and triggers a `NotSerializableException`; the `sh` step inside `@NonCPS` has undefined behavior; unvalidated positional parameters and one `sh` per module multiply the round-trips.

### 3. Class in src/ and library unit tests
```groovy
// src/com/acme/ci/HelmDeployer.groovy
package com.acme.ci

import java.util.regex.Matcher

class HelmDeployer {
    def script
    Matcher lastMatch                                   // non-serializable field

    HelmDeployer(script) { this.script = script }

    @NonCPS
    def deploy(String release, String namespace, String tag) {
        script.sh "helm upgrade --install ${release} ./chart -n ${namespace} --set image.tag=${tag}"
        lastMatch = (tag =~ /(\d+)\.(\d+)\.(\d+)/)
        if (lastMatch.find()) {
            script.echo "Deploying major ${lastMatch.group(1)}"
        }
        // process launched on the controller, not on the agent
        return "kubectl get pods -n ${namespace}".execute().text
    }
}
// No tests: the class is tried out directly with Replay on production jobs
```
**Why it's wrong:** the class does not implement `Serializable` and holds a `Matcher`, so it fails at the first CPS checkpoint; `@NonCPS` on a method that invokes steps; `.execute()` runs `kubectl` on the controller with its credentials; deployment by mutable tag and zero tests, so every regression is discovered on real jobs.

## Best Practice (How to do it right)

### 1. Consuming the library from a Jenkinsfile
```groovy
// Jenkinsfile of the payments-api service
// immutable semver tag, updated via Renovate PRs
@Library('platform-lib@v2.3.1') _

pipeline {
    agent none
    options {
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
        disableConcurrentBuilds(abortPrevious: true)
        timestamps()
    }
    stages {
        stage('Build') {
            agent {
                kubernetes {
                    yamlFile 'ci/pod.yaml'
                    defaultContainer 'maven'
                }
            }
            steps {
                // named parameters, validated by the global var
                mavenBuild(goals: 'verify', modules: ['payments-core', 'payments-api'],
                           settingsCredentialsId: 'maven-settings-xml')
            }
        }
    }
}
```
**Why it's right:** pinning to `v2.3.1` makes the build reproducible, and a library upgrade becomes a reviewable, reversible PR per service; no copied helpers; named parameters are self-documenting and the global var rejects wrong keys.

### 2. Global variable with parameters and file access
```groovy
// vars/mavenBuild.groovy
// Runs Maven on the current agent with validated named parameters.
def call(Map config = [:]) {
    final Map defaults = [goals: 'verify', modules: [], settingsCredentialsId: 'maven-settings-xml']
    def unknown = config.keySet() - defaults.keySet()
    if (unknown) {
        error "mavenBuild: unsupported parameters ${unknown}; allowed ${defaults.keySet()}"
    }
    Map cfg = defaults + config
    if (!(cfg.goals instanceof String) || !cfg.goals.trim()) {
        error "mavenBuild: 'goals' must be a non-empty string"
    }
    if (!fileExists('pom.xml')) {
        error 'mavenBuild: pom.xml missing from the workspace root'
    }

    String projects = cfg.modules ? "-pl ${cfg.modules.join(',')} -am" : ''
    withCredentials([file(credentialsId: cfg.settingsCredentialsId, variable: 'MAVEN_SETTINGS')]) {
        withEnv(["MVN_GOALS=${cfg.goals}", "MVN_PROJECTS=${projects}"]) {
            // single quotes: the agent's shell expands the variables, no Groovy interpolation
            sh 'mvn -B -ntp -s "$MAVEN_SETTINGS" -Dmaven.repo.local=/home/jenkins/.m2/repository $MVN_PROJECTS $MVN_GOALS'
        }
    }
    // Pipeline Utility Steps: reads the pom on the agent and returns a serializable object
    return readMavenPom(file: 'pom.xml').version
}
```
**Why it's right:** a `call(Map config)` signature with defaults, rejection of unknown keys, and explicit errors instead of silent skips; file access only through steps that operate on the agent; a single `sh` call for all modules (`-pl ... -am`); settings and secrets handled with `withCredentials` and values passed to the shell with `withEnv`.

### 3. Class in src/ and library unit tests
```groovy
// src/com/acme/ci/HelmDeployer.groovy
package com.acme.ci

class HelmDeployer implements Serializable {
    private static final long serialVersionUID = 1L
    private final def steps   // pipeline context: 'this' of the global var vars/helmDeploy.groovy

    HelmDeployer(steps) { this.steps = steps }

    void deploy(String release, String namespace, String imageRef) {
        if (!isDigestRef(imageRef)) {
            steps.error("HelmDeployer: expected a digest reference, got '${imageRef}'")
        }
        steps.withEnv(["RELEASE=${release}", "NS=${namespace}", "IMAGE_REF=${imageRef}"]) {
            steps.sh 'helm upgrade --install "$RELEASE" ./chart -n "$NS" --set image.ref="$IMAGE_REF" --atomic --wait --timeout 10m'
        }
    }

    @NonCPS // pure function: no steps, no CPS closures
    static boolean isDigestRef(String ref) {
        return ref ==~ /[\w.\/:-]+@sha256:[a-f0-9]{64}/
    }
}

// test/com/acme/ci/HelmDeployerTest.groovy (JenkinsPipelineUnit + JUnit 5)
package com.acme.ci

import com.lesfurets.jenkins.unit.BasePipelineTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import static org.junit.jupiter.api.Assertions.*

class HelmDeployerTest extends BasePipelineTest {
    def steps

    @BeforeEach
    void setUp() {
        super.setUp()
        helper.registerAllowedMethod('error', [String], { String msg -> throw new IllegalStateException(msg) })
        steps = loadScript('vars/helmDeploy.groovy')
    }

    @Test
    void 'rejects mutable tags without running helm'() {
        assertThrows(IllegalStateException) {
            new HelmDeployer(steps).deploy('payments-api', 'payments-staging', 'harbor.acme.internal/payments/api:latest')
        }
        assertTrue(helper.callStack.findAll { it.methodName == 'sh' }.isEmpty())
    }

    @Test
    void 'passes the digest to the shell without Groovy interpolation'() {
        String ref = 'harbor.acme.internal/payments/api@sha256:' + 'a' * 64
        new HelmDeployer(steps).deploy('payments-api', 'payments-staging', ref)
        def sh = helper.callStack.find { it.methodName == 'sh' }
        assertTrue(sh.argsToString().contains('"$IMAGE_REF"'))
        assertFalse(sh.argsToString().contains(ref))
    }
}
```
**Why it's right:** the class is `Serializable`, keeps no non-serializable state, and invokes steps through the context it receives; `@NonCPS` is used only on a pure function; the deployment accepts only digest references with `--atomic --wait`; JenkinsPipelineUnit tests verify the error branch and the absence of interpolation before the library tag is created.
