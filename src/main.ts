import Phaser from 'phaser';
import { CAMPAIGN } from './sim/campaign';
import { DIFFICULTY, type Difficulty } from './sim/config';
import { starsFor, type World } from './sim/world';
import { Controls } from './game/controls';
import { GameScene, type SceneData } from './game/GameScene';
import { GalleryScene } from './game/GalleryScene';
import { StoryScene, type StoryId } from './game/StoryScene';
import { TitleScene } from './game/TitleScene';
import { LEVELS, loadStars, saveStars } from './game/levels';
import { sound } from './game/sound';
import { ZONE_THEMES } from './game/art/themes';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const controls = new Controls();
controls.bindStick($('stick'), $('stick-knob'));
controls.bindButton($('btn-run'), 'run');
controls.bindButton($('btn-honk'), 'honk');
controls.bindButton($('btn-moon'), 'moonwalk');
controls.bindButton($('btn-donut'), 'donut');
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

let difficulty: Difficulty = (localStorage.getItem('oops.difficulty') as Difficulty) || 'normal';
let levelIdx = 0;

// Render at the screen's real pixel density (sharp on iPad/Retina), displayed at CSS size.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2a1f45',
  scale: { mode: Phaser.Scale.NONE, width: innerWidth * DPR, height: innerHeight * DPR, zoom: 1 / DPR },
  render: { antialias: true },
  scene: [],
});
window.addEventListener('resize', () => game.scale.resize(innerWidth * DPR, innerHeight * DPR));
game.scene.add('game', GameScene, false);
game.scene.add('story', StoryScene, false);
game.scene.add('title', TitleScene, false);
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

type SceneKey = 'game' | 'story' | 'title';
/** Run exactly one scene. */
function run(key: SceneKey, data: object): void {
  for (const k of ['game', 'story', 'title'] as SceneKey[]) {
    if (k !== key && (game.scene.isActive(k) || game.scene.isPaused(k))) game.scene.stop(k);
  }
  if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.getScene(key).scene.restart(data);
  else game.scene.start(key, data);
}

const zoneDone = (zi: number) => (loadStars()[CAMPAIGN[zi].levels[CAMPAIGN[zi].levels.length - 1]] ?? 0) > 0;
const shipParts = () => CAMPAIGN.map((_, zi) => zoneDone(zi));

const partFor = (idx: number) => {
  const z = LEVELS[idx].zone;
  return z >= 0 ? CAMPAIGN[z].part.split(' ')[0] : '⚡';
};

