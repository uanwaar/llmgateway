/**
 * JavaScript Streaming Examples for LLM Gateway
 * 
 * This file demonstrates streaming response handling for real-time chat completions.
 * Streaming allows receiving partial responses as they are generated, providing
 * better user experience for longer responses.
 */

// Example 0: Basic streaming WITHOUT authorization header (recommended for .env setup)
async function basicStreamingNoAuth() {
  console.log('=== Basic Streaming (No Auth Required) ===');
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header - gateway will use .env provider keys automatically
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Write a short story about a robot learning to paint.',
          },
        ],
        stream: true,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    console.log('✅ Streaming response (no auth needed):');
    console.log('---');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n---');
            console.log('✅ Streaming completed successfully!');
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Example 1: Basic streaming with fetch and Server-Sent Events (with auth header)
async function basicStreaming() {
  console.log('\n=== Basic Streaming with Auth Header ===');
  
  const apiKey = 'your-api-key-here'; // Replace with your actual API key
  
  try {
    const response = await fetch('http://localhost:3000/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Write a short story about a robot learning to paint.',
          },
        ],
        stream: true,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    console.log('Streaming response:');
    console.log('---');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;
      
      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Parse Server-Sent Event format
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log('\n---');
            console.log('Stream complete!');
            console.log('Full response:', fullResponse);
            return;
          }
          
          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            
            if (content) {
              process.stdout.write(content);
              fullResponse += content;
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error.message);
  }
}

// Example 2: Streaming with OpenAI SDK
async function streamingWithSDK() {
  console.log('\n=== Streaming with OpenAI SDK ===');
  
  const OpenAI = require('openai');
  
  const openai = new OpenAI({
    apiKey: 'your-api-key-here',
    baseURL: 'http://localhost:8080/v1',
  });

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Explain quantum computing in simple terms, step by step.',
        },
      ],
      stream: true,
      max_tokens: 400,
    });

    console.log('SDK streaming response:');
    console.log('---');

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
        fullResponse += content;
      }
    }

    console.log('\n---');
    console.log('Full response length:', fullResponse.length, 'characters');
  } catch (error) {
    console.error('SDK streaming error:', error.message);
  }
}

// Example 3: Advanced streaming with progress tracking
async function advancedStreaming() {
  console.log('\n=== Advanced Streaming with Progress Tracking ===');
  
  let tokenCount = 0;
  let chunkCount = 0;
  const startTime = Date.now();
  let fullResponse = '';

  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a creative writing assistant. Write detailed, engaging content.',
          },
          {
            role: 'user',
            content: 'Write a detailed description of a futuristic city with flying cars, ' +
              'vertical farms, and sustainable energy.',
          },
        ],
        stream: true,
        max_tokens: 800,
        temperature: 0.8,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    console.log('Advanced streaming with metrics:');
    console.log('='.repeat(50));

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
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;
          
          console.log(`\n${'='.repeat(50)}`);
          console.log('Streaming Statistics:');
          console.log(`- Total tokens: ${tokenCount}`);
          console.log(`- Total chunks: ${chunkCount}`);
          console.log(`- Duration: ${duration.toFixed(2)} seconds`);
          console.log(`- Avg tokens/second: ${(tokenCount / duration).toFixed(2)}`);
          console.log(`- Response length: ${fullResponse.length} characters`);
          return;
        }
        
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          
          if (delta?.content) {
            const content = delta.content;
            process.stdout.write(content);
            fullResponse += content;
            tokenCount += content.split(/\s+/).length;
            chunkCount++;
            
            // Show progress every 10 chunks
            if (chunkCount % 10 === 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const progressMsg = `\n[${chunkCount} chunks, ${tokenCount} tokens, ` +
                `${elapsed.toFixed(1)}s]\n`;
              process.stdout.write(progressMsg);
            }
          }
        } catch (parseError) {
          console.error('\nError parsing chunk:', parseError.message);
        }
      }
    }
  } catch (error) {
    console.error('Advanced streaming error:', error.message);
  }
}

// Example 4: Streaming with custom event handling
class StreamingChatHandler {
  constructor(apiKey, baseURL = 'http://localhost:8080/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  async streamChat(messages, options = {}) {
    const requestBody = {
      model: options.model || 'gpt-4o-mini',
      messages,
      stream: true,
      ...options,
    };

    this.emit('start', { messages, options });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

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
            this.emit('complete', { fullResponse });
            return fullResponse;
          }
          
          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            
            if (content) {
              fullResponse += content;
              this.emit('chunk', { content, chunk, fullResponse });
            }
          } catch (parseError) {
            this.emit('error', { error: parseError, line });
          }
        }
      }
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }
  }
}

// Example 5: Using the custom streaming handler
async function customStreamingHandler() {
  console.log('\n=== Custom Streaming Handler ===');
  
  const handler = new StreamingChatHandler('your-api-key-here');
  
  // Set up event listeners
  handler.on('start', (data) => {
    console.log('Stream started with', data.messages.length, 'messages');
  });
  
  handler.on('chunk', (data) => {
    process.stdout.write(data.content);
  });
  
  handler.on('complete', (data) => {
    console.log('\n---');
    console.log('Stream completed. Total response length:', data.fullResponse.length);
  });
  
  handler.on('error', (data) => {
    console.error('Stream error:', data.error.message);
  });

  try {
    await handler.streamChat([
      { role: 'user', content: 'Write a haiku about artificial intelligence and creativity.' },
    ], {
      model: 'gpt-4o-mini',
      temperature: 1.0,
    });
  } catch (error) {
    console.error('Handler error:', error.message);
  }
}

// Example 6: Streaming comparison between providers
async function providerComparison() {
  console.log('\n=== Provider Streaming Comparison ===');
  
  const prompt = 'Explain the concept of machine learning in 3 paragraphs.';
  const models = ['gpt-4o-mini', 'gemini-2.0-flash-exp'];
  
  for (const model of models) {
    console.log(`\n--- ${model.toUpperCase()} ---`);
    
    const startTime = Date.now();
    let tokenCount = 0;
    
    try {
      const response = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-api-key-here',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            const duration = (Date.now() - startTime) / 1000;
            console.log(`\n[${model}: ${tokenCount} tokens in ${duration.toFixed(2)}s]`);
            break;
          }
          
          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              tokenCount += content.split(/\s+/).length;
            }
          } catch (parseError) {
            // Ignore parse errors for demo
          }
        }
      }
    } catch (error) {
      console.error(`Error with ${model}:`, error.message);
    }
  }
}

// Main execution function
async function runStreamingExamples() {
  console.log('LLM Gateway Streaming Examples\n');
  console.log('These examples demonstrate real-time streaming responses.');
  console.log('Make sure the LLM Gateway is running on http://localhost:8080\n');

  await basicStreaming();
  await streamingWithSDK();
  await advancedStreaming();
  await customStreamingHandler();
  await providerComparison();
  
  console.log('\n=== All streaming examples completed ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  basicStreamingNoAuth().catch(console.error);
  runStreamingExamples().catch(console.error);
}

// Export functions and classes for use in other files
module.exports = {
  basicStreamingNoAuth,
  basicStreaming,
  streamingWithSDK,
  advancedStreaming,
  StreamingChatHandler,
  customStreamingHandler,
  providerComparison,
};

/**
 * Usage Instructions:
 * 
 * 1. Install dependencies:
 *    npm install openai
 * 
 * 2. Set up environment variables:
 *    export OPENAI_API_KEY="your-openai-key"
 *    export GEMINI_API_KEY="your-gemini-key"
 * 
 * 3. Start the LLM Gateway:
 *    npm run dev
 * 
 * 4. Run this example:
 *    node examples/javascript/streaming.js
 * 
 * Key Features Demonstrated:
 * - Server-Sent Events (SSE) parsing
 * - Real-time response streaming
 * - Progress tracking and metrics
 * - Error handling during streams
 * - Custom streaming event handlers
 * - Provider comparison
 * - OpenAI SDK compatibility
 * 
 * Expected Output:
 * - Real-time text generation
 * - Streaming statistics
 * - Performance comparisons
 * - Event-driven streaming patterns
 */