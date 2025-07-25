#!/bin/bash

# cURL Embeddings Examples for LLM Gateway
#
# This script demonstrates embeddings generation using cURL.
# Embeddings convert text into numerical vectors for semantic similarity,
# search, clustering, and other machine learning tasks.

# Configuration
GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"  # Replace with your actual API key

# Alternative: Use environment variables (recommended)
# If you have configured the .env file with your API keys, you can run this script
# without manually entering API keys. The gateway will use the provider keys
# (OPENAI_API_KEY, GEMINI_API_KEY) from the .env file automatically.

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
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

# Helper function to format JSON output
format_json() {
    if [ "$HAS_JQ" = "true" ]; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

# Helper function to calculate cosine similarity (basic approximation)
calculate_similarity() {
    local vec1="$1"
    local vec2="$2"
    
    if [ "$HAS_JQ" = "true" ]; then
        # Extract first few dimensions for demonstration
        local dim1=$(echo "$vec1" | jq -r '.[0:3] | join(" ")')
        local dim2=$(echo "$vec2" | jq -r '.[0:3] | join(" ")')
        print_info "Sample dimensions:"
        print_info "  Vector 1: [$dim1, ...]"
        print_info "  Vector 2: [$dim2, ...]"
        
        # Note: Real cosine similarity would require full vector computation
        print_info "  (Full similarity calculation requires vector math tools)"
    fi
}

print_header "LLM Gateway cURL Embeddings Examples"
echo "These examples demonstrate text embeddings generation."
echo "Make sure the LLM Gateway is running on http://localhost:8080"
echo ""

# Example 1: Basic embeddings generation
basic_embeddings() {
    print_header "Example 1: Basic Embeddings Generation"
    
    print_info "Generating embeddings for a single text..."
    
    # Create JSON payload
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": "The quick brown fox jumps over the lazy dog."
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        print_success "Basic embeddings generation successful"
        
        if [ "$HAS_JQ" = "true" ]; then
            local EMBEDDING_COUNT=$(echo "$RESPONSE" | jq '.data | length')
            local DIMENSIONS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
            local MODEL=$(echo "$RESPONSE" | jq -r '.model // "unknown"')
            local USAGE=$(echo "$RESPONSE" | jq '.usage.total_tokens // 0')
            
            print_info "Model: $MODEL"
            print_info "Embeddings generated: $EMBEDDING_COUNT"
            print_info "Dimensions: $DIMENSIONS"
            print_info "Tokens used: $USAGE"
            
            # Show first few dimensions
            local SAMPLE_DIMS=$(echo "$RESPONSE" | jq -r '.data[0].embedding[0:5] | join(", ")')
            print_info "Sample dimensions: [$SAMPLE_DIMS, ...]"
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Basic embeddings generation failed"
    fi
    
    echo ""
}

# Example 2: Multiple texts embeddings
multiple_embeddings() {
    print_header "Example 2: Multiple Texts Embeddings"
    
    print_info "Generating embeddings for multiple texts in one request..."
    
    # Create JSON payload
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": [
        "Machine learning is a subset of artificial intelligence.",
        "Deep learning uses neural networks with multiple layers.",
        "Natural language processing helps computers understand text.",
        "Computer vision enables machines to interpret visual information."
    ]
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        print_success "Multiple embeddings generation successful"
        
        if [ "$HAS_JQ" = "true" ]; then
            local EMBEDDING_COUNT=$(echo "$RESPONSE" | jq '.data | length')
            local DIMENSIONS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
            local TOTAL_TOKENS=$(echo "$RESPONSE" | jq '.usage.total_tokens // 0')
            
            print_info "Embeddings generated: $EMBEDDING_COUNT"
            print_info "Dimensions per embedding: $DIMENSIONS"
            print_info "Total tokens used: $TOTAL_TOKENS"
            
            # Show sample from each embedding
            for i in $(seq 0 $((EMBEDDING_COUNT - 1))); do
                local SAMPLE=$(echo "$RESPONSE" | jq -r ".data[$i].embedding[0:3] | join(\", \")")
                print_info "Embedding $((i+1)) sample: [$SAMPLE, ...]"
            done
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Multiple embeddings generation failed"
    fi
    
    echo ""
}

