#!/bin/bash

# cURL Chat Completion Examples for LLM Gateway
#
# This script demonstrates chat completion requests using cURL commands.
# These examples work on Linux, macOS, and Windows (with Git Bash or WSL).

# Configuration
GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"  # Replace with your actual API key

# Alternative: Use environment variables (recommended)
# If you have configured the .env file with your API keys, you can run this script
# without manually entering API keys. The gateway will use the provider keys
# (OPENAI_API_KEY, GEMINI_API_KEY) from the .env file automatically.
# In this case, you can use any value for API_KEY since the gateway handles authentication.

# Colors for output (if terminal supports them)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if jq is available for JSON formatting
check_jq() {
    if command -v jq &> /dev/null; then
        echo "true"
    else
        echo "false"
    fi
}

HAS_JQ=$(check_jq)

# Helper function to format JSON output
format_json() {
    if [ "$HAS_JQ" = "true" ]; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

print_header "LLM Gateway cURL Chat Completion Examples"
echo "Make sure to:"
echo "1. Start the LLM Gateway server (npm run dev)"
echo "2. OPTION A: Replace 'your-api-key-here' with your actual API key"
echo "   OPTION B: Configure provider API keys in .env file (OPENAI_API_KEY, GEMINI_API_KEY)"
echo "3. If using .env file, copy .env.example to .env and set your provider keys"
echo ""

# Example 1: Basic chat completion
print_header "Example 1: Basic Chat Completion"

# leave authorization header empty if using .env file
RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello! What can you help me with?"}
        ]
    }')

if [ $? -eq 0 ]; then
    print_success "Basic chat completion successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Basic chat completion failed"
fi

echo ""

# Example 2: Chat with system prompt and parameters
print_header "Example 2: Chat with System Prompt and Parameters"

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are a helpful coding assistant."},
            {"role": "user", "content": "Write a simple Python function to calculate factorial."}
        ],
        "temperature": 0.7,
        "max_tokens": 300,
        "top_p": 0.9
    }')

if [ $? -eq 0 ]; then
    print_success "System prompt chat successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "System prompt chat failed"
fi

echo ""

# Example 3: Using Gemini model
print_header "Example 3: Using Gemini Model"

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gemini-2.0-flash-exp",
        "messages": [
            {"role": "user", "content": "What are the benefits of renewable energy?"}
        ],
        "temperature": 0.8,
        "max_tokens": 250
    }')

if [ $? -eq 0 ]; then
    print_success "Gemini model request successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Gemini model request failed"
fi

echo ""

# Example 4: Multimodal request with image
print_header "Example 4: Multimodal Request (Image)"

# Base64 encoded 1x1 red pixel for demo
BASE64_IMAGE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image?"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "'"$BASE64_IMAGE"'"}
                    }
                ]
            }
        ],
        "max_tokens": 100
    }')

if [ $? -eq 0 ]; then
    print_success "Multimodal request successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Multimodal request failed"
fi

echo ""

# Example 5: Custom parameters and provider-specific settings
print_header "Example 5: Custom Parameters"

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Tell me a creative story about space exploration."}
        ],
        "temperature": 1.0,
        "max_tokens": 300,
        "top_p": 0.9,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.5,
        "custom_setting": "creative_mode",
        "experimental_feature": true,
        "provider_config": {
            "optimization": "creativity",
            "style": "narrative"
        }
    }')

if [ $? -eq 0 ]; then
    print_success "Custom parameters request successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Custom parameters request failed"
fi

echo ""

# Example 6: Conversation with multiple messages
print_header "Example 6: Multi-turn Conversation"

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a knowledgeable science teacher."},
            {"role": "user", "content": "What is photosynthesis?"},
            {"role": "assistant", "content": "Photosynthesis is the process by which plants convert sunlight, carbon dioxide, and water into glucose and oxygen."},
            {"role": "user", "content": "Can you explain it in simpler terms for a 10-year-old?"}
        ],
        "temperature": 0.7,
        "max_tokens": 200
    }')

if [ $? -eq 0 ]; then
    print_success "Multi-turn conversation successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Multi-turn conversation failed"
fi

echo ""

# Example 7: Using different OpenAI models
print_header "Example 7: Different OpenAI Models"

MODELS=("gpt-4o-mini" "gpt-4o" "gpt-3.5-turbo")

for MODEL in "${MODELS[@]}"; do
    print_info "Testing model: $MODEL"
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        -d '{
            "model": "'"$MODEL"'",
            "messages": [
                {"role": "user", "content": "What is artificial intelligence?"}
            ],
            "max_tokens": 100
        }')
    
    if [ $? -eq 0 ]; then
        print_success "$MODEL request successful"
        if [ "$HAS_JQ" = "true" ]; then
            CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "No content"')
            echo "Response: $CONTENT"
        else
            echo "Response: $RESPONSE"
        fi
    else
        print_error "$MODEL request failed"
    fi
    echo ""
