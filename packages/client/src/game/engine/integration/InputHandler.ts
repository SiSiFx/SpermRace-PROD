/**
 * Input Handler for ECS Engine
 * Handles mouse, touch, and keyboard input for the new game engine
 */

import { Game } from '../Game';
import { ComponentNames } from '../components';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import { ABILITY_CONFIG } from '../config/GameConstants';

/**
 * Input state
 */
export interface InputState {
  /** Target position in world space */
  targetX: number;

  /** Target position in world space */
  targetY: number;

  /** Is accelerating (always true in this game) */
  accelerate: boolean;

  /** Is boosting */
  boost: boolean;

  /** Input timestamp */
  timestamp: number;
}

/**
 * Input handler configuration
 */
export interface InputHandlerConfig {
  /** Game instance */
  game: Game;

  /** Canvas element */
  canvas: HTMLCanvasElement;

  /** Container element */
  container: HTMLElement;

  /** Callback for input changes */
  onInputChange?: (input: InputState) => void;

  /** Callback for ability activation */
  onAbilityActivate?: (ability: string) => void;
}

/**
 * Joystick state for mobile
 */
interface JoystickState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originX: number;
  originY: number;
}

/**
 * Input handler for the ECS engine
 */
export class InputHandler {
  private readonly _game: Game;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _container: HTMLElement;
  private readonly _onInputChange: (input: InputState) => void;
  private readonly _onAbilityActivate: ((ability: string) => void) | undefined;

  private _currentState: InputState;
  private _mousePosition = { x: 0, y: 0 };
  private _keys: Set<string> = new Set();
  private _isBoosting = false;
  private _joystick: JoystickState | null = null;
  private _touchHandlers: { touchStart: (e: TouchEvent) => void; touchMove: (e: TouchEvent) => void; touchEnd: (e: TouchEvent) => void } | null = null;
  private _isMobile = false;

  // Ability cooldown tracking (for UI feedback)
  private readonly _abilities = {
    dash:      { key: 'KeyQ', lastUsed: 0, cooldown: ABILITY_CONFIG.DASH.COOLDOWN_MS },
    shield:    { key: 'KeyE', lastUsed: 0, cooldown: ABILITY_CONFIG.SHIELD.COOLDOWN_MS },
    trap:      { key: 'KeyF', lastUsed: 0, cooldown: ABILITY_CONFIG.TRAP.COOLDOWN_MS },
    overdrive: { key: 'KeyR', lastUsed: 0, cooldown: ABILITY_CONFIG.OVERDRIVE.COOLDOWN_MS },
  };

  constructor(config: InputHandlerConfig) {
    this._game = config.game;
    this._canvas = config.canvas;
    this._container = config.container;
    this._onInputChange = config.onInputChange ?? (() => {});
    this._onAbilityActivate = config.onAbilityActivate;

    // Initialize mouse position to center of canvas (not 0,0 which causes steering to top-left)
    const rect = this._canvas.getBoundingClientRect();
    this._mousePosition = {
      x: rect.width / 2,
      y: rect.height / 2,
    };

    this._currentState = {
      targetX: 0,
      targetY: 0,
      accelerate: true,
      boost: false,
      timestamp: Date.now(),
    };

    this._isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    this._setup();
  }

  /**
   * Get current input state
   */
  getCurrentState(): InputState {
    return { ...this._currentState };
  }

  /**
   * Get mouse position (screen space)
   */
  getMousePosition(): { x: number; y: number } {
    return { ...this._mousePosition };
  }

  /**
   * Check if a key is pressed
   */
  isKeyPressed(key: string): boolean {
    return this._keys.has(key);
  }

  /**
   * Check if boosting
   */
  isBoosting(): boolean {
    return this._isBoosting;
  }

  /**
   * Get ability cooldown remaining (ms)
   */
  getAbilityCooldown(ability: string): number {
    const now = Date.now();
    const lastUsed = this._abilities[ability as keyof typeof this._abilities]?.lastUsed ?? 0;
    const cooldown = this._abilities[ability as keyof typeof this._abilities]?.cooldown ?? 0;
    return Math.max(0, lastUsed + cooldown - now);
  }

