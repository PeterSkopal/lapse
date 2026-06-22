/**
 * Keeps the screen awake during a workout via the Screen Wake Lock API.
 * Re-acquires the lock automatically when the tab becomes visible again
 * (the OS releases it when the page is backgrounded).
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private readonly onVisibility = () => {
    if (this.wanted && document.visibilityState === 'visible') {
      void this.acquire();
    }
  };

  get isSupported(): boolean {
    return 'wakeLock' in navigator;
  }

  async enable(): Promise<void> {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    try {
      await this.sentinel?.release();
    } catch {
      /* already released */
    }
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    if (!this.isSupported || this.sentinel) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Permission denied or not allowed (e.g. low battery) — fail silently.
      this.sentinel = null;
    }
  }
}
