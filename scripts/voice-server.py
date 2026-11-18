"""Breeze's speech server: turns a reply into sound with Kokoro.

Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M) is an open speech
model under the Apache licence. It runs here, on a computer we control, so
what Breeze says is never sent to an outside speech company.

    pip install "kokoro>=0.9.2" soundfile
    python scripts/voice-server.py            # listens on port 8790
    python scripts/voice-server.py --samples voice-samples   # writes one clip per voice and exits

The app finds it through EXPO_PUBLIC_VOICE_URL (http://10.0.2.2:8790 from the
Android emulator, http://<this computer's address>:8790 from a phone on the
same Wi-Fi). The first run downloads the model (about 330 MB) and each voice.

    POST /speak   {"text": "...", "voice": "bf_emma"}   ->  audio/wav
    GET  /health                                         ->  {"ok": true, "voices": [...]}
"""
import argparse
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf
from kokoro import KPipeline

RATE = 24000
MAX_CHARS = 1200
# keep in step with src/lib/voices.ts
VOICES = ['bf_emma', 'bf_isabella', 'bm_george', 'bm_fable', 'af_heart', 'af_bella', 'am_michael', 'am_puck']
SAMPLE = "Hi, I'm Breeze. Lunch is lemon garlic chicken today, then upper body at five. Ready when you are."

pipelines = {}
lock = threading.Lock()  # one sentence at a time: the model is not safe to run from two threads at once


def wav(text: str, voice: str) -> bytes:
    """The words spoken in the voice, as a WAV file."""
    lang = voice[0]  # 'a' American English, 'b' British English
    with lock:
        if lang not in pipelines:
            pipelines[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')
        parts = [np.asarray(audio) for _, _, audio in pipelines[lang](text, voice=voice, speed=1.0)]
    out = io.BytesIO()
    sf.write(out, np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32), RATE, format='WAV', subtype='PCM_16')
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def reply(self, status: int, body: bytes, kind: str):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def say(self, status: int, data: dict):
        self.reply(status, json.dumps(data).encode(), 'application/json')

    def do_GET(self):
        if self.path == '/health':
            return self.say(200, {'ok': True, 'voices': VOICES})
        self.say(404, {'error': 'not_found'})

    def do_POST(self):
        if self.path != '/speak':
            return self.say(404, {'error': 'not_found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 20000:
                return self.say(413, {'error': 'too_large'})
            body = json.loads(self.rfile.read(length))
            text = str(body.get('text', '')).strip()[:MAX_CHARS]
            voice = str(body.get('voice', ''))
        except (ValueError, json.JSONDecodeError):
            return self.say(400, {'error': 'invalid_request'})
        if not text or voice not in VOICES:
            return self.say(400, {'error': 'invalid_request'})
        try:
            self.reply(200, wav(text, voice), 'audio/wav')
        except Exception as e:  # the words are not logged, only what went wrong
            print('speak failed:', type(e).__name__, e)
            self.say(500, {'error': 'internal'})

    def log_message(self, fmt, *args):  # one short line a request, without the body
        print(self.address_string(), fmt % args)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8790)
    ap.add_argument('--samples', help='write one clip per voice into this folder and exit')
    args = ap.parse_args()
    if args.samples:
        import os
        os.makedirs(args.samples, exist_ok=True)
        for v in VOICES:
            path = os.path.join(args.samples, f'{v}.wav')
            open(path, 'wb').write(wav(SAMPLE, v))
            print('wrote', path)
    else:
        wav('Ready.', VOICES[0])  # load the model before the first request
        print(f'Breeze voice server on port {args.port}')
        ThreadingHTTPServer(('0.0.0.0', args.port), Handler).serve_forever()
