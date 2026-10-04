export { GOLDEN_BOAR_CHAPTER } from './goldenBoar';
export { READING_CAMP_CHAPTER } from './readingCamp';
export { BROTHERHOOD_CHAPTER } from './brotherhood';
export { BETRAYAL_CHAPTER } from './betrayal';

import { GOLDEN_BOAR_CHAPTER } from './goldenBoar';
import { READING_CAMP_CHAPTER } from './readingCamp';
import { BROTHERHOOD_CHAPTER } from './brotherhood';
import { BETRAYAL_CHAPTER } from './betrayal';

export const NOVEL_CONTINUATION_CHAPTERS = [
  GOLDEN_BOAR_CHAPTER,
  READING_CAMP_CHAPTER,
  BROTHERHOOD_CHAPTER,
  BETRAYAL_CHAPTER,
] as const;
