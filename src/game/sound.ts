// =============================================================================
// 📘 LESSON: Making sounds out of maths (and playing music)
// =============================================================================
// Most sound effects here aren't recordings: they're GENERATED with the Web Audio API that every browser has.
//
//   An OSCILLATOR makes a tone: a wave that wiggles a speaker back and forth `frequency` times per second.
//     • 440 wiggles per second (440 Hz) is the musical note A. Double it (880) and you get A one octave higher.
//     • The wave's shape changes the sound: 'sine' is smooth and soft, 'square' is buzzy like an old video game,
//       'sawtooth' is harsh, 'triangle' is in between.
//   A GAIN node is a volume knob. Turning it down quickly ("exponential ramp") makes a tone go "blip".
//
// 💡 EXAMPLE: the honk plays two square waves at once, 440 Hz and 554 Hz (the notes A and C#), for 0.22 s.
//    Two notes together like that is what makes it sound like a silly clown horn.
//
// The MUSIC is real recorded tracks (free CC0 music by Juhani Junkala). Each plays through its own gain node so
// we can crossfade: when you're spotted, the calm zone music fades down and the chase music fades up.
// 🧪 TRY IT: change the honk's 440 to 220. What happens to the sound?
// 🧠 QUIZ Q24: A sound wave at 1000 Hz wiggles how many times in 0.1 seconds?
// =============================================================================

type Wave = OscillatorType;
export type TrackId = 'menu' | 'suburbia' | 'school' | 'market' | 'spaceport' | 'chase' | 'story' | 'ending';
export type Surface = 'grass' | 'tile' | 'stone' | 'metal' | 'carpet';

const MUSIC_VOL = 0.4;

/** One looping music track routed through Web Audio so its volume can fade (iOS ignores element.volume). */
interface Track { el: HTMLAudioElement; gain: GainNode }

export class Sound {
  private ctx: AudioContext | null = null;
  private tracks = new Map<TrackId, Track>();
  private main: TrackId | null = null;
  private layer: TrackId | null = null;
  private layerOn = false;
  private wanted: { main: TrackId; layer: TrackId | null } | null = null;
  sfxOn = true;
  musicOn = localStorage.getItem('oops.music') !== 'off';