# Example 3: Different embedding models
model_comparison() {
    print_header "Example 3: Different Embedding Models"
    
    local MODELS=("text-embedding-3-small" "text-embedding-3-large" "text-embedding-ada-002")
    local TEST_TEXT="Artificial intelligence is transforming the modern world."
    
    print_info "Comparing different embedding models..."
    print_info "Test text: $TEST_TEXT"
    echo ""
    
    for MODEL in "${MODELS[@]}"; do
        print_info "Testing model: $MODEL"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "$MODEL",
    "input": "$TEST_TEXT"
}
EOF
        
        local START_TIME=$(date +%s.%N 2>/dev/null || date +%s)
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON")
        
        local END_TIME=$(date +%s.%N 2>/dev/null || date +%s)
        local DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
        
        rm -f "$TEMP_JSON"
        
        if [ $? -eq 0 ]; then
            if [ "$HAS_JQ" = "true" ]; then
                local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR" ]; then
                    print_error "$MODEL failed: $ERROR"
                else
                    local DIMENSIONS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
                    local TOKENS=$(echo "$RESPONSE" | jq '.usage.total_tokens // 0')
                    print_success "$MODEL: $DIMENSIONS dimensions, $TOKENS tokens, ${DURATION}s"
                    
                    # Show sample dimensions
                    local SAMPLE=$(echo "$RESPONSE" | jq -r '.data[0].embedding[0:3] | join(", ")')
                    print_info "  Sample: [$SAMPLE, ...]"
                fi
            else
                print_success "$MODEL completed in ${DURATION}s"
            fi
        else
            print_error "$MODEL request failed"
        fi
        echo ""
    done
}

# Example 4: Custom dimensions (for supported models)
custom_dimensions() {
    print_header "Example 4: Custom Dimensions"
    
    local DIMENSIONS=(256 512 1024 1536)
    local TEST_TEXT="Testing custom embedding dimensions with the LLM Gateway."
    
    print_info "Testing custom embedding dimensions..."
    print_info "Test text: $TEST_TEXT"
    echo ""
    
    for DIM in "${DIMENSIONS[@]}"; do
        print_info "Testing $DIM dimensions..."
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "text-embedding-3-small",
    "input": "$TEST_TEXT",
    "dimensions": $DIM
}
EOF
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON")
        
        rm -f "$TEMP_JSON"
        
        if [ $? -eq 0 ]; then
            if [ "$HAS_JQ" = "true" ]; then
                local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR" ]; then
                    print_error "$DIM dimensions failed: $ERROR"
                else
                    local ACTUAL_DIMS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
                    local TOKENS=$(echo "$RESPONSE" | jq '.usage.total_tokens // 0')
                    
                    if [ "$ACTUAL_DIMS" = "$DIM" ]; then
                        print_success "$DIM dimensions: ✓ Exact match, $TOKENS tokens"
                    else
                        print_warning "$DIM dimensions: Got $ACTUAL_DIMS dimensions instead"
                    fi
                fi
            else
                print_success "$DIM dimensions request completed"
            fi
        else
            print_error "$DIM dimensions request failed"
        fi
    done
    
    echo ""
}

