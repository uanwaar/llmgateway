#!/bin/bash

# cURL Models Listing Examples for LLM Gateway
# Works on Linux/macOS and Windows Git Bash/WSL.

GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"  # Optional if the gateway uses provider keys from .env

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "${BLUE}=== $1 ===${NC}"; }
print_ok() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

HAS_JQ=false
if command -v jq >/dev/null 2>&1; then HAS_JQ=true; fi
fmt() { if $HAS_JQ; then echo "$1" | jq '.'; else echo "$1"; fi }

print_header "LLM Gateway: /v1/models examples"
print_info "Gateway URL: $GATEWAY_URL"

# 1) List all models
print_header "1) All models"
RES=$(curl -s -X GET "$GATEWAY_URL/models" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 2) Realtime models (capability or configured in default.yaml realtime.models)
print_header "2) Realtime models (query param)"
RES=$(curl -s -X GET "$GATEWAY_URL/models?realtime=true" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

print_header "2b) Realtime models (capability route)"
RES=$(curl -s -X GET "$GATEWAY_URL/models/capability/realtime" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 3) Chat/completion models (synonym: chat -> completion)
print_header "3) Chat models"
RES=$(curl -s -X GET "$GATEWAY_URL/models?capability=chat" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 4) Speech-to-text / transcription (synonyms: stt, asr, transcribe)
print_header "4) STT / transcription models"
RES=$(curl -s -X GET "$GATEWAY_URL/models?capability=stt" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 5) Text-to-speech models
print_header "5) TTS models"
RES=$(curl -s -X GET "$GATEWAY_URL/models?capability=tts" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 6) Combine filters: provider + type
print_header "6) Provider=openai|gemini AND type=transcription"
RES=$(curl -s -X GET "$GATEWAY_URL/models?provider=openai,gemini&type=transcription" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 7) Search by id substring
print_header "7) Search for 'realtime' in id"
RES=$(curl -s -X GET "$GATEWAY_URL/models?search=realtime" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

# 8) Fetch single model
TARGET_MODEL="gpt-4o-mini"
print_header "8) Single model: $TARGET_MODEL"
RES=$(curl -s -X GET "$GATEWAY_URL/models/$TARGET_MODEL" \
  -H "Authorization: Bearer $API_KEY")
fmt "$RES"

print_ok "Done"