  /**
   * Check if ability is ready
   */
  isAbilityReady(ability: string): boolean {
    return this.getAbilityCooldown(ability) === 0;
  }

  /**
   * Destroy input handler
   */
  destroy(): void {
    this._removeKeyboardHandlers();
    this._removeMouseHandlers();
    this._removeTouchHandlers();
    this._removeMobileControlEvents();

    if (this._joystick) {
      this._removeJoystick();
    }
  }

  /**
   * Setup all input handlers
   */
  private _setup(): void {
    this._setupKeyboardHandlers();
    this._setupMouseHandlers();
    this._setupMobileControlEvents(); // Always listen for mobile controls events

    if (this._isMobile) {
      this._setupTouchHandlers(); // Fallback for direct canvas touches
    }
  }

  /**
   * Setup keyboard handlers
   */
  private _setupKeyboardHandlers(): void {
    window.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('keyup', this._handleKeyUp);
  }

  /**
   * Remove keyboard handlers
   */
  private _removeKeyboardHandlers(): void {
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('keyup', this._handleKeyUp);
  }

  /**
   * Setup mobile controls event listeners
   * Listens for custom events dispatched by MobileTouchControls component
   */
  private _setupMobileControlEvents(): void {
    // Listen for joystick events from MobileTouchControls
    window.addEventListener('mobile-joystick', this._handleMobileJoystick);
    // Listen for boost events from MobileTouchControls
    window.addEventListener('mobile-boost', this._handleMobileBoost);
  }

  /**
   * Remove mobile controls event listeners
   */
  private _removeMobileControlEvents(): void {
    window.removeEventListener('mobile-joystick', this._handleMobileJoystick);
    window.removeEventListener('mobile-boost', this._handleMobileBoost);
  }

  /**
   * Handle mobile joystick events from MobileTouchControls
   * The joystick dx/dy values represent the direction the player wants to steer
   */
  private _handleMobileJoystick = (e: Event): void => {
    const customEvent = e as CustomEvent<{ x: number; y: number; action: string }>;
    const { x, y, action } = customEvent.detail;

    if (action === 'end') {
      // Reset to center when joystick is released
      this._joystick = null;
      this._isBoosting = false;
    } else {
      // Create/update joystick state
      if (!this._joystick) {
        this._joystick = {
          active: true,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          originX: 0,
          originY: 0,
        };
      }
      this._joystick.currentX = x;
      this._joystick.currentY = y;
    }

    this._updateInputState();
  };

  /**
   * Handle mobile boost events from MobileTouchControls
   */
  private _handleMobileBoost = (e: Event): void => {
    const customEvent = e as CustomEvent<{ action: string }>;
    const { action } = customEvent.detail;

    if (action === 'start') {
      this._isBoosting = true;
    } else if (action === 'end') {
      this._isBoosting = false;
    }

    this._updateInputState();
  };

  /**
   * Handle key down
   */
  private _handleKeyDown = (e: KeyboardEvent): void => {
    this._keys.add(e.code);

    // Boost with Space
    if (e.code === 'Space') {
      this._isBoosting = true;
      this._updateInputState();
    }

    // Ability activations
    const now = Date.now();
    switch (e.code) {
      case 'KeyQ':
        if (this.getAbilityCooldown('dash') === 0) {
          this._abilities.dash.lastUsed = now;
          this._onAbilityActivate?.('dash');
          this._game.activateAbility('dash');
        }
        break;

      case 'KeyE':
        if (this.getAbilityCooldown('shield') === 0) {
          this._abilities.shield.lastUsed = now;
          this._onAbilityActivate?.('shield');
          this._game.activateAbility('shield');
        }
        break;

      case 'KeyF':
        if (this.getAbilityCooldown('trap') === 0) {
          this._abilities.trap.lastUsed = now;
          this._onAbilityActivate?.('trap');
          this._game.activateAbility('trap');
        }
        break;

      case 'KeyR':
        // Overdrive — R key, matches NewGameViewECS polling loop
        if (this.getAbilityCooldown('overdrive') === 0) {
          this._abilities.overdrive.lastUsed = now;
          this._onAbilityActivate?.('overdrive');
          this._game.activateAbility('overdrive');
        }
        break;
    }
  };

