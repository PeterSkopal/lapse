import type { Phase, WorkoutSettings } from './types';

/** Seconds of "get ready" lead-in before the first exercise. */
export const PREP_SECONDS = 3;

/** Expand a workout definition into the full ordered list of phases. */
export function buildPhases(s: WorkoutSettings, prepSeconds = PREP_SECONDS): Phase[] {
  const phases: Phase[] = [];

  if (prepSeconds > 0) {
    phases.push({ type: 'prep', duration: prepSeconds, lap: 1, exercise: 1 });
  }

  for (let lap = 1; lap <= s.laps; lap++) {
    for (let ex = 1; ex <= s.exercises; ex++) {
      phases.push({ type: 'work', duration: s.exerciseSeconds, lap, exercise: ex });

      const lastExerciseOfLap = ex === s.exercises;
      if (!lastExerciseOfLap && s.breakSeconds > 0) {
        phases.push({ type: 'rest', duration: s.breakSeconds, lap, exercise: ex });
      }
    }

    const lastLap = lap === s.laps;
    if (!lastLap && s.lapBreakSeconds > 0) {
      phases.push({ type: 'lapRest', duration: s.lapBreakSeconds, lap, exercise: s.exercises });
    }
  }

  phases.push({ type: 'done', duration: 0, lap: s.laps, exercise: s.exercises });
  return phases;
}

export interface EngineState {
  phase: Phase;
  /** The phase that follows the current one, or null at the end. */
  nextPhase: Phase | null;
  phaseIndex: number;
  /** Whole seconds remaining in the current phase. */
  remaining: number;
  /** Fraction of the current phase already elapsed (0–1). */
  progress: number;
  /** Whole seconds elapsed across the entire workout. */
  elapsedTotal: number;
  /** Whole seconds in the entire workout. */
  totalDuration: number;
  paused: boolean;
}

export interface EngineCallbacks {
  onTick: (state: EngineState) => void;
  /** Fired when a new phase begins. Use to trigger sounds. */
  onPhaseEnter: (phase: Phase) => void;
  /** Fired once per second during the final 3 s of a timed phase. */
  onCountdownTick: (secondsLeft: number) => void;
  onComplete: () => void;
}

const now = (): number => performance.now();

/**
 * Drives a workout through its phases using timestamp-based timing so it stays
 * accurate even if the tick interval drifts or the tab is throttled.
 */
export class WorkoutEngine {
  private readonly phases: Phase[];
  private readonly durationsBefore: number[];
  readonly totalDuration: number;

  private idx = 0;
  private phaseEndAt = 0;
  private remainingWhenPaused = 0;
  private paused = false;
  private lastCountdownSecond = -1;
  private intervalId: number | undefined;

  constructor(
    settings: WorkoutSettings,
    private readonly cb: EngineCallbacks,
    prepSeconds = PREP_SECONDS,
  ) {
    this.phases = buildPhases(settings, prepSeconds);

    // Pre-compute cumulative duration before each phase for total-elapsed maths.
    this.durationsBefore = [];
    let acc = 0;
    for (const p of this.phases) {
      this.durationsBefore.push(acc);
      acc += p.duration;
    }
    this.totalDuration = acc;
  }

  start(): void {
    this.enterPhase(0);
    this.intervalId = window.setInterval(() => this.tick(), 100);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  get isPaused(): boolean {
    return this.paused;
  }

  togglePause(): void {
    if (this.phases[this.idx].type === 'done') return;
    if (this.paused) {
      this.phaseEndAt = now() + this.remainingWhenPaused;
      this.paused = false;
    } else {
      this.remainingWhenPaused = Math.max(0, this.phaseEndAt - now());
      this.paused = true;
    }
    this.emit();
  }

  /** Jump to the start of the next phase. */
  skip(): void {
    if (this.idx >= this.phases.length - 1) return;
    this.paused = false;
    this.enterPhase(this.idx + 1);
  }

  private enterPhase(index: number): void {
    this.idx = index;
    const phase = this.phases[index];
    this.lastCountdownSecond = -1;

    if (phase.type === 'done') {
      this.stop();
      this.cb.onComplete();
      this.emit();
      return;
    }

    this.phaseEndAt = now() + phase.duration * 1000;
    this.cb.onPhaseEnter(phase);
    this.emit();
  }

  private tick(): void {
    if (this.paused) return;

    const phase = this.phases[this.idx];
    if (phase.type === 'done') return;

    const remainingMs = this.phaseEndAt - now();
    if (remainingMs <= 0) {
      this.enterPhase(this.idx + 1);
      return;
    }

    const remainingSec = Math.ceil(remainingMs / 1000);
    if (remainingSec !== this.lastCountdownSecond) {
      this.lastCountdownSecond = remainingSec;
      if (remainingSec <= 3 && remainingSec >= 1) {
        this.cb.onCountdownTick(remainingSec);
      }
    }
    this.emit();
  }

  private emit(): void {
    const phase = this.phases[this.idx];
    const remainingMs = this.paused
      ? this.remainingWhenPaused
      : Math.max(0, this.phaseEndAt - now());
    const remaining = phase.type === 'done' ? 0 : Math.ceil(remainingMs / 1000);
    const elapsedInPhase = phase.duration - remainingMs / 1000;
    const elapsedTotal = this.durationsBefore[this.idx] + Math.max(0, elapsedInPhase);
    const progress = phase.duration > 0 ? Math.min(1, Math.max(0, elapsedInPhase / phase.duration)) : 1;

    this.cb.onTick({
      phase,
      nextPhase: this.phases[this.idx + 1] ?? null,
      phaseIndex: this.idx,
      remaining,
      progress,
      elapsedTotal: Math.round(Math.min(elapsedTotal, this.totalDuration)),
      totalDuration: this.totalDuration,
      paused: this.paused,
    });
  }
}
