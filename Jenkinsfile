pipeline {
  agent any
  tools {
    nodejs 'Node20' // Use the name you configured in Jenkins
  }
  options { timestamps(); buildDiscarder(logRotator(numToKeepStr: '20')) }
  environment {
    REGISTRY     = 'docker.io'
    IMAGE_NAME   = 'pamuditha99/753-app'
    IMAGE_TAG    = "${env.GIT_COMMIT}"
    STAGING_HOST = 'staging.example.com'
    PROD_HOST    = 'prod.example.com'
    STAGING_COMPOSE = 'docker-compose.staging.yml'
    PROD_COMPOSE    = 'docker-compose.prod.yml'
    PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
  }
  stages {

    stage('Checkout') { steps { checkout scm } }

    // 4) BUILD
    stage('Build') {
      steps {
        sh '''
          set -e
          npm ci
          // npm run build || true
          docker build -t $IMAGE_NAME:$IMAGE_TAG .
        '''
      }
    }

    // 5) TEST
    stage('Test') {
      steps {
        sh '''
          set -e
          npm test -- --ci --reporters=default --reporters=jest-junit --coverage || true
        '''
      }
      post {
        always {
          junit 'junit.xml'
          publishCoverage adapters: [coberturaAdapter('coverage/cobertura-coverage.xml')],
                          sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
        }
      }
    }

    // 6) CODE QUALITY
    stage('Code Quality (SonarQube)') {
  steps {
    script { def scannerHome = tool 'SonarScanner' }   // uses the Tool you added
    withSonarQubeEnv('sonarqube') {                // matches your Server name
      sh """
        ${scannerHome}/bin/sonar-scanner \
          -Dsonar.organization=s224734529 \
          -Dsonar.projectKey=Savvy9899_SIT753-S224734529 \
          -Dsonar.projectName=SIT753-App \
          -Dsonar.sources=src \
          -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
      """
    }
  }
}
    // stage('Code Quality (SonarQube)') {
    //   steps {
    //     withSonarQubeEnv('sonarqube') {
    //       withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_LOGIN')]) {
    //         sh 'sonar-scanner -Dsonar.login=$SONAR_LOGIN'
    //       }
    //     }
    //   }
    //   post {
    //     success {
    //       script {
    //         timeout(time: 10, unit: 'MINUTES') {
    //           def qg = waitForQualityGate()
    //           if (qg.status != 'OK') error "Quality Gate failed: ${qg.status}"
    //         }
    //       }
    //     }
    //   }
    // }

    // 7) SECURITY
        stage('Security') {
        steps {
          sh '''
            set -e

            # 0) npm audit (artifact only, does not fail build)
            npm audit --json > npm-audit.json || true

            # Share Trivy cache so DB isn’t re-downloaded each run
            mkdir -p .trivy-cache

            # 1) Trivy FS (source tree) -> SARIF
            docker run --rm \
              -v "$PWD":/src \
              -v "$PWD/.trivy-cache":/root/.cache/trivy \
              aquasec/trivy:latest fs /src \
              --scanners vuln \
              --severity HIGH,CRITICAL \
              --format sarif \
              -o /src/trivy-fs.sarif || true

            # 2) Trivy IMAGE -> SARIF (mount workspace so -o path exists)
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              -v "$PWD":/src \
              -v "$PWD/.trivy-cache":/root/.cache/trivy \
              aquasec/trivy:latest image "$IMAGE_NAME:$IMAGE_TAG" \
              --scanners vuln \
              --severity HIGH,CRITICAL \
              --format sarif \
              -o /src/trivy-image.sarif || true

            # 3) OSV-Scanner -> SARIF (older image: no -o flag; redirect to file)
            docker run --rm \
              -v "$PWD":/repo \
              ghcr.io/google/osv-scanner:latest \
              -r /repo --format sarif > /repo/osv.sarif || true
          '''
        }
        post {
          always {
            archiveArtifacts artifacts: 'npm-audit.json,trivy-fs.sarif,trivy-image.sarif,osv.sarif', fingerprint: true
            recordIssues enabledForFailure: true, tools: [
              sarif(id: 'trivy-fs',    pattern: 'trivy-fs.sarif'),
              sarif(id: 'trivy-image', pattern: 'trivy-image.sarif'),
              sarif(id: 'osv',         pattern: 'osv.sarif')
            ]
          }
        }
      }

    //     stage('Security') {
    //   steps {
    //     sh '''
    //       set -e

    //       # 1) npm audit (Node deps)
    //       npm audit --json > npm-audit.json || true

    //       # 2) Trivy (filesystem): HIGH+CRITICAL vulns + secrets, cache DB for speed
    //       mkdir -p .trivy-cache
    //       docker run --rm \
    //         -v "$PWD":/src \
    //         -v "$PWD/.trivy-cache":/root/.cache/trivy \
    //         aquasec/trivy:latest fs /src \
    //         --security-checks vuln,secret \
    //         --severity HIGH,CRITICAL \
    //         --format sarif \
    //         -o /src/trivy-fs.sarif || true

    //       # 3) Trivy (image)
    //       docker run --rm \
    //         -v /var/run/docker.sock:/var/run/docker.sock \
    //         -v "$PWD/.trivy-cache":/root/.cache/trivy \
    //         aquasec/trivy:latest image "$IMAGE_NAME:$IMAGE_TAG" \
    //         --security-checks vuln,secret \
    //         --severity HIGH,CRITICAL \
    //         --format sarif \
    //         -o /src/trivy-image.sarif || true

    //       # 4) OSV-Scanner (lockfiles/manifests)
    //       docker run --rm \
    //         -v "$PWD":/repo \
    //         ghcr.io/google/osv-scanner:latest \
    //         -r /repo --format json > osv.json || true
    //     '''
    //   }
    //   post {
    //     always {
    //       archiveArtifacts artifacts: 'npm-audit.json, trivy-*.sarif, osv.json', fingerprint: true
    //       // Use generic SARIF + npmAudit parsers (no "trivy" DSL needed)
    //       recordIssues enabledForFailure: true, tools: [
    //         npmAudit(pattern: 'npm-audit.json'),
    //         sarif(pattern: 'trivy-*.sarif')
    //         // OSV doesn't have a native Warnings NG parser; keep as artifact or parse via a custom step if you want it in Checks.
    //       ]
    //     }
    //   }
    // }

    // stage('Security') {
    //   steps {
    //     sh '''
    //       set -e
    //       npm audit --json > npm-audit.json || true
    //       docker run --rm -v "$PWD":/src owasp/dependency-check:latest \
    //         --scan /src --format "HTML" --out /src --project your-app || true
    //       docker run --rm aquasec/trivy:latest image --severity HIGH,CRITICAL $IMAGE_NAME:$IMAGE_TAG > trivy.txt || true
    //     '''
    //   }
    //   post {
    //     always {
    //       archiveArtifacts artifacts: 'dependency-check-report.html, npm-audit.json, trivy.txt', fingerprint: true
    //       recordIssues enabledForFailure: true, tools: [
    //         trivy(pattern: 'trivy.txt'),
    //         npmAudit(pattern: 'npm-audit.json'),
    //         dependencyCheck(pattern: 'dependency-check-report.html')
    //       ]
    //     }
    //   }
    // }

    // 8) DEPLOY (Staging)
    // stage('Push & Deploy to Staging') {
    //   steps {
    //     withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
    //       sh '''
    //         echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
    //         docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:staging-$BUILD_NUMBER
    //         docker push $IMAGE_NAME:$IMAGE_TAG
    //         docker push $IMAGE_NAME:staging-$BUILD_NUMBER
    //       '''
    //     }
    //     sshagent(credentials: ['staging-ssh']) {
    //       sh '''
    //         export IMAGE="$IMAGE_NAME:staging-$BUILD_NUMBER"
    //         ssh -o StrictHostKeyChecking=no ubuntu@$STAGING_HOST "mkdir -p ~/app && echo IMAGE=$IMAGE > ~/app/.env"
    //         scp -o StrictHostKeyChecking=no ${STAGING_COMPOSE} ubuntu@$STAGING_HOST:~/app/
    //         ssh -o StrictHostKeyChecking=no ubuntu@$STAGING_HOST "cd ~/app && IMAGE=$IMAGE docker compose -f ${STAGING_COMPOSE} --env-file .env pull && IMAGE=$IMAGE docker compose -f ${STAGING_COMPOSE} --env-file .env up -d && curl -fsS http://localhost:5001/health"
    //       '''
    //     }
    //   }
    // }
        stage('Push & Deploy to Staging') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'dockerhub-creds',
          usernameVariable: 'DOCKERHUB_USER',
          passwordVariable: 'DOCKERHUB_PASS'
        )]) {
          sh '''
            echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin
            docker push pamuditha99/753-app:${GIT_COMMIT}
          '''
        }
      }
    }

    // 9) RELEASE (Production)
    stage('Release to Production') {
      when { branch 'main' }
      steps {
        input message: 'Promote to production?', ok: 'Deploy'
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:prod-$BUILD_NUMBER
            docker push $IMAGE_NAME:prod-$BUILD_NUMBER
          '''
        }
        sshagent(credentials: ['prod-ssh']) {
          sh '''
            export IMAGE="$IMAGE_NAME:prod-$BUILD_NUMBER"
            ssh -o StrictHostKeyChecking=no ubuntu@$PROD_HOST "mkdir -p ~/app && echo IMAGE=$IMAGE > ~/app/.env"
            scp -o StrictHostKeyChecking=no ${PROD_COMPOSE} ubuntu@$PROD_HOST:~/app/
            ssh -o StrictHostKeyChecking=no ubuntu@$PROD_HOST "cd ~/app && IMAGE=$IMAGE docker compose -f ${PROD_COMPOSE} --env-file .env pull && IMAGE=$IMAGE docker compose -f ${PROD_COMPOSE} --env-file .env up -d && curl -fsS http://localhost/health"
          '''
        }
      }
    }

    // 10) MONITORING
    stage('Monitoring & Alerting') {
      steps {
        withCredentials([string(credentialsId: 'DD_API_KEY', variable: 'DD_API_KEY')]) {
          sh '''
            curl -sS -X POST "https://api.datadoghq.com/api/v1/events" \
              -H "DD-API-KEY: $DD_API_KEY" -H "Content-Type: application/json" \
              -d '{"title":"Deploy '$JOB_NAME' #'$BUILD_NUMBER'","text":"Image: '$IMAGE_NAME':'$IMAGE_TAG'","tags":["service:your-app","env:prod"]}' || true
          '''
        }
      }
    }
  }
  post { always { cleanWs() } }
}
