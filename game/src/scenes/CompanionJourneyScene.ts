import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { COMPANION_AFTERNOON_AREA, COMPANION_MORNING_AREA } from '../story/areas/companionJourney';
import { COMPANION_ROAD_SCENE, MIDDAY_REST_LINES, companionFeetWalkable, companionObjective, companionPhase, type CompanionPhase } from '../story/companionJourney';
import { state } from '../world/quests';
import { setSceneMusic } from '../audio';
import { clearWalkingLine, findWalkingPath } from '../world/navigation';
import type { Pt, StoryArea } from '../story/types';
import { prepareWarp } from '../debugState';
import type { Dir } from '../world/maps';

/** Lia's next day, PDF pp. 40–44; the evening lead-in stops before the inn (p. 46). */
export class CompanionJourneyScene extends StoryScene {
  private phase: CompanionPhase = 'morning';
  private foltan?: Phaser.GameObjects.Sprite;
  private azar?: Phaser.GameObjects.Sprite;
  private talking = false;
  private previousLia: Pt = [0, 0];
  private trail: Pt[] = [];
  private lastHeading: Pt = [1, 0];
  private travelerRoutes = new Map<Phaser.GameObjects.Sprite, { goal: Pt; points: Pt[] }>();
  private travelerFacing = new Map<Phaser.GameObjects.Sprite, Dir>();
  private travelerShadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Image>();

  constructor() { super(COMPANION_ROAD_SCENE); }

  create() {
    const st = state(this.registry);
    // Only an explicit fresh development link creates the earlier checkpoints.
    if (new URLSearchParams(window.location.search).get('scene') === COMPANION_ROAD_SCENE && !st.flags.metFoltanAzar) prepareWarp(st, COMPANION_ROAD_SCENE);
    // A direct scene entry or old save still collects the bedroll before walking.
    st.flags.journeyCloakRecovered = true;
    this.phase = companionPhase(st); this.talking = false;
    const area = this.phase === 'morning' ? COMPANION_MORNING_AREA : COMPANION_AFTERNOON_AREA;
    this.begin(this.phase === 'evening' ? { ...area, start: [582, 185] } : area);
    this.setupTravelers();
    st.flags.companionMorningStarted = true;
    setSceneMusic(this, 'refuge');
    this.refreshSpots();
    if (this.phase === 'morning') this.say('Am nächsten Morgen. Ich verstaue die Decke und ziehe den grünen Mantel wieder an. Azar hat Frühstück gemacht, dann brechen wir auf.', 4300);
    else if (this.phase === 'evening') this.say('Die Sonne steht tief. Der Goldene Eber liegt vor uns. Hier endet der bisher spielbare Reiseabschnitt.', 4500);
  }

  private setupTravelers() {
    this.travelerRoutes.clear();
    this.travelerFacing.clear();
    this.travelerShadows.clear();
    this.lastHeading = [1, 0];
    const afternoon = this.areaCurrent.id === COMPANION_AFTERNOON_AREA.id;
    const background = this.areaRoot.list[0] as Phaser.GameObjects.Image;
    background.setFlipX(afternoon).setTint(afternoon ? 0xffdda5 : 0xffffff);
    const traveler = (name: 'foltan' | 'azar', at: Pt) => {
      const shadow = this.add.image(at[0], at[1] - 1, 'shadow').setDepth(at[1] - 1);
      const sprite = this.add.sprite(...at, `${name}-walk`, 8).setOrigin(0.5, 60 / 64).setDepth(at[1]);
      this.areaRoot.add([shadow, sprite]);
      this.travelerShadows.set(sprite, shadow);
      this.travelerFacing.set(sprite, 'e');
      this.animateTraveler(sprite, name, at);
      return sprite;
    };
    this.foltan = traveler('foltan', [this.lia.x + 22, this.lia.y]);
    this.azar = traveler('azar', [this.lia.x - 14, this.lia.y]);
    this.previousLia = [this.lia.x, this.lia.y];
    this.trail = [[this.lia.x - 14, this.lia.y], this.previousLia];
    this.data.set('story:companions-phase', this.phase);
  }

