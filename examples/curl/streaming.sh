#!/bin/bash

# cURL Streaming Examples for LLM Gateway
#
# This script demonstrates streaming chat completion requests using cURL.
# Streaming allows receiving partial responses as they are generated.

# Configuration
GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"  # Replace with your actual API key

# Colors for output (if terminal supports them)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_stream() {
    echo -e "${CYAN}$1${NC}"
}

# Check if jq is available for JSON parsing
check_jq() {
    if command -v jq &> /dev/null; then
        echo "true"
    else
        echo "false"
    fi
}

HAS_JQ=$(check_jq)

print_header "LLM Gateway cURL Streaming Examples"
echo "These examples demonstrate real-time streaming responses."
echo "Make sure the LLM Gateway is running on http://localhost:8080"
echo ""

# Example 1: Basic streaming
print_header "Example 1: Basic Streaming"

print_info "Starting streaming request..."
echo "Streaming response:"
echo "---"

# Create temporary file for JSON payload
TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "Write a short story about a robot learning to paint."}
    ],
    "stream": true,
    "max_tokens": 500
}
EOF

# Make streaming request and process Server-Sent Events
curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    # Check if line starts with "data: "
    if [[ "$line" == data:* ]]; then
        # Extract the JSON data
        json_data="${line#data: }"
        
        # Check for stream end
        if [[ "$json_data" == "[DONE]" ]]; then
            echo ""
            echo "---"
            print_success "Stream completed!"
            break
        fi
        
        # Parse and display content if jq is available
        if [ "$HAS_JQ" = "true" ]; then
            content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
            if [ -n "$content" ] && [ "$content" != "null" ]; then
                print_stream "$content"
            fi
        else
            # Fallback: display raw JSON for debugging
            echo "Raw chunk: $json_data"
        fi
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 2: Streaming with different models
print_header "Example 2: Model Comparison Streaming"

MODELS=("gpt-4o-mini" "gemini-2.0-flash-exp")
PROMPT="Explain quantum computing in simple terms."

for MODEL in "${MODELS[@]}"; do
    print_info "Streaming with model: $MODEL"
    echo "---"
    
    # Create JSON for this model
    TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << EOF
{
    "model": "$MODEL",
    "messages": [
        {"role": "user", "content": "$PROMPT"}
    ],
    "stream": true,
    "max_tokens": 300,
    "temperature": 0.7
}
EOF
    
    # Start timing
    START_TIME=$(date +%s.%N)
    
    # Stream the response
    curl -s -X POST "${GATEWAY_URL}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON" \
        -N | while IFS= read -r line; do
        
        if [[ "$line" == data:* ]]; then
            json_data="${line#data: }"
            
            if [[ "$json_data" == "[DONE]" ]]; then
                END_TIME=$(date +%s.%N)
                DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
                echo ""
                echo "---"
                print_success "$MODEL completed in ${DURATION}s"
                break
            fi
            
            if [ "$HAS_JQ" = "true" ]; then
                content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
                if [ -n "$content" ] && [ "$content" != "null" ]; then
                    print_stream "$content"
                fi
            fi
        fi
    done
    
    rm -f "$TEMP_JSON"
    echo ""
done

# Example 3: Advanced streaming with progress tracking
print_header "Example 3: Advanced Streaming with Metadata"

print_info "Streaming with detailed progress tracking..."

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o",
    "messages": [
        {
            "role": "system",
            "content": "You are a creative writing assistant. Write detailed, engaging content."
        },
        {
            "role": "user",
            "content": "Write a detailed description of a futuristic city with flying cars, vertical farms, and sustainable energy."
        }
    ],
    "stream": true,
    "max_tokens": 800,
    "temperature": 0.8
}
EOF

echo "Advanced streaming with metrics:"
echo "=" | tr '\n' '=' | head -c 50; echo ""

CHUNK_COUNT=0
TOTAL_TOKENS=0
START_TIME=$(date +%s.%N)

curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    if [[ "$line" == data:* ]]; then
        json_data="${line#data: }"
        
        if [[ "$json_data" == "[DONE]" ]]; then
            END_TIME=$(date +%s.%N)
            DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
            echo ""
            echo "=" | tr '\n' '=' | head -c 50; echo ""
            print_success "Advanced streaming completed!"
            echo "Statistics:"
            echo "- Duration: ${DURATION}s"
            echo "- Chunks processed: $CHUNK_COUNT"
            break
        fi
        
        if [ "$HAS_JQ" = "true" ]; then
            content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
            if [ -n "$content" ] && [ "$content" != "null" ]; then
                print_stream "$content"
                CHUNK_COUNT=$((CHUNK_COUNT + 1))
                
                # Show progress every 10 chunks
                if [ $((CHUNK_COUNT % 10)) -eq 0 ]; then
                    CURRENT_TIME=$(date +%s.%N)
                    ELAPSED=$(echo "$CURRENT_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
                    echo ""
                    print_info "[$CHUNK_COUNT chunks, ${ELAPSED}s elapsed]"
                fi
            fi
        fi
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 4: Streaming with custom parameters
print_header "Example 4: Custom Parameters Streaming"

print_info "Streaming with creative parameters..."

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "Tell me a creative story about time travel."}
    ],
    "stream": true,
    "temperature": 1.0,
    "max_tokens": 400,
    "top_p": 0.9,
    "frequency_penalty": 0.5,
    "presence_penalty": 0.5,
    "custom_setting": "creative_mode",
    "experimental_feature": true
}
EOF

echo "Creative streaming response:"
echo "---"

curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    if [[ "$line" == data:* ]]; then
        json_data="${line#data: }"
        
        if [[ "$json_data" == "[DONE]" ]]; then
            echo ""
            echo "---"
            print_success "Creative streaming completed!"
            break
        fi
        
        if [ "$HAS_JQ" = "true" ]; then
            content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
            if [ -n "$content" ] && [ "$content" != "null" ]; then
                print_stream "$content"
            fi
        fi
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 5: Multi-turn conversation streaming
print_header "Example 5: Multi-turn Conversation Streaming"

print_info "Streaming a multi-turn conversation..."

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "system", "content": "You are a knowledgeable science teacher."},
        {"role": "user", "content": "What is machine learning?"},
        {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed."},
        {"role": "user", "content": "Can you give me a real-world example that a beginner would understand?"}
    ],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 250
}
EOF

echo "Multi-turn conversation response:"
echo "---"

curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    if [[ "$line" == data:* ]]; then
        json_data="${line#data: }"
        
        if [[ "$json_data" == "[DONE]" ]]; then
            echo ""
            echo "---"
            print_success "Multi-turn streaming completed!"
            break
        fi
        
        if [ "$HAS_JQ" = "true" ]; then
            content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
            if [ -n "$content" ] && [ "$content" != "null" ]; then
                print_stream "$content"
            fi
        fi
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 6: Error handling in streaming
print_header "Example 6: Streaming Error Handling"

print_info "Testing streaming with invalid parameters..."

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "messages": [
        {"role": "user", "content": "Hello"}
    ],
    "stream": true
}
EOF

echo "Expected validation error:"
echo "---"

curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    # Display raw response for error cases
    if [[ "$line" =~ ^data: ]]; then
        json_data="${line#data: }"
        
        if [[ "$json_data" == "[DONE]" ]]; then
            echo ""
            echo "---"
            break
        fi
        
        # Check if it's an error response
        if [ "$HAS_JQ" = "true" ]; then
            error_msg=$(echo "$json_data" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$error_msg" ] && [ "$error_msg" != "null" ]; then
                print_error "Error: $error_msg"
            else
                content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
                if [ -n "$content" ] && [ "$content" != "null" ]; then
                    print_stream "$content"
                fi
            fi
        else
            echo "Response: $json_data"
        fi
    else
        # Display HTTP error responses
        echo "$line"
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 7: Windows-compatible streaming
print_header "Example 7: Windows-Compatible Streaming"

print_info "Windows PowerShell compatible streaming example:"
echo ""
echo "# PowerShell version:"
echo '@"'
echo '{'
echo '    "model": "gpt-4o-mini",'
echo '    "messages": ['
echo '        {"role": "user", "content": "Hello world!"}'
echo '    ],'
echo '    "stream": true'
echo '}'
echo '"@ | curl -X POST http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" --data @-'
echo ""

echo "# Command Prompt version:"
echo 'echo {"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}],"stream":true} | curl -X POST http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" --data @-'
echo ""

# Example 8: Performance comparison
print_header "Example 8: Streaming vs Non-Streaming Performance"

PROMPT="Write a paragraph about artificial intelligence."

print_info "Non-streaming request..."
START_TIME=$(date +%s.%N)

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << EOF
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "$PROMPT"}
    ],
    "stream": false,
    "max_tokens": 150
}
EOF

NON_STREAM_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON")

END_TIME=$(date +%s.%N)
NON_STREAM_DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")

