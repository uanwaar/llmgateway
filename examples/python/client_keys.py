"""
Python Client Keys Examples for LLM Gateway

This file demonstrates different authentication modes and API key management patterns:
- Gateway-level API keys (centralized authentication)
- Client-side API keys (passthrough authentication)
- Hybrid mode (flexible authentication)
- Provider-specific key handling
- Dynamic key switching and management
"""

import requests
import os
from typing import Dict, Any, Optional, List
import json


# Configuration
GATEWAY_BASE_URL = "http://localhost:8080/v1"
GATEWAY_API_KEY = "your-gateway-api-key-here"  # Gateway-level authentication
CLIENT_OPENAI_KEY = "your-openai-api-key-here"  # Client-side OpenAI key
CLIENT_GEMINI_KEY = "your-gemini-api-key-here"  # Client-side Gemini key


# Example 1: Gateway-level authentication
def gateway_authentication():
    """Demonstrate gateway-level authentication where the gateway manages provider keys."""
    print("=== Gateway-Level Authentication ===")
    print("The gateway handles all provider authentication internally.")

    # No Authorization header - gateway will use .env provider keys automatically
    headers = {
        "Content-Type": "application/json",
    }

    # Request with OpenAI model
    payload_openai = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello from gateway auth with OpenAI!"}
        ],
    }

    try:
        response = requests.post(
            f"{GATEWAY_BASE_URL}/chat/completions", json=payload_openai, headers=headers
        )
        response.raise_for_status()

        data = response.json()
        print("✅ OpenAI Response:", data["choices"][0]["message"]["content"])
        print("   Model:", data["model"])

    except requests.exceptions.RequestException as e:
        print(f"❌ OpenAI Error: {e}")

    # Request with Gemini model (same authentication)
    payload_gemini = {
        "model": "gemini-2.0-flash",
        "messages": [
            {"role": "user", "content": "Hello from gateway auth with Gemini!"}
        ],
    }

    try:
        response = requests.post(
            f"{GATEWAY_BASE_URL}/chat/completions", json=payload_gemini, headers=headers
        )
        response.raise_for_status()

        data = response.json()
        print("✅ Gemini Response:", data["choices"][0]["message"]["content"])
        print("   Model:", data["model"])

    except requests.exceptions.RequestException as e:
        print(f"❌ Gemini Error: {e}")


# Example 2: Client-side API keys (passthrough mode)
def client_side_authentication():
    """Demonstrate client-side authentication where clients provide their own provider keys."""
    print("\n=== Client-Side Authentication ===")
    print("Clients provide their own provider API keys for direct authentication.")

    # OpenAI request with client's OpenAI key
    headers_openai = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CLIENT_OPENAI_KEY}",  # Client's OpenAI key
        "X-Provider": "openai",  # Optional: specify provider
    }

    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Hello with my own OpenAI key!"}],
    }

    try:
        response = requests.post(
            f"{GATEWAY_BASE_URL}/chat/completions", json=payload, headers=headers_openai
        )
        response.raise_for_status()

        data = response.json()
        print("✅ OpenAI (client key):", data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"❌ OpenAI (client key) Error: {e}")

    # Gemini request with client's Gemini key
    headers_gemini = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CLIENT_GEMINI_KEY}",  # Client's Gemini key
        "X-Provider": "gemini",  # Optional: specify provider
    }

    payload_gemini = {
        "model": "gemini-2.0-flash-exp",
        "messages": [{"role": "user", "content": "Hello with my own Gemini key!"}],
    }

    try:
        response = requests.post(
            f"{GATEWAY_BASE_URL}/chat/completions",
            json=payload_gemini,
            headers=headers_gemini,
        )
        response.raise_for_status()

        data = response.json()
        print("✅ Gemini (client key):", data["choices"][0]["message"]["content"])

    except requests.exceptions.RequestException as e:
        print(f"❌ Gemini (client key) Error: {e}")


