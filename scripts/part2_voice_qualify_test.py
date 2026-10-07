"""Offline adapter guard tests; no installed model is loaded."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import part2_voice_batch as b
import part2_voice_qualify as q


class Adapter(unittest.TestCase):
    def test_scoped_adapter_restores_all_protected_module_globals(self):
        old = (q.common.ROOT, q.common.PRIVATE, q.common.prepared, q.qa.ID, q.cues.STORY_ID,
               q.common.core.ROOT, q.common.core.PRIVATE, q.common.core.prepared)
        with self.assertRaises(RuntimeError):
            with q.adapter():
                self.assertTrue(q.qa.ID.fullmatch('part2-'+'a'*24))
                self.assertFalse(q.qa.ID.fullmatch('story-'+'a'*24))
                self.assertIs(q.common.prepared, b.prepared)
                raise RuntimeError('offline unit test')
        self.assertEqual(old, (q.common.ROOT, q.common.PRIVATE, q.common.prepared, q.qa.ID, q.cues.STORY_ID,
                               q.common.core.ROOT, q.common.core.PRIVATE, q.common.core.prepared))

    def test_model_identity_requires_real_existing_local_weight_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            with self.assertRaises(b.SafeError): q.model_identity(path)
            b.core.save(path/'config.json', {'model_type': 'whisper', **q.DIMENSIONS})
            with self.assertRaises(b.SafeError): q.model_identity(path)
            (path/'model.safetensors').write_bytes(b'UNIT FIXTURE, NOT A REAL MODEL')
            first = q.model_identity(path)
            (path/'model.safetensors').write_bytes(b'CHANGED UNIT FIXTURE')
            self.assertNotEqual(first, q.model_identity(path))

    def test_full_large_model_cannot_be_labeled_turbo(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            b.core.save(path/'config.json', {'model_type': 'whisper', **q.DIMENSIONS, 'n_text_layer': 32})
            (path/'model.safetensors').write_bytes(b'NOT A REAL MODEL, CONFIG GUARD TEST')
            with self.assertRaises(b.SafeError): q.model_identity(path)

    def test_input_pin_includes_all_actual_clips_and_full_proposal(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder); (path/'clips').mkdir()
            for name in ['prepared.json', 'lines.private.json', 'profiles.private.json', 'preserved-banks.private.json', 'public-manifest.proposed.json']:
                (path/name).write_text('{}')
            (path/'clips/part2-one.mp3').write_bytes(b'unit')
            before = q.inputs(path)
            (path/'clips/part2-two.mp3').write_bytes(b'unit2')
            self.assertNotEqual(before, q.inputs(path))
            self.assertIn(str(path/'public-manifest.proposed.json'), before)


if __name__ == '__main__': unittest.main()
