import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { GalleryScene, PAGES, type GalleryPage } from './GalleryScene';

function startGallery(): void {
  G.stopGameplayScenes();
  G.ui.setHud('none');
  const want = new URLSearchParams(location.search).get('page') as GalleryPage | null;
  const page = PAGES.some(p => p.id === want) ? want! : 'landscape';
  G.game.scene.start(GalleryScene.KEY, { page });
}

defineChapter({
  id: 'dev-art',
  order: 901,
  numeral: 'Dev',
  title: 'Kunstgalerie',
  subtitle: 'Prozedurale Pixelkunst',
  hidden: true,
  phaserScenes: [GalleryScene],
  scenes: [{ id: 'art-gallery', title: 'Kunstgalerie', start: startGallery }],
});
