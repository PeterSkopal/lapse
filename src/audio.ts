/**
 * Synthesised interval cues using the Web Audio API — no audio files, fully
 * offline, and tuned to be distinct from one another:
 *   • workStart  — bright rising two-note "go"
 *   • restStart  — soft descending single note "ease off"
 *   • lapEnd     — warm three-note chime, a lap is complete
 *   • countdown  — short low tick for the final 3 seconds
 *   • finish     — celebratory rising arpeggio
 *
 * Note on "ducking other apps to 50%": the web platform does not expose
 * system-wide audio ducking to pages/PWAs (only native apps can lower other
 * apps' output), so it cannot be implemented here. Cues are kept short so they
 * don't fight with any music you're playing.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Must be called from a user gesture (e.g. the Start button) on iOS. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private note(freq: number, start: number, dur: number, gain = 0.6, type: OscillatorType = 'sine'): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    // Soft attack + exponential release to avoid clicks.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private play(builder: (t: number) => void): void {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    builder(this.ctx.currentTime);
  }

  /** Exercise / interval begins. */
  workStart(): void {
    this.play((t) => {
      this.note(660, t, 0.14, 0.5, 'triangle');
      this.note(990, t + 0.13, 0.22, 0.55, 'triangle');
    });
  }

  /** Break between exercises begins. */
  restStart(): void {
    this.play((t) => {
      this.note(523.25, t, 0.16, 0.4, 'sine');
      this.note(392, t + 0.14, 0.3, 0.4, 'sine');
    });
  }

  /** A lap has finished. */
  lapEnd(): void {
    this.play((t) => {
      this.note(523.25, t, 0.2, 0.4, 'sine');
      this.note(659.25, t + 0.16, 0.2, 0.4, 'sine');
      this.note(783.99, t + 0.32, 0.42, 0.45, 'sine');
    });
  }

  /** Soft tick during the final 3-2-1 of a phase. */
  countdownTick(): void {
    this.play((t) => this.note(440, t, 0.07, 0.3, 'square'));
  }

  /** The whole workout is complete. */
  finish(): void {
    this.play((t) => {
      const seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach((f, i) => this.note(f, t + i * 0.13, 0.3, 0.5, 'triangle'));
    });
  }
}
