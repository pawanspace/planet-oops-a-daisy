// =============================================================================
// 📘 LESSON: main.ts — where everything starts
// =============================================================================
// When the page loads, the browser runs this file first. It:
//   1. connects the controls (keyboard + touch buttons),
//   2. creates the Phaser game (the drawing canvas) and registers our scenes: game, story, title,
//   3. shows the menus (home, level select, wardrobe, stickers...). Menus are plain HTML built from strings,
//      because buttons and text are easiest in HTML; Phaser draws the game world behind them.
//   4. reacts to button clicks: start a level, play a story, save stars...
// Only ONE scene runs at a time (see run()), so the title screen stops when a level starts.
//
// A note on template strings: `Hello ${name}!` with backticks puts the value of `name` inside the text.
// 💡 EXAMPLE: const n = 3; `⭐ ${n} stars` → "⭐ 3 stars".
// =============================================================================
import Phaser from 'phaser';
import { CAMPAIGN } from './sim/campaign';
import { CONFIG, DIFFICULTY, type Difficulty } from './sim/config';
import { starsFor, type World } from './sim/world';
import { Controls } from './game/controls';
import { GameScene, type SceneData } from './game/GameScene';
import { GalleryScene } from './game/GalleryScene';
import { StoryScene, type StoryId } from './game/StoryScene';
import { TitleScene } from './game/TitleScene';
import { LEVELS, loadStars, saveStars } from './game/levels';
import { sound } from './game/sound';
import { ZONE_THEMES } from './game/art/themes';
import {
  OUTFITS, STICKERS, currentOutfit, recordRun, socksFound, stickersEarned, totalStars, wearOutfit, type RunStats,
} from './game/progress';
import { shareCard } from './game/share';
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
// 💡 An iPad has devicePixelRatio 2: every "CSS pixel" is really 2×2 screen pixels. We draw at the real size.
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
if (import.meta.env.DEV) Object.assign(window, { __game: game, __sound: sound });

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
  sound.music('menu');
  run('title', { parts: shipParts(), outfit: currentOutfit().outfit });
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
    <div class="row"><button data-act="wardrobe" class="small">👕 Wardrobe</button><button data-act="stickers" class="small">📒 Stickers ${stickersEarned().size}/${STICKERS.length}</button><button data-act="intro" class="small">🎬 Intro</button></div>
    <p class="total">⭐ ${total} / ${CAMPAIGN.length * 9} · 🚀 Ship parts ${shipParts().filter(Boolean).length}/4 · 🧦 ${socksFound().size}/12</p>`);
}

function showLevels(): void {
  document.body.classList.remove('playing');
  sound.music('menu');
  if (!game.scene.isActive('title')) run('title', { parts: shipParts(), outfit: currentOutfit().outfit });
  const stars = loadStars();
  const socks = socksFound();
  const zones = CAMPAIGN.map((z, zi) => {
    const levels = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.zone === zi).map(({ l, i }) =>
      `<button class="level" data-level="${i}"><b>${l.id}</b><span>${l.data.name.replace(/^\d-\d\s*/, '')}</span><i>${starText(stars[l.id] ?? 0)}${socks.has(l.id) ? ' 🧦' : ''}</i></button>`,
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
  const theme = ZONE_THEMES[Math.max(0, entry.zone)];
  sound.music(theme, 'chase');
  const data: SceneData = { level: entry.data, difficulty, controls, onEnd, onFrame, theme, outfit: currentOutfit().outfit };
  run('game', data);
}

function playStory(id: StoryId, then: () => void): void {
  hideOverlay();
  document.body.classList.remove('playing');
  document.body.classList.add('story');
  const done = () => { document.body.classList.remove('story'); then(); };
  $('btn-skip').onclick = () => (game.scene.getScene('story') as StoryScene).finish();
  sound.music(id === 'ending' ? 'ending' : 'story');
  run('story', { id, onDone: done, outfit: currentOutfit().outfit });
}

function onFrame(w: World): void {
  const p = w.player;
  $('hud-hearts').textContent = '❤️'.repeat(Math.max(0, p.hearts)) + '🤍'.repeat(Math.max(0, p.maxHearts - p.hearts));
  $('hud-time').textContent = formatTime(w.time);
  const got = w.items.filter(i => i.taken).length;
  const terms = w.terminals.length ? `  🖥️ ${w.terminals.filter(t => t.done).length}/${w.terminals.length}` : '';
  $('hud-items').textContent = `${partFor(levelIdx)} ${got}/${w.items.length}${p.keys ? '  🗝️' : ''}${terms}${w.alarm ? '  🚨' : ''}`;
  const k = DIFFICULTY[difficulty].cooldown;
  setCooldown('btn-honk', p.cd.honk, CONFIG.honk.cooldown * k);
  setCooldown('btn-moon', p.moonwalkT > 0 ? 0 : p.cd.moonwalk, CONFIG.moonwalk.cooldown * k);
  setCooldown('btn-donut', p.cd.donut, CONFIG.donut.cooldown * k);
  $('btn-moon').classList.toggle('active', p.moonwalkT > 0);
}

function setCooldown(id: string, cd: number, max: number): void {
  const el = $(id);
  el.classList.toggle('cooling', cd > 0);
  el.dataset.cd = cd > 0 ? String(Math.ceil(cd)) : '';
  el.style.setProperty('--cd', String(Math.max(0, Math.min(1, cd / max))));
}

function onEnd(w: World, run: RunStats): void {
  document.body.classList.remove('playing');
  const entry = LEVELS[levelIdx];
  const starsBefore = totalStars();
  if (w.status !== 'won') {
    const rec = recordRun(entry.id, entry.zone, difficulty, w, run, starsBefore);
    showOverlay('result', `
      <h1>💕 Hugged too many times!</h1>
      <p>NAV-9000: "Recalculating... their eyes look BACKWARDS. Sneak up from the FRONT!"</p>
      ${rewardsHtml(rec.newStickers, [], false)}
      <div class="row"><button data-act="retry" class="primary">Try again</button><button data-act="levels">Levels</button></div>`);
    return;
  }
  const firstClear = (loadStars()[entry.id] ?? 0) === 0;
  const stars = starsFor(w);
  saveStars(entry.id, stars);
  const rec = entry.zone >= 0 ? recordRun(entry.id, entry.zone, difficulty, w, run, starsBefore) : { newStickers: [], newOutfits: [], newSock: false };
  lastResult = { name: entry.data.name, stars, time: w.time, chased: w.timesChased, sock: w.socks.some(k => k.taken) };
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
      ${rewardsHtml(rec.newStickers, rec.newOutfits, rec.newSock)}
      <div class="row">
        <button data-act="share" class="small">📸 Share</button>
        <button data-act="retry">Play again</button>
        <button data-act="levels">Levels</button>
        ${!isLast ? '<button data-act="next" class="primary">Next level ▶</button>' : ''}
      </div>`);
  if (zoneFinal && firstClear) playStory(entry.zone === 3 ? 'ending' : (`zone${entry.zone + 1}` as StoryId), result);
  else result();
}

