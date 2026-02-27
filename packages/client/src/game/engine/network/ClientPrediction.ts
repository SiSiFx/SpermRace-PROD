/**
 * Client-Side Prediction
 * Predicts local player movement for responsive gameplay
 *
 * Allows the client to respond immediately to input without waiting
 * for server confirmation. Server sends authoritative state periodically
 * and client reconciles any differences.
 */

import type { Position, Velocity } from '../components';

/**
 * Player input state
 */
export interface PlayerInput {
  /** Input sequence number */
  sequence: number;

  /** Target X position (world space) */
  targetX: number;

  /** Target Y position (world space) */
  targetY: number;

  /** Is accelerating */
  accelerate: boolean;

  /** Is boosting */
  boost: boolean;

  /** Timestamp (ms) */
  timestamp: number;
}

/**
 * Predicted state snapshot
 */
export interface PredictedState {
  /** Position X */
  x: number;

  /** Position Y */
  y: number;

  /** Movement angle */
  angle: number;

  /** Current speed */
  speed: number;

  /** Sequence number of last applied input */
  sequence: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Prediction configuration
 */
export interface PredictionConfig {
  /** Maximum prediction window (ms) */
  maxPredictionWindow: number;

  /** Maximum inputs to buffer */
  maxBufferedInputs: number;

  /** Enable prediction */
  enabled: boolean;

  /** Enable reconciliation */
  enableReconciliation: boolean;
}

/**
 * Client-side prediction system
 * Predicts local player movement for lag-free gameplay
 */
export class ClientPrediction {
  private readonly _config: PredictionConfig;

  /** Input buffer for replay */
  private readonly _inputBuffer: PlayerInput[] = [];

  /** Current predicted state */
  private _predictedState: PredictedState | null = null;

  /** Last server state */
  private _serverState: PredictedState | null = null;

  /** Next sequence number */
  private _sequence: number = 0;

  /** Last prediction time */
  private _lastUpdateTime: number = 0;

  /** Minimum sequence number in buffer (for overflow detection) */
  private _minSequence: number = 0;

  constructor(config?: Partial<PredictionConfig>) {
    this._config = {
      maxPredictionWindow: config?.maxPredictionWindow ?? 500,
      maxBufferedInputs: config?.maxBufferedInputs ?? 60,
      enabled: config?.enabled ?? true,
      enableReconciliation: config?.enableReconciliation ?? true,
    };
  }

  /**
   * Add local input to buffer
   */
  addInput(input: Omit<PlayerInput, 'sequence' | 'timestamp'>): PlayerInput {
    const playerInput: PlayerInput = {
      ...input,
      sequence: this._sequence++,
      timestamp: Date.now(),
    };

    this._inputBuffer.push(playerInput);

    // Track minimum sequence when we have our first input
    if (this._inputBuffer.length === 1) {
      this._minSequence = playerInput.sequence;
    }

    // Limit buffer size
    if (this._inputBuffer.length > this._config.maxBufferedInputs) {
      this._inputBuffer.shift();
      this._minSequence++;
    }

    return playerInput;
  }

  /**
   * Predict next state from inputs
   */
  predict(currentState: { x: number; y: number; angle: number; speed: number }): PredictedState {
    const now = Date.now();

    const baseState = this._predictedState || {
      x: currentState.x,
      y: currentState.y,
      angle: currentState.angle,
      speed: currentState.speed,
      sequence: this._sequence - 1,
      timestamp: now,
    };

    // Only apply the MOST RECENT unacknowledged input
    const lastUnacknowledgedInput = this._inputBuffer[this._inputBuffer.length - 1];

    if (!lastUnacknowledgedInput) {
      return baseState;
    }

    // Calculate proper delta time for this specific input
    const inputDt = Math.min((now - lastUnacknowledgedInput.timestamp) / 1000, 0.1);

    const predictedState = this._applyInput(baseState, lastUnacknowledgedInput, inputDt);
    this._predictedState = predictedState;
    this._lastUpdateTime = now;

    return predictedState;
  }

