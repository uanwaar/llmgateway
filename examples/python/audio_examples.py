"""
Python Audio Examples for LLM Gateway

This file demonstrates audio processing capabilities including:
- Audio transcription (speech-to-text)
- Audio translation (speech-to-text in English)
- Text-to-speech synthesis
- File format handling and validation
- Async audio processing
"""

import requests
import asyncio
import aiohttp
import aiofiles
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
import time


# Configuration
GATEWAY_BASE_URL = "http://localhost:8080/v1"
API_KEY = "your-api-key-here"  # Replace with your actual API key
EXAMPLES_DIR = Path(__file__).parent


# Example 1: Basic audio transcription
def basic_transcription():
    """Demonstrate basic audio transcription using requests."""
    print("=== Basic Audio Transcription ===")
    
    audio_file_path = EXAMPLES_DIR / "sample-audio.mp3"
    
    # Check if audio file exists
    if not audio_file_path.exists():
        print(f"Note: Audio file not found at {audio_file_path}")
        print("Please add a sample audio file to test transcription.")
        print("Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm\n")
        return
    
    url = f"{GATEWAY_BASE_URL}/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        with open(audio_file_path, 'rb') as audio_file:
            files = {
                'file': (audio_file_path.name, audio_file, 'audio/mpeg')
            }
            data = {
                'model': 'whisper-1',
                'language': 'en',  # Optional: specify language
                'response_format': 'json'  # json, text, srt, verbose_json, vtt
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            
            result = response.json()
            print("Transcription result:", result.get("text", "No text found"))
            
            if "segments" in result:
                print(f"Segments: {len(result['segments'])}")
                
    except requests.exceptions.RequestException as e:
        print(f"Transcription error: {e}")
    except FileNotFoundError:
        print(f"Audio file not found: {audio_file_path}")


# Example 2: Detailed transcription with verbose output
def detailed_transcription():
    """Demonstrate detailed transcription with verbose JSON output."""
    print("\n=== Detailed Audio Transcription ===")
    
    audio_file_path = EXAMPLES_DIR / "sample-audio.wav"
    
    if not audio_file_path.exists():
        print("Audio file not found, skipping detailed transcription example.")
        return
    
    url = f"{GATEWAY_BASE_URL}/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        with open(audio_file_path, 'rb') as audio_file:
            files = {
                'file': (audio_file_path.name, audio_file, 'audio/wav')
            }
            data = {
                'model': 'whisper-1',
                'prompt': 'This is a conversation about technology and AI.',  # Context prompt
                'response_format': 'verbose_json',  # Get detailed response
                'temperature': '0.2',  # Lower temperature for accuracy
                'language': 'en'
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            
            result = response.json()
            
            print("Full transcription:", result.get("text", ""))
            print("Language detected:", result.get("language", "unknown"))
            print("Duration:", result.get("duration", 0), "seconds")
            
            if "segments" in result:
                print("\nTimestamped segments:")
                for i, segment in enumerate(result["segments"][:5]):  # Show first 5 segments
                    start = segment.get("start", 0)
                    end = segment.get("end", 0)
                    text = segment.get("text", "")
                    print(f"{i+1}. [{start:.2f}s - {end:.2f}s]: {text}")
                    
    except requests.exceptions.RequestException as e:
        print(f"Detailed transcription error: {e}")
    except FileNotFoundError:
        print(f"Audio file not found: {audio_file_path}")


# Example 3: Audio translation (non-English to English)
def audio_translation():
    """Demonstrate audio translation to English."""
    print("\n=== Audio Translation ===")
    
    audio_file_path = EXAMPLES_DIR / "foreign-language-audio.mp3"
    
    if not audio_file_path.exists():
        print("Foreign language audio file not found, skipping translation example.")
        return
    
    url = f"{GATEWAY_BASE_URL}/audio/translations"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        with open(audio_file_path, 'rb') as audio_file:
            files = {
                'file': (audio_file_path.name, audio_file, 'audio/mpeg')
            }
            data = {
                'model': 'whisper-1',
                'response_format': 'json',
                'temperature': '0.0'  # Most accurate translation
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            
            result = response.json()
            print("Translated text (English):", result.get("text", ""))
            
    except requests.exceptions.RequestException as e:
        print(f"Translation error: {e}")
    except FileNotFoundError:
        print(f"Audio file not found: {audio_file_path}")


# Example 4: Text-to-speech synthesis
def text_to_speech():
    """Demonstrate text-to-speech synthesis."""
    print("\n=== Text-to-Speech Synthesis ===")
    
    text_to_speak = ("Hello! This is a demonstration of the text-to-speech functionality "
                    "in the LLM Gateway. The AI can convert this text into natural-sounding speech.")
    
    url = f"{GATEWAY_BASE_URL}/audio/speech"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "model": "tts-1",  # or 'tts-1-hd' for higher quality
        "input": text_to_speak,
        "voice": "alloy",  # alloy, echo, fable, onyx, nova, shimmer
        "response_format": "mp3",  # mp3, opus, aac, flac
        "speed": 1.0  # 0.25 to 4.0
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        # Save audio to file
        output_path = EXAMPLES_DIR / "generated-speech.mp3"
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        print(f"Speech generated and saved to: {output_path}")
        print(f"File size: {len(response.content)} bytes")
        
    except requests.exceptions.RequestException as e:
        print(f"Text-to-speech error: {e}")


# Example 5: Advanced TTS with different voices and settings
def advanced_tts():
    """Demonstrate advanced TTS with different voices and settings."""
    print("\n=== Advanced Text-to-Speech ===")
    
    voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    speeds = [0.75, 1.0, 1.25]
    formats = ["mp3", "opus", "aac"]
    
    sample_text = "The future of artificial intelligence is bright and full of possibilities."
    
    url = f"{GATEWAY_BASE_URL}/audio/speech"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # Test first 2 voices to save time and space
    for voice in voices[:2]:
        print(f"\nGenerating speech with voice: {voice}")
        
        payload = {
            "model": "tts-1-hd",
            "input": sample_text,
            "voice": voice,
            "response_format": "mp3",
            "speed": 1.0
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            output_path = EXAMPLES_DIR / f"speech-{voice}.mp3"
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            print(f"- Generated: {output_path} ({len(response.content)} bytes)")
            
        except requests.exceptions.RequestException as e:
            print(f"Error with voice {voice}: {e}")


# Example 6: Audio file validation
def validate_audio_file(file_path: Path) -> bool:
    """Validate audio file format and size."""
    print(f"\n=== Audio File Validation: {file_path.name} ===")
    
    if not file_path.exists():
        print(f"File does not exist: {file_path}")
        return False
    
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    max_size_mb = 25  # OpenAI's current limit
    
    print(f"File: {file_path.name}")
    print(f"Size: {file_size_mb:.2f} MB")
    
    if file_size_mb > max_size_mb:
        print(f"⚠️  File too large! Maximum size is {max_size_mb} MB")
        return False
    
    supported_extensions = {'.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'}
    extension = file_path.suffix.lower()
    
    if extension not in supported_extensions:
        print(f"⚠️  Unsupported format: {extension}")
        print(f"Supported formats: {', '.join(supported_extensions)}")
        return False
    
    print("✅ File validation passed")
    return True


# Example 7: Batch audio processing
def batch_audio_processing():
    """Process multiple audio files in batch."""
    print("\n=== Batch Audio Processing ===")
    
    audio_files = [
        EXAMPLES_DIR / "sample1.mp3",
        EXAMPLES_DIR / "sample2.wav",
        EXAMPLES_DIR / "sample3.m4a"
    ]
    
    results = []
    
    for audio_file in audio_files:
        if not audio_file.exists():
            print(f"Skipping {audio_file.name} - file not found")
            continue
        
        print(f"Processing {audio_file.name}...")
        
        url = f"{GATEWAY_BASE_URL}/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {API_KEY}"
        }
        
        try:
            with open(audio_file, 'rb') as f:
                files = {
                    'file': (audio_file.name, f, f'audio/{audio_file.suffix[1:]}')
                }
                data = {
                    'model': 'whisper-1',
                    'response_format': 'json'
                }
                
                response = requests.post(url, headers=headers, files=files, data=data)
                
                if response.status_code == 200:
                    result = response.json()
                    results.append({
                        "file": audio_file.name,
                        "text": result.get("text", ""),
                        "success": True
                    })
                    print(f"✅ {audio_file.name}: {result.get('text', '')[:50]}...")
                else:
                    results.append({
                        "file": audio_file.name,
                        "error": f"HTTP {response.status_code}",
                        "success": False
                    })
                    print(f"❌ {audio_file.name}: HTTP {response.status_code}")
                    
        except Exception as e:
            results.append({
                "file": audio_file.name,
                "error": str(e),
                "success": False
            })
            print(f"❌ {audio_file.name}: {e}")
    
    successful = [r for r in results if r.get("success", False)]
    print(f"\nBatch processing results: {len(successful)}/{len(results)} successful")
    
    return results


# Example 8: Async audio processing
async def async_audio_processing():
    """Demonstrate async audio processing."""
    print("\n=== Async Audio Processing ===")
    
    async def transcribe_async(session: aiohttp.ClientSession, file_path: Path) -> Dict[str, Any]:
        """Transcribe audio file asynchronously."""
        if not file_path.exists():
            return {"file": file_path.name, "error": "File not found", "success": False}
        
        url = f"{GATEWAY_BASE_URL}/audio/transcriptions"
        
        try:
            # Read file asynchronously
            async with aiofiles.open(file_path, 'rb') as f:
                file_content = await f.read()
            
            # Create form data
            data = aiohttp.FormData()
            data.add_field('file', file_content, filename=file_path.name, content_type=f'audio/{file_path.suffix[1:]}')
            data.add_field('model', 'whisper-1')
            data.add_field('response_format', 'json')
            
            headers = {
                "Authorization": f"Bearer {API_KEY}"
            }
            
            async with session.post(url, data=data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "file": file_path.name,
                        "text": result.get("text", ""),
                        "success": True
                    }
                else:
                    return {
                        "file": file_path.name,
                        "error": f"HTTP {response.status}",
                        "success": False
                    }
                    
        except Exception as e:
            return {
                "file": file_path.name,
                "error": str(e),
                "success": False
            }
    
    audio_files = [
        EXAMPLES_DIR / "sample1.mp3",
        EXAMPLES_DIR / "sample2.wav",
        EXAMPLES_DIR / "sample3.m4a"
    ]
    
    # Filter existing files
    existing_files = [f for f in audio_files if f.exists()]
    
    if not existing_files:
        print("No audio files found for async processing.")
        return
    
    async with aiohttp.ClientSession() as session:
        # Process files concurrently
        tasks = [transcribe_async(session, file_path) for file_path in existing_files]
        results = await asyncio.gather(*tasks)
        
        # Display results
        successful = [r for r in results if r["success"]]
        print(f"Async processing completed: {len(successful)}/{len(results)} successful")
        
        for result in results:
            if result["success"]:
                print(f"✅ {result['file']}: {result['text'][:50]}...")
            else:
                print(f"❌ {result['file']}: {result['error']}")


# Example 9: Audio processing with OpenAI SDK
def audio_with_openai_sdk():
    """Demonstrate audio processing using the OpenAI SDK."""
    print("\n=== Audio Processing with OpenAI SDK ===")
    
    try:
        from openai import OpenAI
        
        client = OpenAI(
            api_key=API_KEY,
            base_url=GATEWAY_BASE_URL
        )
        
        # Text-to-speech
        print("Generating speech with SDK...")
        speech_response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input="Hello from the OpenAI SDK through LLM Gateway!"
        )
        
        output_path = EXAMPLES_DIR / "sdk-generated-speech.mp3"
        with open(output_path, 'wb') as f:
            f.write(speech_response.content)
        
        print(f"SDK speech saved to: {output_path}")
        
        # Transcription (if audio file exists)
        audio_file = EXAMPLES_DIR / "sample-audio.mp3"
        if audio_file.exists():
            print("Transcribing with SDK...")
            with open(audio_file, 'rb') as f:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="text"
                )
            print("SDK transcription:", transcript)
        else:
            print("No audio file available for SDK transcription.")
            
    except ImportError:
        print("OpenAI SDK not installed. Install with: pip install openai")
    except Exception as e:
        print(f"SDK error: {e}")


# Example 10: Audio processing with error handling and retry
class RobustAudioClient:
    """Robust audio client with error handling and retry logic."""
    
    def __init__(self, api_key: str, base_url: str = GATEWAY_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}"
        })
    
    def transcribe_with_retry(
        self,
        file_path: Path,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ) -> Optional[Dict[str, Any]]:
        """Transcribe audio with retry logic."""
        
        for attempt in range(max_retries):
            try:
                print(f"Transcription attempt {attempt + 1}/{max_retries} for {file_path.name}")
                
                with open(file_path, 'rb') as audio_file:
                    files = {
                        'file': (file_path.name, audio_file, f'audio/{file_path.suffix[1:]}')
                    }
                    data = {
                        'model': 'whisper-1',
                        'response_format': 'json'
                    }
                    
                    response = self.session.post(
                        f"{self.base_url}/audio/transcriptions",
                        files=files,
                        data=data,
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        print(f"✅ Success on attempt {attempt + 1}")
                        return response.json()
                    elif response.status_code in [429, 500, 502, 503, 504]:
                        # Retryable errors
                        print(f"❌ Retryable error: HTTP {response.status_code}")
                        if attempt < max_retries - 1:
                            delay = backoff_factor * (2 ** attempt)
                            print(f"Retrying in {delay} seconds...")
                            time.sleep(delay)
                        continue
                    else:
                        print(f"❌ Non-retryable error: HTTP {response.status_code}")
                        return None
                        
            except Exception as e:
                print(f"❌ Error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    delay = backoff_factor * (2 ** attempt)
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                continue
        
        print("❌ All retry attempts failed")
        return None


def robust_audio_processing():
    """Demonstrate robust audio processing with error handling."""
    print("\n=== Robust Audio Processing ===")
    
    client = RobustAudioClient(API_KEY)
    
    # Test with a sample file (create a dummy one if it doesn't exist)
    test_file = EXAMPLES_DIR / "test-audio.mp3"
    
    if not test_file.exists():
        print(f"Creating placeholder for {test_file.name}")
        # In a real scenario, you would have actual audio files
        print("Please add actual audio files for testing.")
        return
    
    result = client.transcribe_with_retry(test_file)
    
    if result:
        print("Robust transcription result:", result.get("text", ""))
    else:
        print("Robust transcription failed after all retries.")


# Helper function to create sample audio file info
def create_sample_audio_info():
    """Display information about required sample audio files."""
    print("\n=== Sample Audio Files Information ===")
    print("To test these examples, please provide audio files in the examples/python/ directory:")
    print("- sample-audio.mp3 (for basic transcription)")
    print("- sample-audio.wav (for detailed transcription)")
    print("- foreign-language-audio.mp3 (for translation)")
    print("- sample1.mp3, sample2.wav, sample3.m4a (for batch processing)")
    print("\nSupported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm")
    print("Maximum file size: 25 MB")


def main():
    """Run all audio processing examples."""
    print("LLM Gateway Python Audio Processing Examples\n")
    print("These examples demonstrate audio transcription, translation, and TTS.")
    print("Make sure the LLM Gateway is running and configured with audio providers.\n")
    
    # Display sample file information
    create_sample_audio_info()
    
    # Validate sample files
    sample_files = [
        EXAMPLES_DIR / "sample-audio.mp3",
        EXAMPLES_DIR / "sample-audio.wav"
    ]
    
    for file_path in sample_files:
        validate_audio_file(file_path)
    
    # Run examples
    basic_transcription()
    detailed_transcription()
    audio_translation()
    text_to_speech()
    advanced_tts()
    batch_audio_processing()
    audio_with_openai_sdk()
    robust_audio_processing()
    
    # Run async example
    print("\nRunning async audio processing...")
    asyncio.run(async_audio_processing())
    
    print("\n=== All audio examples completed ===")


if __name__ == "__main__":
    main()


"""
Usage Instructions:

1. Install dependencies:
   pip install requests aiohttp aiofiles openai

2. Set up environment variables:
   export OPENAI_API_KEY="your-openai-key"
   export LLM_GATEWAY_API_KEY="your-gateway-key"

3. Prepare audio files:
   - Add sample audio files to the examples/python/ directory
   - Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
   - Maximum file size: 25 MB

4. Start the LLM Gateway:
   npm run dev

5. Run this example:
   python examples/python/audio_examples.py

Key Features Demonstrated:
- Audio transcription with Whisper models
- Audio translation to English
- Text-to-speech synthesis with multiple voices
- File format validation and size checking
- Batch audio processing (sync and async)
- Error handling and retry logic
- OpenAI SDK integration
- Advanced TTS options (voice, speed, format)
- Concurrent audio processing with async/await

Audio Processing Capabilities:
- Speech-to-text transcription
- Multi-language audio translation
- Text-to-speech with natural voices
- Timestamped transcription segments
- Batch processing for multiple files
- Format conversion and validation
- Real-time processing simulation

Expected Output:
- Transcribed text from audio files
- Generated speech audio files
- Processing statistics and validation results
- Batch processing summaries
- Error handling demonstrations
"""