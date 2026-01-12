#!/bin/bash
# ============================================
# Faster-Whisper API Startup Script
# ============================================

set -e

WHISPER_MODEL="${WHISPER_MODEL:-base}"
WHISPER_DEVICE="${WHISPER_DEVICE:-cpu}"
WHISPER_COMPUTE_TYPE="${WHISPER_COMPUTE_TYPE:-int8}"
WHISPER_PORT="${WHISPER_PORT:-8000}"
WHISPER_CACHE_DIR="${WHISPER_CACHE_DIR:-/data/whisper/models}"

# Create cache directory
mkdir -p "$WHISPER_CACHE_DIR"

# Create the FastAPI whisper server script
cat > /tmp/whisper_server.py <<'WHISPER_SERVER_EOF'
"""
Faster-Whisper HTTP API Server
Compatible with OpenAI Whisper API format
"""

import os
import tempfile
import logging
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Claudia Whisper API",
    description="Speech-to-Text API using faster-whisper",
    version="1.0.0"
)

# Global model instance
whisper_model = None

def get_model():
    """Lazy load the whisper model."""
    global whisper_model
    if whisper_model is None:
        from faster_whisper import WhisperModel
        model_name = os.environ.get("WHISPER_MODEL", "base")
        device = os.environ.get("WHISPER_DEVICE", "cpu")
        compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
        cache_dir = os.environ.get("WHISPER_CACHE_DIR", "/data/whisper/models")

        logger.info(f"Loading Whisper model: {model_name} on {device} with {compute_type}")
        whisper_model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=cache_dir
        )
        logger.info("Whisper model loaded successfully!")
    return whisper_model

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "whisper"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Claudia Whisper API",
        "status": "running",
        "model": os.environ.get("WHISPER_MODEL", "base")
    }

@app.post("/v1/audio/transcriptions")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: Optional[str] = Form(default="whisper-1"),
    language: Optional[str] = Form(default=None),
    prompt: Optional[str] = Form(default=None),
    response_format: Optional[str] = Form(default="json"),
    temperature: Optional[float] = Form(default=0.0)
):
    """
    Transcribe audio to text.
    Compatible with OpenAI Whisper API format.
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # Get model and transcribe
            model_instance = get_model()

            transcribe_options = {
                "beam_size": 5,
                "temperature": temperature if temperature > 0 else [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
            }

            if language:
                transcribe_options["language"] = language
            if prompt:
                transcribe_options["initial_prompt"] = prompt

            segments, info = model_instance.transcribe(tmp_path, **transcribe_options)

            # Collect all segments
            text_segments = []
            full_segments = []
            for segment in segments:
                text_segments.append(segment.text)
                full_segments.append({
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip()
                })

            full_text = " ".join(text_segments).strip()

            if response_format == "text":
                return full_text
            elif response_format == "verbose_json":
                return JSONResponse({
                    "task": "transcribe",
                    "language": info.language,
                    "duration": info.duration,
                    "text": full_text,
                    "segments": full_segments
                })
            else:
                return JSONResponse({"text": full_text})

        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/audio/translations")
async def translate_audio(
    file: UploadFile = File(...),
    model: Optional[str] = Form(default="whisper-1"),
    prompt: Optional[str] = Form(default=None),
    response_format: Optional[str] = Form(default="json"),
    temperature: Optional[float] = Form(default=0.0)
):
    """
    Translate audio to English text.
    """
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            model_instance = get_model()

            transcribe_options = {
                "beam_size": 5,
                "task": "translate",
                "temperature": temperature if temperature > 0 else [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
            }

            if prompt:
                transcribe_options["initial_prompt"] = prompt

            segments, info = model_instance.transcribe(tmp_path, **transcribe_options)

            text_segments = [segment.text for segment in segments]
            full_text = " ".join(text_segments).strip()

            if response_format == "text":
                return full_text
            else:
                return JSONResponse({"text": full_text})

        finally:
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("WHISPER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
WHISPER_SERVER_EOF

# Activate virtual environment and start the server
export WHISPER_MODEL="$WHISPER_MODEL"
export WHISPER_DEVICE="$WHISPER_DEVICE"
export WHISPER_COMPUTE_TYPE="$WHISPER_COMPUTE_TYPE"
export WHISPER_CACHE_DIR="$WHISPER_CACHE_DIR"
export WHISPER_PORT="$WHISPER_PORT"

exec /opt/whisper-venv/bin/python /tmp/whisper_server.py
