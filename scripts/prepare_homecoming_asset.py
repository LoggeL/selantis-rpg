"""Stage the approved sister close-up unchanged at its original resolution."""
from pathlib import Path
import json
from cinematic_asset_delivery import copy_approved_source, delivery_record

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-kyra.json'

def main():
    spec = json.loads(SPEC.read_text())
    source = ROOT / spec['source']
    destination = ROOT / spec['delivery']['file']
    copy_approved_source(source, destination)
    spec['delivery'] = {'file': str(destination.relative_to(ROOT)), **delivery_record(source, destination, ROOT)}
    spec['sourceSha256'] = spec['delivery']['sourceSha256']
    SPEC.write_text(json.dumps(spec, indent=2) + '\n')
    print(json.dumps(spec['delivery']))

if __name__ == '__main__':
    main()
