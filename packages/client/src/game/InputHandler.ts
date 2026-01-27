import { InputState } from './types';

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0 };
  private touch = { active: false, x: 0, y: 0 };
  private cleanupFns: (() => void)[] = [];

  setup(canvas: HTMLCanvasElement): void {
    const onKeyDown = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
    const onMouseMove = (e: MouseEvent) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        this.touch.active = true;
        this.touch.x = e.touches[0].clientX;
        this.touch.y = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        this.touch.x = e.touches[0].clientX;
        this.touch.y = e.touches[0].clientY;
      }
    };
    const onTouchEnd = () => { this.touch.active = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    this.cleanupFns.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => canvas.removeEventListener('mousemove', onMouseMove),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd)
    );
  }

  getInput(playerX: number, playerY: number, cameraX: number, cameraY: number, zoom: number, screenW: number, screenH: number): InputState {
    let targetX = playerX;
    let targetY = playerY;

    if (this.touch.active) {
      targetX = (this.touch.x - screenW / 2 - cameraX) / zoom;
      targetY = (this.touch.y - screenH / 2 - cameraY) / zoom;
    } else {
      targetX = (this.mouse.x - screenW / 2 - cameraX) / zoom;
      targetY = (this.mouse.y - screenH / 2 - cameraY) / zoom;
    }

    return {
      targetX,
      targetY,
      accelerate: this.keys['w'] || this.keys['arrowup'] || this.touch.active,
      boost: !!(this.keys[' '] || this.keys['shift'] || this.keys['Shift'])
    };
  }

  destroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}
