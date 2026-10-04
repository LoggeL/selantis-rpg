/** Chapter 1, novel pages 6-8: establish Kyra before she finds her sister. */
export const KYRA_INTRO = [
  { art: 'cut-kyra-wood', line: 'Kyra sammelt Feuerholz. Lia hatte versprochen, ihr zu helfen. Wieder einmal ist sie nicht gekommen.' },
  { art: 'cut-kyra-forest', line: 'Mit dem Holz unter dem Arm stapft Kyra durch den lichten Wald. Laub und kleine Äste haben sich in ihren nussbraunen Haaren verfangen.' },
  { art: 'cut-kyra-discovery', line: 'Am Waldrand erblickt Kyra ihre Schwester. Lia sitzt noch immer am Baum und liest. Kyra legt das Holz ins Gras und schleicht sich von hinten an.' },
] as const;

export const CHAPTER_TRANSITION = { title: '14 Jahre später', titleFade: 700, titleHold: 2800, revealFade: 1000 } as const;
