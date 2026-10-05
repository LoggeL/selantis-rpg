#!/usr/bin/env python3
"""Codex job runner shared by all generators.

run_jobs(jobs, area, parallel) calls scripts/art/codex_image.sh for every job (at most `parallel` at the same
time, 2 retries each, hard timeout) and records prompt + references + output in docs/rebuild/art/<area>.json.
A job is a dict: {"target": Path, "prompt": str, "refs": [Path], "kind": str, "id": str}.
"""
from __future__ import annotations

import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from lib import DOCS_ART, ROOT, load_json, rel, save_json

CODEX = ROOT / "scripts/art/codex_image.sh"
TIMEOUT = 420  # seconds per attempt
_lock = threading.Lock()


def record(area: str, job: dict, ok: bool, seconds: int, attempts: int) -> None:
    path = DOCS_ART / f"{area}.json"
    with _lock:
        data = load_json(path, {"area": area, "tool": "Codex CLI imagegen via scripts/art/codex_image.sh",
                                "images": {}})
        data.setdefault("images", {})[rel(job["target"])] = {
            "kind": job.get("kind", ""), "id": job.get("id", ""), "prompt": job["prompt"],
            "refs": [rel(r) for r in job.get("refs", [])], "ok": ok, "seconds": seconds, "attempts": attempts,
            "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        data["images"] = dict(sorted(data["images"].items()))
        save_json(path, data)


def run_one(job: dict, area: str, retries: int = 2) -> bool:
    target = Path(job["target"])
    target.parent.mkdir(parents=True, exist_ok=True)
    for r in job.get("refs", []):
        if not Path(r).is_file():
            print(f"FEHLER Referenz fehlt: {r}", flush=True)
            return False
    start = time.time()
    for attempt in range(1, retries + 2):
        try:
            proc = subprocess.run([str(CODEX), str(target), job["prompt"], *map(str, job.get("refs", []))],
                                  capture_output=True, text=True, timeout=TIMEOUT, stdin=subprocess.DEVNULL)
            ok = proc.returncode == 0 and target.is_file() and target.stat().st_size > 0
            err = proc.stderr.strip()[-300:]
        except subprocess.TimeoutExpired:
            ok, err = False, f"timeout after {TIMEOUT}s"
        if ok:
            secs = int(time.time() - start)
            record(area, job, True, secs, attempt)
            print(f"OK   {rel(target)} ({secs}s, Versuch {attempt})", flush=True)
            return True
        print(f"..   Versuch {attempt} fehlgeschlagen: {rel(target)}: {err}", flush=True)
    record(area, job, False, int(time.time() - start), retries + 1)
    print(f"FAIL {rel(target)}", flush=True)
    return False


def run_jobs(jobs: list[dict], area: str, parallel: int = 3) -> bool:
    if not jobs:
        return True
    parallel = max(1, min(3, parallel))
    print(f"{len(jobs)} Codex-Aufträge, {parallel} parallel …", flush=True)
    with ThreadPoolExecutor(max_workers=parallel) as pool:
        results = list(pool.map(lambda j: run_one(j, area), jobs))
    return all(results)


def parse_args(argv: list[str]) -> tuple[list[str], dict[str, str]]:
    """Splits argv into positional args and --key=value / --flag options."""
    opts: dict[str, str] = {}
    args: list[str] = []
    for a in argv:
        if a.startswith("--"):
            k, _, v = a[2:].partition("=")
            opts[k] = v if _ else "1"
        else:
            args.append(a)
    return args, opts


AREA_OF = {"characters": "characters", "props": "props", "bg": "backgrounds", "cut": "backgrounds", "icons": "icons"}


def sync_from_log() -> int:
    """Backfills docs/rebuild/art/<area>.json from output/imagegen/log.jsonl (written by codex_image.sh itself),
    e.g. for jobs whose Python orchestrator was interrupted. Only adds missing successful entries."""
    import json
    log = ROOT / "output/imagegen/log.jsonl"
    added = 0
    for line in log.read_text().splitlines() if log.is_file() else []:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        t = Path(e.get("target", ""))
        try:
            parts = t.resolve().relative_to(ROOT / "output/imagegen/raw/art").parts
        except ValueError:
            continue
        area = AREA_OF.get(parts[0])
        if not area or not e.get("ok") or not t.is_file():
            continue
        path = DOCS_ART / f"{area}.json"
        data = load_json(path, {"area": area, "images": {}})
        if rel(t) in data.setdefault("images", {}):
            continue
        data["images"][rel(t)] = {"kind": "", "id": parts[1] if len(parts) > 2 else "", "prompt": e["prompt"],
                                  "refs": [rel(r) for r in e.get("refs", [])], "ok": True,
                                  "seconds": e.get("seconds", 0), "attempts": 1, "time": e.get("time", ""),
                                  "note": "nachgetragen aus output/imagegen/log.jsonl"}
        data["images"] = dict(sorted(data["images"].items()))
        save_json(path, data)
        added += 1
    print(f"OK   {added} Einträge nachgetragen")
    return 0


if __name__ == "__main__":
    import sys
    raise SystemExit(sync_from_log() if sys.argv[1:2] == ["sync"] else print(__doc__) or 2)
