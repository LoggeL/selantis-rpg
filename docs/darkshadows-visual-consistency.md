# Dunkelschatten visual consistency

The raiders use the plain clothing vocabulary of the existing battle sprites: dirty unbleached linen, coarse matte black wool cowls, worn leather straps, small dark iron fasteners and used iron helmets. Gold brooches and the grey-haired leader's formal sweeping robe were removed.

The three dialogue identities remain distinct: the elderly balding grey-bearded leader, the middle-aged scarred helmeted captor, and the younger dark-haired hooded man. Their approved portraits also served as references for all nine active raid cinematic cuts. Farm geography, staging, the dagger strikes, the parents' fall and the horseback departure remain the same narrative beats. Lia uses strawberry-blonde curls and her white blouse; Kyra uses long nut-brown hair and a dirty beige peasant dress.

Prompts and paths: `design/assets/darkshadows-consistency.json`. Accepted source images: `output/imagegen/raw/darkshadows-consistency/`. Delivery dimensions, source/runtime SHA-256 and processing details: `design/assets/darkshadows-consistency-delivery.json`. Preparation: `python3 scripts/prepare_darkshadows_consistency.py`.

Runtime portrait/cut keys and image dimensions are preserved. Only frame 2 of the shared `story-actors.png` atlas is changed by this preparation script; it reads the current atlas and verifies that every other cell is unchanged by this write. Frames owned by other character work remain intact. The actual creative edits use built-in Imagegen; Pillow only normalizes delivery dimensions and inserts the accepted transparent sprite into its existing cell.

Frame 2 uses binary alpha at threshold 110 before cropping and nearest-neighbor downsampling. Its figure is 42 pixels high, centered at x=32 with feet at y=60 and a transparent gutter. Delivery metadata records a frame-specific hash; the whole atlas hash is a snapshot that can change when another owner writes a different cell. The raw Imagegen sprite is unchanged.

Visual checks covered all three portraits, all nine raid cuts, the final frame-2 sprite and the two adjacent Valentus cuts supplied by the Valentus worker. The latter use the same black cowl/linen clothing reference. Browser acceptance and overall build checks belong to the parent task.
