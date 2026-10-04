import type { CharacterSpec } from '../api';

/**
 * Character presets. Looks follow DESIGN.md §3 „Figuren-Referenz“ (novel descriptions or original designs).
 * ACTOR PRIVACY: none of these are modelled on film actors — faces, hair and costumes are our own.
 *
 * Colours are palette ramp names (see palette.ts) or hex strings.
 */

/** Extra presentation hints not covered by CharacterSpec. */
export interface CharExtras {
  /** Eye colour used by portraits. */
  eyes?: string;
  /** Colour of hand magic (cast). */
  magic?: string;
  /** Age hint for portraits: wrinkles, etc. */
  age?: 'young' | 'adult' | 'old';
  /** Portrait expression bias. */
  brows?: 'soft' | 'heavy' | 'thin';
  /** Accent colour (portrait background tint). */
  accent?: string;
}

export type Preset = CharacterSpec & { x?: CharExtras };

const shadowTabard = { style: 'tabard', color: 'black', trim: 'white' };

export const PRESETS: Record<string, Preset> = {
  // --- the sisters -------------------------------------------------------------------------
  'lia': {
    body: 'slim', skin: 'skinPale', ears: 'human',
    hair: { style: 'curly-up', color: 'strawberry' },
    top: { style: 'blouse', color: 'cream' },
    bottom: { style: 'skirt', color: 'leather' },
    extra: ['clogs', 'freckles-light'],
    x: { eyes: 'green', age: 'young', accent: 'urmacht', brows: 'soft' },
  },
  'lia-barefoot': {
    body: 'slim', skin: 'skinPale', ears: 'human',
    hair: { style: 'curly-up', color: 'strawberry' },
    top: { style: 'blouse', color: 'cream' },
    bottom: { style: 'skirt', color: 'leather' },
    extra: ['barefoot', 'freckles-light'],
    x: { eyes: 'green', age: 'young', accent: 'urmacht', brows: 'soft' },
  },
  'lia-cloak': {
    body: 'slim', skin: 'skinPale', ears: 'human',
    hair: { style: 'curly-ribbon', color: 'strawberry' },
    top: { style: 'blouse', color: 'cream' },
    bottom: { style: 'skirt', color: 'leather' },
    cloak: { style: 'hooded', color: 'green', trim: 'olive' },
    extra: ['satchel', 'laced-shoes', 'freckles-light'],
    x: { eyes: 'green', age: 'young', accent: 'urmacht', brows: 'soft' },
  },
  'kyra': {
    body: 'slim', skin: 'skin', ears: 'human',
    hair: { style: 'long', color: 'nut' },
    top: { style: 'dress', color: 'linen' },
    bottom: { style: 'none', color: 'linen' },
    extra: ['necklace', 'boots-low'],
    x: { eyes: 'brown', age: 'young', accent: 'gold', brows: 'soft' },
  },
  'kyra-bound': {
    body: 'slim', skin: 'skin', ears: 'human',
    hair: { style: 'long-tied', color: 'nut' },
    top: { style: 'dress', color: 'linen' },
    bottom: { style: 'none', color: 'linen' },
    extra: ['necklace', 'boots-low', 'bound', 'bruise'],
    x: { eyes: 'brown', age: 'young', accent: 'gold', brows: 'soft' },
  },
  // --- prologue --------------------------------------------------------------------------
  'valentus': {
    body: 'normal', skin: 'skin', ears: 'human',
    hair: { style: 'shoulder', color: 'ash' },
    beard: { style: 'full', color: 'ash' },
    top: { style: 'robe', color: 'white', trim: 'blue' },
    bottom: { style: 'none', color: 'white' },
    extra: ['sash-blue', 'boots-low'],
    x: { eyes: 'blue', magic: 'urmacht', age: 'old', accent: 'urmacht', brows: 'heavy' },
  },
  'valentus-cloak': {
    body: 'normal', skin: 'skin', ears: 'human',
    hair: { style: 'shoulder', color: 'ash' },
    beard: { style: 'full', color: 'ash' },
    top: { style: 'robe', color: 'white', trim: 'blue' },
    bottom: { style: 'none', color: 'white' },
    cloak: { style: 'worn', color: '#5a5048', trim: '#3e3632' },
    extra: ['wounded', 'boots-low'],
    x: { eyes: 'blue', magic: 'urmacht', age: 'old', accent: 'urmacht', brows: 'heavy' },
  },
  'mother': {
    body: 'slim', skin: 'skinPale', ears: 'human',
    hair: { style: 'long-curly', color: 'copper' },
    top: { style: 'dress', color: 'earth' },
    bottom: { style: 'none', color: 'earth' },
    extra: ['apron', 'boots-low'],
    x: { eyes: 'green', age: 'adult', accent: 'green', brows: 'soft' },
  },
  'father': {
    body: 'broad', skin: 'skinTan', ears: 'human',
    hair: { style: 'short', color: 'greybrown' },
    beard: { style: 'stubble', color: 'greybrown' },
    top: { style: 'vest', color: 'leather', trim: 'linen' },
    bottom: { style: 'pants', color: 'mud' },
    extra: ['boots', 'belt'],
    x: { eyes: 'brown', age: 'adult', accent: 'straw', brows: 'heavy' },
  },
  // --- companions ------------------------------------------------------------------------
  'foltan': {
    body: 'normal', skin: 'skinTan', ears: 'human',
    hair: { style: 'short', color: 'nut' },
    beard: { style: 'goatee', color: 'nut' },
    head: { style: 'beret', color: 'leather' },
    top: { style: 'tabard', color: 'blue', trim: 'yellow' },
    bottom: { style: 'pants', color: 'mud' },
    weapon: 'crossbow',
    extra: ['boots', 'belt', 'sword-hip'],
    x: { eyes: 'grey', age: 'adult', accent: 'blue', brows: 'thin' },
  },
  'azar': {
    body: 'broad', skin: 'skinTan', ears: 'human',
    hair: { style: 'short', color: 'coal' },
    beard: { style: 'short', color: 'coal' },
    head: { style: 'cap', color: 'red' },
    top: { style: 'tunic', color: 'yellow', trim: 'orange' },
    bottom: { style: 'pants', color: 'rust' },
    weapon: 'scimitar',
    extra: ['boots', 'belt', 'belly'],
    x: { eyes: 'brown', age: 'adult', accent: 'yellow', brows: 'heavy' },
  },
  'flick': {
    body: 'slim', skin: 'skinTan', ears: 'elf',
    hair: { style: 'short-messy', color: 'coal' },
    top: { style: 'vest', color: 'leather', trim: 'olive' },
    bottom: { style: 'pants', color: 'mud' },
    cloak: { style: 'hunter', color: 'olive', trim: 'leather' },
    weapon: 'bow',
    extra: ['quiver', 'bracers', 'knife', 'boots', 'streak', 'freckles'],
    x: { eyes: 'amber', age: 'young', accent: 'olive', brows: 'thin' },
  },
  // --- the Free Brotherhood / tavern ------------------------------------------------------
  'craupor': {
    body: 'slim', skin: 'skinPale', ears: 'human',
    hair: { style: 'bald', color: 'ash' },
    top: { style: 'shirt', color: 'cream' },
    bottom: { style: 'pants', color: 'mud' },
    extra: ['apron', 'boots-low'],
    x: { eyes: 'grey', age: 'adult', accent: 'straw', brows: 'thin' },
  },
  'elnon': {
    body: 'normal', skin: 'skinPale', ears: 'elf',
    hair: { style: 'braid-long', color: 'coal' },
    top: { style: 'tunic', color: 'green', trim: 'gold' },
    bottom: { style: 'pants', color: 'leather' },
    weapon: 'axe',
    extra: ['boots', 'belt', 'tall'],
    x: { eyes: 'grey', age: 'adult', accent: 'green', brows: 'thin' },
  },
  'alastir': {
    body: 'slim', skin: 'skinPale', ears: 'elf',
    hair: { style: 'long', color: 'silver' },
    top: { style: 'tunic', color: 'green', trim: 'olive' },
    bottom: { style: 'pants', color: 'leather' },
    cloak: { style: 'cape', color: 'earth', trim: 'leather' },
    extra: ['boots', 'belt', 'burn-left', 'tall'],
    x: { eyes: 'teal', age: 'adult', accent: 'earth', brows: 'thin' },
  },
  'barmaid': {
    body: 'slim', skin: 'skin', ears: 'human',
    hair: { style: 'bun', color: 'straw' },
    top: { style: 'dress', color: 'red', trim: 'cream' },
    bottom: { style: 'none', color: 'red' },
    extra: ['apron', 'boots-low', 'blush'],
    x: { eyes: 'blue', age: 'young', accent: 'red', brows: 'soft' },
  },
  'guard-brotherhood': {
    body: 'normal', skin: 'skinTan', ears: 'human',
    hair: { style: 'short', color: 'earth' },
    head: { style: 'hood', color: 'olive' },
    top: { style: 'leather', color: 'leather', trim: 'olive' },
    bottom: { style: 'pants', color: 'mud' },
    weapon: 'spear',
    extra: ['boots', 'belt'],
    x: { eyes: 'brown', age: 'adult', accent: 'olive' },
  },
  // --- the Dunkelschatten -----------------------------------------------------------------
  'orwen': {
    body: 'normal', skin: 'skinPale', ears: 'human',
    hair: { style: 'stringy', color: 'ash' },
    top: { style: 'coat', color: 'coal', trim: 'gold' },
    bottom: { style: 'pants', color: 'black' },
    weapon: 'sword',
    extra: ['boots', 'gloves', 'brooch', 'gaunt'],
    x: { eyes: 'grey', age: 'old', accent: 'night', brows: 'thin' },
  },
  'baris': {
    body: 'huge', skin: 'skinTan', ears: 'human',
    hair: { style: 'buzz', color: 'coal' },
    beard: { style: 'bushy', color: 'coal' },
    top: { style: 'plate', color: 'iron', trim: 'coal' },
    bottom: { style: 'pants', color: 'black' },
    weapon: 'axe',
    extra: ['boots', 'pauldrons', 'gloves'],
    x: { eyes: 'black', age: 'adult', accent: 'red', brows: 'heavy' },
  },
  'baris-scarred': {
    body: 'huge', skin: 'skinTan', ears: 'human',
    hair: { style: 'buzz', color: 'coal' },
    beard: { style: 'bushy', color: 'coal' },
    top: { style: 'plate', color: 'iron', trim: 'coal' },
    bottom: { style: 'pants', color: 'black' },
    weapon: 'axe',
    extra: ['boots', 'pauldrons', 'gloves', 'burn-right', 'blind-eye'],
    x: { eyes: 'black', age: 'adult', accent: 'violet', brows: 'heavy' },
  },
  'baris-young': {
    body: 'broad', skin: 'skinTan', ears: 'human',
    hair: { style: 'buzz', color: 'coal' },
    beard: { style: 'short', color: 'coal' },
    top: { style: 'tabard', color: 'black', trim: 'white' },
    bottom: { style: 'pants', color: 'black' },
    weapon: 'axe',
    extra: ['boots', 'mail-sleeves', 'belt'],
    x: { eyes: 'black', age: 'young', accent: 'red', brows: 'heavy' },
  },
  'vamir': {
    body: 'normal', skin: 'skinPale', ears: 'human',
    hair: { style: 'bald', color: 'black' },
    head: { style: 'hood-deep', color: 'black' },
    top: { style: 'robe', color: 'black', trim: 'violet' },
    bottom: { style: 'none', color: 'black' },
    extra: ['smoke', 'faceless', 'tall'],
    x: { eyes: 'violet', magic: 'violet', age: 'old', accent: 'violet' },
  },
  'algard': {
    body: 'normal', skin: 'skin', ears: 'human',
    hair: { style: 'short-messy', color: 'nut' },
    top: shadowTabard,
    bottom: { style: 'pants', color: 'ash' },
    weapon: 'sword',
    extra: ['boots', 'belt', 'scar-right', 'stubble'],
    x: { eyes: 'brown', age: 'adult', accent: 'red', brows: 'heavy' },
  },
  'maedchen': {
    body: 'normal', skin: 'skinPale', ears: 'human',
    hair: { style: 'bald', color: 'nut' },
    top: shadowTabard,
    bottom: { style: 'pants', color: 'ash' },
    weapon: 'spear',
    extra: ['boots', 'belt', 'blush'],
    x: { eyes: 'blue', age: 'young', accent: 'pink', brows: 'thin' },
  },
  'harro': {
    body: 'normal', skin: 'skinTan', ears: 'human',
    hair: { style: 'short', color: 'mud' },
    head: { style: 'cap', color: 'ash' },
    top: shadowTabard,
    bottom: { style: 'pants', color: 'ash' },
    weapon: 'club',
    extra: ['boots', 'belt'],
    x: { eyes: 'brown', age: 'adult', accent: 'mud', brows: 'heavy' },
  },
  'shadow-sword': {
    body: 'normal', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'nut' },
    head: { style: 'helmet', color: 'iron' }, top: shadowTabard, bottom: { style: 'pants', color: 'ash' },
    weapon: 'sword', shield: 'shadow', extra: ['boots', 'belt'],
  },
  'shadow-spear': {
    body: 'normal', skin: 'skinTan', ears: 'human', hair: { style: 'short', color: 'coal' },
    head: { style: 'coif', color: 'steel' }, top: shadowTabard, bottom: { style: 'pants', color: 'ash' },
    weapon: 'spear', extra: ['boots', 'belt'],
  },
  'shadow-crossbow': {
    body: 'normal', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'earth' },
    head: { style: 'cap', color: 'leather' }, top: shadowTabard, bottom: { style: 'pants', color: 'ash' },
    weapon: 'crossbow', extra: ['boots', 'belt'],
  },
  'shadow-axe': {
    body: 'broad', skin: 'skinTan', ears: 'human', hair: { style: 'buzz', color: 'nut' },
    top: shadowTabard, bottom: { style: 'pants', color: 'ash' }, beard: { style: 'short', color: 'nut' },
    weapon: 'axe', extra: ['boots', 'belt', 'mail-sleeves'],
  },
  'shadow-club': {
    body: 'normal', skin: 'skinDark', ears: 'human', hair: { style: 'short-messy', color: 'coal' },
    top: shadowTabard, bottom: { style: 'pants', color: 'ash' },
    weapon: 'club', extra: ['boots', 'belt'],
  },
  'shadow-rider': {
    body: 'normal', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'coal' },
    head: { style: 'helmet', color: 'iron' }, top: shadowTabard, bottom: { style: 'pants', color: 'black' },
    cloak: { style: 'cloak', color: 'black', trim: 'coal' }, weapon: 'sword', extra: ['boots', 'belt'],
  },
  'conspirator': {
    body: 'normal', skin: 'skinPale', ears: 'human', hair: { style: 'bald', color: 'black' },
    head: { style: 'hood-deep', color: '#3a1218' }, top: { style: 'robe', color: '#3a1218', trim: 'black' },
    bottom: { style: 'none', color: '#3a1218' }, extra: ['faceless', 'red-eyes'],
    x: { magic: 'red', accent: 'red' },
  },
  // --- the army of light --------------------------------------------------------------------
  'falke-soldier': {
    body: 'normal', skin: 'skinTan', ears: 'human', hair: { style: 'short', color: 'straw' },
    head: { style: 'helmet', color: 'steel' }, top: { style: 'tabard', color: 'blue', trim: 'yellow' },
    bottom: { style: 'pants', color: 'blue' }, weapon: 'twin-swords', extra: ['boots', 'belt', 'mail-sleeves'],
    x: { eyes: 'blue', age: 'young', accent: 'blue' },
  },
  'paladin': {
    body: 'normal', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'straw' },
    head: { style: 'helm-paladin', color: 'white' }, top: { style: 'plate', color: 'white', trim: 'gold' },
    bottom: { style: 'pants', color: 'white' }, weapon: 'spear', shield: 'light', extra: ['boots', 'pauldrons'],
    x: { eyes: 'blue', accent: 'gold' },
  },
  'council-mage': {
    body: 'normal', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'ash' },
    beard: { style: 'full', color: 'ash' },
    top: { style: 'robe', color: 'blue', trim: 'gold' }, bottom: { style: 'none', color: 'blue' },
    extra: ['sash-gold', 'boots-low'],
    x: { eyes: 'grey', magic: 'urmacht', age: 'old', accent: 'blue' },
  },
  'ignatius': {
    body: 'normal', skin: 'skinTan', ears: 'human', hair: { style: 'bald', color: 'ash' },
    beard: { style: 'long', color: 'silver' },
    top: { style: 'robe', color: 'orange', trim: 'red' }, bottom: { style: 'none', color: 'orange' },
    extra: ['sash-gold', 'boots-low'],
    x: { eyes: 'amber', magic: 'fire', age: 'old', accent: 'orange', brows: 'heavy' },
  },
  // --- folk ------------------------------------------------------------------------------
  'villager-m': {
    body: 'normal', skin: 'skinTan', ears: 'human', hair: { style: 'short', color: 'earth' },
    top: { style: 'shirt', color: 'linen' }, bottom: { style: 'pants', color: 'mud' }, extra: ['boots-low', 'belt'],
  },
  'villager-f': {
    body: 'slim', skin: 'skin', ears: 'human', hair: { style: 'braids', color: 'straw' },
    head: { style: 'headscarf', color: 'sky' },
    top: { style: 'dress', color: 'olive' }, bottom: { style: 'none', color: 'olive' }, extra: ['apron', 'boots-low'],
  },
  'merchant': {
    body: 'broad', skin: 'skin', ears: 'human', hair: { style: 'short', color: 'nut' }, beard: { style: 'goatee', color: 'nut' },
    head: { style: 'hat', color: 'violet' },
    top: { style: 'coat', color: 'violet', trim: 'gold' }, bottom: { style: 'pants', color: 'black' }, extra: ['boots', 'belt', 'satchel', 'belly'],
  },
  'juggler': {
    body: 'slim', skin: 'skin', ears: 'human', hair: { style: 'short-messy', color: 'ginger' },
    head: { style: 'jester', color: 'red', },
    top: { style: 'motley', color: 'red', trim: 'yellow' }, bottom: { style: 'pants', color: 'blue' }, extra: ['boots-low'],
  },
  'bard': {
    body: 'slim', skin: 'skinPale', ears: 'human', hair: { style: 'shoulder', color: 'nut' },
    head: { style: 'hat', color: 'green' },
    top: { style: 'tunic', color: 'teal', trim: 'gold' }, bottom: { style: 'pants', color: 'earth' }, weapon: 'lute', extra: ['boots'],
  },
  'dwarf': {
    body: 'dwarf' as CharacterSpec['body'], skin: 'skinTan', ears: 'human', hair: { style: 'short', color: 'copper' },
    beard: { style: 'braided', color: 'copper' }, head: { style: 'helmet', color: 'iron' },
    top: { style: 'mail', color: 'steel', trim: 'red' }, bottom: { style: 'pants', color: 'leather' }, weapon: 'axe', extra: ['boots', 'belt'],
  },
  'elf-m': {
    body: 'slim', skin: 'skinPale', ears: 'elf', hair: { style: 'long', color: 'straw' },
    top: { style: 'tunic', color: 'green', trim: 'gold' }, bottom: { style: 'pants', color: 'leather' }, weapon: 'bow', extra: ['boots', 'quiver', 'tall'],
  },
  'elf-f': {
    body: 'slim', skin: 'skinPale', ears: 'elf', hair: { style: 'braid-long', color: 'silver' },
    top: { style: 'dress', color: 'teal', trim: 'gold' }, bottom: { style: 'none', color: 'teal' }, extra: ['boots-low', 'necklace'],
  },
  'ghoul': {
    body: 'normal', skin: 'skinPale', ears: 'human', hair: { style: 'bald', color: 'black' },
    head: { style: 'hood-mask', color: '#2c2a24' }, top: { style: 'rags', color: '#3a3628', trim: '#24221c' },
    bottom: { style: 'none', color: '#3a3628' }, weapon: 'axe', extra: ['hunch', 'faceless'],
  },
};

/** Characters that get proper portraits (story characters). */
export const PORTRAIT_IDS = [
  'lia', 'lia-cloak', 'kyra', 'kyra-bound', 'valentus', 'valentus-cloak', 'mother', 'father', 'foltan', 'azar', 'craupor',
  'elnon', 'alastir', 'flick', 'orwen', 'baris', 'baris-scarred', 'baris-young', 'vamir', 'algard', 'maedchen', 'harro',
  'ignatius', 'barmaid', 'merchant', 'dwarf', 'bard', 'juggler', 'council-mage', 'falke-soldier', 'paladin',
];

export const ANIMAL_IDS = ['dog', 'horse', 'pig', 'chicken', 'hare', 'crow', 'deer'];
