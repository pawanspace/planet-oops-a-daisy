// All tunable gameplay numbers live here. Speeds are px/s, distances px, times seconds.

export const TILE = 48;
export const DT = 1 / 60;

export const CONFIG = {
  player: {
    radius: 14,
    walkSpeed: 150,
    runSpeed: 240,
    moonwalkSpeed: 75,
    footstepEvery: 0.28,      // seconds between running footstep noises
    runNoiseRadius: 3 * TILE,
    squeakNoiseRadius: 3 * TILE,
    invulnAfterHug: 1.5,
    hugTime: 1.2,             // stuck in a hug before you wriggle free
    cornerAssist: 0.45,       // fraction of a tile within which we nudge the player into side openings
    conveyorSpeed: 200,       // faster than walking, slower than running
    hackTime: 2.0,            // stand on a terminal this long
  },
  alien: {
    investigateSpeed: 100,
    chaseAccel: 600,
    skidDecel: 900,
    skidMinSpeed: 90,         // below this a chaser turns without skidding
    untangleTime: 0.45,       // legs untangling after a skid
    waypointPause: 0.35,
    chaseSightRange: 8 * TILE, // while chasing they track you in any direction
    suspicionFillTime: 0.7,    // seconds to fill at mid range
    suspicionDrain: 0.6,       // per second
    chaseHunch: 0.35,          // after losing sight, keep tracking you this long if you're still close by
    chaseHunchRadius: 3 * TILE,
    chaseGiveUp: 3.0,          // max seconds chasing without sight
    chaseMaxTime: 8.0,         // even with sight, they get tired and give up
    searchLookTime: 2.0,
    investigateLookTime: 1.5,
    stareTurnRate: 3.0,        // rad/s while suspicious
    huggerWakeTime: 0.6,
    huggerSmellRadius: 1.5 * TILE,
    huggerSleepAfter: 3.0,
    lookoutTurnEvery: 3.0,
    droneAlarmRadius: 8 * TILE,
    droneCooldown: 3.0,
  },
  alarm: { visionMult: 1.25, speedMult: 1.25 },
  honk: { stunRadius: 2 * TILE, stunTime: 1.5, hearRadius: 7 * TILE, cooldown: 8 },
  moonwalk: { duration: 4, cooldown: 10 },
  donut: { range: 3, smellRadius: 8, cooldown: 10 }, // range & smell in tiles (walking)
};

export type AlienKind = 'stroller' | 'lookout' | 'hugger' | 'kid' | 'heavy' | 'scooter' | 'drone';

export interface KindSpec {
  speed: number;        // patrol
  chase: number;        // top chase speed (0 = never chases)
  radius: number;
  vision: number;       // tiles (0 = blind)
  half: number;         // cone half-angle, degrees
  backwards: boolean;   // eyes look behind their walking direction
  hears: boolean;       // investigates noises
  fooled: boolean;      // moonwalk disguise works on it
  harmless: boolean;    // touching it doesn't hug
  honkProof: boolean;   // too big (or too robotic) to be startled by a honk
  eatTime: number;
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
export const ALIEN_KINDS = Object.keys(KINDS) as AlienKind[];

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY: Record<Difficulty, {
  label: string; hearts: number; alienSpeed: number; suspicionFill: number; cooldown: number;
}> = {
  easy:   { label: 'Easy',   hearts: 5, alienSpeed: 0.85, suspicionFill: 1.4, cooldown: 0.75 },
  normal: { label: 'Normal', hearts: 3, alienSpeed: 1.0,  suspicionFill: 1.0, cooldown: 1.0 },
  hard:   { label: 'Hard',   hearts: 2, alienSpeed: 1.15, suspicionFill: 0.8, cooldown: 1.25 },
};
