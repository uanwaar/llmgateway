#!/bin/bash

# cURL Text-to-Speech Examples for LLM Gateway
#
# This script demonstrates text-to-speech (TTS) synthesis using cURL.
# Examples include different voices, formats, speeds, and quality settings.

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

# Get script directory for saving audio files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Helper function to format file size
format_size() {
    local size=$1
    if [ $size -gt 1048576 ]; then
        echo "$(( size / 1048576 )) MB"
    elif [ $size -gt 1024 ]; then
        echo "$(( size / 1024 )) KB"
    else
        echo "$size bytes"
    fi
}

print_header "LLM Gateway cURL Text-to-Speech Examples"
echo "These examples demonstrate TTS synthesis capabilities."
echo "Make sure the LLM Gateway is running on http://localhost:8080"
echo ""

# Example 1: Basic text-to-speech
basic_tts() {
    print_header "Example 1: Basic Text-to-Speech"
    
    local TEXT="Hello! This is a demonstration of the text-to-speech functionality in the LLM Gateway."
    local OUTPUT_FILE="$SCRIPT_DIR/basic-speech.mp3"
    
    print_info "Generating basic TTS..."
    print_info "Text: $TEXT"
    
    # Create JSON payload
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1",
    "input": "$TEXT",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
    
    # Make TTS request
    curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON" \
        -o "$OUTPUT_FILE"
    
    local CURL_EXIT_CODE=$?
    rm -f "$TEMP_JSON"
    
    if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
        local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
        
        if [ $FILE_SIZE -gt 0 ]; then
            print_success "Basic TTS successful"
            print_info "Output saved to: $OUTPUT_FILE"
            print_info "File size: $(format_size $FILE_SIZE)"
        else
            print_error "Generated file is empty"
            # Try to read the file as JSON error response
            if [ "$HAS_JQ" = "true" ] && [ -f "$OUTPUT_FILE" ]; then
                ERROR_MSG=$(cat "$OUTPUT_FILE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR_MSG" ]; then
                    print_error "Error: $ERROR_MSG"
                fi
            fi
        fi
    else
        print_error "Basic TTS failed"
    fi
    
    echo ""
}

# Example 2: Different voices comparison
voice_comparison() {
    print_header "Example 2: Voice Comparison"
    
    local TEXT="The future of artificial intelligence is bright and full of possibilities."
    local VOICES=("alloy" "echo" "fable" "onyx" "nova" "shimmer")
    
    print_info "Comparing different TTS voices..."
    print_info "Text: $TEXT"
    echo ""
    
    for VOICE in "${VOICES[@]}"; do
        print_info "Generating speech with voice: $VOICE"
        
        local OUTPUT_FILE="$SCRIPT_DIR/voice-${VOICE}.mp3"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1-hd",
    "input": "$TEXT",
    "voice": "$VOICE",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "$VOICE: $(format_size $FILE_SIZE)"
            else
                print_error "$VOICE: Generation failed (empty file)"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "$VOICE: Request failed"
        fi
    done
    
    echo ""
}

# Example 3: Different audio formats
format_comparison() {
    print_header "Example 3: Audio Format Comparison"
    
    local TEXT="Testing different audio formats with the LLM Gateway TTS system."
    local FORMATS=("mp3" "opus" "aac" "flac")
    
    print_info "Testing different audio formats..."
    print_info "Text: $TEXT"
    echo ""
    
    for FORMAT in "${FORMATS[@]}"; do
        print_info "Generating audio in $FORMAT format..."
        
        local OUTPUT_FILE="$SCRIPT_DIR/format-test.${FORMAT}"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1",
    "input": "$TEXT",
    "voice": "alloy",
    "response_format": "$FORMAT",
    "speed": 1.0
}
EOF
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "$FORMAT: $(format_size $FILE_SIZE)"
            else
                print_error "$FORMAT: Generation failed (empty file)"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "$FORMAT: Request failed"
        fi
    done
    
    echo ""
}

