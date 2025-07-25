# Deployment Scripts

This directory contains deployment automation scripts for the LLM Gateway project. These scripts simplify the deployment process for both Docker and Kubernetes environments.

## Scripts Overview

### 1. Docker Deployment Scripts

#### `deploy-docker.sh` (Linux/macOS)
Bash script for automated Docker deployment with Docker Compose.

**Usage:**
```bash
./scripts/deploy-docker.sh [OPTIONS]
```

**Options:**
- `--environment ENV`: Set environment (development|production)
- `--tag TAG`: Set Docker image tag (default: latest)
- `--cleanup`: Clean up Docker resources
- `--health-check`: Perform health check only
- `--status`: Show deployment status
- `--help`: Show help message

**Examples:**
```bash
# Production deployment
./scripts/deploy-docker.sh --environment production

# Development deployment with custom tag
./scripts/deploy-docker.sh --environment development --tag v1.2.3

# Health check only
./scripts/deploy-docker.sh --health-check

# Clean up Docker resources
./scripts/deploy-docker.sh --cleanup
```

#### `deploy-docker.bat` (Windows)
Windows batch script equivalent of the bash script.

**Usage:**
```cmd
scripts\deploy-docker.bat [OPTIONS]
```

### 2. Kubernetes Deployment Script

#### `deploy-k8s.sh`
Comprehensive Kubernetes deployment script with full lifecycle management.

**Usage:**
```bash
./scripts/deploy-k8s.sh [OPTIONS]
```

**Options:**
- `--namespace NS`: Set namespace (default: llm-gateway)
- `--tag TAG`: Set image tag (default: latest)
- `--registry REG`: Docker registry URL
- `--environment ENV`: Set environment (development|production)
- `--update-secrets`: Update secrets only
- `--health-check`: Perform health check only
- `--status`: Show deployment status
- `--rollback`: Rollback deployment
- `--cleanup`: Delete entire deployment
- `--help`: Show help message

**Environment Variables:**
- `OPENAI_API_KEY`: OpenAI API key
- `GEMINI_API_KEY`: Google Gemini API key
- `DOCKER_REGISTRY`: Docker registry URL

**Examples:**
```bash
# Full deployment with API keys
export OPENAI_API_KEY="your-openai-key"
export GEMINI_API_KEY="your-gemini-key"
./scripts/deploy-k8s.sh

# Deploy to custom namespace with registry
./scripts/deploy-k8s.sh --namespace my-gateway --registry myregistry.com

# Update secrets only
./scripts/deploy-k8s.sh --update-secrets

# Check deployment status
./scripts/deploy-k8s.sh --status

# Rollback deployment
./scripts/deploy-k8s.sh --rollback

# Clean up everything
./scripts/deploy-k8s.sh --cleanup
```

### 3. Health Check Script

#### `health-check.sh`
Comprehensive health check script for monitoring gateway status.

**Usage:**
```bash
./scripts/health-check.sh [OPTIONS]
```

**Options:**
- `--url URL`: Gateway URL (default: http://localhost:8080)
- `--timeout SECONDS`: Request timeout (default: 30)
- `--verbose`: Enable verbose output
- `--basic`: Check basic health only
- `--ready`: Check readiness only
- `--providers`: Check providers only
- `--help`: Show help message

**Environment Variables:**
- `GATEWAY_URL`: Override default gateway URL
- `TIMEOUT`: Override default timeout
- `VERBOSE`: Enable verbose output (true/false)

**Examples:**
```bash
# Full health check
./scripts/health-check.sh

# Check remote deployment
./scripts/health-check.sh --url https://api.example.com --verbose

# Quick basic health check
./scripts/health-check.sh --basic

# Check with custom timeout
./scripts/health-check.sh --timeout 60
```

## Prerequisites

### For Docker Deployment
- Docker (20.10+)
- Docker Compose (2.0+)
- curl (for health checks)

### For Kubernetes Deployment
- kubectl (configured with cluster access)
- Docker (for building images)
- Optional: Docker registry for image storage

## Configuration Files

### Docker Compose Files
- `docker-compose.yml`: Production configuration
- `docker-compose.dev.yml`: Development configuration

### Kubernetes Manifests
- `k8s/namespace.yaml`: Namespace definition
- `k8s/configmap.yaml`: Configuration settings
- `k8s/secret.yaml`: Sensitive data (API keys)
- `k8s/deployment.yaml`: Application deployment
- `k8s/service.yaml`: Service definitions
- `k8s/ingress.yaml`: Ingress configuration
- `k8s/rbac.yaml`: Role-based access control
- `k8s/hpa.yaml`: Horizontal Pod Autoscaler
- `k8s/redis-*.yaml`: Redis cache deployment

## Security Considerations

1. **API Keys**: Never commit actual API keys to version control
2. **Secrets Management**: Use Kubernetes secrets or environment variables
3. **Network Security**: Configure proper ingress rules and network policies
4. **Container Security**: Scripts use non-root users and security contexts
5. **RBAC**: Minimal required permissions for service accounts

## Troubleshooting

### Common Issues

1. **Docker build fails**
   - Check Docker daemon is running
   - Ensure sufficient disk space
   - Verify Dockerfile syntax

2. **Kubernetes deployment fails**
   - Check kubectl configuration: `kubectl cluster-info`
   - Verify namespace exists
   - Check resource quotas and limits

3. **Health checks fail**
   - Verify service is running: `docker ps` or `kubectl get pods`
   - Check logs: `docker logs` or `kubectl logs`
   - Verify network connectivity

4. **Permission errors (Linux/macOS)**
   - Make scripts executable: `chmod +x scripts/*.sh`
   - Run with appropriate permissions

### Debugging

1. **Enable verbose mode** in health check script
2. **Check logs** using deployment status commands
3. **Use port-forward** for local testing:
   ```bash
   kubectl port-forward service/llm-gateway-internal 8080:8080
   ```

## Development Workflow

### Local Development
```bash
# Start development environment
./scripts/deploy-docker.sh --environment development

# Check status
./scripts/deploy-docker.sh --status

# Run health check
./scripts/health-check.sh --verbose
```

### Production Deployment
```bash
# Build and deploy to production
export OPENAI_API_KEY="your-key"
export GEMINI_API_KEY="your-key"
./scripts/deploy-k8s.sh --environment production

# Monitor deployment
./scripts/deploy-k8s.sh --status
./scripts/health-check.sh --url https://your-domain.com
```

## Monitoring and Maintenance

1. **Regular health checks**: Set up automated health check monitoring
2. **Log monitoring**: Monitor application and infrastructure logs
3. **Resource monitoring**: Track CPU, memory, and network usage
4. **Security updates**: Regularly update base images and dependencies
5. **Backup strategies**: Implement backup for persistent data (Redis)

## Contributing

When adding new deployment features:

1. Update the appropriate script
2. Add configuration examples
3. Update this README
4. Test in both development and production environments
5. Follow security best practices