let lastResult: { name: string; stars: number; time: number; chased: number; sock: boolean } | null = null;

function rewardsHtml(stickers: { icon: string; name: string }[], outfits: { icon: string; name: string }[], sock: boolean): string {
  const items = [
    ...(sock ? ['🧦 You found the hidden sock!'] : []),
    ...stickers.map(s => `${s.icon} New sticker: <b>${s.name}</b>`),
    ...outfits.map(o => `${o.icon} New outfit: <b>${o.name}</b> (see Wardrobe)`),
  ];
  return items.length ? `<div class="rewards">${items.map(i => `<div>${i}</div>`).join('')}</div>` : '';
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function showWardrobe(): void {
  const stars = totalStars(), wearing = currentOutfit().id;
  const cards = OUTFITS.map(o => {
    const locked = stars < o.stars;
    return `<button class="outfit ${o.id === wearing ? 'selected' : ''}" ${locked ? 'disabled' : `data-outfit="${o.id}"`}>
      <span class="swatch" style="background:${hex(o.outfit.shirt)};border-color:${hex(o.outfit.shorts)}"><i style="background:${hex(o.outfit.flower)}"></i></span>
      <b>${o.icon} ${o.name}</b><small>${locked ? `🔒 ${o.stars} ⭐` : o.id === wearing ? 'Wearing' : 'Wear it!'}</small></button>`;
  }).join('');
  showOverlay('levels', `
    <div class="row top"><button data-act="home" class="small">◀ Back</button><h1>👕 Wardrobe</h1><span class="total">⭐ ${stars}</span></div>
    <p>Earn stars to unlock outfits. Leo wears them in every level and story scene.</p>
    <div class="grid">${cards}</div>`);
}

function showStickers(): void {
  const earned = stickersEarned();
  const cards = STICKERS.map(s => `<div class="sticker ${earned.has(s.id) ? 'got' : ''}"><span>${s.icon}</span><b>${s.name}</b><small>${s.desc}</small></div>`).join('');
  showOverlay('levels', `
    <div class="row top"><button data-act="home" class="small">◀ Back</button><h1>📒 Sticker Book</h1><span class="total">${earned.size}/${STICKERS.length}</span></div>
    <div class="grid">${cards}</div>`);
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
  else if (b.dataset.outfit) {
    wearOutfit(b.dataset.outfit);
    (game.scene.getScene('title') as TitleScene | null)?.setOutfit(currentOutfit().outfit);
    showWardrobe();
  }
  else switch (b.dataset.act) {
    case 'go': case 'retry': startLevel(levelIdx); break;
    case 'next': showLevelCard(levelIdx + 1); break;
    case 'levels': showLevels(); break;
    case 'home': showHome(); break;
    case 'intro': playStory('intro', showHome); break;
    case 'wardrobe': showWardrobe(); break;
    case 'stickers': showStickers(); break;
    case 'share': if (lastResult) void shareCard(game, lastResult); break;
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
$('btn-music').textContent = sound.musicOn ? '🎵' : '🔇';
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

// Offline play once installed (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
setTimeout(() => $('splash').classList.add('gone'), 400);

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
