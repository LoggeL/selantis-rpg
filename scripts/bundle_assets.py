"""Bundle the assets of a verified public Selantis release, without source or code."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import zipfile
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/bundles'
BASE = 'https://selantis.logge.top/'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--commit', required=True, help='Expected public Git commit')
args = parser.parse_args()

def fetch(name):
    result = subprocess.run(['curl', '-fsS', '--max-time', '60', BASE + name], capture_output=True)
    if result.returncode:
        raise RuntimeError('Public download failed: ' + name)
    return result.stdout

release = json.loads(fetch('release.json'))
assert release.get('gitCommit') == args.commit, 'Public release has a different commit'
items = {name: sha for name, sha in release['files'].items()
         if name.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.mp3', '.ogg', '.wav'))
         or name == 'assets/manifest.json'}

def verified(item):
    name, sha = item
    assert '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('/')
    data = fetch(name)
    assert hashlib.sha256(data).hexdigest() == sha, 'Hash mismatch: ' + name
    return name, data

with ThreadPoolExecutor(max_workers=4) as pool:
    contents = dict(pool.map(verified, items.items()))
OUT.mkdir(parents=True, exist_ok=True)
archive = OUT / f"Selantis-Assets-{args.commit[:12]}.zip"
manifest = {'release': release['release'], 'gitCommit': args.commit, 'files': items,
            'source': BASE, 'assetCount': len(contents)}
readme = f'''Selantis: aktuell veröffentlichte Assets
Release: {release['release']}
Git-Commit: {args.commit}
Quelle: {BASE}
{len(contents)} Assets. Alle Dateien gegen die SHA-256-Werte des öffentlichen Release-Manifests geprüft.

assets/manifest.json beschreibt Sprite-Raster, Fußpunkte, Frames und Dateipfade.
output/imagegen enthält die beiden finalen Stilreferenzen.
output/audio enthält Räuberlied und vier Szenenstücke von Lyria 3.5.
Keine Originalfilme, PDFs, Rechercheframes, verworfenen Varianten oder Programmdateien.
'''
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name, data in sorted(contents.items()):
        bundle.writestr(name, data)
    bundle.writestr('README.txt', readme)
    bundle.writestr('asset-bundle.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for name, sha in items.items():
        assert hashlib.sha256(bundle.read(name)).hexdigest() == sha
print(json.dumps({'path': str(archive), 'assetCount': len(contents), 'bytes': archive.stat().st_size,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
