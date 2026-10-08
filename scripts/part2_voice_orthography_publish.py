#!/usr/bin/env python3
"""Publish individually Root-reviewed exact writing pairs after the whole89 build.

Only the 34 enumerated Source/whole-decoder pairs are represented. Five actual
initial timing failures and the independent Hüft/Hilft body mismatch stay held.
No names, vowels, contractions, inferred phonemes, model calls or cue repair.
"""
from __future__ import annotations
import argparse
import copy
from contextlib import ExitStack
import fcntl
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import part2_voice_sourcefree_timing_publish as baseline

external, prior, base, batch = baseline.external, baseline.prior, baseline.base, baseline.batch
require, digest, object_sha = baseline.require, baseline.digest, baseline.object_sha
VERSION = 'part2-individual-exact-orthography-publication-v1'
MODE = 'individual_exact_source_large_writing_pair_initial_timeclear'
BASELINE_SHA = 'e3b173f8016d360d42ed94087b2caddc2a2ccba90f4b0b2dd5fe70f8939b9a51'
BASELINE_TEST_SHA = '20742ad596f1d5861620f9200070cd84b3cac2c3119de3eabfc365ad4cb74f56'
FORM_FOLDER = 'offline-word-review/secondary-forms/form-cases'
BLOCKED_PRIMARY_BODY = {'part2-0cbece7e9caf1d08acf2d833'}
EXCLUDED_NON_ORTHOGRAPHY = {'part2-0952e4049033473f411ba2c3', 'part2-41bec705a15267e095018074',
    'part2-c2308481206ce70eebd103c6', 'part2-3c1d4cc43b4b661a31b29244', 'part2-8001b352e174009400e36629'}

