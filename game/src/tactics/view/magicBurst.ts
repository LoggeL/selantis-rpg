import Phaser from 'phaser';
import { G } from '../../core/G';
import { settings } from '../../core/settings';
import type { Fx } from './fx';
import type { UnitView } from './units';

const BLUE = 0x398cff;
const PALE = 0xb9e4ff;
const DEPTH = 900000;

/** The complete in-engine beat resolves before the story illustration may open. */
export async function playMagicBurst(scene: Phaser.Scene, fx: Fx, caster: UnitView, cast: UnitView[], thrown?: string): Promise<void> {
  const feet = caster.feet, chest = caster.chest;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const own = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objects.push(o); return o; };
  const tween = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => new Promise<void>(resolve => {
    scene.tweens.add({ ...cfg, onComplete: () => resolve() });
  });
  const cam = scene.cameras.main;
  const shade = own(scene.add.rectangle(cam.midPoint.x, cam.midPoint.y, cam.width / cam.zoom + 40, cam.height / cam.zoom + 40, 0x04102b, 0)
    .setDepth(DEPTH - 2));
  const halo = own(scene.add.image(chest.x, chest.y, 'tac-glow').setTint(BLUE).setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH).setAlpha(0).setScale(0.8));
  const aura = own(scene.add.graphics().setDepth(DEPTH + 1).setBlendMode(Phaser.BlendModes.ADD));
  const eyes = own(scene.add.graphics().setDepth(DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD));
  const st = { power: 0 };
  let motes: Phaser.Time.TimerEvent | undefined;
  try {
    caster.play('cast');
    G.audio.sfx('heartbeat', { volume: 0.6 });
    G.audio.sfx('magic', { volume: 0.65, pitch: 0.7 });
    motes = scene.time.addEvent({ delay: 160, loop: true, callback: () => {
      fx.burst(chest.x, chest.y + 10, { color: [BLUE, PALE, 0xf0faff], count: 5, speed: 24, gravity: -65, life: 650, blend: true });
    } });
    await tween({ targets: st, power: 1, duration: 1900, ease: 'Sine.easeIn', onUpdate: () => {
      const p = st.power;
      shade.setFillStyle(0x04102b, p * 0.3);
      halo.setScale(0.8 + p * 2.6).setAlpha(p * 0.6);
      aura.clear();
      aura.fillStyle(BLUE, p * 0.16).fillEllipse(chest.x, chest.y, 22 + p * 28, 40 + p * 22);
      aura.lineStyle(1 + p, PALE, p * 0.8).strokeEllipse(feet.x, feet.y, 28 + p * 35, 14 + p * 17);
      eyes.clear();
      // A small blue glint at face height, above the glow around Lia's body.
      const eyeY = caster.head.y + 13;
      eyes.fillStyle(BLUE, p * 0.65).fillEllipse(chest.x, eyeY, 12, 6);
      eyes.fillStyle(0xeaf6ff, p).fillRect(chest.x - 4, eyeY - 1, 2, 2).fillRect(chest.x + 2, eyeY - 1, 2, 2);
    } });
    motes.remove(); motes = undefined;
    await fx.charge(chest.x, chest.y, BLUE, 350);
    G.audio.sfx('urmacht', { volume: 1.2 });
    G.audio.sfx('shockwave', { volume: 1.2 });
    if (!settings.reducedMotion) cam.shake(500, 0.009);
    fx.burst(chest.x, chest.y, { color: [BLUE, 0x66bbff, PALE, 0xf3fbff], count: 100, speed: 210, gravity: -12, life: 1250, scale: 1.8, blend: true });

    const wave = { radius: 8, alpha: 1 };
    const blast = tween({ targets: wave, radius: 230, alpha: 0, duration: 1350, ease: 'Cubic.easeOut', onUpdate: () => {
      aura.clear();
      const r = wave.radius, a = wave.alpha;
      aura.fillStyle(BLUE, 0.2 * a).fillEllipse(feet.x, feet.y - 14, r * 2, r * 1.15);
      aura.lineStyle(6 * a + 1, BLUE, a).strokeEllipse(feet.x, feet.y, r * 2, r);
      aura.lineStyle(2, PALE, a * 0.9).strokeEllipse(feet.x, feet.y, r * 1.92, r * 0.96);
      // Radial streaks read as an explosion rather than a shield around the caster.
      if (!settings.reducedMotion) for (let i = 0; i < 18; i++) {
        const angle = i * Math.PI * 2 / 18;
        aura.lineStyle(i % 3 ? 1 : 3, i % 2 ? PALE : BLUE, a * 0.8);
        aura.lineBetween(chest.x + Math.cos(angle) * r * 0.3, chest.y + Math.sin(angle) * r * 0.22,
          chest.x + Math.cos(angle) * r, chest.y + Math.sin(angle) * r * 0.72);
      }
      halo.setScale(3.4 + (1 - a) * 4).setAlpha(a * 0.7);
    } });
    const reactions = cast.filter(v => v !== caster && !v.unit.down).map(async v => {
      const dx = v.feet.x - feet.x, dy = v.feet.y - feet.y, distance = Math.hypot(dx, dy) || 1;
      await fx.wait(Math.min(450, distance * 2));
      v.play('hit');
      if (v.unit.id === thrown) {
        const from = { x: v.gx, y: v.gy };
        const gx = v.gx - caster.gx, gy = v.gy - caster.gy, gridDistance = Math.hypot(gx, gy) || 1;
        const flight = { t: 0 };
        await tween({ targets: flight, t: 1, duration: settings.reducedMotion ? 800 : 950, ease: 'Quad.easeOut', onUpdate: () => {
          const t = flight.t;
          v.gx = from.x + gx / gridDistance * 2.7 * t;
          v.gy = from.y + gy / gridDistance * 2.7 * t;
          v.oy = settings.reducedMotion ? 0 : -Math.sin(Math.PI * t) * 44;
        } });
        v.oy = 0; v.play('fall');
        fx.dust(v.feet.x, v.feet.y, v.depth(), 18);
        G.audio.sfx('thud', { volume: 0.9 });
      } else {
        const enemy = v.unit.team === 'enemy';
        await tween({ targets: v, ox: dx / distance * (enemy ? 16 : 4), oy: dy / distance * (enemy ? 8 : 2),
          duration: settings.reducedMotion ? 400 : 200, yoyo: true, ease: 'Quad.easeOut' });
        v.idle();
      }
    });
    await Promise.all([blast, ...reactions, fx.ring(feet.x, feet.y, BLUE, 200, 1200)]);
    // Let the blue motes settle while the battlefield and the surrounding cast are still visible.
    await tween({ targets: [halo, aura, eyes, shade], alpha: 0, duration: 650 });
    await fx.wait(550);
  } finally {
    motes?.remove();
    objects.forEach(o => o.destroy());
  }
}
