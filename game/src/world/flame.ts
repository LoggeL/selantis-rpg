import Phaser from 'phaser';
import type { LightRuntime } from './lighting';

/**
 * Flame particles at a light source (LightDef.flame): additive tongues that rise and shrink from yellow to red,
 * plus a few drifting embers. Used for fires over painted fire pits; the light itself flickers in Lighting.
 */
export class Flame {
  private tongues: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly lightId: string;

  constructor(scene: Phaser.Scene, private light: LightRuntime, size: number, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    this.lightId = light.id;
    const x = light.x, y = light.y;
    const s = size;
    this.smoke = add(scene.add.particles(x, y - 10 * s, 'w-dust', {
      lifespan: { min: 1400, max: 2400 }, speedY: { min: -14 * s, max: -24 * s }, speedX: { min: -3, max: 3 },
      scale: { start: 0.6 * s, end: 2.4 * s }, alpha: { start: 0.22, end: 0 }, tint: 0x6a6670, frequency: 160, quantity: 1,
    }));
    this.tongues = add(scene.add.particles(x, y, 'w-flame', {
      lifespan: { min: 380, max: 620 }, speedY: { min: -20 * s, max: -38 * s }, speedX: { min: -5 * s, max: 5 * s },
      scale: { start: 1.25 * s, end: 0.25 }, alpha: { start: 0.95, end: 0 },
      color: [0xfff4b8, 0xffc04a, 0xff7a2a, 0xc23a1c], colorEase: 'Quad.easeIn',
      blendMode: Phaser.BlendModes.ADD, frequency: 26 / s, quantity: 1,
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 12 * s, 4 * s), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    }));
    this.embers = add(scene.add.particles(x, y - 4 * s, 'w-ember', {
      lifespan: { min: 900, max: 1700 }, speedY: { min: -26 * s, max: -52 * s }, speedX: { min: -12, max: 12 },
      scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, color: [0xffe08a, 0xff8a3a, 0xa02c18],
      blendMode: Phaser.BlendModes.ADD, frequency: 140 / s, quantity: 1,
    }));
    this.smoke.setDepth(y + 2);
    this.tongues.setDepth(y + 1);
    this.embers.setDepth(y + 3);
  }

  update(_dt: number, wind: number): void {
    const l = this.light;
    const on = l.intensity * l.fade > 0.05;
    for (const e of [this.tongues, this.embers, this.smoke]) {
      if (on !== e.emitting) { if (on) e.start(); else e.stop(); }
    }
    this.tongues.setPosition(l.x, l.y);
    this.embers.setPosition(l.x, l.y - 4);
    this.smoke.setPosition(l.x, l.y - 10);
    const ax = (wind - 0.3) * 30;
    this.tongues.accelerationX = ax;
    this.embers.accelerationX = ax * 1.5;
    this.smoke.accelerationX = ax * 2;
  }

  destroy(): void {
    this.tongues.destroy();
    this.embers.destroy();
    this.smoke.destroy();
  }
}
