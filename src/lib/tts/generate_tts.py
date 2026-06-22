import sys
import os
import json
import wave
import struct
import urllib.request

# URLs for models and voices
EN_ONNX_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
EN_VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

DE_ONNX_URL = "https://huggingface.co/Godelaune/Kokoro-82M-ONNX-German-Martin/resolve/main/kokoro-martin.onnx"
DE_VOICES_URL = "https://huggingface.co/Godelaune/Kokoro-82M-ONNX-German-Martin/resolve/main/voices-martin.npz"

def download_file(url, dest):
    if os.path.exists(dest):
        return
    print(f"Downloading {url} to {dest}...", file=sys.stderr)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    
    # Custom headers to avoid blockings
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
        while True:
            chunk = response.read(1024 * 1024) # 1MB chunk
            if not chunk:
                break
            out_file.write(chunk)
    print(f"Downloaded {dest} successfully.", file=sys.stderr)

def main():
    try:
        payload = json.loads(sys.stdin.read())
        text = payload.get("text", "").strip()
        lang = payload.get("lang", "en-us") # "en-us" or "de"
        output_file = payload.get("output_file", "")

        if lang == "de":
            import re
            # E.g. "Verdächtiger / Verdächtige" -> "Verdächtiger" (take first option)
            if "/" in text:
                text = text.split("/")[0].strip()
            # Remove any parenthesized notes (e.g. "(Geld)", "(pl.)", etc.)
            text = re.sub(r'\([^)]*\)', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
        else:
            import re
            # E.g. "(to) notice" -> "to notice"
            text = re.sub(r'\((to)\)\s*', r'\1 ', text)
            # Remove any other parenthesized notes (e.g. "(sb.)", "(sth.)")
            text = re.sub(r'\([^)]*\)', '', text)
            text = re.sub(r'\s+', ' ', text).strip()

        if not text:
            print(json.dumps({"success": False, "error": "empty text"}))
            sys.exit(1)

        if not output_file:
            print(json.dumps({"success": False, "error": "empty output_file"}))
            sys.exit(1)

        # Make sure output directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Ensure kokoro-onnx is imported
        from kokoro_onnx import Kokoro

        tts_dir = os.path.join(os.getcwd(), "content", "tts")
        os.makedirs(tts_dir, exist_ok=True)

        if lang == "de":
            onnx_path = os.path.join(tts_dir, "kokoro-martin.onnx")
            voices_path = os.path.join(tts_dir, "voices-martin.npz")
            
            download_file(DE_ONNX_URL, onnx_path)
            download_file(DE_VOICES_URL, voices_path)
            
            kokoro = Kokoro(onnx_path, voices_path)
            
            # Find the voice key in npz
            import numpy as np
            voices = np.load(voices_path)
            voice_name = "martin" if "martin" in voices else list(voices.keys())[0]
            
            samples, sample_rate = kokoro.create(
                text,
                voice=voice_name,
                speed=1.0,
                lang="de"
            )
        else: # Default English
            onnx_path = os.path.join(tts_dir, "kokoro-v1.0.onnx")
            voices_path = os.path.join(tts_dir, "voices-v1.0.bin")
            
            download_file(EN_ONNX_URL, onnx_path)
            download_file(EN_VOICES_URL, voices_path)
            
            kokoro = Kokoro(onnx_path, voices_path)
            
            samples, sample_rate = kokoro.create(
                text,
                voice="bf_emma",
                speed=1.0,
                lang="en-gb"
            )

        # Save float32 samples to 16-bit PCM WAV
        int_samples = [max(-32768, min(32767, int(s * 32767))) for s in samples]
        pcm_data = struct.pack(f"{len(int_samples)}h", *int_samples)

        with wave.open(output_file, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)

        print(json.dumps({"success": True, "filepath": output_file}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
