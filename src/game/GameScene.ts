// Runs the sim at a fixed 60 Hz and draws it. All game rules live in src/sim.
import Phaser from 'phaser';
import { CONFIG, DT, TILE, type Difficulty } from '../sim/config';
import type { LevelData } from '../sim/level';
import { World, type GameEvent } from '../sim/world';
import type { Controls } from './controls';
import {
  COLORS, alienRadius, drawAlien, drawCheckpoint, drawCone, drawDonut, drawDynamicTiles, drawGround, drawHearts, drawItem,
  drawKey, drawLever, drawPlayer, drawStatus, drawTerminal, dynamicTiles,
} from './draw';
import { sound } from './sound';

export interface SceneData {
  level: LevelData;
  difficulty: Difficulty;
  controls: Controls;
  onEnd: (w: World) => void;
  onFrame: (w: World) => void;
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
  private rings: { x: number; y: number; r: number; age: number }[] = [];
  private follow = { x: 0, y: 0 };
  private lineIdx = 0;
  private ended = false;

  constructor() { super('game'); }

  init(data: SceneData): void {
    this.data_ = data;
    this.world = new World(data.level, data.difficulty);
    this.acc = 0;
    this.t = 0;
    this.rings = [];
    this.ended = false;
  }

  create(): void {
    const w = this.world;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.ground = this.add.graphics();
    drawGround(this.ground, w.grid);
    this.dynList = dynamicTiles(w.grid);
    this.dyn = this.add.graphics();
    this.cones = this.add.graphics();
    this.actors = this.add.graphics();
    this.fx = this.add.graphics().setDepth(15);
    this.alarmTint = this.add.rectangle(0, 0, w.grid.w * TILE, w.grid.h * TILE, 0xff2040, 0).setOrigin(0).setDepth(14);
    this.labels = w.aliens.map(() => this.add.text(0, 0, '', {
      fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#2a1f45', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(10));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, w.grid.w * TILE, w.grid.h * TILE);
    this.follow = { x: w.player.x, y: w.player.y };
    cam.startFollow(this.follow, false, 0.12, 0.12);
    this.fitZoom();
    this.scale.on('resize', this.fitZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitZoom, this));
  }

  private fitZoom(): void {
    const { width, height } = this.scale;
    const z = Math.min(width / (17 * TILE), height / (11 * TILE));
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, 0.55, 1.8));
  }

