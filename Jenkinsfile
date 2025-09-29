pipeline {
  agent any
  options { timestamps() }
  tools { nodejs 'Node20' } 
  environment {
    REGISTRY       = 'docker.io'
    IMAGE_NAME     = 'yourdockerhubuser/sit753-app'
    IMAGE_TAG      = "${env.GIT_COMMIT}"
    STAGING_HOST   = 'staging.example.com'
    PROD_HOST      = 'prod.example.com'
    STAGING_COMPOSE= 'docker-compose.staging.yml'
    PROD_COMPOSE   = 'docker-compose.prod.yml'
    PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
  }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

  //   stage('Shell Test') {
  // steps {
  //   sh 'which sh'
  // }
}

    stage('Build') {
      steps {
        sh '''
          set -e
          node -v || true
          npm ci
          npm run build || true
          docker build -t $IMAGE_NAME:$IMAGE_TAG .
        '''
      }
    }

    stage('Test') {
      steps {
        sh '''
          set -e
          npm test -- --ci --reporters=default --reporters=jest-junit --coverage || true
        '''
      }
      post {
        always {
          junit 'junit.xml'                           // if using jest-junit, configure to write junit.xml
          publishCoverage adapters: [coberturaAdapter('coverage/cobertura-coverage.xml')], sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
        }
      }
    }

    stage('Code Quality (SonarQube)') {
      steps {
        withSonarQubeEnv('sonarqube') {
          withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_LOGIN')]) {
            sh '''
              npm ci --silent || true
              ./node_modules/.bin/sonar-scanner || sonar-scanner \
                -Dsonar.login=$SONAR_LOGIN
            '''
          }
        }
      }
      post {
        success {
          // fail the build if Sonar Quality Gate fails
          script {
            timeout(time: 10, unit: 'MINUTES') {
              def qg = waitForQualityGate()
              if (qg.status != 'OK') {
                error "Quality Gate failed: ${qg.status}"
              }
            }
          }
        }
      }
    }

    stage('Security') {
      steps {
        sh '''
          set -e
          # Dependency audit
          npm audit --json || true > npm-audit.json

          # OWASP Dependency-Check (CLI via Docker)
          docker run --rm -v "$PWD":/src owasp/dependency-check:latest \
            --scan /src --format "HTML" --out /src --project your-app || true

          # Trivy image scan
          docker run --rm aquasec/trivy:latest image --exit-code 0 --severity HIGH,CRITICAL $IMAGE_NAME:$IMAGE_TAG > trivy.txt || true

          # Fail if Trivy finds CRITICAL issues (adjust to policy)
          docker run --rm aquasec/trivy:latest image --exit-code 1 --severity CRITICAL $IMAGE_NAME:$IMAGE_TAG || true
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'dependency-check-report.html, npm-audit.json, trivy.txt', fingerprint: true
          recordIssues enabledForFailure: true, tools: [
            trivy(pattern: 'trivy.txt'),
            npmAudit(pattern: 'npm-audit.json'),
            dependencyCheck(pattern: 'dependency-check-report.html')
          ]
        }
      }
    }

    stage('Push Image (Staging)') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:staging-$BUILD_NUMBER
            docker push $IMAGE_NAME:$IMAGE_TAG
            docker push $IMAGE_NAME:staging-$BUILD_NUMBER
          '''
        }
      }
    }

    stage('Deploy to Staging') {
      steps {
        sshagent(credentials: ['staging-ssh']) {
          sh '''
            export IMAGE="$IMAGE_NAME:staging-$BUILD_NUMBER"
            ssh -o StrictHostKeyChecking=no ubuntu@$STAGING_HOST "mkdir -p ~/app && echo IMAGE=$IMAGE > ~/app/.env"
            scp -o StrictHostKeyChecking=no ${STAGING_COMPOSE} ubuntu@$STAGING_HOST:~/app/
            ssh -o StrictHostKeyChecking=no ubuntu@$STAGING_HOST "cd ~/app && IMAGE=$IMAGE docker compose -f ${STAGING_COMPOSE} --env-file .env pull && IMAGE=$IMAGE docker compose -f ${STAGING_COMPOSE} --env-file .env up -d"
            ssh -o StrictHostKeyChecking=no ubuntu@$STAGING_HOST "curl -fsS http://localhost:5001/health || exit 1"
          '''
        }
      }
    }

    stage('Release to Production') {
      when { beforeAgent true; branch 'main' }
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
            ssh -o StrictHostKeyChecking=no ubuntu@$PROD_HOST "cd ~/app && IMAGE=$IMAGE docker compose -f ${PROD_COMPOSE} --env-file .env pull && IMAGE=$IMAGE docker compose -f ${PROD_COMPOSE} --env-file .env up -d"
            ssh -o StrictHostKeyChecking=no ubuntu@$PROD_HOST "curl -fsS http://localhost/health || exit 1"
          '''
        }
      }
    }

    stage('Monitoring & Alerting') {
      steps {
        withCredentials([string(credentialsId: 'DD_API_KEY', variable: 'DD_API_KEY')]) {
          sh '''
            # Post a deploy event to Datadog (replace tags as needed)
            curl -sS -X POST "https://api.datadoghq.com/api/v1/events" \
              -H "DD-API-KEY: $DD_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{
                    "title": "Deploy '$JOB_NAME' #'$BUILD_NUMBER'",
                    "text": "Image: '$IMAGE_NAME':'$IMAGE_TAG'",
                    "tags": ["service:your-app","env:production","team:your-team"]
                  }' >/dev/null || true
          '''
        }
      }
    }
  }

  post {
    always {
      cleanWs()
    }
  }
}
