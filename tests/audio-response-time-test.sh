#!/bin/bash

# Audio Transcription Response Time Test Script
# Tests audio transcription endpoints with different file durations
# and measures response times to estimate performance patterns

# Configuration
GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"  # Replace with your actual API key

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="$SCRIPT_DIR/transcription_performance_results.json"

# Helper functions
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

# Check if jq is available for JSON parsing
check_jq() {
    if command -v jq &> /dev/null; then
        echo "true"
    else
        echo "false"
    fi
}

HAS_JQ=$(check_jq)

# Get file duration using ffprobe if available
get_audio_duration() {
    local file_path="$1"
    
    if command -v ffprobe &> /dev/null; then
        ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$file_path" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Get file size in MB
get_file_size_mb() {
    local file_path="$1"
    local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
    echo "scale=2; $file_size / 1024 / 1024" | bc -l 2>/dev/null || echo "unknown"
}

# Test single audio file transcription with timing
test_transcription_with_timing() {
    local file_path="$1"
    local test_name="$2"
    local file_name=$(basename "$file_path")
    
    if [ ! -f "$file_path" ]; then
        echo "{\"test\":\"$test_name\",\"file\":\"$file_name\",\"status\":\"error\",\"error\":\"File not found\"}"
        return 1
    fi
    
    local file_duration=$(get_audio_duration "$file_path")
    local file_size_mb=$(get_file_size_mb "$file_path")
    
    print_info "Testing: $file_name (Duration: ${file_duration}s, Size: ${file_size_mb}MB)"
    
    # Record start time
    local start_time=$(date +%s.%N)
    
    # Make the API request
    local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME_TOTAL:%{time_total};SIZE_DOWNLOAD:%{size_download}" \
        -X POST "${GATEWAY_URL}/audio/transcriptions" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${file_path}" \
        -F "model=whisper-1" \
        -F "language=en" \
        -F "response_format=json")
    
    # Record end time
    local end_time=$(date +%s.%N)
    
    # Parse curl output
    local http_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+;TIME_TOTAL:[0-9.]+;SIZE_DOWNLOAD:[0-9]+$//')
    local http_status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*' | cut -d: -f2)
    local time_total=$(echo "$response" | grep -o 'TIME_TOTAL:[0-9.]*' | cut -d: -f2)
    local size_download=$(echo "$response" | grep -o 'SIZE_DOWNLOAD:[0-9]*' | cut -d: -f2)
    
    # Calculate processing time
    local processing_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "unknown")
    
    # Initialize result JSON
    local result_json="{
        \"test\": \"$test_name\",
        \"file\": \"$file_name\",
        \"file_duration_seconds\": \"$file_duration\",
        \"file_size_mb\": \"$file_size_mb\",
        \"http_status\": \"$http_status\",
        \"processing_time_seconds\": \"$processing_time\",
        \"curl_time_total\": \"$time_total\",
        \"response_size_bytes\": \"$size_download\",
        \"timestamp\": \"$(date -Iseconds)\""
    
    if [ "$http_status" = "200" ]; then
        if [ "$HAS_JQ" = "true" ]; then
            local transcribed_text=$(echo "$http_body" | jq -r '.text // "No text found"' 2>/dev/null)
            local char_count=$(echo "$transcribed_text" | wc -c | tr -d ' ')
            
            result_json="$result_json,
                \"status\": \"success\",
                \"transcribed_text\": $(echo "$transcribed_text" | jq -R .),
                \"character_count\": $char_count"
            
            print_success "$file_name: ${processing_time}s (Audio: ${file_duration}s, Text: ${char_count} chars)"
        else
            result_json="$result_json,
                \"status\": \"success\",
                \"transcribed_text\": $(echo "$http_body" | sed 's/"/\\"/g')"
            
            print_success "$file_name: ${processing_time}s (Audio: ${file_duration}s)"
        fi
    else
        local error_message="HTTP $http_status"
        if [ "$HAS_JQ" = "true" ]; then
            local api_error=$(echo "$http_body" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$api_error" ]; then
                error_message="$api_error"
            fi
        fi
        
        result_json="$result_json,
            \"status\": \"error\",
            \"error\": \"$error_message\""
        
        print_error "$file_name: $error_message (${processing_time}s)"
    fi
    
    result_json="$result_json }"
    echo "$result_json"
}

