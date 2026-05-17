pipeline {
    agent any

    environment {
        IMAGE_BACKEND  = 'cafespot-backend'
        IMAGE_FRONTEND = 'cafespot-frontend'
        PYTHON = '"C:\\Users\\Jazlyn Nicolette\\AppData\\Local\\Programs\\Python\\Python311\\python.exe"'
        PIP    = '"C:\\Users\\Jazlyn Nicolette\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\pip.exe"'
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
                bat "%PYTHON% -m py_compile app.py && echo app.py OK"
                echo 'Checking required files exist...'
                bat '''
                    if exist index.html (echo index.html OK) else (exit 1)
                    if exist css\\style.css (echo style.css OK) else (exit 1)
                    if exist js\\app.js (echo app.js OK) else (exit 1)
                    if exist js\\api.js (echo api.js OK) else (exit 1)
                    if exist js\\ui.js (echo ui.js OK) else (exit 1)
                    if exist js\\config.js (echo config.js OK) else (exit 1)
                    if exist requirements.txt (echo requirements.txt OK) else (exit 1)
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Python dependencies...'
                bat "%PIP% install -r requirements.txt"
                echo 'Verifying imports...'
                bat "%PYTHON% -c \"import flask, flask_cors, requests; print('All imports OK')\""
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building backend Docker image...'
                bat "docker build -t %IMAGE_BACKEND%:latest ."
                echo 'Building via docker-compose...'
                bat 'docker-compose build'
            }
        }

        stage('Test Backend Health') {
            steps {
                echo 'Starting backend and running health check...'
                bat 'docker rm -f test-backend || true'
                bat "docker run -d --name test-backend -p 5099:5000 %IMAGE_BACKEND%:latest"
                sleep(time: 5, unit: 'SECONDS')
                bat 'curl -f http://localhost:5099/api/health'
                echo 'Health check passed!'
                bat 'docker stop test-backend'
                bat 'docker rm test-backend'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Stopping existing containers...'
                bat 'docker-compose down || true'
                echo 'Starting updated containers...'
                bat 'docker-compose up -d --build'
                echo 'CafeSpot deployed!'
                echo 'Frontend: http://localhost:8081'
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
            bat 'docker rm -f test-backend || true'
        }
    }
}
