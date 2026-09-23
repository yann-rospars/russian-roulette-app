import { INTERSTITIAL_EVERY_N_GAMES } from '../constants/ads';

type AdEvent = 'loaded' | 'opened' | 'closed' | 'error';
export interface InterstitialDriver {
  load(): void;
  show(): Promise<void>;
  destroy(): void;
  listen(event: AdEvent, callback: () => void): () => void;
}

/** Only restart() may show an ad. Loading, retries and game results never do. */
export class InterstitialController {
  private completedGames = 0;
  private resultRecorded = false;
  private opportunity = false;
  private enabled = false;
  private disposed = false;
  private ad: InterstitialDriver | null = null;
  private loadedAt: number | null = null;
  private listeners: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingRestart: (() => void) | null = null;
  private retryDelay = 30_000;

  constructor(private readonly createAd: () => InterstitialDriver) {}

  observePhase(phase: string) {
    if (phase !== 'result') {
      this.resultRecorded = false;
      this.opportunity = false;
      return;
    }
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    this.completedGames += 1;
    this.opportunity = this.completedGames % INTERSTITIAL_EVERY_N_GAMES === 0;
  }

  setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.enabled = enabled;
    if (enabled) this.preload();
    else this.clearAd();
  }

  preload() {
    if (!this.enabled || this.disposed || this.pendingRestart) return;
    // Google interstitials expire after an hour. Refresh with a safety margin.
    if (this.loadedAt !== null && Date.now() - this.loadedAt >= 55 * 60_000) this.clearAd();
    if (this.ad) return;
    clearTimeout(this.timer);
    try {
      const ad = this.createAd();
      this.ad = ad;
      const listen = (event: AdEvent, callback: () => void) => {
        this.listeners.push(ad.listen(event, () => {
          if (this.ad === ad) callback();
        }));
      };
      listen('loaded', () => {
        clearTimeout(this.timer);
        this.loadedAt = Date.now();
        this.retryDelay = 30_000;
      });
      listen('opened', () => clearTimeout(this.timer));
      listen('closed', () => this.finish());
      listen('error', () => this.finish(true));
      // No-fill / offline / a missing native callback must never strand a load.
      this.timer = setTimeout(() => this.finish(true), 20_000);
      ad.load();
    } catch {
      this.finish(true);
    }
  }

  restart(onContinue: () => void, foreground: boolean) {
    if (this.pendingRestart || this.disposed) return;
    const eligible = this.opportunity;
    this.opportunity = false; // Consume even if no ad is ready; never show it late.
    if (!eligible || !this.enabled || !foreground || !this.ad || this.loadedAt === null
      || Date.now() - this.loadedAt >= 55 * 60_000) {
      onContinue();
      this.preload();
      return;
    }
    const ad = this.ad;
    this.loadedAt = null;
    this.pendingRestart = onContinue;
    // Only guard presentation. An opened ad is allowed to finish naturally.
    this.timer = setTimeout(() => this.finish(true), 5_000);
    try {
      void ad.show().catch(() => {
        if (this.ad === ad) this.finish(true);
      });
    } catch {
      this.finish(true);
    }
  }

  private clearAd() {
    clearTimeout(this.timer);
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
    const ad = this.ad;
    this.ad = null;
    this.loadedAt = null;
    try { ad?.destroy(); } catch { /* Ads are optional. */ }
  }

  private finish(failed = false) {
    const onContinue = this.pendingRestart;
    this.pendingRestart = null;
    this.clearAd();
    onContinue?.();
    if (!this.enabled || this.disposed) return;
    if (failed) {
      this.timer = setTimeout(() => this.preload(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 120_000);
    } else {
      this.preload();
    }
  }

  dispose() {
    this.disposed = true;
    this.enabled = false;
    this.pendingRestart = null;
    this.clearAd();
  }
}
