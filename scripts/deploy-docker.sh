#!/bin/bash
# Docker deployment script for LLM Gateway

set -e

# Configuration
PROJECT_NAME="llm-gateway"
IMAGE_NAME="llm-gateway"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    docker build \
        --target production \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --tag "${IMAGE_NAME}:latest" \
        .
    
    log_success "Docker image built successfully"
}

# Deploy with Docker Compose
deploy_compose() {
    log_info "Deploying with Docker Compose (${ENVIRONMENT} environment)"
    
    # Choose the appropriate compose file
    if [ "$ENVIRONMENT" = "development" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    else
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        log_warning ".env file not found, creating from template"
        cp .env.example .env
        log_warning "Please update the .env file with your API keys"
    fi
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d --build
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Health check
    check_health
}

# Health check
check_health() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:8080/health > /dev/null; then
            log_success "Service is healthy"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - Service not ready yet, waiting..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show deployment status
show_status() {
    log_info "Deployment status:"
    docker-compose ps
    
    log_info "Service logs (last 20 lines):"
    docker-compose logs --tail=20 gateway
}

# Cleanup function
cleanup() {
    log_info "Cleaning up unused Docker resources..."
    docker system prune -f
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting LLM Gateway deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    check_prerequisites
    build_image
    deploy_compose
    show_status
    
    log_success "Deployment completed successfully!"
    log_info "Access the gateway at: http://localhost:8080"
    log_info "Health check: http://localhost:8080/health"
    log_info "API documentation: http://localhost:8080/docs"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --cleanup)
            cleanup
            exit 0
            ;;
        --health-check)
            check_health
            exit $?
            ;;
        --status)
            show_status
            exit 0
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --environment ENV    Set environment (development|production)"
            echo "  --tag TAG           Set image tag (default: latest)"
            echo "  --cleanup           Clean up Docker resources"
            echo "  --health-check      Perform health check only"
            echo "  --status            Show deployment status"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main