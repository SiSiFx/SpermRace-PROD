/**
 * Input System
 * Processes player input and applies it to player entities
 * This is a bridge between the InputHandler (which captures raw input)
 * and the ECS entities (which respond to input)
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Boost } from '../components/Boost';
import type { Player } from '../components/Player';
import { startBoost, stopBoost } from '../components/Boost';
import { ComponentNames, createComponentMask } from '../components';

/**
 * Input data for player control
 */
export interface PlayerInput {
  /** Target position in world space */
  targetX: number;

  /** Target position in world space */
  targetY: number;

  /** Is boosting */
  boost: boolean;

  /** Input timestamp */
  timestamp: number;

  /**
   * Whether a real directional input is present.
   * When false, boost state is still applied but targetAngle is NOT updated —
   * the sperm keeps its current heading instead of snapping to targetX/Y.
   */
  hasDirection?: boolean;
}

/**
 * Input system config
 */
export interface InputSystemConfig {
  /** Maximum prediction time for input (ms) */
  maxPredictionTime?: number;
}

/**
 * Input system state
 */
interface InputState {
  /** Current input data */
  currentInput: PlayerInput | null;

  /** Last input timestamp */
  lastInputTime: number;
}

/**
 * Input System
 * Processes player input and applies it to player entities
 */
export class InputSystem extends System {
  public readonly priority = SystemPriority.INPUT;

  private readonly _inputThrottleMs = 16; // Max 60fps
  private _lastInputTime = 0;

  private readonly _config: Required<InputSystemConfig>;
  private readonly _state: InputState;

  // Component mask for player entities
  private readonly _playerMask: number;

  constructor(config?: InputSystemConfig) {
    super(SystemPriority.INPUT);

    this._config = {
      maxPredictionTime: config?.maxPredictionTime ?? 100,
    };

    this._state = {
      currentInput: null,
      lastInputTime: 0,
    };

    this._playerMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.VELOCITY,
      ComponentNames.BOOST,
      ComponentNames.PLAYER
    );
  }

  /**
   * Update input processing
   */
  update(dt: number): void {
    if (!this._state.currentInput) return;

    if (this.isInputStale()) {
      this.clearInput();
      return;
    }

    // Get all player entities (local players)
    const players = this.entityManager.queryByMask(this._playerMask);

    for (const player of players) {
      const playerComponent = player.getComponent<Player>(ComponentNames.PLAYER);
      const position = player.getComponent<Position>(ComponentNames.POSITION);
      const velocity = player.getComponent<Velocity>(ComponentNames.VELOCITY);
      const boost = player.getComponent<Boost>(ComponentNames.BOOST);

      // Only process input for local players
      if (!playerComponent?.isLocal) continue;
      if (!position || !velocity || !boost) continue;

      // Apply input to entity
      this._applyInput(position, velocity, boost, this._state.currentInput);
    }
  }

  /**
   * Set current input (called from InputHandler)
   */
  setInput(input: PlayerInput): void {
    const now = Date.now();

    // Rate limit: max 60 inputs per second
    if (now - this._lastInputTime < this._inputThrottleMs) {
      return; // Drop input
    }

    // Validate coordinates
    if (!isFinite(input.targetX) || !isFinite(input.targetY)) {
      console.warn('[InputSystem] Invalid input coordinates');
      return;
    }

    this._state.currentInput = input;
    this._state.lastInputTime = now;
    this._lastInputTime = now;
  }

  /**
   * Get current input
   */
  getInput(): PlayerInput | null {
    return this._state.currentInput;
  }

  /**
   * Clear input (called when game pauses or player disconnects)
   */
  clearInput(): void {
    this._state.currentInput = null;
  }

  /**
   * Apply input to entity components
   */
  private _applyInput(
    position: Position,
    velocity: Velocity,
    boost: Boost,
    input: PlayerInput
  ): void {
    // Only update heading when actual directional input is present
    if (input.hasDirection !== false) {
      const dx = input.targetX - position.x;
      const dy = input.targetY - position.y;
      velocity.targetAngle = Math.atan2(dy, dx);
    }

    // Apply boost state regardless of direction
    if (input.boost) {
      startBoost(boost);
    } else {
      stopBoost(boost);
    }
  }

  /**
   * Check if input is stale (older than max prediction time)
   */
  isInputStale(): boolean {
    if (!this._state.currentInput) return true;
    const age = Date.now() - this._state.lastInputTime;
    return age > this._config.maxPredictionTime;
  }

  /**
   * Get input age in milliseconds
   */
  getInputAge(): number {
    if (!this._state.currentInput) return Infinity;
    return Date.now() - this._state.lastInputTime;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearInput();
  }
}

/**
 * Factory function
 */
export function createInputSystem(config?: InputSystemConfig): InputSystem {
  return new InputSystem(config);
}