# Create sample audio files with different durations
create_duration_samples() {
    print_header "Creating Duration Test Samples"
    
    if ! command -v ffmpeg &> /dev/null; then
        print_error "ffmpeg not found. Please install ffmpeg to create test samples."
        print_info "Alternative: Manually create audio files of different durations:"
        echo "  - short_5s.mp3 (5 seconds)"
        echo "  - medium_30s.mp3 (30 seconds)"
        echo "  - medium_60s.mp3 (60 seconds)"
        echo "  - long_300s.mp3 (5 minutes)"
        return 1
    fi
    
    # Create silent audio files of different durations for testing
    local durations=("5" "30" "60" "300")  # 5s, 30s, 1m, 5m
    
    for duration in "${durations[@]}"; do
        local filename="test_${duration}s.mp3"
        local filepath="$SCRIPT_DIR/$filename"
        
        if [ ! -f "$filepath" ]; then
            print_info "Creating $filename (${duration}s silent audio)..."
            ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=22050" \
                   -t "$duration" -c:a mp3 -b:a 64k "$filepath" -y -loglevel quiet
            
            if [ $? -eq 0 ]; then
                print_success "Created: $filename"
            else
                print_error "Failed to create: $filename"
            fi
        else
            print_info "Already exists: $filename"
        fi
    done
    
    print_info "Note: These are silent files. For realistic testing, replace with actual speech audio."
}

