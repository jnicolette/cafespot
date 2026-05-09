pipeline {
    agent any

    environment {
        IMAGE_BACKEND  = 'cafespot-backend'
        IMAGE_FRONTEND = 'cafespot-frontend'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Lint & Validate') {
            steps {
                echo 'Validating Python syntax...'
                sh 'python3 -m py_compile app.py && echo "app.py OK"'
                echo 'Checking required files exist...'
                sh '''
                    test -f index.html       && echo "index.html OK"
                    test -f css/style.css    && echo "style.css OK"
                    test -f js/app.js        && echo "app.js OK"
                    test -f js/api.js        && echo "api.js OK"
                    test -f js/ui.js         && echo "ui.js OK"
                    test -f js/config.js     && echo "config.js OK"
                    test -f requirements.txt && echo "requirements.txt OK"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Python dependencies...'
                sh 'pip3 install -r requirements.txt'
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building backend Docker image...'
                sh "docker build -t ${IMAGE_BACKEND}:latest ."

                echo 'Building frontend image via docker-compose...'
                sh "docker-compose build"
            }
        }

        stage('Test Backend Health') {
            steps {
                echo 'Starting backend and running health check...'
                sh """
                    docker run -d --name test-backend -p 5099:5000 ${IMAGE_BACKEND}:latest
                    sleep 5
                    curl -f http://localhost:5099/api/health || exit 1
                    echo 'Health check passed!'
                    docker stop test-backend
                    docker rm test-backend
                """
            }
        }

        stage('Deploy') {
            steps {
                echo 'Stopping existing containers...'
                sh 'docker-compose down || true'

                echo 'Starting updated containers...'
                sh 'docker-compose up -d --build'

                echo 'CafeSpot deployed!'
                echo 'Frontend: http://localhost:8080'
                echo 'Backend:  http://localhost:5000'
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded! CafeSpot is live.'
        }
        failure {
            echo 'Pipeline failed. Check the logs above.'
        }
        always {
            echo 'Cleaning up test containers if any remain...'
            sh 'docker rm -f test-backend || true'
        }
    }
}
