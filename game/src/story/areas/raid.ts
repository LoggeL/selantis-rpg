import { hof } from '../../world/maps/hof';
import type { StoryArea } from '../types';

/** Same farm geography as arrival; world cardinal directions need not match screen axes. */
export const RAID_AREA: StoryArea = {
  id: 'raid-farm',
  name: 'Der Überfall',
  bg: 'bg-map-hof-open',
  start: [152, 201],
  walk: hof.walk,
  block: hof.block,
  targets: [
    { id: 'hide', at: [104, 185], radius: 17, label: 'In der Böschung verstecken' },
    { id: 'parents', at: [267, 207], radius: 20, label: 'Zu den Eltern gehen' },
  ],
};

/** Lia can approach the roadside cover, but cannot walk into the armed raiders. */
export const RAID_APPROACH_AREA: StoryArea = {
  ...RAID_AREA,
  id: 'raid-approach',
  walk: [[
    [0, 166], [30, 169], [60, 174], [95, 178], [120, 181], [150, 181], [174, 178],
    [174, 238], [150, 244], [130, 234], [100, 224], [70, 215], [40, 208], [15, 203], [0, 202],
  ]],
  targets: [RAID_AREA.targets[0]],
};
