#!/usr/bin/env python3
"""Deliver the reviewed message06 character edits; shared manifests stay untouched."""
from pathlib import Path
import json
from PIL import Image
from cinematic_asset_delivery import copy_approved_source, delivery_record, image_record

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/message06-character-consistency.json'


def main():
    spec = json.loads(SPEC.read_text())
    for shot in spec['shots']:
        source = ROOT / shot['source']
        destination = ROOT / shot['asset']
        if destination.parent != ROOT / 'game/public/assets/cut' or not destination.name.endswith('-message06.png'):
            raise ValueError(f'Unexpected message06 destination: {destination}')
        copy_approved_source(source, destination)
        shot['delivery'] = delivery_record(source, destination, ROOT)

    portrait = spec['portrait']
    source = ROOT / portrait['source']
    destination = ROOT / portrait['asset']
    if destination != ROOT / 'game/public/assets/portraits/grey-haired-message06.png':
        raise ValueError(f'Unexpected portrait destination: {destination}')
    with Image.open(source) as image:
        # The reviewed square crop is recorded in source coordinates. Nearest
        # sampling keeps the original drawn pixel clusters, without repainting.
        crop = image.crop(tuple(portrait['crop'])).convert('RGB')
        crop.resize((192, 192), Image.Resampling.NEAREST).save(destination)
    portrait['delivery'] = {'path': str(destination.relative_to(ROOT)), **image_record(destination),
                            'processing': 'reviewed source crop and nearest 192px resize'}
    SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'shots': len(spec['shots']), 'portrait': portrait['delivery']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
