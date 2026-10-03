#!/usr/bin/env python3
"""Local German ASR with timestamped, resumable output and uncertainty flags.

Run with .venv-transcribe/bin/python scripts/transcribe.py VIDEO [...].
Requires ffmpeg and mlx-whisper. No audio is sent to a remote ASR service.
"""
import argparse
from collections import Counter
import html
import json
from pathlib import Path
import re
import subprocess
import time


MODEL = "mlx-community/whisper-large-v3-turbo"
ROOT = Path(__file__).resolve().parents[1]
LOCAL_MODEL = ROOT / ".venv-transcribe" / "models" / "whisper-large-v3-turbo"


def stamp(seconds):
    seconds = int(seconds)
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def review_flags(segment, previous):
    text = segment["text"].strip()
    normalized = re.sub(r"\W+", " ", text.lower()).strip()
    flags = []
    if normalized and normalized == previous:
        flags.append("adjacent_repeated_text")
    words = normalized.split()
    grams = [tuple(words[i:i + 4]) for i in range(len(words) - 3)]
    if grams and max(Counter(grams).values()) >= 3:
        flags.append("repeated_phrase")
    if segment.get("compression_ratio", 0) > 2.4:
        flags.append("high_compression_ratio")
    if segment.get("avg_logprob", 0) < -1:
        flags.append("low_model_confidence")
    if segment.get("no_speech_prob", 0) > 0.6:
        flags.append("possible_non_speech")
    if segment["end"] - segment["start"] >= 20 and len(words) <= 12:
        flags.append("sparse_text_long_segment_possible_music_hallucination")
    if re.search(r"untertitel(?:ung)?|amara\.org|zdf", text, re.IGNORECASE):
        flags.append("possible_subtitle_stock_phrase_hallucination")
    return flags, normalized