  update(_time: number, deltaMs: number): void {
    const w = this.world;
    const dt = Math.min(deltaMs, 100) / 1000;
    this.t += dt;
    this.frameDt = dt;
    this.acc += dt;
    let first = true;
    while (this.acc >= DT) {
      w.step(this.data_.controls.read(first));
      first = false;
      this.acc -= DT;
    }
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

  private pick(list: string[]): string {
    this.lineIdx = (this.lineIdx + 1) % 997;
    return list[(this.lineIdx * 7) % list.length];
  }

  private say(x: number, y: number, text: string, color = '#ffffff', size = 20): void {
    const label = this.add.text(x, y - 30, text, {
      fontFamily: 'Chalkboard SE, Comic Sans MS, sans-serif', fontSize: `${size}px`, fontStyle: 'bold',
      color, stroke: '#2a1f45', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(20).setScale(0.4);
    this.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: label, y: y - 64, alpha: 0, delay: 800, duration: 600, onComplete: () => label.destroy() });
  }

  private onEvent(e: GameEvent): void {
    const cam = this.cameras.main;
    switch (e.type) {
      case 'noise': this.rings.push({ x: e.x, y: e.y, r: e.radius, age: 0 }); break;
      case 'spotted': sound.spotted(); this.say(e.x, e.y, this.pick(LINES.spotted), '#ff4d6d', 22); break;
      case 'suspicious': sound.suspicious(); this.say(e.x, e.y, this.pick(LINES.suspicious), '#ffd23c'); break;
      case 'lost': this.say(e.x, e.y, this.pick(LINES.lost), '#bde0ff'); break;
      case 'tired': this.say(e.x, e.y, this.pick(LINES.tired), '#bde0ff'); break;
      case 'skid': sound.skid(); this.say(e.x, e.y, this.pick(LINES.skid), '#ffffff', 18); break;
      case 'bump': sound.bump(); cam.shake(120, 0.004); this.say(e.x, e.y, this.pick(LINES.bump), '#ffe14a', 18); break;
      case 'stun': this.say(e.x, e.y, this.pick(LINES.stun), '#ffe14a'); break;
      case 'investigate': this.say(e.x, e.y, this.pick(LINES.investigate), '#ffd23c', 16); break;
      case 'fooled': sound.fooled(); this.say(e.x, e.y, this.pick(LINES.fooled), '#d9a6ff', 16); break;
      case 'eat': sound.eat(); this.say(e.x, e.y, this.pick(LINES.eat), '#ff6eb4'); break;
      case 'wake': sound.wake(); this.say(e.x, e.y, this.pick(LINES.wake), '#ff6eb4'); break;
      case 'hug': sound.hug(); cam.shake(200, 0.006); this.say(e.x, e.y, this.pick(LINES.hug), '#ff6eb4', 24); break;
      case 'bonk': sound.bonk(); this.say(e.x, e.y, '-1 ❤️', '#ff4d6d', 26); break;
      case 'stolen': this.say(e.x, e.y - 20, this.pick(LINES.stolen), '#ffd23c', 16); break;
      case 'beep': sound.beep(); this.say(e.x, e.y, this.pick(LINES.beep), '#ff3355', 20); break;
      case 'honk': sound.honk(); this.rings.push({ x: e.x, y: e.y, r: CONFIG.honk.stunRadius, age: 0 }); break;
      case 'moonwalk': sound.moonwalk(); this.say(e.x, e.y, 'MOONWALK!', '#d9a6ff'); break;
      case 'donut': sound.donut(); break;
      case 'noDonutRoom': this.say(e.x, e.y, 'No room to throw!', '#ffffff', 14); break;
      case 'key': sound.pickup(); this.say(e.x, e.y, 'KEY!', '#ffd23c', 24); break;
      case 'gate': sound.gate(); drawGround(this.ground, this.world.grid); this.say(e.x, e.y, 'GATE OPEN!', '#ffa028', 22); break;
      case 'item': sound.pickup(); this.say(e.x, e.y, 'SHIP PART!', '#fff27a', 26); break;
      case 'checkpoint': sound.checkpoint(); this.say(e.x, e.y, 'Checkpoint!', '#4ae07a', 16); break;
      case 'squeak': sound.squeak(); this.say(e.x, e.y, 'SQUEAK!', '#ffe65a', 14); break;
      case 'lever': sound.gate(); this.say(e.x, e.y, 'BELTS FLIPPED!', '#fff07a', 18); break;
      case 'hack': sound.pickup(); this.say(e.x, e.y, 'HACKED!', '#4ad6ff', 22); break;
      case 'shieldDown': sound.win(); drawGround(this.ground, this.world.grid); this.say(e.x, e.y - 30, 'SHIELD DOWN!', '#4ad6ff', 26); break;
      case 'laserOpen': sound.gate(); break;
      case 'laserClose': sound.suspicious(); break;
      case 'tooLight': this.say(e.x, e.y, 'Too light! Need someone BIG.', '#ffffff', 14); break;
      case 'alarm': sound.alarm(); cam.shake(400, 0.008); this.say(e.x, e.y - 20, '🚨 ALARM! RUN! 🚨', '#ff3355', 28); break;
      case 'win': sound.win(); break;
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
    if (w.donut) drawDonut(g, w.donut.x, w.donut.y, t);

    // draw back-to-front so overlaps look right (drones fly on top)
    const order = [...w.aliens].sort((a, b) => (a.kind === 'drone' ? 1e6 : 0) + a.y - ((b.kind === 'drone' ? 1e6 : 0) + b.y));
    let playerDrawn = false;
    const hugged = w.hug !== null;
    for (const a of order) {
      if (!playerDrawn && w.player.y < a.y + (a.kind === 'drone' ? 1e6 : 0)) { drawPlayer(g, w.player, t, hugged); playerDrawn = true; }
      drawAlien(g, a, t);
      drawStatus(g, a, t);
    }
    if (!playerDrawn) drawPlayer(g, w.player, t, hugged);
    if (hugged) drawHearts(g, w.player.x, w.player.y, t);

    w.aliens.forEach((a, i) => {
      const label = this.labels[i];
      const R = alienRadius(a);
      const txt = a.state === 'chase' ? '!' : a.state === 'sleep' ? 'z'.repeat(1 + (Math.floor(t * 2) % 3))
        : ['search', 'investigate', 'suspicious'].includes(a.state) ? '?' : a.state === 'eating' ? '🍩' : '';
      label.setText(txt).setPosition(a.x, a.y - R - (a.state === 'suspicious' ? 28 : 12));
      label.setColor(a.state === 'chase' ? '#ff4d6d' : a.state === 'sleep' ? '#bde0ff' : '#ffd23c');
      label.setScale(a.state === 'chase' ? 1.3 + 0.15 * Math.sin(t * 20) : 1);
    });

    this.alarmTint.setAlpha(w.alarm ? 0.06 + 0.05 * Math.sin(t * 8) : 0);

    const f = this.fx;
    f.clear();
    this.rings = this.rings.filter(r => (r.age += this.frameDt) < 0.5);
    for (const r of this.rings) {
      const k = r.age / 0.5;
      f.lineStyle(3, 0xffffff, 0.6 * (1 - k)).strokeCircle(r.x, r.y, r.r * (0.3 + 0.7 * k));
    }
  }
}
