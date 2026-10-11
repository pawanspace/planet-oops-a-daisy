// =============================================================================
// 📘 LESSON: Turning key presses and finger touches into an `Input`
// =============================================================================
// The browser tells us about the keyboard with EVENTS: "keydown: ArrowRight", later "keyup: ArrowRight".
// We remember which keys are currently HELD in a Set. Every world step, read() turns that into an Input:
//   holding → and ↑   gives   { x: 1, y: -1 }        (the world then normalises the diagonal)
//
// Gadgets are different: pressing 1 once should honk ONCE, not 60 times a second while the key is down.
// So gadget presses go into a "queue" and are used up by the very next step ("edge-triggered" input).
//
// Touch screens: the thumb stick is a circle. Where your finger is, relative to its centre, becomes x and y.
// 💡 EXAMPLE: the stick is 170 px wide (radius 85). A finger 42 px right of centre → x = 42 / 85 ≈ 0.5: half speed.
// 🧠 QUIZ Q22: Why is there a "dead zone" (0.18) in the middle of the stick?
// =============================================================================
import { NO_INPUT, type Input } from '../sim/world';

type Gadget = 'honk' | 'moonwalk' | 'donut';

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right' | 'run' | Gadget> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Digit1: 'honk', Space: 'honk', Digit2: 'moonwalk', KeyQ: 'moonwalk', Digit3: 'donut', KeyE: 'donut',
};

export class Controls {
  private held = new Set<string>();
  private queued = new Set<Gadget>();
  private stick = { x: 0, y: 0, active: false };
  private touchRun = false;
  onAnyInput: () => void = () => {};

  constructor() {
    window.addEventListener('keydown', e => {
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      this.onAnyInput();
      if (k === 'honk' || k === 'moonwalk' || k === 'donut') { if (!e.repeat) this.queued.add(k); }
      else this.held.add(k);
    });
    window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) this.held.delete(k); });
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Left-thumb virtual stick: the element is the pad, the knob is moved inside it. */
  bindStick(pad: HTMLElement, knob: HTMLElement): void {
    let id = -1;
    const move = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx *= max / len; dy *= max / len; }
      const dead = 0.18;
      const nx = dx / max, ny = dy / max;
      const mag = Math.hypot(nx, ny);
      this.stick = mag < dead ? { x: 0, y: 0, active: true } : { x: nx, y: ny, active: true };
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    pad.addEventListener('pointerdown', e => {
      id = e.pointerId; pad.setPointerCapture(id); this.onAnyInput(); move(e); e.preventDefault();
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      this.stick = { x: 0, y: 0, active: false };
      knob.style.transform = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  bindButton(el: HTMLElement, what: Gadget | 'run'): void {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.onAnyInput();
      if (what === 'run') this.touchRun = true; else this.queued.add(what);
      el.classList.add('pressed');
    });
    const up = () => { if (what === 'run') this.touchRun = false; el.classList.remove('pressed'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  /** Input for one sim step. Pass consumeGadgets=false for extra steps within the same frame. */
  /**
   * Build the Input for one world step. `consumeGadgets` is true only for the first step of a frame, so a
   * single button press can never fire twice (some frames run two steps — see the game loop in GameScene).
   */
  read(consumeGadgets: boolean): Input {
    const h = this.held;
    let x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
    let y = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0);
    if (this.stick.active && (this.stick.x !== 0 || this.stick.y !== 0)) { x = this.stick.x; y = this.stick.y; }
    const input: Input = { ...NO_INPUT, x, y, run: h.has('run') || this.touchRun };
    if (consumeGadgets) {
      input.honk = this.queued.has('honk');
      input.moonwalk = this.queued.has('moonwalk');
      input.donut = this.queued.has('donut');
      this.queued.clear();
    }
    return input;
  }

  reset(): void {
    this.held.clear();
    this.queued.clear();
    this.touchRun = false;
  }
}
