import type { Dir } from "../exploration/mapTypes";

export type LiaAppearanceProfile = 'lia' | 'lia-farm' | 'lia-travel' | 'lia-cloak';
export interface LiaAppearanceInput {
  flags: Readonly<Record<string, boolean>>;
  areaId?: string;
  direction?: Dir;
  moving?: boolean;
  crouched?: boolean;
  pose?: string;
}

/** Historical preparation survives scene and map changes in the world flags. */
export function liaCloakOnGround(flags: LiaAppearanceInput['flags']): boolean {
  return !!flags.journeyCloakSpread && !flags.journeyCloakRecovered && !flags.companionMorningStarted;
}

export function resolveLiaAppearance(input: LiaAppearanceInput) {
  const { flags, areaId, moving = false, crouched = false, pose, direction = 's' } = input;
  const travelling = flags.packedClothes || flags.departureReady || flags.journeyCampReached || flags.companionMorningStarted;
  const bookGone = flags.parentDeath || flags.raidWitnessed || flags.parentsLost || flags.packedBooks;
  const sleeping = pose === 'lia-sleep' || pose === 'lia-wake';
  const cloakWorn = !sleeping && !liaCloakOnGround(flags) && (
    flags.journeyCloakRecovered || flags.companionMorningStarted || flags.companionDayComplete ||
    (areaId === 'first-camp' && !flags.journeyCloakSpread)
  );
  const profile: LiaAppearanceProfile = cloakWorn ? 'lia-cloak' : travelling ? 'lia-travel' : bookGone ? 'lia-farm' : 'lia';
  const animation = !moving && pose ? pose : `${crouched ? 'lia-crouch' : profile}-${moving ? 'walk' : 'idle'}-${direction}`;
  return {
    profile, texture: `${profile}-walk`, animation,
    bookUnderArm: profile === 'lia', cloakWorn: !!cloakWorn,
    cloakOnGround: liaCloakOnGround(flags),
    flipX: false,
  };
}
