/**
 * Sound System
 * Handles procedural audio generation for gameplay events
 * - Boost (Turbine roar)
 * - Powerup Pickup (Chime)
 * - Collision (Impact)
 */

import { System, SystemPriority } from '../core/System';
import { ComponentNames, createComponentMask } from '../components';
import type { Boost } from '../components/Boost';
import type { Player } from '../components/Player';
import type { Health } from '../components/Health';
import { ZoneState } from './ZoneSystem';
import type { ZoneSystem } from './ZoneSystem';
import type { CollisionSystem } from './CollisionSystem';

/**
 * Sound system configuration
 */
export interface SoundSystemConfig {
  /** Master volume (0-1) */
  masterVolume: number;
}

/**
 * Sound System
 */
export class SoundSystem extends System {
  public readonly priority = SystemPriority.EFFECTS;

  private readonly _config: SoundSystemConfig;
  private _audioContext: AudioContext | null = null;
  private _masterGain: GainNode | null = null;

  // Boost sound state
  private _boostOscillators: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private _isBoosting: boolean = false;

  // Zone sound state
  private _lastZoneState: ZoneState = ZoneState.IDLE;

  // Collision sound cooldown (ms) to avoid stacking thud sounds
  private _lastCollisionSoundAt: number = 0;

  // Near-miss sound cooldown (ms) to avoid stacking
  private _lastNearMissSoundAt: number = 0;

  // Masks
  private readonly _playerMask: number;

  constructor(config: Partial<SoundSystemConfig> = {}) {
    super(SystemPriority.EFFECTS);
    this._config = {
      masterVolume: config.masterVolume ?? 0.5,
    };

    this._playerMask = createComponentMask(
      ComponentNames.PLAYER,
      ComponentNames.BOOST,
      ComponentNames.HEALTH
    );
  }

