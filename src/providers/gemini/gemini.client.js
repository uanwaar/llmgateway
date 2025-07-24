const https = require('https');
const FormData = require('form-data');
const { logger } = require('../../utils/logger');
const { ProviderError, RequestTimeoutError, RateLimitError } = require('../../utils/errors');

class GeminiClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.baseUrl || config.endpoint || 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    this.retryAttempts = config.retryCount || config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  async makeRequest(path, options = {}) {
    const {
      method = 'POST',
      data = null,
      headers = {},
      stream = false,
      timeout = this.timeout,
      useApiKeyParam = false,
    } = options;

    const url = useApiKeyParam 
      ? `${this.baseURL}${path}?key=${this.apiKey}`
      : `${this.baseURL}${path}`;

    const requestHeaders = {
      'User-Agent': 'LLM-Gateway/1.0',
      ...headers,
    };

    if (!useApiKeyParam) {
      requestHeaders['x-goog-api-key'] = this.apiKey;
    }

    if (data && !headers['Content-Type']) {
      if (data instanceof FormData) {
        Object.assign(requestHeaders, data.getHeaders());
      } else {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const requestOptions = {
      method,
      headers: requestHeaders,
      timeout,
    };

    let attempt = 0;
    while (attempt < this.retryAttempts) {
      try {
        const result = await this._executeRequest(url, requestOptions, data, stream);
        return result;
      } catch (error) {
        attempt++;
        
        if (this._shouldRetry(error) && attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(`Gemini API request failed, retrying in ${delay}ms`, {
            attempt,
            error: error.message,
            url: path,
          });
          await this._sleep(delay);
          continue;
        }

        throw this._handleError(error);
      }
    }
  }

  async _executeRequest(url, options, data, stream) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout,
      };

      const req = https.request(requestOptions, (res) => {
        if (stream) {
          resolve(res);
          return;
        }

        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              headers: res.headers,
              data: responseData,
            };

            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
              return;
            }

            if (res.headers['content-type']?.includes('application/json')) {
              response.data = JSON.parse(responseData);
            }

            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        if (data instanceof FormData) {
          data.pipe(req);
        } else if (typeof data === 'string') {
          req.write(data);
          req.end();
        } else {
          req.write(JSON.stringify(data));
          req.end();
        }
      } else {
        req.end();
      }
    });
  }

  async generateContent(model, request) {
    logger.debug('Making Gemini content generation request', {
      model,
      contentCount: request.contents?.length,
      stream: false,
    });

    const response = await this.makeRequest(`/models/${model}:generateContent`, {
      method: 'POST',
      data: request,
    });

    return response.data;
  }

  async streamGenerateContent(model, request) {
    logger.debug('Making Gemini streaming content generation request', {
      model,
      contentCount: request.contents?.length,
    });

    const response = await this.makeRequest(`/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      data: request,
      stream: true,
    });

    return this._handleStreamingResponse(response);
  }

  async embedContent(model, request) {
    logger.debug('Making Gemini embedding request', {
      model,
      taskType: request.taskType,
    });

    const response = await this.makeRequest(`/models/${model}:embedContent`, {
      method: 'POST',
      data: request,
    });

    return response.data;
  }

  async batchEmbedContents(model, request) {
    logger.debug('Making Gemini batch embedding request', {
      model,
      batchSize: request.requests?.length,
    });

    const response = await this.makeRequest(`/models/${model}:batchEmbedContents`, {
      method: 'POST',
      data: request,
    });

    return response.data;
  }

  async countTokens(model, request) {
    logger.debug('Making Gemini token counting request', {
      model,
    });

    const response = await this.makeRequest(`/models/${model}:countTokens`, {
      method: 'POST',
      data: request,
    });

    return response.data;
  }

  async uploadFile(file, metadata) {
    logger.debug('Uploading file to Gemini', {
      displayName: metadata.displayName,
      mimeType: file.mimeType,
    });

    const formData = new FormData();
    
    // Add metadata
    formData.append('metadata', JSON.stringify({
      file: metadata,
    }), {
      contentType: 'application/json',
    });

    // Add file
    formData.append('file', file.data, {
      filename: metadata.displayName,
      contentType: file.mimeType,
    });

    const response = await this.makeRequest('/files', {
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': `multipart/related; boundary=${formData.getBoundary()}`,
      },
    });

    return response.data;
  }

  async getFile(fileId) {
    logger.debug('Getting file from Gemini', { fileId });

    const response = await this.makeRequest(`/files/${fileId}`, {
      method: 'GET',
    });

    return response.data;
  }

  async listFiles(pageSize = 10, pageToken = null) {
    logger.debug('Listing files from Gemini', { pageSize, pageToken });

    const params = new URLSearchParams();
    params.append('pageSize', pageSize);
    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const response = await this.makeRequest(`/files?${params.toString()}`, {
      method: 'GET',
    });

    return response.data;
  }

  async deleteFile(fileId) {
    logger.debug('Deleting file from Gemini', { fileId });

    const response = await this.makeRequest(`/files/${fileId}`, {
      method: 'DELETE',
    });

    return response.data;
  }

  async _handleStreamingResponse(stream) {
    return {
      stream: true,
      async *[Symbol.asyncIterator] () {
        let buffer = '';
        
        for await (const chunk of stream) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  yield JSON.parse(data);
                } catch (error) {
                  // Skip invalid JSON
                  logger.debug('Skipping invalid JSON in stream', { data });
                }
              }
            }
          }
        }
        
        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          if (data.trim()) {
            try {
              yield JSON.parse(data);
            } catch (error) {
              logger.debug('Skipping invalid JSON in final buffer', { data });
            }
          }
        }
      },
    };
  }

  _shouldRetry(error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    if (error.message.includes('HTTP 429')) {
      return true;
    }

    if (error.message.includes('HTTP 5')) {
      return true;
    }

    return false;
  }

  _handleError(error) {
    if (error.message.includes('timeout')) {
      return new RequestTimeoutError(30000, { provider: 'gemini', originalError: error.message });
    }

    if (error.message.includes('HTTP 401')) {
      return new ProviderError('Invalid API key', 'AUTHENTICATION_ERROR', 'gemini');
    }

    if (error.message.includes('HTTP 403')) {
      return new ProviderError('Access forbidden', 'AUTHORIZATION_ERROR', 'gemini');
    }

    if (error.message.includes('HTTP 429')) {
      return new RateLimitError('Quota exceeded', 'gemini', 60);
    }

    if (error.message.includes('HTTP 4')) {
      let errorMessage = 'Bad request';
      let errorCode = 'BAD_REQUEST';
      
      try {
        const errorData = JSON.parse(error.message.split(': ')[1]);
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
          errorCode = errorData.error.status || errorCode;
        }
      } catch (e) {
        // Use default message
      }
      
      return new ProviderError(errorMessage, errorCode, 'gemini');
    }

    if (error.message.includes('HTTP 5')) {
      return new ProviderError('Gemini server error', 'SERVER_ERROR', 'gemini');
    }

    return new ProviderError(error.message, 'NETWORK_ERROR', 'gemini');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck() {
    try {
      // Try to count tokens for a simple message
      const testRequest = {
        contents: [
          {
            parts: [{ text: 'test' }],
          },
        ],
      };
      
      await this.countTokens('gemini-2.5-flash', testRequest);
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date(), 
      };
    }
  }

  destroy() {
    // Cleanup if needed
    logger.debug('Gemini client destroyed');
  }
}

module.exports = GeminiClient;