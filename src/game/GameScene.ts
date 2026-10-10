// Runs the sim at a fixed 60 Hz and draws it. All game rules live in src/sim.
import Phaser from 'phaser';
import { CONFIG, DT, TILE, type Difficulty } from '../sim/config';
import type { LevelData } from '../sim/level';
import { World, type GameEvent } from '../sim/world';
import { T } from '../sim/level';
import type { Controls } from './controls';
import {
  drawCheckpoint, drawCone, drawDonut, drawDynamicTiles, drawGround, drawItem,
  drawKey, drawLever, drawStatus, drawTerminal, dynamicTiles,
} from './draw';
import { DEFAULT_OUTFIT, alienHeight, drawAlien, drawHearts, drawLeo, updateFace, type Mood, type Outfit } from './art/characters';
import { sound } from './sound';
import { Fx } from './fx';
import { drawFlyer, themeBg, type Flyer, type ZoneTheme } from './art/themes';

export interface SceneData {
  level: LevelData;
  difficulty: Difficulty;
  controls: Controls;
  onEnd: (w: World) => void;
  onFrame: (w: World) => void;
  outfit?: Outfit;
  theme?: ZoneTheme;
}

const LINES = {
  spotted: ['HELLO FRIEND!', 'A TOURIST!', 'HUG TIME!', 'NOSE AND TOES SAME WAY?!', 'WAIT FOR MEEE!', 'SELFIE!'],
  suspicious: ['Hmm?', 'Huh?', 'Is that...?', 'Who\'s there?'],
  lost: ['Where did it go?', 'Huh. Gone.', 'Was it a dream?', 'Aw, no hug...'],
  tired: ['Huff... puff...', 'Too... tired...', 'My backwards knees!', 'Need a nap...'],
  skid: ['SKRRT!', 'WHOA!', 'MY KNEES!', 'OOPSIE!'],
  bump: ['SPLAT!', 'OOF!', 'BONK!'],
  stun: ['?!?', 'WHAT A HONK!', 'HUH?!'],
  investigate: ['What was that?', 'Footsteps?', 'Who goes there?'],
  fooled: ['Oh. Just a local.', 'Nice backwards shoes!', 'Never mind!'],
  eat: ['NOM NOM NOM', 'DONUT!!!', 'Sprinkles!'],
  wake: ['...zzz...HUH?!', 'Is it hug o\'clock?'],
  hug: ['I LOVE TOURISTS!', 'BEST FRIENDS!', 'SQUEEEZE!', 'GROUP HUG!', 'You\'re so WEIRD!'],
  stolen: ['Ooh, shiny! I\'ll put it back.', 'Mine! ...no, back it goes.'],
  beep: ['BEEP BEEP! INTRUDER!', 'WEE-OO WEE-OO!'],
};

// Named aliens have their own lines (fallback: the generic ones above).
const CATCHPHRASES: Record<string, Partial<Record<keyof typeof LINES, string[]>>> = {
  'Blorp': { spotted: ['BLORP SAYS HI!!', 'WELCOME, TRAVELER!'], hug: ['BLORP HUG!', 'Blorp loves you!'], lost: ['Blorp is sad now.'], wake: ['Blorp was dreaming of you!'] },
  'Big Blorp': { spotted: ['BIG BLORP, BIG HUGS!'], hug: ['SQUEEEEEZE!'], wake: ['Who woke Big Blorp?!'] },
  'Hall Monitor': { spotted: ['NO RUNNING... TO ME!', 'HALL PASS, PLEASE!'], suspicious: ['Is that a tourist in MY hall?'] },
  'Teacher': { spotted: ['Recess is OVER, mister!'], suspicious: ['Eyes on me, class...'] },
  'Door Guard': { spotted: ['NOBODY GETS PAST... oh, a hug!'], eat: ['Mmm. Worth it.'] },
  'Shopkeeper': { spotted: ['A CUSTOMER! HUG FIRST, SHOP LATER!'] },
  'Big Bertha': { eat: ['BERTHA LOVES SPRINKLES'], spotted: ['BERTHA SEES YOU, SWEETIE!'] },
  'Key Guard': { spotted: ['THAT KEY IS MINE! ...and so are HUGS!'] },
};