# Example 5: Different input formats
input_formats() {
    print_header "Example 5: Different Input Formats"
    
    print_info "Testing various input formats..."
    echo ""
    
    # Test 1: String input
    print_info "Test 1: Single string input"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": "Single string input for embeddings."
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        if [ "$HAS_JQ" = "true" ]; then
            local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$ERROR" ]; then
                print_error "String input failed: $ERROR"
            else
                local COUNT=$(echo "$RESPONSE" | jq '.data | length')
                print_success "String input: $COUNT embedding generated"
            fi
        else
            print_success "String input completed"
        fi
    else
        print_error "String input failed"
    fi
    
    echo ""
    
    # Test 2: Array input
    print_info "Test 2: Array of strings input"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": [
        "First text for embedding",
        "Second text for embedding",
        "Third text for embedding"
    ]
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        if [ "$HAS_JQ" = "true" ]; then
            local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$ERROR" ]; then
                print_error "Array input failed: $ERROR"
            else
                local COUNT=$(echo "$RESPONSE" | jq '.data | length')
                print_success "Array input: $COUNT embeddings generated"
            fi
        else
            print_success "Array input completed"
        fi
    else
        print_error "Array input failed"
    fi
    
    echo ""
    
    # Test 3: Token array input (if supported)
    print_info "Test 3: Token array input"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "encoding_format": "float"
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        if [ "$HAS_JQ" = "true" ]; then
            local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$ERROR" ]; then
                print_warning "Token array input not supported: $ERROR"
            else
                local COUNT=$(echo "$RESPONSE" | jq '.data | length')
                print_success "Token array input: $COUNT embedding generated"
            fi
        else
            print_success "Token array input completed"
        fi
    else
        print_error "Token array input failed"
    fi
    
    echo ""
}

# Example 6: Encoding formats
encoding_formats() {
    print_header "Example 6: Different Encoding Formats"
    
    local FORMATS=("float" "base64")
    local TEST_TEXT="Testing different encoding formats for embeddings."
    
    print_info "Testing different encoding formats..."
    print_info "Test text: $TEST_TEXT"
    echo ""
    
    for FORMAT in "${FORMATS[@]}"; do
        print_info "Testing $FORMAT encoding..."
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "text-embedding-3-small",
    "input": "$TEST_TEXT",
    "encoding_format": "$FORMAT"
}
EOF
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON")
        
        rm -f "$TEMP_JSON"
        
        if [ $? -eq 0 ]; then
            if [ "$HAS_JQ" = "true" ]; then
                local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR" ]; then
                    print_error "$FORMAT encoding failed: $ERROR"
                else
                    local DIMS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
                    print_success "$FORMAT encoding: $DIMS dimensions"
                    
                    # Show sample based on format
                    if [ "$FORMAT" = "float" ]; then
                        local SAMPLE=$(echo "$RESPONSE" | jq -r '.data[0].embedding[0:3] | join(", ")')
                        print_info "  Sample values: [$SAMPLE, ...]"
                    elif [ "$FORMAT" = "base64" ]; then
                        local B64_SAMPLE=$(echo "$RESPONSE" | jq -r '.data[0].embedding[:20]')
                        print_info "  Base64 sample: $B64_SAMPLE..."
                    fi
                fi
            else
                print_success "$FORMAT encoding completed"
            fi
        else
            print_error "$FORMAT encoding request failed"
        fi
        echo ""
    done
}

# Example 7: Semantic similarity demonstration
semantic_similarity() {
    print_header "Example 7: Semantic Similarity Demonstration"
    
    print_info "Generating embeddings for semantically related texts..."
    
    # Create JSON payload with related texts
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": [
        "The cat sat on the mat.",
        "A feline rested on the rug.",
        "Dogs are loyal companions.",
        "Machine learning algorithms process data.",
        "AI systems learn from examples."
    ]
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        print_success "Semantic similarity embeddings generated"
        
        if [ "$HAS_JQ" = "true" ]; then
            local COUNT=$(echo "$RESPONSE" | jq '.data | length')
            print_info "Generated $COUNT embeddings for similarity comparison"
            echo ""
            
            print_info "Text similarity groups (conceptually):"
            echo "Group 1 (cats/felines):"
            echo "  - 'The cat sat on the mat.'"
            echo "  - 'A feline rested on the rug.'"
            echo ""
            echo "Group 2 (dogs):"
            echo "  - 'Dogs are loyal companions.'"
            echo ""
            echo "Group 3 (AI/ML):"
            echo "  - 'Machine learning algorithms process data.'"
            echo "  - 'AI systems learn from examples.'"
            echo ""
            
            # Show sample embeddings for first two (similar) texts
            if [ $COUNT -ge 2 ]; then
                print_info "Comparing similar texts (cat vs feline):"
                local VEC1=$(echo "$RESPONSE" | jq '.data[0].embedding')
                local VEC2=$(echo "$RESPONSE" | jq '.data[1].embedding')
                calculate_similarity "$VEC1" "$VEC2"
            fi
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Semantic similarity demonstration failed"
    fi
    
    echo ""
}