  /**
   * Initialize audio context
   * Note: Must be resumed on user interaction
   */
  async init(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this._audioContext = new AudioContextClass();
      this._masterGain = this._audioContext.createGain();
      this._masterGain.gain.value = this._config.masterVolume;
      this._masterGain.connect(this._audioContext.destination);
    } catch (e) {
      console.warn('[SoundSystem] Web Audio API not supported');
    }
  }

  /**
   * Update loop
   */
  update(_dt: number): void {
    if (!this._audioContext || this._audioContext.state !== 'running') {
        return;
    }

    // Check player boost state
    this._updateBoostSound();

    // Zone phase transition sounds
    this._updateZoneSound();

    // Car-car collision thud
    this._updateCollisionSound();

    // Near-miss "fwit" sound
    this._updateNearMissSound();
  }

  /**
   * Update boost sound based on local player state
   */
  private _updateBoostSound(): void {
    if (!this._audioContext || !this._masterGain) return;

    // Find local player
    const entities = this.entityManager.queryByMask(this._playerMask);
    let playerBoosting = false;

    // We assume the game engine sets the 'isLocal' flag on the player component
    // If not available, we might need another way to identify the local player
    // For now, check any player boosting (or refine query later)
    // Actually, we usually only hear OUR boost loud, others quiet.
    // Let's assume we want to hear the camera target or local player.
    // For simplicity, check if ANY entity with "Player" component (usually just us in single player context or we filter by ID)
    // In Game.ts, we create player. 
    // Let's iterate and check if *any* alive player is boosting? No, that would be noisy.
    // Ideally we filter by `player.isLocal`.
    
    for (const entity of entities) {
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);
        const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
        const health = entity.getComponent<Health>(ComponentNames.HEALTH);

        if (player?.isLocal && health?.isAlive) {
            if (boost?.isBoosting) {
                playerBoosting = true;
            }
            break; // Found local player
        }
    }

    if (playerBoosting && !this._isBoosting) {
        this._startBoostSound();
    } else if (!playerBoosting && this._isBoosting) {
        this._stopBoostSound();
    }

    this._isBoosting = playerBoosting;
  }

  /**
   * Start looping boost sound
   */
  private _startBoostSound(): void {
    if (!this._audioContext || !this._masterGain) return;

    // Create turbine roar (Sawtooth + Lowpass + Modulation)
    const osc = this._audioContext.createOscillator();
    const gain = this._audioContext.createGain();
    const filter = this._audioContext.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = 80; // Low rumble base

    // Filter
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 1;

    // Envelope
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.2, this._audioContext.currentTime + 0.1);

    // Modulation (LFO for "flutter")
    const lfo = this._audioContext.createOscillator();
    const lfoGain = this._audioContext.createGain();
    lfo.frequency.value = 15; // 15Hz flutter
    lfoGain.gain.value = 50; // Modulate filter frequency
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Pitch ramp up
    osc.frequency.linearRampToValueAtTime(120, this._audioContext.currentTime + 0.5);
    filter.frequency.linearRampToValueAtTime(600, this._audioContext.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);

    osc.start();

    this._boostOscillators = { osc, gain, filter };
  }

  /**
   * Stop boost sound
   */
  private _stopBoostSound(): void {
    if (!this._boostOscillators || !this._audioContext) return;

    const { osc, gain } = this._boostOscillators;
    
    // Fade out
    try {
        gain.gain.cancelScheduledValues(this._audioContext.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, this._audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0, this._audioContext.currentTime + 0.2);
        
        osc.stop(this._audioContext.currentTime + 0.2);
    } catch (e) {}

    this._boostOscillators = null;
  }

  /**
   * Play pickup chime
   */
  playPickup(): void {
    if (!this._audioContext || !this._masterGain) return;

    const t = this._audioContext.currentTime;
    const osc = this._audioContext.createOscillator();
    const gain = this._audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this._masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * Play collision thud
   */
  playCollision(intensity: number = 1.0): void {
    if (!this._audioContext || !this._masterGain) return;

    const t = this._audioContext.currentTime;
    const osc = this._audioContext.createOscillator();
    const gain = this._audioContext.createGain();
    const filter = this._audioContext.createBiquadFilter();

    // Noise-like impact using low triangle/square
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    gain.gain.setValueAtTime(0.5 * Math.min(1, intensity), t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * Play death sound (descending whoosh)
   */
  playDeath(): void {
    if (!this._audioContext || !this._masterGain) return;
    const ctx = this._audioContext;
    const now = ctx.currentTime;

    // Main descending osc
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.4);

    // Short noise burst
    const noiseOsc = ctx.createOscillator();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noiseOsc.type = 'sawtooth';
    noiseOsc.frequency.setValueAtTime(880, now);
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noiseOsc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this._masterGain);
    noiseOsc.start(now);
    noiseOsc.stop(now + 0.15);
  }

  /**
   * Play kill chime (ascending). `pitch` scales all frequencies — streak tiers pass 1.0–1.8.
   * Also plays a low impact thud for physical kill satisfaction.
   */
  playKill(pitch: number = 1.0): void {
    if (!this._audioContext || !this._masterGain) return;
    const ctx = this._audioContext;
    const now = ctx.currentTime;

    // Low impact thud (physical "splat" layer)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    const thudFilter = ctx.createBiquadFilter();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(140 * pitch, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    thudFilter.type = 'lowpass';
    thudFilter.frequency.setValueAtTime(300, now);
    thudGain.gain.setValueAtTime(0.45, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    thud.connect(thudFilter);
    thudFilter.connect(thudGain);
    thudGain.connect(this._masterGain);
    thud.start(now);
    thud.stop(now + 0.14);

    // Primary chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(880 * pitch, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.3);

    // Decay tail
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880 * pitch, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1760 * pitch, now + 0.25);
    gain2.gain.setValueAtTime(0.1, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(this._masterGain);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.35);
  }

  /**
   * Near-miss "fwit" — a sharp high-pitched sweep past the ear.
   * Triggered when the local player passes within 15px of an enemy trail.
   */
  playNearMiss(): void {
    if (!this._audioContext || !this._masterGain) return;
    const ctx = this._audioContext;
    const t = ctx.currentTime;

    // High swept sine — like something slicing past
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(0.8, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Final Duel stinger — played when 2 players remain.
   * Three descending bass pulses + a high harmonic overlay to signal "it's on".
   */
  playFinalDuel(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // Three thumping bass notes (descending, foreboding)
    [0, 0.18, 0.36].forEach((offset, i) => {
      const freq = [110, 92, 82][i];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + offset);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + offset + 0.16);
      g.gain.setValueAtTime(0.4, t + offset);
      g.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.2);
      osc.connect(g);
      g.connect(master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    });

    // High harmonic sting over the top (metallic, urgent)
    const sting = ctx.createOscillator();
    const stingGain = ctx.createGain();
    sting.type = 'sine';
    sting.frequency.setValueAtTime(880, t + 0.36);
    sting.frequency.exponentialRampToValueAtTime(1320, t + 0.55);
    stingGain.gain.setValueAtTime(0, t + 0.36);
    stingGain.gain.linearRampToValueAtTime(0.2, t + 0.42);
    stingGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
    sting.connect(stingGain);
    stingGain.connect(master);
    sting.start(t + 0.36);
    sting.stop(t + 0.72);
  }

  /**
   * Play victory arpeggio
   */
  playVictory(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const freqs = [440, 550, 660];

    freqs.forEach((freq, i) => {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /**
   * Play shield bubble activation — rising harmonic hum
   */
  playShield(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // Root tone — rises one octave
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(260, t);
    osc1.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    gain1.gain.setValueAtTime(0.22, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(t);
    osc1.stop(t + 0.45);

    // Perfect 5th overtone — adds "shield" character
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(390, t);
    osc2.frequency.exponentialRampToValueAtTime(780, t + 0.18);
    gain2.gain.setValueAtTime(0.10, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(t);
    osc2.stop(t + 0.35);
  }

  /**
   * Play dash whoosh — brief bright sweep
   */
  playDash(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);

    // High-pass so it reads as a "whoosh" not a thud
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, t);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * Play trap placement — mechanical click + tick
   */
  playTrap(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // Low thud (body of the click)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(120, t);
    osc1.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // High tick (placement click)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1200, t + 0.04);
    gain2.gain.setValueAtTime(0.12, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.10);
    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.10);
  }

  /**
   * Play near-miss "fwit" when local player passes close to an enemy trail.
   * Throttled to 400ms so rapid near-misses don't stack.
   */
  private _updateNearMissSound(): void {
    const collision = this.getEngine()?.getSystemManager()?.getSystem<CollisionSystem>('collision');
    if (!collision) return;

    const nearMisses = collision.getNearMisses();
    if (nearMisses.length === 0) return;

    const now = Date.now();
    if (now - this._lastNearMissSoundAt < 400) return;

    // Find local player ID
    let localPlayerId: string | null = null;
    for (const entity of this.entityManager.queryByMask(this._playerMask)) {
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (player?.isLocal) { localPlayerId = entity.id; break; }
    }

    const hasLocalNearMiss = localPlayerId
      ? nearMisses.some((nm: { entityId: string }) => nm.entityId === localPlayerId)
      : false;

    if (hasLocalNearMiss) {
      this._lastNearMissSoundAt = now;
      this.playNearMiss();
    }
  }

  /**
   * Play collision thud when the local player bounces off another car.
   * Throttled to 150ms so rapid multi-hit collisions don't stack.
   */
  private _updateCollisionSound(): void {
    const collision = this.getEngine()?.getSystemManager()?.getSystem<CollisionSystem>('collision');
    if (!collision) return;

    // Only care about car-car collisions, not trail deaths
    const carCollisions = collision.getCollisions().filter(c => c.type === 'car');
    if (carCollisions.length === 0) return;

    const now = Date.now();
    if (now - this._lastCollisionSoundAt < 150) return;

    // Find local player ID — search for entity with player.isLocal=true
    let localPlayerId: string | null = null;
    for (const entity of this.entityManager.queryByMask(this._playerMask)) {
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (player?.isLocal) { localPlayerId = entity.id; break; }
    }

    const hasLocalCollision = localPlayerId
      ? carCollisions.some(c => c.victimId === localPlayerId || c.killerId === localPlayerId)
      : false;

    if (hasLocalCollision) {
      this._lastCollisionSoundAt = now;
      this.playCollision(0.6);
    }
  }

  /**
   * Detect zone state transitions and fire one-shot audio cues.
   */
  private _updateZoneSound(): void {
    const zone = this.getEngine()?.getSystemManager()?.getSystem<ZoneSystem>('zone');
    if (!zone) return;

    const state = zone.getState();
    if (state === this._lastZoneState) return;

    if (state === ZoneState.WARNING) {
      this._playZoneWarning();
    } else if (state === ZoneState.SHRINKING) {
      this._playZoneShrink();
    }

    this._lastZoneState = state;
  }

  /** Low rumbling pulse when zone enters WARNING phase */
  private _playZoneWarning(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.6);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.1);
      gain.gain.linearRampToValueAtTime(0, t + 0.8);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.8);
    } catch {}
  }

  /** Harsh descending tone when zone starts SHRINKING */
  private _playZoneShrink(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.5);
    } catch {}
  }

  /**
   * Resume audio context (must call on user interaction)
   */
  async resume(): Promise<void> {
    if (this._audioContext && this._audioContext.state === 'suspended') {
      await this._audioContext.resume();
    }
  }

  /**
   * Play overdrive activation — heavy low pulse + distorted swell
   * Overdrive doubles trail width for 3s, so the sound should feel like a power surge.
   */
  playOverdrive(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // Low power-surge pulse
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, t);
    osc1.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    gain1.gain.setValueAtTime(0.0, t);
    gain1.gain.linearRampToValueAtTime(0.32, t + 0.06);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(t);
    osc1.stop(t + 0.35);

    // High harmonic swell — signals "mode change"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(240, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(480, t + 0.22);
    gain2.gain.setValueAtTime(0.0, t + 0.05);
    gain2.gain.linearRampToValueAtTime(0.14, t + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.40);
    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.40);
  }

  /**
   * Play spawn materialisation — low thud + ascending triangle tone
   * Called once at GO to signal the player's arrival in the arena.
   */
  playSpawn(): void {
    const ctx = this._audioContext;
    const master = this._masterGain;
    if (!ctx || !master) return;
    const now = ctx.currentTime;

    // Low thud — impact
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    thudGain.gain.setValueAtTime(0.35, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(now);
    thud.stop(now + 0.18);

    // Rising tone — identity arrival
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(320, now + 0.05);
    tone.frequency.linearRampToValueAtTime(620, now + 0.4);
    toneGain.gain.setValueAtTime(0.0, now + 0.05);
    toneGain.gain.linearRampToValueAtTime(0.18, now + 0.12);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    tone.connect(toneGain);
    toneGain.connect(master);
    tone.start(now + 0.05);
    tone.stop(now + 0.45);
  }

  /**
   * Destroy system
   */
  destroy(): void {
    this._stopBoostSound();
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}