/** Big centered text pop (READY? / GO! / RUN!). */
function banner(text: string): void {
  const el = document.getElementById('banner');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('show');
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private data_!: SceneData;
  private acc = 0;
  private t = 0;
  private frameDt = 0;
  private ground!: Phaser.GameObjects.Graphics;
  private dyn!: Phaser.GameObjects.Graphics;
  private cones!: Phaser.GameObjects.Graphics;
  private actors!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private alarmTint!: Phaser.GameObjects.Rectangle;
  private dynList: number[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private names: (Phaser.GameObjects.Text | null)[] = [];
  private rings: { x: number; y: number; r: number; age: number }[] = [];
  private follow = { x: 0, y: 0 };
  private lineIdx = 0;
  private ended = false;
  private faces: number[] = [];
  private walks: number[] = [];
  private leoFace = 1;
  private leoWalk = 0;
  // juice
  private fxs = new Fx();
  private decalG!: Phaser.GameObjects.Graphics;
  private hitstop = 0;
  private slowmo = 0;
  private punch = 0;
  private baseZoom = 1;
  private introT = 0;
  private leoJump = 0;
  private dustT = 0;
  private wasSkidding: boolean[] = [];
  private skidFrom: { x: number; y: number }[] = [];
  private flights: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  private flyers: Flyer[] = [];
  private theme: ZoneTheme = 'suburbia';
  private stepT = 0;
  private beatT = 0;

  constructor() { super('game'); }

  init(data: SceneData): void {
    this.data_ = data;
    this.world = new World(data.level, data.difficulty);
    this.acc = 0;
    this.t = 0;
    this.rings = [];
    this.ended = false;
    this.faces = this.world.aliens.map(a => updateFace(1, a.look));
    this.walks = this.world.aliens.map(() => 0);
    this.leoFace = 1;
    this.leoWalk = 0;
    this.fxs = new Fx();
    this.hitstop = this.slowmo = this.punch = this.leoJump = this.dustT = 0;
    this.introT = 1.8;
    this.wasSkidding = this.world.aliens.map(() => false);
    this.skidFrom = this.world.aliens.map(a => ({ x: a.x, y: a.y }));
    this.flights = [];
    this.theme = data.theme ?? 'suburbia';
    const mw = this.world.grid.w * TILE, mh = this.world.grid.h * TILE;
    this.flyers = [0, 1, 2].map(i => ({ x: (mw * (i * 0.37 + 0.1)) % mw, y: mh * (0.2 + i * 0.3), vx: (i % 2 ? -1 : 1) * (30 + i * 12), phase: i * 2.1 }));
  }

  create(): void {
    const w = this.world;
    this.cameras.main.setBackgroundColor(themeBg(this.theme));
    this.ground = this.add.graphics();
    drawGround(this.ground, w.grid, this.theme);
    this.dynList = dynamicTiles(w.grid);
    this.dyn = this.add.graphics();
    this.decalG = this.add.graphics();
    this.cones = this.add.graphics();
    this.actors = this.add.graphics();
    this.fx = this.add.graphics().setDepth(15);
    this.alarmTint = this.add.rectangle(0, 0, w.grid.w * TILE, w.grid.h * TILE, 0xff2040, 0).setOrigin(0).setDepth(14);
    this.labels = w.aliens.map(() => this.add.text(0, 0, '', {
      fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#2a1f45', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(10));

    this.names = w.aliens.map(a => a.spec.name ? this.add.text(0, 0, a.spec.name, {
      fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: '#2a1f45', backgroundColor: '#ffffffaa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0).setDepth(9) : null);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, w.grid.w * TILE, w.grid.h * TILE);
    this.follow = { x: w.player.x, y: w.player.y };
    this.fitZoom();
    // Level-start reveal: show the whole map, then swoop down to Leo.
    const mapW = w.grid.w * TILE, mapH = w.grid.h * TILE;
    cam.setZoom(Math.min(this.scale.width / mapW, this.scale.height / mapH) * 0.98);
    cam.centerOn(mapW / 2, mapH / 2);
    banner('READY?');
    const view = { x: mapW / 2, y: mapH / 2, zoom: cam.zoom };
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: view, x: w.player.x, y: w.player.y, zoom: this.baseZoom, duration: 700, ease: 'Sine.easeInOut',
        onUpdate: () => { cam.setZoom(view.zoom); cam.centerOn(view.x, view.y); },
      });
    });
    this.time.delayedCall(1650, () => { cam.startFollow(this.follow, false, 0.12, 0.12); banner('GO!'); });
    this.scale.on('resize', this.fitZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitZoom, this));
  }

  private fitZoom(): void {
    const { width, height } = this.scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const z = Math.min(width / (17 * TILE), height / (11 * TILE));
    this.baseZoom = Phaser.Math.Clamp(z, 0.55 * dpr, 1.8 * dpr);
    if (this.introT <= 0) this.cameras.main.setZoom(this.baseZoom);
  }

  update(_time: number, deltaMs: number): void {
    const w = this.world;
    const dt = Math.min(deltaMs, 100) / 1000;
    this.t += dt;
    this.frameDt = dt;
    if (this.introT > 0) this.introT -= dt;
    else if (this.hitstop > 0) this.hitstop -= dt;
    else {
      if (this.slowmo > 0) this.slowmo -= dt;
      this.acc += this.slowmo > 0 ? dt * 0.35 : dt;
    }
    let first = true;
    while (this.acc >= DT) {
      w.step(this.data_.controls.read(first));
      first = false;
      this.acc -= DT;
    }
    if (this.introT > 0) this.data_.controls.read(true); // swallow early button presses
    this.juice(dt);
    for (const e of w.drainEvents()) this.onEvent(e);
    this.follow.x = w.player.x;
    this.follow.y = w.player.y;
    this.render();
    this.data_.onFrame(w);
    if (w.status !== 'playing' && !this.ended) {
      this.ended = true;
      this.time.delayedCall(w.status === 'won' ? 900 : 700, () => this.data_.onEnd(w));
    }
  }

  /** Per-frame juice: camera punch, dust, skid marks, particles. */
  private juice(dt: number): void {
    const w = this.world, cam = this.cameras.main;
    if (this.introT <= 0) {
      this.punch *= Math.pow(0.02, dt);
      cam.setZoom(this.baseZoom * (1 + this.punch));
    }
    if (this.leoJump > 0) this.leoJump -= dt;
    const p = w.player;
    // music + sound atmosphere
    sound.chase(w.aliens.some(a => a.state === 'chase') || w.alarm);
    const watch = Math.max(0, ...w.aliens.map(a => (a.state === 'suspicious' || a.kind === 'drone' ? a.sus : 0)));
    this.beatT -= dt;
    if (watch > 0.05 && this.beatT <= 0) { sound.heartbeat(watch); this.beatT = 0.85 - 0.45 * watch; }
    this.stepT -= dt;
    if (p.moving && p.moonwalkT <= 0 && !w.hug && this.stepT <= 0) {
      const tile = w.grid.get(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      const surface = tile === T.Carpet ? 'carpet' : ({ suburbia: 'grass', school: 'tile', market: 'stone', spaceport: 'metal' } as const)[this.theme];
      sound.footstep(surface, p.running);
      this.stepT = p.running ? 0.2 : 0.34;
    }
    this.dustT -= dt;
    if (p.running && this.dustT <= 0) { this.fxs.burst('dust', p.x, p.y, 2, { speed: 30 }); this.dustT = 0.09; }
    w.aliens.forEach((a, i) => {
      if (a.state === 'chase' && a.speed > 150 && (Math.floor(this.t * 10) + i) % 2 === 0) this.fxs.burst('dust', a.x, a.y, 1, { speed: 20 });
      if (this.wasSkidding[i] && !a.skidding) this.fxs.skidMark(this.skidFrom[i].x, this.skidFrom[i].y, a.x, a.y);
      this.wasSkidding[i] = a.skidding;
    });
    const mw = w.grid.w * TILE;
    for (const fl of this.flyers) {
      fl.x += fl.vx * dt;
      if (fl.x > mw + 60) fl.x = -60;
      if (fl.x < -60) fl.x = mw + 60;
    }
    for (const f of this.flights) f.t += dt / 0.35;
    this.flights = this.flights.filter(f => f.t < 1);
    this.fxs.update(dt);
  }

  private pick(list: string[]): string {
    this.lineIdx = (this.lineIdx + 1) % 997;
    return list[(this.lineIdx * 7) % list.length];
  }

  /** A line for this alien: its own catchphrase if it has a name, else a generic one. */
  private line(kind: keyof typeof LINES, e: GameEvent): string {
    const name = 'alien' in e ? this.world.aliens[e.alien]?.spec.name : undefined;
    const own = name ? CATCHPHRASES[name]?.[kind] : undefined;
    return own && this.lineIdx % 2 === 0 ? (this.pick(own)) : this.pick(LINES[kind]);
  }

  private say(x: number, y: number, text: string, color = '#ffffff', size = 20): void {
    const label = this.add.text(x, y - 30, text, {
      fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: `${size}px`, fontStyle: 'bold',
      color, stroke: '#2a1f45', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(20).setScale(0.4);
    this.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: y - 64, alpha: 0, delay: 800, duration: 600, onComplete: () => label.destroy() });
  }

  private onEvent(e: GameEvent): void {
    const cam = this.cameras.main;
    if ('alien' in e && ['spotted', 'suspicious', 'hug', 'lost', 'tired', 'eat', 'wake', 'investigate', 'fooled', 'stolen'].includes(e.type)) {
      const kind = this.world.aliens[e.alien]?.kind;
      const pitch = ({ kid: 1.5, heavy: 0.6, hugger: 1.1, scooter: 1.25, lookout: 0.9, stroller: 1, drone: 2 } as const)[kind ?? 'stroller'];
      if (kind !== 'drone') sound.voice(pitch + (e.alien % 3) * 0.05);
    }
    switch (e.type) {
      case 'noise': this.rings.push({ x: e.x, y: e.y, r: e.radius, age: 0 }); break;
      case 'spotted': this.punch = 0.08; this.hitstop = 0.08; if (!this.world.aliens.some((a, i) => i !== e.alien && a.state === 'chase')) this.slowmo = 0.35; sound.spotted(); this.say(e.x, e.y, this.line('spotted', e), '#ff4d6d', 22); break;
      case 'suspicious': sound.suspicious(); this.say(e.x, e.y, this.line('suspicious', e), '#ffd23c'); break;
      case 'lost': this.say(e.x, e.y, this.line('lost', e), '#bde0ff'); break;
      case 'tired': this.say(e.x, e.y, this.line('tired', e), '#bde0ff'); break;
      case 'skid': this.skidFrom[e.alien] = { x: e.x, y: e.y }; this.fxs.burst('dust', e.x, e.y, 10, { speed: 90 }); sound.skid(); this.say(e.x, e.y, this.line('skid', e), '#ffffff', 18); break;
      case 'bump': this.fxs.burst('star', e.x, e.y - 30, 5, { speed: 70, size: 5 }); sound.bump(); cam.shake(120, 0.004); this.say(e.x, e.y, this.line('bump', e), '#ffe14a', 18); break;
      case 'stun': this.fxs.burst('star', e.x, e.y - 40, 4, { speed: 40, size: 4 }); this.say(e.x, e.y, this.line('stun', e), '#ffe14a'); break;
      case 'investigate': this.say(e.x, e.y, this.line('investigate', e), '#ffd23c', 16); break;
      case 'fooled': sound.fooled(); this.say(e.x, e.y, this.line('fooled', e), '#d9a6ff', 16); break;
      case 'eat': this.fxs.burst('crumb', e.x, e.y - 20, 14, { color: 0xd99a52, up: 80 }); sound.eat(); this.say(e.x, e.y, this.line('eat', e), '#ff6eb4'); break;
      case 'wake': sound.wake(); this.say(e.x, e.y, this.line('wake', e), '#ff6eb4'); break;
      case 'hug': this.hitstop = 0.15; this.punch = 0.1; this.fxs.burst('heart', e.x, e.y - 30, 10, { speed: 90, size: 5, life: 1 }); sound.hug(); cam.shake(200, 0.006); this.say(e.x, e.y, this.line('hug', e), '#ff6eb4', 24); break;
      case 'bonk': this.fxs.burst('star', e.x, e.y - 30, 6, { speed: 80, size: 5 }); sound.bonk(); this.say(e.x, e.y, '-1 ❤️', '#ff4d6d', 26); break;
      case 'stolen': this.say(e.x, e.y - 20, this.line('stolen', e), '#ffd23c', 16); break;
      case 'beep': sound.beep(); this.say(e.x, e.y, this.line('beep', e), '#ff3355', 20); break;
      case 'honk': this.fxs.burst('note', e.x, e.y - 30, 6, { speed: 90, size: 4, life: 0.9 }); sound.honk(); this.rings.push({ x: e.x, y: e.y, r: CONFIG.honk.stunRadius, age: 0 }); break;
      case 'moonwalk': this.fxs.burst('spark', e.x, e.y, 10, { color: 0xd9a6ff }); sound.moonwalk(); this.say(e.x, e.y, 'MOONWALK!', '#d9a6ff'); break;
      case 'donut': this.flights.push({ x0: this.world.player.x, y0: this.world.player.y, x1: e.x, y1: e.y, t: 0 }); sound.donut(); break;
      case 'noDonutRoom': this.say(e.x, e.y, 'No room to throw!', '#ffffff', 14); break;
      case 'key': this.hitstop = 0.1; this.leoJump = 0.4; this.fxs.burst('spark', e.x, e.y, 14, { color: 0xffd23c, speed: 120 }); sound.pickup(); this.say(e.x, e.y, 'KEY!', '#ffd23c', 24); break;
      case 'gate': this.fxs.burst('spark', e.x, e.y, 16, { color: 0xffa028, speed: 140 }); sound.gate(); drawGround(this.ground, this.world.grid, this.theme); this.say(e.x, e.y, 'GATE OPEN!', '#ffa028', 22); break;
      case 'item': this.hitstop = 0.12; this.leoJump = 0.5; this.punch = 0.08; this.fxs.burst('spark', e.x, e.y, 24, { color: 0xfff27a, speed: 160 }); sound.pickup(); this.say(e.x, e.y, 'SHIP PART!', '#fff27a', 26); break;
      case 'checkpoint': this.fxs.burst('spark', e.x, e.y - 10, 10, { color: 0x4ae07a, speed: 90 }); sound.checkpoint(); this.say(e.x, e.y, 'Checkpoint!', '#4ae07a', 16); break;
      case 'squeak': sound.squeak(); this.say(e.x, e.y, 'SQUEAK!', '#ffe65a', 14); break;
      case 'lever': sound.gate(); this.say(e.x, e.y, 'BELTS FLIPPED!', '#fff07a', 18); break;
      case 'hack': this.fxs.burst('spark', e.x, e.y - 10, 14, { color: 0x4ad6ff, speed: 110 }); sound.pickup(); this.say(e.x, e.y, 'HACKED!', '#4ad6ff', 22); break;
      case 'shieldDown': sound.win(); drawGround(this.ground, this.world.grid, this.theme); this.say(e.x, e.y - 30, 'SHIELD DOWN!', '#4ad6ff', 26); break;
      case 'laserOpen': sound.gate(); break;
      case 'laserClose': sound.suspicious(); break;
      case 'tooLight': this.say(e.x, e.y, 'Too light! Need someone BIG.', '#ffffff', 14); break;
      case 'alarm': this.hitstop = 0.2; this.punch = 0.12; banner('🚨 RUN! 🚨'); sound.alarm(); cam.shake(400, 0.008); this.say(e.x, e.y - 20, '🚨 ALARM! RUN! 🚨', '#ff3355', 28); break;
      case 'win': this.leoJump = 0.6; this.punch = 0.15; this.fxs.burst('confetti', e.x, e.y - 40, 60, { speed: 260, up: 220, life: 1.6, size: 4 }); sound.win(); break;
      case 'lose': sound.lose(); break;
      case 'calm': break;
    }
  }

  private render(): void {
    const w = this.world, t = this.t;
    this.dyn.clear();
    drawDynamicTiles(this.dyn, w, this.dynList, t);
    this.cones.clear();
    for (const a of w.aliens) drawCone(this.cones, w, a);

    const g = this.actors;
    g.clear();
    w.checkpoints.forEach(cp => drawCheckpoint(g, cp.x, cp.y, cp.x === w.player.respawn.x && cp.y === w.player.respawn.y, t));
    for (const lv of w.levers) drawLever(g, lv);
    for (const term of w.terminals) drawTerminal(g, term, t);
    for (const k of w.keys) if (!k.taken) drawKey(g, k.x, k.y, t);
    for (const it of w.items) if (!it.taken) drawItem(g, it.x, it.y, t);
    if (w.donut && !this.flights.length) drawDonut(g, w.donut.x, w.donut.y, t);
    for (const f of this.flights) {
      const k = f.t, x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 50;
      g.fillStyle(0x000000, 0.15).fillEllipse(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k + 8, 16, 5);
      drawDonut(g, x, y - 10, t * 3);
    }

    // animation state (render-only)
    const dt = this.frameDt;
    w.aliens.forEach((a, i) => {
      this.faces[i] = a.kind === 'scooter' && a.heading.x !== 0 ? -Math.sign(a.heading.x) : updateFace(this.faces[i], a.look);
      this.walks[i] += dt * (a.speed / 7 + (a.state === 'chase' ? 4 : 0));
    });
    const p = w.player;
    if (p.facing === 1) this.leoFace = 1;
    else if (p.facing === 3) this.leoFace = -1;
    if (p.moving) this.leoWalk += dt * (p.running ? 16 : p.moonwalkT > 0 ? 8 : 12);
    const mood: Mood = w.hug ? 'hugged'
      : w.aliens.some(a => a.state === 'chase') ? 'panic'
      : w.aliens.some(a => a.sus > 0.25) ? 'nervous'
      : p.moonwalkT > 0 ? 'smug' : 'calm';
    const outfit = this.data_.outfit ?? DEFAULT_OUTFIT;

    // draw back-to-front so overlaps look right (drones fly on top)
    const depth = (y: number, drone: boolean) => y + (drone ? 1e6 : 0);
    const order = w.aliens.map((a, i) => ({ a, i })).sort((u, v) => depth(u.a.y, u.a.kind === 'drone') - depth(v.a.y, v.a.kind === 'drone'));
    let playerDrawn = false;
    const hugged = w.hug !== null;
    const jump = this.leoJump > 0 ? Math.sin((this.leoJump / 0.5) * Math.PI) * 18 : 0;
    const leo = jump > 0 ? { ...p, y: p.y - jump } : p;
    for (const { a, i } of order) {
      if (!playerDrawn && p.y < depth(a.y, a.kind === 'drone')) { drawLeo(g, leo, this.leoFace, this.leoWalk, mood, outfit, t); playerDrawn = true; }
      drawAlien(g, a, { face: this.faces[i], walk: this.walks[i] }, t, a.state === 'hugging');
      drawStatus(g, a, t);
    }
    if (!playerDrawn) drawLeo(g, leo, this.leoFace, this.leoWalk, mood, outfit, t);
    if (hugged) drawHearts(g, p.x, p.y, t);

    w.aliens.forEach((a, i) => {
      const label = this.labels[i];
      const top = a.kind === 'drone' ? 48 : alienHeight(a) + 6;
      const txt = a.state === 'chase' ? '!' : a.state === 'sleep' ? 'z'.repeat(1 + (Math.floor(t * 2) % 3))
        : ['search', 'investigate', 'suspicious'].includes(a.state) ? '?' : '';
      label.setText(txt).setPosition(a.x + (a.state === 'sleep' ? 14 : 0), a.y - top - (a.state === 'suspicious' ? 18 : 0));
      label.setColor(a.state === 'chase' ? '#ff4d6d' : a.state === 'sleep' ? '#bde0ff' : '#ffd23c');
      label.setScale(a.state === 'chase' ? 1.3 + 0.15 * Math.sin(t * 20) : 1);
      this.names[i]?.setPosition(a.x, a.y + 4);
    });

    this.alarmTint.setAlpha(w.alarm ? 0.06 + 0.05 * Math.sin(t * 8) : 0);

    this.fxs.drawDecals(this.decalG);
    const f = this.fx;
    f.clear();
    // drifting cloud shadows, then sky life above everything
    const mw = w.grid.w * TILE, mh = w.grid.h * TILE;
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 12 + i * mw * 0.4) % (mw + 400)) - 200, cy = mh * (0.25 + i * 0.28);
      f.fillStyle(0x000000, 0.05).fillEllipse(cx, cy, 260, 120).fillEllipse(cx + 90, cy + 20, 180, 90);
    }
    for (const fl of this.flyers) drawFlyer(f, this.theme, { ...fl, y: fl.y + Math.sin(t + fl.phase) * 8 }, t);
    this.fxs.draw(f);
    this.rings = this.rings.filter(r => (r.age += this.frameDt) < 0.5);
    for (const r of this.rings) {
      const k = r.age / 0.5;
      f.lineStyle(3, 0xffffff, 0.6 * (1 - k)).strokeCircle(r.x, r.y, r.r * (0.3 + 0.7 * k));
    }
  }
}
