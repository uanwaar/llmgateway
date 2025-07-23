export interface GatewayRequest {
  id: string;
  timestamp: Date;
  correlationId?: string;
  clientId?: string;
  apiKey?: string;
  route: string;
  method: string;
  headers: { [key: string]: string };
  body: any;
  query: { [key: string]: string };
  ip: string;
  userAgent?: string;
}

export interface GatewayResponse {
  id: string;
  requestId: string;
  timestamp: Date;
  statusCode: number;
  headers: { [key: string]: string };
  body: any;
  processingTime: number;
  provider?: string;
  cached: boolean;
  error?: GatewayError;
}

export interface GatewayError {
  type: string;
  code: string;
  message: string;
  provider?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  correlationId?: string;
}

export interface RoutingRequest {
  originalRequest: GatewayRequest;
  normalizedRequest: any;
  route: RouteConfig;
  providers: string[];
  fallbackProviders?: string[];
  retryCount: number;
  maxRetries: number;
}

export interface RouteConfig {
  path: string;
  method: string;
  providers: string[];
  fallbackProviders?: string[];
  requireAuth: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    keyGenerator?: (req: GatewayRequest) => string;
  };
  validation?: {
    schema: object;
    sanitize: boolean;
  };
  transformation?: {
    request?: (req: any) => any;
    response?: (res: any) => any;
  };
}

export interface AuthRequest {
  apiKey: string;
  clientId?: string;
  scope?: string[];
  timestamp: Date;
  signature?: string;
}

export interface AuthResponse {
  valid: boolean;
  clientId?: string;
  permissions: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerMinute: number;
    tokensPerDay: number;
  };
  quotas: {
    used: number;
    remaining: number;
    resetTime: Date;
  };
  metadata?: {
    [key: string]: any;
  };
}

export interface CacheRequest {
  key: string;
  data?: any;
  ttl?: number;
  tags?: string[];
  namespace?: string;
}

export interface CacheResponse {
  hit: boolean;
  key: string;
  data?: any;
  ttl?: number;
  createdAt?: Date;
  expiresAt?: Date;
  tags?: string[];
}

export interface MetricsRequest {
  provider?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  metrics?: string[];
}

export interface MetricsResponse {
  provider?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  granularity: string;
  data: MetricDataPoint[];
  summary: MetricsSummary;
}

export interface MetricDataPoint {
  timestamp: Date;
  requests: number;
  successes: number;
  failures: number;
  averageResponseTime: number;
  totalTokens: number;
  errors: { [errorType: string]: number };
}

export interface MetricsSummary {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  totalTokens: number;
  costEstimate: number;
  topErrors: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export interface ValidationRequest {
  data: any;
  schema: object;
  sanitize?: boolean;
  strict?: boolean;
}

export interface ValidationResponse {
  valid: boolean;
  data?: any;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface StreamingRequest extends CompletionRequest {
  stream: true;
  onChunk?: (chunk: CompletionChunk) => void;
  onError?: (error: GatewayError) => void;
  onComplete?: () => void;
}

export interface BatchRequest {
  id: string;
  requests: any[];
  parallel?: boolean;
  maxConcurrency?: number;
  failFast?: boolean;
  timeout?: number;
}

export interface BatchResponse {
  id: string;
  responses: any[];
  errors: any[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}

export interface LoadBalancingRequest {
  providers: string[];
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'response_time' | 'random';
  weights?: { [provider: string]: number };
  healthCheck?: boolean;
  excludeUnhealthy?: boolean;
}

export interface LoadBalancingResponse {
  selectedProvider: string;
  reason: string;
  alternatives: string[];
  metadata: {
    weights?: { [provider: string]: number };
    healthStatus?: { [provider: string]: string };
    responseTimeRanking?: string[];
  };
}