  /**
   * Handle key up
   */
  private _handleKeyUp = (e: KeyboardEvent): void => {
    this._keys.delete(e.code);

    if (e.code === 'Space') {
      this._isBoosting = false;
      this._updateInputState();
    }
  };

  /**
   * Setup mouse handlers
   */
  private _setupMouseHandlers(): void {
    this._canvas.addEventListener('mousemove', this._handleMouseMove);
    this._canvas.addEventListener('mousedown', this._handleMouseDown);
    this._canvas.addEventListener('mouseup', this._handleMouseUp);
    this._canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Remove mouse handlers
   */
  private _removeMouseHandlers(): void {
    this._canvas.removeEventListener('mousemove', this._handleMouseMove);
    this._canvas.removeEventListener('mousedown', this._handleMouseDown);
    this._canvas.removeEventListener('mouseup', this._handleMouseUp);
  }

  /**
   * Handle mouse move
   */
  private _handleMouseMove = (e: MouseEvent): void => {
    const rect = this._canvas.getBoundingClientRect();
    this._mousePosition.x = e.clientX - rect.left;
    this._mousePosition.y = e.clientY - rect.top;

    this._updateInputState();
  };

  /**
   * Handle mouse down
   */
  private _handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      // Left click - boost
      this._isBoosting = true;
      this._updateInputState();
    } else if (e.button === 2) {
      // Right click - activate ability
      // Could map to specific ability
    }
  };

  /**
   * Handle mouse up
   */
  private _handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this._isBoosting = false;
      this._updateInputState();
    }
  };

  /**
   * Setup touch handlers for mobile
   */
  private _setupTouchHandlers(): void {
    const touchStart = this._handleTouchStart.bind(this);
    const touchMove = this._handleTouchMove.bind(this);
    const touchEnd = this._handleTouchEnd.bind(this);

    this._canvas.addEventListener('touchstart', touchStart, { passive: false });
    this._canvas.addEventListener('touchmove', touchMove, { passive: false });
    this._canvas.addEventListener('touchend', touchEnd, { passive: false });
    this._canvas.addEventListener('touchcancel', touchEnd, { passive: false });

    this._touchHandlers = { touchStart, touchMove, touchEnd };
  }

  /**
   * Remove touch handlers
   */
  private _removeTouchHandlers(): void {
    if (this._touchHandlers) {
      this._canvas.removeEventListener('touchstart', this._touchHandlers.touchStart);
      this._canvas.removeEventListener('touchmove', this._touchHandlers.touchMove);
      this._canvas.removeEventListener('touchend', this._touchHandlers.touchEnd);
      this._canvas.removeEventListener('touchcancel', this._touchHandlers.touchEnd);
      this._touchHandlers = null;
    }
  }

  /**
   * Handle touch start
   */
  private _handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    const touch = e.touches[0];
    const rect = this._canvas.getBoundingClientRect();

    // Check if touch is on right side of screen (boost/joystick)
    if (touch.clientX - rect.left > rect.width / 2) {
      // Start joystick
      if (!this._joystick) {
        this._joystick = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          originX: touch.clientX,
          originY: touch.clientY,
        };

        this._createJoystickVisual(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    }
  }

  /**
   * Handle touch move
   */
  private _handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    const touch = e.touches[0];
    const rect = this._canvas.getBoundingClientRect();

    this._mousePosition.x = touch.clientX - rect.left;
    this._mousePosition.y = touch.clientY - rect.top;

    if (this._joystick) {
      this._joystick.currentX = touch.clientX;
      this._joystick.currentY = touch.clientY;
      this._updateJoystickVisual();

      // Check for boost (joystick pushed far enough)
      const dx = touch.clientX - this._joystick.originX;
      const dy = touch.clientY - this._joystick.originY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 50) {
        this._isBoosting = true;
      } else {
        this._isBoosting = false;
      }
    }

    this._updateInputState();
  }

  /**
   * Handle touch end
   */
  private _handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();

    if (this._joystick) {
      this._removeJoystick();
      this._isBoosting = false;
    }

    this._updateInputState();
  }

  /**
   * Create joystick visual
   */
  private _createJoystickVisual(x: number, y: number): void {
    // Emit custom event for mobile controls
    const event = new CustomEvent('joystick-start', {
      detail: { x, y },
    });
    window.dispatchEvent(event);
  }

  /**
   * Update joystick visual
   */
  private _updateJoystickVisual(): void {
    if (!this._joystick) return;

    const dx = this._joystick.currentX - this._joystick.originX;
    const dy = this._joystick.currentY - this._joystick.originY;

    const event = new CustomEvent('joystick-move', {
      detail: { dx, dy },
    });
    window.dispatchEvent(event);
  }

  /**
   * Remove joystick visual
   */
  private _removeJoystick(): void {
    if (this._joystick) {
      const event = new CustomEvent('joystick-end');
      window.dispatchEvent(event);
      this._joystick = null;
    }
  }

  /**
   * Update input state and notify listeners
   */
  private _updateInputState(): void {
    const engine = this._game.getEngine();
    const renderSystem = engine.getSystemManager().getSystem<any>('render');

    if (renderSystem) {
      let targetX: number;
      let targetY: number;

      // If we have active joystick input (from MobileTouchControls), use that
      if (this._joystick && this._joystick.active) {
        // Get player's current world position and angle
        const playerId = this._game.getPlayerId();
        if (!playerId) return;
        const playerEntity = engine.getEntityManager().getEntity(playerId);
        if (playerEntity) {
          const position = playerEntity.getComponent<Position>(ComponentNames.POSITION);
          const velocity = playerEntity.getComponent<Velocity>(ComponentNames.VELOCITY);

          if (position) {
            // Calculate joystick direction angle
            const joystickAngle = Math.atan2(this._joystick.currentY, this._joystick.currentX);
            const joystickDist = Math.sqrt(this._joystick.currentX ** 2 + this._joystick.currentY ** 2);

            // If joystick is near center (not being pushed), maintain current direction
            if (joystickDist < 5) {
              // Use current velocity angle or default to 0 (right)
              const currentAngle = velocity?.angle ?? 0;
              const targetDistance = 500; // Set target 500px ahead in current direction
              targetX = position.x + Math.cos(currentAngle) * targetDistance;
              targetY = position.y + Math.sin(currentAngle) * targetDistance;
            } else {
              // Set target position in the direction of joystick input
              // Use a large enough distance so the sperm has a clear target
              const targetDistance = 500;
              targetX = position.x + Math.cos(joystickAngle) * targetDistance;
              targetY = position.y + Math.sin(joystickAngle) * targetDistance;
            }
          } else {
            // Fallback to mouse position
            const worldPos = renderSystem.screenToWorld(this._mousePosition.x, this._mousePosition.y);
            targetX = worldPos.x;
            targetY = worldPos.y;
          }
        } else {
          // Fallback to mouse position
          const worldPos = renderSystem.screenToWorld(this._mousePosition.x, this._mousePosition.y);
          targetX = worldPos.x;
          targetY = worldPos.y;
        }
      } else {
        // Use mouse/touch position for non-joystick input
        const worldPos = renderSystem.screenToWorld(this._mousePosition.x, this._mousePosition.y);
        targetX = worldPos.x;
        targetY = worldPos.y;
      }

      this._currentState = {
        targetX,
        targetY,
        accelerate: true,
        boost: this._isBoosting,
        timestamp: Date.now(),
      };

      this._onInputChange(this._currentState);
    }
  }
}

/**
 * Factory function
 */
export function createInputHandler(config: InputHandlerConfig): InputHandler {
  return new InputHandler(config);
}
