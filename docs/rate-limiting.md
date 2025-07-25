# Rate Limiting Configuration

The LLM Gateway provides flexible rate limiting that can be configured based on your specific use case and deployment scenario.

## Configuration Overview

Rate limiting can be configured in your YAML configuration files with very flexible options for different environments.

### Global Rate Limiting

```yaml
# config/default.yaml
server:
  rateLimitingEnabled: true  # Set to false to disable completely

rateLimit:
  # Global default (applies to all endpoints unless overridden)
  windowMs: 900000  # 15 minutes
  max: 10000        # 10,000 requests per 15 minutes
  message: "Too many requests, please try again later"
```

### Endpoint-Specific Rate Limits

Different endpoints can have different rate limiting strategies and limits:

```yaml
rateLimit:
  # Chat completions - Token bucket for burst handling
  chat:
    strategy: "token-bucket"
    capacity: 5000      # Allow 5000 token burst
    refillRate: 1000    # Refill 1000 tokens per minute
    refillPeriod: 60000 # 1 minute
    message: "Too many chat requests, please slow down"
  
  # Embeddings - Fixed window
  embeddings:
    windowMs: 60000     # 1 minute
    max: 1000           # 1000 requests per minute
    message: "Too many embedding requests, please slow down"
  
  # Audio processing - Sliding window
  audio:
    windowMs: 300000    # 5 minutes  
    max: 500            # 500 requests per 5 minutes
    message: "Too many audio requests, please slow down"
  
  # Models listing - Strict (internal checks only)
  models:
    windowMs: 1800000   # 30 minutes
    max: 1              # 1 request per 30 minutes
    message: "Model listing is for internal checks only - limit: 1 per 30 minutes"
  
  # Health checks - Strict (internal monitoring only)
  health:
    windowMs: 1800000   # 30 minutes  
    max: 1              # 1 request per 30 minutes
    message: "Health checks are for internal monitoring only - limit: 1 per 30 minutes"
```

## Rate Limiting Strategies

### 1. Fixed Window
- Simple request counting within fixed time windows
- Good for basic rate limiting
- Used for: embeddings, models, health checks

### 2. Token Bucket  
- Allows burst traffic up to capacity
- Refills tokens at configured rate
- Good for: chat completions (allows bursts of requests)

### 3. Sliding Window
- More precise than fixed window
- Smooths out request distribution
- Good for: audio processing (resource-intensive)

## Environment-Specific Configuration

### Development Environment
```yaml
# config/development.yaml
server:
  rateLimitingEnabled: false  # Disable completely for testing

# OR use very relaxed limits
rateLimit:
  chat:
    capacity: 50000    # 50,000 token burst
    refillRate: 10000  # 10,000 tokens per minute
```

### Production Environment
```yaml
# config/production.yaml
server:
  rateLimitingEnabled: true

rateLimit:
  chat:
    capacity: 1000     # More conservative for production
    refillRate: 200    # 200 tokens per minute
```

## Key Identification

Rate limits are applied per:

1. **API Key** - If provided via `Authorization: Bearer <key>`
2. **User ID** - If user authentication is enabled  
3. **IP Address** - Fallback for unauthenticated requests

## Customizing for Your Use Case

### High-Traffic Scenarios
```yaml
rateLimit:
  chat:
    capacity: 10000    # Large burst capacity
    refillRate: 2000   # High refill rate
```

### API Service Provider
```yaml
rateLimit:
  chat:
    capacity: 500      # Moderate burst
    refillRate: 100    # Conservative refill
```

### Internal Use Only
```yaml
server:
  rateLimitingEnabled: false  # No limits for internal use
```

### Per-User Limits
For SaaS scenarios, you can implement per-user rate limiting by:
1. Setting up authentication
2. Using user IDs for rate limit keys
3. Configuring appropriate limits per user tier

## Monitoring Rate Limits

Rate limit headers are automatically added to responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Strategy` - Strategy being used

## Disabling Rate Limiting

For testing or internal use, you can completely disable rate limiting:

```yaml
server:
  rateLimitingEnabled: false
```

This is the recommended approach for:
- Development environments
- Testing scenarios  
- Internal-only deployments
- High-trust environments

## Endpoint-Specific Considerations

### Models Endpoint (`/v1/models`)
- **Purpose**: Internal infrastructure checks and occasional model discovery
- **Rate Limit**: 1 request per 30 minutes (very strict)
- **Reasoning**: This should only be called during system startup or administrative tasks, not by regular user applications

### Health Endpoint (`/health`) 
- **Purpose**: Internal monitoring and health checks for deployment infrastructure
- **Rate Limit**: 1 request per 30 minutes (very strict)
- **Reasoning**: Should only be used by deployment systems, load balancers, or monitoring tools with appropriate intervals

### Chat Completions (`/v1/chat/completions`)
- **Purpose**: Primary user-facing functionality
- **Rate Limit**: Token bucket with burst capacity (most generous)
- **Reasoning**: This is the main service that users interact with frequently

## Best Practices

1. **Start Relaxed**: Begin with generous limits and tighten based on usage patterns
2. **Monitor Usage**: Use metrics to understand actual usage patterns  
3. **Environment-Specific**: Use different limits for dev/staging/production
4. **User-Friendly Messages**: Provide clear error messages when limits are exceeded
5. **Gradual Implementation**: Roll out rate limiting gradually in production
6. **Internal vs External**: Strict limits for internal/admin endpoints, generous for user-facing endpoints

The default configuration provides reasonable limits for most self-hosted scenarios while allowing full customization for specific needs.