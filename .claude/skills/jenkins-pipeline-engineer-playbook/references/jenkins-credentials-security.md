# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Using credentials in sh steps
```groovy
pipeline {
    agent none
    environment {
        NEXUS_PASSWORD = 'S3cr3t!2024'                          // plaintext secret in the repository
    }
    stages {
        stage('Publish') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'harbor-push', usernameVariable: 'REG_USR', passwordVariable: 'REG_PSW'),
                                 string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    // Groovy interpolation: the secret enters the script and the command line
                    sh "curl -u ${REG_USR}:${REG_PSW} https://harbor.acme.internal/api/v2.0/projects"
                    sh "mvn -B sonar:sonar -Dsonar.token=${SONAR_TOKEN}"
                    echo "Token used: ${SONAR_TOKEN}"
                    sh 'echo $REG_PSW | base64 > auth.b64'             // unmasked transformation
                    script {
                        env.PUBLISH_TOKEN = SONAR_TOKEN                // copy outside the binding
                    }
                }
                sh 'mvn -B deploy -Dnexus.password=$NEXUS_PASSWORD'
                archiveArtifacts artifacts: 'auth.b64'                  // secret archived with the build
            }
        }
    }
}
```
**Why it's wrong:** the password is hardcoded in the Jenkinsfile and therefore in Git history; GStrings expose secrets in the recorded script and in the process list (Jenkins reports "insecure interpolation"); the base64 version and the copy into `env` are not masked, and the archived artifact makes the secret downloadable by anyone who can read the job.

### 2. Controller configuration
```yaml
# jenkins.yaml
jenkins:
  numExecutors: 4                                  # builds run on the controller
  securityRealm:
    local:
      allowsSignup: true
      users:
        - id: "admin"
          password: "admin123"                     # plaintext password in the repository
  authorizationStrategy:
    loggedInUsersCanDoAnything:
      allowAnonymousRead: true
security:
  scriptApproval:
    approvedSignatures:
      - "staticMethod jenkins.model.Jenkins getInstance"
      - "staticMethod org.codehaus.groovy.runtime.DefaultGroovyMethods execute java.lang.String"
      - "new java.io.File java.lang.String"
      - "method org.jenkinsci.plugins.workflow.support.steps.build.RunWrapper getRawBuild"
credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              scope: GLOBAL
              id: "prod-cluster-admin"
              username: "cluster-admin"
              password: "eyJhbGciOiJSUzI1NiIsImtpZCI6"   # cluster-admin token visible to every job
          - string:
              scope: GLOBAL
              id: "sonar-token"
              secret: "squ_0f3c9a1b2e7d"
```
**Why it's wrong:** executors on the controller mean a pipeline can read `JENKINS_HOME` and the encryption keys; open sign-up, anonymous read, and "logged-in users can do anything" nullify RBAC; the approved signatures allow arbitrary execution on the controller; plaintext secrets and a production cluster-admin token with global scope available to every job, PRs included.

### 3. Secrets passed as build parameters
```groovy
pipeline {
    agent none
    parameters {
        string(name: 'DB_PASSWORD', defaultValue: 'changeme', description: 'Staging DB password')
        password(name: 'KUBE_TOKEN', defaultValue: '', description: 'Kubernetes token for the deploy')
        choice(name: 'ENV', choices: ['staging', 'prod'], description: 'Environment')
    }
    stages {
        stage('Migrate') {
            agent { kubernetes { yamlFile 'ci/pod-deploy.yaml'; defaultContainer 'flyway' } }
            steps {
                sh "flyway -url=jdbc:postgresql://db-${params.ENV}.acme.internal/payments -user=payments -password=${params.DB_PASSWORD} migrate"
                container('kubectl') {
                    sh "kubectl --token=${params.KUBE_TOKEN} -n payments-${params.ENV} rollout restart deployment/payments-api"
                }
                echo "Migration completed with password ${params.DB_PASSWORD}"
            }
        }
    }
}
```
**Why it's wrong:** parameters are stored with the build and visible on the "Parameters" page and via API to anyone with `Job/Read`; the secret is copied by hand by users and circulates in chats and tickets; anyone who can run the job can choose `prod`; Groovy interpolation and command-line arguments expose the password and the token.

## Best Practice (How to do it right)