# Example 8: Large batch processing
batch_processing() {
    print_header "Example 8: Batch Processing"
    
    print_info "Processing a larger batch of texts..."
    
    # Create JSON payload with many texts
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": [
        "Natural language processing enables computers to understand human language.",
        "Computer vision allows machines to interpret and analyze visual information.",
        "Machine learning algorithms can identify patterns in large datasets.",
        "Deep learning networks consist of multiple interconnected layers.",
        "Artificial intelligence encompasses various subfields of computer science.",
        "Neural networks are inspired by the structure of biological brains.",
        "Supervised learning requires labeled training data for model development.",
        "Unsupervised learning discovers hidden patterns without labeled examples.",
        "Reinforcement learning involves agents learning through trial and error.",
        "Transfer learning leverages knowledge from one task to improve another."
    ]
}
EOF
    
    local START_TIME=$(date +%s.%N 2>/dev/null || date +%s)
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    local END_TIME=$(date +%s.%N 2>/dev/null || date +%s)
    local DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
    
    rm -f "$TEMP_JSON"
    
    if [ $? -eq 0 ]; then
        print_success "Batch processing completed in ${DURATION}s"
        
        if [ "$HAS_JQ" = "true" ]; then
            local COUNT=$(echo "$RESPONSE" | jq '.data | length')
            local DIMENSIONS=$(echo "$RESPONSE" | jq '.data[0].embedding | length')
            local TOTAL_TOKENS=$(echo "$RESPONSE" | jq '.usage.total_tokens // 0')
            local PROMPT_TOKENS=$(echo "$RESPONSE" | jq '.usage.prompt_tokens // 0')
            
            print_info "Batch results:"
            print_info "  Embeddings generated: $COUNT"
            print_info "  Dimensions per embedding: $DIMENSIONS"
            print_info "  Total tokens: $TOTAL_TOKENS"
            print_info "  Prompt tokens: $PROMPT_TOKENS"
            print_info "  Processing time: ${DURATION}s"
            print_info "  Embeddings per second: $(echo "scale=2; $COUNT / $DURATION" | bc -l 2>/dev/null || echo "N/A")"
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Batch processing failed"
    fi
    
    echo ""
}

# Example 9: Error handling
error_handling() {
    print_header "Example 9: Error Handling"
    
    print_info "Testing various error conditions..."
    echo ""
    
    # Test 1: Invalid API key
    print_info "Test 1: Invalid API key"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": "Testing invalid API key"
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid-key-12345" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR" ]; then
            print_success "Correctly handled invalid API key: $ERROR"
        else
            print_info "Response: $RESPONSE"
        fi
    else
        print_info "Response: $RESPONSE"
    fi
    
    echo ""
    
    # Test 2: Missing required field
    print_info "Test 2: Missing required field (input)"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small"
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR" ]; then
            print_success "Correctly handled missing field: $ERROR"
        else
            print_info "Response: $RESPONSE"
        fi
    else
        print_info "Response: $RESPONSE"
    fi
    
    echo ""
    
    # Test 3: Invalid model
    print_info "Test 3: Invalid model name"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "invalid-embedding-model",
    "input": "Testing invalid model"
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR" ]; then
            print_success "Correctly handled invalid model: $ERROR"
        else
            print_info "Response: $RESPONSE"
        fi
    else
        print_info "Response: $RESPONSE"
    fi
    
    echo ""
    
    # Test 4: Empty input
    print_info "Test 4: Empty input"
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "text-embedding-3-small",
    "input": ""
}
EOF
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/embeddings" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR" ]; then
            print_success "Correctly handled empty input: $ERROR"
        else
            print_info "Response: $RESPONSE"
        fi
    else
        print_info "Response: $RESPONSE"
    fi
    
    echo ""
}

