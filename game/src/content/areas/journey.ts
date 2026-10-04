export type RoadTargetId = 'farm-return' | 'stream' | 'fork' | 'east';
export type CampTargetId = 'fire' | 'bedroll' | 'stones' | 'twigs' | 'foltan' | 'azar' | 'fire-seat' | 'star' | 'road';

import type { StoryArea } from "../../modules/narrative/types";

/** Fields meet the painted north trail; the main road and bank reach the stream. */
export const ROAD_EAST_AREA: StoryArea<RoadTargetId> = {
  id: 'road-east', name: 'Die Straße nach Osten', bg: 'bg-road-east',
  start: [390, 70],
  walk: [
    [[0, 180], [640, 180], [640, 207], [0, 207]],
    [[236, 200], [273, 205], [270, 248], [235, 248]],
    [[401, 0], [440, 0], [417, 32], [404, 57], [402, 98], [406, 120], [400, 143], [390, 163], [387, 185], [347, 190], [355, 162], [365, 141], [374, 116], [374, 82], [371, 58], [381, 30]],
  ],
  block: [],
  targets: [
    { id: 'farm-return', at: [414, 14], radius: 18, label: 'Zu den Feldern zurück' },
    { id: 'stream', at: [243, 235], radius: 25, label: 'Trinken und Wasser auffüllen' },
    { id: 'fork', at: [435, 184], radius: 30, label: 'Wegweiser ansehen' },
    { id: 'east', at: [590, 193], radius: 30, label: 'Nach Osten weitergehen' },
  ],
};

/** Anchors use the final painted clearing and the approachable sides of its props. */
export const FIRST_CAMP_AREA: StoryArea<CampTargetId> = {
  id: 'first-camp', name: 'Das erste Lager in der Dämmerung', bg: 'bg-first-camp-evening',
  start: [535, 282],
  walk: [[[105, 180], [555, 180], [555, 315], [105, 315]]],
  block: [],
  targets: [
    { id: 'fire', at: [317, 225], radius: 27, label: 'Feuerstelle' },
    { id: 'bedroll', at: [233, 260], radius: 28, label: 'Grüner Regenmantel' },
    { id: 'stones', at: [155, 235], radius: 25, label: 'Lose Steine' },
    { id: 'twigs', at: [409, 251], radius: 27, label: 'Trockenes Laub und Zweige' },
    { id: 'foltan', at: [355, 231], radius: 22, label: 'Mit Foltan sprechen' },
    { id: 'azar', at: [397, 265], radius: 22, label: 'Azar ansehen' },
    { id: 'fire-seat', at: [288, 250], radius: 21, label: 'Ans Feuer setzen' },
    { id: 'star', at: [155, 188], radius: 27, label: 'In den westlichen Himmel sehen' },
    { id: 'road', at: [545, 282], radius: 27, label: 'Zur Straße' },
  ],
};
