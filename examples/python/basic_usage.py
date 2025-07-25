"""
Basic Python Usage Examples for LLM Gateway

This file demonstrates basic usage patterns for interacting with the LLM Gateway API
using both the requests library and the OpenAI SDK compatibility mode.
"""

import requests
import json
import os
from typing import List, Dict, Any, Optional

# Configuration
GATEWAY_BASE_URL = "http://localhost:8080/v1"  # Use dev server (auth optional)
API_KEY = "your-api-key-here"  # Replace with your actual API key

# Alternative: Use environment variables (recommended)
# If you have configured the .env file with your API keys, you can use any value for API_KEY
# The gateway will automatically use OPENAI_API_KEY and GEMINI_API_KEY from the environment


# Example 0: Basic chat completion WITHOUT authentication (recommended for .env setup)
def basic_chat_no_auth():
    """Demonstrate basic chat completion without authentication headers."""
    print("=== Basic Chat Completion (No Auth Required) ===")

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {
        "Content-Type": "application/json"
        # No Authorization header - gateway will use .env provider keys automatically
    }

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": "Im using .env configuration.",
            }
        ],
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()  # Raises HTTPError for bad responses

        data = response.json()
        print("Response:", data["choices"][0]["message"]["content"])
        print("Model used:", data["model"])
        print("Usage:", data.get("usage", "N/A"))
        print("✅ #0 SUCCESS: No auth header needed!")

    except requests.exceptions.RequestException as e:
        print(f"❌ #0 Error: {e}")
    except KeyError as e:
        print(f"#0 Unexpected response format: missing {e}")


# Example 1: Basic chat completion using requests (with auth header)
def basic_chat_with_requests():
    """Demonstrate basic chat completion using the requests library."""
    print("\n=== Basic Chat Completion with Auth Header ===")

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Hello! What can you help me with?"}],
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()  # Raises HTTPError for bad responses

        data = response.json()
        print("Response:", data["choices"][0]["message"]["content"])
        print("Model used:", data["model"])
        print("Usage:", data.get("usage", "N/A"))

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
    except KeyError as e:
        print(f"Unexpected response format: missing {e}")


# Example 2: Chat with system prompt and parameters
def chat_with_system_prompt():
    """Demonstrate chat with system prompt and various parameters."""
    print("\n=== Chat with System Prompt ===")

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are a helpful coding assistant."},
            {
                "role": "user",
                "content": "Write a simple Python function to calculate factorial.",
            },
        ],
        "temperature": 0.7,
        "max_tokens": 300,
        "top_p": 0.9,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        print("Assistant response:")
        print(data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 3: Using OpenAI SDK compatibility mode
def using_openai_sdk():
    """Demonstrate using the OpenAI SDK with LLM Gateway."""
    print("\n=== Using OpenAI SDK (Compatible) ===")

    try:
        # Note: Install with: pip install openai
        from openai import OpenAI

        client = OpenAI(
            api_key=API_KEY, base_url=GATEWAY_BASE_URL  # Point to LLM Gateway
        )

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that explains concepts clearly.",
                },
                {"role": "user", "content": "Explain what an API is in simple terms."},
            ],
            temperature=0.5,
            max_tokens=200,
        )

        print("Response:", completion.choices[0].message.content)
        print("Finish reason:", completion.choices[0].finish_reason)

    except ImportError:
        print("OpenAI SDK not installed. Install with: pip install openai")
    except Exception as e:
        print(f"SDK Error: {e}")


