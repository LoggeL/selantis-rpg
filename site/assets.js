const $ = id => document.getElementById(id);
const categories = { all: 'Alle', bg: 'Schauplätze', cut: 'Cutscenes', sprites: 'Sprites', portraits: 'Porträts', ui: 'UI & Items', social: 'Titel & Web' };
const names = {
  'bg-battle': 'Schlachtfeld', 'bg-flight-a': 'Flucht: Wald', 'bg-flight-b': 'Flucht: Schlucht',
  'bg-refuge-candle': 'Zuflucht im Kerzenlicht', 'bg-refuge-dark': 'Zuflucht bei Nacht', 'bg-lia': 'Lias Erwachen',
  'bg-map-waldrand': 'Waldrand', 'bg-map-felder': 'Felder', 'bg-map-hohlweg': 'Hohlweg', 'bg-map-hof': 'Hof', 'bg-map-hof-open': 'Hof: offenes Tor',
  'bg-farm-dawn': 'Hof im Morgengrauen', 'bg-farm-interior': 'Im Haus', 'bg-road-east': 'Straße nach Osten', 'bg-first-camp': 'Erstes Lager',
  'valentus-walk': 'Valentus: Gehen', 'valentus-cast': 'Valentus: Magie', 'valentus-cloak-run': 'Valentus: Flucht',
  'valentus-cloak-events': 'Valentus: Fluchtposen', 'valentus-refuge': 'Valentus: Zuflucht',
  warrior: 'Dunkelschatten: Schwert', axe: 'Dunkelschatten: Axt', crossbow: 'Dunkelschatten: Armbrust', boy: 'Junge', falke: 'Falke', woman: 'Frau',
  'lia-read': 'Lia: Lesen', 'lia-walk': 'Lia: Gehen', 'lia-hide': 'Lia: Verstecken', 'lia-story-poses': 'Lia: Storyposen',
  'crt-butterfly': 'Schmetterlinge', 'crt-bird': 'Vogel', 'crt-hare': 'Hase', 'crt-chicken': 'Huhn', 'crt-pig': 'Schwein', 'crt-fledgling': 'Jungvogel',
  'story-actors': 'Nebenfiguren', 'raid-horse': 'Pferd', 'raid-spearman': 'Speerträger', 'road-travelers': 'Reisende', 'road-travelers-walk': 'Reisende: Gehen',
  'story-items': 'Storygegenstände', icons: 'Aktionssymbole', items: 'Gegenstände', 'inventory-bag': 'Inventartasche', 'bag-open': 'Geöffnete Tasche',
  'cut-wound': 'Valentus verwundet', 'cut-woman': 'Die Frau in der Zuflucht', 'cut-cradle-sleep': 'An der Wiege', 'cut-cradle-empty': 'Leere Wiege',
  'cut-hand': 'Valentus hebt die Hand', 'cut-wound-mono': 'Verwundung: Erinnerung', 'cut-wound-red': 'Verwundung: Blut',
  'cut-lia-reading': 'Lia liest', 'cut-lia-kyra': 'Lia und Kyra', 'cut-family-graves': 'Familiengräber', 'cut-travel-pack': 'Aufbruch vorbereiten',
  'cut-camp-rest': 'Rast am Feuer', 'cut-camp-capture': 'Gefangennahme', 'cut-camp-companions': 'Gefährten im Lager', 'cut-camp-wake': 'Erwachen im Lager',
  'cinematic-raid-cover': 'Lia im Versteck', 'cinematic-raid-confrontation': 'Die Eltern und die Dunkelschatten', 'cinematic-raid-kyra': 'Kyras Entführung',
  'cinematic-raid-loss': 'Der Verlust', 'cinematic-raid-departure': 'Lias Abschied', 'cinematic-raid-father-stab': 'Angriff auf den Vater',
  'cinematic-raid-mother-stab': 'Angriff auf die Mutter', 'cinematic-raid-father-death': 'Der Vater fällt', 'cinematic-raid-mother-death': 'Die Mutter fällt',
  'cinematic-raid-parents-aftermath': 'Nach dem Überfall', 'prologue-power': 'Valentus: Machtdemonstration', 'prologue-conflict': 'Valentus: Konflikt',
  'prologue-falken': 'Die Falken', 'prologue-valentus': 'Valentus im Prolog', 'bg-title-splash': 'Titelbild', 'gameplay-shot': 'Spielvorschau',
};
const people = { valentus: 'Valentus', 'valentus-wounded': 'Valentus verwundet', lia: 'Lia', kyra: 'Kyra', foltan: 'Foltan', azar: 'Azar', father: 'Vater', mother: 'Mutter', woman: 'Frau', boy: 'Junge', 'grey-haired': 'Grauhaariger', scarred: 'Narbiger', hooded: 'Kapuzenmann', 'refuge-man': 'Mann in der Zuflucht', 'lia-grief': 'Lia: Trauer', 'lia-determined': 'Lia: Entschlossen' };
function title(asset) {
  if (asset.category === 'portraits') {
    const key = asset.file.split('/').pop().replace('.png', '').replace(/^dialogue-/, '');
    return `${people[key] ?? key}${asset.file.includes('/dialogue-') ? ' · Dialog' : ''}`;
  }
  return names[asset.id] ?? asset.id.replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
}