  private refreshSpots() {
    const st = state(this.registry);
    this.setObjective(companionObjective(this.phase, st));
    this.data.set('story:companions-phase', this.phase);
    this.setSpots(this.areaCurrent.targets.map(target => ({
      ...target,
      enabled: () => !this.talking && (target.id !== 'continue' || !!st.flags.companionRestTaken),
      markerVisible: () => target.id === 'rest' ? !st.flags.companionRestTaken
        : target.id === 'evening' ? !st.flags.companionDayComplete
        : target.id === 'breakfast' ? !st.flags.companionBreakfastRemembered : true,
      onUse: () => this.useTravelSpot(target.id),
    })));
  }

  private useTravelSpot(id: string) {
    if (this.talking) return;
    const st = state(this.registry);
    switch (id) {
      case 'breakfast':
        st.flags.companionBreakfastRemembered = true;
        this.say('Azar: "Hat dir mein Frühstück geschmeckt? Wachteleier und Speck. Ich muss es ja wissen, ich hab es gemacht."', 3200);
        this.refreshSpots(); return;
      case 'moss':
        this.say('Azar lehnt am Baum. Er prüfe nur das Moos, wegen der Richtung, sagt er. Von wegen. Er ist völlig außer Atem.', 3300); return;
      case 'rest':
        if (st.flags.companionRestTaken) { this.say('Das Moos ist weich. Aber jede Pause bringt Kyra weiter weg.', 2700); return; }
        this.restConversation(); return;
      case 'continue':
        if (!st.flags.companionRestTaken) return;
        this.enterStretch('afternoon', COMPANION_AFTERNOON_AREA);
        this.say('Nach der Mittagsrast. Wir bleiben unter den Bäumen und folgen Foltan weiter nach Osten.', 3300); return;
      case 'rest-return':
        this.enterStretch('morning', { ...COMPANION_MORNING_AREA, start: [586, 159] });
        this.say('Die Mooslichtung liegt wieder hinter der nächsten Biegung.', 2100); return;
      case 'camp-return':
        this.goTo('journey'); return;
      case 'foltan':
        this.say('Foltan: "Bis zum Lager schaffen wir es heute nicht mehr. Erst brauchen wir etwas zu essen und ein Dach für die Nacht."', 3700); return;
      case 'evening':
        st.flags.companionDayComplete = true; this.phase = 'evening';
        this.refreshSpots();
        this.say('Foltan: "Bis zur Schenke ist es nicht mehr weit. Der Wirt schuldet uns noch einen Gefallen. Das heißt: ein anständiges Abendessen, Azar."', 4400);
        return;
    }
  }

  private enterStretch(phase: CompanionPhase, area: StoryArea) {
    this.phase = phase; this.changeArea(area); this.setupTravelers(); this.refreshSpots();
  }

