#!/bin/bash

# cURL Audio Transcription Examples for LLM Gateway
#
# This script demonstrates audio processing capabilities using cURL:
# - Audio transcription (speech-to-text)
# - Audio translation (speech-to-text in English)
# - File format validation and handling

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

# Get script directory for finding sample files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="$(dirname "$SCRIPT_DIR")"

print_header "LLM Gateway cURL Audio Transcription Examples"
echo "These examples demonstrate audio processing capabilities."
echo "Make sure the LLM Gateway is running on http://localhost:8080"
echo ""

# Check for sample audio files
check_audio_files() {
    print_info "Checking for sample audio files..."
    
    SAMPLE_FILES=(
        "sample-audio.mp3"
        "sample-audio.wav"
        "foreign-language-audio.mp3"
        "test-audio.m4a"
    )
    
    FOUND_FILES=()
    
    for file in "${SAMPLE_FILES[@]}"; do
        if [ -f "$SCRIPT_DIR/$file" ]; then
            FOUND_FILES+=("$file")
            print_success "Found: $file"
        else
            print_warning "Missing: $file"
        fi
    done
    
    if [ ${#FOUND_FILES[@]} -eq 0 ]; then
        print_warning "No sample audio files found in $SCRIPT_DIR"
        echo "Please add sample audio files for testing:"
        echo "- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm"
        echo "- Maximum file size: 25 MB"
        echo ""
        
        # Create a simple test audio file instruction
        print_info "To create a test audio file, you can:"
        echo "1. Record a short voice memo on your phone"
        echo "2. Convert it to MP3 format"
        echo "3. Save it as 'sample-audio.mp3' in the curl examples directory"
        echo ""
        
        return 1
    fi
    
    echo ""
    return 0
}

# Example 1: Basic audio transcription
basic_transcription() {
    print_header "Example 1: Basic Audio Transcription"
    
    AUDIO_FILE="$SCRIPT_DIR/sample-audio.mp3"
    
    if [ ! -f "$AUDIO_FILE" ]; then
        print_error "Audio file not found: $AUDIO_FILE"
        print_info "Please add a sample MP3 file for testing."
        return 1
    fi
    
    print_info "Transcribing: $(basename "$AUDIO_FILE")"
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${AUDIO_FILE}" \
        -F "model=whisper-1" \
        -F "language=en" \
        -F "response_format=json")
    
    if [ $? -eq 0 ]; then
        print_success "Basic transcription successful"
        echo "Response:"
        format_json "$RESPONSE"
        
        if [ "$HAS_JQ" = "true" ]; then
            TEXT=$(echo "$RESPONSE" | jq -r '.text // "No text found"')
            print_info "Transcribed text: $TEXT"
        fi
    else
        print_error "Basic transcription failed"
    fi
    
    echo ""
}

# Example 2: Detailed transcription with verbose output
detailed_transcription() {
    print_header "Example 2: Detailed Transcription with Timestamps"
    
    AUDIO_FILE="$SCRIPT_DIR/sample-audio.wav"
    
    # Try MP3 if WAV doesn't exist
    if [ ! -f "$AUDIO_FILE" ]; then
        AUDIO_FILE="$SCRIPT_DIR/sample-audio.mp3"
    fi
    
    if [ ! -f "$AUDIO_FILE" ]; then
        print_error "No suitable audio file found for detailed transcription"
        return 1
    fi
    
    print_info "Detailed transcription of: $(basename "$AUDIO_FILE")"
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${AUDIO_FILE}" \
        -F "model=whisper-1" \
        -F "prompt=This is a conversation about technology and AI." \
        -F "response_format=verbose_json" \
        -F "temperature=0.2" \
        -F "language=en")
    
    if [ $? -eq 0 ]; then
        print_success "Detailed transcription successful"
        
        if [ "$HAS_JQ" = "true" ]; then
            TEXT=$(echo "$RESPONSE" | jq -r '.text // "No text found"')
            LANGUAGE=$(echo "$RESPONSE" | jq -r '.language // "unknown"')
            DURATION=$(echo "$RESPONSE" | jq -r '.duration // "unknown"')
            
            print_info "Transcribed text: $TEXT"
            print_info "Language detected: $LANGUAGE"
            print_info "Duration: $DURATION seconds"
            
            # Show first few segments if available
            SEGMENTS=$(echo "$RESPONSE" | jq -r '.segments // [] | length')
            if [ "$SEGMENTS" -gt 0 ]; then
                print_info "First few timestamped segments:"
                echo "$RESPONSE" | jq -r '.segments[:3] | .[] | "[\(.start | tostring)s - \(.end | tostring)s]: \(.text)"' 2>/dev/null || true
            fi
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Detailed transcription failed"
    fi
    
    echo ""
}

# Example 3: Audio translation
audio_translation() {
    print_header "Example 3: Audio Translation to English"
    
    AUDIO_FILE="$SCRIPT_DIR/foreign-language-audio.mp3"
    
    if [ ! -f "$AUDIO_FILE" ]; then
        print_warning "Foreign language audio file not found: $(basename "$AUDIO_FILE")"
        print_info "Using English audio for demonstration (will still work)"
        AUDIO_FILE="$SCRIPT_DIR/sample-audio.mp3"
        
        if [ ! -f "$AUDIO_FILE" ]; then
            print_error "No audio file available for translation example"
            return 1
        fi
    fi
    
    print_info "Translating to English: $(basename "$AUDIO_FILE")"
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/translations" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${AUDIO_FILE}" \
        -F "model=whisper-1" \
        -F "response_format=json" \
        -F "temperature=0.0")
    
    if [ $? -eq 0 ]; then
        print_success "Audio translation successful"
        
        if [ "$HAS_JQ" = "true" ]; then
            TEXT=$(echo "$RESPONSE" | jq -r '.text // "No text found"')
            print_info "Translated text (English): $TEXT"
        else
            echo "Response:"
            format_json "$RESPONSE"
        fi
    else
        print_error "Audio translation failed"
    fi
    
    echo ""
}

# Example 4: Different response formats
response_formats() {
    print_header "Example 4: Different Response Formats"
    
    AUDIO_FILE="$SCRIPT_DIR/sample-audio.mp3"
    
    if [ ! -f "$AUDIO_FILE" ]; then
        print_error "Audio file not found for format testing"
        return 1
    fi
    
    FORMATS=("json" "text" "srt" "vtt")
    
    for FORMAT in "${FORMATS[@]}"; do
        print_info "Testing response format: $FORMAT"
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
            -H "Authorization: Bearer ${API_KEY}" \
            -F "file=@${AUDIO_FILE}" \
            -F "model=whisper-1" \
            -F "response_format=${FORMAT}")
        
        if [ $? -eq 0 ]; then
            print_success "$FORMAT format successful"
            
            case $FORMAT in
                "json")
                    if [ "$HAS_JQ" = "true" ]; then
                        TEXT=$(echo "$RESPONSE" | jq -r '.text // "No text found"')
                        echo "   Text: $TEXT"
                    else
                        echo "   Response: $RESPONSE"
                    fi
                    ;;
                "text")
                    echo "   Text: $RESPONSE"
                    ;;
                "srt"|"vtt")
                    echo "   Subtitle format output:"
                    echo "$RESPONSE" | head -5
                    if [ $(echo "$RESPONSE" | wc -l) -gt 5 ]; then
                        echo "   ... (truncated)"
                    fi
                    ;;
            esac
        else
            print_error "$FORMAT format failed"
        fi
        echo ""
    done
}