  /**
   * Apply input to state (simple prediction)
   */
  private _applyInput(state: PredictedState, input: PlayerInput, dt: number): PredictedState {
    // Calculate target angle
    const dx = input.targetX - state.x;
    const dy = input.targetY - state.y;
    const targetAngle = Math.atan2(dy, dx);

    // Smoothly interpolate angle
    let angleDiff = targetAngle - state.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    const newAngle = state.angle + angleDiff * 0.2;

    // Calculate speed
    const targetSpeed = input.boost ? 350 : 250;
    const speedDiff = targetSpeed - state.speed;
    const newSpeed = state.speed + speedDiff * 0.1;

    // Apply velocity
    return {
      x: state.x + Math.cos(newAngle) * newSpeed * dt,
      y: state.y + Math.sin(newAngle) * newSpeed * dt,
      angle: newAngle,
      speed: newSpeed,
      sequence: input.sequence,
      timestamp: input.timestamp,
    };
  }

  /**
   * Receive server state and reconcile
   */
  reconcile(serverState: { x: number; y: number; angle: number; speed: number; sequence: number }): void {
    // Check if server sequence is too old (was dropped due to buffer overflow)
    if (serverState.sequence < this._minSequence) {
      console.warn('Server state too old, forcing full reset');
      this._inputBuffer.length = 0;
      this._predictedState = { ...serverState, timestamp: Date.now() };
      this._serverState = { ...serverState, timestamp: Date.now() };
      return;
    }

    if (!this._config.enableReconciliation) {
      this._serverState = {
        ...serverState,
        timestamp: Date.now(),
      };
      return;
    }

    // Store server state
    this._serverState = {
      ...serverState,
      timestamp: Date.now(),
    };

    // Remove inputs that have been acknowledged by server
    const acknowledgedIndex = this._inputBuffer.findIndex(
      input => input.sequence === serverState.sequence
    );

    if (acknowledgedIndex >= 0) {
      // Remove acknowledged inputs and older
      this._inputBuffer.splice(0, acknowledgedIndex + 1);
    }

    // Replay remaining inputs from server state
    if (this._inputBuffer.length > 0) {
      let replayState: PredictedState = {
        x: serverState.x,
        y: serverState.y,
        angle: serverState.angle,
        speed: serverState.speed,
        sequence: serverState.sequence,
        timestamp: Date.now(),
      };

      for (const input of this._inputBuffer) {
        const dt = 1 / 60; // Assume 60fps for replay
        replayState = this._applyInput(replayState, input, dt);
      }

      this._predictedState = replayState;
    } else {
      this._predictedState = {
        ...serverState,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get predicted state
   */
  getPredictedState(): PredictedState | null {
    return this._predictedState;
  }

  /**
   * Get server state
   */
  getServerState(): PredictedState | null {
    return this._serverState;
  }

  /**
   * Get prediction error (difference between predicted and server)
   */
  getPredictionError(): { positionError: number; angleError: number } | null {
    if (!this._predictedState || !this._serverState) {
      return null;
    }

    const dx = this._predictedState.x - this._serverState.x;
    const dy = this._predictedState.y - this._serverState.y;
    const positionError = Math.sqrt(dx * dx + dy * dy);

    let angleDiff = this._predictedState.angle - this._serverState.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    const angleError = Math.abs(angleDiff);

    return { positionError, angleError };
  }

  /**
   * Clear input buffer
   */
  clear(): void {
    this._inputBuffer.length = 0;
    this._predictedState = null;
    this._serverState = null;
    this._sequence = 0;
    this._minSequence = 0;
  }

  /**
   * Get input buffer for debug
   */
  getInputBuffer(): ReadonlyArray<PlayerInput> {
    return this._inputBuffer;
  }

  /**
   * Get prediction statistics
   */
  getStats(): {
    bufferedInputs: number;
    sequence: number;
    hasPrediction: boolean;
    hasServerState: boolean;
    error: ReturnType<typeof ClientPrediction.prototype.getPredictionError>;
  } {
    return {
      bufferedInputs: this._inputBuffer.length,
      sequence: this._sequence,
      hasPrediction: this._predictedState !== null,
      hasServerState: this._serverState !== null,
      error: this.getPredictionError(),
    };
  }
}

/**
 * Create a client prediction instance
 */
export function createClientPrediction(config?: Partial<PredictionConfig>): ClientPrediction {
  return new ClientPrediction(config);
}