  /** Must be called from a user gesture (iOS). */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (this.wanted && !this.main) this.music(this.wanted.main, this.wanted.layer);
  }

  private track(id: TrackId): Track | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let tr = this.tracks.get(id);
    if (!tr) {
      const el = new Audio(`music/${id}.mp3`);
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      tr = { el, gain };
      this.tracks.set(id, tr);
    }
    return tr;
  }

  private fade(tr: Track, to: number, secs: number): void {
    const ctx = this.ctx!;
    const g = tr.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(to, ctx.currentTime + secs);
    if (to > 0 && tr.el.paused) void tr.el.play().catch(() => {});
    if (to === 0) setTimeout(() => { if (tr.gain.gain.value < 0.01) tr.el.pause(); }, secs * 1000 + 100);
  }

  /** Switch background music: a main track plus an optional "chase" layer that fades in on demand. */
  music(main: TrackId, layer: TrackId | null = null): void {
    this.wanted = { main, layer };
    if (!this.ctx || !this.musicOn) return;
    for (const [id, tr] of this.tracks) if (id !== main && id !== layer) this.fade(tr, 0, 0.6);
    const m = this.track(main)!;
    if (this.main !== main) { m.el.currentTime = 0; }
    this.main = main;
    this.layer = layer;
    this.layerOn = false;
    this.fade(m, MUSIC_VOL, 0.6);
    if (layer) { const l = this.track(layer)!; l.el.currentTime = 0; this.fade(l, 0, 0.1); }
  }

  /** Crossfade between the calm main track and the chase layer. */
  chase(on: boolean): void {
    if (on === this.layerOn || !this.ctx || !this.musicOn || !this.main || !this.layer) return;
    this.layerOn = on;
    this.fade(this.track(this.main)!, on ? MUSIC_VOL * 0.25 : MUSIC_VOL, on ? 0.3 : 1.5);
    this.fade(this.track(this.layer)!, on ? MUSIC_VOL : 0, on ? 0.3 : 1.5);
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    localStorage.setItem('oops.music', this.musicOn ? 'on' : 'off');
    if (!this.musicOn) { for (const tr of this.tracks.values()) this.fade(tr, 0, 0.3); this.main = null; }
    else if (this.wanted) this.music(this.wanted.main, this.wanted.layer);
    return this.musicOn;
  }

  toggleSfx(): boolean {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }

  // #region tone
  /**
   * Play one tone: a `type` wave that slides from frequency f0 to f1 over `dur` seconds, starting at volume `vol`
   * and fading to silence. Almost every sound effect is built from a few of these.
   */
  private tone(type: Wave, f0: number, f1: number, dur: number, vol: number, delay = 0, ramp: 'exp' | 'lin' = 'exp'): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // #endregion tone

  /** A burst of random "white noise" through a filter: good for skids, swooshes and grass footsteps. */
  private noiseBurst(dur: number, vol: number, f0: number, f1: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    filt.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  step(): void { this.tone('triangle', 200, 320, 0.04, 0.04); }

  /** Footstep with a different feel per floor. */
  footstep(surface: Surface, running: boolean): void {
    const v = running ? 1 : 0.6;
    switch (surface) {
      case 'grass': this.noiseBurst(0.06, 0.05 * v, 900, 400); break;
      case 'tile': this.tone('square', 900, 600, 0.025, 0.025 * v); break;
      case 'stone': this.tone('triangle', 260, 140, 0.05, 0.06 * v); break;
      case 'metal': this.tone('square', 520, 500, 0.05, 0.03 * v); this.tone('sine', 1400, 1300, 0.08, 0.015 * v); break;
      case 'carpet': this.noiseBurst(0.04, 0.015 * v, 400, 300); break;
    }
  }

  /** Heartbeat thump (louder/faster when an alien is close to spotting you). */
  heartbeat(level: number): void {
    this.tone('sine', 70, 45, 0.12, 0.12 + 0.12 * level);
    this.tone('sine', 65, 42, 0.1, 0.08 + 0.1 * level, 0.16);
  }
  bonk(): void { this.tone('sawtooth', 450, 80, 0.28, 0.24); this.tone('sine', 900, 700, 0.5, 0.06, 0.25); }
  honk(): void { this.tone('square', 440, 440, 0.22, 0.12); this.tone('square', 554, 554, 0.22, 0.12); }
  moonwalk(): void { this.tone('sine', 320, 640, 0.35, 0.18, 0, 'lin'); }
  donut(): void { this.tone('triangle', 180, 260, 0.25, 0.2); }
  pickup(): void { [587, 880, 1175].forEach((f, i) => this.tone('sine', f, f, 0.15, 0.12, i * 0.06)); }
  gate(): void { this.tone('square', 300, 600, 0.16, 0.15, 0, 'lin'); }
  win(): void { [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.16, i * 0.08)); }
  lose(): void { [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.97, 0.3, 0.14, i * 0.14)); }
  suspicious(): void { this.tone('sine', 500, 760, 0.18, 0.07, 0, 'lin'); }
  spotted(): void { this.tone('sawtooth', 520, 1040, 0.12, 0.15); this.tone('square', 1040, 1040, 0.1, 0.08, 0.12); }
  skid(): void { this.noiseBurst(0.3, 0.35, 3000, 600); }
  bump(): void { this.tone('sine', 160, 60, 0.15, 0.25); }
  fooled(): void { this.tone('triangle', 600, 300, 0.3, 0.1, 0, 'lin'); }
  squeak(): void { this.tone('square', 1400, 2200, 0.08, 0.06); this.tone('square', 2200, 1500, 0.08, 0.05, 0.08); }
  eat(): void { [0, 0.15, 0.3].forEach(d => this.tone('triangle', 220, 140, 0.1, 0.12, d)); }
  wake(): void { this.tone('sine', 200, 500, 0.5, 0.12, 0, 'lin'); }
  checkpoint(): void { this.tone('sine', 660, 990, 0.2, 0.1, 0, 'lin'); }
  /** Alien gibberish: a few quick blips at a pitch. */
  voice(pitch = 1): void {
    const notes = [1, 1.25, 0.9, 1.4, 1.1];
    for (let i = 0; i < 4; i++) {
      const f = 260 * pitch * notes[(i * 3 + Math.round(pitch * 10)) % notes.length];
      this.tone('square', f, f * 1.15, 0.07, 0.05, i * 0.08);
    }
  }
  hug(): void { [523, 659, 784].forEach((f, i) => this.tone('sine', f, f * 1.02, 0.18, 0.12, i * 0.09)); this.tone('triangle', 300, 200, 0.6, 0.08, 0.3); }
  beep(): void { [0, 0.18].forEach(d => this.tone('square', 1200, 1200, 0.1, 0.08, d)); }
  alarm(): void { [0, 0.35, 0.7].forEach(d => { this.tone('sawtooth', 600, 900, 0.17, 0.1, d, 'lin'); this.tone('sawtooth', 900, 600, 0.17, 0.1, d + 0.17, 'lin'); }); }
}

export const sound = new Sound();