# Example 4: Speed variations
speed_variations() {
    print_header "Example 4: Speed Variations"
    
    local TEXT="This sentence will be spoken at different speeds to demonstrate the speed parameter."
    local SPEEDS=("0.5" "0.75" "1.0" "1.25" "1.5" "2.0")
    
    print_info "Testing different speech speeds..."
    print_info "Text: $TEXT"
    echo ""
    
    for SPEED in "${SPEEDS[@]}"; do
        print_info "Generating speech at ${SPEED}x speed..."
        
        local OUTPUT_FILE="$SCRIPT_DIR/speed-${SPEED}x.mp3"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1",
    "input": "$TEXT",
    "voice": "nova",
    "response_format": "mp3",
    "speed": $SPEED
}
EOF
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "${SPEED}x speed: $(format_size $FILE_SIZE)"
            else
                print_error "${SPEED}x speed: Generation failed"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "${SPEED}x speed: Request failed"
        fi
    done
    
    echo ""
}

# Example 5: Model quality comparison
model_comparison() {
    print_header "Example 5: Model Quality Comparison"
    
    local TEXT="Compare the audio quality between standard and high-definition TTS models."
    local MODELS=("tts-1" "tts-1-hd")
    
    print_info "Comparing TTS model quality..."
    print_info "Text: $TEXT"
    echo ""
    
    for MODEL in "${MODELS[@]}"; do
        print_info "Generating speech with model: $MODEL"
        
        local OUTPUT_FILE="$SCRIPT_DIR/model-${MODEL}.mp3"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        cat > "$TEMP_JSON" << EOF
{
    "model": "$MODEL",
    "input": "$TEXT",
    "voice": "shimmer",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
        
        # Time the request
        local START_TIME=$(date +%s.%N 2>/dev/null || date +%s)
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        local END_TIME=$(date +%s.%N 2>/dev/null || date +%s)
        local DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
        
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "$MODEL: $(format_size $FILE_SIZE) in ${DURATION}s"
            else
                print_error "$MODEL: Generation failed"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "$MODEL: Request failed"
        fi
    done
    
    echo ""
}

# Example 6: Long text handling
long_text_handling() {
    print_header "Example 6: Long Text Handling"
    
    local LONG_TEXT="In the realm of artificial intelligence, we stand at the precipice of a technological revolution that promises to reshape every aspect of human existence. Machine learning algorithms are evolving at an unprecedented pace, enabling computers to process vast amounts of information, recognize patterns, and make decisions with remarkable accuracy. From natural language processing that allows seamless human-computer interaction to computer vision systems that can interpret visual data better than human experts, AI is transforming industries across the globe. Healthcare professionals now use AI to diagnose diseases earlier and more accurately. Financial institutions employ machine learning for fraud detection and risk assessment. Transportation is being revolutionized by autonomous vehicles that promise safer and more efficient travel. The future holds even greater possibilities as we continue to push the boundaries of what artificial intelligence can achieve."
    
    print_info "Testing TTS with long text input..."
    print_info "Text length: ${#LONG_TEXT} characters"
    
    local OUTPUT_FILE="$SCRIPT_DIR/long-text-speech.mp3"
    
    # Create JSON payload (need to escape quotes properly)
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "tts-1",
    "input": "In the realm of artificial intelligence, we stand at the precipice of a technological revolution that promises to reshape every aspect of human existence. Machine learning algorithms are evolving at an unprecedented pace, enabling computers to process vast amounts of information, recognize patterns, and make decisions with remarkable accuracy. From natural language processing that allows seamless human-computer interaction to computer vision systems that can interpret visual data better than human experts, AI is transforming industries across the globe. Healthcare professionals now use AI to diagnose diseases earlier and more accurately. Financial institutions employ machine learning for fraud detection and risk assessment. Transportation is being revolutionized by autonomous vehicles that promise safer and more efficient travel. The future holds even greater possibilities as we continue to push the boundaries of what artificial intelligence can achieve.",
    "voice": "onyx",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
    
    # Time the request
    local START_TIME=$(date +%s.%N 2>/dev/null || date +%s)
    
    # Make TTS request
    curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON" \
        -o "$OUTPUT_FILE"
    
    local CURL_EXIT_CODE=$?
    local END_TIME=$(date +%s.%N 2>/dev/null || date +%s)
    local DURATION=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "N/A")
    
    rm -f "$TEMP_JSON"
    
    if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
        local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
        
        if [ $FILE_SIZE -gt 0 ]; then
            print_success "Long text TTS: $(format_size $FILE_SIZE) in ${DURATION}s"
            
            # Estimate speech duration (rough calculation: ~150 words per minute)
            local WORD_COUNT=$(echo "$LONG_TEXT" | wc -w)
            local ESTIMATED_DURATION=$(echo "scale=1; $WORD_COUNT / 150 * 60" | bc -l 2>/dev/null || echo "N/A")
            print_info "Estimated audio duration: ~${ESTIMATED_DURATION} seconds"
            print_info "Word count: $WORD_COUNT words"
        else
            print_error "Long text TTS: Generation failed"
        fi
    else
        print_error "Long text TTS: Request failed"
    fi
    
    echo ""
}

