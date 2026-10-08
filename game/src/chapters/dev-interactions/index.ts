import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import type { StoryActionKind, StealthKind } from '../../ui/interactionRules';
import { stakeGame } from '../kapitel-3/panels';
import { startSong } from '../kapitel-3/song';
import './style.css';
import { assetUrl, manifest } from '../../art/manifest';

const story: StoryActionKind[] = ['reach', 'lift', 'open-eyes', 'tend', 'bellows'];
const stealth: StealthKind[] = ['cover', 'duck', 'listen'];
const extras = ['stake'] as const;
type PreviewKind = StoryActionKind | StealthKind | typeof extras[number];
const labels: Record<PreviewKind, string> = {
  reach: 'Die Hand ausstrecken', lift: 'Die Hand heben', 'open-eyes': 'Augen öffnen',
  tend: 'Die Ferse versorgen', bellows: 'Blasebalg treten', cover: 'In der Böschung verstecken',
  duck: 'Unter den Reitern abtauchen', listen: 'Im Schatten lauschen',
  stake: 'Der Pflock',
};

function previewPicker(kind: PreviewKind): void {
  const nav = G.ui.panel('interaction-preview-nav');
  const label = document.createElement('label');
  label.className = 'interaction-preview-picker ch-panel';
  const caption = document.createElement('span');
  caption.textContent = 'Vorschau';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Minispiel wählen');
  for (const [title, kinds] of [['Challenges', [...stealth, ...extras]], ['Story-Aktionen', story]] as const) {
    const group = document.createElement('optgroup');
    group.label = title;
    for (const item of kinds) {
      const option = document.createElement('option');
      option.value = item; option.textContent = labels[item]; option.selected = item === kind;
      group.append(option);
    }
    select.append(group);
  }
  select.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('kind', select.value);
    location.assign(url.href);
  });
  label.append(caption, select); nav.append(label);
  document.title = `${labels[kind]} · Selantis`;
}

defineChapter({
  id: 'dev-interactions', order: 905, numeral: 'Dev', title: 'Interaktionen', hidden: true,
  scenes: [{
    id: 'interaction-demo', title: 'Story-Aktionen und Versteckspiele',
    async start() {
      const requested = new URLSearchParams(location.search).get('kind') ?? 'cover';
      const kind = [...story, ...stealth, ...extras].find(k => k === requested) ?? 'cover';
      G.ui.setHud('none');
      G.ui.letterbox(false);
      const art = manifest();
      const backdrops: Partial<Record<PreviewKind, string>> = {
        cover: 'art-gallery-meadow', duck: 'k1-heimweg', listen: 'k3-leselager',
        tend: 'k4-bach', bellows: 'minigame-forge', stake: 'k2-lager',
      };
      const background = art.backgrounds[backdrops[kind] ?? 'k2-lager'];
      if (kind === 'reach' || kind === 'lift' || kind === 'open-eyes') await G.ui.plate(kind === 'reach' ? 'prolog-hoehle' : kind === 'lift' ? 'prolog-wiege' : 'k2-geweckt', { pan: 'none' });
      else {
        G.ui.registerPlate('demo-interaction-backdrop', () => assetUrl(background.file));
        await G.ui.plate('demo-interaction-backdrop', { pan: 'none' });
      }
      G.ui.letterbox(false);
      previewPicker(kind);
      if (kind === 'stake') {
        const song = startSong({ volume: 0.6 });
        try { await stakeGame(song); } finally { song.stop(); }
      } else if (story.includes(kind as StoryActionKind)) await G.ui.storyAction(kind as StoryActionKind, labels[kind], kind === 'open-eyes' ? { backdrop: 'k2-geweckt' } : {});
      else await G.ui.stealthGame(kind as StealthKind, labels[kind]);
      G.state.set('demo-interaction-done');
      await G.ui.think('Fertig. Die Geschichte kann weitergehen.');
    },
  }],
});
