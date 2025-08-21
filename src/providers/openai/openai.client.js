const https = require('https');
const FormData = require('form-data');
const { logger } = require('../../utils/logger');
const { ProviderError, NetworkError, RateLimitError } = require('../../utils/errors');

class OpenAIClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.baseUrl || config.endpoint || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
    this.retryAttempts = config.retryCount || config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async makeRequest(path, options = {}) {
    const {
      method = 'POST',
      data = null,
      headers = {},
      stream = false,
      timeout = this.timeout,
    } = options;

    const url = `${this.baseURL}${path}`;
    const requestHeaders = {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'LLM-Gateway/1.0',
      ...headers,
    };

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
          logger.warn(`OpenAI API request failed, retrying in ${delay}ms`, {
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
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout,
      };

      const protocol = urlObj.protocol === 'https:' ? https : require('http');
      const req = protocol.request(requestOptions, (res) => {
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

  async chatCompletion(request) {
    logger.debug('Making OpenAI chat completion request', {
      model: request.model,
      messageCount: request.messages?.length,
      stream: request.stream,
    });

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      data: request,
      stream: request.stream,
    });

    if (request.stream) {
      return this._handleStreamingResponse(response);
    }

    return response.data;
  }

  async createEmbedding(request) {
    logger.debug('Making OpenAI embedding request', {
      model: request.model,
      inputLength: Array.isArray(request.input) ? request.input.length : 1,
    });

    const response = await this.makeRequest('/embeddings', {
      method: 'POST',
      data: request,
    });

    return response.data;
  }

  async transcribeAudio(request) {
    logger.debug('Making OpenAI transcription request', {
      model: request.model,
      language: request.language,
      stream: request.stream,
    });

    const formData = new FormData();
    
    // Add file (support Buffer, stream, or multer object)
    if (request.file) {
      const file = request.file;
      let value = file;
      let options = undefined;
      
      if (Buffer.isBuffer(file)) {
        value = file;
        options = {
          filename: 'audio',
          contentType: request.mimetype || 'application/octet-stream',
        };
      } else if (file?.buffer && Buffer.isBuffer(file.buffer)) {
        value = file.buffer;
        options = {
          filename: file.originalname || 'audio',
          contentType: file.mimetype || 'application/octet-stream',
        };
      }
      
      if (options) {
        formData.append('file', value, options);
      } else {
        // Fallback: let form-data try to handle streams/strings
        formData.append('file', value, file.originalname || 'audio');
      }
    }

    // Add other parameters
    Object.keys(request).forEach(key => {
      if (key !== 'file' && request[key] !== undefined) {
        if (Array.isArray(request[key])) {
          request[key].forEach((item) => {
            formData.append(`${key}[]`, item);
          });
        } else if (typeof request[key] === 'object') {
          formData.append(key, JSON.stringify(request[key]));
        } else {
          formData.append(key, request[key].toString());
        }
      }
    });

    const response = await this.makeRequest('/audio/transcriptions', {
      method: 'POST',
      data: formData,
      stream: request.stream,
    });

    if (request.stream) {
      return this._handleStreamingResponse(response);
    }

    return response.data;
  }

  async translateAudio(request) {
    logger.debug('Making OpenAI translation request', {
      model: request.model,
    });

    const formData = new FormData();
    
    // Add file (support Buffer, stream, or multer object)
    if (request.file) {
      const file = request.file;
      let value = file;
      let options = undefined;
      
      if (Buffer.isBuffer(file)) {
        value = file;
        options = {
          filename: 'audio',
          contentType: request.mimetype || 'application/octet-stream',
        };
      } else if (file?.buffer && Buffer.isBuffer(file.buffer)) {
        value = file.buffer;
        options = {
          filename: file.originalname || 'audio',
          contentType: file.mimetype || 'application/octet-stream',
        };
      }
      
      if (options) {
        formData.append('file', value, options);
      } else {
        formData.append('file', value, file.originalname || 'audio');
      }
    }

    // Add other parameters
    Object.keys(request).forEach(key => {
      if (key !== 'file' && request[key] !== undefined) {
        formData.append(key, request[key].toString());
      }
    });

    const response = await this.makeRequest('/audio/translations', {
      method: 'POST',
      data: formData,
    });

    return response.data;
  }

  async generateSpeech(request) {
    logger.debug('Making OpenAI TTS request', {
      model: request.model,
      voice: request.voice,
      stream: request.stream_format === 'sse',
    });

    const response = await this.makeRequest('/audio/speech', {
      method: 'POST',
      data: request,
      stream: request.stream_format === 'sse',
    });

    if (request.stream_format === 'sse') {
      return this._handleStreamingResponse(response);
    }

    return response;
  }

  async listModels() {
    logger.debug('Fetching OpenAI models list');

    const response = await this.makeRequest('/models', {
      method: 'GET',
    });

    return response.data;
  }

  async _handleStreamingResponse(stream) {
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        resolve({
          stream: true,
          chunks,
          async *[Symbol.asyncIterator] () {
            for (const chunk of chunks) {
              const lines = chunk.toString().split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    return;
                  }
                  try {
                    yield JSON.parse(data);
                  } catch (error) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          },
        });
      });

      stream.on('error', reject);
    });
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
      return new NetworkError('Request timeout', 'TIMEOUT', 'openai');
    }

    if (error.message.includes('HTTP 401')) {
      return new ProviderError('Invalid API key', 'AUTHENTICATION_ERROR', 'openai');
    }

    if (error.message.includes('HTTP 403')) {
      return new ProviderError('Access forbidden', 'AUTHORIZATION_ERROR', 'openai');
    }

    if (error.message.includes('HTTP 429')) {
      return new RateLimitError('Rate limit exceeded', 'openai', 60);
    }

    if (error.message.includes('HTTP 4')) {
      let errorMessage = 'Bad request';
      try {
        const errorData = JSON.parse(error.message.split(': ')[1]);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // Use default message
      }
      return new ProviderError(errorMessage, 'BAD_REQUEST', 'openai');
    }

    if (error.message.includes('HTTP 5')) {
      return new ProviderError('OpenAI server error', 'SERVER_ERROR', 'openai');
    }

    return new NetworkError(error.message, 'NETWORK_ERROR', 'openai');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createResponse(request) {
    logger.debug('Making OpenAI response request', {
      model: request.model,
      messageCount: request.messages?.length,
      stream: request.stream,
      background: request.background,
    });

    const response = await this.makeRequest('/responses', {
      method: 'POST',
      data: request,
      stream: request.stream,
    });

    if (request.stream) {
      return this._handleResponseStreamingResponse(response);
    }

    return response.data;
  }

  async retrieveResponse(responseId) {
    logger.debug('Retrieving OpenAI response', {
      responseId,
    });

    const response = await this.makeRequest(`/responses/${responseId}`, {
      method: 'GET',
    });

    return response.data;
  }

  async cancelResponse(responseId) {
    logger.debug('Cancelling OpenAI response', {
      responseId,
    });

    const response = await this.makeRequest(`/responses/${responseId}/cancel`, {
      method: 'POST',
    });

    return response.data;
  }

  async _handleResponseStreamingResponse(stream) {
    const events = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        events.push(chunk);
      });

      stream.on('end', () => {
        resolve({
          stream: true,
          events,
          async *[Symbol.asyncIterator] () {
            for (const chunk of events) {
              const lines = chunk.toString().split('\n');
              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  // Skip event type line
                  continue;
                }
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    return;
                  }
                  try {
                    const eventData = JSON.parse(data);
                    yield eventData;
                  } catch (error) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          },
        });
      });

      stream.on('error', reject);
    });
  }

  async healthCheck() {
    try {
      await this.listModels();
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
    logger.debug('OpenAI client destroyed');
  }
}

module.exports = OpenAIClient;