# Example 7: Special characters and multilingual text
special_characters() {
    print_header "Example 7: Special Characters and Multilingual Text"
    
    local TEXTS=(
        "Testing numbers: 1, 2, 3, and symbols: @, #, $, %, &!"
        "Punctuation test: Hello, world! How are you? Great... Thanks for asking."
        "Mixed case: THIS is LOUD, this is quiet, and This Is Title Case."
        "URLs and emails: Visit https://example.com or email test@example.com"
    )
    
    print_info "Testing TTS with special characters and formatting..."
    echo ""
    
    local INDEX=1
    for TEXT in "${TEXTS[@]}"; do
        print_info "Test $INDEX: $TEXT"
        
        local OUTPUT_FILE="$SCRIPT_DIR/special-chars-${INDEX}.mp3"
        
        # Create JSON payload with proper escaping
        local TEMP_JSON=$(mktemp)
        local ESCAPED_TEXT=$(echo "$TEXT" | sed 's/"/\\"/g')
        cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1",
    "input": "$ESCAPED_TEXT",
    "voice": "fable",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "Test $INDEX: $(format_size $FILE_SIZE)"
            else
                print_error "Test $INDEX: Generation failed"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "Test $INDEX: Request failed"
        fi
        
        INDEX=$((INDEX + 1))
    done
    
    echo ""
}

# Example 8: Error handling
error_handling() {
    print_header "Example 8: Error Handling"
    
    print_info "Testing various error conditions..."
    echo ""
    
    # Test 1: Invalid API key
    print_info "Test 1: Invalid API key"
    
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "tts-1",
    "input": "Testing invalid API key",
    "voice": "alloy"
}
EOF
    
    local ERROR_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid-key-12345" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR_MSG=$(echo "$ERROR_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MSG" ]; then
            print_success "Correctly handled invalid API key: $ERROR_MSG"
        else
            print_info "Response: $ERROR_RESPONSE"
        fi
    else
        print_info "Response: $ERROR_RESPONSE"
    fi
    
    echo ""
    
    # Test 2: Invalid model
    print_info "Test 2: Invalid model name"
    
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "invalid-tts-model",
    "input": "Testing invalid model",
    "voice": "alloy"
}
EOF
    
    local ERROR_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR_MSG=$(echo "$ERROR_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MSG" ]; then
            print_success "Correctly handled invalid model: $ERROR_MSG"
        else
            print_info "Response: $ERROR_RESPONSE"
        fi
    else
        print_info "Response: $ERROR_RESPONSE"
    fi
    
    echo ""
    
    # Test 3: Missing required field
    print_info "Test 3: Missing required field (input)"
    
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "tts-1",
    "voice": "alloy"
}
EOF
    
    local ERROR_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR_MSG=$(echo "$ERROR_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MSG" ]; then
            print_success "Correctly handled missing field: $ERROR_MSG"
        else
            print_info "Response: $ERROR_RESPONSE"
        fi
    else
        print_info "Response: $ERROR_RESPONSE"
    fi
    
    echo ""
    
    # Test 4: Empty input
    print_info "Test 4: Empty input text"
    
    local TEMP_JSON=$(mktemp)
    cat > "$TEMP_JSON" << 'EOF'
{
    "model": "tts-1",
    "input": "",
    "voice": "alloy"
}
EOF
    
    local ERROR_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/speech" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        --data @"$TEMP_JSON")
    
    rm -f "$TEMP_JSON"
    
    if [ "$HAS_JQ" = "true" ]; then
        local ERROR_MSG=$(echo "$ERROR_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MSG" ]; then
            print_success "Correctly handled empty input: $ERROR_MSG"
        else
            print_info "Response: $ERROR_RESPONSE"
        fi
    else
        print_info "Response: $ERROR_RESPONSE"
    fi
    
    echo ""
}

