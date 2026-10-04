"""Exercise byte preservation independently of private artwork or runtime files."""
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from cinematic_asset_delivery import copy_approved_source, delivery_record


class ApprovedDeliveryTests(unittest.TestCase):
    def test_preserves_original_encoding_pixels_size_and_alpha(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, destination = root / 'source.png', root / 'runtime/cut.png'
            image = Image.new('RGBA', (1672, 941), (13, 47, 103, 129))
            image.putpixel((1671, 940), (237, 11, 91, 0))
            image.save(source, compress_level=1)
            result = copy_approved_source(source, destination, alpha=True)
            self.assertEqual(source.read_bytes(), destination.read_bytes())
            self.assertEqual(result.size, (1672, 941))
            self.assertEqual(result.getpixel((1671, 940)), (237, 11, 91, 0))
            record = delivery_record(source, destination, root)
            self.assertEqual(record['sha256'], record['sourceSha256'])
            self.assertEqual(record['width'], 1672)

    def test_rejects_wrong_geometry_without_overwriting_existing_delivery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, destination = root / 'square.png', root / 'existing.png'
            Image.new('RGB', (128, 128)).save(source)
            destination.write_bytes(b'keep existing approved file')
            with self.assertRaises(ValueError):
                copy_approved_source(source, destination)
            self.assertEqual(destination.read_bytes(), b'keep existing approved file')

    def test_refuses_to_claim_an_output_with_a_different_source_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, destination = root / 'source.png', root / 'wrong.png'
            Image.new('RGB', (640, 360), 'red').save(source)
            Image.new('RGB', (640, 360), 'blue').save(destination)
            with self.assertRaises(ValueError):
                delivery_record(source, destination, root)


if __name__ == '__main__':
    unittest.main()