done

# Example 8: Error handling demonstration
print_header "Example 8: Error Handling"

print_info "Testing with missing required field (model)..."
RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }')

if [ $? -eq 0 ]; then
    print_info "Validation error response (expected):"
    format_json "$RESPONSE"
else
    print_error "Request failed unexpectedly"
fi

echo ""

print_info "Testing with invalid API key..."
RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid-key" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }')

if [ $? -eq 0 ]; then
    print_info "Authentication error response (expected):"
    format_json "$RESPONSE"
else
    print_error "Request failed unexpectedly"
fi

echo ""

# Example 9: Using environment variables
print_header "Example 9: Using Environment Variables"

if [ -n "$LLM_GATEWAY_API_KEY" ]; then
    print_info "Using API key from environment variable LLM_GATEWAY_API_KEY"
    ENV_API_KEY="$LLM_GATEWAY_API_KEY"
else
    print_info "LLM_GATEWAY_API_KEY not set, using default"
    ENV_API_KEY="$API_KEY"
fi

if [ -n "$LLM_GATEWAY_URL" ]; then
    print_info "Using gateway URL from environment variable LLM_GATEWAY_URL"
    ENV_GATEWAY_URL="$LLM_GATEWAY_URL"
else
    print_info "LLM_GATEWAY_URL not set, using default"
    ENV_GATEWAY_URL="$GATEWAY_URL"
fi

RESPONSE=$(curl -s -X POST "${ENV_GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ENV_API_KEY}" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello from environment configuration!"}
        ]
    }')

if [ $? -eq 0 ]; then
    print_success "Environment variable configuration successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Environment variable configuration failed"
fi

echo ""

# Example 10: Windows-specific JSON escaping
print_header "Example 10: Windows Command Line Workaround"

print_info "For Windows users having JSON escaping issues, use this approach:"
echo ""
echo "# Method 1: Use echo with pipe"
echo 'echo '"'"'{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'"'"' | curl -X POST http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" --data @-'
echo ""
echo "# Method 2: Save JSON to file first"
echo 'echo {"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]} > request.json'
echo 'curl -X POST http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" --data @request.json'
echo ""

# Test the Windows-friendly approach
print_info "Testing Windows-friendly approach..."

# Create a temporary JSON file
TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "Hello from Windows-friendly approach!"}
    ]
}
EOF

RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON")

if [ $? -eq 0 ]; then
    print_success "Windows-friendly approach successful"
    echo "Response:"
    format_json "$RESPONSE"
else
    print_error "Windows-friendly approach failed"
fi

# Clean up temporary file
rm -f "$TEMP_JSON"

echo ""

# Example 11: Health check and models endpoint
print_header "Example 11: Health Check and Models"

print_info "Checking gateway health..."
HEALTH_RESPONSE=$(curl -s -X GET "${GATEWAY_URL}/../health" \
    -H "Authorization: Bearer ${API_KEY}")

if [ $? -eq 0 ]; then
    print_success "Health check successful"
    echo "Health status:"
    format_json "$HEALTH_RESPONSE"
else
    print_error "Health check failed"
fi

echo ""

print_info "Getting available models..."
MODELS_RESPONSE=$(curl -s -X GET "${GATEWAY_URL}/models" \
    -H "Authorization: Bearer ${API_KEY}")

if [ $? -eq 0 ]; then
    print_success "Models list successful"
    echo "Available models:"
    format_json "$MODELS_RESPONSE"
else
    print_error "Models list failed"
fi

echo ""

print_header "All cURL Chat Completion Examples Completed"

print_info "Summary of examples:"
echo "1. ✓ Basic chat completion"
echo "2. ✓ System prompt with parameters"
echo "3. ✓ Gemini model usage"
echo "4. ✓ Multimodal requests (images)"
echo "5. ✓ Custom parameters"
echo "6. ✓ Multi-turn conversations"
echo "7. ✓ Different model testing"
echo "8. ✓ Error handling"
echo "9. ✓ Environment variables"
echo "10. ✓ Windows compatibility"
echo "11. ✓ Health check and models"

echo ""
print_info "Tips for using cURL with LLM Gateway:"
echo "• Use --data @filename to read JSON from files"
echo "• Set environment variables for API keys"
echo "• Install jq for better JSON formatting"
echo "• Use -s flag for silent output"
echo "• Use -v flag for verbose debugging"

if [ "$HAS_JQ" = "false" ]; then
    echo ""
    print_info "Install jq for better JSON formatting:"
    echo "• Linux: sudo apt-get install jq"
    echo "• macOS: brew install jq"
    echo "• Windows: Download from https://github.com/jqlang/jq/releases"
fi

echo ""
print_success "cURL examples completed successfully!"