# Example 9: Windows compatibility
windows_compatibility() {
    print_header "Example 9: Windows Compatibility Examples"
    
    print_info "Windows PowerShell examples:"
    echo ""
    
    echo "# PowerShell with here-string:"
    echo '@"'
    echo '{'
    echo '    "model": "tts-1",'
    echo '    "input": "Hello from PowerShell!",'
    echo '    "voice": "alloy",'
    echo '    "response_format": "mp3"'
    echo '}'
    echo '"@ | curl -X POST "http://localhost:8080/v1/audio/speech" \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -H "Authorization: Bearer your-api-key" \'
    echo '  --data @- \'
    echo '  --output speech.mp3'
    echo ""
    
    echo "# PowerShell with temporary file:"
    echo '$json = @"'
    echo '{"model":"tts-1","input":"Hello World","voice":"alloy"}'
    echo '"@'
    echo '$json | Out-File -Encoding utf8 temp.json'
    echo 'curl -X POST "http://localhost:8080/v1/audio/speech" \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -H "Authorization: Bearer your-api-key" \'
    echo '  --data @temp.json \'
    echo '  --output speech.mp3'
    echo 'Remove-Item temp.json'
    echo ""
    
    echo "# Command Prompt example:"
    echo 'echo {"model":"tts-1","input":"Hello!","voice":"alloy"} > temp.json'
    echo 'curl -X POST http://localhost:8080/v1/audio/speech ^'
    echo '  -H "Content-Type: application/json" ^'
    echo '  -H "Authorization: Bearer your-api-key" ^'
    echo '  --data @temp.json ^'
    echo '  --output speech.mp3'
    echo 'del temp.json'
    echo ""
    
    print_info "Windows-specific tips:"
    echo "• Use double quotes around JSON and URLs"
    echo "• Save JSON to temporary files to avoid escaping issues"
    echo "• Use --output flag to save binary audio data properly"
    echo "• PowerShell here-strings (@\"...\"@) are useful for JSON"
    echo "• Use Remove-Item or del to clean up temporary files"
    echo ""
}

