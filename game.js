// =============================================================================
// PLANET OOPS-A-DAISY: THE ALIEN MAZE ADVENTURE
// - Seamless Analog/Arcade Movement with Wall-Sliding (No tile hopping!)
// - Proximity Alert: Near keys/gates, aliens speed up & move in all 4 directions!
// - 4 Unique Maze Puzzles (Keys, Conveyors, Pressure Plates, 3 Terminals)
// - 3 Difficulty Modes (Easy, Medium, Hard) with Countdown Timer
// - Hilarious Backwards-Patrol Aliens (Knees bend backwards!)
// - Web Audio API Sound Effects + Background Music
// =============================================================================

(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONSTANTS & GRID SETUP
  // ---------------------------------------------------------------------------
  const SIM_HZ = 60;
  const DT = 1.0 / SIM_HZ;

  const COLS = 18;
  const ROWS = 12;
  const TILE = 42;
  const WORLD_W = COLS * TILE; // 756
  const WORLD_H = ROWS * TILE; // 504

  // Difficulty Configurations
  const DIFFICULTY_SETTINGS = {
    EASY: {
      time_limit: 180,
      hearts: 5,
      alien_speed_mult: 0.75,
      cooldown_mult: 0.7,
      name: '🟢 EASY'
    },
    MEDIUM: {
      time_limit: 90,
      hearts: 3,
      alien_speed_mult: 1.0,
      cooldown_mult: 1.0,
      name: '🟡 MEDIUM'
    },
    HARD: {
      time_limit: 50,
      hearts: 2,
      alien_speed_mult: 1.35,
      cooldown_mult: 1.3,
      name: '🔴 HARD'
    }
  };

  // ---------------------------------------------------------------------------
  // AUDIO ENGINE (Web Audio API Synthesizer + HTML5 BGM)
  // ---------------------------------------------------------------------------
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.bgm_el = null;
      this.enabled = true;
      this.music_enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.init_bgm();
    }

    init_bgm() {
      if (!this.bgm_el) {
        this.bgm_el = document.getElementById('bgm');
        if (this.bgm_el) this.bgm_el.volume = 0.45;
      }
      if (this.bgm_el && this.music_enabled) {
        this.bgm_el.play().catch(() => {});
      }
    }

    toggle_music() {
      this.music_enabled = !this.music_enabled;
      if (!this.bgm_el) this.bgm_el = document.getElementById('bgm');
      if (this.bgm_el) {
        if (this.music_enabled) this.bgm_el.play().catch(() => {});
        else this.bgm_el.pause();
      }
      return this.music_enabled;
    }

    toggle_sfx() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    play_hop() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    play_bonk() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.28);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }

    play_honk() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      [440, 554.37].forEach(f => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    }

    play_moonwalk() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(640, t + 0.15);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    }

    play_donut() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.setValueAtTime(260, t + 0.08);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    }

    play_switch() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.setValueAtTime(600, t + 0.06);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    }

    play_pickup() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      [587.33, 880, 1174.66].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t + i * 0.06);
        gain.gain.setValueAtTime(0.12, t + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.16);
      });
    }

    play_alert() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(1040, t + 0.12);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    }

    play_win() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t + idx * 0.08);
        gain.gain.setValueAtTime(0.16, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.32);
      });
    }

    start_farting() {
      if (!this.enabled || !this.ctx) return;
      if (this.fart_interval) return; // already farting

      // Helper to trigger one funny squelchy / rippling fart burst
      const trigger_squelch = () => {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const dur = 0.35 + Math.random() * 0.45;

        // 1. Low fundamental oscillator (frequency dropping: 110Hz down to 35Hz)
        const osc = this.ctx.createOscillator();
        const base_f = 65 + Math.random() * 60;
        osc.type = Math.random() > 0.5 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(base_f, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(25, base_f * 0.4), t + dur);

        // 2. Squelch/vibrato LFO for hilarious wet flutter
        const lfo = this.ctx.createOscillator();
        const lfo_gain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(14 + Math.random() * 12, t); // rapid fluttering
        lfo_gain.gain.setValueAtTime(base_f * 0.6, t);
        lfo.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur);

        // 3. Noise burst for airy gust
        const buffer_size = Math.floor(this.ctx.sampleRate * dur);
        const noise_buf = this.ctx.createBuffer(1, buffer_size, this.ctx.sampleRate);
        const output = noise_buf.getChannelData(0);
        let last_val = 0;
        for (let i = 0; i < buffer_size; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (last_val + 0.04 * white) / 1.04; // Brown/pink noise
          last_val = output[i];
        }
        const noise_src = this.ctx.createBufferSource();
        noise_src.buffer = noise_buf;

        const noise_filter = this.ctx.createBiquadFilter();
        noise_filter.type = 'lowpass';
        noise_filter.frequency.setValueAtTime(320 + Math.random() * 180, t);

        const noise_gain = this.ctx.createGain();
        noise_gain.gain.setValueAtTime(0.28, t);
        noise_gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise_src.connect(noise_filter);
        noise_filter.connect(noise_gain);
        noise_gain.connect(this.ctx.destination);

        // 4. Tone gain
        const osc_gain = this.ctx.createGain();
        osc_gain.gain.setValueAtTime(0.32, t);
        osc_gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(osc_gain);
        osc_gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + dur);
        noise_src.start(t);
        noise_src.stop(t + dur);
      };

      // Trigger first immediately, then endlessly loop funny bursts
      trigger_squelch();
      this.fart_interval = setInterval(() => {
        trigger_squelch();
      }, 420);
    }

    stop_farting() {
      if (this.fart_interval) {
        clearInterval(this.fart_interval);
        this.fart_interval = null;
      }
    }
  }

  const audio = new SoundEngine();

  // ---------------------------------------------------------------------------
  // 4 UNIQUE MAZE LEVEL LAYOUTS & PUZZLES (MATHEMATICALLY & DYNAMICALLY VALIDATED)
  // ---------------------------------------------------------------------------
  const MAZE_TEMPLATES = [
    // Level 1: Suburban Hedge Maze
    {
      level: 1,
      name: "Suburban Hedge Maze",
      item_name: "⚡ Spark Plug",
      puzzle_info: "Find the Bronze Keycard 🗝️ in the garden alcove to unlock the Garden Gate 🚪!",
      nav_quote: "NAV-9000: 'Find the Keycard! Warning: As you approach the gate or key, nearby neighbors enter alert mode!'",
      start: { c: 1, r: 1 },
      grid: [
        "WWWWWWWWWWWWWWWWWW",
        "W.......WW......GW",
        "W.WWWW.WWW.WWW.WIW",
        "W.W..W.....W....WW",
        "W.WW.W.WWW.W.WWW.W",
        "W....W...W...W...W",
        "W.WWWWW.WWW.WWW.WW",
        "W.W.....W...W...WW",
        "W.W.WWWWW.W.WWW.WW",
        "WWW.W.....W.....WW",
        "WK...............W",
        "WWWWWWWWWWWWWWWWWW"
      ],
      aliens: [
        // Guard 1: Keycard pocket is (1,10)-(2,10), sealed above by walls at (1,9),(2,9).
        // Only entrance: doorway (3,9) -> junction (3,10). Guard sweeps cols 1..3 under the doorway.
        { c: 2, r: 10, dir: -1, axis: 'x', min: 1.5, max: 3.5, spd: 60 },
        // Guard 2: patrols row 7 cols 9 to 11 — guards the mid-level crossing
        { c: 10, r: 7, dir: 1, axis: 'x', min: 9, max: 11, spd: 65 },
        // Guard 3: patrols row 1 cols 11 to 14 — guards the approach to Gate at (16,1)
        { c: 13, r: 1, dir: 1, axis: 'x', min: 11, max: 14, spd: 70 }
      ]
    },

    // Level 2: Oops-a-Daisy Elementary
    {
      level: 2,
      name: "Oops-a-Daisy Elementary",
      item_name: "🔋 Hyper-Battery",
      puzzle_info: "Hallway conveyors pull in reverse! Flip the Wall Lever 🕹️ or use Moonwalk 👟 to reach the Office!",
      nav_quote: "NAV-9000: 'The school walkways push backward! Flip the lever in the teacher lounge to reverse them!'",
      start: { c: 1, r: 10 },
      grid: [
        "WWWWWWWWWWWWWWWWWW",
        "WS..W....W.......W",
        "W...W.WW.W.WWWWW.W",
        "W...W.WW.W.W...W.W",
        "W.W.W..W.W.W.W.WGW",
        "W.W....W...W.W.WIW",
        "WWWWWWWWWW.W.W.WWW",
        "W.CCCCCCCCCC.W...W",
        "W.W.WWWWWWWWWWWW.W",
        "W.W..............W",
        "W...WWWWWWWWWWWW.W",
        "WWWWWWWWWWWWWWWWWW"
      ],
      conveyor_dir: -1,
      aliens: [
        { c: 2, r: 2, dir: 1, axis: 'x', min: 1, max: 3, spd: 60 },
        { c: 2, r: 10, dir: 1, axis: 'x', min: 1, max: 3, spd: 70 },
        // Keep every patrol entirely inside its hallway.  Column 11 is a wall.
        { c: 12, r: 3, dir: 1, axis: 'x', min: 12, max: 14, spd: 65 },
        { c: 9, r: 9, dir: 1, axis: 'x', min: 5, max: 14, spd: 80 },
        { c: 8, r: 3, dir: 1, axis: 'y', min: 1, max: 5, spd: 65 }
      ]
    },

    // Level 3: Downtown Neon Market
    {
      level: 3,
      name: "Downtown Neon Market",
      item_name: "🛞 Steering Wheel",
      puzzle_info: "Laser Barrier ⚡ blocks the alley! Toss a Donut 🍩 onto the floor Pressure Plate 🔘 to hold it open!",
      nav_quote: "NAV-9000: 'Laser gate active! Heavy pressure plate required. Throw a space donut on it to lure an alien onto the plate!'",
      start: { c: 1, r: 1 },
      grid: [
        "WWWWWWWWWWWWWWWWWW",
        "W...W........W...W",
        "W.W.W.WWWWWW.W.W.W",
        "W.W...W....W...W.W",
        "W.W.WWW.WW.WWWWW.W",
        "W.....W..P...W...W",
        "W.W.W.W.WWWW.W.W.W",
        "W...W.W....W.W.W.W",
        "W.W.W.WWWW.W.W.W.W",
        "W.W.W....W.W.WGW.W",
        "W...W......W...WIW",
        "WWWWWWWWWWWWWWWWWW"
      ],
      plate: { c: 9, r: 5 },
      gate: { c: 14, r: 9 },
      aliens: [
        { c: 8, r: 1, dir: 1, axis: 'x', min: 5, max: 12, spd: 80 },
        { c: 8, r: 3, dir: 1, axis: 'x', min: 7, max: 10, spd: 85 },
        { c: 2, r: 5, dir: 1, axis: 'x', min: 1, max: 4, spd: 75 },
        { c: 16, r: 5, dir: 1, axis: 'y', min: 2, max: 5, spd: 85 },
        { c: 6, r: 9, dir: 1, axis: 'x', min: 5, max: 8, spd: 90 }
      ]
    },

    // Level 4: The Grand Spaceport
    {
      level: 4,
      name: "The Grand Spaceport",
      item_name: "🚀 Space Rocket Launchpad",
      puzzle_info: "The Rocket Shield is locked! Activate Energy Terminals A, B, and C in 3 quadrants to escape!",
      nav_quote: "NAV-9000: 'Final security lockdown! Hack all 3 power terminals to drop the forcefield and board the spaceship!'",
      start: { c: 8, r: 5 },
      grid: [
        "WWWWWWWWWWWWWWWWWW",
        "WSW....W....W..WSW",
        "W.W....W....W....W",
        "W...W......W.....W",
        "WWW.W.WWWW.W.WWW.W",
        "W...W......W...W.W",
        "W.WWW.WWWW.WWW.W.W",
        "W...W......W...W.W",
        "WWW.W.WWWW.W.WWW.W",
        "W...W....W.W...WGW",
        "WSW.WWWW.W...W.WIW",
        "WWWWWWWWWWWWWWWWWW"
      ],
      terminals: [
        { c: 1, r: 1, active: false, label: 'A' },
        { c: 16, r: 1, active: false, label: 'B' },
        { c: 1, r: 10, active: false, label: 'C' }
      ],
      aliens: [
        { c: 4, r: 1, dir: 1, axis: 'x', min: 3, max: 6, spd: 85 },
        { c: 9, r: 1, dir: 1, axis: 'x', min: 8, max: 11, spd: 85 },
        { c: 7, r: 3, dir: 1, axis: 'x', min: 6, max: 9, spd: 95 },
        { c: 7, r: 7, dir: 1, axis: 'x', min: 6, max: 9, spd: 95 },
        { c: 6, r: 9, dir: 1, axis: 'x', min: 5, max: 8, spd: 90 }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // INPUT STATE
  // ---------------------------------------------------------------------------
  const input = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  // ---------------------------------------------------------------------------
  // GAME STATE
  // ---------------------------------------------------------------------------
  const state = {
    difficulty: 'MEDIUM',
    game_state: 'TITLE',
    level_index: 0,
    score: 0,
    time_left: 90,
    hearts: 3,
    max_hearts: 3,

    // Smooth Continuous Player Movement
    player_x: TILE * 1.5,
    player_y: TILE * 1.5,
    face_dir: 1, // 0=Up, 1=Right, 2=Down, 3=Left
    walk_phase: 0,
    step_sound_timer: 0,
    invincible_t: 0,

    // Active Level Maze Data
    grid: [],
    gate_open: false,
    has_key: false,
    lever_pulled: false,
    conveyor_active_dir: -1,
    plate_pressed: false,
    terminals_hacked: 0,
    terminal_active: [],

    // Gadgets
    honk_cooldown: 0,
    honk_timer: 0,
    moonwalk_cooldown: 0,
    moonwalk_timer: 0,
    donut_cooldown: 0,
    donut_timer: 0,
    donut_x: 0,
    donut_y: 0,
    donut_eater_index: -1,

    // Aliens
    aliens: [],

    // Fart Timeout Mode
    is_farting: false,
    fart_timer: 0,

    // Particles & Floating Text
    particles: [],
    floating_texts: [],

    // Keycard Spawn Location
    key_spawn: null,

    // Level Designer & Grid Mode
    show_grid: false,
    editor_mode: false,
    editor_tool: 'wall',
    selected_alien_idx: -1,
    is_painting: false
  };

  // ---------------------------------------------------------------------------
  // COLLISION & TILE HELPERS
  // ---------------------------------------------------------------------------
  function is_wall(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
    const cell = state.grid[r][c];
    if (cell === 'W') return true;
    if (cell === 'G' && !state.gate_open) return true;
    return false;
  }

  function can_stand(x, y) {
    const r = 11; // Player bounding radius
    const c1 = Math.floor((x - r) / TILE);
    const c2 = Math.floor((x + r) / TILE);
    const r1 = Math.floor((y - r) / TILE);
    const r2 = Math.floor((y + r) / TILE);
    if (is_wall(c1, r1) || is_wall(c2, r1) || is_wall(c1, r2) || is_wall(c2, r2)) {
      return false;
    }
    return true;
  }

  // Fast raycast line-of-sight check between alien and player
  function has_line_of_sight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist > 185) return false;
    const steps = Math.max(1, Math.floor(dist / 8));
    for (let i = 1; i < steps; i++) {
      const rx = x1 + (x2 - x1) * (i / steps);
      const ry = y1 + (y2 - y1) * (i / steps);
      const c = Math.floor(rx / TILE);
      const r = Math.floor(ry / TILE);
      if (is_wall(c, r)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // LEVEL INITIALIZATION
  // ---------------------------------------------------------------------------
  function load_level(idx) {
    state.level_index = Math.min(idx, MAZE_TEMPLATES.length - 1);
    let tmpl = MAZE_TEMPLATES[state.level_index];

    // Check for user-saved custom level in localStorage
    try {
      const saved_custom = localStorage.getItem('custom_level_' + state.level_index);
      if (saved_custom) {
        const parsed = JSON.parse(saved_custom);
        if (parsed && Array.isArray(parsed.grid) && Array.isArray(parsed.aliens)) {
          tmpl = parsed;
        }
      }
    } catch (e) {}

    const diff = DIFFICULTY_SETTINGS[state.difficulty];

    state.time_left = diff.time_limit;
    state.hearts = diff.hearts;
    state.max_hearts = diff.hearts;
    state.invincible_t = 0;

    // Reset Player to Start Position
    state.player_x = tmpl.start.c * TILE + TILE / 2;
    state.player_y = tmpl.start.r * TILE + TILE / 2;
    state.face_dir = 1;
    state.walk_phase = 0;
    state.step_sound_timer = 0;

    // Reset Puzzles
    state.gate_open = false;
    state.has_key = false;
    state.lever_pulled = false;
    state.plate_pressed = false;
    state.terminals_hacked = 0;
    // Terminal progress belongs to this attempt, never to the shared template.
    // This prevents a retry from leaving a closed gate with unhackable terminals.
    state.terminal_active = (tmpl.terminals || []).map(() => false);
    state.conveyor_active_dir = tmpl.conveyor_dir || -1;

    // Copy Maze Grid
    state.grid = tmpl.grid.map(row => row.split(''));

    // Record Keycard spawn location for clean reset upon death
    state.key_spawn = null;
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        if (state.grid[r][c] === 'K') {
          state.key_spawn = { c, r };
        }
      }
    }

    // Reset Gadgets
    state.honk_cooldown = 0;
    state.honk_timer = 0;
    state.moonwalk_cooldown = 0;
    state.moonwalk_timer = 0;
    state.donut_cooldown = 0;
    state.donut_timer = 0;
    state.donut_eater_index = -1;

    // Load Aliens
    state.aliens = tmpl.aliens.map((a, i) => ({
      x: a.c * TILE + TILE / 2,
      y: a.r * TILE + TILE / 2,
      home_c: a.c,
      home_r: a.r,
      home_dir: a.dir,
      dir: a.dir,
      vx: (a.axis === 'x') ? a.dir : 0,
      vy: (a.axis === 'y') ? a.dir : 0,
      axis: a.axis,
      min: a.min,
      max: a.max,
      base_spd: a.spd * diff.alien_speed_mult,
      spd: a.spd * diff.alien_speed_mult,
      phase: i * 1.5,
      frozen_t: 0,
      alert: false,
      chasing: false,
      lost_sight_t: 0,
      sugar_rush_t: 0,
      is_eating: false,
      eat_t: 0,
      returning: false,
      palette_id: i % 5
    }));

    state.particles = [];
    state.floating_texts = [];
    state.is_farting = false;
    state.fart_timer = 0;
    audio.stop_farting();

    update_hud();
    set_dialogue(tmpl.nav_quote);
  }

  // ---------------------------------------------------------------------------
  // TILE INTERACTION TRIGGERS
  // ---------------------------------------------------------------------------
  function check_tile_step(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const cell = state.grid[r][c];

    // 🗝️ Keycard Pickup
    if (cell === 'K') {
      state.has_key = true;
      state.gate_open = true;
      state.grid[r][c] = '.';
      audio.play_pickup();
      spawn_floating_text(c * TILE + TILE / 2, r * TILE, "🗝️ KEYCARD FOUND! GATE OPEN!", "#ffd600");
    }

    // 🕹️ Wall Switch / Lever
    if (cell === 'S') {
      if (state.level_index === 1 && !state.lever_pulled) {
        state.lever_pulled = true;
        state.conveyor_active_dir = 1; // Reverse conveyors
        state.gate_open = true;
        audio.play_switch();
        spawn_floating_text(c * TILE + TILE / 2, r * TILE, "🔄 CONVEYORS REVERSED!", "#00e5ff");
      } else if (state.level_index === 3) {
        const tmpl = MAZE_TEMPLATES[3];
        const termIndex = tmpl.terminals.findIndex(t => t.c === c && t.r === r);
        const term = tmpl.terminals[termIndex];
        if (term && !state.terminal_active[termIndex]) {
          state.terminal_active[termIndex] = true;
          state.terminals_hacked++;
          audio.play_switch();
          spawn_floating_text(c * TILE + TILE / 2, r * TILE, `🖥️ TERMINAL ${term.label} HACKED! (${state.terminals_hacked}/3)`, "#00ffd5");

          if (state.terminals_hacked >= 3) {
            state.gate_open = true;
            spawn_floating_text(WORLD_W / 2, WORLD_H / 2, "🚀 ROCKET SHIELD DROPPED!", "#ffd600");
          }
        }
      }
    }

    // ⚡ Quest Item / Victory
    if (cell === 'I') {
      audio.play_win();
      on_level_complete();
    }
  }

  // ---------------------------------------------------------------------------
  // GADGET ACTIONS
  // ---------------------------------------------------------------------------
  function use_gadget(num) {
    if (state.game_state !== 'PLAY') return;
    audio.init();
    const diff = DIFFICULTY_SETTINGS[state.difficulty];

    if (num === 1) {
      // 🎺 Squeaky Honk (Freeze all nearby aliens for 3s)
      if (state.honk_cooldown <= 0) {
        state.honk_cooldown = 6.0 * diff.cooldown_mult;
        state.honk_timer = 3.0;
        audio.play_honk();
        spawn_floating_text(state.player_x, state.player_y - 20, "🎺 SQUEAKY HONK!", "#ffd600");

        state.aliens.forEach(a => {
          const dist = Math.hypot(a.x - state.player_x, a.y - state.player_y);
          if (dist < 220) a.frozen_t = 3.0;
        });
      }
    } else if (num === 2) {
      // 👟 Reverse Moonwalk (Walk through guards / push against conveyors for 3.5s)
      if (state.moonwalk_cooldown <= 0) {
        state.moonwalk_cooldown = 8.0 * diff.cooldown_mult;
        state.moonwalk_timer = 3.5;
        audio.play_moonwalk();
        spawn_floating_text(state.player_x, state.player_y - 20, "👟 MOONWALK ON!", "#cc66ff");
      }
    } else if (num === 3) {
      // 🍩 Space Donut Toss (Unpredictable, wild bounce in a nearby area!)
      if (state.donut_cooldown <= 0) {
        const landing = find_donut_landing();
        if (!landing) {
          spawn_floating_text(state.player_x, state.player_y - 20, "🍩 NO CLEAR LANDING SPOT", "#ff9100");
          return;
        }

        state.donut_cooldown = 10.0 * diff.cooldown_mult;
        state.donut_timer = 9.0;
        state.donut_x = landing.x;
        state.donut_y = landing.y;
        audio.play_donut();

        // Burst of sweet pastry crumbs at landing point
        spawn_burst(landing.x, landing.y, 14, 1);

        // The landing logic already picked which alien goes for it (by walking distance)
        const closest_idx = (landing.eater !== undefined) ? landing.eater : -1;
        state.donut_eater_index = closest_idx;
        if (closest_idx >= 0) {
          spawn_floating_text(state.aliens[closest_idx].x, state.aliens[closest_idx].y - 24, "🍩 SMELLS DONUT!", "#ff4081");
        }

        const label = landing.is_wild ? "🍩 WILD BOUNCE!" : "🍩 DONUT TOSS!";
        spawn_floating_text(state.donut_x, state.donut_y - 14, label, "#ff4081");
      }
    }
  }

  // Breadth-first walking distance (in tiles) from (sc, sr) over open floor.
  // `blocked` is an optional {c, r} tile treated as a wall (used to stop paths going through the player).
  function bfs_dist(sc, sr, blocked) {
    const dist = [];
    for (let r = 0; r < ROWS; r++) dist.push(new Array(COLS).fill(Infinity));
    if (is_wall(sc, sr)) return dist;
    dist[sr][sc] = 0;
    const q = [[sc, sr]];
    for (let h = 0; h < q.length; h++) {
      const [c, r] = q[h];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (is_wall(nc, nr)) continue;
        if (blocked && nc === blocked.c && nr === blocked.r) continue;
        if (dist[nr][nc] !== Infinity) continue;
        dist[nr][nc] = dist[r][c] + 1;
        q.push([nc, nr]);
      }
    }
    return dist;
  }

  // Next tile to step onto when walking from (sc, sr) to (gc, gr), or null if unreachable.
  function next_step_toward(sc, sr, gc, gr) {
    if (sc === gc && sr === gr) return { c: gc, r: gr };
    const d = bfs_dist(gc, gr, null); // distance field from the goal
    let best = null;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = sc + dc, nr = sr + dr;
      if (is_wall(nc, nr)) continue;
      if (d[nr][nc] < d[sr][sc] && (!best || d[nr][nc] < d[best.r][best.c])) best = { c: nc, r: nr };
    }
    return best;
  }

  // Walk an alien along the tile grid toward (gc, gr). Returns true once standing on the goal tile center.
  function walk_alien_toward(a, gc, gr, spd, dt) {
    const cc = Math.floor(a.x / TILE), cr = Math.floor(a.y / TILE);
    const nxt = next_step_toward(cc, cr, gc, gr);
    if (!nxt) return false;
    const cx = cc * TILE + TILE / 2, cy = cr * TILE + TILE / 2;
    let tx = nxt.c * TILE + TILE / 2, ty = nxt.r * TILE + TILE / 2;
    // Stay on the corridor center-line: align the perpendicular axis first so we never cut corners.
    if (nxt.c !== cc && Math.abs(a.y - cy) > 1) { tx = a.x; ty = cy; }
    else if (nxt.r !== cr && Math.abs(a.x - cx) > 1) { tx = cx; ty = a.y; }
    const dx = tx - a.x, dy = ty - a.y;
    const len = Math.hypot(dx, dy);
    const step = spd * dt;
    if (len <= step) { a.x = tx; a.y = ty; }
    else { a.x += dx / len * step; a.y += dy / len * step; }
    if (len > 0.001) {
      a.vx = dx / (len || 1);
      a.vy = dy / (len || 1);
      if (a.axis === 'x' && Math.abs(dx) > 0.01) a.dir = Math.sign(dx);
      if (a.axis === 'y' && Math.abs(dy) > 0.01) a.dir = Math.sign(dy);
    }
    const gx = gc * TILE + TILE / 2, gy = gr * TILE + TILE / 2;
    return Math.hypot(a.x - gx, a.y - gy) < 1;
  }

  const DONUT_THROW_STEPS = 3;     // donut lands this many walking steps from the player
  const DONUT_MAX_ALIEN_STEPS = 7; // aliens further than this (walking) ignore the donut
  const DONUT_EAT_TIME = 0.8;      // seconds the alien is busy eating (tune difficulty here)

  // Donut landing rule (deterministic, based on walking distance — not straight-line raycasts):
  //  1. The target alien is the one closest to the player by walking distance (<= 7 steps).
  //  2. Candidate tiles are exactly 3 walking steps from the player (falls back to 2, then 4).
  //  3. The alien must be able to reach the tile WITHOUT walking through the player's tile.
  //  4. Pick the candidate farthest (walking) from the alien's guard post, so it is pulled away from what it guards.
  function find_donut_landing() {
    const pc = Math.floor(state.player_x / TILE), pr = Math.floor(state.player_y / TILE);
    const player_tile = { c: pc, r: pr };
    const dist_p = bfs_dist(pc, pr, null);

    // 1. Target alien by walking distance from the player
    let eater = -1, eater_d = Infinity;
    state.aliens.forEach((a, idx) => {
      const ac = Math.floor(a.x / TILE), ar = Math.floor(a.y / TILE);
      const d = dist_p[ar] ? dist_p[ar][ac] : Infinity;
      if (d <= DONUT_MAX_ALIEN_STEPS && d < eater_d) { eater_d = d; eater = idx; }
    });

    const face_vec = [[0, -1], [1, 0], [0, 1], [-1, 0]][state.face_dir] || [1, 0];
    const tiles_at = (n) => {
      const out = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (dist_p[r][c] === n) out.push({ c, r });
      return out;
    };
    const to_landing = (t, eater_idx) => ({
      x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE / 2, c: t.c, r: t.r, eater: eater_idx, is_wild: false
    });

    if (eater >= 0) {
      const a = state.aliens[eater];
      const ac = Math.floor(a.x / TILE), ar = Math.floor(a.y / TILE);
      const dist_a = bfs_dist(ac, ar, player_tile);          // alien walking dist, not through player
      const dist_h = bfs_dist(a.home_c, a.home_r, player_tile); // dist from its guard post
      for (const n of [DONUT_THROW_STEPS, DONUT_THROW_STEPS - 1, DONUT_THROW_STEPS + 1]) {
        let best = null, best_score = -Infinity;
        for (const t of tiles_at(n)) {
          if (dist_a[t.r][t.c] > DONUT_MAX_ALIEN_STEPS) continue; // includes unreachable (Infinity)
          const home_steps = dist_h[t.r][t.c];
          if (!isFinite(home_steps)) continue;
          const home_euclid = Math.hypot(t.c - a.home_c, t.r - a.home_r);
          const score = home_steps * 100 + home_euclid;
          if (score > best_score) { best_score = score; best = t; }
        }
        if (best) return to_landing(best, eater);
      }
    }

    // No alien nearby (or none can reach without going through you): land 3 steps away, favoring facing direction
    for (const n of [DONUT_THROW_STEPS, DONUT_THROW_STEPS - 1, 1]) {
      let best = null, best_dot = -Infinity;
      for (const t of tiles_at(n)) {
        const dot = (t.c - pc) * face_vec[0] + (t.r - pr) * face_vec[1];
        if (dot > best_dot) { best_dot = dot; best = t; }
      }
      if (best) return to_landing(best, -1);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // SIMULATION TICK (Fixed dt = 1/60s)
  // ---------------------------------------------------------------------------
  function sim_update(dt) {
    if (state.game_state !== 'PLAY') return;

    // Countdown Timer
    state.time_left -= dt;
    if (state.time_left <= 0) {
      state.time_left = 0;
      state.is_farting = true;
      audio.start_farting();
      show_overlay("TIME_UP");
      return;
    }

    // Cooldown timers
    if (state.invincible_t > 0) state.invincible_t -= dt;
    if (state.honk_cooldown > 0) state.honk_cooldown -= dt;
    if (state.honk_timer > 0) state.honk_timer -= dt;
    if (state.moonwalk_cooldown > 0) state.moonwalk_cooldown -= dt;
    if (state.moonwalk_timer > 0) state.moonwalk_timer -= dt;
    if (state.donut_cooldown > 0) state.donut_cooldown -= dt;
    if (state.donut_timer > 0) state.donut_timer -= dt;

    // 1. SEAMLESS PLAYER CONTINUOUS MOVEMENT
    let mx = 0;
    let my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;

    if (mx !== 0 && my !== 0) {
      mx *= 0.7071;
      my *= 0.7071;
    }

    const move_speed = 160; // Fluid, responsive speed
    if (mx !== 0 || my !== 0) {
      state.walk_phase += dt * 11;

      // Update face direction
      if (Math.abs(mx) > Math.abs(my)) {
        state.face_dir = (mx > 0) ? 1 : 3;
      } else {
        state.face_dir = (my > 0) ? 2 : 0;
      }

      // Footstep sound blip at pleasant intervals
      state.step_sound_timer += dt;
      if (state.step_sound_timer > 0.22) {
        audio.play_hop();
        state.step_sound_timer = 0;
      }

      // Smooth Movement with Corner Sliding (Independent X & Y)
      const next_x = state.player_x + mx * move_speed * dt;
      if (can_stand(next_x, state.player_y)) {
        state.player_x = next_x;
      }

      const next_y = state.player_y + my * move_speed * dt;
      if (can_stand(state.player_x, next_y)) {
        state.player_y = next_y;
      }
    } else {
      state.step_sound_timer = 0.2;
    }

    // 2. TILE INTERACTIONS & CONVEYORS
    const cur_c = Math.floor(state.player_x / TILE);
    const cur_r = Math.floor(state.player_y / TILE);
    if (cur_c >= 0 && cur_c < COLS && cur_r >= 0 && cur_r < ROWS) {
      const tile = state.grid[cur_r][cur_c];

      // Conveyor push (Level 2)
      if (tile === 'C' && state.moonwalk_timer <= 0) {
        const push_x = state.player_x + state.conveyor_active_dir * 95 * dt;
        if (can_stand(push_x, state.player_y)) {
          state.player_x = push_x;
        }
      }

      check_tile_step(cur_c, cur_r);
    }

    // 3. PRESSURE PLATE CHECK (Level 3)
    if (state.level_index === 2) {
      const tmpl = MAZE_TEMPLATES[2];
      let plate_on = false;

      // Player on plate
      if (cur_c === tmpl.plate.c && cur_r === tmpl.plate.r) plate_on = true;

      // Alien on plate
      state.aliens.forEach(a => {
        const ac = Math.floor(a.x / TILE);
        const ar = Math.floor(a.y / TILE);
        if (ac === tmpl.plate.c && ar === tmpl.plate.r) plate_on = true;
      });

      // Donut on plate
      if (state.donut_timer > 0) {
        const dc = Math.floor(state.donut_x / TILE);
        const dr = Math.floor(state.donut_y / TILE);
        if (dc === tmpl.plate.c && dr === tmpl.plate.r) plate_on = true;
      }

      state.plate_pressed = plate_on;
      state.gate_open = plate_on; // Laser gate stays open while pressed
    }

    // 5. UPDATE ALIENS (Clean, Predictable, Arcade-Quality Movement with Line-of-Sight Awareness & Sugar Rush)
    state.aliens.forEach((a, i) => {
      a.phase += dt * (a.sugar_rush_t > 0 ? 18 : (a.is_eating ? 14 : 9));

      // Sugar Rush countdown & sparkling particle trail
      if (a.sugar_rush_t > 0) {
        a.sugar_rush_t -= dt;
        if (Math.random() < 0.28) {
          spawn_burst(a.x + (Math.random() - 0.5) * 12, a.y + (Math.random() - 0.5) * 12, 1, 0);
        }
      }

      if (a.frozen_t > 0) {
        // Alien is frozen in place: cannot patrol or chase, but remains a solid obstacle!
        a.frozen_t -= dt;
      } else if (a.is_eating) {
        // Alien is happily munching the donut!
        a.eat_t -= dt;
        a.vx = 0;
        a.vy = 0;
        if (a.eat_t <= 0) {
          a.is_eating = false;
          a.sugar_rush_t = 6.0; // DOUBLE SPEED until it gets back to its post (or 6s run out)
          a.returning = true;   // sprint straight back to the guard post to check on the key
          audio.play_pickup();
          spawn_floating_text(a.x, a.y - 24, "⚡️ SUGAR RUSH! 2x SPEED!", "#ffd600");
          spawn_burst(a.x, a.y, 18, 0);
        }
      } else {
        // Active speed: base speed doubled if in Sugar Rush, boosted if alarms active
        const sugar_mult = (a.sugar_rush_t > 0) ? 2.0 : 1.0;
        const cur_spd = (state.has_key || state.lever_pulled || state.terminals_hacked > 0) 
          ? (a.base_spd * 1.2 * sugar_mult) 
          : (a.base_spd * sugar_mult);
        const global_alarm = state.has_key || state.lever_pulled || (state.terminals_hacked > 0);

        // A. Lured by Donut (ONLY the single targeted alien!)
        let lured_by_donut = false;
        if (state.donut_timer > 0 && i === state.donut_eater_index) {
          const dist_to_donut = Math.hypot(a.x - state.donut_x, a.y - state.donut_y);
          if (dist_to_donut < 18) {
            // REACHED THE DONUT: Start Eating!
            state.donut_timer = 0; // Donut is eaten off the ground!
            state.donut_eater_index = -1;
            a.is_eating = true;
            a.eat_t = DONUT_EAT_TIME;
            spawn_floating_text(a.x, a.y - 20, "🍩 NOM NOM NOM!", "#ff4081");
            spawn_burst(a.x, a.y, 12, 1);
            lured_by_donut = true;
          } else {
            // Walking toward donut along the corridors (never cuts through walls / corners)
            lured_by_donut = true;
            a.alert = false;
            a.chasing = false;
            walk_alien_toward(a, Math.floor(state.donut_x / TILE), Math.floor(state.donut_y / TILE), a.base_spd * 0.9, dt);
          }
        }

        if (!lured_by_donut && !a.is_eating) {
          // B. Line-of-sight Player Detection
          const dist_to_player = Math.hypot(a.x - state.player_x, a.y - state.player_y);
          let sees_player = false;

          // Proximity detection: if player is within 34px in open view, alien notices immediately
          if (dist_to_player < 34 && has_line_of_sight(a.x, a.y, state.player_x, state.player_y)) {
            sees_player = true;
          } else if (dist_to_player < 185) {
            // Corridor alignment & facing direction check
            if (a.axis === 'x') {
              const facing = (a.dir > 0 && state.player_x >= a.x - 14) ||
                             (a.dir < 0 && state.player_x <= a.x + 14);
              const in_corridor = Math.abs(state.player_y - a.y) < TILE * 0.85;
              if (facing && in_corridor && has_line_of_sight(a.x, a.y, state.player_x, state.player_y)) {
                sees_player = true;
              }
            } else {
              const facing = (a.dir > 0 && state.player_y >= a.y - 14) ||
                             (a.dir < 0 && state.player_y <= a.y + 14);
              const in_corridor = Math.abs(state.player_x - a.x) < TILE * 0.85;
              if (facing && in_corridor && has_line_of_sight(a.x, a.y, state.player_x, state.player_y)) {
                sees_player = true;
              }
            }
          }

          if (sees_player) {
            if (!a.chasing) {
              a.chasing = true;
              audio.play_alert();
              spawn_floating_text(a.x, a.y - 22, "❗️ SPOTTED!", "#ff1744");
            }
            a.lost_sight_t = 0;
            a.alert = true;

            // Charge along corridor directly toward player!
            const chase_spd = a.base_spd * 1.35 * sugar_mult;
            if (a.axis === 'x') {
              const to_p = Math.sign(state.player_x - a.x);
              if (to_p !== 0) a.dir = to_p;
              a.vx = a.dir;
              a.vy = 0;
              const nextX = a.x + a.dir * chase_spd * dt;
              if (can_stand(nextX, a.y)) a.x = nextX;
            } else {
              const to_p = Math.sign(state.player_y - a.y);
              if (to_p !== 0) a.dir = to_p;
              a.vx = 0;
              a.vy = a.dir;
              const nextY = a.y + a.dir * chase_spd * dt;
              if (can_stand(a.x, nextY)) a.y = nextY;
            }
          } else if (a.chasing) {
            // Player broke line of sight (e.g. turned corner): search briefly then return to patrol
            a.lost_sight_t += dt;
            if (a.lost_sight_t > 1.2) {
              a.chasing = false;
              a.alert = global_alarm;
              a.returning = true; // nobody here — go back and guard the post
              spawn_floating_text(a.x, a.y - 18, "❓", "#ffb300");
            } else {
              // Continue forward along corridor during brief search window
              const chase_spd = a.base_spd * 1.1 * sugar_mult;
              if (a.axis === 'x') {
                const nextX = a.x + a.dir * chase_spd * dt;
                if (can_stand(nextX, a.y)) a.x = nextX;
                else a.dir = -a.dir;
              } else {
                const nextY = a.y + a.dir * chase_spd * dt;
                if (can_stand(a.x, nextY)) a.y = nextY;
                else a.dir = -a.dir;
              }
            }
          } else if (a.returning) {
            // C1. Return to guard post (at 2x speed while in Sugar Rush). Line-of-sight checks above
            //     still run every frame, so if it spots the player on the way it switches to chasing.
            a.alert = global_alarm;
            if (walk_alien_toward(a, a.home_c, a.home_r, cur_spd, dt)) {
              a.returning = false;
              a.sugar_rush_t = 0; // post checked: rush over, back to normal patrol
              a.dir = (a.home_dir !== undefined) ? a.home_dir : 1;
            }
          } else {
            // C2. Normal Corridor Patrol
            a.alert = global_alarm;

            // Realign smoothly back to home corridor lane if displaced
            if (a.axis === 'x') {
              const home_y = a.home_r * TILE + TILE / 2;
              if (Math.abs(a.y - home_y) > 1.5) {
                const step = Math.sign(home_y - a.y) * cur_spd * dt;
                if (can_stand(a.x, a.y + step)) a.y += step;
                else if (can_stand(a.x, home_y)) a.y = home_y;
              }
            } else {
              const home_x = a.home_c * TILE + TILE / 2;
              if (Math.abs(a.x - home_x) > 1.5) {
                const step = Math.sign(home_x - a.x) * cur_spd * dt;
                if (can_stand(a.x + step, a.y)) a.x += step;
                else if (can_stand(home_x, a.y)) a.x = home_x;
              }
            }

            if (a.axis === 'x') {
              const cur_c = a.x / TILE;

              // In Sugar Rush: roam the entire open hallway!
              // In Normal Patrol: turn around at designated min / max
              if (a.sugar_rush_t <= 0) {
                if (a.dir > 0 && cur_c >= a.max) a.dir = -1;
                else if (a.dir < 0 && cur_c <= a.min) a.dir = 1;
              }

              a.vx = a.dir;
              a.vy = 0;
              const nextX = a.x + a.dir * cur_spd * dt;
              if (can_stand(nextX, a.y)) {
                a.x = nextX;
              } else {
                // Clean bounce off wall without getting stuck!
                a.dir = -a.dir;
                a.vx = a.dir;
              }
            } else {
              const cur_r = a.y / TILE;

              if (a.sugar_rush_t <= 0) {
                if (a.dir > 0 && cur_r >= a.max) a.dir = -1;
                else if (a.dir < 0 && cur_r <= a.min) a.dir = 1;
              }

              a.vx = 0;
              a.vy = a.dir;
              const nextY = a.y + a.dir * cur_spd * dt;
              if (can_stand(a.x, nextY)) {
                a.y = nextY;
              } else {
                // Clean bounce off wall without getting stuck!
                a.dir = -a.dir;
                a.vy = a.dir;
              }
            }
          }
        }
      }

      // Collision with Player (Backwards Knees Bonk!)
      // Evaluated on alien's current real-time coordinates
      const current_dist = Math.hypot(a.x - state.player_x, a.y - state.player_y);
      // A honked alien is confused, not an invisible damage trap.  This gives
      // the player a dependable escape route when a narrow corridor gets busy.
      if (a.frozen_t <= 0 && state.moonwalk_timer <= 0 && state.invincible_t <= 0) {
        if (current_dist < 28) {
          on_player_bonked();
        }
      }
    });

    // 6. UPDATE PARTICLES & TEXTS
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = state.floating_texts.length - 1; i >= 0; i--) {
      const ft = state.floating_texts[i];
      ft.life -= dt;
      ft.y -= dt * 26;
      if (ft.life <= 0) {
        state.floating_texts.splice(i, 1);
      }
    }

    update_hud();
  }

  function on_player_bonked() {
    audio.play_bonk();
    state.hearts--;
    state.invincible_t = 1.8; // Safe respawn window
    state.donut_eater_index = -1;

    // Cleanly drop keycard back to its original floor spawn if player was holding it!
    if (state.has_key) {
      state.has_key = false;
      state.gate_open = false;
      if (state.key_spawn) {
        state.grid[state.key_spawn.r][state.key_spawn.c] = 'K';
      }
      spawn_floating_text(state.player_x, state.player_y - 36, "🗝️ KEYCARD DROPPED BACK!", "#ffd600");
    }

    // 1. Reset player back to start of maze
    const tmpl = MAZE_TEMPLATES[state.level_index];
    state.player_x = tmpl.start.c * TILE + TILE / 2;
    state.player_y = tmpl.start.r * TILE + TILE / 2;

    // 2. Reset ALL aliens back to their original designated posts!
    state.aliens.forEach(a => {
      a.x = a.home_c * TILE + TILE / 2;
      a.y = a.home_r * TILE + TILE / 2;
      a.alert = false;
      a.chasing = false;
      a.lost_sight_t = 0;
      a.sugar_rush_t = 0;
      a.is_eating = false;
      a.eat_t = 0;
      a.returning = false;
      a.dir = (a.home_dir !== undefined) ? a.home_dir : 1;
      a.vx = (a.axis === 'x') ? a.dir : 0;
      a.vy = (a.axis === 'y') ? a.dir : 0;
    });

    spawn_burst(state.player_x, state.player_y, 20, 0);
    spawn_floating_text(state.player_x, state.player_y - 20, "💥 OOPS! BONKED TO START!", "#ff3344");
    update_hud();

    if (state.hearts <= 0) {
      show_overlay("GAME_OVER");
    }
  }

  function on_level_complete() {
    state.score += 1000 + Math.floor(state.time_left * 10);
    if (state.level_index >= 3) {
      show_overlay("CAMPAIGN_WIN");
    } else {
      show_overlay("LEVEL_WIN");
    }
  }

  function spawn_particle(x, y, vx, vy, life, type) {
    state.particles.push({ x, y, vx, vy, life, max_life: life, type });
  }

  function spawn_burst(x, y, count, type) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const spd = 30 + Math.random() * 80;
      spawn_particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, 0.4 + Math.random() * 0.4, type);
    }
  }

  function spawn_floating_text(x, y, str, color) {
    state.floating_texts.push({ x, y, str, color, life: 1.2 });
  }

  // ---------------------------------------------------------------------------
  // RETINA PROCEDURAL VECTOR RENDERING
  // ---------------------------------------------------------------------------
  const ALIEN_PALETTES = [
    { skin: '#00e676', blush: '#ff4081', shirt: '#ff4081', pants: '#304ffe', shoe: '#ffd600', antenna: '#ffd600' },
    { skin: '#b388ff', blush: '#ff80ab', shirt: '#00e5ff', pants: '#7c4dff', shoe: '#ff6e40', antenna: '#00e5ff' },
    { skin: '#ff4081', blush: '#ff80ab', shirt: '#76ff03', pants: '#651fff', shoe: '#18ffff', antenna: '#76ff03' },
    { skin: '#40c4ff', blush: '#ff80ab', shirt: '#ffd600', pants: '#d500f9', shoe: '#ff1744', antenna: '#ffd600' },
    { skin: '#ffd600', blush: '#ff6e40', shirt: '#651fff', pants: '#00e676', shoe: '#00e5ff', antenna: '#ff4081' }
  ];

  let screen_w = WORLD_W;
  let screen_h = WORLD_H;
  let view_scale = 1.0;
  let view_offset_x = 0;
  let view_offset_y = 0;
  let hover_c = -1;
  let hover_r = -1;

  function render(ctx) {
    ctx.clearRect(0, 0, screen_w, screen_h);

    // Deep space backdrop
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, screen_w, screen_h);

    ctx.save();
    ctx.translate(view_offset_x, view_offset_y);
    ctx.scale(view_scale, view_scale);

    // 1. Draw Maze Tiles with Distinct Themes per Level
    const lvl = state.level_index;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = state.grid[r][c];

        // Level Floor Theming:
        // Level 1: Verdant Alien Garden (Lush Moss & Daisy Petals)
        // Level 2: Retro-Future High School (Polished Checkerboard Linoleum)
        // Level 3: Cyberpunk Neon Market (Sleek Dark Slate & Glowing Cyber Grids)
        // Level 4: Spaceport Hangar (High-Tech Hex Ceramic Launchpad)
        if (lvl === 0) {
          ctx.fillStyle = ((c + r) % 2 === 0) ? '#182b20' : '#14231a';
        } else if (lvl === 1) {
          ctx.fillStyle = ((c + r) % 2 === 0) ? '#241b3d' : '#1f1635';
        } else if (lvl === 2) {
          ctx.fillStyle = ((c + r) % 2 === 0) ? '#131124' : '#0e0c1c';
        } else {
          ctx.fillStyle = ((c + r) % 2 === 0) ? '#1c2430' : '#161c26';
        }
        ctx.fillRect(x, y, TILE, TILE);

        // Subtle Floor Accents & Patterns
        if (lvl === 0 && (c * 7 + r * 13) % 9 === 0) {
          // Tiny decorative daisy petals on garden path
          ctx.fillStyle = 'rgba(255, 230, 100, 0.25)';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (lvl === 2) {
          // Subtle neon floor glow grid
          ctx.strokeStyle = 'rgba(213, 0, 249, 0.04)';
          ctx.strokeRect(x, y, TILE, TILE);
        } else if (lvl === 3) {
          // Launchpad tech markings
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        }

        if (cell === 'W') {
          draw_wall(ctx, x, y, c, r, lvl);
        } else if (cell === 'G') {
          draw_gate(ctx, x, y, state.gate_open);
        } else if (cell === 'C') {
          draw_conveyor(ctx, x, y, state.conveyor_active_dir);
        } else if (cell === 'P') {
          draw_plate(ctx, x, y, state.plate_pressed);
        } else if (cell === 'S') {
          draw_switch(ctx, x, y, lvl);
        } else if (cell === 'K') {
          draw_keycard(ctx, x + TILE / 2, y + TILE / 2);
        } else if (cell === 'I') {
          draw_quest_item(ctx, x + TILE / 2, y + TILE / 2);
        }
      }
    }

    // 2. Draw Donut Trap
    if (state.donut_timer > 0) {
      draw_donut_prop(ctx, state.donut_x, state.donut_y);
    }

    // 3. Draw Patrolling Aliens
    state.aliens.forEach(a => draw_alien(ctx, a));

    // 4. Draw Player (Leo the Astronaut)
    draw_player(ctx);

    // 4b. Endless Fart Smoke Clouds if Time Expired!
    if (state.is_farting) {
      draw_fart_clouds(ctx);
    }

    // 5. Draw Particles
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max_life);
      ctx.fillStyle = (p.type === 0) ? '#ffd600' : (p.type === 2 ? '#8bc34a' : '#00ffd5');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Draw Floating Text
    state.floating_texts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.font = '900 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.str, ft.x, ft.y);
      ctx.restore();
    });

    // 7. Grid & Coordinates Editor Overlay
    if (state.show_grid) {
      draw_grid_overlay(ctx);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // INTERACTIVE GRID & TILE COORDINATES EDITOR OVERLAY
  // ---------------------------------------------------------------------------
  function draw_grid_overlay(ctx) {
    ctx.save();

    // 1. Grid Lines
    ctx.strokeStyle = 'rgba(0, 255, 213, 0.45)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, 0);
      ctx.lineTo(c * TILE, ROWS * TILE);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE);
      ctx.lineTo(COLS * TILE, r * TILE);
      ctx.stroke();
    }

    // 2. Cell Coordinates & Content in EVERY tile
    const tmpl = MAZE_TEMPLATES[state.level_index];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = state.grid[r][c];
        const isHovered = (c === hover_c && r === hover_r);

        // Background badge for coordinate text
        ctx.fillStyle = isHovered ? 'rgba(255, 235, 59, 0.45)' : 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x + 1, y + 1, 26, 12);

        // Coordinate text (col,row)
        ctx.fillStyle = isHovered ? '#000000' : '#00ffd5';
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${c},${r}`, x + 14, y + 10);

        // Objective badge for special cells ONLY (keeps grid crystal clean)
        let label = '';
        let labelColor = '#90caf9';
        if (tmpl && tmpl.start && tmpl.start.c === c && tmpl.start.r === r) {
          label = 'START';
          labelColor = '#76ff03';
        } else if (cell === 'K') {
          label = 'KEY';
          labelColor = '#ffd600';
        } else if (cell === 'G') {
          label = 'GATE';
          labelColor = '#ff1744';
        } else if (cell === 'I') {
          label = 'EXIT';
          labelColor = '#00e676';
        } else if (cell === 'S') {
          label = 'LEVER';
          labelColor = '#00e5ff';
        } else if (cell === 'P') {
          label = 'PLATE';
          labelColor = '#ff9100';
        } else if (cell === 'C') {
          label = 'CONV';
          labelColor = '#2979ff';
        }

        if (label) {
          ctx.fillStyle = labelColor;
          ctx.font = 'bold 9px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, x + TILE / 2, y + TILE - 4);
        }
      }
    }

    // 3. Alien Patrol Paths & Prominent Live Numbered Badges
    state.aliens.forEach((a, i) => {
      ctx.save();
      const pal = ALIEN_PALETTES[a.palette_id % ALIEN_PALETTES.length];
      const strokeColor = pal.blush || '#ff4081';

      // 3A. Draw Patrol Route Track Line
      if (a.axis === 'x') {
        const startX = a.min * TILE;
        const endX = (a.max + 1) * TILE;
        const lineY = a.r * TILE + TILE / 2;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, lineY);
        ctx.lineTo(endX, lineY);
        ctx.stroke();

        ctx.fillStyle = strokeColor;
        ctx.fillRect(startX, lineY - 6, 3, 12);
        ctx.fillRect(endX - 3, lineY - 6, 3, 12);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect((startX + endX) / 2 - 42, lineY - 17, 84, 13);
        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`👽 ALIEN #${i+1} [c${a.min}↔c${a.max}]`, (startX + endX) / 2, lineY - 7);
      } else {
        const startY = a.min * TILE;
        const endY = (a.max + 1) * TILE;
        const lineX = a.c * TILE + TILE / 2;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(lineX, startY);
        ctx.lineTo(lineX, endY);
        ctx.stroke();

        ctx.fillStyle = strokeColor;
        ctx.fillRect(lineX - 6, startY, 12, 3);
        ctx.fillRect(lineX - 6, endY - 3, 12, 3);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(lineX - 42, (startY + endY) / 2 - 7, 84, 13);
        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`👽 ALIEN #${i+1} [r${a.min}↔r${a.max}]`, lineX, (startY + endY) / 2 + 3);
      }

      // 3B. Floating Numbered Badge directly above the LIVE alien sprite
      const curCol = Math.floor(a.x / TILE);
      const curRow = Math.floor(a.y / TILE);
      const badgeW = 60;
      const badgeH = 16;
      const badgeX = a.x - badgeW / 2;
      const badgeY = a.y - 32;

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(10, 8, 24, 0.92)';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      ctx.fillStyle = '#ffd600';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`👽 #${i+1} (${curCol},${curRow})`, a.x, badgeY + 12);

      ctx.restore();
    });

    // 4. Hovered Cell Highlight Box & Floating Inspector Bar
    if (hover_c >= 0 && hover_r >= 0) {
      const hx = hover_c * TILE;
      const hy = hover_r * TILE;
      const hcell = state.grid[hover_r][hover_c];

      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 3;
      ctx.strokeRect(hx, hy, TILE, TILE);

      let typeDesc = `Floor '.'`;
      if (tmpl && tmpl.start && tmpl.start.c === hover_c && tmpl.start.r === hover_r) typeDesc = `PLAYER START`;
      else if (hcell === 'W') typeDesc = `Wall 'W'`;
      else if (hcell === 'G') typeDesc = `Gate 'G' (${state.gate_open ? 'OPEN' : 'LOCKED'})`;
      else if (hcell === 'K') typeDesc = `Keycard 'K'`;
      else if (hcell === 'I') typeDesc = `Level Exit 'I'`;
      else if (hcell === 'S') typeDesc = `Switch / Lever 'S'`;
      else if (hcell === 'P') typeDesc = `Pressure Plate 'P'`;
      else if (hcell === 'C') typeDesc = `Conveyor 'C'`;

      const alienOnTile = state.aliens.find(a => Math.floor(a.x / TILE) === hover_c && Math.floor(a.y / TILE) === hover_r);
      if (alienOnTile) {
        const aIdx = state.aliens.indexOf(alienOnTile) + 1;
        typeDesc += ` + 👽 ALIEN #${aIdx} (Patrol: ${alienOnTile.axis.toUpperCase()}[${alienOnTile.min}..${alienOnTile.max}])`;
      }

      // Top Pinned Inspector Banner
      ctx.fillStyle = 'rgba(10, 8, 24, 0.95)';
      ctx.fillRect(WORLD_W / 2 - 210, 8, 420, 24);
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(WORLD_W / 2 - 210, 8, 420, 24);

      ctx.fillStyle = '#ffd600';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`📐 CELL [Col: ${hover_c}, Row: ${hover_r}]  ➜  ${typeDesc}`, WORLD_W / 2, 24);
    } else {
      // General Editor Mode Helper Banner
      ctx.fillStyle = 'rgba(10, 8, 24, 0.85)';
      ctx.fillRect(WORLD_W / 2 - 180, 8, 360, 20);
      ctx.strokeStyle = '#00ffd5';
      ctx.lineWidth = 1;
      ctx.strokeRect(WORLD_W / 2 - 180, 8, 360, 20);

      ctx.fillStyle = '#00ffd5';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`📐 GRID EDITOR MODE: Hover to inspect | [G] Toggle | [L] Cycle Level`, WORLD_W / 2, 22);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // THEMATIC SMOOTH WALL RENDERING & FART EFFECTS
  // ---------------------------------------------------------------------------
  function draw_fart_clouds(ctx) {
    const px = state.player_x;
    const py = state.player_y;
    const t = performance.now() / 1000;

    ctx.save();
    // Funny jitter on player while farting
    const jitter = Math.sin(t * 40) * 1.5;

    // Fart Puffs billowing outward
    for (let i = 0; i < 5; i++) {
      const phase = (t * 2.5 + i * 0.7) % 3;
      const scale = 8 + phase * 16;
      const alpha = Math.max(0, 0.75 - phase * 0.25);
      const puff_x = px - 10 - phase * 18 + Math.sin(i * 3 + t * 4) * 8 + jitter;
      const puff_y = py + 6 - phase * 12 + Math.cos(i * 2 + t * 3) * 6;

      ctx.fillStyle = `rgba(139, 195, 74, ${alpha})`; // chartreuse green stinky cloud
      ctx.beginPath();
      ctx.arc(puff_x, puff_y, scale, 0, Math.PI * 2);
      ctx.fill();

      // Cloud highlights
      ctx.fillStyle = `rgba(205, 220, 57, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(puff_x + scale * 0.2, puff_y - scale * 0.2, scale * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Comic "💨 PRRRRRT!" bubble above player
    ctx.font = '900 15px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText('💨 PRRRRR-TOOT!', px + jitter, py - 38);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 3D TALL & THIN WALL ARCHITECTURE (Looks like walking through corridors!)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // AUTHENTIC CONTINUOUS 3D WALLS (Connects adjacent tiles seamlessly!)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // AUTHENTIC CONTINUOUS 3D TALL LABYRINTH WALLS (Solid, 0 holes, tall 3D depth)
  // ---------------------------------------------------------------------------
  function draw_wall(ctx, x, y, c, r, lvl) {
    const grid = state.grid;
    const isW = (nc, nr) => {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return true;
      return grid[nr][nc] === 'W';
    };

    const topW = isW(c, r - 1);
    const btmW = isW(c, r + 1);
    const lftW = isW(c - 1, r);
    const rgtW = isW(c + 1, r);

    ctx.save();

    // Palette per level theme
    let facade_dark, cap_light, cap_mid, rim_color, shadow_color;
    if (lvl === 0) {
      // Level 1: Suburban Hedge Maze (Dense, tall verdant botanical hedges)
      facade_dark = '#133a18'; // Tall hedge front in deep shade
      cap_mid = '#25692b';     // Rich hedge green
      cap_light = '#338a3a';   // Sunlit top leaves
      rim_color = '#5cb85c';   // Crisp lit top foliage edge
      shadow_color = 'rgba(5, 20, 10, 0.45)';
    } else if (lvl === 1) {
      // Level 2: Oops-a-Daisy Elementary (Tall school partition & locker bulkheads)
      facade_dark = '#1f1638';
      cap_mid = '#3c2b69';
      cap_light = '#533c8f';
      rim_color = '#9575cd';
      shadow_color = 'rgba(10, 5, 25, 0.45)';
    } else if (lvl === 2) {
      // Level 3: Downtown Neon Market (Cyberpunk dark obsidian with neon conduit)
      facade_dark = '#0d091a';
      cap_mid = '#1d1536';
      cap_light = '#2b204e';
      rim_color = '#00e5ff'; // Glowing cyan neon trim
      shadow_color = 'rgba(0, 0, 0, 0.6)';
    } else {
      // Level 4: The Grand Spaceport (Reinforced titanium hangar blast walls)
      facade_dark = '#10171e';
      cap_mid = '#1e2b37';
      cap_light = '#2e3f4e';
      rim_color = '#4fc3f7';
      shadow_color = 'rgba(0, 15, 25, 0.55)';
    }

    // 1. Solid Base Wall Body (Completely fills tile so there are ZERO holes or gaps)
    ctx.fillStyle = cap_mid;
    ctx.fillRect(x, y, TILE, TILE);

    // 2. Drop Shadow onto corridor below if southern edge faces an open pathway
    if (!btmW) {
      ctx.fillStyle = shadow_color;
      ctx.fillRect(x, y + TILE, TILE, 7);
    }

    // 3. Tall Front Vertical Facade (Gives 3D vertical height facing the camera)
    // The bottom 12px of wall tiles facing open corridors forms the tall shaded vertical drop
    const facade_h = btmW ? 0 : 12;
    if (facade_h > 0) {
      ctx.fillStyle = facade_dark;
      ctx.fillRect(x, y + TILE - facade_h, TILE, facade_h);

      // Deep crevice accent line separating vertical facade from horizontal top cap
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x, y + TILE - facade_h, TILE, 1.5);
    }

    // 4. Sunlit Top Surface of the Wall
    // Fills from y down to (y + TILE - facade_h)
    const top_h = TILE - facade_h;
    ctx.fillStyle = cap_light;
    ctx.fillRect(x, y, TILE, top_h);

    // Decorative texture & architectural detailing on top of walls
    if (lvl === 0) {
      // Leafy hedge texture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(x + 4, y + 4, TILE - 8, top_h - 8);
      // Small decorative hedge sprig
      ctx.fillStyle = 'rgba(129, 199, 132, 0.3)';
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
      ctx.arc(x + TILE - 10, y + top_h - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (lvl === 2) {
      // Cyberpunk glowing neon wire running across the wall top
      ctx.strokeStyle = rim_color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (lftW && rgtW) {
        ctx.moveTo(x, y + top_h / 2);
        ctx.lineTo(x + TILE, y + top_h / 2);
      } else if (topW && btmW) {
        ctx.moveTo(x + TILE / 2, y);
        ctx.lineTo(x + TILE / 2, y + top_h);
      } else {
        ctx.arc(x + TILE / 2, y + top_h / 2, 4, 0, Math.PI * 2);
      }
      ctx.stroke();
    } else if (lvl === 3) {
      // Spaceport hazard bevel corners
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, 2);
    }

    // 5. Exterior Outlines & Rim Lighting on edges that face open corridors
    ctx.lineWidth = 1.5;

    // North edge lit rim (sunlight coming from top-left)
    if (!topW) {
      ctx.fillStyle = rim_color;
      ctx.fillRect(x, y, TILE, 2);
    }

    // West edge side bevel
    if (!lftW) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x, y, 1.5, top_h);
      if (facade_h > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x, y + top_h, 1.5, facade_h);
      }
    }

    // East edge side shadow
    if (!rgtW) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(x + TILE - 1.5, y, 1.5, top_h);
      if (facade_h > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x + TILE - 1.5, y + top_h, 1.5, facade_h);
      }
    }

    // South edge bottom ground baseline
    if (!btmW) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y + TILE - 1, TILE, 1);
    }

    ctx.restore();
  }

  function draw_gate(ctx, x, y, is_open) {
    if (is_open) {
      ctx.fillStyle = 'rgba(0, 255, 213, 0.15)';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#00ffd5';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(255, 23, 68, 0.35)';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + TILE / 2);
      ctx.lineTo(x + TILE - 4, y + TILE / 2);
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', x + TILE / 2, y + TILE / 2 + 4);
    }
  }

  function draw_conveyor(ctx, x, y, dir) {
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dir > 0 ? '▶' : '◀', x + TILE / 2, y + TILE / 2 + 5);
  }

  function draw_plate(ctx, x, y, is_pressed) {
    ctx.fillStyle = is_pressed ? '#00e676' : '#ff9100';
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, is_pressed ? 14 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw_switch(ctx, x, y, lvl) {
    ctx.fillStyle = '#ffea00';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🕹️', x + TILE / 2, y + TILE / 2 + 7);
  }

  function draw_keycard(ctx, x, y) {
    const bob = Math.sin(state.time_left * 5) * 3;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🗝️', x, y + 7 + bob);
  }

  function draw_quest_item(ctx, x, y) {
    const tmpl = MAZE_TEMPLATES[state.level_index];
    const icon = tmpl.item_name.split(' ')[0];
    const bob = Math.sin(state.time_left * 5) * 4;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon, x, y + 8 + bob);
  }

  function draw_donut_prop(ctx, x, y) {
    ctx.fillStyle = '#ff4081';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#161329';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // SPRITE: Leo the Tourist Astronaut (High-Def Vector Cartoon)
  // ---------------------------------------------------------------------------
  function draw_player(ctx) {
    const walk_bob = Math.abs(Math.sin(state.walk_phase)) * 2.5;

    ctx.save();
    ctx.translate(state.player_x, state.player_y - walk_bob);

    if (state.invincible_t > 0 && Math.floor(state.time_left * 15) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Soft Ambient Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15 + walk_bob, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Moonwalk Golden Halo
    if (state.moonwalk_timer > 0) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -2, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Legs & Sneakers with Smooth Curves
    const flip = (state.moonwalk_timer > 0) ? -1 : 1;
    const leg_swing = Math.sin(state.walk_phase) * 3;

    // Pants (Space Khakis)
    ctx.fillStyle = '#f0f4f8';
    ctx.beginPath();
    ctx.roundRect(-7, 2 + leg_swing, 5, 10, 2);
    ctx.roundRect(2, 2 - leg_swing, 5, 10, 2);
    ctx.fill();

    // Vibrant Red Sneakers
    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    ctx.roundRect(-8 + (flip * 2), 10 + leg_swing, 7, 5, 2.5);
    ctx.roundRect(1 + (flip * 2), 10 - leg_swing, 7, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // White sneaker soles
    ctx.fillRect(-8 + (flip * 2), 13 + leg_swing, 7, 2);
    ctx.fillRect(1 + (flip * 2), 13 - leg_swing, 7, 2);

    // Torso: Hawaiian Floral Shirt with Gradient
    const shirt_grad = ctx.createLinearGradient(-9, -8, 9, 4);
    shirt_grad.addColorStop(0, '#ff7043');
    shirt_grad.addColorStop(1, '#ff3d00');
    ctx.fillStyle = shirt_grad;
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 13, 4);
    ctx.fill();

    // Tiny Floral Palm Patterns
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(-3, -4, 2, 0, Math.PI * 2);
    ctx.arc(4, -2, 2, 0, Math.PI * 2);
    ctx.arc(0, 1, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Astronaut Bubble Helmet
    const helm_grad = ctx.createRadialGradient(-3, -15, 2, 0, -13, 11);
    helm_grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    helm_grad.addColorStop(0.3, 'rgba(178, 235, 242, 0.65)');
    helm_grad.addColorStop(1, 'rgba(0, 188, 212, 0.45)');
    ctx.fillStyle = helm_grad;
    ctx.beginPath();
    ctx.arc(0, -13, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Friendly Face inside Helmet
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(0, -12, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Big expressive cartoon eyes with highlights
    ctx.fillStyle = '#1a1a24';
    ctx.beginPath();
    ctx.arc(-2.5, -13, 1.8, 0, Math.PI * 2);
    ctx.arc(2.5, -13, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2.9, -13.5, 0.7, 0, Math.PI * 2);
    ctx.arc(2.1, -13.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Friendly Smile
    ctx.strokeStyle = '#d87a56';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -11, 2.5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // SPRITE: Alien with Backwards-Bending Knees (Modern Cartoon Look)
  // ---------------------------------------------------------------------------
  function draw_alien(ctx, a) {
    const pal = ALIEN_PALETTES[a.palette_id];
    const walk_bob = Math.abs(Math.sin(a.phase)) * 3;

    ctx.save();
    ctx.translate(a.x, a.y - walk_bob);

    // Soft Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 15 + walk_bob, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // BACKWARD KNEES: When moving along (vx, vy), knees and feet point in reverse (-vx)!
    const foot_face_x = (a.vx > 0) ? -1 : (a.vx < 0 ? 1 : -1);
    const step1 = Math.sin(a.phase);
    const step2 = Math.sin(a.phase + Math.PI);

    // Hips -> Backward Knees -> Backward Feet (Smooth joint curves)
    ctx.strokeStyle = pal.pants;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(-5 + (foot_face_x * 6), 9 - (step1 * 3));
    ctx.lineTo(-5 + (foot_face_x * 11), 14 - Math.max(0, step1 * 5));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(5, 4);
    ctx.lineTo(5 + (foot_face_x * 6), 9 - (step2 * 3));
    ctx.lineTo(5 + (foot_face_x * 11), 14 - Math.max(0, step2 * 5));
    ctx.stroke();

    // Backward Rounded Sneakers
    ctx.fillStyle = pal.shoe;
    ctx.beginPath();
    ctx.roundRect(-5 + (foot_face_x * 11) - 4, 12, 8, 4.5, 2);
    ctx.roundRect(5 + (foot_face_x * 11) - 4, 12, 8, 4.5, 2);
    ctx.fill();

    // Chubby Torso with Smooth Shading
    ctx.fillStyle = pal.shirt;
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 14, 5);
    ctx.fill();

    // Arms with Cute Mittens
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-10.5, -2, 3, 0, Math.PI * 2);
    ctx.arc(10.5, -2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Cute Round Alien Head
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(0, -13, 11, 0, Math.PI * 2);
    ctx.fill();

    // Rosy Cheeks
    ctx.fillStyle = pal.blush;
    ctx.beginPath();
    ctx.arc(-6, -11, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -11, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Cute Antenna with Glowing Orb
    ctx.strokeStyle = pal.skin;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(foot_face_x * 2, -26, 0, -29);
    ctx.stroke();

    const antenna_color = (a.sugar_rush_t > 0) ? '#ffd600' : (a.alert ? '#ff1744' : pal.antenna);
    ctx.fillStyle = antenna_color;
    if (a.sugar_rush_t > 0 || a.alert) {
      ctx.shadowColor = antenna_color;
      ctx.shadowBlur = (a.sugar_rush_t > 0) ? 14 : 8;
    }
    ctx.beginPath();
    ctx.arc(0, -30, (a.sugar_rush_t > 0) ? 6 : (a.alert ? 5 : 3.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Badges above antenna
    if (a.sugar_rush_t > 0 && a.frozen_t <= 0) {
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.fillStyle = '#ffd600';
      ctx.textAlign = 'center';
      ctx.fillText('⚡️ 2x', 0, -40);
    } else if (a.is_eating) {
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.fillStyle = '#ff4081';
      ctx.textAlign = 'center';
      ctx.fillText('🍩 NOM!', 0, -40);
    } else if (a.alert && a.frozen_t <= 0) {
      ctx.font = 'bold 13px -apple-system, sans-serif';
      ctx.fillStyle = '#ff1744';
      ctx.textAlign = 'center';
      ctx.fillText('❗️', 0, -38);
    }

    // Big Anime / Cartoon Alien Eyes
    if (a.frozen_t > 0) {
      ctx.font = '12px sans-serif';
      ctx.fillText('🌀', -6, -11);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4, -14, 3.5, 0, Math.PI * 2);
      ctx.arc(4, -14, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#101426';
      ctx.beginPath();
      ctx.arc(-4, -14, 2, 0, Math.PI * 2);
      ctx.arc(4, -14, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4.6, -14.6, 0.8, 0, Math.PI * 2);
      ctx.arc(3.4, -14.6, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // HUD & UI SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  function update_hud() {
    const tmpl = MAZE_TEMPLATES[state.level_index];

    const score_el = document.getElementById('hud-score');
    if (score_el) score_el.textContent = state.score;

    const level_el = document.getElementById('hud-level');
    if (level_el) level_el.textContent = `Lvl ${tmpl.level}: ${tmpl.name}`;

    const timer_el = document.getElementById('hud-timer');
    if (timer_el) {
      const mins = Math.floor(state.time_left / 60);
      const secs = Math.floor(state.time_left % 60);
      timer_el.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      if (state.time_left <= 15) {
        timer_el.classList.add('timer-panic');
      } else {
        timer_el.classList.remove('timer-panic');
      }
    }

    const hearts_el = document.getElementById('hearts-container');
    if (hearts_el) {
      hearts_el.innerHTML = '';
      for (let i = 0; i < state.max_hearts; i++) {
        const heart = document.createElement('span');
        heart.className = `heart-icon ${i < state.hearts ? '' : 'lost'}`;
        heart.textContent = '❤️';
        hearts_el.appendChild(heart);
      }
    }
  }

  function set_dialogue(text) {
    const msg_el = document.getElementById('ai-message');
    if (msg_el) msg_el.textContent = text;
  }

  function show_overlay(type) {
    state.game_state = type;
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const subtitle = document.getElementById('modal-subtitle');
    const desc = document.getElementById('modal-desc');
    const btn = document.getElementById('modal-btn');
    const diff_row = document.getElementById('diff-selector');

    if (!overlay) return;
    overlay.classList.remove('hidden');

    if (type === 'TITLE') {
      if (diff_row) diff_row.style.display = 'flex';
      title.textContent = '🚀 PLANET OOPS-A-DAISY';
      subtitle.textContent = 'The Alien Maze Adventure';
      desc.textContent = 'Smooth controls, smart backward-alien patrols, and 4 unique puzzle mazes! Pick your difficulty mode below:';
      btn.textContent = 'START MAZE ADVENTURE';
    } else if (type === 'LEVEL_WIN') {
      if (diff_row) diff_row.style.display = 'none';
      const tmpl = MAZE_TEMPLATES[state.level_index];
      title.textContent = '🎉 MAZE SOLVED!';
      subtitle.textContent = `Retrieved: ${tmpl.item_name}`;
      desc.textContent = `Puzzle conquered with ${Math.floor(state.time_left)} seconds remaining! NAV-9000: "Component secured. Advancing to Maze ${state.level_index + 2}!"`;
      btn.textContent = `PLAY MAZE ${state.level_index + 2}`;
    } else if (type === 'TIME_UP') {
      if (diff_row) diff_row.style.display = 'flex';
      title.textContent = '💨 TIME\'S UP! EMERGENCY FART OVERLOAD!';
      subtitle.textContent = 'Leo\'s space suit life-support malfunctioned!';
      desc.textContent = 'NAV-9000: "WARNING! Tourist suit gas pressure critical! Leo is uncontrollably farting! Hit Try Again before the aliens smell it!"';
      btn.textContent = '💨 TRY AGAIN';
    } else if (type === 'GAME_OVER') {
      if (diff_row) diff_row.style.display = 'flex';
      title.textContent = '💥 TOO MANY BONKS!';
      subtitle.textContent = 'All hearts lost!';
      desc.textContent = 'NAV-9000: "Recalculating... Mind their backwards-bending knees! Let us try this maze again."';
      btn.textContent = 'TRY AGAIN';
    } else if (type === 'CAMPAIGN_WIN') {
      if (diff_row) diff_row.style.display = 'flex';
      title.textContent = '🏆 SHIP REPAIRED! BLAST OFF!';
      subtitle.textContent = 'You Escaped Planet Oops-a-Daisy!';
      desc.textContent = `All 4 mazes conquered on ${DIFFICULTY_SETTINGS[state.difficulty].name}! NAV-9000: "Hyper-drive engaged! Leaving Planet Oops-a-Daisy!"`;
      btn.textContent = 'PLAY AGAIN';
    }
  }

  function hide_overlay() {
    audio.stop_farting();
    state.is_farting = false;
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    state.game_state = 'PLAY';
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION & EVENT LISTENERS
  // ---------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize_canvas() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      screen_w = rect.width;
      screen_h = rect.height;

      canvas.width = Math.floor(screen_w * dpr);
      canvas.height = Math.floor(screen_h * dpr);

      const scale_x = screen_w / WORLD_W;
      const scale_y = screen_h / WORLD_H;
      view_scale = Math.min(scale_x, scale_y);
      view_offset_x = (screen_w - WORLD_W * view_scale) / 2;
      view_offset_y = (screen_h - WORLD_H * view_scale) / 2;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize_canvas);
    resize_canvas();

    // SEAMLESS KEYBOARD LISTENERS (Press & Hold for Continuous Movement)
    window.addEventListener('keydown', (e) => {
      audio.init();
      if (['ArrowUp', 'KeyW'].includes(e.code)) { input.up = true; e.preventDefault(); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { input.down = true; e.preventDefault(); }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { input.left = true; e.preventDefault(); }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { input.right = true; e.preventDefault(); }
      else if (['Digit1', 'Space'].includes(e.code)) { use_gadget(1); e.preventDefault(); }
      else if (['Digit2', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { use_gadget(2); e.preventDefault(); }
      else if (['Digit3', 'KeyE'].includes(e.code)) { use_gadget(3); e.preventDefault(); }
      else if (['KeyG', 'Backquote', 'Escape'].includes(e.code)) { toggle_editor(); e.preventDefault(); }
      else if (['KeyL'].includes(e.code)) { load_level((state.level_index + 1) % MAZE_TEMPLATES.length); e.preventDefault(); }
      else if (['Digit7'].includes(e.code)) { load_level(0); e.preventDefault(); }
      else if (['Digit8'].includes(e.code)) { load_level(1); e.preventDefault(); }
      else if (['Digit9'].includes(e.code)) { load_level(2); e.preventDefault(); }
      else if (['Digit0'].includes(e.code)) { load_level(3); e.preventDefault(); }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) { input.up = false; }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { input.down = false; }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { input.left = false; }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { input.right = false; }
    });

    // Canvas Mouse Inspection (Editor Hover Coordinates)
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const worldX = (clientX - view_offset_x) / view_scale;
      const worldY = (clientY - view_offset_y) / view_scale;
      hover_c = Math.floor(worldX / TILE);
      hover_r = Math.floor(worldY / TILE);
      if (hover_c < 0 || hover_c >= COLS || hover_r < 0 || hover_r >= ROWS) {
        hover_c = -1;
        hover_r = -1;
      }
    });

    canvas.addEventListener('mouseleave', () => {
      hover_c = -1;
      hover_r = -1;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!state.editor_mode || hover_c < 0 || hover_r < 0) return;
      state.is_painting = true;
      apply_editor_brush(hover_c, hover_r);
    });

    window.addEventListener('mouseup', () => {
      state.is_painting = false;
    });

    canvas.addEventListener('mouseleave', () => {
      hover_c = -1;
      hover_r = -1;
      state.is_painting = false;
    });

    // Touch D-Pad Listeners (iPad / Mobile)
    const btn_up = document.getElementById('t-up');
    const btn_down = document.getElementById('t-down');
    const btn_left = document.getElementById('t-left');
    const btn_right = document.getElementById('t-right');
    const btn_honk = document.getElementById('t-honk');
    const btn_moon = document.getElementById('t-moonwalk');
    const btn_donut = document.getElementById('t-donut');

    const bind_touch = (btn, key) => {
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { audio.init(); input[key] = true; e.preventDefault(); });
      btn.addEventListener('touchend', (e) => { input[key] = false; e.preventDefault(); });
      btn.addEventListener('mousedown', () => { audio.init(); input[key] = true; });
      btn.addEventListener('mouseup', () => { input[key] = false; });
      btn.addEventListener('mouseleave', () => { input[key] = false; });
    };
    bind_touch(btn_up, 'up');
    bind_touch(btn_down, 'down');
    bind_touch(btn_left, 'left');
    bind_touch(btn_right, 'right');

    if (btn_honk) btn_honk.addEventListener('touchstart', (e) => { use_gadget(1); e.preventDefault(); });
    if (btn_moon) btn_moon.addEventListener('touchstart', (e) => { use_gadget(2); e.preventDefault(); });
    if (btn_donut) btn_donut.addEventListener('touchstart', (e) => { use_gadget(3); e.preventDefault(); });

    if (btn_honk) btn_honk.addEventListener('mousedown', () => use_gadget(1));
    if (btn_moon) btn_moon.addEventListener('mousedown', () => use_gadget(2));
    if (btn_donut) btn_donut.addEventListener('mousedown', () => use_gadget(3));

    // ---------------------------------------------------------------------------
    // INTERACTIVE LEVEL DESIGNER & EDITOR CONTROLS
    // ---------------------------------------------------------------------------
    function toggle_editor() {
      state.editor_mode = !state.editor_mode;
      state.show_grid = state.editor_mode;
      const editor_panel = document.getElementById('editor-panel');
      const editor_toggle = document.getElementById('editor-toggle') || document.getElementById('grid-toggle');

      if (state.editor_mode) {
        state.game_state = 'EDIT';
        if (editor_panel) editor_panel.classList.remove('hidden');
        if (editor_toggle) editor_toggle.classList.add('active');
        spawn_floating_text(WORLD_W / 2, 50, "🛠️ LEVEL DESIGNER ACTIVE", "#ffd54f");
      } else {
        state.game_state = 'PLAY';
        if (editor_panel) editor_panel.classList.add('hidden');
        if (editor_toggle) editor_toggle.classList.remove('active');
        const alien_panel = document.getElementById('alien-controls-panel');
        if (alien_panel) alien_panel.style.display = 'none';
        select_alien(-1);
      }
    }

    function set_editor_tool(tool) {
      state.editor_tool = tool;
      document.querySelectorAll('.editor-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });
      if (tool !== 'select') {
        select_alien(-1);
      }
    }

    function apply_editor_brush(c, r) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
      const tmpl = MAZE_TEMPLATES[state.level_index];

      // Perimeter border protection: cannot hollow out the exterior borders
      const is_border = (c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1);
      if (is_border && state.editor_tool !== 'wall') return;

      if (state.editor_tool === 'wall') {
        state.grid[r][c] = 'W';
      } else if (state.editor_tool === 'floor') {
        state.grid[r][c] = '.';
      } else if (state.editor_tool === 'key') {
        for (let cr = 0; cr < ROWS; cr++) {
          for (let cc = 0; cc < COLS; cc++) {
            if (state.grid[cr][cc] === 'K') state.grid[cr][cc] = '.';
          }
        }
        state.grid[r][c] = 'K';
        state.key_spawn = { c, r };
        audio.play_pickup();
        spawn_floating_text(c * TILE + TILE / 2, r * TILE, "🗝️ KEY PLACED!", "#ffd600");
      } else if (state.editor_tool === 'gate') {
        for (let cr = 0; cr < ROWS; cr++) {
          for (let cc = 0; cc < COLS; cc++) {
            if (state.grid[cr][cc] === 'G') state.grid[cr][cc] = '.';
          }
        }
        state.grid[r][c] = 'G';
        audio.play_switch();
        spawn_floating_text(c * TILE + TILE / 2, r * TILE, "🚪 GATE PLACED!", "#ff5722");
      } else if (state.editor_tool === 'item') {
        for (let cr = 0; cr < ROWS; cr++) {
          for (let cc = 0; cc < COLS; cc++) {
            if (state.grid[cr][cc] === 'I') state.grid[cr][cc] = '.';
          }
        }
        state.grid[r][c] = 'I';
        audio.play_win();
        spawn_floating_text(c * TILE + TILE / 2, r * TILE, "⭐ GOAL ITEM PLACED!", "#00e676");
      } else if (state.editor_tool === 'start') {
        tmpl.start = { c, r };
        state.player_x = c * TILE + TILE / 2;
        state.player_y = r * TILE + TILE / 2;
        state.grid[r][c] = '.';
        audio.play_hop();
        spawn_floating_text(state.player_x, state.player_y - 20, "🚀 START POINT SET!", "#00ffd5");
      } else if (state.editor_tool === 'alien') {
        const diff = DIFFICULTY_SETTINGS[state.difficulty];
        const new_alien = {
          x: c * TILE + TILE / 2,
          y: r * TILE + TILE / 2,
          home_c: c,
          home_r: r,
          home_dir: 1,
          dir: 1,
          vx: 1,
          vy: 0,
          axis: 'x',
          min: Math.max(1, c - 2),
          max: Math.min(COLS - 2, c + 2),
          base_spd: 60 * diff.alien_speed_mult,
          spd: 60 * diff.alien_speed_mult,
          phase: state.aliens.length * 1.5,
          frozen_t: 0,
          alert: false,
          chasing: false,
          lost_sight_t: 0,
          sugar_rush_t: 0,
          is_eating: false,
          eat_t: 0,
          palette_id: state.aliens.length % 5
        };
        state.aliens.push(new_alien);
        audio.play_alert();
        spawn_floating_text(new_alien.x, new_alien.y - 24, `👽 ALIEN #${state.aliens.length} ADDED!`, "#ff4081");
        select_alien(state.aliens.length - 1);
      } else if (state.editor_tool === 'select') {
        const clicked_idx = state.aliens.findIndex(a => {
          const ac = Math.floor(a.x / TILE);
          const ar = Math.floor(a.y / TILE);
          return ac === c && ar === r;
        });
        select_alien(clicked_idx);
      }
    }

    function select_alien(idx) {
      state.selected_alien_idx = idx;
      const alien_panel = document.getElementById('alien-controls-panel');
      if (!alien_panel) return;

      if (idx < 0 || idx >= state.aliens.length) {
        alien_panel.style.display = 'none';
        return;
      }

      const a = state.aliens[idx];
      alien_panel.style.display = 'flex';
      document.getElementById('selected-alien-label').textContent = `👽 ALIEN #${idx + 1}:`;
      document.getElementById('btn-axis-toggle').textContent = `Axis: ${a.axis === 'x' ? '↔️ X' : '↕️ Y'}`;
      document.getElementById('val-min').textContent = a.min;
      document.getElementById('val-max').textContent = a.max;
      document.getElementById('btn-speed-toggle').textContent = `Speed: ${Math.round(a.spd)}`;
    }

    function get_current_level_data() {
      const tmpl = MAZE_TEMPLATES[state.level_index];
      const grid_strings = state.grid.map(row => row.join(''));
      const aliens_data = state.aliens.map(a => ({
        c: a.home_c !== undefined ? a.home_c : Math.floor(a.x / TILE),
        r: a.home_r !== undefined ? a.home_r : Math.floor(a.y / TILE),
        dir: a.home_dir || 1,
        axis: a.axis,
        min: a.min,
        max: a.max,
        spd: Math.round(a.spd / (DIFFICULTY_SETTINGS[state.difficulty].alien_speed_mult || 1))
      }));

      return {
        level: state.level_index + 1,
        name: tmpl.name,
        item_name: tmpl.item_name,
        puzzle_info: tmpl.puzzle_info,
        nav_quote: tmpl.nav_quote,
        start: { ...tmpl.start },
        grid: grid_strings,
        aliens: aliens_data,
        plate: tmpl.plate ? { ...tmpl.plate } : undefined,
        gate: tmpl.gate ? { ...tmpl.gate } : undefined,
        conveyor_dir: tmpl.conveyor_dir
      };
    }

    function save_current_level() {
      const data = get_current_level_data();
      localStorage.setItem('custom_level_' + state.level_index, JSON.stringify(data));
      audio.play_win();
      spawn_floating_text(WORLD_W / 2, 60, "💾 LEVEL SAVED TO BROWSER!", "#38ef7d");
    }

    function test_play_level() {
      save_current_level();
      toggle_editor();
      load_level(state.level_index);
      spawn_floating_text(WORLD_W / 2, 60, "▶️ PLAYTEST ACTIVE (ESC FOR EDITOR)", "#00ffd5");
    }

    function export_level_json() {
      const data = get_current_level_data();
      const formatted = JSON.stringify(data, null, 2);
      const modal = document.getElementById('json-modal');
      const textarea = document.getElementById('json-textarea');
      if (modal && textarea) {
        textarea.value = formatted;
        modal.classList.remove('hidden');
      }
    }

    function reset_level_to_default() {
      localStorage.removeItem('custom_level_' + state.level_index);
      load_level(state.level_index);
      select_alien(-1);
      audio.play_switch();
      spawn_floating_text(WORLD_W / 2, 60, "🔄 RESTORED ORIGINAL LEVEL", "#ffd54f");
    }

    // Bind Editor UI Buttons
    const editor_toggle = document.getElementById('editor-toggle') || document.getElementById('grid-toggle');
    if (editor_toggle) editor_toggle.addEventListener('click', toggle_editor);

    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => set_editor_tool(btn.dataset.tool));
    });

    const btn_test = document.getElementById('btn-test-play');
    if (btn_test) btn_test.addEventListener('click', test_play_level);

    const btn_save = document.getElementById('btn-save-level');
    if (btn_save) btn_save.addEventListener('click', save_current_level);

    const btn_export = document.getElementById('btn-export-json');
    if (btn_export) btn_export.addEventListener('click', export_level_json);

    const btn_reset = document.getElementById('btn-reset-level');
    if (btn_reset) btn_reset.addEventListener('click', reset_level_to_default);

    const btn_exit = document.getElementById('btn-exit-editor');
    if (btn_exit) btn_exit.addEventListener('click', toggle_editor);

    // Alien Inspector actions
    const btn_axis = document.getElementById('btn-axis-toggle');
    if (btn_axis) {
      btn_axis.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        a.axis = (a.axis === 'x') ? 'y' : 'x';
        a.min = (a.axis === 'x') ? Math.max(1, a.home_c - 2) : Math.max(1, a.home_r - 2);
        a.max = (a.axis === 'x') ? Math.min(COLS - 2, a.home_c + 2) : Math.min(ROWS - 2, a.home_r + 2);
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_min_dec = document.getElementById('btn-min-dec');
    if (btn_min_dec) {
      btn_min_dec.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        a.min = Math.max(1, Math.round((a.min - 1) * 10) / 10);
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_min_inc = document.getElementById('btn-min-inc');
    if (btn_min_inc) {
      btn_min_inc.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        if (a.min < a.max - 1) a.min = Math.round((a.min + 1) * 10) / 10;
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_max_dec = document.getElementById('btn-max-dec');
    if (btn_max_dec) {
      btn_max_dec.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        if (a.max > a.min + 1) a.max = Math.round((a.max - 1) * 10) / 10;
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_max_inc = document.getElementById('btn-max-inc');
    if (btn_max_inc) {
      btn_max_inc.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        const limit = a.axis === 'x' ? COLS - 2 : ROWS - 2;
        a.max = Math.min(limit, Math.round((a.max + 1) * 10) / 10);
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_spd = document.getElementById('btn-speed-toggle');
    if (btn_spd) {
      btn_spd.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        const a = state.aliens[state.selected_alien_idx];
        const spds = [50, 65, 80, 100, 120];
        const currentSpd = Math.round(a.spd);
        const nextIdx = (spds.findIndex(s => s >= currentSpd) + 1) % spds.length;
        a.spd = spds[nextIdx];
        a.base_spd = a.spd;
        select_alien(state.selected_alien_idx);
      });
    }

    const btn_del = document.getElementById('btn-del-alien');
    if (btn_del) {
      btn_del.addEventListener('click', () => {
        if (state.selected_alien_idx < 0) return;
        state.aliens.splice(state.selected_alien_idx, 1);
        select_alien(-1);
        audio.play_bonk();
      });
    }

    // JSON Modal controls
    const btn_close_json = document.getElementById('btn-close-json');
    if (btn_close_json) {
      btn_close_json.addEventListener('click', () => {
        const modal = document.getElementById('json-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const btn_copy_json = document.getElementById('btn-copy-json');
    if (btn_copy_json) {
      btn_copy_json.addEventListener('click', () => {
        const textarea = document.getElementById('json-textarea');
        if (textarea) {
          navigator.clipboard.writeText(textarea.value);
          spawn_floating_text(WORLD_W / 2, 80, "📋 COPIED TO CLIPBOARD!", "#38ef7d");
        }
      });
    }

    const btn_apply_json = document.getElementById('btn-apply-json');
    if (btn_apply_json) {
      btn_apply_json.addEventListener('click', () => {
        const textarea = document.getElementById('json-textarea');
        if (textarea) {
          try {
            const parsed = JSON.parse(textarea.value);
            localStorage.setItem('custom_level_' + state.level_index, JSON.stringify(parsed));
            load_level(state.level_index);
            const modal = document.getElementById('json-modal');
            if (modal) modal.classList.add('hidden');
            audio.play_win();
            spawn_floating_text(WORLD_W / 2, 80, "📥 JSON LEVEL APPLIED!", "#00ffd5");
          } catch (err) {
            alert("Invalid JSON format: " + err.message);
          }
        }
      });
    }

    // Audio & SFX Toggles
    const music_toggle = document.getElementById('music-toggle');
    if (music_toggle) {
      music_toggle.addEventListener('click', () => {
        audio.init();
        const on = audio.toggle_music();
        music_toggle.textContent = on ? '🎵 MUSIC' : '🔇 MUSIC';
      });
    }

    const sfx_toggle = document.getElementById('sfx-toggle');
    if (sfx_toggle) {
      sfx_toggle.addEventListener('click', () => {
        audio.init();
        const on = audio.toggle_sfx();
        sfx_toggle.textContent = on ? '🔊 SFX' : '🔇 SFX';
      });
    }

    // Difficulty Mode Buttons
    const diff_btns = document.querySelectorAll('.diff-btn');
    diff_btns.forEach(btn => {
      btn.addEventListener('click', () => {
        diff_btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.difficulty = btn.dataset.diff;
      });
    });

    // Audio Unlock
    const unlock_audio = () => {
      audio.init();
      audio.init_bgm();
    };
    window.addEventListener('pointerdown', unlock_audio);
    window.addEventListener('keydown', unlock_audio);

    // Modal Play Button
    const modal_btn = document.getElementById('modal-btn');
    if (modal_btn) {
      modal_btn.addEventListener('click', () => {
        unlock_audio();
        if (state.game_state === 'LEVEL_WIN') {
          load_level(state.level_index + 1);
        } else if (state.game_state === 'CAMPAIGN_WIN') {
          load_level(0);
        } else {
          load_level(state.level_index);
        }
        hide_overlay();
      });
    }

    // Fixed-Step 60 FPS Game Loop
    let accum = 0;
    let last_time = performance.now();

    function game_loop(current_time) {
      let delta = (current_time - last_time) / 1000;
      if (delta > 0.2) delta = 0.2;
      last_time = current_time;

      accum += delta;
      while (accum >= DT) {
        sim_update(DT);
        accum -= DT;
      }

      render(ctx);
      requestAnimationFrame(game_loop);
    }

    show_overlay('TITLE');
    load_level(0);
    requestAnimationFrame(game_loop);
  });

  // Test hook: lets headless tests drive the REAL game logic (no-op in the browser).
  if (typeof window !== "undefined" && window.__OOPS_TEST__) {
    window.__OOPS_TEST__ = { state, input, MAZE_TEMPLATES, TILE, load_level, sim_update, use_gadget, find_donut_landing, bfs_dist };
  }
})();
