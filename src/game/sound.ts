// Procedural sound effects (Web Audio) + background music. Ported from the legacy game, plus new chase sounds.

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  sfxOn = true;
  musicOn = true;

  /** Must be called from a user gesture (iOS). */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (!this.music) {
      this.music = new Audio('music.mp3');
      this.music.loop = true;
      this.music.volume = 0.35;
    }
    if (this.musicOn) void this.music.play().catch(() => {});
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    if (this.musicOn) void this.music?.play().catch(() => {});
    else this.music?.pause();
    return this.musicOn;
  }

  toggleSfx(): boolean {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }

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