# Example 3: Hybrid authentication mode
def hybrid_authentication():
    """Demonstrate hybrid authentication with fallback between gateway and client keys."""
    print("\n=== Hybrid Authentication ===")
    print("Try client key first, fallback to gateway key if needed.")

    class HybridAuthClient:
        def __init__(self, gateway_key: str, client_keys: Dict[str, str]):
            self.gateway_key = gateway_key
            self.client_keys = client_keys

        def make_request(
            self, payload: Dict[str, Any], provider: str = None
        ) -> Optional[Dict[str, Any]]:
            """Make request with hybrid authentication."""

            # First try: Client key (if available)
            if provider and provider in self.client_keys:
                print(f"   Trying client key for {provider}...")
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.client_keys[provider]}",
                    "X-Provider": provider,
                }

                try:
                    response = requests.post(
                        f"{GATEWAY_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                    if response.status_code == 200:
                        print(f"   ✅ Success with client key")
                        return response.json()
                    else:
                        print(f"   ❌ Client key failed: HTTP {response.status_code}")

                except requests.exceptions.RequestException as e:
                    print(f"   ❌ Client key failed: {e}")

            # Second try: Gateway key (fallback)
            print("   Trying gateway key...")
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.gateway_key}",
            }

            try:
                response = requests.post(
                    f"{GATEWAY_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()

                print("   ✅ Success with gateway key")
                return response.json()

            except requests.exceptions.RequestException as e:
                print(f"   ❌ Gateway key failed: {e}")
                return None

    # Create hybrid client
    client = HybridAuthClient(
        gateway_key=GATEWAY_API_KEY,
        client_keys={"openai": CLIENT_OPENAI_KEY, "gemini": CLIENT_GEMINI_KEY},
    )

    # Test with different models
    test_cases = [
        {
            "payload": {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "user", "content": "Test hybrid auth with OpenAI"}
                ],
            },
            "provider": "openai",
        },
        {
            "payload": {
                "model": "gemini-2.0-flash-exp",
                "messages": [
                    {"role": "user", "content": "Test hybrid auth with Gemini"}
                ],
            },
            "provider": "gemini",
        },
    ]

    for test_case in test_cases:
        print(f"\nTesting {test_case['provider']} model:")
        result = client.make_request(test_case["payload"], test_case["provider"])

        if result:
            print(f"   Response: {result['choices'][0]['message']['content']}")


# Example 4: Dynamic key management
class DynamicKeyManager:
    """Manage multiple API keys dynamically."""

    def __init__(self):
        self.keys = {}
        self.active_keys = {}

    def add_key(self, provider: str, key_name: str, api_key: str):
        """Add an API key for a provider."""
        if provider not in self.keys:
            self.keys[provider] = {}
        self.keys[provider][key_name] = api_key
        print(f"Added key '{key_name}' for {provider}")

    def set_active_key(self, provider: str, key_name: str):
        """Set the active key for a provider."""
        if provider in self.keys and key_name in self.keys[provider]:
            self.active_keys[provider] = key_name
            print(f"Set active key for {provider}: {key_name}")
        else:
            print(f"Key '{key_name}' not found for {provider}")

    def get_active_key(self, provider: str) -> Optional[str]:
        """Get the active API key for a provider."""
        if provider in self.active_keys:
            key_name = self.active_keys[provider]
            return self.keys[provider][key_name]
        return None

    def list_keys(self) -> Dict[str, List[str]]:
        """List all available keys by provider."""
        return {provider: list(keys.keys()) for provider, keys in self.keys.items()}

    def rotate_key(self, provider: str):
        """Rotate to the next available key for a provider."""
        if provider not in self.keys or len(self.keys[provider]) <= 1:
            print(f"Cannot rotate keys for {provider} - insufficient keys")
            return

        current_key = self.active_keys.get(provider)
        key_names = list(self.keys[provider].keys())

        if current_key in key_names:
            current_index = key_names.index(current_key)
            next_index = (current_index + 1) % len(key_names)
            next_key = key_names[next_index]
        else:
            next_key = key_names[0]

        self.set_active_key(provider, next_key)
        print(f"Rotated {provider} key to: {next_key}")


