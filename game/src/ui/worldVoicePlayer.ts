interface VoiceWorld {
  readonly alive: boolean;
  readonly player?: { readonly speaker: string };
  readonly sys: { isActive(): boolean };
}

/** A world only supplies the player's voice after it became ready in this story scene. */
export class WorldVoicePlayer {
  private readyWorld?: { scene: string; world: VoiceWorld };

  sceneChanged(): void { this.readyWorld = undefined; }

  ready(scene: string, world: VoiceWorld | undefined): void {
    this.readyWorld = world?.alive && world.sys.isActive() ? { scene, world } : undefined;
  }

  speaker(scene: string, world: VoiceWorld | undefined): string | undefined {
    const ready = this.readyWorld;
    if (!ready || ready.scene !== scene || ready.world !== world || !world?.alive || !world.sys.isActive()) return undefined;
    // Read the current actor, rather than retaining the character from an earlier map in this scene.
    return world.player?.speaker || undefined;
  }
}
