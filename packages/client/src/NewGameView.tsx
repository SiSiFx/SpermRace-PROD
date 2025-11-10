import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useWs } from './WsProvider';

interface Car {
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  baseSpeed: number;
  boostSpeed: number;
  targetSpeed: number;
  speedTransitionRate: number;
  driftFactor: number;
  maxDriftFactor: number;
  vx: number;
  vy: number;
  color: number;
  type: string;
  id: string;
  name: string;
  kills: number;
  destroyed: boolean;
  respawnTimer: number;
  isBoosting: boolean;
  boostTimer: number;
  boostCooldown: number;
  boostEnergy: number;
  maxBoostEnergy: number;
  boostRegenRate: number;
  boostConsumptionRate: number;
  minBoostEnergy: number;
  trailPoints: any[];
  trailGraphics: PIXI.Graphics | null;
  lastTrailTime: number;
  turnTimer: number;
  boostAITimer: number;
  currentTrailId: string | null;
  lastTrailBoostStatus: boolean | undefined;
  sprite: PIXI.Container;
  // Sperm visuals
  headGraphics?: PIXI.Graphics;
  tailGraphics?: PIXI.Graphics | null;
  tailWaveT?: number;
  tailLength?: number;
  tailSegments?: number;
  tailAmplitude?: number;
  nameplate?: HTMLDivElement;
  outZoneTime?: number;
  elimAtMs?: number;
  turnResponsiveness?: number;
  lateralDragScalar?: number;
  tailColor?: number;
}

interface Trail {
  carId: string;
  car: Car;
  points: Array<{ x: number; y: number; time: number; isBoosting: boolean }>;
  graphics: PIXI.Graphics;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  graphics: PIXI.Graphics;
}

interface Pickup {
  x: number;
  y: number;
  radius: number;
  type: 'energy';
  amount: number; // boost energy restored
  graphics: PIXI.Container;
  shape: PIXI.Graphics;
  aura: PIXI.Graphics;
  pulseT: number;
  rotationSpeed: number;
  color: number;
}

interface RadarPing {
  x: number;
  y: number;
  timestamp: number;
  playerId: string;
  kind?: 'sweep' | 'echo' | 'bounty';
  ttlMs?: number;
}

interface BoostPad {
  x: number; y: number; radius: number;
  cooldownMs: number; lastTriggeredAt: number;
  graphics: PIXI.Graphics;
}

class SpermRaceGame {
  public app: PIXI.Application | null = null;
  public arena = (() => {
    // Portrait mobile: Match iPhone aspect ratio better
    const isPortraitMobile = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 768;
    // iPhone aspect ~1:2.2, use 3500x7700 for better fit (narrower for mobile)
    return isPortraitMobile ? { width: 3500, height: 7700 } : { width: 8000, height: 6000 };
  })();
  public player: Car | null = null;
  public bot: Car | null = null;
  public extraBots: Car[] = [];
  public trails: Trail[] = [];
  public particles: Particle[] = [];
  public pickups: Pickup[] = [];
  public artifactContainer!: PIXI.Container;
  public boostPads: BoostPad[] = [];
  public keys: { [key: string]: boolean } = {};
  public mouse = { x: 0, y: 0 };
  public touch = { active: false, x: 0, y: 0, lastTap: 0 };
  public trailActive = false;
  public trailCooldown = 0;
  public trailDuration = 0;
  public camera = (() => {
    // Portrait mobile: Zoom out more to see the narrow arena better
    const isPortraitMobile = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 768;
    const defaultZoom = isPortraitMobile ? 0.6 : 0.8;
    return { 
      x: 0, y: 0, 
      zoom: defaultZoom, targetZoom: defaultZoom, 
      minZoom: 0.2, maxZoom: 1.5,
      // Screen shake for juicy feedback
      shakeX: 0, shakeY: 0, shakeDecay: 0.85
    };
  })();
  public cameraSmoothing: number = 0.10;
  // removed unused camSmooth
  public radarAngle = 0;
  public worldContainer!: PIXI.Container;
  public trailContainer!: PIXI.Container;
  public decorContainer!: PIXI.Container;
  public pickupsContainer!: PIXI.Container;
  public boostPadsContainer!: PIXI.Container;
  public solanaTexture!: PIXI.Texture;
  public radar!: HTMLCanvasElement;
  public radarCtx!: CanvasRenderingContext2D;
  private container: HTMLElement;
  private cleanupFunctions: (() => void)[] = [];
  
  // Visual toggles
  public smallTailEnabled: boolean = false; // disable near-head tail; keep only big gameplay trail
  
  // Battle Royale & Sonar system
  public radarPings: RadarPing[] = [];
  public echoPings: RadarPing[] = [];
  public alivePlayers: number = 0;
  public gamePhase: 'waiting' | 'active' | 'finished' = 'active';
  public gameStartTime: number = Date.now();
  public pickupsUnlocked: boolean = false;
  public artifactsUnlocked: boolean = false;
  public unlockPickupsAfterMs: number = 25000;
  public unlockArtifactsAfterMs: number = 15000;
  
  // UI container for game elements
  public uiContainer!: HTMLDivElement;
  public leaderboardContainer!: HTMLDivElement;
  public killFeedContainer!: HTMLDivElement;
  public recentKills: Array<{ killer: string; victim: string; time: number }>=[];
  private lastToastAt: number = 0;
  public killStreak: number = 0;
  public lastKillTime: number = 0;
  public killStreakNotifications: Array<{ text: string; time: number; x: number; y: number }> = [];
  
  // Combo system for addictive gameplay
  public comboMultiplier: number = 1;
  public comboKills: number = 0;
  public lastComboTime: number = 0;
  public comboWindowMs: number = 5000; // 5s window to maintain combo
  
  // Near-miss detection for skill rewards
  public nearMisses: Array<{ text: string; time: number; x: number; y: number }> = [];
  
