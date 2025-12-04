import * as PIXI from 'pixi.js';
import { logger } from '../utils/logger';

export interface InputState {
  keys: Record<string, boolean>;
  mouse: { x: number; y: number };
  touch: { active: boolean; x: number; y: number; lastTap: number };
}

export interface InputHandlerCallbacks {
  onStartBoost: () => void;
  onStopBoost: () => void;
  onZoom: (delta: number) => void;
  isPreStart: () => boolean;
}

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0 };
  private touch = { active: false, x: 0, y: 0, lastTap: 0 };
  private cleanupFunctions: (() => void)[] = [];
  private callbacks: InputHandlerCallbacks;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, callbacks: InputHandlerCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
  }

  getState(): InputState {
    return {
      keys: this.keys,
      mouse: this.mouse,
      touch: this.touch,
    };
  }

  setup() {
    this.setupKeyboard();
    this.setupMouse();
    this.setupTouch();
    this.setupWheel();
    this.setupMobileControls();
  }

  private setupKeyboard() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.cleanupFunctions.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });
  }

  private setupMouse() {
    const onMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    };
    
    window.addEventListener('mousemove', onMouseMove);
    this.cleanupFunctions.push(() => window.removeEventListener('mousemove', onMouseMove));
  }

  private setupTouch() {
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const now = Date.now();

      this.touch.active = true;
      this.touch.x = touch.clientX - rect.left;
      this.touch.y = touch.clientY - rect.top;

      // Two-finger tap = boost
      if (e.touches.length === 2) {
        this.callbacks.onStartBoost();
        try { navigator.vibrate?.(50); } catch {}
      }
      // Double tap detection for boost (fallback)
      else if (now - this.touch.lastTap < 300) {
        this.callbacks.onStartBoost();
        try { navigator.vibrate?.(50); } catch {}
      }
      this.touch.lastTap = now;
    };
    
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (this.touch.active && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.touch.x = touch.clientX - rect.left;
        this.touch.y = touch.clientY - rect.top;
      }
    };
    
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      this.touch.active = false;
    };
    
    this.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    this.cleanupFunctions.push(() => {
      this.canvas.removeEventListener('touchstart', onTouchStart);
      this.canvas.removeEventListener('touchmove', onTouchMove);
      this.canvas.removeEventListener('touchend', onTouchEnd);
    });
  }

  private setupWheel() {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const zoomDelta = -e.deltaY * zoomSpeed;
      this.callbacks.onZoom(zoomDelta);
    };
    
    window.addEventListener('wheel', onWheel, { passive: false });
    this.cleanupFunctions.push(() => window.removeEventListener('wheel', onWheel));
  }

  private setupMobileControls() {
    const onMobileJoystick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const scale = 4;
      const targetX = centerX + (detail.x * scale);
      const targetY = centerY + (detail.y * scale);
      
      if (this.touch.active) {
        this.touch.x = this.touch.x * 0.4 + targetX * 0.6;
        this.touch.y = this.touch.y * 0.4 + targetY * 0.6;
      } else {
        this.touch.x = targetX;
        this.touch.y = targetY;
      }
      this.touch.active = true;
    };
    
    const onMobileBoost = () => {
      if (this.callbacks.isPreStart()) {
        logger.debug('[BOOST] Blocked during countdown');
        return;
      }
      this.callbacks.onStartBoost();
    };
    
    window.addEventListener('mobile-joystick', onMobileJoystick as EventListener);
    window.addEventListener('mobile-boost', onMobileBoost);
    this.cleanupFunctions.push(() => {
      window.removeEventListener('mobile-joystick', onMobileJoystick as EventListener);
      window.removeEventListener('mobile-boost', onMobileBoost);
    });
  }

  // Check if a specific key is pressed
  isKeyPressed(code: string): boolean {
    return this.keys[code] === true;
  }

  // Check boost key (Space or Shift)
  isBoostKeyPressed(): boolean {
    return this.keys['Space'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'];
  }

  destroy() {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}
