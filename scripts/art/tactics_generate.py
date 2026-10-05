#!/usr/bin/env python3
"""Generates the tactics art package through the Codex CLI wrapper (scripts/art/codex_image.sh).

Usage: tactics_generate.py [--jobs 2] [--force] [--suffix -v2] [ids...]
ids: texture ids (grass, dirt, ...), prop ids (iso-tree, ...), backdrop ids prefixed with 'sky-' (sky-dusk ...).
Raw images go to output/imagegen/raw/tactics/<kind>-<id><suffix>.png. Each job has a timeout and up to 2 retries.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from tactics_prompts import (BACKDROPS, PROPS, RAW, ROOT, TEXTURES, backdrop_prompt, prop_prompt,
                             texture_prompt)

WRAPPER = ROOT / "scripts/art/codex_image.sh"
TIMEOUT = 420


def jobs_for(ids: list[str], suffix: str) -> list[tuple[str, str, list[str]]]:
    out = []
    for i in ids:
        if i in TEXTURES:
            out.append((str(RAW / f"tex-{i}{suffix}.png"), texture_prompt(i), TEXTURES[i][1]))
        elif i in PROPS:
            out.append((str(RAW / f"prop-{i}{suffix}.png"), prop_prompt(i), PROPS[i][1]))
        elif i.startswith("sky-") and i[4:] in BACKDROPS:
            b = i[4:]
            out.append((str(RAW / f"sky-{b}{suffix}.png"), backdrop_prompt(b), BACKDROPS[b][1]))
        else:
            print(f"unknown id {i}", file=sys.stderr)
    return out


def run(job: tuple[str, str, list[str]], force: bool) -> tuple[str, bool]:
    target, prompt, refs = job
    from pathlib import Path
    if Path(target).exists() and not force:
        return target, True
    for attempt in range(3):
        t0 = time.time()
        try:
            r = subprocess.run([str(WRAPPER), target, prompt, *refs], stdin=subprocess.DEVNULL,
                               capture_output=True, text=True, timeout=TIMEOUT)
            ok = r.returncode == 0 and Path(target).exists()
        except subprocess.TimeoutExpired:
            ok = False
        print(f"[{'ok' if ok else 'FAIL'}] {Path(target).name} attempt {attempt + 1} ({time.time() - t0:.0f}s)", flush=True)
        if ok:
            return target, True
    return target, False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=2)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--suffix", default="")
    ap.add_argument("ids", nargs="*")
    a = ap.parse_args()
    ids = a.ids or [*TEXTURES, *PROPS, *(f"sky-{b}" for b in BACKDROPS)]
    RAW.mkdir(parents=True, exist_ok=True)
    jobs = jobs_for(ids, a.suffix)
    with ThreadPoolExecutor(max_workers=min(2, a.jobs)) as ex:
        results = list(ex.map(lambda j: run(j, a.force), jobs))
    # Prompt record (merged into docs/rebuild/art/tactics.json by tactics_build.py).
    rec_path = RAW / "prompts.json"
    rec = json.loads(rec_path.read_text()) if rec_path.exists() else {}
    for (target, prompt, refs), (_, ok) in zip(jobs, results):
        rec[target.split("/")[-1]] = {"prompt": prompt, "refs": [r.split("/")[-1] for r in refs], "ok": ok}
    rec_path.write_text(json.dumps(rec, indent=2, ensure_ascii=False))
    failed = [t for t, ok in results if not ok]
    print("failed:", failed if failed else "none")


if __name__ == "__main__":
    main()
