import { assetUrl } from './assetUrl';
import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { DIALOGUE_PORTRAITS, EXPRESSION_PORTRAITS, loadDialoguePortraits, parseDialogue, resolvePortrait } from './portraits';

describe('speaker identity and source portraits', () => {
  it('separates spoken names and preserves travel observations with a colon', () => {
    expect(parseDialogue('Kyra: Mutter wartet.')).toEqual({ name: 'Kyra', text: 'Mutter wartet.' });
    expect(parseDialogue('Lia (Gedanke): Die Reiter.')).toEqual({ name: 'Lia (Gedanke)', text: 'Die Reiter.' });
    expect(parseDialogue('Westen: Trapas. Osten: Portas.')).toEqual({ text: 'Westen: Trapas. Osten: Portas.' });
  });

  it('keeps unidentified names while showing the visible camp companion', () => {
    const scene = { textures: { exists: () => true } } as unknown as Phaser.Scene;
    expect(parseDialogue('Der Schmale: Still!')).toEqual({ name: 'Der Schmale', text: 'Still!' });
    expect(resolvePortrait(scene, 'Der Schmale')).toMatchObject({ texture: 'portrait-dialogue-foltan', src: assetUrl('assets/portraits/dialogue-foltan.png') });
    expect(resolvePortrait(scene, 'Der Dicke')).toMatchObject({ texture: 'portrait-dialogue-azar', src: assetUrl('assets/portraits/dialogue-azar.png') });
    expect(resolvePortrait(scene, 'Grauhaariger')).toMatchObject({ texture: 'portrait-grey-haired-message06', src: assetUrl('assets/portraits/grey-haired-message06.png') });
  });

  it('shows an anonymous silhouette if a face has no reviewed source art', () => {
    const scene = { textures: { exists: (key: string) => key === 'portrait-unknown' } } as unknown as Phaser.Scene;
    expect(resolvePortrait(scene, 'Noch unbekannt')).toEqual({ texture: 'portrait-unknown' });
    expect(parseDialogue('Mann: Er lebt.')).toEqual({ name: 'Mann', text: 'Er lebt.' });
    expect(parseDialogue('Fremder: Noch nicht eingeführt.')).toEqual({ text: 'Fremder: Noch nicht eingeführt.' });
  });

  it('queues every new speaker crop before the first playable scene', () => {
    const image = vi.fn();
    loadDialoguePortraits({ load: { image } } as unknown as Phaser.Scene);
    expect(image).toHaveBeenCalledTimes(Object.keys(DIALOGUE_PORTRAITS).length + Object.keys(EXPRESSION_PORTRAITS).length);
    expect(image).toHaveBeenCalledWith('portrait-kyra', assetUrl('assets/portraits/kyra.png'));
    expect(image).toHaveBeenCalledWith('portrait-grey-haired-message06', assetUrl('assets/portraits/grey-haired-message06.png'));
    expect(image).toHaveBeenCalledWith('portrait-dialogue-lia-grief', assetUrl('assets/portraits/dialogue-lia-grief.png'));
    expect(image).toHaveBeenCalledWith('portrait-dialogue-scarred', assetUrl('assets/portraits/dialogue-scarred.png'));
  });

  it('chooses the authored chapter expression and allows explicit emotion overrides', () => {
    const scene = { sys: { settings: { key: 'aftermath' } }, textures: { exists: () => true } } as unknown as Phaser.Scene;
    expect(resolvePortrait(scene, 'Lia')).toMatchObject({ texture: 'portrait-dialogue-lia-grief', src: assetUrl('assets/portraits/dialogue-lia-grief.png'), frameCount: 1 });
    expect(resolvePortrait(scene, 'Lia', 'determined')).toMatchObject({ texture: 'portrait-dialogue-lia-determined' });
    scene.sys.settings.key = 'journey';
    expect(resolvePortrait(scene, 'Lia (Gedanke)')).toMatchObject({ texture: 'portrait-dialogue-lia-determined' });
    expect(resolvePortrait(scene, 'Lia', 'neutral')).toMatchObject({ texture: 'portrait-dialogue-lia' });
  });

  it('falls back through the default profile to the existing reviewed source crop', () => {
    const available = new Set(['portrait-dialogue-lia', 'portrait-lia']);
    const scene = { sys: { settings: { key: 'raid' } }, textures: { exists: (key: string) => available.has(key) } } as unknown as Phaser.Scene;
    expect(resolvePortrait(scene, 'Lia')).toMatchObject({ texture: 'portrait-dialogue-lia' });
    available.delete('portrait-dialogue-lia');
    expect(resolvePortrait(scene, 'Lia')).toMatchObject({ texture: 'portrait-lia', src: assetUrl('assets/portraits/lia.png') });
    available.clear();
    expect(resolvePortrait(scene, 'Lia')).toBeUndefined();
  });
});