  private easeOutBack(t: number): number { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  public overviewCanvas: HTMLCanvasElement | null = null;
  public overviewCtx: CanvasRenderingContext2D | null = null;
  public emotes: Array<{ el: HTMLDivElement; car: Car; expiresAt: number }> = [];
  public spawnQueue: Array<{ x: number; y: number; angle: number }> = [];
  public spawnQueueIndex: number = 0;
  public spawnBounds: { left: number; right: number; top: number; bottom: number } = { left: 0, right: 0, top: 0, bottom: 0 };
  public preStart: { startAt: number; durationMs: number } | null = null;
  // Debug
  public debugEnabled: boolean = (() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('debug') === '1') return true;
      if (qs.get('debug') === '0') return false;
      const ls = window.localStorage.getItem('SR_DEBUG');
      if (ls === '1' || ls === 'true') return true;
      if (ls === '0' || ls === 'false') return false;
    } catch {}
    return ((import.meta as any).env?.DEV === true);
  })();
  private lastVisCheckAt: number = 0;
  
  // Mobile FPS limiting (cap at 60 FPS to prevent overheating)
  private lastFrameTime: number = 0;
  private frameInterval: number = 1000 / 60; // 16.67ms per frame
  
  // Particle object pooling (prevent memory leaks)
  private particlePool: PIXI.Graphics[] = [];
  private maxPoolSize: number = 100;
  
  // Radar update throttling (mobile optimization)
  private lastRadarUpdate: number = 0;
  private radarUpdateInterval: number = 50; // Update every 50ms (~20fps) instead of 60fps
  
  // Seeded RNG for procedural generation
  public seed: number = Math.floor(Math.random() * 1e9);
  // rngState removed (unused)

  // Tournament HUD data (from WsProvider)
  public wsHud: {
    active: boolean;
    kills: Record<string, number>;
    killFeed: Array<{ killerId?: string; victimId: string; ts: number }>;
    playerId?: string | null;
    idToName: Record<string, string>;
    aliveSet: Set<string>;
    eliminationOrder: string[];
    // bounty removed
  } | null = null;
  public debugCollisions: Array<{ victimId: string; killerId?: string; hit: { x: number; y: number }; segment?: { from: { x: number; y: number }; to: { x: number; y: number } }; ts: number }> = [];

  // Zone (BR shrink)
  public zone = {
    centerX: 0,
    centerY: 0,
    startRadius: 0,
    endRadius: 140,
    startAtMs: 0,
    durationMs: 90000,
  };
  public zoneGraphics: PIXI.Graphics | null = null;
  public borderGraphics: PIXI.Graphics | null = null;
  public borderOverlay: PIXI.Graphics | null = null;
  public gridGraphics: PIXI.Graphics | null = null;
  public rectZone: {
    left: number; right: number; top: number; bottom: number;
    nextSliceAt: number; sliceIntervalMs: number; telegraphMs: number;
    pendingSide: 'left' | 'right' | 'top' | 'bottom' | null;
    lastSide: 'left' | 'right' | 'top' | 'bottom' | null;
    minWidth: number; minHeight: number; sliceStep: number;
  } = {
    left: 0, right: 0, top: 0, bottom: 0,
    nextSliceAt: 0, sliceIntervalMs: 2400, telegraphMs: 1400,
    pendingSide: null, lastSide: null,
    minWidth: 1200, minHeight: 1200, sliceStep: 300,
  };
  public firstSliceSide: 'left' | 'right' | 'top' | 'bottom' | null = null;
  private sliceIndex: number = 0;
  private daySeed: number = 0;
  private slicePattern: Array<'left'|'right'|'top'|'bottom'> = [];

  // JUICE METHODS - Make game feel amazing!
  private screenShake(intensity: number = 1) {
    // Shake intensity: 1 = normal, 2 = strong, 3 = mega
    this.camera.shakeX = (Math.random() - 0.5) * 20 * intensity;
    this.camera.shakeY = (Math.random() - 0.5) * 20 * intensity;
  }

  private hapticFeedback(pattern: 'light' | 'medium' | 'heavy' | 'success' | 'warning') {
    try {
      if (!navigator.vibrate) return;
      
      switch (pattern) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(30);
          break;
        case 'heavy':
          navigator.vibrate([50, 30, 50]);
          break;
        case 'success':
          navigator.vibrate([30, 20, 50]);
          break;
        case 'warning':
          navigator.vibrate([20, 10, 20, 10, 20]);
          break;
      }
    } catch {}
  }

  private showComboNotification(x: number, y: number, combo: number) {
    const texts = [
      '', // 0
      '', // 1
      '🔥 DOUBLE KILL', // 2
      '💥 TRIPLE KILL', // 3
      '⚡ MEGA KILL', // 4
      '🌟 ULTRA KILL', // 5
      '👑 RAMPAGE', // 6+
    ];
    const text = combo >= texts.length ? `👑 ${combo}x RAMPAGE!` : texts[combo];
    if (text) {
      this.killStreakNotifications.push({ text, time: Date.now(), x, y });
      
      // CRAZY COMBO EFFECTS!
      const intensity = Math.min(combo, 6); // Cap at 6 for sanity
      
      // Massive screen shake for combos
      this.screenShake(intensity * 0.8);
      
      // Camera zoom pulse - gets more intense with combo
      if (combo >= 3) {
        const zoomBoost = 1 + (intensity * 0.03); // Up to 18% zoom
        this.camera.targetZoom = Math.min(this.camera.zoom * zoomBoost, this.camera.maxZoom);
      }
      
      // Haptic goes wild
      if (combo >= 5) {
        this.hapticFeedback('heavy');
        // Extra vibration for insane combos
        setTimeout(() => { try { navigator.vibrate?.(50); } catch {} }, 100);
      } else if (combo >= 3) {
        this.hapticFeedback('success');
      } else {
        this.hapticFeedback('medium');
      }
      
      // Particle explosion burst for high combos
      if (combo >= 3 && this.player) {
        const particleCount = combo * 3; // More particles per combo level
        for (let i = 0; i < particleCount; i++) {
          const angle = (Math.PI * 2 * i) / particleCount;
          const speed = 100 + (combo * 20);
          this.particles.push({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: combo >= 5 ? 0xffaa00 : combo >= 4 ? 0xff6600 : 0xff3300,
            graphics: this.getParticle()
          });
        }
      }
    }
  }

  private showNearMiss(x: number, y: number, distance: number) {
    const texts = distance < 15 ? '😱 INSANE DODGE!' : distance < 25 ? '🎯 CLOSE CALL' : '+DODGED';
    this.nearMisses.push({ text: texts, time: Date.now(), x, y });
    this.hapticFeedback('light');
  }

  private computeDaySeed(): number {
    try {
      const d = new Date();
      const key = `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`;
      let h = 2166136261; // FNV-1a 32-bit
      for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
      return (h >>> 0) || Math.floor(Math.random()*1e9);
    } catch { return Math.floor(Math.random()*1e9); }
  }

  private buildSlicePattern(seed: number): Array<'left'|'right'|'top'|'bottom'> {
    // Deterministic, well-distributed pattern avoiding immediate repeats
    const sides: Array<'left'|'right'|'top'|'bottom'> = ['left','right','top','bottom'];
    // simple LCG
    let st = (seed ^ 0x9e3779b9) >>> 0;
    const rnd = () => { st = (1664525 * st + 1013904223) >>> 0; return st / 0xffffffff; };
    const out: Array<'left'|'right'|'top'|'bottom'> = [];
    let last: 'left'|'right'|'top'|'bottom' | null = null;
    for (let i = 0; i < 64; i++) {
      const opts: Array<'left'|'right'|'top'|'bottom'> = last
        ? (sides.filter(s => s !== last) as Array<'left'|'right'|'top'|'bottom'>)
        : (sides.slice() as Array<'left'|'right'|'top'|'bottom'>);
      const pick: 'left'|'right'|'top'|'bottom' = opts[Math.floor(rnd() * opts.length)];
      out.push(pick);
      last = pick;
    }
    return out;
  }
  
  // Theme colors loaded from CSS variables
  private theme = {
    accent: 0x22d3ee,
    grid: 0x2a2f38,
    gridAlpha: 0.08,
    border: 0x22d3ee,
    borderAlpha: 0.26,
    enemy: 0xff00ff,
    enemyGlow: 0xff6666,
    text: '#c7d2de'
  } as any;
  private loadThemeFromCSS() {
    try {
      const cs = getComputedStyle(document.documentElement);
      const toHex = (s: string) => {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return null as any;
        ctx.fillStyle = s;
        const c = ctx.fillStyle as string;
        const m = c.match(/^#([0-9a-f]{6})/i);
        if (m) return parseInt(m[1], 16);
        return null as any;
      };
      const accent = cs.getPropertyValue('--accent').trim() || cs.getPropertyValue('--primary').trim();
      const text = cs.getPropertyValue('--text-primary').trim() || '#c7d2de';
      const borderHex = toHex(accent) || this.theme.accent;
      this.theme = {
        accent: borderHex,
        grid: 0x2a2f38,
        gridAlpha: 0.08,
        border: borderHex,
        borderAlpha: 0.26,
        enemy: 0xff00ff,
        enemyGlow: 0xff6666,
        text
      } as any;
    } catch {}
  }
  
  // Callbacks for navigation
  public onReplay?: () => void;
  public onExit?: () => void;
  public notifiedServerEnd: boolean = false;

  constructor(container: HTMLElement, onReplay?: () => void, onExit?: () => void) {
    this.container = container;
    this.onReplay = onReplay;
    this.onExit = onExit;
  }

  private dbg(...args: any[]) {
    if (!this.debugEnabled) return;
    try { console.log('[GAME][DBG]', ...args); } catch {}
  }

  async init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    
    // High-quality rendering settings
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const rawPixelRatio = window.devicePixelRatio || 1;
    // Cap at 2x on mobile to prevent 3x (9x pixels) on high-end phones - massive performance boost
    const pixelRatio = isMobile ? Math.min(rawPixelRatio, 2) : rawPixelRatio;
    
    console.log('[RENDERER] Resolution:', pixelRatio, 'Device:', isMobile ? 'Mobile' : 'Desktop', 'Raw DPR:', rawPixelRatio);
    
    this.app = new PIXI.Application();
    await this.app.init({
      width,
      height,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: pixelRatio, // Capped at 2x on mobile (was causing 9x pixels on 3x devices)
      autoDensity: true, // Auto-adjust CSS to match resolution
      powerPreference: 'high-performance' // Use better GPU
    });
    this.loadThemeFromCSS();
    this.dbg('init', { width, height });
    // Pause ticker during initialization to avoid rendering half-built scene
    try { (this.app as any)?.ticker?.stop?.(); } catch {}
    // Ensure stage exists across Pixi versions
    try {
      const st = (this.app as any)?.stage;
      if (!st) { (this.app as any).stage = new PIXI.Container(); }
    } catch {}
    
    // Add canvas to container and make it focusable (guard across Pixi versions)
    const canvas = ((this.app as any)?.canvas
      || (this.app as any)?.renderer?.view
      || (this.app as any)?.view) as HTMLCanvasElement | undefined;
    if (canvas) {
      try { (canvas as any).tabIndex = 0; } catch {}
      try { (canvas as any).style.outline = 'none'; } catch {}
      try { (canvas as any).style.touchAction = 'none'; } catch {} // Prevent browser gestures (pinch, zoom, pull-to-refresh)
      try { if (!this.container.contains(canvas)) this.container.appendChild(canvas); } catch {}
    } else {
      // Fallback: create a canvas to avoid null deref; Pixi will still render to its internal view
      const fallback = document.createElement('canvas');
      try { fallback.width = width; fallback.height = height; fallback.style.outline = 'none'; fallback.style.touchAction = 'none'; } catch {}
      try { this.container.appendChild(fallback); } catch {}
    }
    
    // Auto-focus the canvas so keyboard input works immediately
    try { (canvas as any)?.focus?.(); } catch {}
    
    // Re-focus canvas when clicked to ensure keyboard input always works
    const refocusCanvas = () => { try { (canvas as any)?.focus?.(); } catch {} };
    try {
      canvas?.addEventListener?.('click', refocusCanvas);
      canvas?.addEventListener?.('mousedown', refocusCanvas);
      this.cleanupFunctions.push(() => {
        try { canvas?.removeEventListener?.('click', refocusCanvas); } catch {}
        try { canvas?.removeEventListener?.('mousedown', refocusCanvas); } catch {}
      });
    } catch {}

    // Create UI container for game-specific UI elements
    this.uiContainer = document.createElement('div');
    this.uiContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    `;
    this.container.appendChild(this.uiContainer);
    // Overview overlay canvas for countdown visibility
    this.overviewCanvas = document.createElement('canvas');
    this.overviewCanvas.id = 'game-overview-canvas';
    this.overviewCanvas.width = width;
    this.overviewCanvas.height = height;
    Object.assign(this.overviewCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', zIndex: '12', pointerEvents: 'none' });
    this.uiContainer.appendChild(this.overviewCanvas);
    this.overviewCtx = this.overviewCanvas.getContext('2d');
    
    // Setup the game world immediately
    this.setupWorld();
    this.dbg('setupWorld: done, stageChildren=', (this.app as any)?.stage?.children?.length);
    try { this.updateCamera(); } catch {}
    // Fallback: guarantee world container exists
    if (!this.worldContainer) {
      try {
        this.worldContainer = new PIXI.Container();
        (this.app as any)?.stage?.addChild?.(this.worldContainer);
      } catch {}
    }
    this.setupControls();
    // Mount HUD layers immediately
    this.setupRadar();
    this.setupZone();
    // Pre-spawn queue for spaced spawns and pre-start countdown
    this.spawnBounds = { left: -this.arena.width / 2, right: this.arena.width / 2, top: -this.arena.height / 2, bottom: this.arena.height / 2 };
    // Build more spawn points to accommodate extra bots without falling back to random edge spawns
    this.buildSpawnQueue(40);
    this.preStart = { startAt: Date.now(), durationMs: 5000 };
    this.dbg('spawnQueue[0..3]', this.spawnQueue.slice(0, 4));
    try { this.createPlayer(); } catch (e) { console.warn('createPlayer failed', e); }
    // Only create local dev bots in practice (when tournament HUD is not active)
    if (!(this.wsHud && this.wsHud.active)) {
      try { this.createBot(); } catch (e) { console.warn('createBot failed', e); }
    }
    this.createUI();

    // Handle window resize (throttled ~100ms)
    let __sr_lastResize = 0;
    const resizeHandler = () => {
      const nowTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (nowTs - __sr_lastResize < 100) return;
      __sr_lastResize = nowTs;
      this.resize();
    };
    window.addEventListener('resize', resizeHandler);
    this.cleanupFunctions.push(() => window.removeEventListener('resize', resizeHandler));
    
    // Start game loop after one microtask to ensure stage is fully assembled
    Promise.resolve().then(() => {
      try { (this.app as any)?.ticker?.add?.(() => this.gameLoop()); } catch {}
      try { (this.app as any)?.ticker?.start?.(); } catch {}
    });
  }

  resize() {
    if (!this.app) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.app.renderer.resize(width, height);
    try { this.drawArenaBorder(); } catch {}
    try {
      // Recreate grid to avoid blurry lines after zoom/resize
      if (this.gridGraphics && this.worldContainer) {
        try { this.worldContainer.removeChild(this.gridGraphics); } catch {}
      }
      this.createGrid();
    } catch {}
    this.updateCamera();
  }

  setupWorld() {
    if (!this.app) return;
    
    // Create world container and attach to stage (no visible rectangular frame)
    this.worldContainer = new PIXI.Container();
    this.worldContainer.sortableChildren = true;
    this.app.stage.addChild(this.worldContainer);
    
    // Create and add arena border graphics (drawn once and updated on resize/zoom if needed)
    this.borderGraphics = new PIXI.Graphics();
    (this.borderGraphics as any).zIndex = 1000;
    this.worldContainer.addChild(this.borderGraphics);
    
    // Add grid pattern for better navigation
    this.createGrid();
    try { (this.gridGraphics as any).zIndex = 1; } catch {}

    // Add a decor layer (faint neon nodes)
    this.decorContainer = new PIXI.Container();
    this.worldContainer.addChild(this.decorContainer);
    try { (this.decorContainer as any).zIndex = 5; } catch {}
    // Decor disabled for bio-minimal theme (no neon nodes)
    // this.spawnDecor();
    
    // Create separate container for trails
    this.trailContainer = new PIXI.Container();
    this.trailContainer.visible = true;
    this.trailContainer.alpha = 1.0;
    this.worldContainer.addChild(this.trailContainer);
    try { (this.trailContainer as any).zIndex = 20; } catch {}
    
    // Pickups (energy orbs) – hidden initially
    this.pickupsContainer = new PIXI.Container();
    this.pickupsContainer.visible = false;
    this.worldContainer.addChild(this.pickupsContainer);
    // Defer initial pickup spawn

    // Boost pads layer
    this.boostPadsContainer = new PIXI.Container();
    this.worldContainer.addChild(this.boostPadsContainer);

    // Artifacts layer – hidden initially
    this.artifactContainer = new PIXI.Container();
    this.artifactContainer.visible = false;
    this.worldContainer.addChild(this.artifactContainer);
    // Defer artifact generation

    // Load Solana logo sprite
    this.createSolanaTexture();

    // Initial border draw
    this.drawArenaBorder();

    // Screen-space crisp border overlay (not scaled)
    try {
      this.borderOverlay = new PIXI.Graphics();
      (this.app as any)?.stage?.addChild?.(this.borderOverlay);
    } catch {}

    // Visibility handling: pause ticker when tab hidden to save CPU and avoid desync stutters
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
  }

  createGrid() {
    const gridSize = 160;
    this.gridGraphics = new PIXI.Graphics();
    
    // Vertical lines
    for (let x = -this.arena.width/2; x <= this.arena.width/2; x += gridSize) {
      this.gridGraphics
        .moveTo(x, -this.arena.height/2)
        .lineTo(x, this.arena.height/2);
    }
    
    // Horizontal lines
    for (let y = -this.arena.height/2; y <= this.arena.height/2; y += gridSize) {
      this.gridGraphics
        .moveTo(-this.arena.width/2, y)
        .lineTo(this.arena.width/2, y);
    }
    
    // Matte grid only (remove veins that could look like a border)
    this.gridGraphics.stroke({ width: 1, color: this.theme.grid, alpha: this.theme.gridAlpha });
    this.worldContainer.addChild(this.gridGraphics);
  }

  drawArenaBorder() {
    if (!this.borderGraphics) return;
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;
    const g = this.borderGraphics;
    g.clear();

    // Outer glowing border - more visible and neon
    g.rect(-halfW, -halfH, this.arena.width, this.arena.height)
      .stroke({ width: 4, color: 0x22d3ee, alpha: 0.6 });

    // Middle border for depth
    const inset1 = 3;
    g.rect(-halfW + inset1, -halfH + inset1, this.arena.width - inset1 * 2, this.arena.height - inset1 * 2)
      .stroke({ width: 2, color: 0x00ffff, alpha: 0.4 });

    // Inner crisp edge
    const inset2 = 6;
    g.rect(-halfW + inset2, -halfH + inset2, this.arena.width - inset2 * 2, this.arena.height - inset2 * 2)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  }

  private drawBorderOverlay() {
    if (!this.app || !this.borderOverlay) return;
    const zoom = this.camera.zoom;
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;
    const sx = Math.round(-halfW * zoom + this.camera.x);
    const sy = Math.round(-halfH * zoom + this.camera.y);
    const sw = Math.round(this.arena.width * zoom);
    const sh = Math.round(this.arena.height * zoom);
    const g = this.borderOverlay;
    g.clear();
    g.rect(sx, sy, sw, sh).stroke({ width: 3, color: this.theme.border, alpha: 0.95 });
    // subtle inner line
    g.rect(sx + 2, sy + 2, Math.max(0, sw - 4), Math.max(0, sh - 4)).stroke({ width: 1, color: this.theme.border, alpha: 0.5 });
  }

  createSolanaTexture() {
    if (!this.app) return;
    
    // Create a high-quality Solana logo texture
    const logoGraphics = new PIXI.Graphics();
    
    // Solana logo colors
    const purple = 0x9945FF;
    const green = 0x14F195;
    const gradient = 0x19FB9B;
    
    // Create Solana logo shape (simplified but recognizable)
    logoGraphics
      .moveTo(0, -3)
      .lineTo(6, -3)
      .lineTo(8, -1)
      .lineTo(2, -1)
      .closePath()
      .fill(purple);
    
    logoGraphics
      .moveTo(0, 1)
      .lineTo(6, 1)
      .lineTo(8, 3)
      .lineTo(2, 3)
      .closePath()
      .fill(green);
    
    logoGraphics
      .moveTo(2, -1)
      .lineTo(8, -1)
      .lineTo(6, 1)
      .lineTo(0, 1)
      .closePath()
      .fill(gradient);
    
    // Store the texture for reuse
    this.solanaTexture = this.app.renderer.generateTexture(logoGraphics);
  }

  // Simple LCG for deterministic artifact placement
  // srand removed (unused)
  // sran removed (unused)

  generateArtifacts() {
    // deterministic seed hook removed (unused)
    // Clear prior
    this.artifactContainer.removeChildren();
    // Slowdown squares and flow lanes disabled per player feedback
    // Keep containers clear and leave arrays empty
    // (Removed unused features)

    // Spawn a few simple boost pads (easy, fun)
    this.spawnBoostPads(6);
  }
  spawnDecor() {
    // Scatter subtle neon nodes across the map
    const rng = (min: number, max: number) => min + Math.random() * (max - min);
    for (let i = 0; i < 220; i++) {
      const g = new PIXI.Graphics();
      const x = rng(-this.arena.width * 0.45, this.arena.width * 0.45);
      const y = rng(-this.arena.height * 0.45, this.arena.height * 0.45);
      const r = rng(2, 5);
      const c = Math.random() < 0.5 ? 0x0ef2f2 : 0xff57c9;
      g.circle(0, 0, r).fill({ color: c, alpha: 0.15 });
      g.x = x;
      g.y = y;
      this.decorContainer.addChild(g);
    }
  }

  spawnPickups(count: number) {
    if (!this.app) return;
    if (!this.pickupsContainer) {
      try {
        this.pickupsContainer = new PIXI.Container();
        this.pickupsContainer.visible = true;
        this.worldContainer?.addChild?.(this.pickupsContainer as any);
      } catch {}
      if (!this.pickupsContainer) return;
    }
    for (let i = 0; i < count; i++) {
      const px = (Math.random() - 0.5) * this.arena.width * 0.9;
      const py = (Math.random() - 0.5) * this.arena.height * 0.9;
      const container = new PIXI.Container();
      const g = new PIXI.Graphics();
      const aura = new PIXI.Graphics();
      const radius = 9 + Math.random() * 7;
      // Triad shard: rotating triangle with neon stroke
      const c = Math.random() < 0.5 ? 0x00ffd1 : 0xff6bd6;
      const inner = Math.max(3, radius * 0.55);
      const tri = [
        { x: 0, y: -radius },
        { x: inner, y: radius * 0.6 },
        { x: -inner, y: radius * 0.6 }
      ];
      g.moveTo(tri[0].x, tri[0].y)
       .lineTo(tri[1].x, tri[1].y)
       .lineTo(tri[2].x, tri[2].y)
       .closePath()
       .stroke({ width: 2, color: c, alpha: 0.9 });
      g.circle(0, 0, Math.max(2, radius * 0.35)).fill({ color: 0xffffff, alpha: 0.85 });
      aura.circle(0, 0, radius * 1.2).stroke({ width: 1, color: c, alpha: 0.08 });
      container.addChild(aura);
      container.addChild(g);
      container.x = px;
      container.y = py;
      try { this.pickupsContainer.addChild(container); } catch {}
      this.pickups.push({ x: px, y: py, radius, type: 'energy', amount: 15 + Math.floor(Math.random() * 15), graphics: container, shape: g, aura, pulseT: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() * 0.8 + 0.3) * (Math.random() < 0.5 ? -1 : 1), color: c });
    }
  }

  spawnBoostPads(count: number) {
    if (!this.boostPadsContainer) return;
    this.boostPads = [];
    for (let i = 0; i < count; i++) {
      const r = 28;
      const x = (Math.random() - 0.5) * (this.arena.width - 600);
      const y = (Math.random() - 0.5) * (this.arena.height - 600);
      const g = new PIXI.Graphics();
      g.circle(0, 0, r)
        .fill({ color: 0x22d3ee, alpha: 0.12 })
        .stroke({ width: 2, color: 0x22d3ee, alpha: 0.55 });
      // arrows
      g.moveTo(-8, 0).lineTo(0, -8).lineTo(8, 0).stroke({ width: 2, color: 0x22d3ee, alpha: 0.7 });
      g.x = x; g.y = y; (g as any).zIndex = 7;
      this.boostPadsContainer.addChild(g);
      this.boostPads.push({ x, y, radius: r, cooldownMs: 1500, lastTriggeredAt: 0, graphics: g });
    }
  }

  setupControls() {
    if (!this.app) return;
    
    // Keyboard controls
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
    
    // Mouse controls
    const onMouseMove = (e: MouseEvent) => {
      const rect = this.app!.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    };
    
    window.addEventListener('mousemove', onMouseMove);
    this.cleanupFunctions.push(() => window.removeEventListener('mousemove', onMouseMove));
    
    // Touch controls - Enhanced for mobile
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.app!.canvas.getBoundingClientRect();
      const now = Date.now();

      this.touch.active = true;
      this.touch.x = touch.clientX - rect.left;
      this.touch.y = touch.clientY - rect.top;

      // Two-finger tap = boost (better for mobile)
      if (e.touches.length === 2) {
        if (this.player?.isBoosting) {
          this.stopBoost();
        } else {
          this.startBoost();
          // Haptic feedback on boost
          try { navigator.vibrate?.(50); } catch {}
        }
      }
      // Double tap detection for boost (fallback)
      else if (now - this.touch.lastTap < 300) {
        if (this.player?.isBoosting) {
          this.stopBoost();
        } else {
          this.startBoost();
          // Haptic feedback
          try { navigator.vibrate?.(50); } catch {}
        }
      }
      this.touch.lastTap = now;
    };
    
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (this.touch.active && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.app!.canvas.getBoundingClientRect();
        this.touch.x = touch.clientX - rect.left;
        this.touch.y = touch.clientY - rect.top;
      }
    };
    
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      this.touch.active = false;
    };
    
    this.app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    this.app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    this.app.canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    this.cleanupFunctions.push(() => {
      this.app!.canvas.removeEventListener('touchstart', onTouchStart);
      this.app!.canvas.removeEventListener('touchmove', onTouchMove);
      this.app!.canvas.removeEventListener('touchend', onTouchEnd);
    });
    
    // Zoom controls
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const zoomDelta = -e.deltaY * zoomSpeed;
      this.camera.targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.targetZoom + zoomDelta));
    };
    
    window.addEventListener('wheel', onWheel);
    this.cleanupFunctions.push(() => window.removeEventListener('wheel', onWheel));
    
    // Mobile virtual controls integration
    const onMobileJoystick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      
      // Convert joystick offset to screen position for aiming
      const rect = this.app!.canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Improved sensitivity and smoothing
      const scale = 4; // Increased sensitivity
      const targetX = centerX + (detail.x * scale);
      const targetY = centerY + (detail.y * scale);
      
      // Smooth input for better feel
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
      // Don't allow boost during preStart countdown
      if (this.preStart) {
        console.log('[BOOST] Blocked during countdown');
        return;
      }
      
      if (this.player?.isBoosting) {
        this.stopBoost();
      } else {
        console.log('[BOOST] Attempting boost, energy:', this.player?.boostEnergy);
        this.startBoost();
      }
    };
    
    window.addEventListener('mobile-joystick', onMobileJoystick as EventListener);
    window.addEventListener('mobile-boost', onMobileBoost);
    this.cleanupFunctions.push(() => {
      window.removeEventListener('mobile-joystick', onMobileJoystick as EventListener);
      window.removeEventListener('mobile-boost', onMobileBoost);
    });
  }

  setupRadar() {
    // Check if mobile - if yes, use proximity radar instead
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Create proximity radar overlay (full screen, edge indicators)
      this.radar = document.createElement('canvas');
      this.radar.id = 'game-proximity-radar';
      this.radar.width = window.innerWidth;
      this.radar.height = window.innerHeight;
      Object.assign(this.radar.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: '5'
      });
      this.uiContainer.appendChild(this.radar);
      this.radarCtx = this.radar.getContext('2d')!;
      return;
    }
    
    // Desktop: Create sonar radar
    this.radar = document.createElement('canvas');
    this.radar.id = 'game-radar';
    this.radar.width = 100;
    this.radar.height = 100;
    Object.assign(this.radar.style, {
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      width: '100px',
      height: '100px',
      background: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(0,255,255,0.3)',
      borderRadius: '50px',
      zIndex: '10'
    });
    this.uiContainer.appendChild(this.radar);
    this.radarCtx = this.radar.getContext('2d')!;
    // Radar label (playful)
    const radarLbl = document.createElement('div');
    radarLbl.textContent = 'Ping';
    Object.assign(radarLbl.style, { position: 'absolute', bottom: '10px', right: '20px', color: this.theme.text, fontSize: '12px', opacity: '0.9', pointerEvents: 'none' });
    this.uiContainer.appendChild(radarLbl);
  }

  createUI() {
    // Ensure HUD animations are available
    injectHudAnimationStylesOnce();
    // Create boost bar (matte, theme-driven)
    const boostBarLabel = document.createElement('div');
    boostBarLabel.id = 'game-boost-label';
    boostBarLabel.textContent = 'JUICE';
    Object.assign(boostBarLabel.style, {
      position: 'absolute',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.theme.text,
      fontSize: '12px',
      fontWeight: '600',
      zIndex: '10'
    });
    this.uiContainer.appendChild(boostBarLabel);

    const boostBar = document.createElement('div');
    boostBar.id = 'game-boost-bar';
    Object.assign(boostBar.style, {
      position: 'absolute',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '200px',
      height: '12px',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: 'none',
      zIndex: '10'
    });
    this.uiContainer.appendChild(boostBar);

    const boostBarFill = document.createElement('div');
    boostBarFill.id = 'game-boost-fill';
    Object.assign(boostBarFill.style, {
      height: '100%',
      background: '#22d3ee',
      borderRadius: '4px',
      transition: 'width 0.1s ease-out',
      boxShadow: 'none',
      width: '100%'
    });
    boostBar.appendChild(boostBarFill);

    // Create trail status
    const trailStatus = document.createElement('div');
    trailStatus.id = 'game-trail-status';
    trailStatus.textContent = 'TRAIL ACTIVE';
    Object.assign(trailStatus.style, {
      position: 'absolute',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.theme.text,
      fontSize: '14px',
      fontWeight: '600',
      background: 'rgba(0, 0, 0, 0.55)',
      padding: '8px 16px',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.12)',
      transition: 'all 0.3s ease',
      zIndex: '10'
    });
    this.uiContainer.appendChild(trailStatus);

    // Remove separate alive counter (use leaderboard header only)

    // Create controls hint
    const controlsHint = document.createElement('div');
    controlsHint.id = 'game-controls-hint';
    controlsHint.innerHTML = 'WASD: Move • SPACE: Boost';
    Object.assign(controlsHint.style, {
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.theme.text,
      fontSize: '14px',
      fontWeight: '600',
      background: 'rgba(0, 0, 0, 0.55)',
      padding: '8px 16px',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.12)',
      zIndex: '10',
      opacity: '0.8'
    });
    this.uiContainer.appendChild(controlsHint);
    
    // Fade out controls hint after 5 seconds
    setTimeout(() => {
      if (controlsHint) {
        controlsHint.style.opacity = '0';
        controlsHint.style.transition = 'opacity 2s ease';
        setTimeout(() => controlsHint.remove(), 2000);
      }
    }, 5000);

    // Create leaderboard container (top-right) - HIDDEN ON MOBILE
    this.leaderboardContainer = document.createElement('div');
    const isMobileDevice = window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches;
    Object.assign(this.leaderboardContainer.style, {
      position: 'absolute',
      top: '80px',
      right: '20px',
      width: '260px',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      padding: '10px',
      zIndex: '10',
      display: isMobileDevice ? 'none' : 'block'
    });
    this.uiContainer.appendChild(this.leaderboardContainer);

    // Create kill feed container (top-left)
    this.killFeedContainer = document.createElement('div');
    Object.assign(this.killFeedContainer.style, {
      position: 'absolute',
      top: '20px',
      left: '20px',
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      zIndex: '10'
    });
    this.uiContainer.appendChild(this.killFeedContainer);

    // Settings UI toggle removed

    // Zone timer HUD (top center)
    const zoneTimer = document.createElement('div');
    zoneTimer.id = 'game-zone-timer';
    Object.assign(zoneTimer.style, {
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.theme.text,
      fontSize: '14px',
      fontWeight: '600',
      background: 'rgba(0, 0, 0, 0.55)',
      padding: '6px 12px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.12)',
      zIndex: '10'
    });
    zoneTimer.textContent = 'Zone closes in: 90s';
    this.uiContainer.appendChild(zoneTimer);
    // (bounty HUD removed)

    // Toast container for playful feedback
    const toast = document.createElement('div');
    toast.id = 'game-toast';
    Object.assign(toast.style, { position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: this.theme.text, padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px', opacity: '0', transition: 'opacity 180ms ease', pointerEvents: 'none', zIndex: '12' });
    this.uiContainer.appendChild(toast);

    // Create emote buttons (mobile-friendly)
    this.createEmoteButtons();
  }

  createEmoteButtons() {
    const emotes = [
      { emoji: '👍', label: 'GG' },
      { emoji: '😂', label: 'LOL' },
      { emoji: '😱', label: 'OMG' },
      { emoji: '🔥', label: 'Fire' }
    ];

    const emoteContainer = document.createElement('div');
    emoteContainer.id = 'emote-buttons';
    Object.assign(emoteContainer.style, {
      position: 'absolute',
      bottom: '160px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: '15'
    });

    emotes.forEach((emote) => {
      const btn = document.createElement('button');
      btn.textContent = emote.emoji;
      btn.title = emote.label;
      Object.assign(btn.style, {
        width: '50px',
        height: '50px',
        fontSize: '24px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: '2px solid rgba(34, 211, 238, 0.5)',
        borderRadius: '50%',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'auto',
        touchAction: 'manipulation'
      });

      // Hover/active effects
      btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.borderColor = 'rgba(34, 211, 238, 1)';
        btn.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.6)';
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'scale(1)';
        btn.style.borderColor = 'rgba(34, 211, 238, 0.5)';
        btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
      };

      // Click handler
      btn.onclick = () => {
        this.showEmote(emote.emoji);
        // Haptic feedback
        try { navigator.vibrate?.(30); } catch {}
        // Visual feedback
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => { btn.style.transform = 'scale(1)'; }, 100);
      };

      emoteContainer.appendChild(btn);
    });

    this.uiContainer.appendChild(emoteContainer);
  }

  showEmote(emoji: string) {
    if (!this.player || this.player.destroyed) return;

    // Create emote display above player
    const emoteEl = document.createElement('div');
    emoteEl.textContent = emoji;
    Object.assign(emoteEl.style, {
      position: 'absolute',
      fontSize: '48px',
      pointerEvents: 'none',
      zIndex: '20',
      animation: 'emote-float 2s ease-out forwards',
      textShadow: '0 0 10px rgba(0, 0, 0, 0.8)'
    });

    // Add animation keyframes if not already added
    if (!document.getElementById('emote-float-animation')) {
      const style = document.createElement('style');
      style.id = 'emote-float-animation';
      style.textContent = `
        @keyframes emote-float {
          0% { transform: translateY(0) scale(0.5); opacity: 1; }
          50% { transform: translateY(-30px) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    this.uiContainer.appendChild(emoteEl);

    // Position above player (will be updated in game loop)
    const updateEmotePosition = () => {
      if (!this.player || !this.app) return;
      const sx = this.player.x * this.camera.zoom + this.camera.x + this.app.screen.width * 0.5;
      const sy = this.player.y * this.camera.zoom + this.camera.y + this.app.screen.height * 0.5 - 80;
      emoteEl.style.left = `${sx}px`;
      emoteEl.style.top = `${sy}px`;
      emoteEl.style.transform = `translate(-50%, -50%) ${emoteEl.style.transform || ''}`;
    };

    // Store emote for position updates
    const emoteData = { el: emoteEl, car: this.player, expiresAt: Date.now() + 2000 };
    if (!(this as any).emotes) (this as any).emotes = [];
    (this as any).emotes.push(emoteData);

    // Initial position
    updateEmotePosition();

    // Remove after animation
    setTimeout(() => {
      if (emoteEl.parentElement) {
        emoteEl.parentElement.removeChild(emoteEl);
      }
    }, 2000);
  }

  createPlayer() {
    const s = this.spawnQueue[this.spawnQueueIndex] || this.randomEdgeSpawn();
    // First slice steering: if the chosen first slice would cut toward this spawn, flip it
    if (this.firstSliceSide) {
      const nearLeft = s.x < -this.arena.width * 0.25;
      const nearRight = s.x > this.arena.width * 0.25;
      const opp: any = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
      let towardSpawn = (this.firstSliceSide === 'left' && nearLeft) || (this.firstSliceSide === 'right' && nearRight);
      if (towardSpawn) this.firstSliceSide = opp[this.firstSliceSide];
    }
    // Read profile customizations
    let headHex: number = 0x00ffff;
    let tailHex: number | null = null;
    let nameText: string = 'YOU';
    try {
      const head = localStorage.getItem('sr_profile_head');
      const tail = localStorage.getItem('sr_profile_tail');
      const nm = localStorage.getItem('sr_profile_name');
      if (head && /^#?[0-9a-fA-F]{6}$/.test(head)) headHex = parseInt(head.replace('#',''), 16);
      if (tail && /^#?[0-9a-fA-F]{6}$/.test(tail)) tailHex = parseInt(tail.replace('#',''), 16);
      if (nm && nm.trim()) nameText = nm.trim();
    } catch {}
    this.player = this.createCar(s.x, s.y, headHex, 'player');
    if (this.player) {
      (this.player as any).tailColor = tailHex ?? headHex;
      this.player.angle = s.angle;
      this.player.targetAngle = s.angle;
      this.player.sprite.rotation = s.angle;
      this.player.sprite.visible = true;
      (this.player as any).displayName = nameText;
      // Apply nameplate text if already created later
    }
    // Choose container: worldContainer if available, else stage
    const stage = (this.app as any)?.stage as PIXI.Container | undefined;
    const targetContainer = this.worldContainer || stage;
    if (this.player && targetContainer) {
      try {
        targetContainer.addChild(this.player.sprite);
        (this.player.sprite as any).zIndex = 50; // Above trails (20) but below border (1000)
      } catch (e) { console.warn('addChild player failed', e); }
    } else {
      console.warn('No container available for player sprite');
    }
    this.spawnQueueIndex++;
    // Force camera center on player on spawn (hard snap)
    try {
      const viewW = this.app!.screen.width;
      const viewH = this.app!.screen.height;
      const zoom = this.camera.targetZoom;
      this.camera.zoom = zoom;
      this.camera.x = -this.player.x * zoom + viewW / 2;
      this.camera.y = -this.player.y * zoom + viewH / 2;
      // Apply screen shake to camera
      this.worldContainer.x = Math.round(this.camera.x + this.camera.shakeX);
      this.worldContainer.y = Math.round(this.camera.y + this.camera.shakeY);
      this.worldContainer.scale.set(this.camera.zoom);
      try { this.drawBorderOverlay(); } catch {}
    } catch {}
    this.dbg('after createPlayer: stageChildren=', (this.app as any)?.stage?.children?.length, 'worldChildren=', this.worldContainer?.children?.length);
  }

  createBot() {
    const s0 = this.spawnQueue[this.spawnQueueIndex] || this.randomEdgeSpawn();
    const botColor = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)] || 0xff00ff;
    this.bot = this.createCar(s0.x, s0.y, botColor, 'bot');
    if (this.bot) {
      this.bot.angle = s0.angle; this.bot.targetAngle = s0.angle; this.bot.sprite.rotation = s0.angle;
      this.bot.sprite.visible = true;
      const stage2 = (this.app as any)?.stage as PIXI.Container | undefined;
      const targetContainer2 = this.worldContainer || stage2;
      if (targetContainer2) {
        try {
          targetContainer2.addChild(this.bot.sprite);
          (this.bot.sprite as any).zIndex = 50; // Above trails but below border
        } catch (e) { console.warn('addChild bot failed', e); }
      }
    }
    // Create additional bots for testing
    this.extraBots = [];
    for (let i = 0; i < 31; i++) {
      const s = this.spawnQueue[this.spawnQueueIndex + 1 + i] || this.randomEdgeSpawn();
      const bColor = BOT_COLORS[i % BOT_COLORS.length] || 0xff00ff;
      const bot = this.createCar(s.x, s.y, bColor, `bot${i}`);
      if (bot) {
        bot.angle = s.angle; bot.targetAngle = s.angle; bot.sprite.rotation = s.angle; bot.sprite.visible = true;
        this.extraBots.push(bot);
        const stage3 = (this.app as any)?.stage as PIXI.Container | undefined;
        const targetContainer3 = this.worldContainer || stage3;
        if (targetContainer3) {
          try {
            targetContainer3.addChild(bot.sprite);
            (bot.sprite as any).zIndex = 50; // Above trails but below border
          } catch (e) { console.warn('addChild extrabot failed', e); }
        }
      }
    }
    this.spawnQueueIndex += 1 + 31;
  }

  randomEdgeSpawn(): { x: number; y: number; angle: number } {
    const left = -this.arena.width / 2;
    const right = this.arena.width / 2;
    const top = -this.arena.height / 2;
    const bottom = this.arena.height / 2;
    const margin = 120; // spawn inside to avoid immediate wall bounce
    const side = Math.floor(Math.random() * 4); // 0=L,1=R,2=T,3=B
    if (side === 0) {
      const y = top + margin + Math.random() * (this.arena.height - 2 * margin);
      const angle = 0 + (Math.random() - 0.5) * 0.6;
      return { x: left + margin, y, angle };
    } else if (side === 1) {
      const y = top + margin + Math.random() * (this.arena.height - 2 * margin);
      const angle = Math.PI + (Math.random() - 0.5) * 0.6;
      return { x: right - margin, y, angle };
    } else if (side === 2) {
      const x = left + margin + Math.random() * (this.arena.width - 2 * margin);
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      return { x, y: top + margin, angle };
    } else {
      const x = left + margin + Math.random() * (this.arena.width - 2 * margin);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      return { x, y: bottom - margin, angle };
    }
  }

  buildSpawnQueue(count: number) {
    const spacing = 420; // stronger spacing between spawns
    const margin = 220; // farther from border
    const perSide = Math.ceil(count / 4);
    const left = -this.arena.width / 2 + margin, right = this.arena.width / 2 - margin;
    const top = -this.arena.height / 2 + margin, bottom = this.arena.height / 2 - margin;
    const q: Array<{ x: number; y: number; angle: number }> = [];
    const spanY = (this.arena.height - 2 * margin);
    const spanX = (this.arena.width - 2 * margin);
    const stepY = Math.max(spacing, spanY / perSide);
    const stepX = Math.max(spacing, spanX / perSide);
    // Left side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const y = top + (i + 0.5) * stepY;
      q.push({ x: left, y: Math.min(bottom, Math.max(top, y)), angle: 0 + (Math.random()-0.5)*0.4 });
    }
    // Right side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const y = top + (i + 0.5) * stepY;
      q.push({ x: right, y: Math.min(bottom, Math.max(top, y)), angle: Math.PI + (Math.random()-0.5)*0.4 });
    }
    // Top side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const x = left + (i + 0.5) * stepX;
      q.push({ x: Math.min(right, Math.max(left, x)), y: top, angle: Math.PI/2 + (Math.random()-0.5)*0.4 });
    }
    // Bottom side
    for (let i = 0; i < perSide && q.length < count; i++) {
      const x = left + (i + 0.5) * stepX;
      q.push({ x: Math.min(right, Math.max(left, x)), y: bottom, angle: -Math.PI/2 + (Math.random()-0.5)*0.4 });
    }
    // Shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    // Enforce min distance between consecutive spawns
    const minDist = 700;
    const filtered: Array<{ x: number; y: number; angle: number }> = [];
    for (const s of q) {
      let ok = true;
      for (const t of filtered) {
        const dx = s.x - t.x, dy = s.y - t.y;
        if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
      }
      if (ok) filtered.push(s);
      if (filtered.length >= count) break;
    }
    this.spawnQueue = filtered.length ? filtered : q;
    this.spawnQueueIndex = 0;
  }

  createCar(x: number, y: number, color: number, type: string): Car {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const name = type === 'player' ? 'YOU' : (type || 'BOT').toUpperCase();
    const car: Car = {
      x, y, color, type,
      id,
      name,
      kills: 0,
      angle: 0,
      targetAngle: 0,
      speed: 220,
      baseSpeed: 220,
      boostSpeed: 620,
      targetSpeed: 220,
      speedTransitionRate: 12.0, // Faster transition for snappier boost
      driftFactor: 0,
      maxDriftFactor: type === 'bot' ? 0.8 : 0.7,
      vx: 0,
      vy: 0,
      destroyed: false,
      respawnTimer: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      boostEnergy: 100,
      maxBoostEnergy: 100,
      boostRegenRate: 24,
      boostConsumptionRate: 55,
      minBoostEnergy: 20,
      trailPoints: [],
      trailGraphics: null,
      lastTrailTime: 0,
      turnTimer: 0,
      boostAITimer: 0,
      currentTrailId: null,
      lastTrailBoostStatus: undefined,
      sprite: new PIXI.Container(),
      headGraphics: new PIXI.Graphics(),
      tailGraphics: this.smallTailEnabled ? new PIXI.Graphics() : null,
      tailWaveT: 0,
      tailLength: 34,
      tailSegments: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 6 : 10, // Fewer segments on mobile for performance
      tailAmplitude: 5,
      turnResponsiveness: type === 'player' ? 10.0 : 6.5, // Snappier turning
      lateralDragScalar: 1.15
    };

    // Build spermatozoid: head + tail
    // Head (capsule/circle)
    car.headGraphics!.clear();
    car.headGraphics!.circle(0, 0, 8).fill(color).stroke({ width: 2, color, alpha: 0.25 });
    // Tail (wavy polyline), initially empty; updated each frame
    if (car.tailGraphics) {
      car.tailGraphics!.clear();
      (car.tailGraphics as any).zIndex = 1;
      car.sprite.addChild(car.tailGraphics!);
    }
    (car.headGraphics as any).zIndex = 2;
    car.sprite.addChild(car.headGraphics!);
    
    car.sprite.x = x;
    car.sprite.y = y;
    car.sprite.rotation = car.angle;
    car.sprite.visible = true;
    try { (car.sprite as any).zIndex = type === 'player' ? 50 : 50; } catch {}

    // Create nameplate DOM element
    if (this.uiContainer) {
      const nameplate = document.createElement('div');
      nameplate.textContent = name;
      Object.assign(nameplate.style, {
        position: 'absolute',
        color: this.theme.text,
        fontSize: '12px',
        textShadow: '',
        fontWeight: 'bold',
        pointerEvents: 'none',
        zIndex: '10',
        transform: 'translate(-50%, -120%)',
        background: 'rgba(0,0,0,0.35)',
        padding: '2px 6px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'nowrap'
      });
      this.uiContainer.appendChild(nameplate);
      (car as any).nameplate = nameplate;
    }

    return car;
  }

  startBoost() {
    if (this.player && this.player.boostEnergy >= (this.player.minBoostEnergy + 5) && !this.player.isBoosting) {
      this.player.isBoosting = true;
      this.player.targetSpeed = this.player.boostSpeed;
      
      // Enhanced boost feedback for mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Haptic feedback - makes boost feel punchy
      this.hapticFeedback('medium');
      
      // Subtle camera zoom for speed sensation (FOV effect)
      this.camera.targetZoom = Math.min(this.camera.zoom * 1.05, this.camera.maxZoom);
      
      // Light screen shake on boost start
      this.screenShake(0.5);
      
      // Skip heavy particle effect on mobile - causes visual glitches
      if (!isMobile) {
        this.createBoostEffect(this.player.x, this.player.y);
      }
    }
  }
  
  // Get particle from pool or create new one
  private getParticle(): PIXI.Graphics {
    const particle = this.particlePool.pop() || new PIXI.Graphics();
    particle.visible = true;
    particle.alpha = 1;
    return particle;
  }
  
  // Return particle to pool for reuse
  private returnParticle(particle: PIXI.Graphics) {
    particle.clear();
    particle.visible = false;
    particle.alpha = 0;
    
    // Only pool if under max size (prevent unbounded growth)
    if (this.particlePool.length < this.maxPoolSize) {
      this.particlePool.push(particle);
    } else {
      try { particle.destroy(); } catch {}
    }
  }
  
  createBoostEffect(x: number, y: number) {
    // Create a visual burst effect at boost location using pooled particles
    if (!this.worldContainer) return;
    
    // Reduce particles on mobile for better performance
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const particleCount = isMobile ? 8 : 12;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 200 + Math.random() * 100;
      const lifetime = 0.6;
      
      const particle = this.getParticle();
      particle.beginFill(0x00ffff);
      particle.drawCircle(0, 0, 3);
      particle.endFill();
      particle.x = x;
      particle.y = y;
      
      this.worldContainer.addChild(particle);
      
      const startTime = Date.now();
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= lifetime) {
          try {
            this.worldContainer?.removeChild(particle);
            this.returnParticle(particle); // Return to pool instead of destroying
          } catch {}
          return;
        }
        
        particle.x += vx * 0.016;
        particle.y += vy * 0.016;
        particle.alpha = 1 - (elapsed / lifetime);
        
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  stopBoost() {
    if (this.player?.isBoosting) {
      this.player.isBoosting = false;
      this.player.targetSpeed = this.player.baseSpeed;
    }
  }

  updateCamera() {
    if (!this.player || !this.app) return;
    
    // Detect mobile once for all camera adjustments
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // During countdown, keep targetZoom as set in gameLoop and center as needed
    const inCountdown = !!this.preStart;
    if (!inCountdown) {
      // Compute target zoom dynamically by speed + local density
      const speedMag = Math.sqrt(this.player.vx * this.player.vx + this.player.vy * this.player.vy);
      const speedFactor = Math.min(1, speedMag / 700);
      const camX = this.player.x;
      const camY = this.player.y;
      const nearbyRadius = 600;
      let nearbyCount = 0;
      if (this.bot && !this.bot.destroyed) {
        const dx = this.bot.x - camX; const dy = this.bot.y - camY; if (dx*dx + dy*dy < nearbyRadius*nearbyRadius) nearbyCount++;
      }
      for (const b of this.extraBots) {
        if (!b.destroyed) { const dx = b.x - camX; const dy = b.y - camY; if (dx*dx + dy*dy < nearbyRadius*nearbyRadius) nearbyCount++; }
      }
      const crowdFactor = Math.min(1, nearbyCount / 8);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const baseZoom = isMobile ? 0.75 : 1.0; // Balanced view for mobile (was 0.5 - too wide)
      // REMOVED boost zoom wobble - keep constant zoom
      // Reduce dynamic zoom changes for smoother camera
      const out = isMobile ? 0.08 * speedFactor + 0.10 * crowdFactor : 0.24 * speedFactor + 0.30 * crowdFactor;
      const target = baseZoom - out;
      this.camera.targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, target));
    }
    
    // Smooth target zoom - slower for mobile to prevent shake
    const zoomSpeed = isMobile ? 0.08 : (this.player?.isBoosting ? 0.04 : 0.10); // Slower zoom = smoother
    if (this.preStart && (Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt)) > 2000)) {
      this.camera.zoom = this.camera.targetZoom;
    } else {
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * zoomSpeed;
    }
    
    // Center camera on player (no lead), or on full arena during early countdown
    let desiredCenterX = this.player.x;
    let desiredCenterY = this.player.y;
    if (this.preStart) {
      const remain = Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt));
      if (remain > 2000) {
        // Fit the entire arena so all players (on edges) are visible
        const fitW = this.app.screen.width / (this.arena.width + 200); // extra padding
        const fitH = this.app.screen.height / (this.arena.height + 200);
        const zoomFit = Math.min(fitW, fitH);
        this.camera.targetZoom = Math.max(0.01, Math.min(this.camera.maxZoom, zoomFit));
        desiredCenterX = 0; desiredCenterY = 0;
      }
    }
    // Compute unclamped camera target from desired center
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;
    const viewW = this.app.screen.width;
    const viewH = this.app.screen.height;
    let targetCamX = -desiredCenterX * this.camera.zoom + viewW / 2;
    let targetCamY = -desiredCenterY * this.camera.zoom + viewH / 2;
    // Clamp camera so world stays on screen (skip clamping during final 2s of countdown and for practice)
    let minCamX = viewW - halfW * this.camera.zoom;
    let maxCamX = halfW * this.camera.zoom;
    let minCamY = viewH - halfH * this.camera.zoom;
    let maxCamY = halfH * this.camera.zoom;
    if (minCamX > maxCamX) { const cx = viewW / 2; minCamX = maxCamX = cx; }
    if (minCamY > maxCamY) { const cy = viewH / 2; minCamY = maxCamY = cy; }
    const countdownRemain = this.preStart ? Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt)) : 0;
    // Practice (no ws HUD) → never clamp; Tournament → clamp after countdown
    const isTournament = !!(this.wsHud && this.wsHud.active);
    const shouldClamp = isTournament && countdownRemain === 0;
    if (shouldClamp) {
      targetCamX = Math.max(minCamX, Math.min(maxCamX, targetCamX));
      targetCamY = Math.max(minCamY, Math.min(maxCamY, targetCamY));
    }
    // Smooth follow to reduce micro-jitter; snap during early countdown
    // Mobile gets faster camera for more fluid feel
    const baseSmoothness = isMobile ? 0.15 : this.cameraSmoothing; // More responsive (was 0.08)
    const followSmooth = this.preStart ? 1.0 : baseSmoothness;
    this.camera.x += (targetCamX - this.camera.x) * followSmooth;
    this.camera.y += (targetCamY - this.camera.y) * followSmooth;
    
    // Apply and decay screen shake
    this.camera.shakeX *= this.camera.shakeDecay;
    this.camera.shakeY *= this.camera.shakeDecay;
    if (Math.abs(this.camera.shakeX) < 0.1) this.camera.shakeX = 0;
    if (Math.abs(this.camera.shakeY) < 0.1) this.camera.shakeY = 0;
    
    // Ensure player sprite stays visible after camera changes
    try { if (this.player?.sprite) this.player.sprite.visible = true; } catch {}
    
    // Pixel-snapped placement with shake applied to avoid subpixel shimmer on thin lines
    this.worldContainer.x = Math.round(this.camera.x + this.camera.shakeX);
    this.worldContainer.y = Math.round(this.camera.y + this.camera.shakeY);
    // Redraw crisp screen-space border overlay after camera updates
    try { this.drawBorderOverlay(); } catch {}
    this.worldContainer.scale.set(this.camera.zoom);
    // Periodic visibility check (throttled)
    const now = Date.now();
    if (now - this.lastVisCheckAt > 500) {
      this.lastVisCheckAt = now;
      const p = this.player;
      const vis = !!(p && p.sprite && !p.destroyed && p.sprite.visible);
      const inWorld = !!(p && (p.sprite as any)?.parent === this.worldContainer);
      const onStage = !!(this.worldContainer && (this.worldContainer as any).parent === (this.app as any).stage);
      this.dbg('visCheck', { vis, inWorld, onStage, px: p?.x, py: p?.y, cam: { x: this.camera.x, y: this.camera.y, z: this.camera.zoom } });
      if (p && (!inWorld || !onStage)) {
        try { this.worldContainer.addChild(p.sprite); } catch {}
      }
      if (p && !p.sprite.visible) {
        try { p.sprite.visible = true; } catch {}
      }
    }
  }

  gameLoop() {
    if (!this.app) return;
    
    // FPS limiter for mobile (prevent overheating & battery drain)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;
      
      if (elapsed < this.frameInterval) return; // Skip frame to cap at 60 FPS
      
      this.lastFrameTime = now - (elapsed % this.frameInterval); // Carry over remainder
    }
    
    const deltaTime = this.app.ticker.deltaMS / 1000;
    
    // Handle pre-start countdown (freeze inputs/boost/trails until GO)
    if (this.preStart) {
      const remain = Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt));
      const sec = Math.ceil(remain / 1000);
      // Camera: 5-3s VERY wide overview to see ALL players; 2-0s zoom into player
      const baseZoom = 0.2; // Much wider for full arena view
      const endZoom = 0.6; // Mobile-optimized zoom level
      if (remain > 2000) {
        this.camera.targetZoom = baseZoom;
      } else {
        const t2 = 1 - Math.min(1, remain / 2000);
        this.camera.targetZoom = baseZoom + (endZoom - baseZoom) * t2;
      }
      // Show countdown HUD
      let cd = document.getElementById('prestart-countdown');
      if (!cd && this.uiContainer) {
        cd = document.createElement('div');
        cd.id = 'prestart-countdown';
        Object.assign(cd.style, { position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', color: this.theme.text, fontSize: '48px', fontWeight: '700', zIndex: '20' });
        this.uiContainer.appendChild(cd);
      }
      if (cd) {
        cd.textContent = sec > 0 ? String(sec) : 'GO!';
        // Subtle bounce scale synced to each second
        const phaseInMs = this.preStart.durationMs - remain;
        const frac = (phaseInMs % 1000) / 1000;
        const eased = this.easeOutBack(Math.min(1, Math.max(0, frac)));
        const scale = Math.min(1.06, 0.94 + 0.06 * eased);
        (cd as HTMLDivElement).style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      if (remain <= 0) {
        // Remove HUD and unfreeze
        this.preStart = null;
        if (cd) cd.remove();
        // Clear overview markers
        if (this.overviewCtx && this.overviewCanvas) this.overviewCtx.clearRect(0, 0, this.overviewCanvas.width, this.overviewCanvas.height);
      }
    }
    // Handle player input only after countdown
    if (!this.preStart) this.handlePlayerInput();
    
    // Update cars only after countdown
    if (!this.preStart) {
      // Timed unlock of artifacts/pickups to avoid early clutter
      const sinceStart = Date.now() - (this.gameStartTime || Date.now());
      if (!this.artifactsUnlocked && sinceStart >= this.unlockArtifactsAfterMs) {
        this.artifactsUnlocked = true;
        try { this.generateArtifacts(); } catch {}
        if (this.artifactContainer) this.artifactContainer.visible = true;
      }
      if (!this.pickupsUnlocked && sinceStart >= this.unlockPickupsAfterMs) {
        this.pickupsUnlocked = true;
        try { this.spawnPickups(35); } catch {}
        if (this.pickupsContainer) this.pickupsContainer.visible = true;
      }
      if (this.player && !this.player.destroyed) {
        this.updateCar(this.player, deltaTime);
        this.checkArenaCollision(this.player);
        // Keep nameplate pinned above player
        try {
          const np = (this.player as any).nameplate as HTMLDivElement | undefined;
          if (np) {
            const sx = this.player.x * this.camera.zoom + this.camera.x;
            const sy = this.player.y * this.camera.zoom + this.camera.y;
            np.style.left = `${sx}px`;
            np.style.top = `${sy}px`;
          }
        } catch {}
      }
      
      if (this.bot && !this.bot.destroyed) {
        this.updateBot(this.bot, deltaTime);
        this.checkArenaCollision(this.bot);
      }
      
      // Update extra bots
      for (const extraBot of this.extraBots) {
        if (!extraBot.destroyed) {
          this.updateBot(extraBot, deltaTime);
          this.checkArenaCollision(extraBot);
        }
      }
      
      // Update trails
      this.updateTrails(deltaTime);
      
      // Check trail collisions
      this.checkTrailCollisions();
    }
    
    // Update particles
    this.updateParticles(deltaTime);

    // Animate and collect pickups (collection only after countdown)
    if (!this.preStart && this.pickupsUnlocked && this.pickupsContainer) this.updatePickups(deltaTime);
    
    // Update camera
    this.updateCamera();
    
    // Update BR zone
    this.updateZoneAndDamage(deltaTime);
    
    // Update sonar radar
    this.radarAngle = (this.radarAngle + deltaTime * 2) % (Math.PI * 2);
    this.updateRadar();
    
    // Update alive count (legacy HUD removed; kept for practice header only)
    this.updateAliveCount();
    
    // Update boost bar
    this.updateBoostBar();
    
    // Update trail status
    this.updateTrailStatus();
    // Update emotes positions
    try {
      if (this.emotes.length && this.app) {
        for (const em of this.emotes) {
          const sx = em.car.x * this.camera.zoom + this.camera.x + this.app.screen.width * 0.5 - this.app.screen.width * 0.5;
          const sy = em.car.y * this.camera.zoom + this.camera.y + this.app.screen.height * 0.5 - this.app.screen.height * 0.5 - 24;
          em.el.style.left = `${sx}px`;
          em.el.style.top = `${sy}px`;
        }
        this.emotes = this.emotes.filter(e => Date.now() < e.expiresAt);
      }
    } catch {}
    
    // Update boost screen effects (temporarily disabled to simplify DA)
    if (!this.preStart) this.updateBoostScreenEffects();

    // Countdown overlay drawings disabled to reduce CPU
    
    // Update HUD elements: nameplates and leaderboard/killfeed
    this.updateNameplates();
    this.updateLeaderboard();
    this.renderKillFeed();
    this.renderKillStreakNotifications();

    // Render debug collision overlays (short TTL)
    this.renderDebugOverlays();
    
    // Handle respawning
    this.handleRespawning(deltaTime);

    // If server ends the round, auto-navigate out once
    if (this.wsHud?.active && !this.notifiedServerEnd) {
      const aliveCount = this.wsHud.aliveSet?.size ?? 0;
      if (aliveCount <= 1 && this.onExit) {
        this.notifiedServerEnd = true;
        // allow a short delay to show end
        setTimeout(() => { try { this.onExit && this.onExit(); } catch {} }, 500);
      }
    }
  }

  updateNameplates() {
    if (!this.app || !this.uiContainer) return;
    const updateFor = (car?: Car | null) => {
      if (!car || !car.nameplate || !this.app) return;
      // Use profile name for player if set
      if (car === this.player) {
        try {
          const nm = localStorage.getItem('sr_profile_name');
          if (nm && nm.trim()) { (car as any).nameplate.textContent = nm.trim(); }
        } catch {}
      }
      // Transform world -> screen
      const sx = car.x * this.camera.zoom + this.app.screen.width / 2 + this.camera.x - (this.app.screen.width / 2);
      const sy = car.y * this.camera.zoom + this.app.screen.height / 2 + this.camera.y - (this.app.screen.height / 2);
      car.nameplate.style.left = `${sx}px`;
      car.nameplate.style.top = `${sy}px`;
    };
    updateFor(this.player);
    updateFor(this.bot);
    for (const b of this.extraBots) updateFor(b);
  }
  
  updateLeaderboard() {
    if (!this.leaderboardContainer) return;
    
    // Skip leaderboard updates on mobile
    const isMobileDevice = window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches;
    if (isMobileDevice) return;
    // If tournament HUD is active, render from server state
    if (this.wsHud?.active) {
      const ids = new Set<string>([...Object.keys(this.wsHud.kills || {}), ...Array.from(this.wsHud.aliveSet || new Set<string>())]);
      const elimIndex: Record<string, number> = {};
      (this.wsHud.eliminationOrder || []).forEach((pid, idx) => { if (elimIndex[pid] == null) elimIndex[pid] = idx + 1; });
      const list = Array.from(ids).map(id => ({
        id,
        name: this.wsHud!.idToName[id] || `${id.slice(0,4)}…${id.slice(-4)}`,
        kills: this.wsHud!.kills[id] || 0,
        alive: this.wsHud!.aliveSet.has(id),
        elimIdx: elimIndex[id] ?? 0
      }));
      const sortedSrv = list.sort((a, b) => {
        if (a.alive !== b.alive) return (a.alive ? -1 : 1);
        if ((b.kills || 0) !== (a.kills || 0)) return (b.kills || 0) - (a.kills || 0);
        return (b.elimIdx || 0) - (a.elimIdx || 0); // later elim higher index first
      }).slice(0, 5);
      const aliveHeaderSrv = `<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px\">\n        <div style=\"color:${this.theme.text};font-weight:600;letter-spacing:0.01em;\">LEADERBOARD</div>\n        <div style=\"color:${this.theme.text};opacity:0.9;\">ALIVE: ${this.wsHud!.aliveSet.size}</div>\n      </div>`;
      const rowsSrv = sortedSrv.map((p, idx) => {
        const dotColor = p.alive ? '#10b981' : '#7b8796';
        const opacity = p.alive ? 1 : 0.6;
        const rank = idx + 1;
        const youTag = (this.wsHud!.playerId && p.id === this.wsHud!.playerId) ? ' <span style=\\"color:#22d3ee;opacity:0.9\\">(YOU)</span>' : '';
        return `
          <div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;gap:8px;opacity:${opacity}\">\n            <div style=\"display:flex;align-items:center;gap:8px\">\n              <div style=\"width:8px;height:8px;border-radius:50%;background:${dotColor}\"></div>\n              <div style=\"color:#9aa7b5;width:18px;text-align:center\">#${rank}</div>\n              <div style=\"color:${this.theme.text}\">${p.name}${youTag}</div>\n            </div>\n            <div style=\"color:${this.theme.text}\">KOs ${p.kills}</div>\n          </div>`;
      }).join('');
      // Only update if content actually changed (prevent unnecessary reflows)
      const newContent = `${aliveHeaderSrv}${rowsSrv}`;
      if (this.leaderboardContainer.innerHTML !== newContent) {
        this.leaderboardContainer.innerHTML = newContent;
      }
      return;
    }

    // Practice/local path
    const all = [this.player, this.bot, ...this.extraBots].filter((c): c is Car => !!c);
    const sorted = [...all].sort((a, b) => {
      const kdiff = (b.kills || 0) - (a.kills || 0);
      if (kdiff !== 0) return kdiff;
      // Tie-breaker: alive first, else later elimination (higher elimAtMs)
      const aAlive = !a.destroyed;
      const bAlive = !b.destroyed;
      if (aAlive !== bAlive) return aAlive ? -1 : 1;
      return (b.elimAtMs || 0) - (a.elimAtMs || 0);
    }).slice(0, 5);
    const aliveHeader = `<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px\">\n      <div style=\"color:${this.theme.text};font-weight:600;letter-spacing:0.01em;\">LEADERBOARD</div>\n      <div style=\"color:${this.theme.text};opacity:0.9;\">ALIVE: ${this.alivePlayers}</div>\n    </div>`;
    const rows = sorted.map((c, idx) => {
      const isAlive = !c.destroyed;
      const dotColor = isAlive ? '#10b981' : '#7b8796';
      const nameColor = c.type === 'player' ? '#22d3ee' : this.theme.text;
      const opacity = isAlive ? 1 : 0.6;
      const rank = idx + 1;
      const youTag = c.type === 'player' ? ' <span style=\\"color:#22d3ee;opacity:0.9\\">(YOU)</span>' : '';
      return `
        <div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;gap:8px;opacity:${opacity}\">\n          <div style=\"display:flex;align-items:center;gap:8px\">\n            <div style=\"width:8px;height:8px;border-radius:50%;background:${dotColor}\"></div>\n            <div style=\"color:#9aa7b5;width:18px;text-align:center\">#${rank}</div>\n            <div style=\"color:${nameColor}\">${c.name}${youTag}</div>\n          </div>\n          <div style=\"color:${this.theme.text}\">KOs ${c.kills}</div>\n        </div>`;
    }).join('');
    // Only update if content actually changed (prevent unnecessary reflows)
    const newContent = `${aliveHeader}${rows}`;
    if (this.leaderboardContainer.innerHTML !== newContent) {
      this.leaderboardContainer.innerHTML = newContent;
    }
  }
  
  savePlayerStats(won: boolean, prize: number = 0, kills: number = 0, rank: number = 0, totalPlayers: number = 0) {
    try {
      const stats = this.getPlayerStats();
      stats.totalGames++;
      if (won) {
        stats.wins++;
        stats.totalPrizes += prize;
      } else {
        stats.losses++;
      }
      stats.totalKills += kills;
      stats.history.unshift({
        timestamp: Date.now(),
        won,
        prize,
        kills,
        rank,
        totalPlayers
      });

      // Keep only last 50 games
      if (stats.history.length > 50) stats.history = stats.history.slice(0, 50);

      localStorage.setItem('spermrace_stats', JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save stats:', e);
    }
  }

  getPlayerStats() {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}

    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      totalPrizes: 0,
      totalKills: 0,
      history: []
    };
  }

  renderKillStreakNotifications() {
    if (!this.app) return;
    const now = Date.now();
    const NOTIFICATION_LIFETIME = 2500; // Longer for better visibility

    // Filter expired notifications FIRST to prevent duplicates
    this.killStreakNotifications = this.killStreakNotifications.filter(n => now - n.time < NOTIFICATION_LIFETIME);
    this.nearMisses = this.nearMisses.filter(n => now - n.time < 1500);

    // Clean up old DOM elements that might be stuck
    const existingEls = document.querySelectorAll('[id^="streak-"], [id^="miss-"]');
    existingEls.forEach(el => {
      const id = el.id;
      const timestamp = parseInt(id.split('-')[1]);
      if (isNaN(timestamp) || now - timestamp > 3000) {
        try { el.parentElement?.removeChild(el); } catch {}
      }
    });

    // Render kill streak notifications with enhanced animation
    this.killStreakNotifications.forEach((notif, index) => {
      const age = (now - notif.time) / 1000;
      const progress = age / (NOTIFICATION_LIFETIME / 1000);

      // Stack notifications vertically to prevent overlap
      const yOffset = index * 40; // Space them out
      
      // Calculate screen position
      const sx = notif.x * this.camera.zoom + this.camera.x + this.app!.screen.width * 0.5;
      const sy = notif.y * this.camera.zoom + this.camera.y + this.app!.screen.height * 0.5 - 60 - (age * 30) - yOffset;

      // Create or update notification element
      let el = document.getElementById(`streak-${notif.time}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `streak-${notif.time}`;
        el.textContent = notif.text;
        document.body.appendChild(el);
      }
      
      // Enhanced styling with scaling animation
      const scale = progress < 0.2 ? 1 + (1 - progress / 0.2) * 0.5 : 1; // Pop in effect
      el.style.cssText = `
        position: fixed;
        left: ${sx}px;
        top: ${sy}px;
        font-size: ${24 * scale}px;
        font-weight: 900;
        color: #ffffff;
        text-shadow: 0 0 15px rgba(255,100,0,1), 0 0 30px rgba(255,100,0,0.8), 0 2px 4px rgba(0,0,0,0.8);
        pointer-events: none;
        z-index: 1000;
        background: linear-gradient(90deg, #f43f5e, #fb923c, #fbbf24);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        transform: scale(${scale});
        filter: drop-shadow(0 0 10px rgba(251,146,60,0.6));
        opacity: ${Math.max(0, 1 - progress)};
        will-change: transform, opacity;
      `;

      // Remove element when expired
      if (progress >= 1) {
        try { if (el.parentElement) el.parentElement.removeChild(el); } catch {}
      }
    });
    
    // Render near-miss notifications (prevent overlap)
    this.nearMisses.forEach((notif, index) => {
      const age = (now - notif.time) / 1000;
      const progress = age / 1.5;
      
      const yOffset = index * 30; // Stack them

      const sx = notif.x * this.camera.zoom + this.camera.x + this.app!.screen.width * 0.5;
      const sy = notif.y * this.camera.zoom + this.camera.y + this.app!.screen.height * 0.5 - 40 + yOffset;

      let el = document.getElementById(`miss-${notif.time}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `miss-${notif.time}`;
        el.textContent = notif.text;
        document.body.appendChild(el);
      }
      
      el.style.cssText = `
        position: fixed;
        left: ${sx}px;
        top: ${sy}px;
        font-size: 16px;
        font-weight: 700;
        color: #fbbf24;
        text-shadow: 0 0 8px rgba(251,191,36,0.8), 0 1px 2px rgba(0,0,0,0.8);
        pointer-events: none;
        z-index: 999;
        opacity: ${Math.max(0, 1 - progress)};
        will-change: opacity;
      `;

      if (progress >= 1) {
        try { if (el.parentElement) el.parentElement.removeChild(el); } catch {}
      }
    });
  }

  renderKillFeed() {
    if (!this.killFeedContainer) return;
    const now = Date.now();
    const KILL_LIFETIME = 6000;
    
    // Merge local and server kill feed (server preferred when active)
    let feed: Array<{ killer: string; victim: string; time: number }> = [];
    if (this.wsHud?.active && Array.isArray(this.wsHud.killFeed)) {
      feed = (this.wsHud.killFeed || []).map(ev => ({
        killer: ev.killerId ? (this.wsHud!.idToName[ev.killerId] || `${ev.killerId.slice(0,4)}…${ev.killerId.slice(-4)}`) : 'ZONE',
        victim: this.wsHud!.idToName[ev.victimId] || `${ev.victimId.slice(0,4)}…${ev.victimId.slice(-4)}`,
        time: ev.ts || now
      }));
    } else {
      // Local practice - clean expired kills
      this.recentKills = this.recentKills.filter(k => now - k.time < KILL_LIFETIME);
      feed = this.recentKills;
    }
    
    // Only show last 6 kills, most recent at bottom
    const items = feed.slice(-6);
    
    // Build HTML in one go to prevent flickering
    const html = items.map(k => {
      const age = now - k.time;
      const alpha = Math.max(0, 1 - (age / KILL_LIFETIME));
      const slideIn = age < 300; // Slide in animation for first 300ms
      const translateY = slideIn ? `translateY(${(1 - age / 300) * 20}px)` : 'translateY(0)';
      
      return `<div class="killfeed-item" style="
        display: flex;
        gap: 8px;
        align-items: center;
        background: rgba(0,0,0,0.7);
        border: 1px solid rgba(255,100,0,0.3);
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 4px;
        color: ${this.theme.text};
        opacity: ${alpha};
        transform: ${translateY};
        transition: transform 0.3s ease-out, opacity 0.3s;
        will-change: transform, opacity;
      ">
        <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;"></span>
        <span style="color:#ff6b6b;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${k.killer}</span>
        <span style="opacity:0.7;flex-shrink:0;">💀</span>
        <span style="color:#fbbf24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${k.victim}</span>
      </div>`;
    }).join('');
    
    // Only update if content changed to prevent glitching
    if (this.killFeedContainer.innerHTML !== html) {
      this.killFeedContainer.innerHTML = html;
    }
  }

  renderDebugOverlays() {
    if (!this.app) return;
    const now = Date.now();
    const TTL = 4000;
    this.debugCollisions = (this.debugCollisions || []).filter(d => now - d.ts < TTL);
    // Use overview canvas context for overlays
    if (!this.overviewCtx || !this.overviewCanvas) return;
    const ctx = this.overviewCtx;
    // Draw on top of existing overlays
    for (const d of this.debugCollisions) {
      // Hit point
      const sx = d.hit.x * this.camera.zoom + this.app!.screen.width / 2 + this.camera.x - (this.app!.screen.width / 2);
      const sy = d.hit.y * this.camera.zoom + this.app!.screen.height / 2 + this.camera.y - (this.app!.screen.height / 2);
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,0,0,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Segment if present
      if (d.segment) {
        const ax = d.segment.from.x * this.camera.zoom + this.app!.screen.width / 2 + this.camera.x - (this.app!.screen.width / 2);
        const ay = d.segment.from.y * this.camera.zoom + this.app!.screen.height / 2 + this.camera.y - (this.app!.screen.height / 2);
        const bx = d.segment.to.x * this.camera.zoom + this.app!.screen.width / 2 + this.camera.x - (this.app!.screen.width / 2);
        const by = d.segment.to.y * this.camera.zoom + this.app!.screen.height / 2 + this.camera.y - (this.app!.screen.height / 2);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = 'rgba(255,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  handlePlayerInput() {
    if (!this.player || this.player.destroyed || !this.app) return;
    
    let targetX: number, targetY: number;
    
    if (this.touch.active) {
      // Touch controls
      targetX = this.touch.x - this.app.screen.width / 2;
      targetY = this.touch.y - this.app.screen.height / 2;
    } else {
      // Mouse controls
      targetX = this.mouse.x - this.app.screen.width / 2;
      targetY = this.mouse.y - this.app.screen.height / 2;
    }
    
    // Calculate target angle from player position to input position
    const dx = targetX;
    const dy = targetY;
    const targetAngle = Math.atan2(dy, dx);
    // Low-speed aim smoothing to reduce wobble
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (speed < 120) {
      const prev = (this.player as any).targetAngle ?? targetAngle;
      (this.player as any).targetAngle = prev + (targetAngle - prev) * 0.38;
    } else {
      (this.player as any).targetAngle = targetAngle;
    }
    
    // Boost control - hold to boost (DESKTOP ONLY - mobile uses button)
    // Don't interfere with mobile boost controls
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      if (this.keys['Space']) {
        if (!this.player.isBoosting && this.player.boostEnergy >= (this.player.minBoostEnergy + 5)) {
          this.player.isBoosting = true;
          this.player.targetSpeed = this.player.boostSpeed;
        }
      } else {
        if (this.player.isBoosting) {
          this.player.isBoosting = false;
          this.player.targetSpeed = this.player.baseSpeed;
        }
      }
    }

    // Quick emote: press 'E' to pop a fun, crypto-flavored emote above your head
    if (this.keys['KeyE']) {
      this.keys['KeyE'] = false; // single-shot
      try { this.spawnEmote(this.player, Math.random() < 0.5 ? '🚀' : '💎'); } catch {}
    }
  }

  spawnEmote(car: Car | null, emoji: string) {
    if (!car || !this.uiContainer || !this.app) return;
    const el = document.createElement('div');
    el.textContent = emoji;
    Object.assign(el.style, {
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      fontSize: '18px',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
      zIndex: '15',
      transition: 'opacity 200ms ease, transform 200ms ease',
      opacity: '1'
    } as any);
    this.uiContainer.appendChild(el);
    const sx = car.x * this.camera.zoom + this.camera.x + this.app.screen.width * 0.5 - this.app.screen.width * 0.5;
    const sy = car.y * this.camera.zoom + this.camera.y + this.app.screen.height * 0.5 - this.app.screen.height * 0.5 - 24;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    const expiresAt = Date.now() + 900;
    this.emotes.push({ el, car, expiresAt });
    setTimeout(() => { try { el.style.opacity = '0'; el.style.transform = 'translate(-50%, -60%)'; } catch {} }, 700);
    setTimeout(() => { try { el.remove(); } catch {} }, 900);
  }

  updateCar(car: Car, deltaTime: number) {
    if (car.destroyed) return;
    
    // Update boost energy system
    const wasBoosting = car.isBoosting;
    if (car.isBoosting) {
      car.boostEnergy -= car.boostConsumptionRate * deltaTime;
      car.targetSpeed = car.boostSpeed;
      car.driftFactor = Math.min(car.maxDriftFactor, car.driftFactor + deltaTime * 2.0);
      
      // Stop boosting if energy depleted
      if (car.boostEnergy <= 0) {
        car.boostEnergy = 0;
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
      }
    } else {
      // Regenerate boost energy when not boosting
      car.boostEnergy += car.boostRegenRate * deltaTime;
      if (car.boostEnergy > car.maxBoostEnergy) {
        car.boostEnergy = car.maxBoostEnergy;
      }
      car.targetSpeed = car.baseSpeed;
      car.driftFactor = Math.max(0, car.driftFactor - deltaTime * 1.5);
    }
    // Emit boost echo on start
    if (!wasBoosting && car.isBoosting) {
      this.emitBoostEcho(car.x, car.y);
    }
    
    // Boost pads trigger (simple distance check)
    const now = Date.now();
    for (const pad of this.boostPads) {
      const dx = car.x - pad.x, dy = car.y - pad.y;
      const within = (dx * dx + dy * dy) <= (pad.radius * pad.radius);
      if (within && (now - pad.lastTriggeredAt) >= pad.cooldownMs) {
        pad.lastTriggeredAt = now;
        // Top up a bit of energy and force a short boost burst
        car.boostEnergy = Math.min(car.maxBoostEnergy, car.boostEnergy + 20);
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed * 1.05;
        // brief visual pulse
        try { pad.graphics.alpha = 0.5; setTimeout(() => { try { pad.graphics.alpha = 1.0; } catch {} }, 180); } catch {}
        // auto-stop after 0.7s to avoid sustained advantage
        setTimeout(() => {
          try {
            if (!this.player || car.destroyed) return;
            if (car.isBoosting) {
              car.isBoosting = false;
              car.targetSpeed = car.baseSpeed;
            }
          } catch {}
        }, 700);
        // echo ring
        this.emitBoostEcho(pad.x, pad.y);
      }
    }
    
    // Smooth speed transitions
    const speedDiff = car.targetSpeed - car.speed;
    const speedChange = speedDiff * car.speedTransitionRate * deltaTime;
    car.speed += speedChange;
    
    // Smooth angle interpolation for drift effect
    const angleDiff = normalizeAngle((car as any).targetAngle - car.angle);
    const turnRate = (car as any).turnResponsiveness ?? 7.0;
    car.angle += angleDiff * Math.min(1.0, turnRate * deltaTime);
    car.sprite.rotation = car.angle;
    
    // Calculate forward direction
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    
    // Add drift effect - car slides sideways while turning
    const driftAngle = car.angle + (Math.PI / 2);
    const driftX = Math.cos(driftAngle);
    const driftY = Math.sin(driftAngle);
    
    // Combine forward movement with drift
    let effectiveSpeed = car.speed;
    const driftIntensity = car.driftFactor * effectiveSpeed * 0.4 * Math.abs(angleDiff);
    const lateralDrag = ((car as any).lateralDragScalar ?? 1.0) * 0.008;
    car.vx = forwardX * effectiveSpeed + driftX * driftIntensity;
    car.vy = forwardY * effectiveSpeed + driftY * driftIntensity;
    
    // Apply velocity update with slight lateral drag for sharper control at speed
    car.vx += Math.cos(car.angle) * effectiveSpeed * deltaTime;
    car.vy += Math.sin(car.angle) * effectiveSpeed * deltaTime;
    // lateral drag opposing perpendicular component
    const perpX = -Math.sin(car.angle);
    const perpY =  Math.cos(car.angle);
    const lateralVel = car.vx * perpX + car.vy * perpY;
    car.vx -= lateralVel * perpX * lateralDrag;
    car.vy -= lateralVel * perpY * lateralDrag;
    
    // Update position
    car.x += car.vx * deltaTime;
    car.y += car.vy * deltaTime;
    
    // Update sprite
    car.sprite.x = car.x;
    car.sprite.y = car.y;
    car.sprite.rotation = car.angle;
    // Animate sperm tail (tapered ribbon) and head (static oval)
    try {
      if (this.smallTailEnabled && car.tailGraphics) {
        car.tailWaveT = (car.tailWaveT || 0) + deltaTime * (car.isBoosting ? 12 : 8);
        const segs = Math.max(8, car.tailSegments || 16);
        const len = (car.tailLength || 48);
        const speedMag = Math.hypot(car.vx, car.vy);
        const speedScale = 0.5 + Math.min(1, speedMag / 350);
        const ampBase = (car.tailAmplitude || 6) * (car.isBoosting ? 1.15 : 1.0);
        const amp = ampBase; // steadier amplitude; envelope applied per-segment below
        const baseWidth = 3 * (0.75 + 0.25 * speedScale); // thinner overall
        const step = len / segs;
        const g = car.tailGraphics;
        g.clear();
        // Tail anchor slightly behind head center
        const headR = 8;
        const dirX = Math.cos(car.angle);
        const dirY = Math.sin(car.angle);
        const latX = Math.cos(car.angle + Math.PI / 2);
        const latY = Math.sin(car.angle + Math.PI / 2);
        const ax = -dirX * headR * 0.8;
        const ay = -dirY * headR * 0.8;
        const spine: Array<{ x: number; y: number; w: number }> = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          // Zero motion at head, increases toward mid/back
          const envelope = Math.pow(t, 2.2);
          const wave = Math.sin((t * 11) + (car.tailWaveT || 0)) * envelope * amp;
          const sx = ax - dirX * (i * step) + latX * wave;
          const sy = ay - dirY * (i * step) + latY * wave;
          const w = baseWidth * Math.pow(1 - t, 3.2); // stronger taper → thinner back and base
          spine.push({ x: sx, y: sy, w });
        }
        const poly: number[] = [];
        // left side
        for (let i = 0; i < spine.length; i++) {
          const s = spine[i];
          poly.push(s.x - latX * s.w, s.y - latY * s.w);
        }
        // right side (reverse)
        for (let i = spine.length - 1; i >= 0; i--) {
          const s = spine[i];
          poly.push(s.x + latX * s.w, s.y + latY * s.w);
        }
        g.poly(poly).fill({ color: car.color, alpha: 0.8 });
      }
      if (car.headGraphics) {
        // Static head (no pulsation/highlight)
        const rx = 9;
        const ry = 6;
        car.headGraphics.clear();
        car.headGraphics.ellipse(0, 0, rx, ry).fill({ color: car.color, alpha: 1.0 }).stroke({ width: 2, color: car.color, alpha: 0.3 });
      }
    } catch {}
    
    // Update glow intensity when boosting (apply to head only)
    if (car.isBoosting && car.headGraphics) {
      (car.headGraphics as any).alpha = 0.9;
    } else if (car.headGraphics) {
      (car.headGraphics as any).alpha = 1.0;
    }
  }

  updateBot(car: Car, deltaTime: number) {
    if (car.destroyed) return;
    
    // Random direction changes
    car.turnTimer -= deltaTime;
    if (car.turnTimer <= 0) {
      car.targetAngle += (Math.random() - 0.5) * Math.PI * 0.5;
      car.turnTimer = 1.0 + Math.random() * 2.0;
    }
    
    // Random boost
    car.boostAITimer -= deltaTime;
    if (car.boostAITimer <= 0) {
      if (!car.isBoosting && car.boostEnergy >= car.minBoostEnergy && Math.random() < 0.3) {
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed;
        car.boostAITimer = 2.0 + Math.random() * 3.0;
      } else if (car.isBoosting && (car.boostEnergy < 10 || Math.random() < 0.4)) {
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
        car.boostAITimer = 1.0 + Math.random() * 2.0;
      } else {
        car.boostAITimer = 0.5;
      }
    }
    
    this.updateCar(car, deltaTime);
  }

  checkArenaCollision(car: Car) {
    const halfWidth = this.arena.width / 2;
    const halfHeight = this.arena.height / 2;
    const carSize = 20;
    
    let bounced = false;
    
    if (car.x <= -halfWidth + carSize) {
      car.x = -halfWidth + carSize;
      car.vx = -car.vx * 0.7;
      car.angle = Math.PI - car.angle;
      bounced = true;
    }
    
    if (car.x >= halfWidth - carSize) {
      car.x = halfWidth - carSize;
      car.vx = -car.vx * 0.7;
      car.angle = Math.PI - car.angle;
      bounced = true;
    }
    
    if (car.y <= -halfHeight + carSize) {
      car.y = -halfHeight + carSize;
      car.vy = -car.vy * 0.7;
      car.angle = -car.angle;
      bounced = true;
    }
    
    if (car.y >= halfHeight - carSize) {
      car.y = halfHeight - carSize;
      car.vy = -car.vy * 0.7;
      car.angle = -car.angle;
      bounced = true;
    }
    
    if (bounced) {
      car.targetAngle = car.angle;
      car.speed *= 0.9;
      
      if (car.type === 'bot') {
        car.targetAngle += (Math.random() - 0.5) * Math.PI * 0.5;
      }
    }
  }

  updateTrails(_deltaTime: number) {
    // Add trail points for active cars
    if (this.player && !this.player.destroyed) {
      this.addTrailPoint(this.player);
    }
    if (this.bot && !this.bot.destroyed) {
      this.addTrailPoint(this.bot);
    }
    // Add trail points for extra bots (LOD: only near camera)
    const camX = - (this.camera.x - (this.app!.screen.width / 2)) / this.camera.zoom;
    const camY = - (this.camera.y - (this.app!.screen.height / 2)) / this.camera.zoom;
    const lodRadius = 1200 / this.camera.zoom; // adaptive LOD radius
    for (const extraBot of this.extraBots) {
      if (!extraBot.destroyed) {
        const dx = extraBot.x - camX;
        const dy = extraBot.y - camY;
        if (dx*dx + dy*dy < lodRadius*lodRadius) {
          this.addTrailPoint(extraBot);
        }
      }
    }
    
    // Update and clean trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      const now = Date.now();
      
      // Remove old points
      const maxAge = 3.0;
      trail.points = trail.points.filter(point => {
        return (now - point.time) / 1000 <= maxAge;
      });
      
      // Remove trail if no points left
      if (trail.points.length === 0) {
        if (trail.graphics && trail.graphics.parent && this.trailContainer) {
          try { this.trailContainer.removeChild(trail.graphics); } catch {}
          try { trail.graphics.destroy(); } catch {}
        }
        this.trails.splice(i, 1);
      } else {
        // Update trail visuals
        this.renderTrail(trail);
        // Playful feedback: near-miss toast (once every ~2s max)
        try {
          const p = this.player;
          if (p && !p.destroyed && trail.car !== p && trail.points.length >= 2) {
            const a = trail.points[trail.points.length - 2];
            const b = trail.points[trail.points.length - 1];
            const d = this.pointToLineDistance(p.x, p.y, a.x, a.y, b.x, b.y);
            if (d < 28) {
              const nowT = Date.now();
              if (nowT - this.lastToastAt > 2000) {
                this.lastToastAt = nowT;
                const el = document.getElementById('game-toast');
                if (el) {
                  el.textContent = d < 16 ? 'Nice dodge!' : 'So close!';
                  el.style.opacity = '1';
                  setTimeout(() => { try { el.style.opacity = '0'; } catch {} }, 900);
                }
              }
            }
          }
        } catch {}
      }
    }
  }

  addTrailPoint(car: Car) {
    const now = Date.now();
    const interval = 30;
    
    if (now - car.lastTrailTime > interval) {
      if (!this.trailContainer) {
        // Safety: lazily initialize trail container if setupWorld hasn't run yet
        try {
          this.trailContainer = new PIXI.Container();
          this.trailContainer.visible = true;
          this.trailContainer.alpha = 1.0;
          this.worldContainer?.addChild?.(this.trailContainer as any);
        } catch {}
        if (!this.trailContainer) return;
      }
      // Get or create trail for this car
      let trail = this.trails.find(t => t.carId === car.type);
      if (!trail) {
        trail = {
          carId: car.type,
          car: car,
          points: [],
          graphics: new PIXI.Graphics()
        };
        this.trails.push(trail);
        try { this.trailContainer.addChild(trail.graphics); } catch {}
      }
      
      // Add new point
      trail.points.push({
        x: car.x,
        y: car.y,
        time: now,
        isBoosting: car.isBoosting
      });
      
      car.lastTrailTime = now;
      
      // Limit trail length
      if (trail.points.length > 60) {
        trail.points.shift();
      }
    }
  }

  renderTrail(trail: Trail) {
    if (!trail.graphics || trail.points.length < 2) return;
    
    trail.graphics.clear();
    const now = Date.now();
    const car = trail.car;
    
    // Trail colors
    const trailColor = car.type === 'player' ? this.theme.accent : this.theme.enemy;
    
    // Collect recent points and optionally decimate for far bots
    const isBot = trail.car.type !== 'player';
    const camX = - (this.camera.x - (this.app!.screen.width / 2)) / this.camera.zoom;
    const camY = - (this.camera.y - (this.app!.screen.height / 2)) / this.camera.zoom;
    const dxCam = trail.car.x - camX;
    const dyCam = trail.car.y - camY;
    const far = (dxCam*dxCam + dyCam*dyCam) > (1600*1600);
    const step = (isBot && far) ? 2 : 1;
    const pts: Array<{x:number;y:number;time:number;isBoosting:boolean}> = [];
    for (let i = 0; i < trail.points.length; i += step) {
      const p = trail.points[i];
      const age = (now - p.time) / 1000;
      if (age <= 3.0) pts.push(p);
    }
    if (pts.length < 2) return;
    
    // Smooth quadratic path through midpoints for a fluent curve
    const baseWidth = (car.type === 'player') ? 2 : 1.6; // thinner overall
    const alphaStart = 1.0;
    // Build path from first midpoint
    const p0 = pts[0];
    const p1 = pts[1];
    const m0x = (p0.x + p1.x) * 0.5;
    const m0y = (p0.y + p1.y) * 0.5;
    trail.graphics.moveTo(m0x, m0y);
    for (let i = 1; i < pts.length - 1; i++) {
      const c = pts[i];
      const n = pts[i + 1];
      const mx = (c.x + n.x) * 0.5;
      const my = (c.y + n.y) * 0.5;
      trail.graphics.quadraticCurveTo(c.x, c.y, mx, my);
    }
    // Stroke once with round caps/joins and alpha gradient approximation (single alpha for perf)
    trail.graphics.stroke({ width: baseWidth, color: trailColor, alpha: alphaStart, cap: 'round', join: 'round' });

    // Proximity glow (subtle, thinner) using segment checks
    if (this.player && trail.car !== this.player && pts.length >= 2) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dist = this.pointToLineDistance(this.player.x, this.player.y, a.x, a.y, b.x, b.y);
        if (dist < 60) {
          const glowAlpha = Math.max(0, 0.25 * (1 - dist / 60));
      trail.graphics
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ width: baseWidth + 1, color: this.theme.enemyGlow, alpha: glowAlpha, cap: 'round', join: 'round' });
        }
      }
    }
  }

  checkTrailCollisions() {
    const cars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null && !car.destroyed);

    for (const car of cars) {
      let closestMiss = Infinity; // Track closest near-miss for this frame
      let missX = 0, missY = 0;
      
      for (const trail of this.trails) {
        if (trail.points.length < 2) continue;

        const now = Date.now();
        const isSelfTrail = trail.car === car;
        
        // REMOVE SELF-COLLISION - Players can't die from their own trail
        if (isSelfTrail) continue;

        // Check collision with trail points
        for (let i = 1; i < trail.points.length; i++) {
          const p1 = trail.points[i - 1];
          const p2 = trail.points[i];
          const age = (now - p2.time) / 1000;

          // Skip old points
          if (age > 3.0) continue;

          const distance = this.pointToLineDistance(car.x, car.y, p1.x, p1.y, p2.x, p2.y);
          const hitboxSize = p2.isBoosting ? 12 : 6;

          if (distance < hitboxSize) {
            // Attribute kill to trail owner
            this.recordKill(trail.car, car);
            this.destroyCar(car);
            break;
          }
          
          // NEAR-MISS DETECTION - Reward skillful dodging!
          if (car === this.player && distance < 40 && distance < closestMiss) {
            closestMiss = distance;
            missX = (p1.x + p2.x) / 2;
            missY = (p1.y + p2.y) / 2;
          }
        }

        if (car.destroyed) break;
      }
      
      // Show near-miss notification if player had a close call
      if (car === this.player && closestMiss < 40 && Math.random() < 0.3) { // 30% chance to show (avoid spam)
        this.showNearMiss(missX, missY, closestMiss);
      }
    }
  }

  recordKill(killer: Car, victim: Car) {
    if (!killer || !victim) return;
    killer.kills = (killer.kills || 0) + 1;
    this.recentKills.push({ killer: killer.name, victim: victim.name, time: Date.now() });

    // Kill streak tracking for player
    if (killer === this.player) {
      const now = Date.now();
      
      // COMBO SYSTEM - Increases multiplier for rapid kills
      if (now - this.lastComboTime < this.comboWindowMs) {
        this.comboKills++;
        this.comboMultiplier = 1 + (this.comboKills * 0.25); // +25% per combo kill
      } else {
        this.comboKills = 0;
        this.comboMultiplier = 1;
      }
      this.lastComboTime = now;
      
      // Reset streak if more than 5 seconds since last kill
      if (now - this.lastKillTime > 5000) {
        this.killStreak = 0;
      }
      this.killStreak++;
      this.lastKillTime = now;

      // Show enhanced combo notification with screen shake!
      if (this.killStreak >= 2 || this.comboKills >= 1) {
        this.showComboNotification(victim.x, victim.y, this.killStreak);
      }

      // Enhanced haptic feedback based on combo
      if (this.comboKills >= 3) {
        this.hapticFeedback('heavy'); // Epic combo!
      } else if (this.killStreak >= 2) {
        this.hapticFeedback('success'); // Multi-kill
      } else {
        this.hapticFeedback('medium'); // Regular kill
      }
      
      // Screen shake intensity based on streak
      const shakeIntensity = Math.min(this.killStreak * 0.5, 3);
      this.screenShake(shakeIntensity);
    }
  }

  showKillStreakNotification(streak: number, x: number, y: number) {
    const streakTexts: Record<number, string> = {
      2: '🔥 DOUBLE KILL',
      3: '⚡ TRIPLE KILL',
      4: '💥 MEGA KILL',
      5: '🌟 ULTRA KILL',
      6: '👑 MONSTER KILL',
      7: '💀 KILLING SPREE',
      8: '🔥 UNSTOPPABLE',
      10: '⭐ LEGENDARY'
    };

    const text = streakTexts[streak] || `🔥 ${streak}x STREAK`;
    this.killStreakNotifications.push({ text, time: Date.now(), x, y });

    // Keep only last 5 notifications
    if (this.killStreakNotifications.length > 5) {
      this.killStreakNotifications.shift();
    }
  }

  pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
    const projection = {
      x: x1 + t * dx,
      y: y1 + t * dy
    };
    
    return Math.sqrt((px - projection.x) * (px - projection.x) + (py - projection.y) * (py - projection.y));
  }

  destroyCar(car: Car) {
    if (car.destroyed) return;

    car.destroyed = true;
    car.elimAtMs = Date.now();
    car.sprite.visible = false;

    // Haptic feedback on death (mobile)
    if (car === this.player) {
      try { navigator.vibrate?.([100, 50, 100]); } catch {}
      
      // RESET KILL STREAK WHEN PLAYER DIES
      this.killStreak = 0;
      this.comboKills = 0;
      this.comboMultiplier = 1;
      this.lastKillTime = 0;
      this.lastComboTime = 0;
    }

    // Ensure all visual parts are removed/destroyed to avoid lingering head/tail
    try { if (car.headGraphics) { car.headGraphics.destroy(); car.headGraphics = undefined; } } catch {}
    try { if (car.tailGraphics) { car.tailGraphics.destroy(); car.tailGraphics = null; } } catch {}
    try { if ((car.sprite as any)?.parent) { (car.sprite as any).parent.removeChild(car.sprite); } } catch {}
    try { (car.sprite as any)?.destroy?.({ children: false }); } catch {}
    try { const np = (car as any).nameplate as HTMLDivElement | undefined; if (np && np.parentElement) np.parentElement.removeChild(np); (car as any).nameplate = undefined; } catch {}

    // Battle Royale: No respawning, permanent elimination
    car.respawnTimer = -1; // Never respawn
    
    // Clear and remove car's trail immediately
    const tIdx = this.trails.findIndex(t => t.car === car);
    if (tIdx >= 0) {
      const trail = this.trails[tIdx];
      trail.points = [];
      try {
        if (trail.graphics && trail.graphics.parent) trail.graphics.parent.removeChild(trail.graphics);
        trail.graphics.destroy();
      } catch {}
      this.trails.splice(tIdx, 1);
    }
    
    // Create explosion effect
    this.createExplosion(car.x, car.y, car.color);

    // Flash only if death is near player (within viewport)
    if (this.player && !this.player.destroyed) {
      const dx = car.x - this.player.x;
      const dy = car.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const viewportRadius = Math.max(window.innerWidth, window.innerHeight) / 2;

      if (dist < viewportRadius) {
        try {
          let flash = document.getElementById('elim-flash');
          if (!flash) {
            flash = document.createElement('div');
            flash.id = 'elim-flash';
            flash.style.cssText = `
              position: fixed;
              inset: 0;
              background: rgba(255,255,255,0.8);
              pointer-events: none;
              z-index: 9999;
              opacity: 0;
              transition: opacity 220ms ease-out;
            `;
            document.body.appendChild(flash);
          }
          // Trigger flash
          flash.style.opacity = '0.35';
          setTimeout(() => { try { flash!.style.opacity = '0'; } catch {} }, 10);
          setTimeout(() => {
            try { if (flash && flash.parentElement) flash.parentElement.removeChild(flash); } catch {}
          }, 280);
        } catch {}
      }
    }
    
    // Update alive count and handle elimination flow
    this.updateAliveCount();
    
    // If player died, show death screen immediately (practice only; tournament uses App Results)
    if (car === this.player && this.gamePhase === 'active' && !(this.wsHud && this.wsHud.active)) {
      // Calculate player's rank at time of death
      const playerRank = this.alivePlayers + 1;
      setTimeout(() => {
        this.showGameOverScreen(false, playerRank);
      }, 1000); // Short delay to see explosion
      this.gamePhase = 'finished';
    }
    // Check for game end (only if player is still alive)
    else if (this.alivePlayers <= 1 && this.gamePhase === 'active' && this.player && !this.player.destroyed) {
      this.endGame();
    }
  }

  createExplosion(x: number, y: number, color: number) {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const speed = 100 + Math.random() * 100;
      const particle: Particle = {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        graphics: new PIXI.Graphics()
      };
      
      particle.graphics.circle(0, 0, 3).fill(color);
      particle.graphics.x = x;
      particle.graphics.y = y;
      
      this.worldContainer.addChild(particle.graphics);
      this.particles.push(particle);
    }
  }

  updateParticles(deltaTime: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.life -= deltaTime * 2;
      
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      particle.graphics.alpha = Math.max(0, particle.life);
      
      if (particle.life <= 0) {
        this.worldContainer.removeChild(particle.graphics);
        this.particles.splice(i, 1);
      }
    }
  }

  updatePickups(deltaTime: number) {
    if (!this.pickupsContainer) return;
    const t = Date.now() * 0.001;
    // Pulse visuals
    for (const p of this.pickups) {
      p.pulseT += deltaTime * 2;
      const s = 1 + Math.sin(p.pulseT) * 0.06;
      p.shape.scale.set(s);
      p.shape.alpha = 0.7 + Math.sin(t + p.pulseT) * 0.15;
      // Rotate the triad shard
      p.shape.rotation += p.rotationSpeed * deltaTime;
      // Add a faint neon aura
      p.aura.clear();
      p.aura.circle(0, 0, p.radius * (1.15 + Math.sin(t * 1.5) * 0.05)).stroke({ width: 1, color: p.color, alpha: 0.08 });
    }
    // Check collection by player
    if (this.player && !this.player.destroyed) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const orb = this.pickups[i];
        const dx = orb.x - this.player.x;
        const dy = orb.y - this.player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < orb.radius + 18) {
          // Collect
          if (orb.type === 'energy') {
            this.player.boostEnergy = Math.min(this.player.maxBoostEnergy, this.player.boostEnergy + orb.amount);
          }
          // Burst effect
          this.createExplosion(orb.x, orb.y, 0x00ffaa);
          this.pickupsContainer.removeChild(orb.graphics);
          this.pickups.splice(i, 1);
          
          // Satisfying pickup feedback!
          this.hapticFeedback('light');
          this.screenShake(0.3);
        }
      }
    }
    // Maintain a minimum number of pickups on map
    if (this.pickups.length < 25) this.spawnPickups(8);
  }

  handleRespawning(_deltaTime: number) {
    // Battle Royale: No respawning - players stay dead permanently
    // This method is kept for potential future modes but does nothing in BR
  }

  updateAliveCount() {
    const allCars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null);
    this.alivePlayers = allCars.filter(car => !car.destroyed).length;

    // Update UI counter
    const aliveCounter = document.getElementById('game-alive-counter');
    if (aliveCounter) {
      // Fix: Use template literal properly to avoid glitch
      const aliveText = `ALIVE: ${this.alivePlayers}`;
      if (aliveCounter.textContent !== aliveText) {
        aliveCounter.textContent = aliveText;
      }

      // Change color based on alive count
      if (this.alivePlayers <= 3) {
        aliveCounter.style.color = '#ff66aa';
        aliveCounter.style.borderColor = '#ff66aa';
        aliveCounter.style.textShadow = '0 0 10px rgba(255, 102, 170, 0.8)';
      } else if (this.alivePlayers <= 5) {
        aliveCounter.style.color = '#ffaa00';
        aliveCounter.style.borderColor = '#ffaa00';
        aliveCounter.style.textShadow = '0 0 10px rgba(255, 170, 0, 0.8)';
      } else {
        aliveCounter.style.color = '#00ffff';
        aliveCounter.style.borderColor = '#00ffff';
        aliveCounter.style.textShadow = '';
      }
    }
  }

  endGame() {
    this.gamePhase = 'finished';
    const allCars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null);
    const aliveCars = allCars.filter(car => !car.destroyed);
    const winner = aliveCars[0];
    
    // Calculate player rank (8 - current alive count + 1 if player is alive)
    let playerRank;
    if (this.player && !this.player.destroyed) {
      playerRank = 1; // Player won
    } else {
      // Player died - rank is based on when they died
      playerRank = this.alivePlayers + 1;
    }
    
    // Practice-only overlay; tournament shows App-level Results
    if (!(this.wsHud && this.wsHud.active)) {
    this.showGameOverScreen(winner === this.player, playerRank);
    }
  }

  showGameOverScreen(isVictory: boolean, rank: number) {
    // Save player stats
    const totalPlayersCount = (this.wsHud && this.wsHud.active)
      ? (Object.keys(this.wsHud.idToName || {}).length || 0)
      : ([this.player, this.bot, ...this.extraBots].filter(c=>!!c).length);
    const kills = this.player?.kills || 0;
    this.savePlayerStats(isVictory, 0, kills, rank, totalPlayersCount);

    // Create main overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: var(--font-sans, 'Inter', sans-serif);
      animation: fadeIn 0.3s ease;
    `;

    // Create content container
    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(99,102,241,0.15));
      border: 2px solid ${isVictory ? 'rgba(34,211,238,0.6)' : 'rgba(244,63,94,0.6)'};
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      max-width: 520px;
      width: 92%;
      backdrop-filter: blur(10px);
      animation: slideUp 0.4s ease;
    `;

    // Main title
    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 42px;
      margin: 0 0 12px 0;
      background: ${isVictory ? 'linear-gradient(90deg, #22d3ee, #6366f1)' : 'linear-gradient(90deg, #f43f5e, #fb923c)'};
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 900;
      letter-spacing: -0.02em;
      text-shadow: 0 4px 20px rgba(255,255,255,0.2);
    `;
    title.textContent = isVictory ? '👑 VICTORY' : '💀 ELIMINATED';

    // Rank display
    const rankDisplay = document.createElement('div');
    rankDisplay.style.cssText = `
      font-size: 24px;
      margin: 8px 0 20px 0;
      color: #ffffff;
      font-weight: 700;
    `;
    // Use computed totalPlayersCount above
    rankDisplay.textContent = isVictory
      ? `🏆 Champion`
      : `Rank #${rank} / ${totalPlayersCount}`;

    // Stats container
    const stats = document.createElement('div');
    stats.style.cssText = `
      margin: 12px 0 24px 0;
      padding: 20px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    `;

    const survivalTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const minutes = Math.floor(survivalTime / 60);
    const seconds = survivalTime % 60;

    const eliminated = Math.max(0, (totalPlayersCount - this.alivePlayers - (this.player?.destroyed ? 0 : 1)));
    stats.innerHTML = `
      <div style="color:#ffffff; font-size: 16px; font-weight:700; margin-bottom: 12px;">⚡ Battle Stats</div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">⏱️ Survived</span>
        <span style="color:#ffffff; font-size: 14px; font-weight:600;">${minutes}:${seconds.toString().padStart(2, '0')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">💀 Knockouts</span>
        <span style="color:#ffffff; font-size: 14px; font-weight:600;">${eliminated}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">📊 Placement</span>
        <span style="color:#ffffff; font-size: 14px; font-weight:600;">#${rank}/${totalPlayersCount}</span>
      </div>
    `;

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 20px;
      margin-top: 30px;
      justify-content: center;
      flex-wrap: wrap;
    `;

    // Quick Replay button
    const replayBtn = document.createElement('button');
    replayBtn.textContent = isVictory ? 'Another lap' : 'Run it back';
    replayBtn.style.cssText = `
      background: ${this.theme.accent ? '#22d3ee' : '#22d3ee'};
      border: 1px solid rgba(255,255,255,0.12);
      color: #03242b;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: transform 120ms ease;
      box-shadow: 0 6px 14px rgba(0,0,0,0.28);
      font-family: inherit;
    `;
    replayBtn.onmouseover = () => { replayBtn.style.transform = 'translateY(-1px)'; };
    replayBtn.onmouseout = () => { replayBtn.style.transform = 'translateY(0)'; };
    replayBtn.onclick = () => {
      overlay.remove();
      // Always restart locally to ensure a clean replay without relying on parent screen changes
      try { this.restartGame(); } catch {}
      // Optionally notify parent after a tick if it wants to react (e.g., practice flow)
      try { setTimeout(() => { this.onReplay && this.onReplay(); }, 0); } catch {}
    };

    // Back to Menu button
    const menuBtn = document.createElement('button');
    menuBtn.textContent = 'Back to menu';
    menuBtn.style.cssText = `
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.12);
      color: ${this.theme.text};
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: transform 120ms ease;
      box-shadow: 0 6px 14px rgba(0,0,0,0.28);
      font-family: inherit;
    `;
    menuBtn.onmouseover = () => { menuBtn.style.transform = 'translateY(-1px)'; };
    menuBtn.onmouseout = () => { menuBtn.style.transform = 'translateY(0)'; };
    menuBtn.onclick = () => {
      overlay.remove();
      // Call the parent's onExit callback if available
      if (this.onExit) {
        this.onExit();
      }
    };

    // Assemble the overlay
    buttonsContainer.appendChild(replayBtn);
    buttonsContainer.appendChild(menuBtn);
    
    content.appendChild(title);
    content.appendChild(rankDisplay);
    content.appendChild(stats);
    content.appendChild(buttonsContainer);
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Subtle confetti sprinkle on victory
    if (isVictory) {
      const count = 30;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.top = '-10px';
        p.style.left = `${(i / count) * 100}%`;
        p.style.width = '6px';
        p.style.height = '10px';
        p.style.background = i % 3 === 0 ? '#22d3ee' : (i % 3 === 1 ? '#9aa7b5' : '#ffffff');
        p.style.opacity = '0.95';
        p.style.borderRadius = '2px';
        p.style.transform = `translateY(0) rotate(${Math.random() * 60 - 30}deg)`;
        p.style.transition = 'transform 700ms ease-out, opacity 700ms ease-out';
        p.style.zIndex = '2100';
        document.body.appendChild(p);
        // trigger
        requestAnimationFrame(() => {
          const drift = (Math.random() * 200 - 100);
          p.style.transform = `translateY(${window.innerHeight + 40}px) translateX(${drift}px) rotate(${Math.random() * 360}deg)`;
          p.style.opacity = '0';
        });
        setTimeout(() => { try { p.remove(); } catch {} }, 900);
      }
    }
  }

  restartGame() {
    // Reset game state
    this.gamePhase = 'active';
    this.gameStartTime = Date.now();
    this.radarPings = [];
    this.alivePlayers = 8;
    this.preStart = { startAt: Date.now(), durationMs: 3000 };
    // Reset deferred systems
    this.artifactsUnlocked = false;
    this.pickupsUnlocked = false;
    if (this.artifactContainer) this.artifactContainer.visible = false;
    if (this.pickupsContainer) this.pickupsContainer.visible = false;
    // Clear pickups/artifacts
    try { this.pickupsContainer?.removeChildren?.(); } catch {}
    this.pickups = [];
    try { this.artifactContainer?.removeChildren?.(); } catch {}
    
    // Reset all cars
    if (this.player) {
      this.player.destroyed = false;
      this.player.sprite.visible = true;
      (this.player.sprite as any).zIndex = 50;
      // Use spawn queue positions to avoid overlap and ensure on-screen spawn
      const s = this.spawnQueue[0] || { x: 0, y: 0, angle: 0 };
      this.player.x = s.x;
      this.player.y = s.y;
      this.player.angle = s.angle;
      this.player.targetAngle = s.angle;
      this.player.vx = 0;
      this.player.vy = 0;
      if (this.player.sprite) {
        this.player.sprite.x = this.player.x;
        this.player.sprite.y = this.player.y;
        this.player.sprite.rotation = this.player.angle;
      }
    }
    
    if (this.bot) {
      this.bot.destroyed = false;
      this.bot.sprite.visible = true;
      (this.bot.sprite as any).zIndex = 50;
      const s0 = this.spawnQueue[1] || { x: 200, y: 0, angle: Math.PI };
      this.bot.x = s0.x;
      this.bot.y = s0.y;
      this.bot.angle = s0.angle;
      this.bot.targetAngle = s0.angle;
      this.bot.vx = 0;
      this.bot.vy = 0;
      if (this.bot.sprite) {
        this.bot.sprite.x = this.bot.x;
        this.bot.sprite.y = this.bot.y;
        this.bot.sprite.rotation = this.bot.angle;
      }
    }
    
    for (let i = 0; i < this.extraBots.length; i++) {
      const extraBot = this.extraBots[i];
      extraBot.destroyed = false;
      extraBot.sprite.visible = true;
      const s = this.spawnQueue[2 + i] || this.randomEdgeSpawn();
      extraBot.x = s.x;
      extraBot.y = s.y;
      extraBot.angle = s.angle;
      extraBot.targetAngle = s.angle;
      extraBot.vx = 0;
      extraBot.vy = 0;
      if (extraBot.sprite) {
        extraBot.sprite.x = extraBot.x;
        extraBot.sprite.y = extraBot.y;
        extraBot.sprite.rotation = extraBot.angle;
      }
    }
    
    // Clear all trails
    this.trails.forEach(trail => {
      trail.points = [];
    });
    try { this.trailContainer?.removeChildren?.(); } catch {}
    this.trails = [];
    
    // Clear particles
    this.particles = [];
    try { this.borderGraphics && this.drawArenaBorder(); } catch {}
    
    // Update alive counter
    this.updateAliveCount();
  }

  respawnCar(_car: Car, _x: number, _y: number) {
    // BR mode has no respawn. Method kept for future modes.
  }

  updateRadar() {
    if (!this.radarCtx || !this.player) return;
    
    // Check if mobile - use proximity radar
    const isMobile = this.radar.id === 'game-proximity-radar';
    if (isMobile) {
      this.updateProximityRadar();
      return;
    }
    
    const ctx = this.radarCtx;
    const W = this.radar.width;
    const H = this.radar.height;
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = Math.min(W, H) / 2 - 5;
    
    // Clear canvas
    ctx.clearRect(0, 0, W, H);
    
    // Draw radar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw radar rings
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Fit rectangle diagonal to radar circle for max map size inside sonar
    const rFit = radius - 3;
    const diag = Math.sqrt(this.arena.width * this.arena.width + this.arena.height * this.arena.height);
    const scale = (rFit * 2) / Math.max(1, diag);
    const arenaW = this.arena.width * scale;
    const arenaH = this.arena.height * scale;
    // Map rect
    const rectL = centerX - arenaW/2;
    const rectR = centerX + arenaW/2;
    const rectT = centerY - arenaH/2;
    const rectB = centerY + arenaH/2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rectL, rectT, arenaW, arenaH);
    
    // Function to check if a point is within the sonar sweep beam
    const isInSweepBeam = (x: number, y: number) => {
      const dx = x - centerX;
      const dy = y - centerY;
      let angle = Math.atan2(dy, dx);
      
      // Normalize angles to 0-2π range
      if (angle < 0) angle += Math.PI * 2;
      let sweepAngle = this.radarAngle;
      if (sweepAngle < 0) sweepAngle += Math.PI * 2;
      
      // Calculate angular difference
      let diff = Math.abs(angle - sweepAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      
      // Beam width is about 0.6 radians (±0.3)
      return diff <= 0.3;
    };
    
    // Only draw objects if they're in the sweep beam OR if they're the player (always visible)
    
    // Draw player (only if inside map rect)
    if (!this.player.destroyed) {
      const px = centerX + (this.player.x * scale);
      const py = centerY + (this.player.y * scale);
      if (px >= rectL && px <= rectR && py >= rectT && py <= rectB) {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        // Player direction indicator
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(this.player.angle) * 6, py + Math.sin(this.player.angle) * 6);
        ctx.stroke();
      }
    }
    
    // Check for bots being detected by sweep and add pings
    const allBots = [this.bot, ...this.extraBots].filter((bot): bot is Car => bot !== null && !bot.destroyed);
    const now = Date.now();
    
    for (const bot of allBots) {
      const bx = centerX + (bot.x * scale);
      const by = centerY + (bot.y * scale);
      
      // If bot is in sweep beam and inside map rect, add/update ping
      if (isInSweepBeam(bx, by) && bx >= rectL && bx <= rectR && by >= rectT && by <= rectB) {
        // Remove old ping for this bot
        this.radarPings = this.radarPings.filter(ping => ping.playerId !== bot.type);
        
        // Add new ping
        this.radarPings.push({
          x: bot.x,
          y: bot.y,
          timestamp: now,
          playerId: bot.type
        });
      }
    }
    
    // Remove expired pings (older than ttl or 1s default)
    this.radarPings = this.radarPings.filter(ping => now - ping.timestamp < (ping.ttlMs || 1000));
    // Remove expired echo pings
    this.echoPings = this.echoPings.filter(p => now - p.timestamp < (p.ttlMs || 900));
    
    // Draw all active sweep pings
    for (const ping of this.radarPings) {
      const px = centerX + (ping.x * scale);
      const py = centerY + (ping.y * scale);
      const age = (now - ping.timestamp) / 1000;
      const alpha = Math.max(0.2, 1 - age);
      ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2); // Slightly larger dot
      ctx.fill();
      
      // Add pulsing effect
      if (age < 0.3) { // Pulse for first 300ms
        const pulseRadius = 2 + Math.sin(age * 20) * 2;
        ctx.strokeStyle = `rgba(255, 0, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw echo rings from boost events (inside map rect only)
    for (const ping of this.echoPings) {
      const ex = centerX + (ping.x * scale);
      const ey = centerY + (ping.y * scale);
      const elapsed = (now - ping.timestamp) / 1000;
      const life = (ping.ttlMs || 0) / 1000 || 0.9;
      const tnorm = Math.min(1, elapsed / life);
      const r = tnorm * radius * 0.9;
      const a = Math.max(0, 0.6 * (1 - tnorm));
      if (ex >= rectL && ex <= rectR && ey >= rectT && ey <= rectB) {
        ctx.strokeStyle = `rgba(0, 255, 200, ${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ex, ey, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Draw sonar sweep wedge limited to map rectangle
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.radarAngle);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rFit);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(0, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = gradient;
    const rx = arenaW / 2, ry = arenaH / 2;
    const sweepHalf = 0.3; // radians
    const steps = 28;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) {
      const t = -sweepHalf + (i / steps) * (2 * sweepHalf);
      const c = Math.cos(t), s = Math.sin(t);
      const tx = c === 0 ? Number.POSITIVE_INFINITY : rx / Math.abs(c);
      const ty = s === 0 ? Number.POSITIVE_INFINITY : ry / Math.abs(s);
      const rTheta = Math.min(tx, ty);
      ctx.lineTo(c * rTheta, s * rTheta);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  updateBoostBar() {
    if (!this.player) return;
    
    const boostBarFill = document.getElementById('game-boost-fill');
    const boostBarLabel = document.getElementById('game-boost-label');
    
    if (!boostBarFill || !boostBarLabel) return;
    
    const energyPercent = (this.player.boostEnergy / this.player.maxBoostEnergy) * 100;
    boostBarFill.style.width = energyPercent + '%';
    
    const boostingNow = this.player.isBoosting && (this.player.boostEnergy >= (this.player.minBoostEnergy + 5));
    if (boostingNow) {
      boostBarFill.style.background = '#22d3ee';
      boostBarLabel.textContent = `BOOSTING! (${Math.ceil(energyPercent)}%)`;
      boostBarLabel.style.color = '#00ff88';
      // Emit echo only on boost start (rising edge)
      if (!(this as any).wasBoostingUI) {
        this.emitBoostEcho(this.player.x, this.player.y);
      }
    } else if (this.player.boostEnergy < this.player.minBoostEnergy) {
      boostBarFill.style.background = '#ef4444';
      boostBarLabel.textContent = `BOOST LOW (${Math.ceil(energyPercent)}%)`;
      boostBarLabel.style.color = '#ff8888';
    } else {
      boostBarFill.style.background = '#22d3ee';
      boostBarLabel.textContent = `BOOST READY (${Math.ceil(energyPercent)}%)`;
      boostBarLabel.style.color = '#00ffff';
    }
    (this as any).wasBoostingUI = boostingNow;
    if (boostBarLabel) {
      const ready = this.player.boostEnergy >= (this.player.minBoostEnergy + 5);
      if (ready) {
        boostBarLabel.classList.add('hud-pulse');
        setTimeout(() => { try { boostBarLabel.classList.remove('hud-pulse'); } catch {} }, 220);
      }
    }
    
    // COMBO MULTIPLIER DISPLAY - Show when active!
    this.updateComboDisplay();
  }
  
  updateComboDisplay() {
    const now = Date.now();
    const comboActive = (now - this.lastComboTime) < this.comboWindowMs && this.comboKills > 0;
    
    let comboEl = document.getElementById('game-combo-display');
    if (!comboEl) {
      comboEl = document.createElement('div');
      comboEl.id = 'game-combo-display';
      comboEl.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        padding: 12px 20px;
        background: linear-gradient(135deg, rgba(251,146,60,0.95), rgba(244,63,94,0.95));
        border: 2px solid #fbbf24;
        border-radius: 12px;
        font-size: 20px;
        font-weight: 900;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(251,191,36,0.6);
        z-index: 1000;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(251,146,60,0.5), 0 0 20px rgba(244,63,94,0.3);
        transition: transform 0.2s, opacity 0.2s;
      `;
      document.body.appendChild(comboEl);
    }
    
    if (comboActive) {
      const timeLeft = this.comboWindowMs - (now - this.lastComboTime);
      const progress = timeLeft / this.comboWindowMs;
      const scale = 1 + (1 - progress) * 0.2; // Pulse as time runs out
      
      comboEl.textContent = `🔥 ${this.comboKills + 1}x COMBO! (${this.comboMultiplier.toFixed(1)}x)`;
      comboEl.style.display = 'block';
      comboEl.style.transform = `scale(${scale})`;
      comboEl.style.opacity = '1';
      comboEl.style.borderColor = progress < 0.3 ? '#ef4444' : '#fbbf24'; // Red when expiring
    } else {
      comboEl.style.opacity = '0';
      comboEl.style.transform = 'scale(0.8)';
      setTimeout(() => { comboEl!.style.display = 'none'; }, 200);
    }
  }

  updateTrailStatus() {
    const trailStatus = document.getElementById('game-trail-status');
    if (!trailStatus || !this.player) return;
    
    // Keep trail form consistent - just show status, don't change trail appearance
    if (this.player.isBoosting) {
      trailStatus.textContent = 'BOOSTING: ACTIVE';
      trailStatus.style.color = '#ff6600';
      trailStatus.style.borderColor = '#ff6600';
      trailStatus.style.textShadow = '';
      trailStatus.style.background = 'rgba(255, 102, 0, 0.1)';
    } else {
      trailStatus.textContent = 'TRAIL: ACTIVE';
      trailStatus.style.color = '#00ffff';
      trailStatus.style.borderColor = '#00ffff';
      trailStatus.style.textShadow = '';
      trailStatus.style.background = 'rgba(0, 0, 0, 0.7)';
    }
  }

  updateProximityRadar() {
    if (!this.radarCtx || !this.player || !this.app) return;
    
    // Throttle radar updates on mobile for better performance
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const now = performance.now();
      if (now - this.lastRadarUpdate < this.radarUpdateInterval) {
        return; // Skip this frame
      }
      this.lastRadarUpdate = now;
    }
    
    const ctx = this.radarCtx;
    const W = this.radar.width;
    const H = this.radar.height;
    ctx.clearRect(0, 0, W, H);
    const allCars = [this.bot, ...this.extraBots].filter((car): car is Car => car !== null && !car.destroyed);
    const detectionRange = 800;
    const viewWidth = W / this.camera.zoom;
    const viewHeight = H / this.camera.zoom;
    const viewLeft = this.player.x - viewWidth / 2;
    const viewRight = this.player.x + viewWidth / 2;
    const viewTop = this.player.y - viewHeight / 2;
    const viewBottom = this.player.y + viewHeight / 2;
    allCars.forEach(car => {
      const dx = car.x - this.player!.x;
      const dy = car.y - this.player!.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > detectionRange) return;
      const onScreen = car.x >= viewLeft && car.x <= viewRight && car.y >= viewTop && car.y <= viewBottom;
      if (onScreen) return;
      const angle = Math.atan2(dy, dx);
      const edgeMargin = 40;
      let indicatorX: number, indicatorY: number;
      const absAngle = Math.abs(angle);
      const aspectRatio = W / H;
      const cornerAngle = Math.atan(1 / aspectRatio);
      if (absAngle < cornerAngle) {
        indicatorX = W - edgeMargin;
        indicatorY = H / 2 + Math.tan(angle) * (W / 2 - edgeMargin);
      } else if (absAngle > Math.PI - cornerAngle) {
        indicatorX = edgeMargin;
        indicatorY = H / 2 - Math.tan(angle) * (W / 2 - edgeMargin);
      } else if (angle > 0) {
        indicatorY = H - edgeMargin;
        indicatorX = W / 2 + (H / 2 - edgeMargin) / Math.tan(angle);
      } else {
        indicatorY = edgeMargin;
        indicatorX = W / 2 - (H / 2 - edgeMargin) / Math.tan(angle);
      }
      indicatorX = Math.max(edgeMargin, Math.min(W - edgeMargin, indicatorX));
      indicatorY = Math.max(edgeMargin, Math.min(H - edgeMargin, indicatorY));
      const opacity = 1 - (dist / detectionRange);
      ctx.save();
      ctx.translate(indicatorX, indicatorY);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(255, 80, 80, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(-8, 12);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 120, 120, ${opacity * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(dist)}`, indicatorX, indicatorY - 18);
    });
  }

  updateBoostScreenEffects() {
    if (!this.player) return;
    
    // Get or create boost overlay
    let boostOverlay = document.getElementById('boost-screen-overlay');
    if (!boostOverlay) {
      boostOverlay = document.createElement('div');
      boostOverlay.id = 'boost-screen-overlay';
      boostOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        background: radial-gradient(ellipse at center, transparent 60%, rgba(0, 255, 255, 0.1) 100%);
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      this.uiContainer.appendChild(boostOverlay);
    }
    
    const visualBoosting = this.player.isBoosting && (this.player.boostEnergy >= (this.player.minBoostEnergy + 5));
    if (visualBoosting) {
      // Boost active - soft vignette + radial blur imitation (no shake)
      boostOverlay.style.opacity = '0.24';
      const t = Date.now() * 0.002;
      // layered radial gradients to suggest speed lines
      boostOverlay.style.background = `
        radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 60%),
        radial-gradient(ellipse at 50% 50%, rgba(34, 211, 238, 0.05), transparent 65%),
        conic-gradient(from ${t}rad, rgba(34,211,238,0.06), rgba(34,211,238,0.0) 15%, rgba(255,255,255,0.04) 30%, rgba(34,211,238,0.0) 45%, rgba(255,102,0,0.06) 60%, rgba(34,211,238,0.0) 75%, rgba(255,255,255,0.04) 90%, rgba(34,211,238,0.06))
      `;
      // Accent the player head with a glow while boosting
      try { this.player.headGraphics!.filters = [new (PIXI as any).filters.BlurFilter({ strength: 2 })]; } catch {}
    } else {
      // Boost not active - fade out effects and clear filters
      boostOverlay.style.opacity = '0';
      try { this.player.headGraphics!.filters = []; } catch {}
      document.body.style.transform = 'translate(0px, 0px)';
    }
  }

  setupZone() {
    if (!this.app) return;
    // Initialize zone params to arena
    this.zone.centerX = 0;
    this.zone.centerY = 0;
    this.zone.startRadius = Math.min(this.arena.width, this.arena.height) * 0.48;
    this.zone.startAtMs = Date.now();
    // Target 90–100s rounds for stronger pacing
    this.zone.durationMs = 100000; // 100s
    this.zoneGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.zoneGraphics);

    // Rectangular slicer init
    this.rectZone.left = -this.arena.width / 2;
    this.rectZone.right = this.arena.width / 2;
    this.rectZone.top = -this.arena.height / 2;
    this.rectZone.bottom = this.arena.height / 2;
    // Seed-of-the-day pattern and first slice selection
    this.daySeed = this.computeDaySeed();
    this.slicePattern = this.buildSlicePattern(this.daySeed);
    this.sliceIndex = 0;
    // Avoid slicing toward first spawns: pick opposite of dominant spawn side (left/right) for first slice
    const dominantEdge: 'left'|'right'|'top'|'bottom' = 'left';
    const opposite: Record<'left'|'right'|'top'|'bottom','left'|'right'|'top'|'bottom'> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    this.firstSliceSide = opposite[dominantEdge];
    this.rectZone.pendingSide = this.firstSliceSide;
    this.rectZone.lastSide = null;
    this.rectZone.nextSliceAt = Date.now() + this.rectZone.telegraphMs; // telegraph the first one sooner
    this.rectZone.pendingSide = null;
  }

  updateZoneAndDamage(deltaTime: number) {
    if (!this.zoneGraphics) return;
    const now = Date.now();
    // Rectangular slicer: periodically push one side inward
    if (!this.rectZone.pendingSide && now >= this.rectZone.nextSliceAt - this.rectZone.telegraphMs) {
      // Use seeded daily pattern, avoid immediate repeats
      let side: 'left'|'right'|'top'|'bottom';
      if (this.firstSliceSide) {
        side = this.firstSliceSide;
        this.firstSliceSide = null;
      } else {
        if (!this.slicePattern || this.slicePattern.length === 0) {
          this.slicePattern = this.buildSlicePattern(this.daySeed || this.computeDaySeed());
          this.sliceIndex = 0;
        }
        let tries = 0;
        do {
          side = this.slicePattern[this.sliceIndex % this.slicePattern.length];
          this.sliceIndex++;
          tries++;
        } while (tries < 4 && side === this.rectZone.lastSide);
      }
      this.rectZone.pendingSide = side!;
    }
    if (now >= this.rectZone.nextSliceAt) {
      // Perform slice
      const side = this.rectZone.pendingSide || 'left';
      const step = this.rectZone.sliceStep;
      if (side === 'left') this.rectZone.left = Math.min(this.rectZone.right - this.rectZone.minWidth, this.rectZone.left + step);
      if (side === 'right') this.rectZone.right = Math.max(this.rectZone.left + this.rectZone.minWidth, this.rectZone.right - step);
      if (side === 'top') this.rectZone.top = Math.min(this.rectZone.bottom - this.rectZone.minHeight, this.rectZone.top + step);
      if (side === 'bottom') this.rectZone.bottom = Math.max(this.rectZone.top + this.rectZone.minHeight, this.rectZone.bottom - step);
      this.rectZone.lastSide = side;
      this.rectZone.pendingSide = null;
      this.rectZone.nextSliceAt = now + this.rectZone.sliceIntervalMs;
    }
    // Draw rectangular safe zone and telegraph
    this.zoneGraphics.clear();
    // Safe rectangle
    this.zoneGraphics
      .rect(this.rectZone.left, this.rectZone.top, this.rectZone.right - this.rectZone.left, this.rectZone.bottom - this.rectZone.top)
      .stroke({ width: 2, color: this.theme.accent, alpha: 0.22 });
    // Telegraph arrow on pending side
    if (this.rectZone.pendingSide) {
      const remain = Math.max(0, this.rectZone.nextSliceAt - now);
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.01);
      const alpha = 0.25 + 0.5 * (1 - remain / this.rectZone.telegraphMs);
      const g = this.zoneGraphics;
      const size = 80;
      g.moveTo(0,0); // reset path start
      if (this.rectZone.pendingSide === 'left') {
        const x = this.rectZone.left; const cy = (this.rectZone.top + this.rectZone.bottom) / 2;
        g.poly([x-10, cy, x-10-size, cy-size, x-10-size, cy+size]).fill({ color: this.theme.accent, alpha: 0.08 + 0.15*pulse }).stroke({ width: 2, color: this.theme.accent, alpha });
      }
      if (this.rectZone.pendingSide === 'right') {
        const x = this.rectZone.right; const cy = (this.rectZone.top + this.rectZone.bottom) / 2;
        g.poly([x+10, cy, x+10+size, cy-size, x+10+size, cy+size]).fill({ color: this.theme.accent, alpha: 0.08 + 0.15*pulse }).stroke({ width: 2, color: this.theme.accent, alpha });
      }
      if (this.rectZone.pendingSide === 'top') {
        const y = this.rectZone.top; const cx = (this.rectZone.left + this.rectZone.right) / 2;
        g.poly([cx, y-10, cx-size, y-10-size, cx+size, y-10-size]).fill({ color: this.theme.accent, alpha: 0.08 + 0.15*pulse }).stroke({ width: 2, color: this.theme.accent, alpha });
      }
      if (this.rectZone.pendingSide === 'bottom') {
        const y = this.rectZone.bottom; const cx = (this.rectZone.left + this.rectZone.right) / 2;
        g.poly([cx, y+10, cx-size, y+10+size, cx+size, y+10+size]).fill({ color: this.theme.accent, alpha: 0.08 + 0.15*pulse }).stroke({ width: 2, color: this.theme.accent, alpha });
      }
    }

    // Update HUD timer
    const remainMs = Math.max(0, this.zone.startAtMs + this.zone.durationMs - Date.now());
    const zoneTimer = this.uiContainer?.querySelector('#game-zone-timer') as HTMLDivElement | null;
    if (zoneTimer) {
      const secs = Math.ceil(remainMs / 1000);
      zoneTimer.textContent = `Zone closes in: ${Math.floor(secs/60)}m ${secs%60}s`;
    }

    // Apply soft damage outside rectangular zone
    const applyZone = (car?: Car | null) => {
      if (!car || car.destroyed) return;
      const inside = car.x >= this.rectZone.left && car.x <= this.rectZone.right && car.y >= this.rectZone.top && car.y <= this.rectZone.bottom;
      if (!inside) {
        // Compute shortest push vector toward rectangle
        const clampedX = Math.max(this.rectZone.left, Math.min(this.rectZone.right, car.x));
        const clampedY = Math.max(this.rectZone.top, Math.min(this.rectZone.bottom, car.y));
        const dx = car.x - clampedX;
        const dy = car.y - clampedY;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        car.vx -= dirX * 14 * deltaTime;
        car.vy -= dirY * 14 * deltaTime;
        car.outZoneTime = (car.outZoneTime || 0) + deltaTime;
        // If prolonged outside, eliminate
        if (car.outZoneTime > 6) this.destroyCar(car);
      } else {
        car.outZoneTime = 0;
      }
    };
    applyZone(this.player);
    applyZone(this.bot);
    for (const b of this.extraBots) applyZone(b);
  }

  emitBoostEcho(x: number, y: number) {
    this.echoPings.push({ x, y, timestamp: Date.now(), playerId: 'echo', kind: 'echo', ttlMs: 900 });
  }

  // assignNewBounty removed

  // bounty removed

  // resolveName removed (bounty removed)

  findEntityById(id: string | null): Car | null {
    if (!id) return null;
    const all = [this.player, this.bot, ...this.extraBots].filter(Boolean) as Car[];
    return all.find(c => c.id === id || c.type === id) || null;
  }

  destroy() {
    try {
      // Run all cleanup functions
      this.cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Error in cleanup function:', error);
        }
      });
      this.cleanupFunctions = [];
      
      // Clean up UI container (this removes all game UI elements at once)
      try {
        if (this.uiContainer) {
          this.uiContainer.remove();
        }
      } catch (error) {
        console.warn('Error removing UI container:', error);
      }

      // Also clean up any document.body elements (like game-over-overlay)
      const bodyElements = ['game-over-overlay'];
      bodyElements.forEach(id => {
        try {
          const el = document.getElementById(id);
          if (el) el.remove();
        } catch (error) {
          console.warn(`Error removing body element ${id}:`, error);
        }
      });
      
      // Reset body transform
      try {
        document.body.style.transform = 'translate(0px, 0px)';
      } catch (error) {
        console.warn('Error resetting body transform:', error);
      }
      
      // Radar is now cleaned up as part of uiContainer removal
      
      // Clean up PIXI app
      try {
        if (this.app) {
          // Stop ticker first to prevent any ongoing updates (guard for undefined ticker in Pixi v8)
          try { (this.app as any)?.ticker?.stop?.(); } catch {}

          // Detach canvas from DOM to fully release WebGL context
          try {
            const canvasEl = ((this.app as any)?.canvas
              || (this.app as any)?.renderer?.view
              || (this.app as any)?.view) as HTMLCanvasElement | undefined;
            if (canvasEl && canvasEl.parentElement) {
              canvasEl.parentElement.removeChild(canvasEl);
            }
          } catch (error) {
            console.warn('Error detaching canvas:', error);
          }

          // Destroy containers if present
          try { this.worldContainer?.destroy?.({ children: true }); } catch {}
          try { this.trailContainer?.destroy?.({ children: true }); } catch {}

          // Finally destroy the app (guard signature across Pixi versions)
          try { (this.app as any)?.destroy?.(true, { children: true, texture: true }); } catch {}
          this.app = null;
        }
      } catch (error) {
        console.warn('Error destroying PIXI app:', error);
      }
    } catch (error) {
      console.error('Error in destroy method:', error);
    }
  }
}

// Normalize angle to [-PI, PI]
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Inject small HUD animation keyframes
function injectHudAnimationStylesOnce() {
  try {
    if (document.getElementById('sr-hud-animations')) return;
    const style = document.createElement('style');
    style.id = 'sr-hud-animations';
    style.textContent = `
@keyframes srFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes srPulse { 0%{ transform: scale(1);} 50%{ transform: scale(1.035);} 100%{ transform: scale(1);} }
.hud-fade-in { animation: srFadeIn 220ms ease-out; will-change: opacity, transform; }
.hud-pulse { animation: srPulse 180ms ease-out; }
`;
    document.head.appendChild(style);
  } catch {}
}

// Bot color palette for variety
const BOT_COLORS: number[] = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43];

export default function NewGameView({ meIdOverride: _meIdOverride, onReplay, onExit }: { 
  meIdOverride?: string; 
  onReplay?: () => void; 
  onExit?: () => void 
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<SpermRaceGame | null>(null);
  const { state: wsState } = useWs();

  // Initialize Pixi only once on mount; update callbacks via a separate effect
  useEffect(() => {
    if (!mountRef.current) return;
    const game = new SpermRaceGame(mountRef.current, onReplay, onExit);
    gameRef.current = game;
    game.init().catch(console.error);
    return () => {
      try { game.destroy(); } catch (error) { console.error('Error destroying game:', error); }
    };
  }, []);

  // Keep onReplay/onExit current without re-creating the Pixi app
  useEffect(() => {
    const game = gameRef.current;
    if (game) {
      game.onReplay = onReplay;
      game.onExit = onExit;
    }
  }, [onReplay, onExit]);

  // Bind WsProvider state into HUD when in tournament mode
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (wsState?.phase === 'game' && wsState.game) {
      try {
        const players = wsState.game.players || [];
        const aliveSet = new Set<string>(players.filter(p => p.isAlive).map(p => p.id));
        const idToName: Record<string, string> = {};
        for (const p of players) {
          const short = `${p.id.slice(0,4)}…${p.id.slice(-4)}`;
          idToName[p.id] = short;
        }
        game.wsHud = {
          active: true,
          kills: wsState.kills || {},
          killFeed: wsState.killFeed || [],
          playerId: wsState.playerId,
          idToName,
          aliveSet,
          eliminationOrder: wsState.eliminationOrder || []
        };
      } catch {
        game.wsHud = { active: false, kills: {}, killFeed: [], playerId: null, idToName: {}, aliveSet: new Set(), eliminationOrder: [] } as any;
      }
    } else {
      game.wsHud = { active: false, kills: {}, killFeed: [], playerId: null, idToName: {}, aliveSet: new Set(), eliminationOrder: [] } as any;
    }
  }, [wsState.phase, wsState.game, wsState.kills, wsState.killFeed, wsState.playerId]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100vh',
        background: '#000',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
}
        
