/** A workout definition entered on the setup screen. */
export interface WorkoutSettings {
  /** Number of laps (rounds) in the workout. */
  laps: number;
  /** Number of exercises per lap. */
  exercises: number;
  /** Duration of each exercise, in seconds. */
  exerciseSeconds: number;
  /** Rest between exercises within a lap, in seconds. */
  breakSeconds: number;
  /** Rest between laps, in seconds. */
  lapBreakSeconds: number;
}

/** The kind of phase the timer is currently in. */
export type PhaseType = 'prep' | 'work' | 'rest' | 'lapRest' | 'done';

/** A single scheduled segment of a workout. */
export interface Phase {
  type: PhaseType;
  /** Length of the phase in seconds (0 for the terminal `done` phase). */
  duration: number;
  /** 1-based lap this phase belongs to. */
  lap: number;
  /** 1-based exercise index within the lap (0 when not applicable). */
  exercise: number;
}

/** A workout saved to localStorage so it can be reused. */
export interface SavedSession {
  id: string;
  name: string;
  settings: WorkoutSettings;
  /** Epoch milliseconds the session was last saved. */
  savedAt: number;
}
