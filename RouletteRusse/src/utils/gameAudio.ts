/** Native-independent scheduler: one effects lane and one suspense lane. */
export type Sound = 'shot' | 'click' | 'bullet' | 'reload' | 'music';
export interface PlayerStatus { playing: boolean; didJustFinish: boolean; error?: string | null }
export interface SoundPlayer {
  readonly isLoaded: boolean;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  loop: boolean;
  volume: number;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
  addListener(event: 'playbackStatusUpdate', listener: (status: PlayerStatus) => void): { remove(): void };
}
interface Options {
  create: (sound: Sound) => SoundPlayer;
  configure: () => Promise<void>;
  onError: (sound: Sound, error: unknown) => void;
  onRecovered: () => void;
  timeoutMs?: number;
  pollMs?: number;
}
const sounds: Sound[] = ['shot', 'click', 'bullet', 'reload', 'music'];
class Cancelled extends Error {}

export class GameAudio {
  private players = new Map<Sound, SoundPlayer>();
  private seeking = new Set<SoundPlayer>();
  private effectsEpoch = 0;
  private musicEpoch = 0;
  private queue: Promise<void> = Promise.resolve();
  private session: Promise<void>;
  private disposed = false;
  private active = true;
  private suspense = false;
  private enabled = true;
  private reloadPending = false;

  constructor(private options: Options) {
    // Attach a rejection handler immediately; an action retries session setup if necessary.
    this.session = this.configure();
    for (const sound of sounds) {
      try { this.getPlayer(sound); } catch (error) { options.onError(sound, error); }
    }
  }

  private configure() {
    const session = Promise.resolve().then(() => this.options.configure());
    void session.catch(() => {});
    return session;
  }

  private getPlayer(sound: Sound) {
    let player = this.players.get(sound);
    if (!player) {
      player = this.options.create(sound);
      this.players.set(sound, player);
      player.loop = sound === 'music';
      player.volume = sound === 'music' ? 0.35 : 1;
    }
    return player;
  }

  private pause(sound: Sound) {
    const player = this.players.get(sound);
    if (!player) return;
    // A cancelled native seek cannot be undone. Release its reader so it cannot
    // move the playhead of a newer request when its promise eventually resolves.
    if (this.seeking.has(player)) { this.discard(sound); return; }
    try { player.pause(); } catch { this.discard(sound); }
  }

  private discard(sound: Sound) {
    const player = this.players.get(sound);
    this.players.delete(sound);
    try { player?.remove(); } catch { /* Already released by the OS. */ }
  }

  private check(valid: () => boolean) {
    if (this.disposed || !this.active || !valid()) throw new Cancelled();
  }

  private async until(predicate: () => boolean, valid: () => boolean, timeout = this.options.timeoutMs ?? 2500) {
    const deadline = Date.now() + timeout;
    for (;;) {
      this.check(valid);
      if (predicate()) return;
      if (Date.now() >= deadline) throw new Error('Audio operation timed out');
      await new Promise(resolve => setTimeout(resolve, this.options.pollMs ?? 20));
    }
  }

  private async bounded(operation: Promise<void>, valid: () => boolean) {
    let settled = false;
    let failure: unknown;
    void operation.then(() => { settled = true; }, error => { failure = error; settled = true; });
    await this.until(() => settled, valid);
    if (failure) throw failure;
  }

  private async rewind(player: SoundPlayer, valid: () => boolean) {
    this.check(valid);
    this.seeking.add(player);
    try { await this.bounded(player.seekTo(0), valid); }
    finally { this.seeking.delete(player); }
  }

  private async play(sound: Sound, valid: () => boolean, waitForEnd: boolean) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let started = false;
      let finished = false;
      let nativeError: string | null = null;
      let subscription: { remove(): void } | undefined;
      try {
        this.check(valid);
        await this.bounded(this.session, valid);
        const player = this.getPlayer(sound);
        await this.until(() => player.isLoaded, valid);
        // The first shot is already at zero: do not depend on an unnecessary native seek.
        if (player.currentTime > 0) await this.rewind(player, valid);
        this.check(valid);
        subscription = player.addListener('playbackStatusUpdate', status => {
          started ||= status.playing || status.didJustFinish;
          finished ||= status.didJustFinish;
          nativeError = status.error ?? null;
        });
        player.play();
        await this.until(() => {
          if (nativeError) throw new Error(nativeError);
          started ||= player.playing || player.currentTime > 0;
          return started;
        }, valid);
        this.options.onRecovered();
        if (waitForEnd) {
          await this.until(() => {
            if (nativeError) throw new Error(nativeError);
            return finished || (!player.playing && player.duration > 0 && player.currentTime >= player.duration - 0.02);
          }, valid, Math.max(2500, player.duration * 1000 + 1500));
          // Rewind while idle so the next trigger needs no seek on its critical path.
          this.check(valid);
          player.pause();
          await this.rewind(player, valid);
        }
        return;
      } catch (error) {
        if (error instanceof Cancelled) return;
        // Never replay a sound which already started: this could produce a double shot.
        if (started || attempt === 1) {
          this.discard(sound);
          this.options.onError(sound, error);
          return;
        }
        this.discard(sound);
        this.session = this.configure();
      } finally {
        try { subscription?.remove(); } catch { /* The reader may have been released on cancellation. */ }
      }
    }
  }

  private enqueue(sound: Sound, after?: () => void) {
    if (this.disposed || !this.active) return;
    const epoch = this.effectsEpoch;
    const valid = () => epoch === this.effectsEpoch;
    this.queue = this.queue.then(async () => {
      await this.play(sound, valid, true);
      if (!this.disposed && this.active && valid()) after?.();
    }).catch(error => this.options.onError(sound, error));
  }

  private stopMusic() {
    this.musicEpoch++;
    this.pause('music');
  }

  private startMusic() {
    if (!this.active || !this.enabled || !this.suspense || this.disposed) return;
    const epoch = ++this.musicEpoch;
    void this.play('music', () => epoch === this.musicEpoch, false);
  }

  putBullet() { this.enqueue('bullet'); }

  arm() {
    if (!this.active || this.disposed) return;
    this.suspense = true;
    this.reloadPending = true;
    this.stopMusic();
    this.enqueue('reload', () => { this.reloadPending = false; this.startMusic(); });
  }

  fire(loaded: boolean) {
    if (!this.active || this.disposed) return;
    this.suspense = false;
    this.reloadPending = false;
    this.stopMusic();
    // A shot takes priority over all pending mechanical sounds, without waiting for them.
    this.effectsEpoch++;
    for (const sound of sounds) if (sound !== 'music') this.pause(sound);
    this.queue = Promise.resolve();
    this.enqueue(loaded ? 'shot' : 'click');
  }

  setMusicEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.stopMusic();
    if (enabled && !this.reloadPending) this.startMusic();
  }

  stopAll() {
    this.suspense = false;
    this.reloadPending = false;
    this.effectsEpoch++;
    this.musicEpoch++;
    this.queue = Promise.resolve();
    for (const sound of sounds) this.pause(sound);
  }

  setActive(active: boolean) {
    if (this.active === active || this.disposed) return;
    this.active = active;
    if (!active) {
      const resumeSuspense = this.suspense;
      this.stopAll();
      this.suspense = resumeSuspense;
    } else {
      this.session = this.configure();
      this.startMusic();
    }
  }

  dispose() {
    this.stopAll();
    this.disposed = true;
    for (const sound of sounds) this.discard(sound);
  }
}