### 1. Using credentials in sh steps
```groovy
pipeline {
    agent none
    stages {
        stage('Publish') {
            agent { kubernetes { yamlFile 'ci/pod.yaml'; defaultContainer 'maven' } }
            environment {
                // username/password: generates NEXUS_USR and NEXUS_PSW, masked in the log
                NEXUS = credentials('nexus-payments-deploy')
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'harbor-payments-push',
                                                  usernameVariable: 'REG_USR', passwordVariable: 'REG_PSW')]) {
                    // single quotes: the shell expands it, the secret never enters the recorded script
                    sh '''
                        set +x
                        curl --fail -sS -u "$REG_USR:$REG_PSW" \
                          https://harbor.acme.internal/api/v2.0/projects/payments
                    '''
                }
                withSonarQubeEnv('sonarqube') {
                    // token injected by the plugin and read directly by the scanner
                    sh 'mvn -B -ntp sonar:sonar -Dsonar.projectKey=payments-api'
                }
                // ci/settings.xml references ${env.NEXUS_USR} and ${env.NEXUS_PSW}
                sh 'mvn -B -ntp -s ci/settings.xml deploy'
            }
        }
    }
}
```
**Why it's right:** no secrets in the repository; all sensitive values come from minimally scoped bindings and are expanded by the shell thanks to single quotes (no interpolation warning); `set +x` avoids command traces; the Sonar token is handled by `withSonarQubeEnv` and Maven reads the Nexus credentials from environment variables, with no plaintext arguments.

### 2. Controller configuration
```yaml
# jenkins.yaml - loaded with CASC_JENKINS_CONFIG; secrets from /run/secrets or environment variables
jenkins:
  numExecutors: 0
  disableRememberMe: true
  markupFormatter: plainText
  slaveAgentPort: -1                               # Kubernetes agents via WebSocket
  crumbIssuer:
    standard:
      excludeClientIPFromCrumb: false
  securityRealm:
    ldap:
      configurations:
        - server: "ldaps://ldap.acme.internal:636"
          rootDN: "dc=acme,dc=internal"
          managerDN: "cn=jenkins-bind,ou=services,dc=acme,dc=internal"
          managerPasswordSecret: "${LDAP_BIND_PASSWORD}"
          userSearch: "uid={0}"
          groupSearchBase: "ou=groups"
  authorizationStrategy:
    roleBased:
      roles:
        global:
          - name: "admin"
            permissions: ["Overall/Administer"]
            entries:
              - group: "jenkins-admins"
          - name: "reader"
            permissions: ["Overall/Read"]
            entries:
              - group: "developers"
        items:
          - name: "payments-dev"
            pattern: "payments/.*"
            permissions: ["Job/Read", "Job/Build", "Job/Cancel", "Credentials/View"]
            entries:
              - group: "team-payments"
security:
  scriptApproval:
    forceSandbox: true
    approvedSignatures: []
credentials:
  system:
    domainCredentials:
      - credentials:
          - string:
              scope: GLOBAL                        # read by withSonarQubeEnv in the job context
              id: "sonarqube-analysis-token"
              description: "SonarQube token with the Execute Analysis permission only"
              secret: "${SONARQUBE_ANALYSIS_TOKEN}"
unclassified:
  sonarGlobalConfiguration:
    installations:
      - name: "sonarqube"
        serverUrl: "https://sonarqube.acme.internal"
        credentialsId: "sonarqube-analysis-token"
```
**Why it's right:** a 0-executor controller, LDAP authentication with groups, and per-folder RBAC with no anonymous access; forced sandbox and no approved signatures; the only global secret is an analysis-only token resolved from an external source (`${SONARQUBE_ANALYSIS_TOKEN}`), while team credentials live in their respective folders; the whole configuration is versioned and re-applicable.

### 3. Secrets passed as build parameters
```groovy
pipeline {
    agent none
    parameters {
        // only non-sensitive choices: prod is handled by the release job in the dedicated folder
        choice(name: 'TARGET_ENV', choices: ['staging'], description: 'Migration environment')
    }
    stages {
        stage('Migrate') {
            agent {
                kubernetes {
                    yamlFile 'ci/pod-deploy.yaml'      // ServiceAccount with a RoleBinding on the target namespace only
                    defaultContainer 'flyway'
                }
            }
            environment {
                // credential in the "payments" folder, one per environment: generates DB_USR and DB_PSW
                DB = credentials("payments-${params.TARGET_ENV}-db-migration")
                TARGET_NS = "payments-${params.TARGET_ENV}"
            }
            steps {
                sh '''
                    set +x
                    export FLYWAY_URL="jdbc:postgresql://db-${TARGET_ENV}.acme.internal/payments"
                    export FLYWAY_USER="$DB_USR" FLYWAY_PASSWORD="$DB_PSW"
                    flyway migrate
                '''
                container('kubectl') {
                    // no token: kubectl uses the pod's ServiceAccount
                    sh 'kubectl -n "$TARGET_NS" rollout restart deployment/payments-api'
                    sh 'kubectl -n "$TARGET_NS" rollout status deployment/payments-api --timeout=5m'
                }
            }
        }
    }
}
```
**Why it's right:** parameters contain only non-sensitive choices and prod cannot be selected from this job; the DB password comes from a folder credential selected per environment and is passed to Flyway via environment variables; cluster access uses the pod's ServiceAccount with permissions limited to the namespace, with no token to copy.
