# Realtime Transcription — Python example
#
# Mandatory vs Optional parameters:
# - Mandatory: session.update model, audio chunks, and commit (in manual VAD).
# - Optional: prompt, language, vad (manual/server_vad with tuning), include.raw_upstream.
#
# Requirements:
#   pip install websockets soundfile numpy (for basic WAV read)
# Usage:
#   python examples/python/realtime_transcription.py
# Env:
#   GATEWAY_WS_URL=ws://localhost:8080/v1/realtime/transcription
#   AUDIO_FILE=tests/audio-files/24KHz/11s.wav
#   MODEL=gpt-4o-mini-transcribe
#   VAD_TYPE=manual | server_vad
#   LANGUAGE=en

import asyncio
import json
import os
import soundfile as sf
import base64
import websockets

GATEWAY_WS_URL = os.getenv(
    "GATEWAY_WS_URL", "ws://localhost:8080/v1/realtime/transcription"
)
AUDIO_FILE = os.getenv("AUDIO_FILE", "tests/audio-files/24KHz/11s.wav")
MODEL = os.getenv("MODEL", "gpt-4o-mini-transcribe")
VAD_TYPE = os.getenv("VAD_TYPE", "manual")
LANGUAGE = os.getenv("LANGUAGE", "en")
CHUNK_MS = int(os.getenv("CHUNK_MS", "100"))


async def main():
    async with websockets.connect(GATEWAY_WS_URL) as ws:
        # Configure session
        await ws.send(
            json.dumps(
                {
                    "type": "session.update",
                    "data": {
                        "model": MODEL,
                        "prompt": "Only transcribe the user audio.",
                        "language": LANGUAGE,
                        "vad": (
                            {
                                "type": "server_vad",
                                "silence_duration_ms": 500,
                                "prefix_padding_ms": 300,
                            }
                            if VAD_TYPE == "server_vad"
                            else {"type": "manual"}
                        ),
                    },
                }
            )
        )

        # Load WAV
        pcm, sr = sf.read(AUDIO_FILE, dtype="int16")
        if pcm.ndim > 1:
            pcm = pcm[:, 0]  # take first channel
        pcm_bytes = pcm.tobytes()
        bytes_per_second = sr * 2
        chunk_bytes = max(1, (bytes_per_second * CHUNK_MS) // 1000)

        if VAD_TYPE == "manual":
            await ws.send(json.dumps({"type": "input_audio.activity_start"}))

        # Stream chunks
        for i in range(0, len(pcm_bytes), chunk_bytes):
            chunk = pcm_bytes[i : i + chunk_bytes]
            b64 = base64.b64encode(chunk).decode("ascii")
            await ws.send(json.dumps({"type": "input_audio.append", "audio": b64}))
            # Note: Python's websockets doesn't expose bufferedAmount; keep chunks small for stability
            await asyncio.sleep(0.0)

        if VAD_TYPE == "manual":
            await ws.send(json.dumps({"type": "input_audio.activity_end"}))
            await ws.send(json.dumps({"type": "input_audio.commit"}))
        else:
            await ws.send(json.dumps({"type": "input_audio.commit"}))

        # Receive transcript
        full = ""
        try:
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                if evt.get("type") == "transcript.delta":
                    text = evt.get("text") or (evt.get("data") or {}).get("text") or ""
                    full += text
                    print(text, end="", flush=True)
                elif evt.get("type") == "transcript.done":
                    text = evt.get("text") or (evt.get("data") or {}).get("text") or ""
                    if not full and text:
                        full = text
                    print("\nFinal:", full.strip())
                    break
                elif evt.get("type") in ("error", "warning", "rate_limits.updated"):
                    print("Event:", evt)
        except websockets.ConnectionClosed:
            pass


if __name__ == "__main__":
    asyncio.run(main())
