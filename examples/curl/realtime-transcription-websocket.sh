#!/usr/bin/env bash
# Realtime Transcription — shell example using websocat (curl cannot speak WebSocket)
#
# Prerequisites: websocat (https://github.com/vi/websocat)
#   macOS: brew install websocat
#   Linux: use package or download binary
#
# Mandatory vs Optional parameters:
# - Mandatory: session.update model; audio base64 frames; commit when using manual VAD.
# - Optional: language; vad={manual|server_vad,...}; include.raw_upstream.
#
# Usage:
#   GATEWAY_WS_URL=ws://localhost:8080/v1/realtime/transcription \
#   MODEL=gpt-4o-mini-transcribe \
#   WAV=tests/audio-files/24KHz/11s.wav \
#   ./examples/curl/realtime-transcription-websocket.sh
#
# Notes:
# - This script sends a single session.update, then streams Base64 PCM16 frames, then commits.
# - WAV must be PCM16 mono; resample externally if needed.

set -euo pipefail

: "${GATEWAY_WS_URL:=ws://localhost:8080/v1/realtime/transcription}"
: "${MODEL:=gpt-4o-mini-transcribe}"
: "${WAV:=tests/audio-files/24KHz/11s.wav}"
: "${LANGUAGE:=en}"
: "${CHUNK_MS:=100}"

# Extract PCM data from WAV (assumes little-endian PCM16 WAV)
# This awk/sed approach is simplistic; prefer Python/sox for robust parsing in production.
# Here we use Python to safely parse and base64-encode in chunks.

python - "$WAV" "$CHUNK_MS" << 'PY' | websocat - --text --no-close "$GATEWAY_WS_URL"
import sys, json, base64, soundfile as sf, time
wav = sys.argv[1]
chunk_ms = int(sys.argv[2])
pcm, sr = sf.read(wav, dtype='int16')
if pcm.ndim > 1:
    pcm = pcm[:,0]
bytes_per_second = sr * 2
chunk_bytes = max(1, (bytes_per_second * chunk_ms)//1000)
pcm_bytes = pcm.tobytes()

# 1) session.update (manual VAD here; adjust as needed)
print(json.dumps({
  'type': 'session.update',
  'data': { 'model': '${MODEL}', 'prompt': 'Only transcribe the user audio.', 'language': '${LANGUAGE}', 'vad': { 'type': 'manual' } }
}), flush=True)

# 2) activity_start
print(json.dumps({ 'type': 'input_audio.activity_start' }), flush=True)

# 3) stream chunks
for i in range(0, len(pcm_bytes), chunk_bytes):
    b64 = base64.b64encode(pcm_bytes[i:i+chunk_bytes]).decode('ascii')
    print(json.dumps({ 'type': 'input_audio.append', 'audio': b64 }), flush=True)
    time.sleep(0.0)

# 4) end+commit
print(json.dumps({ 'type': 'input_audio.activity_end' }), flush=True)
print(json.dumps({ 'type': 'input_audio.commit' }), flush=True)
PY
