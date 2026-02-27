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
  update(dt: number): void {
    if (!this._audioContext || this._audioContext.state === 'suspended') {
        // Try to resume if suspended (requires interaction, might fail silently)
        // this._audioContext?.resume().catch(() => {});
        return;
    }

    // Check player boost state
    this._updateBoostSound();
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
   * Resume audio context (must call on user interaction)
   */
  async resume(): Promise<void> {
    if (this._audioContext && this._audioContext.state === 'suspended') {
      await this._audioContext.resume();
    }
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