# Example 10: Batch TTS generation
batch_generation() {
    print_header "Example 10: Batch TTS Generation"
    
    local BATCH_TEXTS=(
        "First sentence for batch processing."
        "Second sentence with different content."
        "Third sentence to complete the batch."
        "Final sentence in the batch generation test."
    )
    
    print_info "Generating multiple TTS files in batch..."
    echo ""
    
    local SUCCESS_COUNT=0
    local TOTAL_COUNT=${#BATCH_TEXTS[@]}
    
    for i in "${!BATCH_TEXTS[@]}"; do
        local INDEX=$((i + 1))
        local TEXT="${BATCH_TEXTS[$i]}"
        local OUTPUT_FILE="$SCRIPT_DIR/batch-${INDEX}.mp3"
        
        print_info "Batch $INDEX: $TEXT"
        
        # Create JSON payload
        local TEMP_JSON=$(mktemp)
        local ESCAPED_TEXT=$(echo "$TEXT" | sed 's/"/\\"/g')
        cat > "$TEMP_JSON" << EOF
{
    "model": "tts-1",
    "input": "$ESCAPED_TEXT",
    "voice": "nova",
    "response_format": "mp3",
    "speed": 1.0
}
EOF
        
        # Make TTS request
        curl -s -X POST "${GATEWAY_URL}/audio/speech" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${API_KEY}" \
            --data @"$TEMP_JSON" \
            -o "$OUTPUT_FILE"
        
        local CURL_EXIT_CODE=$?
        rm -f "$TEMP_JSON"
        
        if [ $CURL_EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
            local FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
            
            if [ $FILE_SIZE -gt 0 ]; then
                print_success "Batch $INDEX: $(format_size $FILE_SIZE)"
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            else
                print_error "Batch $INDEX: Generation failed"
                rm -f "$OUTPUT_FILE"
            fi
        else
            print_error "Batch $INDEX: Request failed"
        fi
    done
    
    echo ""
    print_info "Batch generation completed: $SUCCESS_COUNT/$TOTAL_COUNT successful"
    echo ""
}

# File cleanup function
cleanup_files() {
    print_header "File Cleanup"
    
    print_info "Generated audio files in $SCRIPT_DIR:"
    
    local AUDIO_FILES=()
    for ext in mp3 opus aac flac; do
        for file in "$SCRIPT_DIR"/*.$ext; do
            if [ -f "$file" ] && [[ "$(basename "$file")" != "sample-"* ]]; then
                AUDIO_FILES+=("$file")
            fi
        done
    done
    
    if [ ${#AUDIO_FILES[@]} -gt 0 ]; then
        for file in "${AUDIO_FILES[@]}"; do
            local FILE_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
            print_info "$(basename "$file"): $(format_size $FILE_SIZE)"
        done
        
        echo ""
        print_info "To clean up generated files, run:"
        echo "rm -f $SCRIPT_DIR/*.mp3 $SCRIPT_DIR/*.opus $SCRIPT_DIR/*.aac $SCRIPT_DIR/*.flac"
        echo "(This will preserve sample-* files)"
    else
        print_info "No generated audio files found."
    fi
    
    echo ""
}

# Main execution
main() {
    basic_tts
    voice_comparison
    format_comparison
    speed_variations
    model_comparison
    long_text_handling
    special_characters
    error_handling
    windows_compatibility
    batch_generation
    cleanup_files
    
    print_header "TTS Examples Summary"
    
    print_success "All text-to-speech examples completed!"
    echo ""
    
    print_info "Examples demonstrated:"
    echo "✓ Basic text-to-speech synthesis"
    echo "✓ Voice comparison (alloy, echo, fable, onyx, nova, shimmer)"
    echo "✓ Audio format comparison (mp3, opus, aac, flac)"
    echo "✓ Speed variations (0.5x to 2.0x)"
    echo "✓ Model quality comparison (tts-1 vs tts-1-hd)"
    echo "✓ Long text handling"
    echo "✓ Special characters and formatting"
    echo "✓ Error handling and validation"
    echo "✓ Windows compatibility examples"
    echo "✓ Batch generation"
    
    echo ""
    print_info "TTS synthesis tips:"
    echo "• Use tts-1-hd for higher quality audio"
    echo "• Choose appropriate voice for your use case"
    echo "• Adjust speed for different listening preferences"
    echo "• Use MP3 for general use, FLAC for highest quality"
    echo "• Test with special characters and punctuation"
    echo "• Handle errors gracefully in production code"
    
    if [ "$HAS_JQ" = "false" ]; then
        echo ""
        print_info "Install jq for better JSON error parsing:"
        echo "• Linux: sudo apt-get install jq"
        echo "• macOS: brew install jq"
        echo "• Windows: Download from https://github.com/jqlang/jq/releases"
    fi
}

# Run the main function
main

echo ""
print_success "cURL text-to-speech examples completed!"