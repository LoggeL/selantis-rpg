"""Deliver reviewed PNG sources without changing pixels, composition or encoding."""
from pathlib import Path
import hashlib
import shutil
from PIL import Image


def image_record(path: Path):
    with Image.open(path) as image:
        image.load()
        return {'width': image.width, 'height': image.height, 'mode': image.mode,
                'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def copy_approved_source(source: Path, destination: Path, alpha=False):
    with Image.open(source) as image:
        image.load()
        if abs(image.height - image.width * 9 / 16) > 1:
            raise ValueError(f'{source}: approved cinematic source must be near 16:9 within one pixel; got {image.size}')
        if alpha and 'A' not in image.getbands() and 'transparency' not in image.info:
            raise ValueError(f'{source}: approved source has no alpha channel to preserve')
        result = image.copy()
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != destination.resolve():
        shutil.copyfile(source, destination)
    return result


def delivery_record(source: Path, destination: Path, root: Path):
    source, destination, root = source.resolve(), destination.resolve(), root.resolve()
    result = image_record(destination)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if source_hash != result['sha256']:
        raise ValueError(f'{destination}: delivery differs from approved source {source}')
    return {'path': str(destination.relative_to(root)), **result,
            'sourcePath': str(source.relative_to(root)), 'sourceSha256': source_hash,
            'processing': 'byte-exact approved source passthrough'}