def dynamic_key_management():
    """Demonstrate dynamic key management."""
    print("\n=== Dynamic Key Management ===")

    # Create key manager
    key_manager = DynamicKeyManager()

    # Add multiple keys for each provider
    key_manager.add_key("openai", "primary", CLIENT_OPENAI_KEY)
    key_manager.add_key("openai", "backup", "backup-openai-key")
    key_manager.add_key("gemini", "primary", CLIENT_GEMINI_KEY)
    key_manager.add_key("gemini", "secondary", "secondary-gemini-key")

    # Set active keys
    key_manager.set_active_key("openai", "primary")
    key_manager.set_active_key("gemini", "primary")

    # List all keys
    print("\nAvailable keys:")
    for provider, keys in key_manager.list_keys().items():
        print(f"  {provider}: {keys}")

    # Test with active keys
    def test_with_active_key(provider: str, model: str):
        """Test request with currently active key."""
        active_key = key_manager.get_active_key(provider)
        if not active_key:
            print(f"No active key for {provider}")
            return

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {active_key}",
            "X-Provider": provider,
        }

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": f"Test with {provider} using active key"}
            ],
        }

        try:
            response = requests.post(
                f"{GATEWAY_BASE_URL}/chat/completions", json=payload, headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                print(
                    f"✅ {provider} success: {data['choices'][0]['message']['content'][:50]}..."
                )
            else:
                print(f"❌ {provider} failed: HTTP {response.status_code}")
                # Rotate key on failure
                print(f"Rotating {provider} key...")
                key_manager.rotate_key(provider)

        except requests.exceptions.RequestException as e:
            print(f"❌ {provider} error: {e}")

    # Test requests
    test_with_active_key("openai", "gpt-4o-mini")
    test_with_active_key("gemini", "gemini-2.0-flash-exp")

    # Demonstrate key rotation
    print("\nDemonstrating key rotation:")
    key_manager.rotate_key("openai")
    key_manager.rotate_key("gemini")


# Example 5: Environment-based key configuration
def environment_key_configuration():
    """Demonstrate loading keys from environment variables."""
    print("\n=== Environment-Based Key Configuration ===")

    # Define environment variable mappings
    env_mappings = {
        "gateway": "LLM_GATEWAY_API_KEY",
        "openai_primary": "OPENAI_API_KEY",
        "openai_secondary": "OPENAI_API_KEY_SECONDARY",
        "gemini_primary": "GEMINI_API_KEY",
        "gemini_secondary": "GEMINI_API_KEY_SECONDARY",
        "anthropic": "ANTHROPIC_API_KEY",
        "cohere": "COHERE_API_KEY",
    }

    # Load keys from environment
    loaded_keys = {}
    for key_name, env_var in env_mappings.items():
        value = os.getenv(env_var)
        if value:
            loaded_keys[key_name] = value
            # Mask the key for display
            masked = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
            print(f"✅ Loaded {key_name}: {masked}")
        else:
            print(f"❌ Missing {key_name} (${env_var})")

    # Configuration summary
    print(f"\nLoaded {len(loaded_keys)} keys from environment")

    # Example usage with loaded keys
    if "gateway" in loaded_keys:
        print("\nTesting with gateway key from environment:")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {loaded_keys['gateway']}",
        }

        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello from environment-configured gateway!",
                }
            ],
        }

        try:
            response = requests.post(
                f"{GATEWAY_BASE_URL}/chat/completions", json=payload, headers=headers
            )
            response.raise_for_status()

            data = response.json()
            print("✅ Success:", data["choices"][0]["message"]["content"])

        except requests.exceptions.RequestException as e:
            print(f"❌ Error: {e}")


