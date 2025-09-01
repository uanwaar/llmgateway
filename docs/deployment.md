# LLM Gateway - Deployment Guide

## Overview

This document covers deployment strategies, configuration options, and operational considerations for the LLM Gateway in various environments.

## Deployment Architecture

### Self-Hosted Infrastructure
The gateway is designed for flexible self-hosting across different environments:

```
GitHub Repository → Docker Container → Self-Hosted Infrastructure
                 → Direct Installation → Local/Cloud Servers
                 → Kubernetes → Enterprise Deployments
```

## API Key Management

### Authentication Modes

#### Gateway-Level Configuration
- **Use Case**: Team/organization deployments with centralized control
- **Benefits**: Single point of credential management, simplified client integration
- **Security**: API keys stored in gateway configuration files or environment variables

#### Client-Level Authentication
- **Use Case**: Multi-tenant scenarios, SaaS applications
- **Benefits**: Distributed credential management, per-request authentication
- **Security**: API keys passed by client applications in request headers

#### Hybrid Approach (Recommended)
- **Use Case**: Flexible deployments supporting both scenarios
- **Benefits**: Default gateway keys with client override capability
- **Security**: Fallback mechanism with optional client-provided keys

### Security Considerations

- Store API keys in environment variables, not in code
- Use secure secret management systems in production
- Implement API key rotation capabilities
- Monitor and log authentication events
- Consider using encrypted storage for sensitive credentials

## Configuration

### Environment Variables
```bash
# Core Configuration
GATEWAY_PORT=8080
NODE_ENV=production

# Provider API Keys (Optional - can be client-provided)
OPENAI_API_KEY=sk-your-openai-key
- `HEALTH_CHECK_INTERVAL_MS`: Override provider health check interval in milliseconds (default 30000)
GEMINI_API_KEY=your-gemini-key

# Feature Flags
CACHE_ENABLED=true
RATE_LIMITING_ENABLED=true
CORS_ENABLED=true

# Performance
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000
```

### Gateway Configuration File
```yaml
# config/production.yaml
auth:
  mode: "hybrid"  # gateway, client, hybrid
  allow_client_keys: true
  require_auth_header: false

providers:
  openai:
    enabled: true
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"
    timeout: 30000
    retry_count: 3
    
  gemini:
    enabled: true
    api_key: "${GEMINI_API_KEY}"
    base_url: "https://generativelanguage.googleapis.com/v1"
    timeout: 30000
    retry_count: 3

routing:
  strategy: "cost_optimized"  # round_robin, performance, cost_optimized
  failover_enabled: true
  
cache:
  enabled: true
  ttl: 3600  # 1 hour
  max_size: 1000
  
security:
  cors_origins: ["*"]
  rate_limit_rpm: 1000
  api_key_header: "X-API-Key"
```

## Deployment Methods

### Docker Deployment (Recommended)

#### Single Container
```yaml
# docker-compose.yml
version: '3.8'
services:
  llm-gateway:
    image: llm-gateway:latest
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CACHE_ENABLED=true
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

#### With Redis Cache
```yaml
version: '3.8'
services:
  llm-gateway:
    image: llm-gateway:latest
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - redis
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### Kubernetes Deployment

#### Basic Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-gateway
  labels:
    app: llm-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-gateway
  template:
    metadata:
      labels:
        app: llm-gateway
    spec:
      containers:
      - name: llm-gateway
        image: llm-gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-key
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: gemini-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### Service Configuration
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: llm-gateway-service
spec:
  selector:
    app: llm-gateway
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

#### Secrets Management
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
stringData:
  openai-key: "sk-your-openai-key"
  gemini-key: "your-gemini-key"
```

### Cloud Provider Deployments

#### AWS ECS
```json
{
  "family": "llm-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "llm-gateway",
      "image": "your-account.dkr.ecr.region.amazonaws.com/llm-gateway:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-key"
        }
      ]
    }
  ]
}
```

#### Google Cloud Run
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: llm-gateway
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 100
      containers:
      - image: gcr.io/project-id/llm-gateway:latest
        ports:
        - name: http1
          containerPort: 8080
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-key
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
```

## Monitoring and Observability

### Health Checks
```javascript
// Health check endpoints
GET /health        # Basic health check
GET /health/ready  # Readiness probe
GET /health/live   # Liveness probe
```

### Metrics Collection
```yaml
# Prometheus metrics endpoint
GET /metrics

# Key metrics:
# - gateway_requests_total
# - gateway_request_duration_seconds
# - gateway_provider_requests_total
# - gateway_cache_hits_total
# - gateway_errors_total
```

### Logging Configuration
```yaml
logging:
  level: "info"  # debug, info, warn, error
  format: "json"  # json, text
  output: "stdout"  # stdout, file
  include_request_id: true
  include_provider_info: true
```

## Scaling Considerations

### Horizontal Scaling
- Deploy multiple gateway instances behind a load balancer
- Use sticky sessions if caching locally
- Consider distributed caching with Redis

### Vertical Scaling
- Monitor CPU and memory usage
- Scale based on request volume and latency
- Consider async processing for high-latency requests

### Performance Optimization
- Enable response caching for repeated requests
- Implement connection pooling for provider APIs
- Use compression for large responses
- Optimize JSON parsing and serialization

## Security Best Practices

### Network Security
- Use HTTPS/TLS for all communications
- Implement proper CORS policies
- Consider API gateway/proxy for additional security layers

### Access Control
- Implement rate limiting per client
- Use API keys or JWT tokens for authentication
- Log and monitor all access attempts

### Data Protection
- Never log sensitive information (API keys, user data)
- Encrypt data at rest and in transit
- Implement proper secret rotation
- Regular security audits and updates

## Backup and Recovery

### Configuration Backup
- Version control all configuration files
- Backup environment variables and secrets
- Document recovery procedures

### Data Backup
- Backup cached data if persistence is required
- Export metrics and logs for analysis
- Test recovery procedures regularly

## Troubleshooting

### Common Issues
1. **Provider API failures**: Check API keys and network connectivity
2. **High latency**: Monitor provider response times and caching
3. **Memory issues**: Check for memory leaks and optimize caching
4. **Authentication errors**: Verify API key configuration and permissions

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development DEBUG=* npm start

# Check specific component logs
DEBUG=gateway:router,gateway:cache npm start
```

### Health Monitoring
```bash
# Check gateway health
curl http://localhost:8080/health

# Check specific provider connectivity
curl http://localhost:8080/health/providers

# View current configuration
curl http://localhost:8080/config
```