# These are complete actual texts and concrete positions, not rewrite rules.
# Root decisions bind the exact per-ID declaration; no other occurrence aliases.
CASES = {
    'part2-1d349b6347515e4f62321098': {'Source': 'Andere Mädchen werden zum Sechzehnten nicht gejagt.', 'Primary': ' Andere Mädchen werden zum 16. nicht gejagt.', 'Large': ' Andere Mädchen werden zum 16. nicht gejagt.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [4, 5], 'actual_token_span': [4, 5], 'expected_tokens': ['Sechzehnten'], 'actual_tokens': ['16'], 'expected_char_span': [26, 37], 'actual_char_span': [27, 29]}], 'form_report_sha256': 'e0d7d5c1336a4f756e5f76523817a39db23f0f6addaa97af54cfec582d2950f9', 'linguistic_review_sha256': '8fee008d8e81a71f53d2fc0e171f664a74a6c4eaa4b93244d8adadfd9d3c73b1'},
    'part2-66d9dec10002696e31b3d39c': {'Source': 'Atmen, zielen, nicht schreien. In welcher Reihenfolge noch mal?', 'Primary': ' Atmen, zielen, nicht schreien. In welcher Reihenfolge nochmal?', 'Large': ' Atmen, zielen, nicht schreien. In welcher Reihenfolge nochmal?', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [7, 9], 'actual_token_span': [7, 8], 'expected_tokens': ['noch', 'mal'], 'actual_tokens': ['nochmal'], 'expected_char_span': [54, 62], 'actual_char_span': [55, 62]}], 'form_report_sha256': '5af73a015eb828530f067542f36686f68e574258f0f467dc8b9c2c7a1c8fe898', 'linguistic_review_sha256': '74b72c3a2cc2874ed149086745a06613522d30576bab379e079d7f26bcb95e6a'},
    'part2-ffe85c2d2e82a727cc2059af': {'Source': 'Auf den Grund des Meeres. Genau so.', 'Primary': ' Auf den Grund des Meeres genauso.', 'Large': ' Auf den Grund des Meeres. Genauso.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [5, 7], 'actual_token_span': [5, 6], 'expected_tokens': ['Genau', 'so'], 'actual_tokens': ['Genauso'], 'expected_char_span': [26, 34], 'actual_char_span': [27, 34]}], 'form_report_sha256': '57acaee244c70cabb11cefd8934c6e0ae6aff7a033e8ba6378bca12aef212879', 'linguistic_review_sha256': 'd9cd9abadb93453a61af61c08ced5661fb5aa20772c9257007f6b46d7e5d184a'},
    'part2-65922a28355cebc2cfa015ec': {'Source': 'Darüber reden wir, wenn es so weit ist.', 'Primary': ' Darüber reden wir, wenn es soweit ist.', 'Large': ' Darüber reden wir, wenn es soweit ist.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [5, 7], 'actual_token_span': [5, 6], 'expected_tokens': ['so', 'weit'], 'actual_tokens': ['soweit'], 'expected_char_span': [27, 34], 'actual_char_span': [28, 34]}], 'form_report_sha256': 'f523a70de9bb30fe647e88aab0ebd4eeec29aef146b891393eb735367fe674e4', 'linguistic_review_sha256': 'af02b62fc7d4ff8888ca4789f88eb9ff65e7a6383f91c4aaacf9043ead3d0e75'},
    'part2-1aa7c999372345c1e34a27e8': {'Source': 'Dich kenn ich doch! Für dich haben mir die Schwarzweißen mein Schminktäschchen geklaut!', 'Primary': ' Dich kenn ich doch. Für dich haben mir die Schwarz-Weißen mein Schminktäschchen geklaut.', 'Large': ' Dich kenn ich doch. Für dich haben mir die Schwarz-Weißen mein Schminktäschchen geklaut.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [9, 10], 'actual_token_span': [9, 11], 'expected_tokens': ['Schwarzweißen'], 'actual_tokens': ['Schwarz', 'Weißen'], 'expected_char_span': [43, 56], 'actual_char_span': [44, 58]}], 'form_report_sha256': 'ce7b2ebef99c705cea69b3b8d9dd5cb0254e2530abc69715e72f7af48809140a', 'linguistic_review_sha256': 'ca829d200dc29a37dd601efb33139d63cca7e30c7b3595207808700234761a74'},
    'part2-1f01b79a11ac6f7c9c07a338': {'Source': 'Ein paarmal hast du schneller gezielt als gehört. Aber du hast es gemerkt. Das ist schon die halbe Übung.', 'Primary': ' Ein paar Mal hast du schneller gezielt als gehört. Aber du hast es gemerkt. Das ist schon die halbe Übung.', 'Large': ' Ein paar Mal hast du schneller gezielt als gehört. Aber du hast es gemerkt. Das ist schon die halbe Übung.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [1, 2], 'actual_token_span': [1, 3], 'expected_tokens': ['paarmal'], 'actual_tokens': ['paar', 'Mal'], 'expected_char_span': [4, 11], 'actual_char_span': [5, 13]}], 'form_report_sha256': 'ad32895f8337f2c9fff1a58774bc1e44e23d4c1013b3b3d364df715018cf6572', 'linguistic_review_sha256': 'f3c95e186cfa4a47d6c83ad4bae44f42e18c0cddd236f288798c61e9136d247a'},
    'part2-a005a5c5598a1aa3d67bf1f6': {'Source': 'Er ist warm. Als hätte gerade noch jemand die Hand drumgehabt.', 'Primary': ' Er ist warm, als hätte gerade noch jemand die Hand drum gehabt.', 'Large': ' Er ist warm, als hätte gerade noch jemand die Hand drum gehabt.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [10, 11], 'actual_token_span': [10, 12], 'expected_tokens': ['drumgehabt'], 'actual_tokens': ['drum', 'gehabt'], 'expected_char_span': [51, 61], 'actual_char_span': [52, 63]}], 'form_report_sha256': '0b3c2799aca437367c9b7f021b91adae2f39cae4a9210313241cdefda0cab5c4', 'linguistic_review_sha256': 'f5d3e793a69f921f700806257e5c0caf23d6724ad8e3129c0b000a5929d61928'},
    'part2-20091b857377e7b7653f0735': {'Source': 'Heute ist dir schon eine Gefangene abhandengekommen. Soll ich dich gleich mit dazuzählen?', 'Primary': ' Heute ist dir schon eine Gefangene abhanden gekommen. Soll ich dich gleich mit dazu zählen?', 'Large': ' Heute ist dir schon eine Gefangene abhandengekommen. Soll ich dich gleich mit dazu zählen?', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [12, 13], 'actual_token_span': [12, 14], 'expected_tokens': ['dazuzählen'], 'actual_tokens': ['dazu', 'zählen'], 'expected_char_span': [78, 88], 'actual_char_span': [79, 90]}], 'form_report_sha256': 'd7c632202fb1f39ac72e260175ed5882389b995570139149a70d7c7317e124c4', 'linguistic_review_sha256': '10ef7a057348d91b49c2e21c04d94121de109b47c0529a207cc4be3bd6c69634'},
    'part2-d85b54ee9d2e349dec89abf0': {'Source': 'Hiergeblieben, Elf. Du darfst zusehen. Mehr nicht.', 'Primary': ' Hier geblieben elf. Du darfst zusehen. Mehr nicht.', 'Large': ' Hier geblieben, Elf. Du darfst zusehen. Mehr nicht.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [0, 1], 'actual_token_span': [0, 2], 'expected_tokens': ['Hiergeblieben'], 'actual_tokens': ['Hier', 'geblieben'], 'expected_char_span': [0, 13], 'actual_char_span': [1, 15]}], 'form_report_sha256': '6c904fc9a826a1dbc287a9ea4e0d14de53aa0bed739c356df10c4a56653a818e', 'linguistic_review_sha256': '8fa6a048f24ebb940994ecb6e5a89c5a4c977471c50e6980c11f65c1dffe3337'},
    'part2-b50ae20d5bbc936e75b0215d': {'Source': 'Hübsch stillsitzen.', 'Primary': ' hübsch still sitzen,', 'Large': ' hübsch still sitzen.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [1, 2], 'actual_token_span': [1, 3], 'expected_tokens': ['stillsitzen'], 'actual_tokens': ['still', 'sitzen'], 'expected_char_span': [7, 18], 'actual_char_span': [8, 20]}], 'form_report_sha256': '413ca02ed700ecabb631878b52bd4c223f8c93df0fdde9ce047d6a0fe8e4122d', 'linguistic_review_sha256': 'b2eed80db5f0543c44cd21453928ef3abe6a57231c121321edaa6de0b926c9f7'},
    'part2-9cbb64fde675b4094e51bd06': {'Source': 'Ich glaube dir. Genau deshalb tue ich jetzt etwas, das du mir übelnehmen wirst.', 'Primary': ' Ich glaube dir. Genau deshalb tue ich jetzt etwas, das du mir übel nehmen wirst.', 'Large': ' Ich glaube dir. Genau deshalb tue ich jetzt etwas, das du mir übel nehmen wirst.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [12, 13], 'actual_token_span': [12, 14], 'expected_tokens': ['übelnehmen'], 'actual_tokens': ['übel', 'nehmen'], 'expected_char_span': [62, 72], 'actual_char_span': [63, 74]}], 'form_report_sha256': '666761868c284da511993d10b34632df70264b7e3aa3984705cfea1c804a7af7', 'linguistic_review_sha256': '32a70422097190dd5dae52d0ce5d4014d3a49c4a86367b9da3adc886faf21ce8'},
    'part2-89c3b9d0c7566a1bd5bedd58': {'Source': 'Ich hab dir vertraut. Das passiert mir nicht noch mal.', 'Primary': ' Ich hab dir vertraut. Das passiert mir nicht nochmal.', 'Large': ' Ich hab dir vertraut. Das passiert mir nicht nochmal.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [8, 10], 'actual_token_span': [8, 9], 'expected_tokens': ['noch', 'mal'], 'actual_tokens': ['nochmal'], 'expected_char_span': [45, 53], 'actual_char_span': [46, 53]}], 'form_report_sha256': '385acb01f6297a81974bf3cf6aa89841362f2aa7147c16f77a11f8534db0275b', 'linguistic_review_sha256': '60639d015bb6d4f8d2e92fbf99368d0e5cafb6235fa369083b8cbf2d275ba146'},
    'part2-8cc9586ccdb604d36b19839d': {'Source': 'Ich weiß. Du willst mich nicht sehen. Ich bleib hier stehen, du musst nicht näherkommen.', 'Primary': ' Ich weiß. Du willst mich nicht sehen. Ich bleib hier stehen, du musst nicht näher kommen.', 'Large': ' Ich weiß. Du willst mich nicht sehen. Ich bleib hier stehen, du musst nicht näher kommen.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [14, 15], 'actual_token_span': [14, 16], 'expected_tokens': ['näherkommen'], 'actual_tokens': ['näher', 'kommen'], 'expected_char_span': [76, 87], 'actual_char_span': [77, 89]}], 'form_report_sha256': 'f65caf2e821d0031bbdb46b37b605bf0693a9e83920a754c97ed93c3312fcefc', 'linguistic_review_sha256': '8b38e461d8e701f6904203dc1f7ff75ab6acbd49f9b588bb268a6062eeaedb78'},
    'part2-27cafcfa83a440109ea9d3c1': {'Source': 'Jetzt trägst du ihn. Überallhin. Damit deine Hand weiß, wo er ist, bevor dein Kopf fragt.', 'Primary': ' Jetzt trägst du ihn. Überall hin. Damit deine Hand weiß, wo er ist, bevor dein Kopf fragt.', 'Large': ' Jetzt trägst du ihn. Überall hin. Damit deine Hand weiß, wo er ist, bevor dein Kopf fragt.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [4, 5], 'actual_token_span': [4, 6], 'expected_tokens': ['Überallhin'], 'actual_tokens': ['Überall', 'hin'], 'expected_char_span': [21, 31], 'actual_char_span': [22, 33]}], 'form_report_sha256': 'b86ed3832127624cd26beeae11b740f159737b6c38843ec3950b4c40fe549bbe', 'linguistic_review_sha256': '5ad91a4c352d51aa4849f29d1879435cd5669069f1000f1dccbbf02b33a0d4e6'},
    'part2-a24b375ec1743cb8a788d4eb': {'Source': 'Kyra hat gesagt, es tut nicht weh. So sagt sie das immer, wenn es wehtut.', 'Primary': ' Kyra hat gesagt, es tut nicht weh. So sagt sie das immer, wenn es weh tut.', 'Large': ' Kyra hat gesagt, es tut nicht weh. So sagt sie das immer, wenn es weh tut.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [14, 15], 'actual_token_span': [14, 16], 'expected_tokens': ['wehtut'], 'actual_tokens': ['weh', 'tut'], 'expected_char_span': [66, 72], 'actual_char_span': [67, 74]}], 'form_report_sha256': 'cebd0d4d708d9cc76cc8530d93b69a1f5c29e1a7138b47abc33774761ddd058b', 'linguistic_review_sha256': 'f9be9805d47b46b68a8c20c4ecd8e6ef51742452066931465f55c16c0415585d'},
    'part2-ee34b1efe70e64eeed991a02': {'Source': 'Leichenfresser. Zwei. Dein Licht hat sie angelockt wie Fliegen den Honig.', 'Primary': ' Leichenfresser 2. Dein Licht hat sie angelockt wie fliegen den Honig.', 'Large': ' Leichenfresser 2. Dein Licht hat sie angelockt wie Fliegen den Honig.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [1, 2], 'actual_token_span': [1, 2], 'expected_tokens': ['Zwei'], 'actual_tokens': ['2'], 'expected_char_span': [16, 20], 'actual_char_span': [16, 17]}], 'form_report_sha256': '42eca267980d572b29b06f6c450886ecd461a9dff15781af3f67f2f5f7da311a', 'linguistic_review_sha256': 'acad8166d2e45c2cb9a53177dba8ac2333410cc9176fbffb61053f6e94f78a69'},
    'part2-31b3188daa9ffc7a146ce96d': {'Source': 'Leuchten! Du hast einen Riesen umgepustet! Andere Mädchen kriegen zum Sechzehnten ein Haarband.', 'Primary': ' Leuchten! Du hast einen Riesen umgepustet! Andere Mädchen kriegen zum 16. ein Haarband.', 'Large': ' Leuchten! Du hast einen Riesen umgepustet. Andere Mädchen kriegen zum 16. ein Haarband.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [10, 11], 'actual_token_span': [10, 11], 'expected_tokens': ['Sechzehnten'], 'actual_tokens': ['16'], 'expected_char_span': [70, 81], 'actual_char_span': [71, 73]}], 'form_report_sha256': '07bfcbbbb24c12d8599d4f80fea94b19e945dedf5991ecf444a527935a848a93', 'linguistic_review_sha256': '6120b7e58638db09fedc29c63d59991ed4687d030283e56a446dd39353095e14'},
    'part2-77ca63e666dc61f6760e45a7': {'Source': 'Nein. So nicht. Noch mal, Flick. Flach wie ein Blatt.', 'Primary': ' Nein, so nicht. Nochmal Flick, flach wie ein Blatt.', 'Large': ' Nein, so nicht. Nochmal flick. Flach wie ein Blatt.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [3, 5], 'actual_token_span': [3, 4], 'expected_tokens': ['Noch', 'mal'], 'actual_tokens': ['Nochmal'], 'expected_char_span': [16, 24], 'actual_char_span': [17, 24]}], 'form_report_sha256': '63011504ec3f0d49994b0521a4d3c6183f7b1b58e6fc382524f005691b2775fb', 'linguistic_review_sha256': '11d671705538eb8c5f81b3dafebcb6d3a3fad3c07ca29731a1578f99903231b2'},
    'part2-0cbece7e9caf1d08acf2d833': {'Source': 'Noch eine Hand voll Wasser. Hilft nicht mehr als die erste.', 'Primary': ' Noch eine Handvoll Wasser. Hüft nicht mehr als die erste.', 'Large': ' Noch eine Handvoll Wasser. Hilft nicht mehr als die erste.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [2, 4], 'actual_token_span': [2, 3], 'expected_tokens': ['Hand', 'voll'], 'actual_tokens': ['Handvoll'], 'expected_char_span': [10, 19], 'actual_char_span': [11, 19]}], 'form_report_sha256': 'bf08d58210431a847fc1e2591f8cd23ae51ac56393e002dad632d6198254bdd7', 'linguistic_review_sha256': '4a637726113e5b976399cade4a58fbe4b62d8e88a0d1f79aad809cc6d3d0eda2'},
    'part2-f8766366077f34cffbbd0592': {'Source': 'Noch mal. Ohne Bauch, mit Kopf.', 'Primary': ' Nochmal. Ohne Bauch, mit Kopf.', 'Large': ' Nochmal. Ohne Bauch, mit Kopf.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [0, 2], 'actual_token_span': [0, 1], 'expected_tokens': ['Noch', 'mal'], 'actual_tokens': ['Nochmal'], 'expected_char_span': [0, 8], 'actual_char_span': [1, 8]}], 'form_report_sha256': '66f594ad260a6eaf997cf1a7903c5756e66c92e888c59661698d5cf170b95150', 'linguistic_review_sha256': '7923d1fde6dc8291ac0a75155c4307c89d25d7971151fbf61b91bf92e378cd77'},
    'part2-ad6045dcb700f1621c915f16': {'Source': 'Sag das noch mal, und ich beiß dir in die Wade. Ich hab Übung.', 'Primary': ' Sag das nochmal und ich beiß dir in die Wade. Ich hab Übung.', 'Large': ' Sag das nochmal und ich beiß dir in die Wade. Ich hab Übung.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [2, 4], 'actual_token_span': [2, 3], 'expected_tokens': ['noch', 'mal'], 'actual_tokens': ['nochmal'], 'expected_char_span': [8, 16], 'actual_char_span': [9, 16]}], 'form_report_sha256': 'b9100d317b6c56bd0939d88ffb28244d51e33db55100c2d75825c51f054946a2', 'linguistic_review_sha256': '24cf370915613d119f264eae5bae00b5c64070cb787789362aa983279b184843'},
    'part2-e84675b9b909cc2e2c34aeda': {'Source': 'Sag so was nicht so laut. Sonst muss ich nett zu euch sein.', 'Primary': ' Sag sowas nicht so laut, sonst muss ich nett zu euch sein.', 'Large': ' Sag sowas nicht so laut, sonst muss ich nett zu euch sein.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [1, 3], 'actual_token_span': [1, 2], 'expected_tokens': ['so', 'was'], 'actual_tokens': ['sowas'], 'expected_char_span': [4, 10], 'actual_char_span': [5, 10]}], 'form_report_sha256': '5bda4c0667c3168b3c2a81ed90245384c7f840d35362dc82b555d8b1a5c43290', 'linguistic_review_sha256': '71cd1b706689271f71ed633639b93a0de6a5792c3ed35c018dce93aa9e050921'},
    'part2-2b3b0637f3bdf713e61b2446': {'Source': 'Sechshundertvierzig …', 'Primary': ' 640?', 'Large': ' 640?', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [0, 1], 'actual_token_span': [0, 1], 'expected_tokens': ['Sechshundertvierzig'], 'actual_tokens': ['640'], 'expected_char_span': [0, 19], 'actual_char_span': [1, 4]}], 'form_report_sha256': '1a1f5b38c4a45eb03a8f9fab3ab73b0b972a528d15c01896f42ad1b602440051', 'linguistic_review_sha256': '05be5b738365deb6e9acf920fb3ddbce5186be03ec4fcc9d33bdc1271b9a0271'},
    'part2-8c848a263709beb9e8464944': {'Source': 'Sechzehn Jahre verschwunden. Klingt nach einem, der ganz bestimmt nicht gefunden werden will.', 'Primary': ' 16 Jahre verschwunden. Klingt nach einem, der ganz bestimmt nicht gefunden werden will.', 'Large': ' 16 Jahre verschwunden. Klingt nach einem, der ganz bestimmt nicht gefunden werden will.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [0, 1], 'actual_token_span': [0, 1], 'expected_tokens': ['Sechzehn'], 'actual_tokens': ['16'], 'expected_char_span': [0, 8], 'actual_char_span': [1, 3]}], 'form_report_sha256': 'e53d5f09e69462adb7c652d0339d874b5ac5bdf23f833e51cc02a1fce08607eb', 'linguistic_review_sha256': '65a012e7be7bc4400164d0ad3feff1f08d08c7e0891bb11396509537ab8d698d'},
    'part2-2e349f5e6eb8084745135c2e': {'Source': 'Sechzehn Jahre. Nie das Richtige.', 'Primary': ' 16 Jahre. Nie das Richtige.', 'Large': ' 16 Jahre. Nie das Richtige.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [0, 1], 'actual_token_span': [0, 1], 'expected_tokens': ['Sechzehn'], 'actual_tokens': ['16'], 'expected_char_span': [0, 8], 'actual_char_span': [1, 3]}], 'form_report_sha256': '1fe47f8cae32a7f2e6fd1c2bc79449db1af1318e106ec37aae50fb991fae7890', 'linguistic_review_sha256': '3ed5d7cec4a249c03e27a4ae9eebb98b79398533156467420380ea6481810a92'},
    'part2-719c66257944699d9ae30890': {'Source': 'Setz dich, wenn du so weit bist.', 'Primary': ' Setz dich, wenn du soweit bist.', 'Large': ' Setz dich, wenn du soweit bist.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [4, 6], 'actual_token_span': [4, 5], 'expected_tokens': ['so', 'weit'], 'actual_tokens': ['soweit'], 'expected_char_span': [19, 26], 'actual_char_span': [20, 26]}], 'form_report_sha256': '40fc9cec3bc61bf230e21bf9584b4601f97b0a119c06e5212514dec76c0a2d97', 'linguistic_review_sha256': 'cade701426b2eaa901ab7cf291ff966a287001cf9225ac21b249372e67870081'},
    'part2-e235b4681ee2f3b49da9aa55': {'Source': 'Such ruhig weiter. Da drin ist genug Wald für hundert Jahre.', 'Primary': ' Such ruhig weiter. Da drin ist genug Wald für 100 Jahre.', 'Large': ' Such ruhig weiter. Da drin ist genug Wald für 100 Jahre.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [9, 10], 'actual_token_span': [9, 10], 'expected_tokens': ['hundert'], 'actual_tokens': ['100'], 'expected_char_span': [46, 53], 'actual_char_span': [47, 50]}], 'form_report_sha256': 'e5d4b9a93c7cb3e3c01bded3c0c9c98ccd1e1f4c09c0eb1a8b5ebc69d2efe4ab', 'linguistic_review_sha256': '4e8a20bafcc50f3b2529601e1a024e6e0894ecd19d63c1f630c56b44d2cdafa9'},
    'part2-5b81e44e2b8be0607245e6cc': {'Source': 'Und ich beiß gleich noch mal!', 'Primary': ' Und ich beiß gleich nochmal.', 'Large': ' Und ich beiß gleich nochmal.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [4, 6], 'actual_token_span': [4, 5], 'expected_tokens': ['noch', 'mal'], 'actual_tokens': ['nochmal'], 'expected_char_span': [20, 28], 'actual_char_span': [21, 28]}], 'form_report_sha256': '3c8f35d53d51de3ad5143f2b58c9a22e89ef1a77dbc4ae93255ef3509f3b40db', 'linguistic_review_sha256': '485a2342c8a63a32c9a83f46b5a78ef05156cad69d209b7d6c9efabe97e48151'},
    'part2-31241f537bc96e60374441a8': {'Source': 'Und wenn ich danebenschieße?', 'Primary': ' Und wenn ich daneben schieße?', 'Large': ' Und wenn ich daneben schieße?', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [3, 4], 'actual_token_span': [3, 5], 'expected_tokens': ['danebenschieße'], 'actual_tokens': ['daneben', 'schieße'], 'expected_char_span': [13, 27], 'actual_char_span': [14, 29]}], 'form_report_sha256': '9804424fe7ea68d5083e5259785d96af35cd3551d15173c05b69c8b41c3e0ce2', 'linguistic_review_sha256': '2c3cf7198c5c4b14d716504475f8816ddd90f01622e15c6aeb6a642e8d56609d'},
    'part2-3488ac40790df8a98f71fbc5': {'Source': 'Wenn du so guckst, ist es schlimm. Das weiß ich seit sechzehn Jahren.', 'Primary': ' Wenn du so guckst, ist es schlimm. Das weiß ich seit 16 Jahren.', 'Large': ' Wenn du so guckst, ist es schlimm. Das weiß ich seit 16 Jahren.', 'kind': 'number_writing_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [11, 12], 'actual_token_span': [11, 12], 'expected_tokens': ['sechzehn'], 'actual_tokens': ['16'], 'expected_char_span': [53, 61], 'actual_char_span': [54, 56]}], 'form_report_sha256': '3a14eafebc4397d054452b29768de5156cfb11e2109df45277fcccb6d958f858', 'linguistic_review_sha256': '36861a32372e57434afd1878d55f22b9eae2c3bdd61895480a8c3e48d03adfc9'},
    'part2-41bd69c20744046a7bda6c5a': {'Source': 'Wenn wir hier rauskommen, schwörst du noch mal. Vor allen. Ganz.', 'Primary': ' Wenn wir hier rauskommen, schwörst du nochmal. Vor allen. Ganz.', 'Large': ' Wenn wir hier rauskommen, schwörst du nochmal. Vor allen. Ganz.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [6, 8], 'actual_token_span': [6, 7], 'expected_tokens': ['noch', 'mal'], 'actual_tokens': ['nochmal'], 'expected_char_span': [38, 46], 'actual_char_span': [39, 46]}], 'form_report_sha256': 'cba0d88c2cfdd8e518fedbdbfa312f15fee65bfb58dafd5cf31c9738deab2345', 'linguistic_review_sha256': '90c31b457ee57ffa75417ed044d7dba43caa53f6c53281a41c929a30e49a655b'},
    'part2-e7f50351123efb2ad4f43754': {'Source': 'Wie bin ich hierhergekommen?', 'Primary': ' Wie bin ich hierher gekommen?', 'Large': ' Wie bin ich hierher gekommen?', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [3, 4], 'actual_token_span': [3, 5], 'expected_tokens': ['hierhergekommen'], 'actual_tokens': ['hierher', 'gekommen'], 'expected_char_span': [12, 27], 'actual_char_span': [13, 29]}], 'form_report_sha256': '7ca1a1985f4c7dcdd38da5ce2dc7e94ada74b0d76b0ea14b3b44e0c07467d66b', 'linguistic_review_sha256': '38ca3466f27a79d9f06fe2c65155f25c9f0733a09b2b1121561d6e6c35a67133'},
    'part2-f4beeaf0b22564fa0d71e303': {'Source': 'Wohin? Die Stiefel enden am Weg, und der Weg führt überallhin.', 'Primary': ' Wohin? Die Stiefel enden am Weg und der Weg führt überall hin.', 'Large': ' Wohin? Die Stiefel enden am Weg und der Weg führt überall hin.', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [10, 11], 'actual_token_span': [10, 12], 'expected_tokens': ['überallhin'], 'actual_tokens': ['überall', 'hin'], 'expected_char_span': [51, 61], 'actual_char_span': [51, 62]}], 'form_report_sha256': '3e6a89df3f5b45f8fc510b76203778ab50313d9fc4f862527fd789d7d1ad1f92', 'linguistic_review_sha256': '8652e9861aecb5125a12356d76ee85877f2d0e3bdf747a924e622c8f78ee88cf'},
    'part2-ba54afa3c89c628fdb583eb7': {'Source': 'Zwei kleine runde Gläser, orange getönt, in Draht gefasst. Wer trägt so was? Und wozu?', 'Primary': ' Zwei kleine, runde Gläser, orange getönt, in Draht gefasst. Wer trägt sowas und wozu?', 'Large': ' Zwei kleine runde Gläser, orange getönt in Draht gefasst. Wer trägt sowas und wozu?', 'kind': 'word_boundary_pair', 'spans': [{'operation': 'replace', 'expected_token_span': [11, 13], 'actual_token_span': [11, 12], 'expected_tokens': ['so', 'was'], 'actual_tokens': ['sowas'], 'expected_char_span': [69, 75], 'actual_char_span': [69, 74]}], 'form_report_sha256': '8b69c2002e8d6547e9537e37d18d70a9b03fbc0f18b0502d9c100f09f8250576', 'linguistic_review_sha256': 'e6fcde11c586b5685d38e1ef3f6c8ae9cb79b4ad22042a400cc6ca5d51c13ee9'},
}

def exact_declaration(row, take, raw, seconds, primary_raw):
    """Check the real whole body first, then only its enumerated writing slots.

    The shared segment/word validator here compares actual records to their own
    actual whole transcript. The separate Source comparison below cannot change
    that transcript, any record, or any timing interval.
    """
    ident = row['id']; policy = CASES.get(ident)
    require(policy is not None and ident not in BLOCKED_PRIMARY_BODY,
            'No route for unknown cases, contractions, ambiguous compounds or the additional Hüft/Hilft body mismatch.')
    response = raw.get('actual_response', {})
    require(raw.get('source_free') is True and raw.get('raw_saved_before_diagnosis') is True
        and raw.get('actual_call_args') == prior.CALL_ARGS
        and raw.get('actual_runtime') == {'model_path': str(prior.FULL_MODEL.resolve()), 'dimensions': prior.FULL_DIMENSIONS},
        'Actual source-free complete32 runtime and original response contract required.')
    require(row['text'] == policy['Source'] and primary_raw.get('actual_response', {}).get('text') == policy['Primary']
            and take.get('transcript') == policy['Primary'].strip() and response.get('text') == policy['Large']
            and primary_raw.get('id') == raw.get('id') == ident
            and primary_raw.get('audio_sha256') == raw.get('audio_sha256')
            and primary_raw.get('source_free') is True, 'Whole enumerated Source/Primary/Large text or actual audio changed.')
    require(base.qa_engine.words(policy['Primary']) == base.qa_engine.words(policy['Large']),
            'An additional Primary body change requires independent whole-Source proof; it cannot receive writing-pair clearance.')
    records = prior.literal_response_body(response, {'text': response['text']}, seconds)
    source_tokens, actual_tokens = list(re.finditer(r'\w+', row['text'])), list(re.finditer(r'\w+', response['text']))
    source_end = actual_end = 0; declarations = []
    for slot in policy['spans']:
        require(slot['operation'] == 'replace', 'Only the enumerated replacement slots are supported.')
        ss, se = slot['expected_token_span']; aa, ae = slot['actual_token_span']
        sc, sd = slot['expected_char_span']; ac, ad = slot['actual_char_span']
        require(all(type(v) is int for v in [ss, se, aa, ae, sc, sd, ac, ad])
            and source_end <= ss < se <= len(source_tokens) and actual_end <= aa < ae <= len(actual_tokens)
            and 0 <= sc < sd <= len(row['text']) and 0 <= ac < ad <= len(response['text']), 'Typed exact slot indices differ.')
        require([v.group() for v in source_tokens[ss:se]] == slot['expected_tokens']
            and [v.group() for v in actual_tokens[aa:ae]] == slot['actual_tokens']
            and [source_tokens[ss].start(), source_tokens[se-1].end()] == [sc, sd]
            and [actual_tokens[aa].start(), actual_tokens[ae-1].end()] == [ac, ad], 'Real whole-text tokens or character positions differ.')
        require([v.group().casefold() for v in source_tokens[source_end:ss]]
                == [v.group().casefold() for v in actual_tokens[actual_end:aa]],
                'Whole body outside the explicit slot repeats, omits or changes words.')
        declarations.append({'kind': policy['kind'], **copy.deepcopy(slot),
            'exact_source_characters': row['text'][sc:sd], 'exact_actual_characters': response['text'][ac:ad]})
        source_end, actual_end = se, ae
    require([v.group().casefold() for v in source_tokens[source_end:]] == [v.group().casefold() for v in actual_tokens[actual_end:]],
            'Trailing whole body differs outside the explicit writing slots.')
    return {'id': ident, 'whole_source_text': row['text'], 'whole_initial_primary_transcript': primary_raw['actual_response']['text'],
        'actual_primary_raw_sha256': object_sha(primary_raw),
        'whole_actual_sourcefree_large_transcript': response['text'], 'typed_exact_slots': declarations,
        'actual_whole_response_sha256': object_sha(response), 'actual_complete_word_records_sha256': object_sha(records),
        'only_orthography_clearance': True, 'canonical_pronunciation_or_IPA': None, 'human_listening_or_acting_approval': False}


def original_clip(row, run, profiles, qa, alignment, take, args, bound, decode_fn=None):
    """Validate real original Source/audio/cues, without an approval-status shim."""
    ident = row['id']; path = run/'clips'/(ident+'.mp3'); audio_hash = digest(path); text_hash = batch.sha(row['text'].encode())
    temporal = batch.read(run/'word-cues'/(ident+'.json'))
    require(not take.get('adjudication') and take.get('text_sha256') == text_hash
        and qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_hash,
        'Current original Source/audio/reports differ or were adjudicated in place.')
    require(take.get('reasons') and set(take['reasons']) <= prior.WORD_FAILURES, 'Only original lexical diagnostic failures are eligible.')
    signal = (decode_fn or base.qa_engine.decode)(path)
    require(signal == take.get('signal') and not base.qa_engine.signal_failures(signal, len(base.qa_engine.words(row['text']))), 'Current physical signal differs or fails.')
    receipt = batch.read(run/'raw'/(ident+'.receipt.json')); wav = run/'raw'/(ident+'.wav')
    require(receipt.get('status') == 'complete' and receipt.get('backend') == 'batch' and receipt.get('id') == ident
        and receipt.get('mp3_sha256') == audio_hash and receipt.get('wav_sha256') == digest(wav)
        and receipt.get('request_sha256') == batch.sha(batch.canonical(batch.request_for(row, profiles['speakers'])).encode()),
        'Current actual provider/request/normalization receipt differs.')
    require(receipt.get('normalization') == {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}
        and isinstance(receipt.get('loudness_input'), dict)
        and all(k in receipt['loudness_input'] and math.isfinite(float(receipt['loudness_input'][k])) for k in
            ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'])
        and prior.finite(receipt.get('seconds')) and abs(receipt['seconds']-signal['seconds']) < .1, 'Actual normalization/duration missing or stale.')
    words = base.cue_engine.acoustic.normalized_text(row['text']).split()
    require(temporal.get('engine_version') == base.cue_engine.ENGINE and temporal.get('audio_sha256') == audio_hash
        and temporal.get('text_sha256') == text_hash and temporal.get('text') == row['text']
        and temporal.get('source_manifest_sha256') == digest(run/'lines.private.json')
        and abs(temporal.get('decoded_seconds', -100)-signal['seconds']) < .001
        and temporal.get('authored_word_count') == len(words) and len(temporal.get('word_cues', [])) == len(words)
        and [word.get('word') for word in temporal.get('words', [])] == words
        and temporal.get('cues_sha256') == base.cue_engine.acoustic.cue_sha(temporal['word_cues'])
        and temporal.get('all_qualification_flags') == base.cue_engine.qualification_flags(temporal)
        and not any(k in temporal for k in ['CTC_adoption', 'Partial_CTC_adoption', 'Vocal_event_adoption']),
        'Complete real initial Source/cue receipt changed or was substituted.')
    require(temporal['all_qualification_flags'] == [], 'Every original timing flag remains held in this word-only route.')
    entry = alignment.get('alignment_by_id', {}).get(ident, {}); cues = temporal['word_cues']
    require(entry.get('cues_sha256') == temporal['cues_sha256'] and entry.get('word_count') == len(words)
        and entry.get('text_sha256') == text_hash and entry.get('words') == [{'word': text, **cue} for text, cue in zip(words, cues)],
        'All flag-free original cues must be unchanged and fully reported.')
    details = base.cue_engine.cue_words(row['text'], cues, signal['seconds']); previous = 0.
    for text, cue, data in zip(words, cues, temporal['words']):
        require(cue['start'] < cue['end'] or (data.get('spoken') is False and not base.re_word(text)), 'Collapsed lexical cue remains private.')
        if base.re_word(text):
            require(data.get('spoken') is True, 'Every new lexical cue must retain its actual spoken-True record.')
        else:
            require(data.get('spoken') is False and cue['start'] == cue['end'] == previous, 'Visual punctuation must retain the genuine preceding endpoint.')
        previous = cue['end']
    require(len(details) == len(words) and alignment.get('authored_text_sha256', {}).get(ident) == text_hash, 'Complete initial timing Source census differs.')
    for name, value in prior.case_binding(args, run, row)['files_sha256'].items(): external.pin_file(name, bound, value)
    return temporal, signal, path


def form_binding(run, ident):
    policy = CASES[ident]; folder = run/FORM_FOLDER
    return {'original_form_case': {'path': str(folder/(ident+'.private.json')), 'sha256': policy['form_report_sha256']},
        'unapproved_linguistic_review': {'path': str(folder/(ident+'.child51-review.UNAPPROVED.private.json')),
            'sha256': policy['linguistic_review_sha256']}}


def bind_form_evidence(run, row, take, raw, case, bound):
    require(case.get('form_evidence') == form_binding(run, row['id']), 'Exact original individual linguistic evidence must be retained.')
    form = prior.bound_ref(run, case['form_evidence']['original_form_case'], bound)
    review = prior.bound_ref(run, case['form_evidence']['unapproved_linguistic_review'], bound)
    require(form.get('source') == row and form.get('complete_initial_primary_asr') == CASES[row['id']]['Primary']
        and form.get('complete_actual_secondary_raw_response') == raw['actual_response']
        and form.get('actual_secondary_waveform_input') == raw['actual_audio_input']
        and form.get('actual_secondary_raw_sha256') == digest(run/'free-large449/raw'/(row['id']+'.private.json'))
        and form.get('current_token_alignment_flags') == []
        and form.get('current_token_alignment_sha256') == digest(run/'word-cues'/(row['id']+'.json'))
        and form.get('word_approval') is None and form.get('timing_approval') is None
        and review.get('Root_approval') is None and review.get('no_alternative_transcript_created') is True,
        'Actual individual Source/body/array/cues evidence or historical unapproved state differs.')
    for pin in form['provenance_proofs']+form['initial_primary_raw_proofs']:
        path = batch.contained(batch.ROOT, pin['path']); external.pin_file(path, bound, pin['sha256'])
    for source in form['source_bindings']:
        path = batch.contained(batch.ROOT, source['file']); external.pin_file(path, bound, source['actual_full_file_sha256'])
    return form


def case_template(args, row, take, raw, seconds):
    """A concrete unapproved record; never grants Root, hearing or time approval."""
    run = Path(args.run_dir).expanduser().resolve(); temporal = batch.read(run/'word-cues'/(row['id']+'.json'))
    return {'version': VERSION, 'status': 'UNAPPROVED_part2_orthography_case', 'reviewed_by': None,
        'actual_whole_source_and_counterevidence_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding': prior.case_binding(args, run, row), 'retained_initial_take': copy.deepcopy(take),
        'retained_initial_timing_flags': copy.deepcopy(temporal['all_qualification_flags']), 'mode': MODE, 'timing': None,
        'form_evidence': form_binding(run, row['id']), 'word': {'mode': MODE,
            'raw': {'path': str(run/'free-large449/raw'/(row['id']+'.private.json')),
                'sha256': digest(run/'free-large449/raw'/(row['id']+'.private.json'))},
            'exact_declaration': exact_declaration(row, take, raw, seconds,
                batch.read(run/'asr-raw'/(row['id']+'.private.json'))), 'review_note': ''}}


def approved_case(row, run, profiles, qa, alignment, take, case, args, bound, secondary, decode_fn=None):
    require(case.get('version') == VERSION and case.get('status') == 'approved_part2_orthography_case'
        and case.get('reviewed_by') == 'root' and case.get('actual_whole_source_and_counterevidence_reviewed') is True
        and case.get('human_listening_or_acting_approval') is False and case.get('binding') == prior.case_binding(args, run, row)
        and case.get('retained_initial_take') == take and case.get('retained_initial_timing_flags') == []
        and case.get('mode') == MODE and case.get('timing') is None, 'Exact per-Source Root writing-pair approval required; all original failures stay bound.')
    temporal, signal, path = original_clip(row, run, profiles, qa, alignment, take, args, bound, decode_fn)
    word = case.get('word')
    require(isinstance(word, dict) and word.get('mode') == MODE and isinstance(word.get('review_note'), str)
        and word['review_note'].strip(), 'Explicit per-Source Root semantic-pair review note required.')
    raw = prior.case_secondary(run, row['id'], word, secondary, path, bound)
    primary_path = run/'asr-raw'/(row['id']+'.private.json'); external.pin_file(primary_path, bound)
    require(word.get('exact_declaration') == exact_declaration(row, take, raw, signal['seconds'], batch.read(primary_path)),
            'Root approval changes the actual complete body or enumerated mapping.')
    bind_form_evidence(run, row, take, raw, case, bound)
    require(digest(path) == temporal['audio_sha256'], 'Actual clip changed during scoped writing qualification.')
    return {'id': row['id'], 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
        'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+row['id']+'.mp3',
        'sha256': temporal['audio_sha256'], 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(temporal['word_cues']),
        'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def build(args, initial, supplemental, external_selection, sourcefree_selection, selection):
    require(digest(Path(baseline.__file__)) == BASELINE_SHA
        and digest(batch.ROOT/'scripts/part2_voice_sourcefree_timing_publish_test.py') == BASELINE_TEST_SHA,
        'Frozen whole Sourcefree89 baseline and tests must remain unchanged.')
    public, paths, preserved, bound, previous = baseline.build(args, initial, supplemental, external_selection, sourcefree_selection)
    target_root = Path(initial['target_root']); target_script = target_root/'scripts'/Path(__file__).name
    require(target_script.is_file() and digest(target_script) == digest(__file__), 'Release orthography adapter must match reviewed production bytes.')
    for path in [target_script, Path(__file__).resolve(), Path(args.orthography_selection)]: external.pin_file(path, bound)
    require(selection.get('version') == VERSION and selection.get('status') == 'approved_part2_orthography_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('human_listening_or_acting_approval') is False
        and selection.get('initial_selection_sha256') == digest(args.selection)
        and selection.get('supplemental_selection_sha256') == digest(args.supplemental_selection)
        and selection.get('external_selection_sha256') == digest(args.external_selection)
        and selection.get('sourcefree_timing_selection_sha256') == digest(args.sourcefree_timing_selection)
        and selection.get('baseline_adapter_sha256') == BASELINE_SHA and selection.get('adapter_sha256') == digest(__file__)
        and selection.get('target_root') == previous['target_root']
        and selection.get('preserved_banks_sha256') == previous['preserved_banks_sha256'],
        'Separate Root writing selection must retain the complete approved prior union.')
    for field in ['manifest_sha256', 'profiles_sha256', 'prepared_sha256', 'qa_sha256', 'alignment_sha256', 'qa_producer_sha256', 'alignment_producer_sha256']:
        require(selection.get(field) == previous.get(field), 'Writing union changes original full production/provenance.')
    run = Path(args.run_dir).expanduser().resolve(); manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = base.report_coverage(qa, alignment, manifest, run); rows = {row['id']: row for row in manifest['lines']}
    baseline_ids = {clip['id'] for clip in public['clips']}; chosen = base.ids(selection.get('selected_ids'), 'orthography Root union IDs')
    require(baseline_ids <= chosen <= checked, 'Every prior approved case is mandatory; unknown Sources cannot be inserted.')
    additional = chosen-baseline_ids
    require(additional and additional <= set(CASES)-BLOCKED_PRIMARY_BODY, 'Only enumerated writing pairs may be added; independent body errors stay held.')
    secondary = prior.secondary_bundle(run, rows, takes, bound, selection.get('secondary_bundle'))
    refs = selection.get('case_approvals'); require(isinstance(refs, list) and len(refs) == len(additional), 'Exact individual Root writing approvals required.')
    cases = {}
    for ref in refs:
        case = prior.bound_ref(run, ref, bound); ident = case.get('binding', {}).get('id')
        require(ident in additional and ident not in cases, 'Unknown/duplicate/nonselected writing case approval.'); cases[ident] = case
    require(set(cases) == additional, 'Every additional Source needs its own exact Root review.')
    for path in base.response_records(run, additional): external.pin_file(path, bound)
    clips = {clip['id']: copy.deepcopy(clip) for clip in public['clips']}
    for ident, case in cases.items():
        clips[ident], paths[ident] = approved_case(rows[ident], run, profiles, qa, alignment, takes[ident], case, args, bound, secondary)
    public = copy.deepcopy(public); public['clips'] = [clips[row['id']] for row in manifest['lines'] if row['id'] in clips]
    coverage = public['coverage']; coverage.update(version=VERSION,
        missing_sources=[entry for entry in coverage['missing_sources'] if entry['id'] not in additional], published_sources=len(clips),
        complete_sourcefree89_baseline_sources=len(baseline_ids), orthography_qualified_sources=len(additional),
        orthography_enumerated_source_large_pairs=34, orthography_number_pairs=8, orthography_boundary_pairs=26,
        orthography_original_timing_holds_retained=5, orthography_additional_primary_body_holds_retained=1,
        orthography_excluded_clitic_or_ambiguous_cases=5, orthography_original_source_cues_unchanged=True,
        all_original_flags_and_false_verdicts_retained=True, human_listening_or_acting_approval=False,
        orthography_selection_sha256=digest(args.orthography_selection))
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(clips)+len(coverage['missing_sources']) == len(rows), 'Truthful whole Source census differs.')
    return public, paths, preserved, bound, selection


def main():
    os.umask(0o077); parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply']); parser.add_argument('--run-dir', required=True)
    for name in ['selection', 'supplemental-selection', 'external-selection', 'sourcefree-timing-selection', 'orthography-selection',
        'qa-report', 'alignment-report', 'qa-producer', 'alignment-producer', 'coverage-report']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--adapter-sha256', required=True); parser.add_argument('--target-root', type=Path); args = parser.parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must supply the independently frozen orthography adapter SHA.')
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents and args.coverage_report.resolve() == args.coverage_report,
            'Immutable exact private orthography coverage path required.')
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            initial, supplemental, external_selection, sourcefree_selection, selection = (batch.read(p) for p in
                [args.selection, args.supplemental_selection, args.external_selection, args.sourcefree_timing_selection, args.orthography_selection])
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(initial.get('target_root') == str(target_root), 'Root selection must name the exact target lock worktree.')
            locks.enter_context(base.target_publish_lock(target_root))
            public, paths, preserved, bound, selection = build(args, initial, supplemental, external_selection, sourcefree_selection, selection)
            target = target_root/'game/public/audio/teil-2'; base.existing(target, selection, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'version': VERSION,
                'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                'adapter_sha256': digest(__file__), 'baseline_adapter_sha256': BASELINE_SHA, 'preserved_bank_sha256': preserved,
                'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Immutable original orthography coverage report already exists.')
            if args.command == 'apply':
                identity = None
                def finalize():
                    nonlocal identity
                    identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == identity:
                        args.coverage_report.unlink()
                base.apply(target, selection, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'missing': len(public['coverage']['missing_sources']),
                'human_listening_or_acting_approval': False}))
        return 0
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError, AttributeError, IndexError):
        print('Individual writing-pair publication refused; original evidence and banks remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
