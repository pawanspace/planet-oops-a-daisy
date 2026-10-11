// =============================================================================
// 📘 LESSON: The game's "control panel"
// =============================================================================
// Every number that changes how the game FEELS lives in this one file: how fast Leo walks, how far aliens can
// see, how long a honk lasts... Game designers call these "tuning values" or "magic numbers".
//
// Why put them all in one place?
//   • You can make the game easier or harder without hunting through 2,000 lines of code.
//   • Every other file says CONFIG.player.walkSpeed instead of writing 150 again and again, so changing it here
//     changes it everywhere at once.
//
// UNITS used everywhere in this game (worth learning by heart!):
//   • distance → pixels ("px"). One map square ("tile") is 48 px wide.
//   • time     → seconds.
//   • speed    → pixels per second ("px/s").
//
// 💡 EXAMPLE: walkSpeed is 150 px/s. A tile is 48 px. So walking one tile takes 48 / 150 = 0.32 seconds,
//    and crossing a 10-tile hallway takes 3.2 seconds.
//
// 🧪 TRY IT: change walkSpeed below to 300, save, and play a level. Leo zooms! (Then change it back.)
// 🧠 QUIZ Q1: Leo RUNS at 240 px/s. How many tiles can he run in one second? (Answers are in ANSWERS.md.)
// =============================================================================

/** Size of one map square, in pixels. Everything on the map lines up to this grid. */
export const TILE = 48;

/**
 * The length of one "tick" of the simulation: 1/60 of a second.
 * The game updates the world 60 times every second, always in steps of exactly this size.
 * (Chapter 0 of the Academy explains why a FIXED step matters: the same inputs always give the same result.)
 */
export const DT = 1 / 60;

export const CONFIG = {
  // ---------------------------------------------------------------------------
  // Leo, our tourist
  // ---------------------------------------------------------------------------
  player: {
    radius: 14,               // Leo's "body box" is 14 px in every direction from his centre (28 px wide in total)
    walkSpeed: 150,           // px per second. Quiet!
    runSpeed: 240,            // px per second. Fast, but every footstep makes noise
    moonwalkSpeed: 75,        // half of walking: sliding backwards is slow
    footstepEvery: 0.28,      // seconds between running footstep noises (about 3.5 noisy steps per second)
    runNoiseRadius: 3 * TILE, // aliens within 3 tiles (144 px) hear running footsteps, even through walls
    squeakNoiseRadius: 3 * TILE, // same for squeaky floor tiles
    invulnAfterHug: 1.5,      // after a hug, nobody can hug you again for 1.5 s (so you can escape)
    hugTime: 1.2,             // stuck in a hug before you wriggle free
    cornerAssist: 0.45,       // if you're within 45% of a tile from a side opening, we gently slide you into it
    conveyorSpeed: 200,       // faster than walking (150), slower than running (240)
    hackTime: 2.0,            // stand on a terminal this long to hack it
  },

  // ---------------------------------------------------------------------------
  // Alien behaviour (numbers shared by every kind of alien)
  // ---------------------------------------------------------------------------
  alien: {
    investigateSpeed: 100,    // how fast they walk over to check out a noise
    chaseAccel: 600,          // chasers speed up by 600 px/s every second (0 → 225 px/s takes about 0.4 s)
    skidDecel: 900,           // and slow down by 900 px/s every second when they skid at a corner
    skidMinSpeed: 90,         // below this speed a chaser can turn without skidding
    untangleTime: 0.45,       // after a skid, their backwards legs need 0.45 s to untangle
    waypointPause: 0.35,      // patrollers pause this long at each end of their route
    chaseSightRange: 8 * TILE, // while chasing they keep track of you in ANY direction up to 8 tiles
    suspicionFillTime: 0.7,    // seconds for the "?" meter to fill when you're at middle distance
    suspicionDrain: 0.6,       // how much of the meter drains per second once they lose sight of you
    chaseHunch: 0.35,          // after losing sight, they keep following you for 0.35 s if you're still close
    chaseHunchRadius: 3 * TILE,
    chaseGiveUp: 3.0,          // max seconds chasing without seeing you
    chaseMaxTime: 8.0,         // even WITH sight, they get tired after 8 s ("Huff... puff...")
    searchLookTime: 2.0,       // how long they look around after losing you
    investigateLookTime: 1.5,  // how long they look around at a noise
    stareTurnRate: 3.0,        // radians per second they turn their eyes towards you while suspicious
    huggerWakeTime: 0.6,       // Blorp's yawn: time between waking up and starting a chase
    huggerSmellRadius: 1.5 * TILE, // walk this close to a sleeping hugger and it wakes up
    huggerSleepAfter: 3.0,     // back home, a hugger falls asleep again after 3 s
    lookoutTurnEvery: 3.0,     // default seconds between a lookout's turns
    droneAlarmRadius: 8 * TILE, // when a drone BEEPS, every alien within 8 tiles comes to look
    droneCooldown: 3.0,        // seconds before the same drone can beep again
  },

  // The alarm in the last level of a zone: everyone sees 25% further and patrols 25% faster.
  alarm: { visionMult: 1.25, speedMult: 1.25 },

  // 🎺 Honk: stuns aliens within 2 tiles for 1.5 s, but every alien within 7 tiles HEARS it. Recharges in 8 s.
  honk: { stunRadius: 2 * TILE, stunTime: 1.5, hearRadius: 7 * TILE, cooldown: 8 },
  // 👟 Moonwalk: a 4-second disguise, recharges in 10 s.
  moonwalk: { duration: 4, cooldown: 10 },
  // 🍩 Donut: flies up to 3 tiles; aliens up to 8 WALKING steps away can smell it. Recharges in 10 s.
  donut: { range: 3, smellRadius: 8, cooldown: 10 },
};
// 🧠 QUIZ Q2: The honk's stunRadius is 2 * TILE. How many pixels is that?
// 🧠 QUIZ Q3: Why is conveyorSpeed (200) chosen to be between walkSpeed (150) and runSpeed (240)?

