import * as PIXI from 'pixi.js';

export class Camera {
  x = 0;
  y = 0;
  zoom = 0.55;
  targetZoom = 0.55;
  shakeX = 0;
  shakeY = 0;
  private shakeDecay = 0.85;
  private smoothing = 0.10;

  update(
    target: { x: number; y: number; speed?: number } | null,
    worldContainer: PIXI.Container,
    screenWidth: number,
    screenHeight: number
  ): void {
    if (target) {
      // Speed-based zoom
      const speed = target.speed || 200;
      this.targetZoom = 0.8 - (speed / 1000);
      this.targetZoom = Math.max(0.4, Math.min(0.8, this.targetZoom));

      // Smooth zoom
      this.zoom += (this.targetZoom - this.zoom) * 0.05;

      // Camera follow
      const targetCamX = -target.x * this.zoom;
      const targetCamY = -target.y * this.zoom;
      this.x += (targetCamX - this.x) * this.smoothing;
      this.y += (targetCamY - this.y) * this.smoothing;
    }

    // Apply shake
    const finalX = this.x + this.shakeX;
    const finalY = this.y + this.shakeY;
    this.shakeX *= this.shakeDecay;
    this.shakeY *= this.shakeDecay;

    // Update world container
    worldContainer.x = screenWidth / 2 + finalX;
    worldContainer.y = screenHeight / 2 + finalY;
    worldContainer.scale.set(this.zoom);
  }

  shake(intensity: number = 1): void {
    this.shakeX = (Math.random() - 0.5) * 12 * intensity;
    this.shakeY = (Math.random() - 0.5) * 12 * intensity;
  }

  worldToScreen(wx: number, wy: number, screenW: number, screenH: number): { x: number; y: number } {
    return {
      x: wx * this.zoom + this.x + screenW / 2,
      y: wy * this.zoom + this.y + screenH / 2
    };
  }
}