# Example 6: Key validation and health checking
def key_validation():
    """Validate API keys by testing them against the gateway."""
    print("\n=== Key Validation and Health Checking ===")

    keys_to_test = {
        "gateway": GATEWAY_API_KEY,
        "openai_client": CLIENT_OPENAI_KEY,
        "gemini_client": CLIENT_GEMINI_KEY,
    }

    def validate_key(
        key_name: str, api_key: str, provider: str = None
    ) -> Dict[str, Any]:
        """Validate an API key by making a test request."""
        print(f"Validating {key_name}...")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        if provider:
            headers["X-Provider"] = provider

        # Simple test payload
        payload = {
            "model": (
                "gpt-4o-mini"
                if not provider or provider == "openai"
                else "gemini-2.0-flash-exp"
            ),
            "messages": [{"role": "user", "content": "test"}],
            "max_tokens": 5,
        }

        try:
            response = requests.post(
                f"{GATEWAY_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "valid": True,
                    "status": "success",
                    "model": data.get("model", "unknown"),
                    "usage": data.get("usage", {}),
                }
            elif response.status_code == 401:
                return {
                    "valid": False,
                    "status": "unauthorized",
                    "error": "Invalid API key",
                }
            elif response.status_code == 429:
                return {
                    "valid": True,  # Key is valid but rate limited
                    "status": "rate_limited",
                    "error": "Rate limit exceeded",
                }
            else:
                return {
                    "valid": False,
                    "status": "error",
                    "error": f"HTTP {response.status_code}",
                }

        except requests.exceptions.Timeout:
            return {"valid": False, "status": "timeout", "error": "Request timeout"}
        except requests.exceptions.RequestException as e:
            return {"valid": False, "status": "network_error", "error": str(e)}

    # Validate all keys
    results = {}
    results["gateway"] = validate_key("gateway", keys_to_test["gateway"])
    results["openai_client"] = validate_key(
        "openai_client", keys_to_test["openai_client"], "openai"
    )
    results["gemini_client"] = validate_key(
        "gemini_client", keys_to_test["gemini_client"], "gemini"
    )

    # Display results
    print("\nValidation Results:")
    for key_name, result in results.items():
        status_emoji = "✅" if result["valid"] else "❌"
        print(f"{status_emoji} {key_name}: {result['status']}")

        if result.get("error"):
            print(f"   Error: {result['error']}")
        if result.get("model"):
            print(f"   Model: {result['model']}")
        if result.get("usage"):
            usage = result["usage"]
            print(f"   Usage: {usage.get('total_tokens', 0)} tokens")

    # Summary
    valid_keys = sum(1 for r in results.values() if r["valid"])
    print(f"\nSummary: {valid_keys}/{len(results)} keys are valid")


def main():
    """Run all client key examples."""
    print("LLM Gateway Python Client Keys Examples\n")
    print(
        "These examples demonstrate different authentication modes and key management."
    )
    print(
        "Make sure to configure your API keys in the script or environment variables.\n"
    )

    # Display configuration
    print("Current Configuration:")
    print(f"- Gateway URL: {GATEWAY_BASE_URL}")
    print(
        f"- Gateway Key: {'Set' if GATEWAY_API_KEY != 'your-gateway-api-key-here' else 'Not configured'}"
    )
    print(
        f"- OpenAI Client Key: {'Set' if CLIENT_OPENAI_KEY != 'your-openai-api-key-here' else 'Not configured'}"
    )
    print(
        f"- Gemini Client Key: {'Set' if CLIENT_GEMINI_KEY != 'your-gemini-api-key-here' else 'Not configured'}"
    )
    print()

    # Run examples
    gateway_authentication()
    client_side_authentication()
    hybrid_authentication()
    dynamic_key_management()
    environment_key_configuration()
    key_validation()

    print("\n=== All client key examples completed ===")


if __name__ == "__main__":
    main()


"""
Usage Instructions:

1. Configure API keys:
   - Replace placeholder keys in the script, OR
   - Set environment variables:
     export LLM_GATEWAY_API_KEY="your-gateway-key"
     export OPENAI_API_KEY="your-openai-key"
     export GEMINI_API_KEY="your-gemini-key"

2. Configure the LLM Gateway authentication mode:
   - Gateway mode: Gateway handles all provider keys
   - Client mode: Clients provide their own provider keys
   - Hybrid mode: Try client keys first, fallback to gateway keys

3. Start the LLM Gateway:
   npm run dev

4. Run this example:
   python examples/python/client_keys.py

Key Authentication Features Demonstrated:
- Gateway-level authentication (centralized)
- Client-side authentication (passthrough)
- Hybrid authentication with fallback
- Dynamic key management and rotation
- Environment-based key configuration
- Key validation and health checking
- Multi-provider key handling
- Error handling for authentication failures

Authentication Modes Supported:
1. Gateway Mode:
   - Clients authenticate with gateway API key
   - Gateway manages all provider keys internally
   - Simplest for clients, centralized key management

2. Client Mode:
   - Clients provide their own provider API keys
   - Gateway passes keys directly to providers
   - Maximum flexibility, client controls costs

3. Hybrid Mode:
   - Try client keys first, fallback to gateway keys
   - Best of both worlds - flexibility with fallback
   - Supports different keys for different providers

Expected Output:
- Authentication test results
- Key validation status
- Dynamic key management demonstrations
- Environment configuration summary
- Error handling for invalid keys
"""