// =============================================================================
// 📘 LESSON: Different kinds of aliens, one set of rules
// =============================================================================
// Instead of writing separate code for each alien, every alien uses the SAME brain (in world.ts). What makes a
// Kid different from a Heavy is just this table of numbers and yes/no switches. This is called being
// "data-driven": change the data, not the code.
//
// 💡 EXAMPLE: a Kid has vision 3 (sees 3 tiles) but half 60 (a WIDE cone, 120° in total).
//    A Stroller has vision 5 (sees further) but half 40 (a narrower 80° cone).
//
// 🧪 TRY IT: give the 'kid' speed 200 and play 2-3 Recess. Chaos!
// =============================================================================

export type AlienKind = 'stroller' | 'lookout' | 'hugger' | 'kid' | 'heavy' | 'scooter' | 'drone';

export interface KindSpec {
  speed: number;        // walking speed on patrol, px/s
  chase: number;        // top chase speed, px/s (0 = this kind never chases)
  radius: number;       // body size in px (bigger = easier to bump into)
  vision: number;       // how far it sees, in tiles (0 = blind)
  half: number;         // half the width of its vision cone, in degrees (40 → an 80° cone)
  backwards: boolean;   // eyes look BEHIND their walking direction (the big joke!)
  hears: boolean;       // walks over to investigate noises
  fooled: boolean;      // the moonwalk disguise works on it
  harmless: boolean;    // touching it doesn't cause a hug
  honkProof: boolean;   // too big (or too robotic) to be startled by a honk
  eatTime: number;      // seconds spent munching a donut (0 = doesn't eat)
}

export const KINDS: Record<AlienKind, KindSpec> = {
  stroller: { speed: 70,  chase: 225, radius: 16, vision: 5,   half: 40, backwards: true,  hears: true,  fooled: true,  harmless: false, honkProof: false, eatTime: 3 },
  lookout:  { speed: 70,  chase: 225, radius: 16, vision: 5,   half: 40, backwards: true,  hears: true,  fooled: true,  harmless: false, honkProof: false, eatTime: 3 },
  hugger:   { speed: 70,  chase: 250, radius: 20, vision: 5,   half: 40, backwards: true,  hears: true,  fooled: true,  harmless: false, honkProof: false, eatTime: 3 },
  kid:      { speed: 105, chase: 235, radius: 12, vision: 3,   half: 60, backwards: true,  hears: true,  fooled: true,  harmless: false, honkProof: false, eatTime: 2 },
  heavy:    { speed: 45,  chase: 140, radius: 22, vision: 4,   half: 35, backwards: true,  hears: false,  fooled: true,  harmless: false, honkProof: true, eatTime: 6 },
  scooter:  { speed: 230, chase: 0,   radius: 15, vision: 0,   half: 0,  backwards: true,  hears: false, fooled: true,  harmless: false, honkProof: false, eatTime: 0 },
  drone:    { speed: 90,  chase: 0,   radius: 14, vision: 3.5, half: 28, backwards: false, hears: false, fooled: false, harmless: true, honkProof: true,  eatTime: 0 },
};
// 🧠 QUIZ Q4: Which alien kind can't see at all? Which one can't hear?
// 🧠 QUIZ Q5: Can a Heavy (chase 140) catch Leo when he's walking (150)? What about when he stops?

/** The list of kind names: ['stroller', 'lookout', ...]. Handy for checking a level file uses a real kind. */
export const ALIEN_KINDS = Object.keys(KINDS) as AlienKind[];

// =============================================================================
// Difficulty: multipliers applied on top of everything above.
// 💡 EXAMPLE: on Hard, alienSpeed is 1.15, so a Stroller patrols at 70 × 1.15 = 80.5 px/s.
//             suspicionFill 0.8 means the "?" meter fills in 0.8 × 0.7 = 0.56 s instead of 0.7 s.
// =============================================================================
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY: Record<Difficulty, {
  label: string; hearts: number; alienSpeed: number; suspicionFill: number; cooldown: number;
}> = {
  easy:   { label: 'Easy',   hearts: 5, alienSpeed: 0.85, suspicionFill: 1.4, cooldown: 0.75 },
  normal: { label: 'Normal', hearts: 3, alienSpeed: 1.0,  suspicionFill: 1.0, cooldown: 1.0 },
  hard:   { label: 'Hard',   hearts: 2, alienSpeed: 1.15, suspicionFill: 0.8, cooldown: 1.25 },
};
// 🧠 QUIZ Q6: On Easy, the honk cooldown is 8 × 0.75. How many seconds is that?
