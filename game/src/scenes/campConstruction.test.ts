import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn() }));
vi.mock('../story/StoryScene', () => ({ StoryScene: class { update() {} } }));
import { JourneyScene } from './JourneyScene';
import { updateSettings } from '../settings';

function graphics() {
  const g: any = {};
  for (const name of ['clear', 'setVisible', 'setPosition', 'setDepth', 'setScale', 'setAlpha', 'setAngle', 'fillStyle', 'fillRect', 'lineStyle', 'lineBetween', 'setOrigin', 'setSize', 'destroy']) g[name] = vi.fn(() => g);
  return g;
}
function camp(flags: Record<string, boolean> = {}, inv: Record<string, number> = { reisezeug: 1, proviant: 1 }) {
  const s: any = new JourneyScene(), world = { flags, inv };
  s.registry = { get: () => world };
  s.data = { set: vi.fn() };
  s.textures = { exists: () => true };
  s.campBackground = { setTexture: vi.fn() };
  s.lia = { setPosition: vi.fn(() => s.lia), setDepth: vi.fn(() => s.lia) };
  s.cloak = graphics(); s.blanket = graphics(); s.flame = graphics();
  s.campStones = graphics(); s.campTwigs = graphics();
  s.areaRoot = { list: [s.campBackground], add: vi.fn() };
  s.add = { graphics, rectangle: graphics, image: graphics };
  s.time = { delayedCall: vi.fn() }; s.keys = { E: { isDown: false } };
  for (const method of ['campSpots', 'setLocked', 'say', 'setLiaPose', 'wakeEncounter']) s[method] = vi.fn();
  s.hud = { hint: vi.fn() };
  return { s, world };
}

