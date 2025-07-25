# LLM Gateway - Production Dockerfile
# Multi-stage build for optimized production image

# Build stage - Install dependencies and run build
FROM node:18-alpine AS builder

# Install build dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --only=production=false && \
    npm cache clean --force

# Copy source code and configuration
COPY src/ ./src/
COPY config/ ./config/
COPY docs/ ./docs/
COPY .eslintrc.js .prettierrc.js ./

# Run linting to ensure code quality
RUN npm run lint

# Production stage - Create optimized runtime image
FROM node:18-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application from builder stage
COPY --from=builder --chown=gateway:nodejs /app/src ./src
COPY --from=builder --chown=gateway:nodejs /app/config ./config
COPY --from=builder --chown=gateway:nodejs /app/docs ./docs

# Copy additional required files
COPY --chown=gateway:nodejs .env.example ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tmp && \
    chown -R gateway:nodejs /app

# Switch to non-root user
USER gateway

# Expose port (using environment variable with default)
EXPOSE 8080

# Health check with retry logic
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]