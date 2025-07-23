export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  version?: string;
  timeout?: number;
  retries?: number;
  rateLimits?: RateLimits;
  costs?: ModelCosts;
  models?: ModelDefinition[];
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

export interface ModelCosts {
  [modelId: string]: {
    inputCost: number;
    outputCost: number;
    currency: string;
  };
}

export interface ModelDefinition {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputCost: number;
  outputCost: number;
  features: ModelFeature[];
  deprecated?: boolean;
  replacedBy?: string;
}

export type ModelFeature = 
  | 'completion' 
  | 'embedding' 
  | 'streaming' 
  | 'multimodal' 
  | 'vision' 
  | 'audio' 
  | 'function_calling' 
  | 'json_mode';

export interface ProviderInfo {
  name: string;
  version: string;
  features: string[];
  models: ModelDefinition[];
  endpoint?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  provider: string;
  responseTime?: number;
  timestamp: Date;
  error?: string;
  details?: any;
}

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastHealthCheck: Date | null;
  healthStatus: string;
  isInitialized: boolean;
}

export interface ProviderAdapter {
  name: string;
  config: ProviderConfig;
  
  initialize(): Promise<boolean>;
  healthCheck(): Promise<HealthCheckResult>;
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  streamCompletion(request: CompletionRequest): Promise<AsyncIterable<CompletionChunk>>;
  listModels(): Promise<ModelDefinition[]>;
  getModelInfo(modelId: string): ModelDefinition | null;
  validateRequest(request: any): boolean;
  isSupported(feature: string): boolean;
  getSupportedFeatures(): string[];
  getProviderInfo(): ProviderInfo;
  getAvailableModels(): ModelDefinition[];
  getRateLimits(): RateLimits;
  getCostInfo(model: string): ModelCosts[string];
  getMetrics(): ProviderMetrics;
  destroy(): Promise<void>;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  functions?: Function[];
  function_call?: string | { name: string };
  tools?: Tool[];
  tool_choice?: string | { type: string; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
  user?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | ContentPart[];
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url' | 'input_audio';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
  input_audio?: {
    data: string;
    format: 'wav' | 'mp3';
  };
}

export interface Function {
  name: string;
  description?: string;
  parameters: object;
}

export interface Tool {
  type: 'function';
  function: Function;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionResponse {
  id: string;
  provider: string;
  model: string;
  created: number;
  object: 'chat.completion';
  choices: Choice[];
  usage: Usage;
  system_fingerprint?: string | null;
  metadata?: ResponseMetadata;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  logprobs?: {
    tokens: string[];
    token_logprobs: number[];
    top_logprobs: { [token: string]: number }[];
  } | null;
}

export interface CompletionChunk {
  id: string;
  provider: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChunkChoice[];
}

export interface ChunkChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
    function_call?: {
      name?: string;
      arguments?: string;
    };
    tool_calls?: ToolCall[];
  };
  finish_reason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse {
  id: string;
  provider: string;
  model: string;
  object: 'list';
  data: EmbeddingData[];
  usage: EmbeddingUsage;
  metadata?: ResponseMetadata;
}

export interface EmbeddingData {
  object: 'embedding';
  index: number;
  embedding: number[];
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface ResponseMetadata {
  provider_response_id?: string | null;
  processing_time?: number | null;
  cached?: boolean;
  [key: string]: any;
}

export interface ProviderRegistry {
  register(name: string, adapter: ProviderAdapter): void;
  unregister(name: string): void;
  get(name: string): ProviderAdapter | null;
  list(): string[];
  getAll(): { [name: string]: ProviderAdapter };
  isRegistered(name: string): boolean;
  getHealthy(): ProviderAdapter[];
  getBest(criteria?: SelectionCriteria): ProviderAdapter | null;
}

export interface SelectionCriteria {
  model?: string;
  feature?: ModelFeature;
  cost?: 'lowest' | 'highest';
  performance?: 'fastest' | 'most_reliable';
  excludeProviders?: string[];
  requireProviders?: string[];
}