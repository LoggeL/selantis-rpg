"""Verify the exact public release, static assets, health and audio range support."""
import concurrent.futures
import argparse
import hashlib
import json
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "output/deployment"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--commit', help='Require this deployed Git commit (GitHub deployment).')
args = parser.parse_args()
base = "https://selantis.logge.top"


def fetch(path, extra=()):
    result = subprocess.run(
        ["curl", "-sS", "--max-time", "30", *extra, "-w", "\n%{http_code}\n%{content_type}", base + path],
        capture_output=True,
    )
    body, status, mime = result.stdout.rsplit(b"\n", 2)
    if result.returncode:
        raise RuntimeError("Download failed: " + path)
    return body, int(status), mime.decode()


def verify_file(item):
    name, digest = item
    body, status, mime = fetch("/" + urllib.parse.quote(name, safe="/"))
    assert status == 200, (name, status)
    assert hashlib.sha256(body).hexdigest() == digest, "Hash mismatch: " + name
    if name.endswith(".js"):
        assert "javascript" in mime, (name, mime)
    elif name.endswith(".png"):
        assert mime.startswith("image/png"), (name, mime)
    elif name.endswith(".mp3"):
        assert mime.startswith("audio/"), (name, mime)
    return {"file": name, "bytes": len(body), "mime": mime, "sha256": digest}


body, status, _ = fetch("/release.json")
assert status == 200, ("release.json", status)
public = json.loads(body)
if args.commit:
    assert public.get('gitCommit') == args.commit, 'Public Git commit differs from the pushed commit'
    expected = public
else:
    expected = json.loads((OUT / "release.json").read_text())
    assert public == expected, "Public manifest differs from the prepared release"
health, health_status, _ = fetch("/healthz")
assert health_status == 200 and health.strip() == b"ok", "Health endpoint failed"
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    verified = list(pool.map(verify_file, expected["files"].items()))
_, missing_status, _ = fetch("/assets/missing-selantis-verification.png")
assert missing_status == 404, "Missing asset must return 404"
_, source_status, _ = fetch("/sources/novel/source.pdf")
assert source_status == 404, "Manuscript must not be served"
audio, range_status, audio_mime = fetch("/output/audio/rauberlied-lyria-3-5.mp3", ["--range", "0-1023"])
assert range_status == 206 and len(audio) == 1024, "Audio range requests failed"
report = {"release": expected["release"], "url": base, "health": health_status,
          "files": verified, "missingAsset": missing_status, "manuscript": source_status,
          "audioRange": {"status": range_status, "bytes": len(audio), "mime": audio_mime}}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"release": expected["release"], "verifiedFiles": len(verified),
                  "health": health_status, "audioRange": range_status, "missingAsset": missing_status}))
