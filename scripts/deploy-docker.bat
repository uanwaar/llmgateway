@echo off
REM Docker deployment script for LLM Gateway (Windows)

setlocal enabledelayedexpansion

REM Configuration
set PROJECT_NAME=llm-gateway
set IMAGE_NAME=llm-gateway
if "%IMAGE_TAG%"=="" set IMAGE_TAG=latest
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

REM Colors (Windows terminal color codes)
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set BLUE=[94m
set NC=[0m

REM Parse command line arguments
:parse_args
if "%1"=="" goto main
if "%1"=="--environment" (
    set ENVIRONMENT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--tag" (
    set IMAGE_TAG=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--cleanup" (
    call :cleanup
    exit /b 0
)
if "%1"=="--health-check" (
    call :check_health
    exit /b %errorlevel%
)
if "%1"=="--status" (
    call :show_status
    exit /b 0
)
if "%1"=="--help" (
    echo Usage: %0 [OPTIONS]
    echo Options:
    echo   --environment ENV    Set environment (development^|production)
    echo   --tag TAG           Set image tag (default: latest)
    echo   --cleanup           Clean up Docker resources
    echo   --health-check      Perform health check only
    echo   --status            Show deployment status
    echo   --help              Show this help message
    exit /b 0
)
echo %RED%[ERROR]%NC% Unknown option: %1
exit /b 1

:main
echo %BLUE%[INFO]%NC% Starting LLM Gateway deployment
echo %BLUE%[INFO]%NC% Environment: %ENVIRONMENT%
echo %BLUE%[INFO]%NC% Image: %IMAGE_NAME%:%IMAGE_TAG%

call :check_prerequisites
if %errorlevel% neq 0 exit /b 1

call :build_image
if %errorlevel% neq 0 exit /b 1

call :deploy_compose
if %errorlevel% neq 0 exit /b 1

call :show_status

echo %GREEN%[SUCCESS]%NC% Deployment completed successfully!
echo %BLUE%[INFO]%NC% Access the gateway at: http://localhost:8080
echo %BLUE%[INFO]%NC% Health check: http://localhost:8080/health
goto :eof

:check_prerequisites
echo %BLUE%[INFO]%NC% Checking prerequisites...

docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Docker is not installed
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Docker Compose is not installed
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Prerequisites check passed
exit /b 0

:build_image
echo %BLUE%[INFO]%NC% Building Docker image: %IMAGE_NAME%:%IMAGE_TAG%

docker build --target production --tag %IMAGE_NAME%:%IMAGE_TAG% --tag %IMAGE_NAME%:latest .
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Failed to build Docker image
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Docker image built successfully
exit /b 0

:deploy_compose
echo %BLUE%[INFO]%NC% Deploying with Docker Compose (%ENVIRONMENT% environment)

REM Choose the appropriate compose file
if "%ENVIRONMENT%"=="development" (
    set COMPOSE_FILE=docker-compose.dev.yml
) else (
    set COMPOSE_FILE=docker-compose.yml
)

REM Check if .env file exists
if not exist .env (
    echo %YELLOW%[WARNING]%NC% .env file not found, creating from template
    copy .env.example .env
    echo %YELLOW%[WARNING]%NC% Please update the .env file with your API keys
)

REM Stop existing containers
echo %BLUE%[INFO]%NC% Stopping existing containers...
docker-compose -f %COMPOSE_FILE% down --remove-orphans

REM Start services
echo %BLUE%[INFO]%NC% Starting services...
docker-compose -f %COMPOSE_FILE% up -d --build
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Failed to start services
    exit /b 1
)

REM Wait for services to be ready
echo %BLUE%[INFO]%NC% Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Health check
call :check_health
exit /b 0

:check_health
echo %BLUE%[INFO]%NC% Performing health check...

set max_attempts=30
set attempt=1

:health_loop
if %attempt% gtr %max_attempts% (
    echo %RED%[ERROR]%NC% Health check failed after %max_attempts% attempts
    exit /b 1
)

curl -f -s http://localhost:8080/health >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%[SUCCESS]%NC% Service is healthy
    exit /b 0
)

echo %BLUE%[INFO]%NC% Attempt %attempt%/%max_attempts% - Service not ready yet, waiting...
timeout /t 5 /nobreak >nul
set /a attempt+=1
goto health_loop

:show_status
echo %BLUE%[INFO]%NC% Deployment status:
docker-compose ps

echo %BLUE%[INFO]%NC% Service logs (last 20 lines):
docker-compose logs --tail=20 gateway
exit /b 0

:cleanup
echo %BLUE%[INFO]%NC% Cleaning up unused Docker resources...
docker system prune -f
echo %GREEN%[SUCCESS]%NC% Cleanup completed
exit /b 0