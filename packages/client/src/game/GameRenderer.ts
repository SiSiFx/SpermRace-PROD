import * as PIXI from 'pixi.js';
import { Arena, Theme, isMobileDevice, isPortraitMobile } from './types';

export interface GameRendererConfig {
  container: HTMLElement;
  theme: Theme;
}

export class GameRenderer {
  private app: PIXI.Application | null = null;
  private config: GameRendererConfig;
  
  public arena: Arena;
  public worldContainer!: PIXI.Container;
  public trailContainer!: PIXI.Container;
  public decorContainer!: PIXI.Container;
  public pickupsContainer!: PIXI.Container;
  public boostPadsContainer!: PIXI.Container;
  public artifactContainer!: PIXI.Container;
  public borderGraphics!: PIXI.Graphics;
  public borderOverlay!: PIXI.Graphics;
  public gridGraphics!: PIXI.Graphics;
  
  private cleanupFunctions: (() => void)[] = [];
  private ambientParticles: PIXI.Graphics[] = [];

  constructor(config: GameRendererConfig) {
    this.config = config;
    
    // Portrait mobile gets narrower arena
    this.arena = isPortraitMobile()
      ? { width: 3500, height: 7700 }
      : { width: 8000, height: 6000 };
  }

  async init(): Promise<PIXI.Application> {
    const width = this.config.container.clientWidth || window.innerWidth;
    const height = this.config.container.clientHeight || window.innerHeight;
    
    const isMobile = isMobileDevice();
    const isAndroid = /Android/i.test(navigator.userAgent);
    const rawPixelRatio = window.devicePixelRatio || 1;
    const resolution = isAndroid ? Math.min(rawPixelRatio, 1.5) : Math.min(rawPixelRatio, 2);
    
    this.app = new PIXI.Application();
    await this.app.init({
      width,
      height,
      backgroundColor: 0x030712,
      resolution,
      autoDensity: true,
      antialias: !isMobile,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
    });
    
    this.config.container.appendChild(this.app.canvas);
    
    // Setup resize handler
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    this.cleanupFunctions.push(() => window.removeEventListener('resize', onResize));
    
    // Visibility handling
    const onVis = () => {
      try {
        const hidden = document.hidden;
        const tk = (this.app as any)?.ticker;
        if (tk) {
          if (hidden) tk.stop?.(); else tk.start?.();
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanupFunctions.push(() => document.removeEventListener('visibilitychange', onVis));
    
    return this.app;
  }

  setupWorld() {
    if (!this.app) return;
    
    // Create world container
    this.worldContainer = new PIXI.Container();
    this.worldContainer.sortableChildren = true;
    this.app.stage.addChild(this.worldContainer);
    
    // Border graphics
    this.borderGraphics = new PIXI.Graphics();
    (this.borderGraphics as any).zIndex = 1000;
    this.worldContainer.addChild(this.borderGraphics);
    
    // Grid
    this.createGrid();
    
    // Decor layer
    this.decorContainer = new PIXI.Container();
    this.worldContainer.addChild(this.decorContainer);
    try { (this.decorContainer as any).zIndex = 5; } catch {}
    
    // Trail container
    this.trailContainer = new PIXI.Container();
    this.trailContainer.visible = true;
    this.trailContainer.alpha = 1.0;
    this.worldContainer.addChild(this.trailContainer);
    try { (this.trailContainer as any).zIndex = 20; } catch {}
    
    // Pickups container
    this.pickupsContainer = new PIXI.Container();
    this.pickupsContainer.visible = false;
    this.worldContainer.addChild(this.pickupsContainer);
    
    // Ambient particles
    this.createAmbientParticles();
    
    // Boost pads container
    this.boostPadsContainer = new PIXI.Container();
    this.worldContainer.addChild(this.boostPadsContainer);
    
    // Artifacts container
    this.artifactContainer = new PIXI.Container();
    this.artifactContainer.visible = false;
    this.worldContainer.addChild(this.artifactContainer);
    
    // Draw border
    this.drawArenaBorder();
    
    // Screen-space border overlay
    try {
      this.borderOverlay = new PIXI.Graphics();
      this.app.stage.addChild(this.borderOverlay);
    } catch {}
  }

  private createGrid() {
    const gridSize = 160;
    this.gridGraphics = new PIXI.Graphics();
    
    // Vertical lines
    for (let x = -this.arena.width / 2; x <= this.arena.width / 2; x += gridSize) {
      this.gridGraphics
        .moveTo(x, -this.arena.height / 2)
        .lineTo(x, this.arena.height / 2);
    }
    
    // Horizontal lines
    for (let y = -this.arena.height / 2; y <= this.arena.height / 2; y += gridSize) {
      this.gridGraphics
        .moveTo(-this.arena.width / 2, y)
        .lineTo(this.arena.width / 2, y);
    }
    
    this.gridGraphics.stroke({ 
      width: 1, 
      color: this.config.theme.grid, 
      alpha: this.config.theme.gridAlpha 
    });
    
    // Hide grid on mobile
    this.gridGraphics.visible = !isMobileDevice();
    try { (this.gridGraphics as any).zIndex = 1; } catch {}
    
    this.worldContainer.addChild(this.gridGraphics);
  }

  private createAmbientParticles() {
    const isMobile = isMobileDevice();
    const particleCount = isMobile ? 15 : 40;
    const colors = [0x22d3ee, 0x6366f1];
    
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * this.arena.width;
      const y = (Math.random() - 0.5) * this.arena.height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 3;
      
      const particle = new PIXI.Graphics();
      particle.circle(0, 0, size).fill({ color, alpha: 0.3 });
      particle.x = x;
      particle.y = y;
      
      (particle as any).baseY = y;
      (particle as any).floatSpeed = 0.3 + Math.random() * 0.5;
      (particle as any).floatOffset = Math.random() * Math.PI * 2;
      
      this.worldContainer.addChild(particle);
      try { (particle as any).zIndex = 3; } catch {}
      
      this.ambientParticles.push(particle);
    }
  }

  updateAmbientParticles(time: number) {
    for (const particle of this.ambientParticles) {
      const p = particle as any;
      if (p.baseY !== undefined) {
        particle.y = p.baseY + Math.sin(time * p.floatSpeed + p.floatOffset) * 10;
      }
    }
  }

  drawArenaBorder() {
    if (!this.borderGraphics) return;
    
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;
    const g = this.borderGraphics;
    g.clear();

    // Outer glowing border
    g.rect(-halfW, -halfH, this.arena.width, this.arena.height)
      .stroke({ width: 4, color: 0x22d3ee, alpha: 0.6 });

    // Middle border
    const inset1 = 3;
    g.rect(-halfW + inset1, -halfH + inset1, this.arena.width - inset1 * 2, this.arena.height - inset1 * 2)
      .stroke({ width: 2, color: 0x00ffff, alpha: 0.4 });

    // Inner crisp edge
    const inset2 = 6;
    g.rect(-halfW + inset2, -halfH + inset2, this.arena.width - inset2 * 2, this.arena.height - inset2 * 2)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
  }

  drawBorderOverlay(camera: { x: number; y: number; zoom: number }) {
    if (!this.borderOverlay || !this.app) return;
    
    const g = this.borderOverlay;
    g.clear();
    
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;
    const zoom = camera.zoom;
    
    // Convert world corners to screen
    const toScreen = (wx: number, wy: number) => ({
      x: wx * zoom + camera.x,
      y: wy * zoom + camera.y
    });
    
    const tl = toScreen(-halfW, -halfH);
    const tr = toScreen(halfW, -halfH);
    const br = toScreen(halfW, halfH);
    const bl = toScreen(-halfW, halfH);
    
    // Draw crisp screen-space border
    g.moveTo(tl.x, tl.y)
      .lineTo(tr.x, tr.y)
      .lineTo(br.x, br.y)
      .lineTo(bl.x, bl.y)
      .closePath()
      .stroke({ width: 2, color: 0x22d3ee, alpha: 0.8 });
  }

  resize() {
    if (!this.app) return;
    
    const width = this.config.container.clientWidth || window.innerWidth;
    const height = this.config.container.clientHeight || window.innerHeight;
    
    this.app.renderer.resize(width, height);
    this.drawArenaBorder();
  }

  getApp(): PIXI.Application | null {
    return this.app;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.app?.canvas || null;
  }

  destroy() {
    // Run cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    
    // Destroy containers
    try { this.worldContainer?.destroy?.({ children: true }); } catch {}
    try { this.trailContainer?.destroy?.({ children: true }); } catch {}
    
    // Destroy app
    if (this.app) {
      try {
        const canvas = this.app.canvas;
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        this.app.destroy(true, { children: true, texture: true });
      } catch {}
      this.app = null;
    }
  }
}
