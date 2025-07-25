"""
Python Async Usage Examples for LLM Gateway

This file demonstrates asynchronous usage patterns for interacting with the LLM Gateway API
using asyncio, aiohttp, and async versions of popular libraries.
"""

import asyncio
import aiohttp
import json
import time
from typing import List, Dict, Any, Optional, AsyncIterator
import os

# Configuration
GATEWAY_BASE_URL = "http://localhost:8080/v1"
API_KEY = "your-api-key-here"  # Replace with your actual API key


# Example 1: Basic async chat completion
async def basic_async_chat():
    """Demonstrate basic async chat completion using aiohttp."""
    print("=== Basic Async Chat Completion ===")
    
    async with aiohttp.ClientSession() as session:
        url = f"{GATEWAY_BASE_URL}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "user", "content": "Hello! What can you help me with?"}
            ]
        }
        
        try:
            async with session.post(url, json=payload, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                
                print("Response:", data["choices"][0]["message"]["content"])
                print("Model used:", data["model"])
                
        except aiohttp.ClientError as e:
            print(f"Error: {e}")


# Example 2: Concurrent requests to different models
async def concurrent_model_comparison():
    """Compare responses from different models concurrently."""
    print("\n=== Concurrent Model Comparison ===")
    
    models = ["gpt-4o-mini", "gemini-2.0-flash-exp"]
    prompt = "Explain quantum computing in one paragraph."
    
    async def query_model(session: aiohttp.ClientSession, model: str) -> Dict[str, Any]:
        """Query a specific model asynchronously."""
        url = f"{GATEWAY_BASE_URL}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200
        }
        
        start_time = time.time()
        
        try:
            async with session.post(url, json=payload, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                
                end_time = time.time()
                
                return {
                    "model": model,
                    "response": data["choices"][0]["message"]["content"],
                    "duration": end_time - start_time,
                    "success": True
                }
                
        except Exception as e:
            return {
                "model": model,
                "error": str(e),
                "success": False
            }
    
    async with aiohttp.ClientSession() as session:
        # Run queries concurrently
        tasks = [query_model(session, model) for model in models]
        results = await asyncio.gather(*tasks)
        
        # Display results
        for result in results:
            if result["success"]:
                print(f"\n--- {result['model'].upper()} ({result['duration']:.2f}s) ---")
                print(result["response"])
            else:
                print(f"\n--- {result['model'].upper()} - ERROR ---")
                print(result["error"])


# Example 3: Async streaming response handler
async def async_streaming():
    """Handle streaming responses asynchronously."""
    print("\n=== Async Streaming Response ===")
    
    async with aiohttp.ClientSession() as session:
        url = f"{GATEWAY_BASE_URL}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "user", "content": "Write a short story about a robot learning to paint."}
            ],
            "stream": True,
            "max_tokens": 500
        }
        
        try:
            async with session.post(url, json=payload, headers=headers) as response:
                response.raise_for_status()
                
                print("Streaming response:")
                print("---")
                
                full_response = ""
                buffer = ""
                
                async for chunk in response.content.iter_any():
                    buffer += chunk.decode('utf-8')
                    
                    # Process complete lines
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        
                        if line.strip() and line.startswith('data: '):
                            data = line[6:]  # Remove 'data: ' prefix
                            
                            if data == '[DONE]':
                                print("\n---")
                                print("Stream complete!")
                                print(f"Full response: {full_response}")
                                return
                            
                            try:
                                chunk_data = json.loads(data)
                                content = chunk_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                
                                if content:
                                    print(content, end="", flush=True)
                                    full_response += content
                                    
                            except json.JSONDecodeError:
                                continue
                
        except aiohttp.ClientError as e:
            print(f"Streaming error: {e}")


