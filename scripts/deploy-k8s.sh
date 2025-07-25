#!/bin/bash
# Kubernetes deployment script for LLM Gateway

set -e

# Configuration
NAMESPACE="llm-gateway"
IMAGE_NAME="llm-gateway"
IMAGE_TAG="${IMAGE_TAG:-latest}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
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
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    docker build \
        --target production \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --tag "${IMAGE_NAME}:latest" \
        .
    
    # If registry is specified, push the image
    if [ -n "$DOCKER_REGISTRY" ]; then
        log_info "Pushing image to registry: $DOCKER_REGISTRY"
        docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}"
    fi
    
    log_success "Docker image ready: ${IMAGE_NAME}:${IMAGE_TAG}"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Namespace $NAMESPACE already exists"
    else
        kubectl apply -f k8s/namespace.yaml
        log_success "Namespace created"
    fi
}

# Deploy secrets
deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets exist
    if kubectl get secret llm-gateway-secrets -n "$NAMESPACE" &> /dev/null; then
        log_warning "Secrets already exist. Use --update-secrets to update them."
    else
        # Create secrets from environment variables or prompt user
        if [ -z "$OPENAI_API_KEY" ] || [ -z "$GEMINI_API_KEY" ]; then
            log_error "API keys not found in environment variables"
            log_error "Please set OPENAI_API_KEY and GEMINI_API_KEY environment variables"
            log_error "Or update the secret.yaml file manually"
            exit 1
        fi
        
        # Apply secrets with environment variable substitution
        envsubst < k8s/secret.yaml | kubectl apply -f -
        log_success "Secrets deployed"
    fi
}

# Deploy ConfigMaps
deploy_configmaps() {
    log_info "Deploying ConfigMaps..."
    kubectl apply -f k8s/configmap.yaml
    log_success "ConfigMaps deployed"
}

# Deploy RBAC
deploy_rbac() {
    log_info "Deploying RBAC configuration..."
    kubectl apply -f k8s/rbac.yaml
    log_success "RBAC configuration deployed"
}

# Deploy Redis
deploy_redis() {
    log_info "Deploying Redis..."
    kubectl apply -f k8s/redis-deployment.yaml
    kubectl apply -f k8s/redis-service.yaml
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/redis -n "$NAMESPACE"
    log_success "Redis deployed and ready"
}

# Deploy application
deploy_app() {
    log_info "Deploying LLM Gateway application..."
    
    # Update image in deployment
    sed -i.bak "s|image: llm-gateway:latest|image: ${IMAGE_NAME}:${IMAGE_TAG}|g" k8s/deployment.yaml
    
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    
    # Wait for deployment to be ready
    log_info "Waiting for application to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment/llm-gateway -n "$NAMESPACE"
    
    # Restore original deployment file
    mv k8s/deployment.yaml.bak k8s/deployment.yaml
    
    log_success "Application deployed and ready"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying Ingress configuration..."
    kubectl apply -f k8s/ingress.yaml
    log_success "Ingress deployed"
}

# Deploy HPA
deploy_hpa() {
    log_info "Deploying Horizontal Pod Autoscaler..."
    kubectl apply -f k8s/hpa.yaml
    log_success "HPA deployed"
}

# Health check
check_health() {
    log_info "Performing health check..."
    
    # Get service endpoint
    local service_ip
    service_ip=$(kubectl get service llm-gateway-service -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [ -z "$service_ip" ]; then
        # If no external IP, try port-forward
        log_info "No external IP found, using port-forward for health check"
        kubectl port-forward service/llm-gateway-internal 8080:8080 -n "$NAMESPACE" &
        local pf_pid=$!
        sleep 5
        
        if curl -f -s http://localhost:8080/health > /dev/null; then
            log_success "Service is healthy"
            kill $pf_pid 2>/dev/null || true
            return 0
        else
            log_error "Health check failed"
            kill $pf_pid 2>/dev/null || true
            return 1
        fi
    else
        if curl -f -s "http://$service_ip/health" > /dev/null; then
            log_success "Service is healthy at $service_ip"
            return 0
        else
            log_error "Health check failed"
            return 1
        fi
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment status:"
    echo
    
    log_info "Namespace:"
    kubectl get namespace "$NAMESPACE"
    echo
    
    log_info "Deployments:"
    kubectl get deployments -n "$NAMESPACE"
    echo
    
    log_info "Services:"
    kubectl get services -n "$NAMESPACE"
    echo
    
    log_info "Pods:"
    kubectl get pods -n "$NAMESPACE"
    echo
    
    log_info "HPA status:"
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "HPA not found"
    echo
    
    log_info "Ingress:"
    kubectl get ingress -n "$NAMESPACE" 2>/dev/null || echo "Ingress not found"
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    kubectl rollout undo deployment/llm-gateway -n "$NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/llm-gateway -n "$NAMESPACE"
    log_success "Rollback completed"
}

# Cleanup deployment
cleanup_deployment() {
    log_warning "Cleaning up deployment..."
    
    read -p "Are you sure you want to delete the entire deployment? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete namespace "$NAMESPACE"
        log_success "Deployment cleaned up"
    else
        log_info "Cleanup cancelled"
    fi
}

# Main deployment function
main() {
    log_info "Starting LLM Gateway Kubernetes deployment"
    log_info "Namespace: $NAMESPACE"
    log_info "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    log_info "Environment: $ENVIRONMENT"
    
    check_prerequisites
    build_and_push_image
    create_namespace
    deploy_rbac
    deploy_configmaps
    deploy_secrets
    deploy_redis
    deploy_app
    deploy_ingress
    deploy_hpa
    
    log_info "Waiting for all services to stabilize..."
    sleep 30
    
    check_health
    show_status
    
    log_success "Deployment completed successfully!"
    
    # Show access information
    local external_ip
    external_ip=$(kubectl get service llm-gateway-service -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    
    if [ "$external_ip" != "pending" ] && [ -n "$external_ip" ]; then
        log_info "External access: http://$external_ip"
    else
        log_info "External IP is pending. Use 'kubectl get services -n $NAMESPACE' to check status"
        log_info "Or use port-forward: kubectl port-forward service/llm-gateway-internal 8080:8080 -n $NAMESPACE"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --update-secrets)
            deploy_secrets
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
        --rollback)
            rollback_deployment
            exit 0
            ;;
        --cleanup)
            cleanup_deployment
            exit 0
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NS       Set namespace (default: llm-gateway)"
            echo "  --tag TAG           Set image tag (default: latest)"
            echo "  --registry REG      Docker registry URL"
            echo "  --environment ENV   Set environment (development|production)"
            echo "  --update-secrets    Update secrets only"
            echo "  --health-check      Perform health check only"
            echo "  --status            Show deployment status"
            echo "  --rollback          Rollback deployment"
            echo "  --cleanup           Delete entire deployment"
            echo "  --help              Show this help message"
            echo
            echo "Environment variables:"
            echo "  OPENAI_API_KEY      OpenAI API key"
            echo "  GEMINI_API_KEY      Google Gemini API key"
            echo "  DOCKER_REGISTRY     Docker registry URL"
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