print_success "Non-streaming completed in ${NON_STREAM_DURATION}s"
if [ "$HAS_JQ" = "true" ]; then
    content=$(echo "$NON_STREAM_RESPONSE" | jq -r '.choices[0].message.content // "No content"')
    echo "Response: $content"
fi

echo ""

print_info "Streaming request..."
START_TIME=$(date +%s.%N)

cat > "$TEMP_JSON" << EOF
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "$PROMPT"}
    ],
    "stream": true,
    "max_tokens": 150
}
EOF

echo "Streaming response:"
echo "---"

curl -s -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | while IFS= read -r line; do
    
    if [[ "$line" == data:* ]]; then
        json_data="${line#data: }"
        
        if [[ "$json_data" == "[DONE]" ]]; then
            END_TIME=$(date +%s.%N)
            STREAM_DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
            echo ""
            echo "---"
            print_success "Streaming completed in ${STREAM_DURATION}s"
            break
        fi
        
        if [ "$HAS_JQ" = "true" ]; then
            content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
            if [ -n "$content" ] && [ "$content" != "null" ]; then
                print_stream "$content"
            fi
        fi
    fi
done

rm -f "$TEMP_JSON"
echo ""

# Example 9: Streaming with rate limiting headers
print_header "Example 9: Monitoring Rate Limits During Streaming"

print_info "Checking rate limit headers during streaming..."

TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" << 'EOF'
{
    "model": "gpt-4o-mini",
    "messages": [
        {"role": "user", "content": "Count from 1 to 10."}
    ],
    "stream": true,
    "max_tokens": 100
}
EOF

# Include headers in output
curl -s -i -X POST "${GATEWAY_URL}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data @"$TEMP_JSON" \
    -N | {
    
    # Read headers first
    while IFS= read -r line; do
        # Check for end of headers (empty line)
        if [[ "$line" =~ ^[[:space:]]*$ ]]; then
            break
        fi
        
        # Display rate limit headers
        if [[ "$line" =~ ^[Xx]-[Rr]ate[Ll]imit ]]; then
            print_info "Rate Limit Header: $line"
        fi
        
        # Display other relevant headers
        if [[ "$line" =~ ^[Xx]-[Cc]orrelation ]]; then
            print_info "Correlation Header: $line"
        fi
    done
    
    echo ""
    echo "Streaming content:"
    echo "---"
    
    # Now read the streaming content
    while IFS= read -r line; do
        if [[ "$line" == data:* ]]; then
            json_data="${line#data: }"
            
            if [[ "$json_data" == "[DONE]" ]]; then
                echo ""
                echo "---"
                print_success "Rate limit monitoring completed!"
                break
            fi
            
            if [ "$HAS_JQ" = "true" ]; then
                content=$(echo "$json_data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
                if [ -n "$content" ] && [ "$content" != "null" ]; then
                    print_stream "$content"
                fi
            fi
        fi
    done
}

rm -f "$TEMP_JSON"
echo ""

print_header "All cURL Streaming Examples Completed"

print_info "Summary of streaming examples:"
echo "1. ✓ Basic streaming"
echo "2. ✓ Model comparison streaming"
echo "3. ✓ Advanced streaming with progress tracking"
echo "4. ✓ Custom parameters streaming"
echo "5. ✓ Multi-turn conversation streaming"
echo "6. ✓ Error handling in streaming"
echo "7. ✓ Windows-compatible examples"
echo "8. ✓ Performance comparison (streaming vs non-streaming)"
echo "9. ✓ Rate limit monitoring during streaming"

echo ""
print_info "Key streaming concepts demonstrated:"
echo "• Server-Sent Events (SSE) processing"
echo "• Real-time response parsing"
echo "• Progress tracking and metrics"
echo "• Error handling during streams"
echo "• Cross-platform compatibility"
echo "• Performance monitoring"

echo ""
print_info "Tips for streaming with cURL:"
echo "• Use -N flag to disable output buffering"
echo "• Process data: lines for Server-Sent Events"
echo "• Handle [DONE] marker for stream completion"
echo "• Use temporary files for complex JSON"
echo "• Install jq for better JSON parsing"

if [ "$HAS_JQ" = "false" ]; then
    echo ""
    print_info "Install jq for better streaming experience:"
    echo "• Linux: sudo apt-get install jq"
    echo "• macOS: brew install jq"
    echo "• Windows: Download from https://github.com/jqlang/jq/releases"
fi

echo ""
print_success "All streaming examples completed successfully!"