  private restConversation() {
    this.talking = true;
    this.setLocked(true);
    this.foltan?.setPosition(348, 205).setAngle(0);
    this.azar?.setPosition(267, 224).setAngle(0);
    this.stopTravelers();
    this.setObjective('Mittagsrast · Foltan und Azar zuhören.');
    let line = 0;
    const next = () => {
      if (line < MIDDAY_REST_LINES.length) {
        this.setCloseupText(MIDDAY_REST_LINES[line++]);
        this.setCloseupContinue(next);
      } else {
        state(this.registry).flags.companionRestTaken = true;
        this.hideCloseup(); this.talking = false; this.setLocked(false);
        this.trail = [[this.lia.x, this.lia.y]];
        this.refreshSpots();
        this.say('Ein Schluck aus dem Wasserschlauch. Dann brechen wir wieder auf.', 2200);
      }
    };
    next();
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (!this.lia?.active || this.talking || this.closeupVisible || this.inventory?.isOpen || this.hud?.dialogueVisible) {
      this.stopTravelers();
      return;
    }
    const current: Pt = [this.lia.x, this.lia.y];
    const moving = Math.hypot(current[0] - this.previousLia[0], current[1] - this.previousLia[1]) > 0.1;
    if (moving) {
      const distance = Math.hypot(current[0] - this.previousLia[0], current[1] - this.previousLia[1]);
      this.lastHeading = [(current[0] - this.previousLia[0]) / distance, (current[1] - this.previousLia[1]) / distance];
      this.trail.push(current);
      if (this.trail.length > 75) this.trail.shift();
    }
    const walkable = (x: number, y: number) => companionFeetWalkable(this.areaCurrent, x, y);
    // Retain the last heading when Lia stops, so Foltan cannot switch sides at rest.
    const lead: Pt = [current[0] + this.lastHeading[0] * 25, current[1] + this.lastHeading[1] * 25];
    const ahead = clearWalkingLine(current, lead, walkable) ? lead : current;
    let walked = 0, behind = current;
    for (let i = this.trail.length - 2; i >= 0; i--) {
      walked += Math.hypot(behind[0] - this.trail[i][0], behind[1] - this.trail[i][1]);
      behind = this.trail[i];
      if (walked >= 30) break;
    }
    for (const [actor, target, name] of [[this.foltan, ahead, 'foltan'], [this.azar, behind, 'azar']] as [Phaser.GameObjects.Sprite | undefined, Pt, 'foltan' | 'azar'][]) {
      if (!actor?.active) continue;
      const from: Pt = [actor.x, actor.y];
      let destination = target;
      if (clearWalkingLine(from, target, walkable)) this.travelerRoutes.delete(actor);
      else {
        let route = this.travelerRoutes.get(actor);
        if (!route || Math.hypot(route.goal[0] - target[0], route.goal[1] - target[1]) > 18 || !route.points.length) {
          route = { goal: target, points: findWalkingPath(from, target, walkable, 0) };
          this.travelerRoutes.set(actor, route);
        }
        while (route.points.length && Math.hypot(from[0] - route.points[0][0], from[1] - route.points[0][1]) < 1) route.points.shift();
        destination = route.points[0] ?? from;
      }
      const distance = Math.hypot(destination[0] - from[0], destination[1] - from[1]);
      const step = Math.min(distance, 85 * Math.min(delta, 50) / 1000);
      const next: Pt = distance ? [from[0] + (destination[0] - from[0]) / distance * step, from[1] + (destination[1] - from[1]) / distance * step] : from;
      if (distance > 0.1 && clearWalkingLine(from, next, walkable)) actor.setPosition(...next);
      this.animateTraveler(actor, name, from);
    }
    this.areaRoot.sort('depth');
    this.previousLia = current;
  }

  private animateTraveler(actor: Phaser.GameObjects.Sprite, name: 'foltan' | 'azar', from: Pt) {
    const dx = actor.x - from[0], dy = actor.y - from[1];
    const walking = Math.hypot(dx, dy) > 0.05;
    let facing = this.travelerFacing.get(actor) ?? 'e';
    if (walking) facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n';
    this.travelerFacing.set(actor, facing);
    const animation = `${name}-${walking ? 'walk' : 'idle'}-${facing}`;
    if (!walking && actor.anims.currentAnim?.key !== animation) actor.anims.stop();
    if (this.anims.exists(animation) && (walking || actor.anims.currentAnim?.key !== animation)) actor.play(animation, true);
    actor.setAngle(0).setDepth(actor.y);
    this.travelerShadows.get(actor)?.setPosition(actor.x, actor.y - 1).setDepth(actor.y - 1);
  }

  private stopTravelers() {
    for (const [actor, name] of [[this.foltan, 'foltan'], [this.azar, 'azar']] as const) {
      if (actor?.active) this.animateTraveler(actor, name, [actor.x, actor.y]);
    }
    this.areaRoot?.sort('depth');
  }
}