describe('self-built evening camp', () => {
  it('puts gathered resources into the bag and consumes each exactly once', () => {
    const { s, world } = camp();
    s.campStep = 'cloak'; s.useCampSpot('bedroll'); expect(s.campStep).toBe('stones');
    s.useCampSpot('fire'); expect(world.inv.steine).toBeUndefined();
    s.useCampSpot('stones'); expect(world.inv.steine).toBe(6); expect(s.campStep).toBe('ring');
    s.useCampSpot('stones'); expect(world.inv.steine).toBe(6);
    s.useCampSpot('fire'); expect(world.inv.steine).toBeUndefined(); expect(world.flags.journeyFirepitBuilt).toBe(true);
    s.useCampSpot('twigs'); expect(world.inv.zunderholz).toBe(1);
    s.useCampSpot('twigs'); expect(world.inv.zunderholz).toBe(1);
    s.useCampSpot('fire'); expect(s.fireBusy).toBe(true);
    s.inCamp = true; s.fireClick = true; s.friction = 1090; s.update(0, 20);
    expect(world.inv.zunderholz).toBeUndefined(); expect(world.flags.campfireLit).toBe(true); expect(s.campStep).toBe('meal');
    s.useCampSpot('fire'); expect(world.flags.journeyProviantPortionUsed).toBe(true);
    expect(world.inv.proviant).toBe(1); expect(s.campStep).toBe('sleep');
    expect(world.flags).not.toHaveProperty('journeyFeetChecked');
    s.update(20, 20); expect(world.inv.zunderholz).toBeUndefined();
  });

  it('requires actual bag resources before building or lighting a fire', () => {
    const { s, world } = camp();
    s.campStep = 'ring'; s.useCampSpot('fire');
    expect(world.flags.journeyFirepitBuilt).toBeUndefined(); expect(s.campStep).toBe('ring');
    s.campStep = 'fire'; s.useCampSpot('fire'); expect(s.fireBusy).toBe(false);
    world.flags.journeyFirepitBuilt = true; s.useCampSpot('fire'); expect(s.fireBusy).toBe(false);
  });

  it('restores unfinished resource collection and accepts completed fireplaces from existing saves', () => {
    const { s, world } = camp({ journeyCloakSpread: true, journeyStonesGathered: true }, { reisezeug: 1, proviant: 1, steine: 6 });
    s.setupCamp(false); expect(s.campStep).toBe('ring'); expect(world.inv.steine).toBe(6);
    s.useCampSpot('fire'); expect(world.inv.steine).toBeUndefined();
    world.flags.campfireLit = true; world.flags.journeyTwigsGathered = true;
    delete world.flags.journeyFirepitBuilt; delete world.flags.journeyStonesGathered;
    s.setupCamp(false); expect(s.campStep).toBe('meal'); expect(world.flags.journeyFirepitBuilt).toBe(true);
    expect(world.inv.steine).toBeUndefined();
  });

  it('keeps preparation at dusk, then switches to night after sleep before the encounter', () => {
    const { s, world } = camp(); s.setupCamp(true);
    expect(s.data.set).toHaveBeenLastCalledWith('story:camp-time', 'dusk');
    expect(s.campBackground.setTexture).not.toHaveBeenCalled();
    expect(s.fireRing.setVisible).toHaveBeenLastCalledWith(false);
    expect(s.flame.setVisible).toHaveBeenLastCalledWith(false); // No preset fireplace or fire before construction.
    s.campStep = 'sleep'; s.sleep(); expect(world.flags.firstCampRested).toBeUndefined();
    expect(s.wakeEncounter).not.toHaveBeenCalled();
    s.time.delayedCall.mock.calls[0][1]();
    expect(world.flags.firstCampRested).toBe(true);
    expect(s.campBackground.setTexture).toHaveBeenCalledWith('bg-first-camp-night');
    expect(s.data.set).toHaveBeenLastCalledWith('story:camp-time', 'night');
    expect(s.wakeEncounter).not.toHaveBeenCalled();
    expect(s.time.delayedCall.mock.calls[1][0]).toBeGreaterThanOrEqual(2500);
    s.time.delayedCall.mock.calls[1][1](); expect(s.wakeEncounter).toHaveBeenCalledOnce();
    s.setupCamp(false); expect(s.data.set).toHaveBeenLastCalledWith('story:camp-time', 'night');
  });

  it('shows both strangers crossing the map before the sleeping-Lia closeup', () => {
    updateSettings({ reducedMotion: false });
    const { s } = camp();
    const actor = (x: number, y: number) => ({ active: true, x, y, angle: 0,
      setPosition(nx: number, ny: number) { this.x = nx; this.y = ny; return this; },
      setAngle(angle: number) { this.angle = angle; return this; } });
    s.foltan = actor(545, 282); s.azar = actor(563, 296);
    s.arrivalActive = true; s.observeSleepingLia = vi.fn();
    for (let i = 0; i < 30; i++) s.updateArrival(50);
    expect(s.foltan.x).toBeGreaterThan(259); expect(s.foltan.x).toBeLessThan(545);
    expect(s.azar.x).toBeGreaterThan(295); expect(s.azar.x).toBeLessThan(563);
    expect(s.observeSleepingLia).not.toHaveBeenCalled();
    for (let i = 0; i < 64; i++) s.updateArrival(50);
    expect([s.foltan.x, s.foltan.y, s.azar.x, s.azar.y]).toEqual([259, 245, 295, 242]);
    expect(s.observeSleepingLia).toHaveBeenCalledOnce();
    s.updateArrival(50); expect(s.observeSleepingLia).toHaveBeenCalledOnce();
  });

  it('completes map entry when reduced motion is switched on during arrival', () => {
    updateSettings({ reducedMotion: false });
    const { s } = camp();
    s.foltan = graphics(); s.foltan.active = true;
    s.azar = graphics(); s.azar.active = true;
    s.arrivalActive = true; s.arrivalClock = 400; s.observeSleepingLia = vi.fn();
    updateSettings({ reducedMotion: true });
    s.updateArrival(50);
    expect(s.foltan.setPosition).toHaveBeenLastCalledWith(259, 245);
    expect(s.azar.setPosition).toHaveBeenLastCalledWith(295, 242);
    expect(s.observeSleepingLia).not.toHaveBeenCalled();
    for (let i = 0; i < 4; i++) s.updateArrival(50);
    expect(s.observeSleepingLia).toHaveBeenCalledOnce();
    updateSettings({ reducedMotion: false });
  });
});