# Example 4: Using Gemini models
def using_gemini_model():
    """Demonstrate using Gemini models through the gateway."""
    print("\n=== Using Gemini Model ===")

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "gemini-2.0-flash",
        "messages": [
            {"role": "user", "content": "What are the benefits of renewable energy?"}
        ],
        "temperature": 0.8,
        "max_tokens": 250,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        print("Gemini response:", data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 5: Getting available models
def get_available_models():
    """Retrieve and display available models."""
    print("\n=== Available Models ===")

    url = f"{GATEWAY_BASE_URL}/models"
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        data = response.json()
        print("Available models:")
        for model in data["data"]:
            print(f"- {model['id']} ({model['owned_by']})")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 6: Custom parameters and provider-specific settings
def custom_parameters():
    """Demonstrate using custom parameters."""
    print("\n=== Custom Parameters ===")

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": "Tell me a creative story about space exploration.",
            }
        ],
        "temperature": 1.0,
        "max_tokens": 300,
        "top_p": 0.9,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.5,
        # Custom parameters (forwarded to provider)
        "custom_setting": "creative_mode",
        "experimental_feature": True,
        "provider_config": {"optimization": "creativity", "style": "narrative"},
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        print("Creative response:", data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 7: Multimodal request with image
def multimodal_example():
    """Demonstrate multimodal request with image input."""
    print("\n=== Multimodal Example (Image) ===")

    # Example base64 image (1x1 red pixel for demo)
    base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

    url = f"{GATEWAY_BASE_URL}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "gpt-4o",  # Vision-capable model
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image?"},
                    {"type": "image_url", "image_url": {"url": base64_image}},
                ],
            }
        ],
        "max_tokens": 100,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        print("Vision response:", data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 8: Embeddings request
def embeddings_example():
    """Demonstrate embeddings generation."""
    print("\n=== Embeddings Example ===")

    url = f"{GATEWAY_BASE_URL}/embeddings"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}

    payload = {
        "model": "text-embedding-3-small",
        "input": [
            "The quick brown fox jumps over the lazy dog.",
            "Python is a versatile programming language.",
            "Machine learning is transforming many industries.",
        ],
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        data = response.json()
        print(f"Generated {len(data['data'])} embeddings")
        for i, embedding in enumerate(data["data"]):
            print(f"Text {i+1}: {len(embedding['embedding'])} dimensions")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


# Example 9: Helper class for easier API interaction
class LLMGatewayClient:
    """A simple client class for interacting with the LLM Gateway API."""

    def __init__(self, api_key: str, base_url: str = GATEWAY_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update(
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )

    def chat_completion(
        self, messages: List[Dict[str, Any]], model: str = "gpt-4o-mini", **kwargs
    ) -> Dict[str, Any]:
        """Create a chat completion."""
        payload = {"model": model, "messages": messages, **kwargs}

        response = self.session.post(f"{self.base_url}/chat/completions", json=payload)
        response.raise_for_status()
        return response.json()

    def get_models(self) -> Dict[str, Any]:
        """Get available models."""
        response = self.session.get(f"{self.base_url}/models")
        response.raise_for_status()
        return response.json()

    def generate_embeddings(
        self, input_texts: List[str], model: str = "text-embedding-3-small"
    ) -> Dict[str, Any]:
        """Generate embeddings for input texts."""
        payload = {"model": model, "input": input_texts}

        response = self.session.post(f"{self.base_url}/embeddings", json=payload)
        response.raise_for_status()
        return response.json()

    def health_check(self) -> Dict[str, Any]:
        """Check the gateway health."""
        response = self.session.get(f"{self.base_url}/../health")
        response.raise_for_status()
        return response.json()


# Example 10: Using the helper client class
def using_helper_client():
    """Demonstrate using the helper client class."""
    print("\n=== Using Helper Client Class ===")

    client = LLMGatewayClient(API_KEY)

    try:
        # Health check
        health = client.health_check()
        print("Gateway status:", health.get("status", "unknown"))

        # Chat completion
        response = client.chat_completion(
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "What is the capital of France?"},
            ],
            temperature=0.3,
        )
        print("Response:", response["choices"][0]["message"]["content"])

        # Get models
        models = client.get_models()
        print(f"Available models: {len(models['data'])}")

        # Generate embeddings
        embeddings = client.generate_embeddings(["Hello world", "Python programming"])
        print(f"Generated embeddings: {len(embeddings['data'])}")

    except requests.exceptions.RequestException as e:
        print(f"Client error: {e}")


# Example 11: Environment variable configuration
def load_config_from_env():
    """Load configuration from environment variables."""
    print("\n=== Loading Configuration from Environment ===")

    api_key = os.getenv("LLM_GATEWAY_API_KEY", API_KEY)
    base_url = os.getenv("LLM_GATEWAY_BASE_URL", GATEWAY_BASE_URL)

    print(
        f"API Key: {'*' * (len(api_key) - 4) + api_key[-4:] if api_key else 'Not set'}"
    )
    print(f"Base URL: {base_url}")

    # You can also load provider-specific keys
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    print(f"OpenAI Key: {'Set' if openai_key else 'Not set'}")
    print(f"Gemini Key: {'Set' if gemini_key else 'Not set'}")

    return {
        "api_key": api_key,
        "base_url": base_url,
        "openai_key": openai_key,
        "gemini_key": gemini_key,
    }


def main():
    """Run all basic usage examples."""
    print("LLM Gateway Python Basic Usage Examples\n")
    print("Setup Options:")
    print("OPTION A (Recommended): Use .env file configuration")
    print("  1. Copy .env.example to .env")
    print("  2. Set OPENAI_API_KEY and GEMINI_API_KEY in .env")
    print("  3. Start gateway: npm run dev")
    print("  4. Run examples without auth headers! ✨")
    print()
    print("OPTION B: Use manual API keys")
    print("  1. Replace 'your-api-key-here' with your actual API key")
    print("  2. Start gateway: npm run dev")
    print("  3. Examples will use Authorization headers")
    print()

    # Load configuration
    config = load_config_from_env()

    # Run all examples - starting with no-auth example
    basic_chat_no_auth()  # This should work with .env configuration
    basic_chat_with_requests()
    chat_with_system_prompt()
    using_openai_sdk()
    using_gemini_model()
    get_available_models()
    custom_parameters()
    multimodal_example()
    embeddings_example()
    using_helper_client()

    print("\n=== All basic usage examples completed ===")


if __name__ == "__main__":
    main()


"""
Usage Instructions:

1. Install dependencies:
   pip install requests openai

2. Set up environment variables (choose one):
   OPTION A: Set individual API keys in your shell:
             export OPENAI_API_KEY="your-openai-key"
             export GEMINI_API_KEY="your-gemini-key"
             export LLM_GATEWAY_API_KEY="your-gateway-key"
             export LLM_GATEWAY_BASE_URL="http://localhost:8080/v1"
   
   OPTION B: Use .env file (recommended):
             1. Copy .env.example to .env
             2. Edit .env and set OPENAI_API_KEY and GEMINI_API_KEY
             3. The gateway will automatically use these keys

3. Start the LLM Gateway:
   npm run dev

4. Run this example:
   python examples/python/basic_usage.py

Key Features Demonstrated:
- Basic HTTP requests with requests library
- OpenAI SDK compatibility
- Multiple model providers (OpenAI, Gemini)
- Custom parameters and provider-specific settings
- Multimodal requests (text + images)
- Embeddings generation
- Helper client class for easier interaction
- Environment variable configuration
- Error handling patterns

Expected Output:
- Chat completion responses
- Model information
- Usage statistics
- Embeddings vectors
- Health check results
"""
