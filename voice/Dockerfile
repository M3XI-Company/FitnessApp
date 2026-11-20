# Breeze's speech server (Kokoro-82M) as a container, for hosting.
# Built from the repository root:  docker build -f voice/Dockerfile .
FROM python:3.11-slim

# espeak-ng is what Kokoro falls back on for words its own dictionary does not have
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng libsndfile1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# the processor-only build of torch: a third of the size, and the server has no graphics card
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "kokoro>=0.9.2" soundfile

ENV HF_HOME=/app/models PYTHONUNBUFFERED=1
COPY scripts/voice-server.py /app/voice-server.py
# fetch the model and every voice while building, so starting up needs no download
RUN python voice-server.py --warm

EXPOSE 10000
CMD ["python", "voice-server.py"]