# Example 5: Audio file validation
validate_audio_file() {
    print_header "Example 5: Audio File Validation"
    
    local FILE_PATH="$1"
    local FILE_NAME=$(basename "$FILE_PATH")
    
    print_info "Validating: $FILE_NAME"
    
    if [ ! -f "$FILE_PATH" ]; then
        print_error "File does not exist: $FILE_NAME"
        return 1
    fi
    
    # Check file size (25MB limit)
    local FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null || echo "0")
    local SIZE_MB=$((FILE_SIZE / 1024 / 1024))
    local MAX_SIZE_MB=25
    
    print_info "File size: ${SIZE_MB} MB"
    
    if [ $SIZE_MB -gt $MAX_SIZE_MB ]; then
        print_error "File too large! Maximum size is ${MAX_SIZE_MB} MB"
        return 1
    fi
    
    # Check file extension
    local EXTENSION="${FILE_NAME##*.}"
    EXTENSION=$(echo "$EXTENSION" | tr '[:upper:]' '[:lower:]')
    
    local SUPPORTED_FORMATS=("mp3" "mp4" "mpeg" "mpga" "m4a" "wav" "webm")
    local SUPPORTED=false
    
    for FORMAT in "${SUPPORTED_FORMATS[@]}"; do
        if [ "$EXTENSION" = "$FORMAT" ]; then
            SUPPORTED=true
            break
        fi
    done
    
    if [ "$SUPPORTED" = true ]; then
        print_success "Format supported: .$EXTENSION"
        
        # Test actual transcription
        print_info "Testing transcription..."
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
            -H "Authorization: Bearer ${API_KEY}" \
            -F "file=@${FILE_PATH}" \
            -F "model=whisper-1" \
            -F "response_format=json" \
            -F "max_tokens=50")
        
        if [ $? -eq 0 ]; then
            if [ "$HAS_JQ" = "true" ]; then
                ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR" ]; then
                    print_error "Transcription test failed: $ERROR"
                    return 1
                else
                    print_success "File validation passed - transcription works!"
                    return 0
                fi
            else
                print_success "File validation completed"
                return 0
            fi
        else
            print_error "Transcription test failed"
            return 1
        fi
    else
        print_error "Unsupported format: .$EXTENSION"
        print_info "Supported formats: ${SUPPORTED_FORMATS[*]}"
        return 1
    fi
}

