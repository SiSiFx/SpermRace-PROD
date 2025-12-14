import * as PIXI from 'pixi.js';
import type { Camera, Car, Arena, PreStart, WsHud } from './types';
import { isMobileDevice } from './types';

export interface CameraControllerConfig {
  arena: Arena;
  cameraSmoothing?: number;
}

export class CameraController {
  private config: CameraControllerConfig;
  private shakeIntensity = 0;
  private shakeFrequency = 0;
  private shakePhase = 0;
  
  public camera: Camera;

  constructor(config: CameraControllerConfig) {
    this.config = config;
    
    const isPortrait = typeof window !== 'undefined' && 
                       window.innerHeight > window.innerWidth && 
                       window.innerWidth < 768;
    const defaultZoom = isPortrait ? 0.45 : 0.55;
    
    this.camera = {
      x: 0,
      y: 0,
      zoom: defaultZoom,
      targetZoom: defaultZoom,
      minZoom: 0.2,
      maxZoom: 1.5,
      shakeX: 0,
      shakeY: 0,
      shakeDecay: 0.85,
    };
  }

  screenShake(intensity: number = 1, frequency: number = 30) {
    // Enhanced screen shake with frequency and intensity control
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity * 4, 15);
    this.shakeFrequency = frequency;
    this.shakePhase = 0;
  }

  // Get screen shake offset for particle system integration
  getScreenShakeOffset(): { x: number; y: number } {
    if (this.shakeIntensity <= 0) return { x: 0, y: 0 };
    
    this.shakePhase += this.shakeFrequency * 0.016; // Assuming 60fps
    
    const offsetX = Math.sin(this.shakePhase) * this.shakeIntensity * 0.3;
    const offsetY = Math.cos(this.shakePhase * 1.3) * this.shakeIntensity * 0.3;
    
    // Apply some randomness
    const randomX = (Math.random() - 0.5) * this.shakeIntensity * 0.4;
    const randomY = (Math.random() - 0.5) * this.shakeIntensity * 0.4;
    
    return {
      x: offsetX + randomX,
      y: offsetY + randomY
    };
  }

  update(
    player: Car | null,
    bots: Car[],
    screenWidth: number,
    screenHeight: number,
    preStart: PreStart | null,
    wsHud: WsHud | null
  ) {
    if (!player) return;
    
    const isMobile = isMobileDevice();
    const inCountdown = !!preStart;
    
    // Calculate target zoom
    if (!inCountdown) {
      this.updateTargetZoom(player, bots, isMobile);
    }
    
    // Smooth zoom transition
    const zoomSpeed = isMobile ? 0.03 : 0.025;
    if (preStart && this.getCountdownRemaining(preStart) > 2000) {
      this.camera.zoom = this.camera.targetZoom;
    } else {
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * zoomSpeed;
    }
    
    // Calculate desired center
    let desiredCenterX = player.x;
    let desiredCenterY = player.y;
    
    if (preStart) {
      const remain = this.getCountdownRemaining(preStart);
      if (remain > 2500) {
        // Overview: center on arena
        desiredCenterX = 0;
        desiredCenterY = 0;
      }
    }
    
    // Calculate camera position
    const halfW = this.config.arena.width / 2;
    const halfH = this.config.arena.height / 2;
    
    let targetCamX = -desiredCenterX * this.camera.zoom + screenWidth / 2;
    let targetCamY = -desiredCenterY * this.camera.zoom + screenHeight / 2;
    
    // Clamp camera bounds
    const countdownRemain = preStart ? this.getCountdownRemaining(preStart) : 0;
    const isTournament = !!(wsHud && wsHud.active);
    const shouldClamp = isTournament && countdownRemain === 0;
    
    if (shouldClamp) {
      let minCamX = screenWidth - halfW * this.camera.zoom;
      let maxCamX = halfW * this.camera.zoom;
      let minCamY = screenHeight - halfH * this.camera.zoom;
      let maxCamY = halfH * this.camera.zoom;
      
      if (minCamX > maxCamX) { minCamX = maxCamX = screenWidth / 2; }
      if (minCamY > maxCamY) { minCamY = maxCamY = screenHeight / 2; }
      
      targetCamX = Math.max(minCamX, Math.min(maxCamX, targetCamX));
      targetCamY = Math.max(minCamY, Math.min(maxCamY, targetCamY));
    }
    
    // Smooth follow
    const baseSmoothness = isMobile ? 0.15 : (this.config.cameraSmoothing || 0.10);
    const followSmooth = preStart ? 1.0 : baseSmoothness;
    
    this.camera.x += (targetCamX - this.camera.x) * followSmooth;
    this.camera.y += (targetCamY - this.camera.y) * followSmooth;
    
    // Enhanced screen shake with decay
    const shakeOffset = this.getScreenShakeOffset();
    this.camera.shakeX = shakeOffset.x;
    this.camera.shakeY = shakeOffset.y;
    
    // Decay shake intensity
    this.shakeIntensity *= this.camera.shakeDecay;
    if (this.shakeIntensity < 0.1) this.shakeIntensity = 0;
  }

  private updateTargetZoom(player: Car, bots: Car[], isMobile: boolean) {
    // Count nearby enemies for crowd-based zoom
    const nearbyRadius = 600;
    let nearbyCount = 0;
    
    for (const bot of bots) {
      if (!bot.destroyed) {
        const dx = bot.x - player.x;
        const dy = bot.y - player.y;
        if (dx * dx + dy * dy < nearbyRadius * nearbyRadius) {
          nearbyCount++;
        }
      }
    }
    
    const crowdFactor = Math.min(1, nearbyCount / 8);
    const baseZoom = isMobile ? 0.55 : 0.75;
    
    // Boost zoom effect
    if (player.isBoosting) {
      const boostZoom = isMobile ? 0.65 : 0.85;
      this.camera.targetZoom = boostZoom;
    } else {
      const out = isMobile ? 0.05 * crowdFactor : 0.15 * crowdFactor;
      const target = baseZoom - out;
      this.camera.targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, target));
    }
  }

  updateCountdownZoom(preStart: PreStart, screenWidth: number, screenHeight: number, arenaWidth: number, arenaHeight: number, isMobile: boolean) {
    const remain = this.getCountdownRemaining(preStart);
    
    if (remain > 2500) {
      // Overview: fit entire arena
      const fitW = screenWidth / (arenaWidth + 400);
      const fitH = screenHeight / (arenaHeight + 400);
      this.camera.targetZoom = Math.max(0.15, Math.min(fitW, fitH));
    } else {
      // Zoom to player
      const baseZoom = isMobile ? 0.55 : 0.75;
      this.camera.targetZoom = baseZoom;
    }
  }

  private getCountdownRemaining(preStart: PreStart): number {
    return Math.max(0, preStart.durationMs - (Date.now() - preStart.startAt));
  }

  applyToContainer(worldContainer: PIXI.Container) {
    worldContainer.x = Math.round(this.camera.x + this.camera.shakeX);
    worldContainer.y = Math.round(this.camera.y + this.camera.shakeY);
    worldContainer.scale.set(this.camera.zoom);
  }

  setZoom(delta: number) {
    this.camera.targetZoom = Math.max(
      this.camera.minZoom,
      Math.min(this.camera.maxZoom, this.camera.targetZoom + delta)
    );
  }

  snapToPlayer(player: Car, screenWidth: number, screenHeight: number) {
    const zoom = this.camera.targetZoom;
    this.camera.zoom = zoom;
    this.camera.x = -player.x * zoom + screenWidth / 2;
    this.camera.y = -player.y * zoom + screenHeight / 2;
  }

  getCamera(): Camera {
    return this.camera;
  }
}
