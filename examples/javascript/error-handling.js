/**
 * JavaScript Error Handling Examples for LLM Gateway
 * 
 * This file demonstrates proper error handling patterns for various scenarios:
 * - Network errors and timeouts
 * - Authentication failures
 * - Validation errors
 * - Provider-specific errors
 * - Rate limiting and quota errors
 * - Retry strategies and exponential backoff
 */

// Example 1: Basic error handling patterns
async function basicErrorHandling() {
  console.log('=== Basic Error Handling ===');
  
  try {
    // Intentionally invalid request to demonstrate error handling
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-key',
      },
      body: JSON.stringify({
        // Missing required 'model' field
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      }),
    });

    if (!response.ok) {
      // Parse error response
      const errorData = await response.json().catch(() => ({}));
      
      console.log('HTTP Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Error Details:', JSON.stringify(errorData, null, 2));
      
      // Handle specific error types
      switch (response.status) {
      case 400:
        console.log('❌ Bad Request - Check your request format');
        break;
      case 401:
        console.log('🔐 Unauthorized - Check your API key');
        break;
      case 429:
        console.log('⏳ Rate Limited - Too many requests');
        break;
      case 500:
        console.log('🔥 Server Error - Try again later');
        break;
      default:
        console.log('❓ Unknown Error');
      }
      
      return;
    }

    const data = await response.json();
    console.log('Success:', data);
    
  } catch (error) {
    console.error('Network/Parse Error:', error.message);
  }
}

// Example 2: Comprehensive error handling class
class LLMGatewayClient {
  constructor(apiKey, baseURL = 'http://localhost:8080/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // Base delay in ms
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
      ...options,
    };

    let lastError;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${this.retryAttempts} - ${endpoint}`);
        
        const response = await fetch(url, defaultOptions);
        
        // Handle different types of errors
        if (!response.ok) {
          const error = await this.handleErrorResponse(response);
          
          // Check if error is retryable
          if (this.isRetryableError(response.status) && attempt < this.retryAttempts) {
            // Exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          
          throw error;
        }
        
        return await response.json();
        
      } catch (error) {
        lastError = error;
        
        // Network errors are always retryable
        if (error.name === 'TypeError' && attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Network error, retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    throw lastError;
  }

  async handleErrorResponse(response) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: 'Unknown error' };
    }

    const error = new Error(errorData.error?.message || errorData.message || 'Request failed');
    error.status = response.status;
    error.statusText = response.statusText;
    error.errorData = errorData;
    
    // Add specific error properties
    switch (response.status) {
    case 400:
      error.name = 'ValidationError';
      error.validationErrors = errorData.error?.details?.validationErrors || [];
      break;
    case 401:
      error.name = 'AuthenticationError';
      break;
    case 403:
      error.name = 'AuthorizationError';
      break;
    case 429:
      error.name = 'RateLimitError';
      error.retryAfter = response.headers.get('Retry-After');
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      error.name = 'ServerError';
      break;
    default:
      error.name = 'APIError';
    }
    
    return error;
  }

  isRetryableError(status) {
    // Retry on server errors and rate limits
    return status >= 500 || status === 429;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async chatCompletion(messages, options = {}) {
    const requestBody = {
      model: options.model || 'gpt-4o-mini',
      messages,
      ...options,
    };

    return await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async getModels() {
    return await this.makeRequest('/models');
  }
}

// Example 3: Demonstrating various error scenarios
async function errorScenarios() {
  console.log('\n=== Error Scenarios Demonstration ===');
  
  const client = new LLMGatewayClient('test-key');
  
  // Scenario 1: Validation Error
  console.log('\n1. Testing validation error (missing model):');
  try {
    await client.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        // Missing 'model' field
      }),
    });
  } catch (error) {
    console.log(`✅ Caught ${error.name}: ${error.message}`);
    if (error.validationErrors) {
      console.log('Validation details:', error.validationErrors);
    }
  }
  
  // Scenario 2: Authentication Error
  console.log('\n2. Testing authentication error:');
  try {
    const badClient = new LLMGatewayClient('invalid-api-key');
    await badClient.chatCompletion([
      { role: 'user', content: 'Hello' },
    ]);
  } catch (error) {
    console.log(`✅ Caught ${error.name}: ${error.message}`);
  }
  
  // Scenario 3: Network Error
  console.log('\n3. Testing network error:');
  try {
    const offlineClient = new LLMGatewayClient('test-key', 'http://localhost:9999/v1');
    await offlineClient.chatCompletion([
      { role: 'user', content: 'Hello' },
    ]);
  } catch (error) {
    console.log(`✅ Caught network error: ${error.message}`);
  }
}

// Example 4: Streaming error handling
async function streamingErrorHandling() {
  console.log('\n=== Streaming Error Handling ===');
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Count to 10' }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = `HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`;
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // let fullResponse = '';

    console.log('Streaming response:');
    
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n✅ Stream completed successfully');
            return;
          }
          
          try {
            const chunk = JSON.parse(data);
            
            // Check for error in chunk
            if (chunk.error) {
              throw new Error(`Stream error: ${chunk.error.message}`);
            }
            
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              // fullResponse += content;
            }
          } catch (parseError) {
            console.error('\n❌ Error parsing chunk:', parseError.message);
            console.error('Raw data:', data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
  } catch (error) {
    console.error('❌ Streaming error:', error.message);
  }
}

// Example 5: Advanced error recovery strategies
class RobustLLMClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'http://localhost:8080/v1';
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.timeoutMs = options.timeoutMs || 60000;
    this.fallbackModels = options.fallbackModels || ['gpt-4o-mini', 'gpt-3.5-turbo'];
  }

  async chatCompletionWithFallback(messages, options = {}) {
    const models = [options.model, ...this.fallbackModels].filter(Boolean);
    const uniqueModels = [...new Set(models)];
    
    let lastError;
    
    for (const model of uniqueModels) {
      console.log(`Trying model: ${model}`);
      
      try {
        const result = await this.makeRequestWithTimeout('/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            ...options,
            model,
            messages,
          }),
        });
        
        console.log(`✅ Success with ${model}`);
        return result;
        
      } catch (error) {
        console.log(`❌ Failed with ${model}: ${error.message}`);
        lastError = error;
        
        // Don't try fallback models for certain errors
        if (error.name === 'AuthenticationError') {
          break;
        }
      }
    }
    
    throw lastError;
  }

  async makeRequestWithTimeout(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error?.message || 'Request failed');
        error.status = response.status;
        error.name = this.getErrorName(response.status);
        throw error;
      }
      
      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${this.timeoutMs}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      
      throw error;
    }
  }

  getErrorName(status) {
    switch (status) {
    case 400: return 'ValidationError';
    case 401: return 'AuthenticationError';
    case 403: return 'AuthorizationError';
    case 429: return 'RateLimitError';
    case 500:
    case 502:
    case 503:
    case 504: return 'ServerError';
    default: return 'APIError';
    }
  }
}

// Example 6: Error monitoring and logging
class ErrorLogger {
  constructor() {
    this.errors = [];
    this.errorCounts = new Map();
  }

  logError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      status: error.status,
      context,
      stack: error.stack,
    };
    
    this.errors.push(errorRecord);
    
    const key = `${error.name}:${error.status}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    
    console.log('🔍 Error logged:', {
      name: error.name,
      message: error.message,
      status: error.status,
      context,
    });
  }

  getErrorSummary() {
    console.log('\n=== Error Summary ===');
    console.log(`Total errors: ${this.errors.length}`);
    
    if (this.errorCounts.size > 0) {
      console.log('\nError breakdown:');
      for (const [key, count] of this.errorCounts.entries()) {
        console.log(`- ${key}: ${count} occurrences`);
      }
    }
    
    if (this.errors.length > 0) {
      console.log('\nRecent errors:');
      this.errors.slice(-5).forEach((error, index) => {
        console.log(`${index + 1}. [${error.timestamp}] ${error.name}: ${error.message}`);
      });
    }
  }

  clearErrors() {
    this.errors = [];
    this.errorCounts.clear();
  }
}

// Example 7: Complete error handling demonstration
async function completeErrorDemo() {
  console.log('\n=== Complete Error Handling Demo ===');
  
  const errorLogger = new ErrorLogger();
  const robustClient = new RobustLLMClient('your-api-key-here', {
    maxRetries: 2,
    fallbackModels: ['gpt-4o-mini', 'gemini-2.0-flash-exp'],
  });
  
  const testScenarios = [
    {
      name: 'Valid request',
      messages: [{ role: 'user', content: 'Hello!' }],
      model: 'gpt-4o-mini',
    },
    {
      name: 'Invalid model',
      messages: [{ role: 'user', content: 'Hello!' }],
      model: 'non-existent-model',
    },
    {
      name: 'Large context',
      messages: [{ role: 'user', content: 'Tell me about AI. '.repeat(1000) }],
      model: 'gpt-4o-mini',
    },
  ];
  
  for (const scenario of testScenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    
    try {
      const result = await robustClient.chatCompletionWithFallback(
        scenario.messages,
        { model: scenario.model },
      );
      const preview = result.choices[0].message.content.substring(0, 100);
      console.log('✅ Success:', `${preview}...`);
    } catch (error) {
      errorLogger.logError(error, { scenario: scenario.name });
    }
  }
  
  errorLogger.getErrorSummary();
}

// Main execution function
async function runErrorHandlingExamples() {
  console.log('LLM Gateway Error Handling Examples\n');
  console.log('These examples demonstrate robust error handling patterns.');
  console.log('Some errors are intentional to show error handling in action.\n');

  await basicErrorHandling();
  await errorScenarios();
  await streamingErrorHandling();
  await completeErrorDemo();
  
  console.log('\n=== All error handling examples completed ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runErrorHandlingExamples().catch(console.error);
}

// Export classes and functions for use in other files
module.exports = {
  LLMGatewayClient,
  RobustLLMClient,
  ErrorLogger,
  basicErrorHandling,
  errorScenarios,
  streamingErrorHandling,
  completeErrorDemo,
};

/**
 * Usage Instructions:
 * 
 * 1. Start the LLM Gateway:
 *    npm run dev
 * 
 * 2. Run this example:
 *    node examples/javascript/error-handling.js
 * 
 * Key Error Handling Patterns Demonstrated:
 * - HTTP status code handling
 * - Network error recovery
 * - Retry strategies with exponential backoff
 * - Authentication and validation errors
 * - Streaming error handling
 * - Timeout handling
 * - Model fallback strategies
 * - Error logging and monitoring
 * - Graceful degradation
 * 
 * Error Types Covered:
 * - ValidationError (400) - Invalid request format
 * - AuthenticationError (401) - Invalid API key
 * - AuthorizationError (403) - Insufficient permissions
 * - RateLimitError (429) - Too many requests
 * - ServerError (5xx) - Server-side issues
 * - TimeoutError - Request timeout
 * - NetworkError - Connection issues
 * 
 * Best Practices Shown:
 * - Specific error types and handling
 * - Retry logic for transient errors
 * - Fallback strategies
 * - Error context preservation
 * - User-friendly error messages
 * - Error monitoring and analytics
 */