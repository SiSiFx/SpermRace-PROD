import { Application } from 'pixi.js';
import { WORLD_DESKTOP, WORLD_MOBILE } from './constants';
import { clamp } from './math';
import { stepSimulation, type RuntimeInput } from './simulation';
import type { Runtime, RuntimeConfig, RuntimeSnapshot, RuntimeStats, Vec2 } from './types';
import { buildRuntime } from './world';

function createSnapshot(
  runtime: Runtime,
  status: RuntimeSnapshot['status'],
  placement: number,
  killer: string | null,
): RuntimeSnapshot {
  return {
    aliveCount: runtime.aliveCount,
    kills: runtime.player.kills,
    boostPct: Math.round(clamp(runtime.player.boostEnergy, 0, 100)),
    elapsed: runtime.elapsed,
    status,
    placement,
    killer,
  };
}

function snapshotToStats(snapshot: RuntimeSnapshot, runtime: Runtime): RuntimeStats {
  return {
    placement: snapshot.placement,
    kills: snapshot.kills,
    duration: snapshot.elapsed,
    distance: runtime.playerDistance,
  };
}

export class SimplePixiRuntime {
  private readonly _config: RuntimeConfig;
  private _app: Application | null = null;
  private _runtime: Runtime | null = null;
  private _tick: ((ticker: { deltaMS: number }) => void) | null = null;
  private _input: RuntimeInput = { move: { x: 0, y: 0 }, boost: false };
  private _initPromise: Promise<void> | null = null;
  private _destroyRequested = false;
  private _destroyed = false;

  constructor(config: RuntimeConfig) {
    this._config = config;
  }

  setInput(move: Vec2, boost: boolean): void {
    this._input = { move, boost };
  }

  private _safeDestroyApp(app: Application): void {
    // Pixi v8 ResizePlugin can throw if destroy races init or runs twice.
    // Make this best-effort and never let it crash the UI.
    try {
      (app as any).resizeTo = null;
    } catch {}
    try {
      (app as any).cancelResize?.();
    } catch {}
    try {
      app.destroy(true, { children: true, texture: true, textureSource: true });
    } catch {}
  }

  async start(): Promise<void> {
    try {
      if (this._destroyRequested || this._destroyed) return;
      this._config.host.innerHTML = '';

      const worldSize = this._config.isMobile ? WORLD_MOBILE : WORLD_DESKTOP;
      const app = new Application();
      this._app = app;
      this._initPromise = app.init({
        background: '#04070f',
        antialias: true,
        resizeTo: this._config.host,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      await this._initPromise;

      if (this._destroyRequested || this._destroyed) {
        this._safeDestroyApp(app);
        return;
      }

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.touchAction = 'none';
      this._config.host.appendChild(canvas);

      this._runtime = buildRuntime(
        app,
        worldSize.x,
        worldSize.y,
        this._config.playerName,
        this._config.playerColor,
        this._config.botCount,
      );

      this._tick = ({ deltaMS }) => {
        const runtime = this._runtime;
        if (!runtime || runtime.finished) return;

        const dt = Math.min(0.05, deltaMS / 1000);
        stepSimulation(runtime, this._input, dt);

        if (!runtime.player.alive) {
          runtime.finished = true;
          const endSnapshot = createSnapshot(runtime, 'dead', runtime.aliveCount + 1, runtime.player.lastHitBy);
          this._config.onSnapshot(endSnapshot);
          this._config.onEnd(endSnapshot, snapshotToStats(endSnapshot, runtime));
          return;
        }

        if (runtime.aliveCount === 1 && runtime.player.alive) {
          runtime.finished = true;
          const endSnapshot = createSnapshot(runtime, 'won', 1, null);
          this._config.onSnapshot(endSnapshot);
          this._config.onEnd(endSnapshot, snapshotToStats(endSnapshot, runtime));
          return;
        }

        if (runtime.elapsed - runtime.lastUiPush > 0.1) {
          runtime.lastUiPush = runtime.elapsed;
          this._config.onSnapshot(createSnapshot(runtime, 'playing', 0, null));
        }
      };

      app.ticker.add(this._tick as never);
    } catch (error) {
      const e = error instanceof Error ? error : new Error('Failed to initialize Pixi runtime');
      this._config.onError?.(e);
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyRequested = true;

    const app = this._app;
    const initPromise = this._initPromise;

    if (app && this._tick) {
      try {
        app.ticker?.remove(this._tick as never);
      } catch {}
    }

    // Clear DOM immediately; if init resolves later we must not re-attach canvas.
    this._config.host.innerHTML = '';

    if (app) {
      const finalize = () => this._safeDestroyApp(app);
      if (initPromise) initPromise.then(finalize).catch(finalize);
      else finalize();
    }

    this._app = null;
    this._initPromise = null;
    this._runtime = null;
    this._tick = null;
    this._input = { move: { x: 0, y: 0 }, boost: false };
    this._destroyed = true;
  }
}

export type { RuntimeConfig, RuntimeSnapshot, RuntimeStats, Vec2 } from './types';