# Example 4: Async client class
class AsyncLLMGatewayClient:
    """Async client for LLM Gateway API."""
    
    def __init__(self, api_key: str, base_url: str = GATEWAY_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str = "gpt-4o-mini",
        **kwargs
    ) -> Dict[str, Any]:
        """Create a chat completion asynchronously."""
        if not self.session:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        payload = {
            "model": model,
            "messages": messages,
            **kwargs
        }
        
        async with self.session.post(
            f"{self.base_url}/chat/completions",
            json=payload
        ) as response:
            response.raise_for_status()
            return await response.json()
    
    async def get_models(self) -> Dict[str, Any]:
        """Get available models asynchronously."""
        if not self.session:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        async with self.session.get(f"{self.base_url}/models") as response:
            response.raise_for_status()
            return await response.json()
    
    async def generate_embeddings(
        self,
        input_texts: List[str],
        model: str = "text-embedding-3-small"
    ) -> Dict[str, Any]:
        """Generate embeddings asynchronously."""
        if not self.session:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        payload = {
            "model": model,
            "input": input_texts
        }
        
        async with self.session.post(
            f"{self.base_url}/embeddings",
            json=payload
        ) as response:
            response.raise_for_status()
            return await response.json()
    
    async def stream_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str = "gpt-4o-mini",
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream chat completion responses."""
        if not self.session:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            **kwargs
        }
        
        async with self.session.post(
            f"{self.base_url}/chat/completions",
            json=payload
        ) as response:
            response.raise_for_status()
            
            buffer = ""
            async for chunk in response.content.iter_any():
                buffer += chunk.decode('utf-8')
                
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    
                    if line.strip() and line.startswith('data: '):
                        data = line[6:]
                        
                        if data == '[DONE]':
                            return
                        
                        try:
                            chunk_data = json.loads(data)
                            content = chunk_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            
                            if content:
                                yield content
                                
                        except json.JSONDecodeError:
                            continue


# Example 5: Using the async client
async def using_async_client():
    """Demonstrate using the async client class."""
    print("\n=== Using Async Client Class ===")
    
    async with AsyncLLMGatewayClient(API_KEY) as client:
        try:
            # Get models
            models = await client.get_models()
            print(f"Available models: {len(models['data'])}")
            
            # Chat completion
            response = await client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "What is the capital of Japan?"}
                ],
                temperature=0.3
            )
            print("Response:", response["choices"][0]["message"]["content"])
            
            # Streaming chat
            print("\nStreaming response:")
            print("---")
            
            async for content in client.stream_chat_completion(
                messages=[
                    {"role": "user", "content": "Count from 1 to 5 slowly."}
                ]
            ):
                print(content, end="", flush=True)
            
            print("\n---")
            
        except Exception as e:
            print(f"Client error: {e}")


# Example 6: Batch processing with semaphore
async def batch_processing_with_semaphore():
    """Process multiple requests with concurrency control."""
    print("\n=== Batch Processing with Semaphore ===")
    
    # Limit concurrent requests to avoid overwhelming the server
    semaphore = asyncio.Semaphore(3)
    
    questions = [
        "What is machine learning?",
        "Explain neural networks.",
        "What is deep learning?",
        "How does natural language processing work?",
        "What are the applications of AI?",
        "Explain computer vision.",
        "What is reinforcement learning?",
        "How do chatbots work?"
    ]
    
    async def process_question(session: aiohttp.ClientSession, question: str, index: int) -> Dict[str, Any]:
        """Process a single question with semaphore control."""
        async with semaphore:
            url = f"{GATEWAY_BASE_URL}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}"
            }
            
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": question}],
                "max_tokens": 100
            }
            
            start_time = time.time()
            
            try:
                async with session.post(url, json=payload, headers=headers) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    return {
                        "index": index,
                        "question": question,
                        "answer": data["choices"][0]["message"]["content"],
                        "duration": time.time() - start_time,
                        "success": True
                    }
                    
            except Exception as e:
                return {
                    "index": index,
                    "question": question,
                    "error": str(e),
                    "success": False
                }
    
    async with aiohttp.ClientSession() as session:
        start_time = time.time()
        
        # Process all questions concurrently
        tasks = [
            process_question(session, question, i)
            for i, question in enumerate(questions)
        ]
        
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        # Display results
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        
        print(f"Processed {len(questions)} questions in {total_time:.2f} seconds")
        print(f"Successful: {len(successful)}, Failed: {len(failed)}")
        
        if successful:
            avg_duration = sum(r["duration"] for r in successful) / len(successful)
            print(f"Average response time: {avg_duration:.2f} seconds")
        
        # Show a few examples
        for result in successful[:3]:
            print(f"\nQ{result['index']+1}: {result['question']}")
            print(f"A: {result['answer'][:100]}...")


# Example 7: Async error handling and retry logic
async def async_error_handling():
    """Demonstrate async error handling with retry logic."""
    print("\n=== Async Error Handling with Retry ===")
    
    async def make_request_with_retry(
        session: aiohttp.ClientSession,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ) -> Optional[Dict[str, Any]]:
        """Make a request with exponential backoff retry."""
        
        for attempt in range(max_retries):
            try:
                url = f"{GATEWAY_BASE_URL}/chat/completions"
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}"
                }
                
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Hello!"}]
                }
                
                print(f"Attempt {attempt + 1}/{max_retries}")
                
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        print("✅ Success!")
                        return data
                    elif response.status in [429, 500, 502, 503, 504]:
                        # Retryable errors
                        print(f"❌ Retryable error: HTTP {response.status}")
                        if attempt < max_retries - 1:
                            delay = backoff_factor * (2 ** attempt)
                            print(f"Retrying in {delay} seconds...")
                            await asyncio.sleep(delay)
                        continue
                    else:
                        # Non-retryable errors
                        print(f"❌ Non-retryable error: HTTP {response.status}")
                        return None
                        
            except aiohttp.ClientError as e:
                print(f"❌ Network error: {e}")
                if attempt < max_retries - 1:
                    delay = backoff_factor * (2 ** attempt)
                    print(f"Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                continue
        
        print("❌ All retry attempts failed")
        return None
    
    async with aiohttp.ClientSession() as session:
        result = await make_request_with_retry(session)
        if result:
            print("Final result:", result["choices"][0]["message"]["content"])


# Example 8: Async OpenAI SDK usage
async def async_openai_sdk():
    """Demonstrate async usage with OpenAI SDK."""
    print("\n=== Async OpenAI SDK Usage ===")
    
    try:
        # Note: Install with: pip install openai
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(
            api_key=API_KEY,
            base_url=GATEWAY_BASE_URL
        )
        
        # Async chat completion
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": "What is async programming?"}
            ],
            max_tokens=150
        )
        
        print("Async SDK response:", completion.choices[0].message.content)
        
        # Async streaming
        print("\nAsync streaming with SDK:")
        print("---")
        
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": "List the benefits of async programming."}
            ],
            stream=True,
            max_tokens=200
        )
        
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                print(content, end="", flush=True)
        
        print("\n---")
        
    except ImportError:
        print("OpenAI SDK not installed. Install with: pip install openai")
    except Exception as e:
        print(f"Async SDK error: {e}")


# Example 9: Performance monitoring
async def performance_monitoring():
    """Monitor performance of async operations."""
    print("\n=== Performance Monitoring ===")
    
    class PerformanceMonitor:
        def __init__(self):
            self.requests = []
        
        async def timed_request(self, session: aiohttp.ClientSession, payload: Dict[str, Any]) -> Dict[str, Any]:
            """Make a timed request."""
            start_time = time.time()
            
            try:
                async with session.post(
                    f"{GATEWAY_BASE_URL}/chat/completions",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {API_KEY}"
                    }
                ) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    duration = time.time() - start_time
                    self.requests.append({
                        "duration": duration,
                        "status": "success",
                        "model": payload["model"],
                        "tokens": len(payload["messages"][0]["content"].split())
                    })
                    
                    return data
                    
            except Exception as e:
                duration = time.time() - start_time
                self.requests.append({
                    "duration": duration,
                    "status": "error",
                    "model": payload["model"],
                    "error": str(e)
                })
                raise
        
        def get_stats(self) -> Dict[str, Any]:
            """Get performance statistics."""
            if not self.requests:
                return {}
            
            successful = [r for r in self.requests if r["status"] == "success"]
            failed = [r for r in self.requests if r["status"] == "error"]
            
            if successful:
                durations = [r["duration"] for r in successful]
                return {
                    "total_requests": len(self.requests),
                    "successful": len(successful),
                    "failed": len(failed),
                    "avg_duration": sum(durations) / len(durations),
                    "min_duration": min(durations),
                    "max_duration": max(durations),
                    "success_rate": len(successful) / len(self.requests) * 100
                }
            else:
                return {
                    "total_requests": len(self.requests),
                    "successful": 0,
                    "failed": len(failed),
                    "success_rate": 0
                }
    
    monitor = PerformanceMonitor()
    
    # Test different payloads
    payloads = [
        {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hello!"}]
        },
        {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Explain quantum computing."}]
        },
        {
            "model": "gemini-2.0-flash-exp",
            "messages": [{"role": "user", "content": "What is artificial intelligence?"}]
        }
    ]
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i, payload in enumerate(payloads * 3):  # Test each payload 3 times
            tasks.append(monitor.timed_request(session, payload))
        
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except Exception:
            pass  # We're collecting errors in the monitor
    
    stats = monitor.get_stats()
    print("Performance Statistics:")
    for key, value in stats.items():
        if isinstance(value, float):
            print(f"- {key}: {value:.3f}")
        else:
            print(f"- {key}: {value}")


async def main():
    """Run all async examples."""
    print("LLM Gateway Python Async Usage Examples\n")
    print("These examples demonstrate asynchronous patterns for better performance.")
    print("Make sure the LLM Gateway is running on http://localhost:8080\n")
    
    # Run all examples
    await basic_async_chat()
    await concurrent_model_comparison()
    await async_streaming()
    await using_async_client()
    await batch_processing_with_semaphore()
    await async_error_handling()
    await async_openai_sdk()
    await performance_monitoring()
    
    print("\n=== All async examples completed ===")


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())


"""
Usage Instructions:

1. Install dependencies:
   pip install aiohttp openai

2. Set up environment variables:
   export OPENAI_API_KEY="your-openai-key"
   export GEMINI_API_KEY="your-gemini-key"
   export LLM_GATEWAY_API_KEY="your-gateway-key"

3. Start the LLM Gateway:
   npm run dev

4. Run this example:
   python examples/python/async_usage.py

Key Features Demonstrated:
- Async HTTP requests with aiohttp
- Concurrent API calls to multiple models
- Async streaming response handling
- Custom async client class with context manager
- Batch processing with semaphore for concurrency control
- Error handling and retry logic with exponential backoff
- Async OpenAI SDK usage
- Performance monitoring and statistics
- Rate limiting and request throttling

Benefits of Async Approach:
- Better performance for I/O-bound operations
- Concurrent processing of multiple requests
- Non-blocking streaming responses
- Efficient resource utilization
- Scalable batch processing

Expected Output:
- Concurrent model comparisons
- Real-time streaming responses
- Batch processing statistics
- Performance metrics
- Error handling demonstrations
"""