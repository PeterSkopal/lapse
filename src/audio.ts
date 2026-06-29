/**
 * Synthesised interval cues using the Web Audio API — no audio files, fully
 * offline, and tuned to be distinct from one another AND to cut through music
 * playing in the background:
 *   • workStart  — bright rising two-note "go"
 *   • restStart  — softer descending two-note "ease off"
 *   • lapEnd     — three-note rising chime, a lap is complete
 *   • countdown  — crisp high tick for the final 3 seconds
 *   • finish     — celebratory rising arpeggio
 *
 * Loudness/clarity: cues use square/triangle waves (rich in harmonics, so they
 * stand out against music far better than pure sines) at a healthy level, fed
 * through a brick-wall limiter so the higher level never clips or distorts.
 *
 * Note on "ducking other apps to 50%": the web platform does not expose
 * system-wide audio ducking to pages/PWAs (only native apps can lower other
 * apps' output), so the cues can't quiet your music — they're made to be heard
 * over it instead.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Must be called from a user gesture (e.g. the Start button) on iOS. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;

      // Brick-wall-ish limiter: lets us drive the cues loud for cut-through
      // while catching peaks (and overlapping notes) so nothing clips/distorts.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;

      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private note(freq: number, start: number, dur: number, peak = 0.8, type: OscillatorType = 'square'): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    // Fast attack for punch, exponential release to avoid clicks.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.008);
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

  /** Exercise / interval begins — bright, assertive rising beep. */
  workStart(): void {
    this.play((t) => {
      this.note(784, t, 0.14, 0.85, 'square');
      this.note(1175, t + 0.12, 0.26, 0.9, 'square');
    });
  }

  /** Break between exercises begins — mellower but still cuts through. */
  restStart(): void {
    this.play((t) => {
      this.note(587.33, t, 0.18, 0.7, 'triangle');
      this.note(440, t + 0.16, 0.34, 0.7, 'triangle');
    });
  }

  /** A lap has finished — three-note rising chime. */
  lapEnd(): void {
    this.play((t) => {
      this.note(659.25, t, 0.2, 0.75, 'triangle');
      this.note(880, t + 0.17, 0.2, 0.78, 'triangle');
      this.note(1318.51, t + 0.34, 0.46, 0.85, 'square');
    });
  }

  /** Crisp high tick during the final 3-2-1 of a phase. */
  countdownTick(): void {
    this.play((t) => this.note(987.77, t, 0.09, 0.6, 'square'));
  }

  /** The whole workout is complete — rising arpeggio. */
  finish(): void {
    this.play((t) => {
      const seq = [659.25, 880, 1174.66, 1567.98];
      seq.forEach((f, i) => this.note(f, t + i * 0.13, 0.34, 0.82, 'square'));
    });
  }
}