let assets = [], category = 'all', current, image, frame = 0, row = 0, timer, generation = 0;
const viewer = $('viewer');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function stop() {
  clearInterval(timer); timer = undefined;
  $('play').textContent = 'Abspielen'; $('play').setAttribute('aria-pressed', 'false');
}
function draw() {
  if (!current?.frameW || !image?.complete) return;
  const canvas = $('preview-frame'), context = canvas.getContext('2d');
  const { frameW, frameH, cols } = current;
  canvas.width = frameW; canvas.height = frameH;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, frameW, frameH);
  context.drawImage(image, frame * frameW, row * frameH, frameW, frameH, 0, 0, frameW, frameH);
  const scale = Math.max(1, Math.min(4, Math.floor(320 / Math.max(frameW, frameH))));
  canvas.style.width = `${frameW * scale}px`; canvas.style.height = `${frameH * scale}px`;
  $('frame').value = frame;
  $('frame-label').value = `${frame + 1} / ${cols}`;
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase('de');
  const shown = assets.filter(a => (category === 'all' || a.category === category) && `${a.title} ${a.id} ${a.file} ${categories[a.category]}`.toLocaleLowerCase('de').includes(query));
  const fragment = document.createDocumentFragment();
  for (const asset of shown) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'card';
    card.setAttribute('aria-label', `${asset.title}: Vorschau öffnen`);
    const preview = document.createElement('span'); preview.className = `thumbnail ${asset.category === 'portraits' ? 'portrait' : ''}`;
    if (asset.frameW) {
      preview.classList.add('checker');
      const sprite = document.createElement('span'); sprite.className = 'sprite-thumb';
      const scale = Math.min(2, 128 / Math.max(asset.frameW, asset.frameH));
      sprite.style.width = `${asset.frameW * scale}px`; sprite.style.height = `${asset.frameH * scale}px`;
      sprite.style.backgroundImage = `url("/${asset.url ?? asset.file}")`;
      sprite.style.backgroundSize = `${asset.width * scale}px ${asset.height * scale}px`;
      preview.append(sprite);
    } else {
      const img = document.createElement('img'); img.src = `/${asset.url ?? asset.file}`; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; preview.append(img);
    }
    const copy = document.createElement('span'); copy.className = 'card-copy';
    const name = document.createElement('strong'); name.textContent = asset.title;
    const meta = document.createElement('span'); meta.className = 'card-meta';
    const kind = document.createElement('span'); kind.textContent = categories[asset.category];
    const count = asset.cols * asset.rows;
    const size = document.createElement('span'); size.textContent = asset.frameW ? `${count} ${count === 1 ? 'Einzelbild' : 'Einzelbilder'}` : `${asset.width} × ${asset.height}`;
    meta.append(kind, size); copy.append(name, meta); card.append(preview, copy);
    card.addEventListener('click', () => open(asset)); fragment.append(card);
  }
  $('grid').replaceChildren(fragment);
  $('collection-title').textContent = category === 'all' ? 'Alle Assets' : categories[category];
  $('result-count').textContent = `${shown.length} von ${assets.length}`;
  $('empty').hidden = shown.length !== 0;
  for (const button of $('filters').children) button.setAttribute('aria-pressed', String(button.dataset.category === category));
}
function open(asset) {
  stop(); const version = ++generation; current = asset; frame = 0; row = 0;
  $('viewer-title').textContent = asset.title; $('viewer-category').textContent = categories[asset.category];
  $('filename').textContent = asset.file;
  $('dimensions').textContent = `${asset.width} × ${asset.height} px${asset.frameW ? ` · ${asset.frameW} × ${asset.frameH} px pro Einzelbild` : ''}`;
  $('download').href = `/${asset.url ?? asset.file}`; $('download').download = asset.file.split('/').pop();
  $('preview-image').src = `/${asset.url ?? asset.file}`; $('preview-image').alt = asset.title;
  $('preview-image').hidden = Boolean(asset.frameW); $('preview-frame').hidden = !asset.frameW;
  $('stage').classList.toggle('checker', Boolean(asset.frameW));
  $('sprite-controls').hidden = !asset.frameW; $('sheet').checked = false;
  if (asset.frameW) {
    $('preview-frame').getContext('2d').clearRect(0, 0, $('preview-frame').width, $('preview-frame').height);
    $('row').replaceChildren(...Array.from({ length: asset.rows }, (_, i) => new Option(`${i + 1}`, `${i}`)));
    $('row').disabled = asset.rows === 1;
    $('frame').max = asset.cols - 1; $('frame').disabled = asset.cols === 1;
    $('play').disabled = asset.cols === 1; $('frame-label').value = `1 / ${asset.cols}`;
    image = new Image();
    image.onload = () => { if (version === generation) draw(); };
    image.src = `/${asset.url ?? asset.file}`;
  }
  viewer.showModal(); $('close').focus();
}
async function load() {
  $('error').hidden = true; $('grid').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/assets/catalog.json');
    if (!response.ok) throw new Error('Assetkatalog nicht verfügbar');
    assets = (await response.json()).map(a => ({ ...a, title: title(a) }));
    $('total').textContent = assets.length;
    $('filters').replaceChildren(...Object.entries(categories).map(([key, label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.category = key;
      const count = document.createElement('small'); count.textContent = key === 'all' ? assets.length : assets.filter(a => a.category === key).length;
      button.setAttribute('aria-label', `${label} (${count.textContent})`);
      button.append(label, count); button.addEventListener('click', () => { category = key; render(); }); return button;
    }));
    render();
  } catch { $('error').hidden = false; }
  finally { $('grid').setAttribute('aria-busy', 'false'); }
}
$('search').addEventListener('input', render);
$('reset').addEventListener('click', () => { category = 'all'; $('search').value = ''; render(); });
$('retry').addEventListener('click', load);
$('close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => { stop(); generation++; });
viewer.addEventListener('click', event => { if (event.target === viewer) { const r = viewer.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) viewer.close(); } });
$('play').addEventListener('click', () => {
  if (timer) { stop(); return; }
  $('sheet').checked = false; $('sheet').dispatchEvent(new Event('change'));
  $('play').textContent = 'Pause'; $('play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => { frame = (frame + 1) % current.cols; draw(); }, 160);
});
$('row').addEventListener('change', () => { row = Number($('row').value); frame = 0; draw(); });
$('frame').addEventListener('input', () => { stop(); frame = Number($('frame').value); draw(); });
$('sheet').addEventListener('change', () => {
  if ($('sheet').checked) stop();
  $('preview-image').hidden = !$('sheet').checked; $('preview-frame').hidden = $('sheet').checked;
  $('frame').disabled = $('sheet').checked || current.cols === 1;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !viewer.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '') && !event.ctrlKey && !event.metaKey) { event.preventDefault(); $('search').focus(); }
});
load();