# Example 10: Windows compatibility
windows_compatibility() {
    print_header "Example 10: Windows Compatibility Examples"
    
    print_info "Windows PowerShell examples:"
    echo ""
    
    echo "# PowerShell with here-string:"
    echo '@"'
    echo '{'
    echo '    "model": "text-embedding-3-small",'
    echo '    "input": "Text for embedding generation"'
    echo '}'
    echo '"@ | curl -X POST "http://localhost:8080/v1/embeddings" \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -H "Authorization: Bearer your-api-key" \'
    echo '  --data @-'
    echo ""
    
    echo "# PowerShell with multiple inputs:"
    echo '@"'
    echo '{'
    echo '    "model": "text-embedding-3-small",'
    echo '    "input": ['
    echo '        "First text for embedding",'
    echo '        "Second text for embedding",'
    echo '        "Third text for embedding"'
    echo '    ]'
    echo '}'
    echo '"@ | curl -X POST "http://localhost:8080/v1/embeddings" \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -H "Authorization: Bearer your-api-key" \'
    echo '  --data @-'
    echo ""
    
    echo "# Command Prompt with file:"
    echo 'echo {"model":"text-embedding-3-small","input":"Hello world"} > temp.json'
    echo 'curl -X POST http://localhost:8080/v1/embeddings ^'
    echo '  -H "Content-Type: application/json" ^'
    echo '  -H "Authorization: Bearer your-api-key" ^'
    echo '  --data @temp.json'
    echo 'del temp.json'
    echo ""
    
    print_info "Windows-specific tips:"
    echo "• Use double quotes around JSON and URLs"
    echo "• Save complex JSON to temporary files"
    echo "• Use PowerShell here-strings for multi-line JSON"
    echo "• Install jq for Windows to parse JSON responses"
    echo "• Use ^ for line continuation in Command Prompt"
    echo "• Use backticks (`) for line continuation in PowerShell"
    echo ""
}

# Main execution
main() {
    basic_embeddings
    multiple_embeddings
    model_comparison
    custom_dimensions
    input_formats
    encoding_formats
    semantic_similarity
    batch_processing
    error_handling
    windows_compatibility
    
    print_header "Embeddings Examples Summary"
    
    print_success "All embeddings examples completed!"
    echo ""
    
    print_info "Examples demonstrated:"
    echo "✓ Basic embeddings generation"
    echo "✓ Multiple texts processing"
    echo "✓ Different embedding models comparison"
    echo "✓ Custom dimensions (where supported)"
    echo "✓ Various input formats (string, array, tokens)"
    echo "✓ Different encoding formats (float, base64)"
    echo "✓ Semantic similarity demonstration"
    echo "✓ Large batch processing"
    echo "✓ Comprehensive error handling"
    echo "✓ Windows compatibility examples"
    
    echo ""
    print_info "Embeddings use cases:"
    echo "• Semantic search and similarity matching"
    echo "• Document clustering and classification"
    echo "• Recommendation systems"
    echo "• Anomaly detection in text"
    echo "• Question-answering systems"
    echo "• Text summarization and analysis"
    echo "• Multilingual text processing"
    
    echo ""
    print_info "Best practices:"
    echo "• Choose appropriate model for your use case"
    echo "• Use batch processing for efficiency"
    echo "• Consider dimension reduction for storage"
    echo "• Normalize embeddings for cosine similarity"
    echo "• Cache embeddings for repeated use"
    echo "• Monitor token usage for cost optimization"
    
    if [ "$HAS_JQ" = "false" ]; then
        echo ""
        print_info "Install jq for better JSON processing:"
        echo "• Linux: sudo apt-get install jq"
        echo "• macOS: brew install jq"
        echo "• Windows: Download from https://github.com/jqlang/jq/releases"
    fi
}

# Run the main function
main

echo ""
print_success "cURL embeddings examples completed!"