def save_outputs(video, segments, duration, elapsed, complete, chunks_done):
    destination = ROOT / "sources" / "transcripts"
    destination.mkdir(parents=True, exist_ok=True)
    previous = ""
    previous_end = 0
    for index, segment in enumerate(segments):
        segment["id"] = index
        segment["review_flags"], previous = review_flags(segment, previous)
        if segment["start"] < previous_end - 0.2:
            segment["review_flags"].append("overlapping_asr_windows_possible_boundary_repeat")
        previous_end = segment["end"]
    data = {
        "source_video": str(video.relative_to(ROOT)),
        "source_url": f"https://www.youtube.com/watch?v={video.stem.split('-', 1)[1]}",
        "method": "local mlx-whisper ASR",
        "model": MODEL,
        "model_origin": "Cached OpenAI large-v3-turbo.pt converted locally using Apple's mlx-examples/whisper/convert.py" if LOCAL_MODEL.exists() else "Hugging Face MLX Community model download",
        "language": "de",
        "review_status": "Automatic transcript, not manually reviewed. Proper names and uncertain passages may be inaccurate. Flags are heuristics, not proof of hallucination.",
        "complete": complete,
        "duration_seconds": duration,
        "asr_elapsed_seconds": round(elapsed, 2),
        "chunks_done": chunks_done,
        "condition_on_previous_text": False,
        "segments": segments,
        "text": " ".join(s["text"].strip() for s in segments),
    }
    json_path = destination / f"{video.stem}.json"
    temporary = json_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(json_path)
    lines = [
        f"Quelle: {data['source_url']}",
        "Automatisches deutsches ASR-Transkript, nicht manuell geprüft.",
        "Eigennamen und unsichere Passagen können fehlerhaft sein. [PRÜFEN] kennzeichnet heuristische Auffälligkeiten.",
        f"Status: {'vollständig' if complete else 'in Bearbeitung'} | Modell: {MODEL}",
        "",
    ]
    for segment in segments:
        flag = " [PRÜFEN: " + ", ".join(segment["review_flags"]) + "]" if segment["review_flags"] else ""
        lines.append(f"[{stamp(segment['start'])} bis {stamp(segment['end'])}]{flag} {segment['text'].strip()}")
    (destination / f"{video.stem}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def transcribe(video, chunk_seconds):
    import mlx_whisper
    import numpy as np
    import wave

    video = video.resolve()
    audio = ROOT / "sources" / "audio" / f"{video.stem}.wav"
    audio.parent.mkdir(parents=True, exist_ok=True)
    if not audio.exists():
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio)], check=True)
    with wave.open(str(audio)) as handle:
        assert handle.getnchannels() == 1 and handle.getframerate() == 16000 and handle.getsampwidth() == 2
        waveform = np.frombuffer(handle.readframes(handle.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    duration = len(waveform) / 16000
    output = ROOT / "sources" / "transcripts" / f"{video.stem}.json"
    segments, chunks_done = [], 0
    if output.exists():
        previous = json.loads(output.read_text())
        if previous.get("complete"):
            print(f"Already complete: {video.name}", flush=True)
            return
        segments = previous["segments"]
        chunks_done = previous["chunks_done"]
    started = time.monotonic()
    total_chunks = int(np.ceil(duration / chunk_seconds))
    # Two seconds of shared context on both sides; keep each segment in its
    # midpoint's core interval so overlaps do not duplicate the full transcript.
    for chunk in range(chunks_done, total_chunks):
        core_start = chunk * chunk_seconds
        core_end = min(duration, core_start + chunk_seconds)
        start = max(0, core_start - 2)
        end = min(duration, core_end + 2)
        result = mlx_whisper.transcribe(
            waveform[int(start * 16000):int(end * 16000)],
            path_or_hf_repo=str(LOCAL_MODEL) if LOCAL_MODEL.exists() else MODEL,
            language="de", task="transcribe", verbose=False,
            condition_on_previous_text=False,
            temperature=(0.0, 0.2, 0.4),
        )
        for segment in result["segments"]:
            segment["start"] += start
            segment["end"] += start
            midpoint = (segment["start"] + segment["end"]) / 2
            if core_start <= midpoint < core_end:
                segments.append(segment)
        chunks_done = chunk + 1
        elapsed = time.monotonic() - started
        complete = chunks_done == total_chunks
        save_outputs(video, segments, duration, elapsed, complete, chunks_done)
        print(f"{video.name}: {chunks_done}/{total_chunks} chunks; {core_end:.0f}/{duration:.0f}s audio; {elapsed:.1f}s ASR elapsed", flush=True)


def convert_vtt(source):
    """Remove YouTube's rolling cue repetitions, retaining all new caption text."""
    source = source.resolve()
    def seconds(value):
        hours, minutes, seconds_ = value.split(":")
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds_)

    segments, history = [], []
    # A line containing one space is a YouTube display placeholder, not a
    # separator. Only truly empty lines delimit WebVTT cues.
    for block in re.split(r"\n{2,}", source.read_text(encoding="utf-8")):
        lines = block.splitlines()
        timing_index = next((i for i, line in enumerate(lines) if " --> " in line), None)
        if timing_index is None:
            continue
        timing = lines[timing_index].split()
        start, end = seconds(timing[0]), seconds(timing[2])
        cue_lines = [line.strip() for line in lines[timing_index + 1:] if line.strip()]
        # Timed lines are the new content; the other displayed line is rolling context.
        new_lines = [line for line in cue_lines if re.search(r"<\d\d:\d\d:\d\d\.\d+>", line)]
        candidate = " ".join(new_lines or cue_lines)
        words = html.unescape(re.sub(r"<[^>]+>", "", candidate)).split()
        overlap = 0
        if not new_lines:
            for size in range(min(len(history), len(words)), 0, -1):
                if history[-size:] == words[:size]:
                    overlap = size
                    break
        words = words[overlap:]
        if not words:
            continue
        history = (history + words)[-80:]
        segments.append({"id": len(segments), "start": start, "end": end, "text": " ".join(words), "review_flags": []})
    destination = ROOT / "sources" / "transcripts"
    destination.mkdir(parents=True, exist_ok=True)
    stem = source.name.split(".de")[0]
    data = {
        "source_url": f"https://www.youtube.com/watch?v={stem.split('-', 1)[1]}",
        "source_captions": str(source.relative_to(ROOT)),
        "method": "YouTube automatic German captions, rolling cues deduplicated",
        "language": "de", "complete": True,
        "review_status": "Automatic captions, not manually reviewed. Names, timing and wording may be inaccurate.",
        "segments": segments,
        "text": " ".join(s["text"] for s in segments),
    }
    (destination / f"{stem}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [f"Quelle: {data['source_url']}", "Automatische deutsche YouTube-Untertitel, rollende Wiederholungen entfernt, nicht manuell geprüft.", "Eigennamen, Zeitmarken und Formulierungen können fehlerhaft sein.", ""]
    lines.extend(f"[{stamp(s['start'])} bis {stamp(s['end'])}] {s['text']}" for s in segments)
    (destination / f"{stem}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Converted {source.name}: {len(segments)} deduplicated cues", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("videos", nargs="+", type=Path)
    parser.add_argument("--chunk-seconds", type=int, default=300)
    args = parser.parse_args()
    for video in args.videos:
        if video.suffix == ".vtt":
            convert_vtt(video)
        else:
            transcribe(video, args.chunk_seconds)


if __name__ == "__main__":
    main()