const TIPS = [
  'Fun fact: alien knees bend backwards. Do not try this at home.',
  'Running is fast. Running is also LOUD. I prefer tiptoeing.',
  'If something is chasing you, take the twistiest path you can find.',
  'Touch every flag. Checkpoints are free!',
  'Donuts solve most problems. This is also true on Earth.',
  'Walk TOWARDS aliens, not behind them. I calculated this. Probably.',
  'A hug is not dangerous. It is just very, very long.',
  'Carpets are silent. Squeaky floors are... squeaky.',
  'Big aliens wear headphones. Honking at them is pointless. Try snacks.',
  'Drones are robots. Robots look FORWARDS. Robots are boring.',
  'I have never once taken a wrong turn. This planet was planned.',
  'Lookouts turn around eventually. Everyone does.',
];

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starText = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function showHome(): void {
  document.body.classList.remove('playing');
  run('title', { parts: shipParts() });
  const total = Object.values(loadStars()).reduce((a, b) => a + b, 0);
  const diffs = (Object.keys(DIFFICULTY) as Difficulty[])
    .map(d => `<button data-diff="${d}" class="${d === difficulty ? 'selected' : ''}">${DIFFICULTY[d].label}</button>`).join('');
  const logo = 'PLANET OOPS-A-DAISY'.split('')
    .map((c, i) => `<span style="animation-delay:${i * 0.06}s">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  showOverlay('home', `
    <h1 class="logo">${logo}</h1>
    <p class="sub">Everyone's legs face backwards. <b>Their eyes look where they've been</b>, not where they're going.</p>
    <div class="row"><button data-act="levels" class="primary big">▶ PLAY</button></div>
    <div class="row diffs">${diffs}</div>
    <div class="row"><button data-act="intro" class="small">🎬 Watch intro</button>
      <span class="total">⭐ ${total} / ${CAMPAIGN.length * 9} · Ship parts ${shipParts().filter(Boolean).length}/4</span></div>`);
}

function showLevels(): void {
  document.body.classList.remove('playing');
  if (!game.scene.isActive('title')) run('title', { parts: shipParts() });
  const stars = loadStars();
  const zones = CAMPAIGN.map((z, zi) => {
    const levels = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.zone === zi).map(({ l, i }) =>
      `<button class="level" data-level="${i}"><b>${l.id}</b><span>${l.data.name.replace(/^\d-\d\s*/, '')}</span><i>${starText(stars[l.id] ?? 0)}</i></button>`,
    ).join('');
    return `<div class="zone ${zoneDone(zi) ? 'done' : ''}"><h2>${z.part} ${z.name} ${zoneDone(zi) ? '✅' : ''}</h2><div class="zone-levels">${levels}</div></div>`;
  }).join('');
  const sandbox = LEVELS.findIndex(l => l.zone < 0);
  showOverlay('levels', `
    <div class="row top"><button data-act="home" class="small">◀ Back</button><h1>Pick a level</h1><span class="total">${DIFFICULTY[difficulty].label}</span></div>
    <div class="zones">${zones}</div>
    <div class="row"><button data-level="${sandbox}" class="small">🧪 Sandbox</button></div>
    <p class="keys">Move: arrows / WASD · Run: Shift (noisy!) · 1 Honk · 2 Moonwalk · 3 Donut · P pause</p>`);
}

/** NAV-9000 card before a level. */
function showLevelCard(idx: number): void {
  const entry = LEVELS[idx];
  const zone = entry.zone >= 0 ? CAMPAIGN[entry.zone] : null;
  levelIdx = idx;
  showOverlay('card', `
    <p class="zone-tag">${zone ? `${zone.part} ${zone.name}` : '🧪 Sandbox'}</p>
    <h1>${entry.data.name}</h1>
    <p class="hint-big">${entry.data.hint}</p>
    <p class="nav-tip">NAV-9000: "${TIPS[(idx * 5 + 3) % TIPS.length]}"</p>
    <div class="row"><button data-act="go" class="primary big">GO! ▶</button></div>`);
}

function startLevel(idx: number): void {
  levelIdx = idx;
  const entry = LEVELS[idx];
  hideOverlay();
  controls.reset();
  document.body.classList.add('playing');
  $('hint').textContent = entry.data.hint;
  $('hint').classList.remove('faded');
  setTimeout(() => $('hint').classList.add('faded'), 9000);
  $('hud-level').textContent = entry.data.name;
  const data: SceneData = { level: entry.data, difficulty, controls, onEnd, onFrame, theme: ZONE_THEMES[Math.max(0, entry.zone)] };
  run('game', data);
}

function playStory(id: StoryId, then: () => void): void {
  hideOverlay();
  document.body.classList.remove('playing');
  document.body.classList.add('story');
  const done = () => { document.body.classList.remove('story'); then(); };
  $('btn-skip').onclick = () => (game.scene.getScene('story') as StoryScene).finish();
  run('story', { id, onDone: done });
}

function onFrame(w: World): void {
  const p = w.player;
  $('hud-hearts').textContent = '❤️'.repeat(Math.max(0, p.hearts)) + '🤍'.repeat(Math.max(0, p.maxHearts - p.hearts));
  $('hud-time').textContent = formatTime(w.time);
  const got = w.items.filter(i => i.taken).length;
  const terms = w.terminals.length ? `  🖥️ ${w.terminals.filter(t => t.done).length}/${w.terminals.length}` : '';
  $('hud-items').textContent = `${partFor(levelIdx)} ${got}/${w.items.length}${p.keys ? '  🗝️' : ''}${terms}${w.alarm ? '  🚨' : ''}`;
  setCooldown('btn-honk', p.cd.honk);
  setCooldown('btn-moon', p.moonwalkT > 0 ? 0 : p.cd.moonwalk);
  setCooldown('btn-donut', p.cd.donut);
  $('btn-moon').classList.toggle('active', p.moonwalkT > 0);
}

function setCooldown(id: string, cd: number): void {
  const el = $(id);
  el.classList.toggle('cooling', cd > 0);
  el.dataset.cd = cd > 0 ? String(Math.ceil(cd)) : '';
}

function onEnd(w: World): void {
  document.body.classList.remove('playing');
  const entry = LEVELS[levelIdx];
  if (w.status !== 'won') {
    showOverlay('result', `
      <h1>💕 Hugged too many times!</h1>
      <p>NAV-9000: "Recalculating... their eyes look BACKWARDS. Sneak up from the FRONT!"</p>
      <div class="row"><button data-act="retry" class="primary">Try again</button><button data-act="levels">Levels</button></div>`);
    return;
  }
  const firstClear = (loadStars()[entry.id] ?? 0) === 0;
  const stars = starsFor(w);
  saveStars(entry.id, stars);
  const zone = entry.zone >= 0 ? CAMPAIGN[entry.zone] : null;
  const zoneFinal = !!zone && zone.levels[zone.levels.length - 1] === entry.id;
  const isLast = levelIdx + 1 >= LEVELS.length || LEVELS[levelIdx + 1].zone < 0;
  const result = () => showOverlay('result', `
      <h1>${zoneFinal ? `🎉 Got the ${zone!.part}!` : '🎉 Got it!'}</h1>
      <div class="stars">${starText(stars)}</div>
      <ul class="star-list">
        <li>⭐ Finished</li>
        <li>${w.time <= w.level.parTime ? '⭐' : '☆'} Under ${formatTime(w.level.parTime)} (you: ${formatTime(w.time)})</li>
        <li>${w.timesChased === 0 ? '⭐' : '☆'} Never chased (chased ${w.timesChased}×)</li>
      </ul>
      <div class="row">
        <button data-act="retry">Play again</button>
        <button data-act="levels">Levels</button>
        ${!isLast ? '<button data-act="next" class="primary">Next level ▶</button>' : ''}
      </div>`);
  if (zoneFinal && firstClear) playStory(entry.zone === 3 ? 'ending' : (`zone${entry.zone + 1}` as StoryId), result);
  else result();
}

// ---------------------------------------------------------------------------
// Overlay plumbing
// ---------------------------------------------------------------------------
function showOverlay(kind: string, html: string): void {
  $('panel').innerHTML = html;
  $('panel').className = kind;
  $('overlay').className = kind;
}
function hideOverlay(): void { $('overlay').className = 'hidden'; }

$('panel').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  sound.unlock();
  if (b.dataset.diff) {
    difficulty = b.dataset.diff as Difficulty;
    localStorage.setItem('oops.difficulty', difficulty);
    showHome();
  } else if (b.dataset.level) showLevelCard(Number(b.dataset.level));
  else switch (b.dataset.act) {
    case 'go': case 'retry': startLevel(levelIdx); break;
    case 'next': showLevelCard(levelIdx + 1); break;
    case 'levels': showLevels(); break;
    case 'home': showHome(); break;
    case 'intro': playStory('intro', showHome); break;
    case 'resume': hideOverlay(); document.body.classList.add('playing'); game.scene.resume('game'); break;
  }
});

function pause(): void {
  if (!game.scene.isActive('game')) return;
  game.scene.pause('game');
  controls.reset();
  document.body.classList.remove('playing');
  showOverlay('result', `<h1>⏸ Paused</h1><p>${LEVELS[levelIdx].data.hint}</p><div class="row"><button data-act="resume" class="primary">Resume</button><button data-act="retry">Restart</button><button data-act="levels">Levels</button></div>`);
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') pause();
  if ((e.code === 'Enter' || e.code === 'Space') && $('overlay').className === 'card') startLevel(levelIdx);
});
$('btn-pause').addEventListener('click', pause);
$('btn-music').addEventListener('click', () => { sound.unlock(); $('btn-music').textContent = sound.toggleMusic() ? '🎵' : '🔇'; });
controls.onAnyInput = () => sound.unlock();
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

if (location.search.includes('gallery')) {
  game.scene.add('gallery', GalleryScene, true);
  hideOverlay();
  $('hud').style.display = 'none';
} else if (!localStorage.getItem('oops.seenIntro')) {
  localStorage.setItem('oops.seenIntro', '1');
  playStory('intro', showHome);
} else {
  showHome();
}
