#!/bin/bash
# Comprehensive health check script for LLM Gateway

set -e

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-30}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Health check results
declare -A health_results

# Basic health check
check_basic_health() {
    log_info "Checking basic health endpoint..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/health" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["basic_health"]="PASS"
        log_success "Basic health check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            log_verbose "Response: $body"
        fi
    else
        health_results["basic_health"]="FAIL"
        log_error "Basic health check failed (HTTP $http_code)"
    fi
}

# Readiness check
check_readiness() {
    log_info "Checking readiness endpoint..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/health/ready" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["readiness"]="PASS"
        log_success "Readiness check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            log_verbose "Response: $body"
        fi
    else
        health_results["readiness"]="FAIL"
        log_error "Readiness check failed (HTTP $http_code)"
    fi
}

# Provider health check
check_providers() {
    log_info "Checking provider health..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/health/providers" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["providers"]="PASS"
        log_success "Provider health check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            log_verbose "Response: $body"
        fi
    else
        health_results["providers"]="FAIL"
        log_error "Provider health check failed (HTTP $http_code)"
    fi
}

# Cache health check
check_cache() {
    log_info "Checking cache health..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/health/cache" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["cache"]="PASS"
        log_success "Cache health check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            log_verbose "Response: $body"
        fi
    else
        health_results["cache"]="FAIL"
        log_warning "Cache health check failed (HTTP $http_code) - Cache may be disabled"
    fi
}

# Models endpoint check
check_models() {
    log_info "Checking models endpoint..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/v1/models" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["models"]="PASS"
        log_success "Models endpoint check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            local model_count=$(echo "$body" | grep -o '"id"' | wc -l)
            log_verbose "Found $model_count models"
        fi
    else
        health_results["models"]="FAIL"
        log_error "Models endpoint check failed (HTTP $http_code)"
    fi
}

# Response time check
check_response_time() {
    log_info "Checking response time..."
    
    local start_time
    local end_time
    local response_time
    
    start_time=$(date +%s%3N)
    curl -s --max-time "$TIMEOUT" "$GATEWAY_URL/health" > /dev/null || true
    end_time=$(date +%s%3N)
    
    response_time=$((end_time - start_time))
    
    if [ "$response_time" -lt 1000 ]; then
        health_results["response_time"]="PASS"
        log_success "Response time check passed (${response_time}ms)"
    elif [ "$response_time" -lt 5000 ]; then
        health_results["response_time"]="WARN"
        log_warning "Response time is slow (${response_time}ms)"
    else
        health_results["response_time"]="FAIL"
        log_error "Response time is too slow (${response_time}ms)"
    fi
}

# Metrics endpoint check
check_metrics() {
    log_info "Checking metrics endpoint..."
    
    local response
    local http_code
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$GATEWAY_URL/metrics" || echo "000")
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        health_results["metrics"]="PASS"
        log_success "Metrics endpoint check passed"
        
        if [ "$VERBOSE" = "true" ]; then
            local body="${response%???}"
            local metric_count=$(echo "$body" | grep -c "^# HELP" || echo "0")
            log_verbose "Found $metric_count metrics"
        fi
    else
        health_results["metrics"]="FAIL"
        log_warning "Metrics endpoint check failed (HTTP $http_code) - Metrics may be disabled"
    fi
}

# Simple chat completion test
test_chat_completion() {
    log_info "Testing chat completion endpoint..."
    
    local response
    local http_code
    local test_payload
    
    test_payload='{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Say hello"}
        ],
        "max_tokens": 10
    }'
    
    response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d "$test_payload" \
        "$GATEWAY_URL/v1/chat/completions" || echo "000")
    
    http_code="${response: -3}"
    
    # Note: This will likely fail without valid API keys, but we can check if the endpoint is reachable
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "429" ]; then
        health_results["chat_completion"]="PASS"
        log_success "Chat completion endpoint is reachable (HTTP $http_code)"
    else
        health_results["chat_completion"]="FAIL"
        log_error "Chat completion endpoint check failed (HTTP $http_code)"
    fi
}

# Generate summary report
generate_report() {
    echo
    log_info "=== Health Check Summary ==="
    echo
    
    local total_checks=0
    local passed_checks=0
    local warned_checks=0
    local failed_checks=0
    
    for check in "${!health_results[@]}"; do
        local result="${health_results[$check]}"
        local status_color=""
        
        case "$result" in
            "PASS")
                status_color="$GREEN"
                ((passed_checks++))
                ;;
            "WARN")
                status_color="$YELLOW"
                ((warned_checks++))
                ;;
            "FAIL")
                status_color="$RED"
                ((failed_checks++))
                ;;
        esac
        
        printf "%-20s: %b%s%b\n" "$check" "$status_color" "$result" "$NC"
        ((total_checks++))
    done
    
    echo
    log_info "Total checks: $total_checks"
    log_success "Passed: $passed_checks"
    if [ "$warned_checks" -gt 0 ]; then
        log_warning "Warnings: $warned_checks"
    fi
    if [ "$failed_checks" -gt 0 ]; then
        log_error "Failed: $failed_checks"
    fi
    
    echo
    if [ "$failed_checks" -eq 0 ]; then
        log_success "Overall status: HEALTHY"
        return 0
    else
        log_error "Overall status: UNHEALTHY"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting health check for LLM Gateway"
    log_info "Target URL: $GATEWAY_URL"
    log_info "Timeout: ${TIMEOUT}s"
    echo
    
    # Run all health checks
    check_basic_health
    check_readiness
    check_providers
    check_cache
    check_models
    check_response_time
    check_metrics
    test_chat_completion
    
    # Generate and display report
    generate_report
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            GATEWAY_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --basic)
            check_basic_health
            exit $?
            ;;
        --ready)
            check_readiness
            exit $?
            ;;
        --providers)
            check_providers
            exit $?
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --url URL           Gateway URL (default: http://localhost:8080)"
            echo "  --timeout SECONDS   Request timeout (default: 30)"
            echo "  --verbose           Enable verbose output"
            echo "  --basic             Check basic health only"
            echo "  --ready             Check readiness only"
            echo "  --providers         Check providers only"
            echo "  --help              Show this help message"
            echo
            echo "Environment variables:"
            echo "  GATEWAY_URL         Override default gateway URL"
            echo "  TIMEOUT             Override default timeout"
            echo "  VERBOSE             Enable verbose output (true/false)"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main