# Find existing audio files for testing
find_test_files() {
    local test_files=()
    
    # Look for common test file names
    local common_names=(
        "sample-audio.mp3"
        "sample-audio.wav" 
        "test-audio.m4a"
        "short_5s.mp3"
        "medium_30s.mp3"
        "medium_60s.mp3"
        "long_300s.mp3"
    )
    
    # Also look for any audio files in the directory
    for ext in mp3 wav m4a mp4 webm; do
        for file in "$SCRIPT_DIR"/*.$ext; do
            if [ -f "$file" ]; then
                common_names+=("$(basename "$file")")
            fi
        done
    done
    
    # Remove duplicates and add existing files to test_files
    for file_name in "${common_names[@]}"; do
        local file_path="$SCRIPT_DIR/$file_name"
        if [ -f "$file_path" ] && [[ ! " ${test_files[@]} " =~ " ${file_path} " ]]; then
            test_files+=("$file_path")
        fi
    done
    
    echo "${test_files[@]}"
}

# Run performance analysis
analyze_performance() {
    print_header "Performance Analysis"
    
    if [ ! -f "$RESULTS_FILE" ] || [ ! -s "$RESULTS_FILE" ]; then
        print_error "No results file found or file is empty"
        return 1
    fi
    
    if [ "$HAS_JQ" = "false" ]; then
        print_error "jq is required for performance analysis"
        print_info "Results saved to: $RESULTS_FILE"
        return 1
    fi
    
    local total_tests=$(jq '. | length' "$RESULTS_FILE")
    local successful_tests=$(jq '[.[] | select(.status == "success")] | length' "$RESULTS_FILE")
    local failed_tests=$(jq '[.[] | select(.status == "error")] | length' "$RESULTS_FILE")
    
    print_info "Test Results Summary:"
    echo "  Total tests: $total_tests"
    echo "  Successful: $successful_tests"
    echo "  Failed: $failed_tests"
    echo ""
    
    if [ "$successful_tests" -gt 0 ]; then
        print_info "Processing Time Analysis:"
        
        local avg_processing_time=$(jq -r '[.[] | select(.status == "success" and .processing_time_seconds != "unknown") | .processing_time_seconds | tonumber] | add / length' "$RESULTS_FILE")
        local min_processing_time=$(jq -r '[.[] | select(.status == "success" and .processing_time_seconds != "unknown") | .processing_time_seconds | tonumber] | min' "$RESULTS_FILE")
        local max_processing_time=$(jq -r '[.[] | select(.status == "success" and .processing_time_seconds != "unknown") | .processing_time_seconds | tonumber] | max' "$RESULTS_FILE")
        
        echo "  Average processing time: ${avg_processing_time}s"
        echo "  Fastest processing time: ${min_processing_time}s"
        echo "  Slowest processing time: ${max_processing_time}s"
        echo ""
        
        print_info "Duration vs Processing Time:"
        jq -r '.[] | select(.status == "success" and .processing_time_seconds != "unknown" and .file_duration_seconds != "unknown") | 
               "  " + .file + ": " + .file_duration_seconds + "s audio → " + .processing_time_seconds + "s processing"' "$RESULTS_FILE"
        echo ""
        
        # Calculate processing ratio (processing_time / audio_duration)
        print_info "Processing Efficiency (lower is better):"
        jq -r '.[] | select(.status == "success" and .processing_time_seconds != "unknown" and .file_duration_seconds != "unknown" and (.file_duration_seconds | tonumber) > 0) | 
               "  " + .file + ": " + ((.processing_time_seconds | tonumber) / (.file_duration_seconds | tonumber) | tostring) + "x real-time"' "$RESULTS_FILE"
        
    fi
    
    echo ""
    print_info "Detailed results saved to: $RESULTS_FILE"
}

# Main execution
main() {
    print_header "Audio Transcription Response Time Testing"
    
    echo "This script tests audio transcription performance with files of different durations."
    echo "Gateway URL: $GATEWAY_URL"
    echo ""
    
    # Find available test files
    local test_files=($(find_test_files))
    
    if [ ${#test_files[@]} -eq 0 ]; then
        print_info "No audio files found for testing."
        create_duration_samples
        
        # Try to find files again after creation
        test_files=($(find_test_files))
        
        if [ ${#test_files[@]} -eq 0 ]; then
            print_error "No test files available. Please add audio files to test."
            return 1
        fi
    fi
    
    print_info "Found ${#test_files[@]} audio files for testing:"
    for file in "${test_files[@]}"; do
        local duration=$(get_audio_duration "$file")
        local size=$(get_file_size_mb "$file")
        echo "  - $(basename "$file") (${duration}s, ${size}MB)"
    done
    echo ""
    
    # Initialize results array
    echo "[]" > "$RESULTS_FILE"
    
    # Test each file
    print_header "Running Transcription Tests"
    
    local test_results=()
    local test_counter=1
    
    for file_path in "${test_files[@]}"; do
        echo ""
        print_info "Test $test_counter/${#test_files[@]}"
        
        local result=$(test_transcription_with_timing "$file_path" "test_$test_counter")
        test_results+=("$result")
        
        # Add result to JSON file
        if [ "$HAS_JQ" = "true" ]; then
            local temp_file=$(mktemp)
            jq ". += [$result]" "$RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$RESULTS_FILE"
        fi
        
        test_counter=$((test_counter + 1))
        
        # Small delay between tests
        sleep 1
    done
    
    echo ""
    
    # Analyze results
    analyze_performance
    
    print_header "Testing Complete"
    print_success "Response time testing completed!"
    print_info "Results saved to: $RESULTS_FILE"
    
    if [ "$HAS_JQ" = "false" ]; then
        echo ""
        print_info "Install jq for better analysis:"
        echo "• Linux: sudo apt-get install jq"
        echo "• macOS: brew install jq"
        echo "• Windows: Download from https://github.com/jqlang/jq/releases"
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi