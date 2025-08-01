/* eslint-disable no-console */
/**
 * Basic JavaScript Usage Examples for LLM Gateway
 * 
 * This file demonstrates basic usage patterns for interacting with the LLM Gateway API
 * using both native fetch and the OpenAI SDK compatibility mode.
 */

// Example 0: Basic chat completion WITHOUT authorization header (recommended for .env setup)
async function basicChatNoAuth() {
  console.log('=== Basic Chat Completion (No Auth Required) ===');
  
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
            content: 'Hello! whats on my mind?', 
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Assistant response:', data.choices[0].message.content);
    console.log('Model used:', data.model);
    console.log('Usage:', data.usage);
    console.log('✅ SUCCESS: No auth header needed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Example 1: Basic chat completion using fetch (with authorization header)
async function basicChatWithFetch() {
  console.log('\n=== Basic Chat Completion with Auth Header ===');
  
  const apiKey = 'your-api-key-here'; // Replace with your actual API key
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Hello! What can you help me with?' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Assistant response:', data.choices[0].message.content);
    console.log('Model used:', data.model);
    console.log('Usage:', data.usage);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 2: Chat with multiple messages and system prompt
async function chatWithSystemPrompt() {
  console.log('\n=== Chat with System Prompt ===');
  
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
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: 'im testing my app say all the best to me' },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    console.log('Assistant response:', data.choices[0].message.content);
    console.log('Model used:', data.model);
    console.log('Usage:', data.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 3: Using OpenAI SDK compatibility mode
/*
async function usingOpenAISDK() {
  console.log('\n=== Using OpenAI SDK (Compatible) ===');
  
  // Note: Install with: npm install openai
  const OpenAI = require('openai');
  
  let openai;
  try {
    openai = new OpenAI({
      apiKey: 'your-api-key-here',
      baseURL: 'http://localhost:8080/v1',  // Point to LLM Gateway
    });
  } catch (error) {
    console.error('Failed to initialize OpenAI SDK:', error.message);
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains concepts clearly.',
        },
        {
          role: 'user',
          content: 'Explain what an API is in simple terms.',
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    console.log('Response:', completion.choices[0].message.content);
    console.log('Finish reason:', completion.choices[0].finish_reason);
  } catch (error) {
    console.error('SDK Error:', error.message);
  }
}
*/
// Uncomment the above function to use OpenAI SDK compatibility mode

// Example 4: Using Gemini models
async function usingGeminiModel() {
  console.log('\n=== Using Gemini Model ===');
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'user', content: 'What are the benefits of renewable energy?' },
        ],
        temperature: 0.8,
        max_tokens: 250,
      }),
    });

    const data = await response.json();
    console.log('Gemini response:', data.choices[0].message.content);
    console.log('Model used:', data.model);
    console.log('Usage:', data.usage);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 5: Getting available models
async function getAvailableModels() {
  console.log('\n=== Available Models ===');
  
  try {
    const response = await fetch('http://localhost:8080/v1/models', {
      headers: {
        'Authorization': 'Bearer your-api-key-here',
      },
    });

    const data = await response.json();
    console.log('Available models:');
    data.data.forEach(model => {
      console.log(`- ${model.id} (${model.owned_by})`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 6: Custom parameters and provider-specific settings
async function customParameters() {
  console.log('\n=== Custom Parameters ===');
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Tell me a creative story about space exploration.' },
        ],
        temperature: 1.0,
        max_tokens: 300,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        // Custom parameters (forwarded to provider)
        custom_setting: 'creative_mode',
        experimental_feature: true,
        provider_config: {
          optimization: 'creativity',
          style: 'narrative',
        },
      }),
    });

    const data = await response.json();
    console.log('Creative response:', data.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 7: Multimodal request with image
async function multimodalExample() {
  console.log('\n=== Multimodal Example (Image) ===');
  
  // Example base64 image (1x1 red pixel for demo)
  const base64Image = 'data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/' +
    'PchI7wAAAABJRU5ErkJggg==';
  
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What color is this image?' },
              { 
                type: 'image_url', 
                image_url: { url: base64Image },
              },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    console.log('Vision response:', data.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Main execution function
async function runExamples() {
  console.log('LLM Gateway JavaScript Examples\n');
  console.log('Setup Options:');
  console.log('OPTION A (Recommended): Use .env file configuration');
  console.log('  1. Copy .env.example to .env');
  console.log('  2. Set OPENAI_API_KEY and GEMINI_API_KEY in .env');
  console.log('  3. Start gateway: npm run dev');
  console.log('  4. Run examples without auth headers! ✨');
  console.log();
  console.log('OPTION B: Use manual API keys');
  console.log('  1. Replace "your-api-key-here" with your actual API key');
  console.log('  2. Start gateway: npm run dev');
  console.log('  3. Examples will use Authorization headers');
  console.log();

  // Run all examples - starting with no-auth example
  await basicChatNoAuth();  // This should work with .env configuration
  await basicChatWithFetch();
  await chatWithSystemPrompt();
  // await usingOpenAISDK();
  await usingGeminiModel();
  await getAvailableModels();
  await customParameters();
  await multimodalExample();
  
  console.log('\n=== All examples completed ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

// Export functions for use in other files
module.exports = {
  basicChatNoAuth,
  basicChatWithFetch,
  chatWithSystemPrompt,
  //usingOpenAISDK,
  usingGeminiModel,
  getAvailableModels,
  customParameters,
  multimodalExample,
};

/**
 * Usage Instructions:
 * 
 * 1. Install dependencies:
 *    npm install openai
 * 
 * 2. Set up environment variables (choose one):
 *    OPTION A: Set individual API keys in your shell:
 *              export OPENAI_API_KEY="your-openai-key"
 *              export GEMINI_API_KEY="your-gemini-key"
 *    
 *    OPTION B: Use .env file (recommended):
 *              1. Copy .env.example to .env
 *              2. Edit .env and set OPENAI_API_KEY and GEMINI_API_KEY
 *              3. The gateway will automatically use these keys
 * 
 * 3. Start the LLM Gateway:
 *    npm run dev
 * 
 * 4. Run this example:
 *    node examples/javascript/basic-usage.js
 * 
 * Expected output:
 * - Chat completion responses
 * - Model information
 * - Usage statistics
 * - Error handling demonstrations
 */