# Example 6: Batch processing simulation
batch_processing() {
    print_header "Example 6: Batch Audio Processing"
    
    # Find all audio files in the directory
    AUDIO_FILES=()
    for ext in mp3 wav m4a mp4; do
        for file in "$SCRIPT_DIR"/*.$ext; do
            if [ -f "$file" ]; then
                AUDIO_FILES+=("$file")
            fi
        done
    done
    
    if [ ${#AUDIO_FILES[@]} -eq 0 ]; then
        print_warning "No audio files found for batch processing"
        return 1
    fi
    
    print_info "Found ${#AUDIO_FILES[@]} audio files for batch processing"
    
    local SUCCESS_COUNT=0
    local TOTAL_COUNT=${#AUDIO_FILES[@]}
    
    for AUDIO_FILE in "${AUDIO_FILES[@]}"; do
        local FILE_NAME=$(basename "$AUDIO_FILE")
        print_info "Processing: $FILE_NAME"
        
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
            -H "Authorization: Bearer ${API_KEY}" \
            -F "file=@${AUDIO_FILE}" \
            -F "model=whisper-1" \
            -F "response_format=json")
        
        if [ $? -eq 0 ]; then
            if [ "$HAS_JQ" = "true" ]; then
                ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
                if [ -n "$ERROR" ]; then
                    print_error "$FILE_NAME failed: $ERROR"
                else
                    TEXT=$(echo "$RESPONSE" | jq -r '.text // "No text found"')
                    print_success "$FILE_NAME: ${TEXT:0:50}..."
                    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                fi
            else
                print_success "$FILE_NAME processed"
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            fi
        else
            print_error "$FILE_NAME failed"
        fi
    done
    
    echo ""
    print_info "Batch processing completed: $SUCCESS_COUNT/$TOTAL_COUNT successful"
    echo ""
}

# Example 7: Error handling demonstration
error_handling() {
    print_header "Example 7: Error Handling"
    
    print_info "Testing various error conditions..."
    echo ""
    
    # Test 1: Missing file
    print_info "Test 1: Missing file"
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@nonexistent-file.mp3" \
        -F "model=whisper-1" 2>&1)
    
    if [[ "$RESPONSE" =~ "No such file" ]] || [[ "$RESPONSE" =~ "not found" ]]; then
        print_success "Correctly handled missing file"
    else
        print_info "Response: $RESPONSE"
    fi
    echo ""
    
    # Test 2: Invalid API key
    print_info "Test 2: Invalid API key"
    
    # Use a valid file if available
    AUDIO_FILE="$SCRIPT_DIR/sample-audio.mp3"
    if [ ! -f "$AUDIO_FILE" ]; then
        # Create a minimal test file for error testing
        echo "Creating temporary audio file for error testing..."
        # Note: This won't be a real audio file, but will test the API error handling
        echo "fake audio content" > "$SCRIPT_DIR/test-error.txt"
        AUDIO_FILE="$SCRIPT_DIR/test-error.txt"
    fi
    
    RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
        -H "Authorization: Bearer invalid-key-12345" \
        -F "file=@${AUDIO_FILE}" \
        -F "model=whisper-1" \
        -F "response_format=json")
    
    if [ "$HAS_JQ" = "true" ]; then
        ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [[ "$ERROR" =~ "authentication" ]] || [[ "$ERROR" =~ "unauthorized" ]] || [[ "$ERROR" =~ "invalid" ]]; then
            print_success "Correctly handled invalid API key"
        else
            print_info "Auth error response: $ERROR"
        fi
    else
        print_info "Auth error response: $RESPONSE"
    fi
    
    # Clean up test file
    if [ -f "$SCRIPT_DIR/test-error.txt" ]; then
        rm -f "$SCRIPT_DIR/test-error.txt"
    fi
    
    echo ""
    
    # Test 3: Invalid model
    print_info "Test 3: Invalid model name"
    if [ -f "$SCRIPT_DIR/sample-audio.mp3" ]; then
        RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/audio/transcriptions" \
            -H "Authorization: Bearer ${API_KEY}" \
            -F "file=@$SCRIPT_DIR/sample-audio.mp3" \
            -F "model=invalid-model-name" \
            -F "response_format=json")
        
        if [ "$HAS_JQ" = "true" ]; then
            ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$ERROR" ]; then
                print_success "Correctly handled invalid model: $ERROR"
            else
                print_info "Model error response: $RESPONSE"
            fi
        else
            print_info "Model error response: $RESPONSE"
        fi
    else
        print_warning "Skipping invalid model test - no audio file available"
    fi
    
    echo ""
}

# Example 8: Windows compatibility examples
windows_compatibility() {
    print_header "Example 8: Windows Compatibility Examples"
    
    print_info "Windows PowerShell examples:"
    echo ""
    
    echo "# PowerShell multipart form example:"
    echo 'curl -X POST "http://localhost:8080/v1/audio/transcriptions" \'
    echo '  -H "Authorization: Bearer your-api-key" \'
    echo '  -F "file=@C:\path\to\audio.mp3" \'
    echo '  -F "model=whisper-1" \'
    echo '  -F "response_format=json"'
    echo ""
    
    echo "# Command Prompt example:"
    echo 'curl -X POST http://localhost:8080/v1/audio/transcriptions ^'
    echo '  -H "Authorization: Bearer your-api-key" ^'
    echo '  -F "file=@audio.mp3" ^'
    echo '  -F "model=whisper-1" ^'
    echo '  -F "response_format=json"'
    echo ""
    
    print_info "Windows-specific tips:"
    echo "• Use double quotes around URLs and headers"
    echo "• Use ^ for line continuation in Command Prompt"
    echo "• Use backticks (\`) for line continuation in PowerShell"
    echo "• File paths can use forward slashes in curl"
    echo ""
}

# Main execution
main() {
    # Check for audio files
    check_audio_files
    HAS_AUDIO_FILES=$?
    
    if [ $HAS_AUDIO_FILES -eq 0 ]; then
        # Run examples that require audio files
        basic_transcription
        detailed_transcription
        audio_translation
        response_formats
        
        # Validate the first found audio file
        for file in "$SCRIPT_DIR"/*.mp3 "$SCRIPT_DIR"/*.wav "$SCRIPT_DIR"/*.m4a; do
            if [ -f "$file" ]; then
                validate_audio_file "$file"
                break
            fi
        done
        
        batch_processing
    else
        print_warning "Skipping audio file examples - no files found"
        echo ""
    fi
    
    # Run examples that don't require audio files
    error_handling
    windows_compatibility
    
    print_header "Audio Examples Summary"
    
    if [ $HAS_AUDIO_FILES -eq 0 ]; then
        print_success "All audio transcription examples completed!"
        echo ""
        print_info "Examples demonstrated:"
        echo "✓ Basic audio transcription"
        echo "✓ Detailed transcription with timestamps"
        echo "✓ Audio translation to English"
        echo "✓ Multiple response formats (JSON, text, SRT, VTT)"
        echo "✓ Audio file validation"
        echo "✓ Batch processing"
        echo "✓ Error handling"
        echo "✓ Windows compatibility"
    else
        print_info "Partial completion - add audio files for full testing"
        echo ""
        print_info "Examples demonstrated:"
        echo "✓ Error handling"
        echo "✓ Windows compatibility"
        echo "⚠ Audio transcription examples (requires audio files)"
    fi
    
    echo ""
    print_info "Audio processing tips:"
    echo "• Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm"
    echo "• Maximum file size: 25 MB"
    echo "• Use appropriate response format for your needs"
    echo "• Include context prompts for better accuracy"
    echo "• Lower temperature for more accurate transcription"
    
    if [ "$HAS_JQ" = "false" ]; then
        echo ""
        print_info "Install jq for better JSON parsing:"
        echo "• Linux: sudo apt-get install jq"
        echo "• macOS: brew install jq"
        echo "• Windows: Download from https://github.com/jqlang/jq/releases"
    fi
}

# Run the main function
main

echo ""
print_success "cURL audio transcription examples completed!"