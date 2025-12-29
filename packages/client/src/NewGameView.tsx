// @ts-nocheck
import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useWs } from './WsProvider';
import { HudManager } from './HudManager';
import { WORLD as S_WORLD } from 'shared/constants';

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
  accelerationScalar?: number;
  handlingAssist?: number;
  impactMitigation?: number;
  hotspotBuffExpiresAt?: number;
  spotlightUntil?: number;
  contactCooldown?: number;
  spawnTime?: number; // For growth over time
  killBoostUntil?: number; // Speed boost from kills
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
  type: 'energy' | 'overdrive';
  amount: number; // boost energy restored
  graphics: PIXI.Container;
  shape: PIXI.Graphics;
  aura: PIXI.Graphics;
  pulseT: number;
  rotationSpeed: number;
  color: number;
  expiresAt?: number;
  source?: 'ambient' | 'hotspot';
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

interface Hotspot {
  id: string;
  x: number;
  y: number;
  radius: number;
  state: 'telegraph' | 'active';
  spawnAtMs: number;
  activateAtMs: number;
  expiresAtMs: number;
  graphics: PIXI.Graphics;
  label?: HTMLDivElement;
  hasSpawnedLoot: boolean;
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
  public serverPlayers: Map<string, Car> = new Map();
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
    const defaultZoom = isPortraitMobile ? 0.45 : 0.55; // Even wider view
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
  public gameEffects!: GameEffects; // Instantiated in setupWorld
  public wsSendInput: null | ((target: { x: number; y: number }, accelerate: boolean, boost?: boolean) => void) = null;

  private container: HTMLElement;
  private cleanupFunctions: (() => void)[] = [];
  private combatHotspots: Hotspot[] = [];
  private hotspotSchedule: Array<{ triggerMs: number; triggered: boolean }> = [];
  private finalSurgeBannerShown: boolean = false;
  private lastSpotlightPingAt: number = 0;
  private overdriveBannerEl: HTMLDivElement | null = null;
  private hotspotToastEl: HTMLDivElement | null = null;
  private hotspotToastTimeout: number | undefined;
  private finalSurgeTimeout: number | undefined;

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

  // Visual toggles
  public smallTailEnabled: boolean = false; // disable near-head wiggly tail; keep only the gameplay trail

  // Battle Royale & Sonar system
  public radarPings: RadarPing[] = [];
  public echoPings: RadarPing[] = [];
  public alivePlayers: number = 0;
  public gamePhase: 'waiting' | 'active' | 'finished' = 'active';
  public gameStartTime: number = Date.now();
  public pickupsUnlocked: boolean = false;
  public artifactsUnlocked: boolean = false;
  // Pacing: powerups phase in early/mid game (measured from gameStartTime, includes pre-start countdown)
  public unlockPickupsAfterMs: number = 18000;
  public unlockArtifactsAfterMs: number = 12000;

  // Round-based tournament system
  public currentRound: number = 1;
  public totalRounds: number = 3;
  public roundWins: number = 0;
  public roundLosses: number = 0;
  public roundInProgress: boolean = false;
  public roundEndTime: number = 0;

  // UI container for game elements
  public uiContainer!: HTMLDivElement;
  public leaderboardContainer!: HTMLDivElement;
  public killFeedContainer!: HTMLDivElement;
  public hudManager!: HudManager;
  public recentKills: Array<{ killer: string; victim: string; time: number }> = [];
  private lastToastAt: number = 0;
  public killStreak: number = 0;
  public lastKillTime: number = 0;
  public killStreakNotifications: Array<{ text: string; time: number; x: number; y: number }> = [];

  // Near-miss detection for skill rewards
  public nearMisses: Array<{ text: string; time: number; x: number; y: number }> = [];

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

  // Tournament HUD data (from WsProvider)
  public wsHud: {
    active: boolean;
    kills: Record<string, number>;
    killFeed: Array<{ killerId?: string; victimId: string; ts: number }>;
    playerId?: string | null;
    idToName: Record<string, string>;
    aliveSet: Set<string>;
    eliminationOrder: string[];
  } | null = null;
  public debugCollisions: Array<{
    victimId: string;
    killerId?: string;
    hit: { x: number; y: number };
    segment?: { from: { x: number; y: number }; to: { x: number; y: number } };
    ts: number;
  }> = [];

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

  // Callbacks for navigation
  public onReplay?: () => void;
  public onExit?: () => void;
  public notifiedServerEnd: boolean = false;
  private appliedServerWorld: { width: number; height: number } | null = null;
  private enemyCompassEl: HTMLDivElement | null = null;
  private lastEnemyCompassUpdateAt: number = 0;
  private objectiveStatusEl: HTMLDivElement | null = null;
  public objective: any = null;
  public lastServerTimeMs: number = 0;

  constructor(container: HTMLElement, onReplay?: () => void, onExit?: () => void) {
    this.container = container;
    this.onReplay = onReplay;
    this.onExit = onExit;
    
    // Listen for mobile boost events to trigger haptics
    window.addEventListener('mobile-boost', this.handleMobileBoost.bind(this));
  }

  // JUICE METHODS - Make game feel amazing!
  private screenShake(intensity: number = 1) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isTournament = !!(this.wsHud && this.wsHud.active);
    // Disable screen shake in mobile practice for a stable feel
    if (isMobile && !isTournament) return;

    // Reduced shake - less disorienting on mobile
    this.camera.shakeX = (Math.random() - 0.5) * 8 * intensity;
    this.camera.shakeY = (Math.random() - 0.5) * 8 * intensity;
  }
  
  private handleMobileBoost() {
    // Check if boost actually happened
    if (this.player?.isBoosting) {
      // Haptic handled in MobileTouchControls, but we can add screen shake here
      this.screenShake(0.2);
    }
  }
  
  // Public accessor for external haptic triggers
  public triggerHaptic(type: 'light' | 'medium' | 'heavy') {
    this.hapticFeedback(type);
  }

  private hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning') {
    try {
      if (!navigator.vibrate && !this.gameEffects) return;

      switch (type) {
        case 'light':
          this.gameEffects?.triggerImpact('light');
          navigator.vibrate?.(10);
          break;
        case 'medium':
          this.gameEffects?.triggerImpact('medium');
          navigator.vibrate?.(30);
          break;
        case 'heavy':
          this.gameEffects?.triggerImpact('heavy');
          navigator.vibrate?.([50, 30, 50]);
          break;
        case 'success':
          this.gameEffects?.triggerImpact('medium');
          navigator.vibrate?.([40, 50, 40]);
          break;
        case 'warning':
          this.gameEffects?.triggerImpact('heavy');
          navigator.vibrate?.([20, 10, 20, 10, 20]);
          break;
      }
    } catch {}
  }

  private showNearMiss(x: number, y: number, distance: number) {
    const texts = distance < 15 ? 'INSANE DODGE' : distance < 25 ? 'CLOSE CALL' : 'DODGED';
    this.nearMisses.push({ text: texts, time: Date.now(), x, y });
    this.hapticFeedback('light');
    
    // CLOSE CALL BOOST: Subtle speed bump as reward for skillful dodging
    if (this.player && !this.player.destroyed) {
      const boostAmount = distance < 15 ? 1.05 : 1.03; // Much subtler boost
      this.player.speed = Math.min(this.player.baseSpeed * 1.2, this.player.speed * boostAmount);
      // Brief energy refill for close calls
      this.player.boostEnergy = Math.min(this.player.maxBoostEnergy, this.player.boostEnergy + 3);
    }
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
      backgroundColor: 0x1a1f2e, // Lighter dark blue for better visibility
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

    // WebGL context loss recovery (prevents black screen on mobile)
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[GAME] WebGL context lost, pausing game...');
      try { (this.app as any)?.ticker?.stop?.(); } catch {}
    };
    const handleContextRestored = () => {
      console.log('[GAME] WebGL context restored, resuming game...');
      try { (this.app as any)?.ticker?.start?.(); } catch {}
    };
    try {
      if (canvas) {
        canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
        canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);
        this.cleanupFunctions.push(() => {
          try { canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener); } catch {}
          try { canvas.removeEventListener('webglcontextrestored', handleContextRestored as EventListener); } catch {}
        });
      }
    } catch (e) {
      console.warn('[GAME] Could not add WebGL context handlers:', e);
    }

    // *** MOBILE ORIENTATION & RESIZE FIX ***
    // Explicitly handle orientation changes with a slight delay to allow browser UI to settle
    const handleMobileResize = () => {
        const nowTs = Date.now();
        if (nowTs - __sr_lastResize < 100) return;
        __sr_lastResize = nowTs;
        
        // Force strict match to visual viewport
        const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        if (this.app && this.app.renderer) {
            this.app.renderer.resize(w, h);
            try { this.drawArenaBorder(); } catch {}
            this.updateCamera();
        }
    };
    window.visualViewport?.addEventListener('resize', handleMobileResize);
    this.cleanupFunctions.push(() => window.visualViewport?.removeEventListener('resize', handleMobileResize));

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
    
    // Create danger overlay for zone warnings (vignette, desaturation, pulse effects)
    const dangerOverlay = document.createElement('div');
    dangerOverlay.id = 'game-danger-overlay';
    Object.assign(dangerOverlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '11',
      opacity: '0',
      transition: 'opacity 0.3s ease',
      background: 'radial-gradient(circle at center, transparent 30%, rgba(239, 68, 68, 0.15) 100%)',
      boxShadow: 'inset 0 0 200px rgba(239, 68, 68, 0.3)',
      border: '4px solid transparent',
      willChange: 'opacity, border-color'
    });
    this.uiContainer.appendChild(dangerOverlay);
    
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
    this.preStart = { startAt: Date.now(), durationMs: 3000 };
    this.roundInProgress = true; // Start first round
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
    
    // Add ambient colored particles for atmosphere
    this.createAmbientParticles();

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
  
  createAmbientParticles() {
    // Add subtle floating colored particles for atmosphere
    const particleCount = 40;
    const colors = [0x22d3ee, 0x6366f1, 0x10b981, 0xfbbf24]; // Cyan, purple, green, yellow
    
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * this.arena.width;
      const y = (Math.random() - 0.5) * this.arena.height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 3;
      
      const particle = new PIXI.Graphics();
      particle.circle(0, 0, size).fill({ color, alpha: 0.3 });
      particle.x = x;
      particle.y = y;
      
      // Store animation data
      (particle as any).baseY = y;
      (particle as any).floatSpeed = 0.3 + Math.random() * 0.5;
      (particle as any).floatOffset = Math.random() * Math.PI * 2;
      
      this.worldContainer.addChild(particle);
      try { (particle as any).zIndex = 3; } catch {}
    }
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
    // Make map edge more subtle so the shrinking zone stands out
    g.rect(sx, sy, sw, sh).stroke({ width: 1.5, color: this.theme.border, alpha: 0.45 });
    // very soft inner line
    g.rect(sx + 3, sy + 3, Math.max(0, sw - 6), Math.max(0, sh - 6)).stroke({ width: 1, color: this.theme.border, alpha: 0.25 });
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

    // Spawn boost pads - increased for more strategic gameplay
    this.spawnBoostPads(15);
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

  private ensurePickupsContainer(): boolean {
    if (this.pickupsContainer) return true;
    try {
      this.pickupsContainer = new PIXI.Container();
      this.pickupsContainer.visible = true;
      this.worldContainer?.addChild?.(this.pickupsContainer as any);
    } catch {}
    return !!this.pickupsContainer;
  }

  private createPickup(
    x: number,
    y: number,
    type: Pickup['type'],
    amount: number,
    opts: {
      radius?: number;
      color?: number;
      rotationSpeed?: number;
      pulseOffset?: number;
      expiresAt?: number;
      source?: Pickup['source'];
    } = {}
  ): Pickup | null {
    if (!this.ensurePickupsContainer() || !this.pickupsContainer) return null;

    const container = new PIXI.Container();
    const g = new PIXI.Graphics();
    const aura = new PIXI.Graphics();
    const radius = opts.radius ?? (type === 'overdrive' ? 18 : 9 + Math.random() * 7);
    const color = opts.color ?? (type === 'overdrive' ? 0xfacc15 : (Math.random() < 0.5 ? 0x00ffd1 : 0xff6bd6));
    const rotationSpeed = opts.rotationSpeed ?? ((Math.random() * 0.8 + 0.3) * (Math.random() < 0.5 ? -1 : 1));
    const pulseOffset = opts.pulseOffset ?? Math.random() * Math.PI * 2;

    if (type === 'overdrive') {
      g.circle(0, 0, radius * 0.55).fill({ color: 0xffffff, alpha: 0.92 });
      g.circle(0, 0, radius).stroke({ width: 3, color, alpha: 0.9 });
      g.moveTo(-radius * 0.7, 0).lineTo(radius * 0.7, 0).stroke({ width: 2, color, alpha: 0.75 });
      g.moveTo(0, -radius * 0.7).lineTo(0, radius * 0.7).stroke({ width: 2, color, alpha: 0.75 });
      aura.circle(0, 0, radius * 1.45).stroke({ width: 2, color, alpha: 0.15 });
    } else {
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
        .stroke({ width: 2, color, alpha: 0.9 });
      g.circle(0, 0, Math.max(2, radius * 0.35)).fill({ color: 0xffffff, alpha: 0.85 });
      aura.circle(0, 0, radius * 1.2).stroke({ width: 1, color, alpha: 0.08 });
    }

    container.addChild(aura);
    container.addChild(g);
    container.x = x;
    container.y = y;
    try { this.pickupsContainer.addChild(container); } catch {}

    const pickup: Pickup = {
      x,
      y,
      radius,
      type,
      amount,
      graphics: container,
      shape: g,
      aura,
      pulseT: pulseOffset,
      rotationSpeed,
      color,
      expiresAt: opts.expiresAt,
      source: opts.source ?? 'ambient'
    };

    this.pickups.push(pickup);
    return pickup;
  }

  spawnPickups(count: number) {
    if (!this.app || !this.ensurePickupsContainer()) return;
    for (let i = 0; i < count; i++) {
      const px = (Math.random() - 0.5) * this.arena.width * 0.9;
      const py = (Math.random() - 0.5) * this.arena.height * 0.9;
      this.createPickup(px, py, 'energy', 15 + Math.floor(Math.random() * 15));
    }
  }

  private showHotspotToast(message: string, accent: string) {
    if (!this.uiContainer) return;
    if (!this.hotspotToastEl) {
      const el = document.createElement('div');
      el.id = 'hotspot-toast';
      Object.assign(el.style, {
        position: 'absolute',
        top: '16%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 18px',
        borderRadius: '999px',
        fontWeight: '700',
        letterSpacing: '0.12em',
        fontSize: '14px',
        background: 'rgba(0,0,0,0.75)',
        border: '2px solid rgba(250,204,21,0.6)',
        color: accent,
        textShadow: '0 0 12px rgba(250,204,21,0.45)',
        opacity: '0',
        transition: 'opacity 220ms ease-out',
        pointerEvents: 'none',
        zIndex: '40'
  } as Partial<CSSStyleDeclaration>);
      this.uiContainer.appendChild(el);
      this.hotspotToastEl = el;
    }

    if (!this.hotspotToastEl) return;
    this.hotspotToastEl.textContent = message;
    this.hotspotToastEl.style.color = accent;
    this.hotspotToastEl.style.borderColor = accent;
    this.hotspotToastEl.style.textShadow = `0 0 12px ${accent}55`;
    this.hotspotToastEl.style.opacity = '1';
    if (this.hotspotToastTimeout) window.clearTimeout(this.hotspotToastTimeout);
    this.hotspotToastTimeout = window.setTimeout(() => {
      try { if (this.hotspotToastEl) this.hotspotToastEl.style.opacity = '0'; } catch {}
    }, 1800);
  }

  private initializeHotspotSchedule() {
    // Clear existing hotspots
    for (const hotspot of this.combatHotspots) {
      this.teardownHotspot(hotspot);
    }
    this.combatHotspots = [];

    const duration = this.zone.durationMs || 0;
    if (!duration) {
      this.hotspotSchedule = [];
      return;
    }
    const first = Math.floor(duration * 0.32);
    const second = Math.floor(duration * 0.62);
    this.hotspotSchedule = [
      { triggerMs: first, triggered: false },
      { triggerMs: second, triggered: false }
    ];
  }

  private spawnHotspot(_triggerMs: number) {
    if (!this.worldContainer) return;
    const now = Date.now();
    const radius = Math.min(320, Math.max(220, this.arena.width * 0.04));
    const x = (Math.random() - 0.5) * this.arena.width * 0.35;
    const y = (Math.random() - 0.5) * this.arena.height * 0.35;

    const graphics = new PIXI.Graphics();
    graphics.x = x;
    graphics.y = y;
    (graphics as any).zIndex = 6;
    this.worldContainer.addChild(graphics);

    const hotspot: Hotspot = {
      id: `hotspot_${now}`,
      x,
      y,
      radius,
      state: 'telegraph',
      spawnAtMs: now,
      activateAtMs: now + 2500,
      expiresAtMs: now + 9000,
      graphics,
      hasSpawnedLoot: false
    };

    this.combatHotspots.push(hotspot);
  }

  private activateHotspot(hotspot: Hotspot) {
    hotspot.state = 'active';
    hotspot.hasSpawnedLoot = false;
    hotspot.expiresAtMs = Date.now() + 6000;
  }

  private deployHotspotPickups(hotspot: Hotspot) {
    if (hotspot.hasSpawnedLoot) return;
    const count = 3;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const offset = hotspot.radius * 0.38;
      this.createPickup(
        hotspot.x + Math.cos(angle) * offset,
        hotspot.y + Math.sin(angle) * offset,
        'overdrive',
        0,
        {
          radius: 18,
          color: 0xfacc15,
          rotationSpeed: 1.4 * (i % 2 === 0 ? 1 : -1),
          expiresAt: hotspot.expiresAtMs,
          source: 'hotspot'
        }
      );
    }
    hotspot.hasSpawnedLoot = true;
  }

  private teardownHotspot(hotspot: Hotspot) {
    try { this.worldContainer?.removeChild(hotspot.graphics); } catch {}
    try { hotspot.graphics.destroy(); } catch {}
    if (hotspot.label) {
      try { hotspot.label.remove(); } catch {}
      hotspot.label = undefined;
    }
  }

  private updateHotspots(_deltaTime: number) {
    // Hotspots/overdrive are disabled for now to keep early games clean.
    return;
  }

  private applyOverdriveBuff(car: Car) {
    const now = Date.now();
    car.boostEnergy = car.maxBoostEnergy;
    car.hotspotBuffExpiresAt = now + 5000;
    car.spotlightUntil = now + 7000;
    car.isBoosting = true;
    car.targetSpeed = car.boostSpeed * 1.05;
    this.radarPings.push({ x: car.x, y: car.y, timestamp: now, playerId: 'overdrive', kind: 'bounty', ttlMs: 900 });
    this.lastSpotlightPingAt = now;
    if (car === this.player) {
      this.hapticFeedback('success');
      this.screenShake(0.55);
      this.updateOverdriveBanner(true, car.hotspotBuffExpiresAt - now);
    } else {
      this.screenShake(0.35);
    }
  }

  private updateOverdriveBanner(active: boolean, remainingMs: number) {
    if (!this.uiContainer) return;
    if (!this.overdriveBannerEl) {
      const el = document.createElement('div');
      el.id = 'overdrive-banner';
      Object.assign(el.style, {
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 14px',
        borderRadius: '10px',
        fontWeight: '700',
        fontSize: '13px',
        letterSpacing: '0.08em',
        background: 'rgba(0,0,0,0.75)',
        border: '2px solid rgba(250,204,21,0.6)',
        color: '#facc15',
        textShadow: '0 0 12px rgba(250,204,21,0.45)',
        opacity: '0',
        transition: 'opacity 180ms ease-out',
        pointerEvents: 'none',
        zIndex: '42'
  } as Partial<CSSStyleDeclaration>);
      this.uiContainer.appendChild(el);
      this.overdriveBannerEl = el;
    }

    if (!this.overdriveBannerEl) return;
    if (active) {
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.overdriveBannerEl.innerHTML = `
        <div style="font-size:14px;letter-spacing:0.1em;">OVERDRIVE ACTIVE • ${seconds}s EXPOSED</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px;letter-spacing:0.04em;">
          Glow brighter • Radar pings your position • Haptics & shakes spike with hits
        </div>
      `;
      this.overdriveBannerEl.style.opacity = '1';
    } else {
      this.overdriveBannerEl.style.opacity = '0';
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
    
    // Initialize clean HUD manager
    this.hudManager = new HudManager(this.uiContainer);
    this.hudManager.createHUD();

    // Create controls hint
    const controlsHint = document.createElement('div');
    controlsHint.id = 'game-controls-hint';
    
    // Detect mobile device
    const isMobileControls = window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    // Show appropriate controls text
    controlsHint.innerHTML = isMobileControls 
      ? 'Drag left side to move • Tap BOOST to dash'
      : 'WASD: Move • SPACE: Boost';
    
    Object.assign(controlsHint.style, {
      position: 'absolute',
      bottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.theme.text,
      fontSize: isMobileControls ? '15px' : '14px',
      fontWeight: '700',
      background: 'rgba(0, 0, 0, 0.75)',
      padding: '10px 20px',
      borderRadius: '20px',
      border: '1px solid rgba(0,255,255,0.3)',
      zIndex: '10',
      opacity: '0.9',
      textAlign: 'center',
      whiteSpace: 'nowrap'
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
      top: '72px',
      right: '18px',
      width: '220px',
      background: 'rgba(0,0,0,0.65)',
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: '10px',
      padding: '8px',
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

    // Enemy compass (helps players find action quickly)
    this.enemyCompassEl = document.createElement('div');
    this.enemyCompassEl.id = 'enemy-compass';
    Object.assign(this.enemyCompassEl.style, {
      position: 'absolute',
      top: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '12',
      pointerEvents: 'none',
      fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#e5e7eb',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(34,211,238,0.35)',
      boxShadow: '0 0 24px rgba(34,211,238,0.12)',
      borderRadius: '999px',
      padding: '8px 12px',
      display: 'none',
      alignItems: 'center',
      gap: '10px',
      whiteSpace: 'nowrap'
    } as Partial<CSSStyleDeclaration>);
    this.enemyCompassEl.innerHTML = `<span id="enemy-compass-label" style="opacity:0.9">HUNT</span><span id="enemy-compass-dist" style="opacity:0.85">—</span><span id="enemy-compass-arrow" style="display:inline-block;transform:rotate(0deg);font-size:14px;line-height:1">▲</span>`;
    this.uiContainer.appendChild(this.enemyCompassEl);

    // Objective status (Keys → Egg)
    this.objectiveStatusEl = document.createElement('div');
    this.objectiveStatusEl.id = 'objective-status';
    Object.assign(this.objectiveStatusEl.style, {
      position: 'absolute',
      top: '54px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '12',
      pointerEvents: 'none',
      fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fontSize: '12px',
      fontWeight: '800',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#e5e7eb',
      background: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: '999px',
      padding: '6px 12px',
      display: 'none',
      whiteSpace: 'nowrap'
    } as Partial<CSSStyleDeclaration>);
    this.uiContainer.appendChild(this.objectiveStatusEl);

    // Settings UI toggle removed
    // Zone timer now integrated into top HUD bar (created above)
    // (bounty HUD removed)

    // Toast container for playful feedback - moved to bottom to avoid overlap
    const toast = document.createElement('div');
    toast.id = 'game-toast';
    Object.assign(toast.style, { position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: this.theme.text, padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px', opacity: '0', transition: 'opacity 180ms ease', pointerEvents: 'none', zIndex: '12' });
    this.uiContainer.appendChild(toast);

    // Create emote buttons (mobile-friendly)
    this.createEmoteButtons();
  }

  private updateEnemyCompass() {
    try {
      if (!this.enemyCompassEl) return;
      if (!this.player || this.player.destroyed || !!this.preStart) {
        this.enemyCompassEl.style.display = 'none';
        return;
      }
      const now = Date.now();
      if (now - this.lastEnemyCompassUpdateAt < 140) return; // ~7Hz is enough
      this.lastEnemyCompassUpdateAt = now;

      const isTournament = !!(this.wsHud && this.wsHud.active);
      const myId = this.wsHud?.playerId || null;
      const candidates: Car[] = [];
      if (isTournament) {
        for (const [id, c] of this.serverPlayers.entries()) {
          if (myId && id === myId) continue;
          if (!c || c.destroyed || !c.sprite?.visible) continue;
          candidates.push(c);
        }
      } else {
        if (this.bot && !this.bot.destroyed) candidates.push(this.bot);
        for (const b of this.extraBots) if (b && !b.destroyed) candidates.push(b);
      }

      const labelEl = this.enemyCompassEl.querySelector('#enemy-compass-label') as HTMLSpanElement | null;
      const distText = this.enemyCompassEl.querySelector('#enemy-compass-dist') as HTMLSpanElement | null;
      const arrow = this.enemyCompassEl.querySelector('#enemy-compass-arrow') as HTMLSpanElement | null;

      // Objective-aware targeting (online): STOP holder → EXTRACT egg → otherwise FARM at egg → fallback HUNT nearest enemy.
      let target: { dx: number; dy: number; dist: number; kind: 'stop'|'extract'|'farm'|'hunt' } | null = null;
      if (isTournament && myId && this.objective && this.objective.kind === 'extraction') {
        const obj = this.objective;
        const keys = Number(obj?.keysByPlayerId?.[myId] || 0) || 0;
        const req = Number(obj?.keysRequired || 0) || 3;
        const egg = obj?.egg;
        const openAt = Number(egg?.openAtMs || 0) || 0;
        const nowMs = this.lastServerTimeMs > 0 ? this.lastServerTimeMs : Date.now();
        const open = openAt > 0 ? (nowMs >= openAt) : true;
        const offsetX = -this.arena.width / 2;
        const offsetY = -this.arena.height / 2;
        const eggX = Number(egg?.x || 0) + offsetX;
        const eggY = Number(egg?.y || 0) + offsetY;

        const holderId = obj?.holding?.playerId as string | undefined;
        if (holderId && holderId !== myId) {
          const holderCar = this.serverPlayers.get(holderId);
          if (holderCar && !holderCar.destroyed) {
            const dx = holderCar.x - this.player.x;
            const dy = holderCar.y - this.player.y;
            const dist = Math.hypot(dx, dy);
            if (Number.isFinite(dist)) target = { dx, dy, dist, kind: 'stop' };
          }
        } else if (keys >= req && open) {
          const dx = eggX - this.player.x;
          const dy = eggY - this.player.y;
          const dist = Math.hypot(dx, dy);
          if (Number.isFinite(dist)) target = { dx, dy, dist, kind: 'extract' };
        } else if (Number.isFinite(eggX) && Number.isFinite(eggY)) {
          const dx = eggX - this.player.x;
          const dy = eggY - this.player.y;
          const dist = Math.hypot(dx, dy);
          if (Number.isFinite(dist)) target = { dx, dy, dist, kind: 'farm' };
        }
      }

      if (!target) {
        if (candidates.length === 0) {
          this.enemyCompassEl.style.display = 'none';
          return;
        }

        let best: { dist: number; dx: number; dy: number } | null = null;
        for (const c of candidates) {
          const dx = c.x - this.player.x;
          const dy = c.y - this.player.y;
          const dist = Math.hypot(dx, dy);
          if (!Number.isFinite(dist)) continue;
          if (!best || dist < best.dist) best = { dist, dx, dy };
        }
        if (!best) {
          this.enemyCompassEl.style.display = 'none';
          return;
        }
        target = { ...best, kind: 'hunt' };
      }

      const dist = Math.round(target.dist);
      if (distText) distText.textContent = `${dist}m`;
      const ang = Math.atan2(target.dy, target.dx);
      const deg = (ang * 180) / Math.PI + 90; // ▲ points up, so +90 aligns 0deg to up
      if (arrow) arrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
      if (labelEl) labelEl.textContent = target.kind === 'stop' ? 'STOP' : target.kind === 'extract' ? 'EXTRACT' : target.kind === 'farm' ? 'FARM' : 'HUNT';

      const close = dist < 600;
      const urgent = target.kind === 'stop' || target.kind === 'extract';
      this.enemyCompassEl.style.borderColor = urgent ? 'rgba(250,204,21,0.55)' : close ? 'rgba(239,68,68,0.55)' : 'rgba(34,211,238,0.35)';
      this.enemyCompassEl.style.boxShadow = urgent ? '0 0 26px rgba(250,204,21,0.16)' : close ? '0 0 26px rgba(239,68,68,0.18)' : '0 0 24px rgba(34,211,238,0.12)';
      this.enemyCompassEl.style.display = 'flex';
    } catch {}
  }

  private updateObjectiveStatus() {
    try {
      if (!this.objectiveStatusEl) return;
      const isOnlineMatch = !!(this.wsHud && this.wsHud.active);
      const myId = this.wsHud?.playerId || null;
      const obj = isOnlineMatch ? this.objective : null;
      if (!isOnlineMatch || !obj || obj.kind !== 'extraction' || !myId) {
        this.objectiveStatusEl.style.display = 'none';
        return;
      }

      const keys = Number(obj?.keysByPlayerId?.[myId] || 0) || 0;
      const req = Number(obj?.keysRequired || 0) || 3;
      const egg = obj?.egg;
      const openAt = Number(egg?.openAtMs || 0) || 0;
      const holdMs = Number(egg?.holdMs || 0) || 2600;
      const now = this.lastServerTimeMs > 0 ? this.lastServerTimeMs : Date.now();
      const openIn = openAt > 0 ? Math.max(0, openAt - now) : 0;
      const open = openAt > 0 ? openIn === 0 : true;

      const holderId = obj?.holding?.playerId as string | undefined;
      const holdingSince = Number(obj?.holding?.sinceMs || 0) || 0;
      const holdingFor = holdingSince > 0 ? Math.max(0, now - holdingSince) : 0;
      const holdLeft = holderId ? Math.max(0, holdMs - holdingFor) : 0;

      // Distance to egg (helps players converge quickly)
      let eggDistText = '';
      try {
        if (egg && this.player && !this.player.destroyed && this.arena) {
          const offsetX = -this.arena.width / 2;
          const offsetY = -this.arena.height / 2;
          const eggX = Number(egg?.x || 0) + offsetX;
          const eggY = Number(egg?.y || 0) + offsetY;
          const dx = eggX - this.player.x;
          const dy = eggY - this.player.y;
          const dist = Math.hypot(dx, dy);
          if (Number.isFinite(dist)) eggDistText = `${Math.round(dist)}m`;
        }
      } catch {}

      let text = `KEYS ${keys}/${req} • `;
      if (!open) {
        text += `EGG IN ${Math.ceil(openIn / 1000)}s`;
      } else if (holderId) {
        const short = holderId === myId ? 'YOU' : `${String(holderId).slice(0, 4)}…${String(holderId).slice(-4)}`;
        text += `HOLD ${short} ${Math.ceil(holdLeft / 100) / 10}s`;
      } else {
        text += (keys >= req) ? 'EGG OPEN • EXTRACT' : 'EGG OPEN • FARM DNA';
      }
      if (eggDistText) text += ` • ${eggDistText}`;

      this.objectiveStatusEl.textContent = text;
      this.objectiveStatusEl.style.display = 'block';
      this.objectiveStatusEl.style.borderColor = holderId ? 'rgba(250,204,21,0.55)' : 'rgba(255,255,255,0.14)';
    } catch {}
  }

  createEmoteButtons() {
    const emotes = [
      { label: 'GG' },
      { label: 'LOL' },
      { label: 'WOW' },
      { label: 'FOCUS' }
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
      btn.textContent = emote.label;
      btn.title = emote.label;
      Object.assign(btn.style, {
        width: '46px',
        height: '46px',
        fontSize: '20px',
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
        this.showEmote(emote.label);
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

  showEmote(text: string) {
    if (!this.player || this.player.destroyed) return;

    // Create emote display above player
    const emoteEl = document.createElement('div');
    emoteEl.textContent = text;
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
      // Slightly faster feel in mobile practice (no ws HUD)
      try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isTournament = !!(this.wsHud && this.wsHud.active);
        if (isMobile && !isTournament) {
          this.player.baseSpeed *= 1.2;
          this.player.speed = this.player.baseSpeed;
          this.player.targetSpeed = this.player.baseSpeed;
          this.player.boostSpeed *= 1.2;
        }
      } catch {}

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
    
    // Trigger spawn haptic
    this.hapticFeedback('medium');
    
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

  applyServerWorld(world: { width: number; height: number } | null | undefined) {
    try {
      const w0 = Number(world?.width);
      const h0 = Number(world?.height);
      if (!Number.isFinite(w0) || !Number.isFinite(h0)) return;
      // Only resize the rendered arena during the pre-start countdown to avoid mid-match jitter.
      if (this.appliedServerWorld && !this.preStart) return;
      const width = Math.max(800, Math.min(12000, Math.floor(w0)));
      const height = Math.max(600, Math.min(12000, Math.floor(h0)));
      if (this.appliedServerWorld && this.appliedServerWorld.width === width && this.appliedServerWorld.height === height) return;

      this.appliedServerWorld = { width, height };
      this.arena = { width, height };

      // Update derived bounds used throughout the renderer.
      this.spawnBounds = { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
      this.rectZone.left = -width / 2;
      this.rectZone.right = width / 2;
      this.rectZone.top = -height / 2;
      this.rectZone.bottom = height / 2;
      this.zone.startRadius = Math.min(width, height) * 0.48;

      // Rebuild grid/border for the new arena size.
      try { this.drawArenaBorder(); } catch {}
      try { this.drawBorderOverlay(); } catch {}
      try {
        if (this.gridGraphics && this.worldContainer) this.worldContainer.removeChild(this.gridGraphics);
      } catch {}
      try { this.createGrid(); } catch {}

      // Keep the local player inside the new bounds (NewGameView uses centered coordinates).
      const clampCar = (car: Car | null) => {
        if (!car) return;
        const halfW = width / 2;
        const halfH = height / 2;
        car.x = Math.max(-halfW, Math.min(halfW, car.x));
        car.y = Math.max(-halfH, Math.min(halfH, car.y));
        car.sprite?.position?.set?.(car.x, car.y);
      };
      clampCar(this.player);
      clampCar(this.bot);
      for (const b of this.extraBots) clampCar(b);

      try { this.updateCamera(); } catch {}
    } catch {}
  }

  syncServerPlayers(playerData: any[]) {
    if (!this.app || !this.worldContainer) return;
    const currentIds = new Set(playerData.map(p => p.id));
    const myId = this.wsHud?.playerId;
    const isTournament = !!(this.wsHud && this.wsHud.active);
    // Server coordinates are 0..worldWidth/Height; this renderer uses -W/2..+W/2.
    const offsetX = isTournament ? -this.arena.width / 2 : 0;
    const offsetY = isTournament ? -this.arena.height / 2 : 0;
    
    // Remove players who left
    for (const [id, car] of this.serverPlayers.entries()) {
      if (!currentIds.has(id)) {
        if (car.sprite.parent) car.sprite.parent.removeChild(car.sprite);
        if (car.nameplate && car.nameplate.parentElement) car.nameplate.parentElement.removeChild(car.nameplate);
        if (car.trailGraphics && car.trailGraphics.parent) car.trailGraphics.parent.removeChild(car.trailGraphics);
        this.serverPlayers.delete(id);
      }
    }

    // Update or create players
    playerData.forEach(p => {
      // In online matches, also drive *our* avatar from the server to avoid desync.
      if (isTournament && myId && p.id === myId && this.player) {
        this.player.x = (p.sperm.position.x || 0) + offsetX;
        this.player.y = (p.sperm.position.y || 0) + offsetY;
        this.player.vx = p.sperm.velocity?.x || 0;
        this.player.vy = p.sperm.velocity?.y || 0;
        this.player.angle = p.sperm.angle;
        this.player.isBoosting = p.status?.boosting || false;
        (this.player as any).serverBoostCooldownMs = Number(p.status?.boostCooldownMs || 0) || 0;
        (this.player as any).serverBoostMaxCooldownMs = Number(p.status?.boostMaxCooldownMs || 0) || 0;
        this.player.sprite.rotation = p.sperm.angle;
        this.player.sprite.position.set(this.player.x, this.player.y);
        this.player.destroyed = !p.isAlive;
        this.player.sprite.visible = !!p.isAlive;
        if ((this.player as any).nameplate) {
          try { (this.player as any).nameplate.style.display = p.isAlive ? "block" : "none"; } catch {}
        }

        if (p.trail && this.trailContainer) {
          if (!this.player.trailGraphics) {
            this.player.trailGraphics = new PIXI.Graphics();
            (this.player.trailGraphics as any).zIndex = 20;
            this.trailContainer.addChild(this.player.trailGraphics);
          }
          const trailObj = {
            carId: this.player.id || myId,
            car: this.player,
            points: p.trail.map((pt: any) => ({ x: (pt.x || 0) + offsetX, y: (pt.y || 0) + offsetY, time: (typeof pt.createdAt === 'number' ? pt.createdAt : (pt.expiresAt - 8000)), isBoosting: false })),
            graphics: this.player.trailGraphics
          };
          this.renderTrail(trailObj);
        }
        return;
      }

      if (p.id === myId) return;

      let car = this.serverPlayers.get(p.id);
      if (!car) {
        const color = parseInt((p.sperm.color || "#ff00ff").replace("#", ""), 16);
        car = this.createCar((p.sperm.position.x || 0) + offsetX, (p.sperm.position.y || 0) + offsetY, color, "enemy");
        car.id = p.id;
        car.name = this.wsHud?.idToName[p.id] || p.id.slice(0, 4) + "…";
        if (car.nameplate) car.nameplate.textContent = car.name;
        this.serverPlayers.set(p.id, car);
        this.worldContainer.addChild(car.sprite);
        (car.sprite as any).zIndex = 50;
      }

      car.x = (p.sperm.position.x || 0) + offsetX;
      car.y = (p.sperm.position.y || 0) + offsetY;
      car.vx = p.sperm.velocity?.x || 0;
      car.vy = p.sperm.velocity?.y || 0;
      car.angle = p.sperm.angle;
      car.isBoosting = p.status?.boosting || false;
      car.sprite.rotation = p.sperm.angle;
      car.sprite.position.set(car.x, car.y);
      car.destroyed = !p.isAlive;
      car.sprite.visible = p.isAlive;
      if (car.nameplate) {
        car.nameplate.style.display = p.isAlive ? "block" : "none";
      }
      
      if (p.trail && this.trailContainer) {
        if (!car.trailGraphics) {
          car.trailGraphics = new PIXI.Graphics();
          (car.trailGraphics as any).zIndex = 20;
          this.trailContainer.addChild(car.trailGraphics);
        }
        const trailObj = {
          carId: car.id,
          car: car,
          // Use createdAt when available so the trail ages correctly and doesn't stick to the head.
          points: p.trail.map((pt: any) => ({ x: (pt.x || 0) + offsetX, y: (pt.y || 0) + offsetY, time: (typeof pt.createdAt === 'number' ? pt.createdAt : (pt.expiresAt - 8000)), isBoosting: false })),
          graphics: car.trailGraphics
        };
        this.renderTrail(trailObj);
      }
    });
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
      boostSpeed: 850, // Increased from 620 - much faster boost!
      targetSpeed: 220,
      speedTransitionRate: 18.0, // Faster transition for instant boost feel
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
      spawnTime: Date.now(), // For growth over time
      killBoostUntil: 0, // Speed boost from kills
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
      lateralDragScalar: 1.15,
      accelerationScalar: type === 'player' ? 24 : 18,
      handlingAssist: type === 'player' ? 0.65 : 0.35,
      impactMitigation: type === 'player' ? 0.75 : 0.6,
      hotspotBuffExpiresAt: undefined,
      spotlightUntil: 0,
      contactCooldown: 0
    };

    // Build spermatozoid: head + tail
    // Head (capsule/circle) - larger and brighter for enemies
    car.headGraphics!.clear();
    const headSize = type === 'player' ? 8 : 10; // Enemies 25% bigger
    const strokeWidth = type === 'player' ? 2 : 3; // Thicker stroke for enemies
    car.headGraphics!.circle(0, 0, headSize).fill(color).stroke({ width: strokeWidth, color, alpha: 0.5 });
    
    // Add glow effect for better visibility
    if (type !== 'player') {
      car.headGraphics!.circle(0, 0, headSize + 4).fill({ color, alpha: 0.15 });
    }
    
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
    const isOnline = !!(this.wsHud && this.wsHud.active);
    if (isOnline) {
      // Server boost is a lunge impulse; send a momentary boost pulse.
      try {
        const cdMs = Number((this.player as any)?.serverBoostCooldownMs ?? 0) || 0;
        if (cdMs <= 0) (this as any).pendingBoostPulse = true;
      } catch {
        (this as any).pendingBoostPulse = true;
      }
      this.hapticFeedback('medium');
      this.screenShake(0.3);
      return;
    }

    if (this.player && this.player.boostEnergy >= (this.player.minBoostEnergy + 5) && !this.player.isBoosting) {
      this.player.isBoosting = true;
      this.player.targetSpeed = this.player.boostSpeed;
      
      // Enhanced boost feedback for mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Haptic feedback - makes boost feel punchy
      this.hapticFeedback('medium');
      
      // Light screen shake on boost start (zoom handled in updateCamera)
      this.screenShake(0.3);
      
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
    
    // More particles for dramatic boost effect
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const particleCount = isMobile ? 12 : 18; // Increased from 8/12
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 300 + Math.random() * 150; // Faster particles
      const lifetime = 0.8; // Longer visible time
      
      const particle = this.getParticle();
      particle.beginFill(0x00ffff);
      particle.drawCircle(0, 0, 4); // Bigger particles
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
    const isOnline = !!(this.wsHud && this.wsHud.active);
    if (isOnline) return;
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
      // Compute target zoom by local density (removed speed factor for smoother camera)
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
      const baseZoom = isMobile ? 0.55 : 0.75; // Wider for better tactical view
      
      // BOOST ZOOM: Zoom IN when boosting for speed sensation
      if (this.player.isBoosting) {
        const boostZoom = isMobile ? 0.65 : 0.85; // Tighter view = feels faster
        this.camera.targetZoom = boostZoom;
      } else {
        // Normal zoom with slight crowd-based pullback
        const out = isMobile ? 0.05 * crowdFactor : 0.15 * crowdFactor;
        const target = baseZoom - out;
        this.camera.targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, target));
      }
    }
    
    // Smooth target zoom - very slow to prevent jiggle when spamming boost
    const zoomSpeed = isMobile ? 0.03 : 0.025; // Much slower = no jiggle
    if (this.preStart && (Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt)) > 2000)) {
      this.camera.zoom = this.camera.targetZoom;
    } else {
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * zoomSpeed;
    }
    
    // Center camera on player, or on average player position during overview
    let desiredCenterX = this.player.x;
    let desiredCenterY = this.player.y;
    if (this.preStart) {
      const totalDuration = this.preStart.durationMs;
      const overviewEnd = totalDuration * 0.65;
      const remain = Math.max(0, totalDuration - (Date.now() - this.preStart.startAt));
      
      if (remain > overviewEnd) {
        // Center on the tactical target calculated in gameLoop (avg real players)
        desiredCenterX = this.mouse.x;
        desiredCenterY = this.mouse.y;
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
    const isOnline = !!(this.wsHud && this.wsHud.active);
    const isTournament = isOnline;
    
    // Handle pre-start countdown (freeze inputs/boost/trails until GO)
    if (this.preStart) {
      const remain = Math.max(0, this.preStart.durationMs - (Date.now() - this.preStart.startAt));
      const sec = Math.ceil(remain / 1000);
      
      // CINEMATIC COUNTDOWN: Show tactical overview of all rivals, then dive into action
      const totalDuration = this.preStart.durationMs;
      const overviewEnd = totalDuration * 0.65; // Spend 65% of time in overview
      
      if (remain > overviewEnd) {
        // PHASE 1: Tactical Overview
        const fitW = this.app.screen.width / (this.arena.width * 0.85);
        const fitH = this.app.screen.height / (this.arena.height * 0.85);
        this.camera.targetZoom = Math.max(0.12, Math.min(fitW, fitH));
        
        // Target center of all real players if possible
        let avgX = 0, avgY = 0, count = 0;
        if (this.player) { avgX += this.player.x; avgY += this.player.y; count++; }
        for(const p of this.serverPlayers.values()) { avgX += p.x; avgY += p.y; count++; }
        
        if (count > 0) {
          this.mouse.x = avgX / count;
          this.mouse.y = avgY / count;
        }
      } else {
        // PHASE 2: Tactical Dive
        const t = 1 - (remain / overviewEnd);
        const easedT = t * t * (3 - 2 * t); // Smooth step
        const startZoom = 0.12;
        const endZoom = isMobile ? 0.55 : 0.75;
        this.camera.targetZoom = startZoom + (endZoom - startZoom) * easedT;
        
        // Pull focus back to local player
        if (this.player) {
          this.mouse.x = this.mouse.x * (1-easedT) + this.player.x * easedT;
          this.mouse.y = this.mouse.y * (1-easedT) + this.player.y * easedT;
        }
      }
      
      const isOverview = remain > overviewEnd; let tacticalLbl = document.getElementById('tactical-overview-label'); if (isOverview && !tacticalLbl && this.uiContainer) { tacticalLbl = document.createElement('div'); tacticalLbl.id = 'tactical-overview-label'; Object.assign(tacticalLbl.style, { position: 'absolute', left: '50%', top: '20%', transform: 'translateX(-50%)', color: '#00f5ff', fontFamily: 'Orbitron, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5em', textTransform: 'uppercase', opacity: '0.8', zIndex: '20', textShadow: '0 0 10px rgba(0, 245, 255, 0.5)' }); tacticalLbl.textContent = 'Tactical Overview'; this.uiContainer.appendChild(tacticalLbl); } else if (!isOverview && tacticalLbl) { tacticalLbl.remove(); }
      // Show countdown HUD with AAA-grade animations
      let cd = document.getElementById('prestart-countdown');
      if (!cd && this.uiContainer) {
        cd = document.createElement('div');
        cd.id = 'prestart-countdown';
        Object.assign(cd.style, { 
          position: 'absolute', 
          left: '50%', 
          top: '40%', 
          transform: 'translate(-50%, -50%)', 
          color: this.theme.text, 
          fontSize: '48px', 
          fontWeight: '700', 
          zIndex: '20',
          textAlign: 'center',
          textShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)',
          filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))'
        });
        this.uiContainer.appendChild(cd);
      }
      if (cd) {
        const isMobile = window.innerWidth <= 768;
        
        // Calculate animation progress
        const phaseInMs = this.preStart.durationMs - remain;
        const frac = (phaseInMs % 1000) / 1000;
        
        // Multi-stage easing for professional feel - NUMBER ONLY
        const bounceIn = frac < 0.4 ? this.easeOutBack(frac / 0.4) : 1;
        const fadeOut = frac > 0.85 ? 1 - ((frac - 0.85) / 0.15) : 1;
        const pulseScale = 1 + Math.sin(frac * Math.PI) * 0.1;
        
        const scale = bounceIn * pulseScale;
        const opacity = fadeOut;
        
        // Text below stays stable (no sync to number animation)
        const textOpacity = Math.min(1, phaseInMs / 500); // Fade in once at start
        
        if (sec > 0) {
          // Dynamic color based on urgency
          const numberColor = sec === 1 ? '#ef4444' : sec === 2 ? '#fbbf24' : '#10b981';
          const glowColor = sec === 1 ? '239, 68, 68' : sec === 2 ? '251, 191, 36' : '16, 185, 129';
          
          if (isMobile) {
            cd.innerHTML = `
              <div style="
                font-size:72px;
                font-weight:800;
                color:${numberColor};
                text-shadow: 
                  0 0 30px rgba(${glowColor}, 0.8),
                  0 0 60px rgba(${glowColor}, 0.4),
                  0 4px 20px rgba(0, 0, 0, 0.6);
                letter-spacing: -2px;
                opacity:${opacity}
              ">${sec}</div>
              <div style="
                font-size:16px;
                margin-top:16px;
                opacity:${textOpacity};
                font-weight:600;
                color:#22d3ee;
                text-shadow: 
                  0 0 20px rgba(34, 211, 238, 0.6),
                  0 2px 8px rgba(0, 0, 0, 0.7);
                letter-spacing: 0.5px;
                transition: opacity 0.3s ease;
              ">LAST ONE STANDING WINS</div>
            `;
          } else {
            cd.innerHTML = `
              <div style="
                font-size:96px;
                font-weight:800;
                color:${numberColor};
                text-shadow: 
                  0 0 40px rgba(${glowColor}, 0.8),
                  0 0 80px rgba(${glowColor}, 0.4),
                  0 6px 24px rgba(0, 0, 0, 0.7);
                letter-spacing: -4px;
                opacity:${opacity}
              ">${sec}</div>
              <div style="
                font-size:20px;
                margin-top:20px;
                opacity:${textOpacity};
                font-weight:600;
                color:#22d3ee;
                text-shadow: 
                  0 0 20px rgba(34, 211, 238, 0.5),
                  0 2px 10px rgba(0, 0, 0, 0.8);
                letter-spacing: 1px;
                text-transform: uppercase;
                transition: opacity 0.3s ease;
              ">Last One Standing Wins</div>
              <div style="
                font-size:14px;
                margin-top:12px;
                opacity:${textOpacity * 0.9};
                color:#fbbf24;
                font-weight:500;
                text-shadow: 
                  0 0 15px rgba(251, 191, 36, 0.4),
                  0 2px 8px rgba(0, 0, 0, 0.6);
                transition: opacity 0.3s ease;
              ">Zone closes in 10 seconds</div>
            `;
          }
        } else {
          // Epic "GO!" moment
          const goScale = 1 + Math.sin(frac * Math.PI * 2) * 0.15;
          cd.innerHTML = `
            <div style="
              font-size:${isMobile ? '80px' : '120px'};
              font-weight:900;
              color:#10b981;
              text-shadow: 
                0 0 50px rgba(16, 185, 129, 1),
                0 0 100px rgba(16, 185, 129, 0.6),
                0 8px 32px rgba(0, 0, 0, 0.8);
              letter-spacing: ${isMobile ? '4px' : '8px'};
              opacity:${opacity};
              transform: scale(${goScale});
              transition: transform 0.1s ease-out;
            ">GO!</div>
            ${!isMobile ? `<div style="
              font-size:18px;
              margin-top:24px;
              opacity:${opacity * 0.8};
              color:#fbbf24;
              font-weight:600;
              text-shadow: 
                0 0 20px rgba(251, 191, 36, 0.4),
                0 2px 10px rgba(0, 0, 0, 0.8);
              letter-spacing: 2px;
            ">SURVIVE THE ZONE</div>` : ''}
          `;
        }
        
        // Smooth transform with hardware acceleration
        (cd as HTMLDivElement).style.transform = `translate(-50%, -50%) scale(${scale})`;
        (cd as HTMLDivElement).style.willChange = 'transform, opacity';
      }
      if (remain <= 0) {
        // Remove HUD and unfreeze
        this.preStart = null;
        const tl = document.getElementById('tactical-overview-label'); if (tl) tl.remove();
        if (cd) cd.remove();
        // Clear overview markers
        if (this.overviewCtx && this.overviewCanvas) this.overviewCtx.clearRect(0, 0, this.overviewCanvas.width, this.overviewCanvas.height);
      }
    }
    // Handle player input only after countdown
    if (!this.preStart) this.handlePlayerInput();
    
    // Update cars only after countdown
    if (!this.preStart) {
      // Local-only pickups are disabled in online matches (server is authoritative).
      if (!isOnline) {
        // Timed unlock of pickups to avoid early clutter (artifacts/hotspots disabled)
        const sinceStart = Date.now() - (this.gameStartTime || Date.now());
        if (!this.pickupsUnlocked && sinceStart >= this.unlockPickupsAfterMs) {
          this.pickupsUnlocked = true;
          try { this.spawnPickups(35); } catch {}
          if (this.pickupsContainer) this.pickupsContainer.visible = true;
          // HUD cue: energy orbs phase begins
          this.showHotspotToast('Energy orbs active • refill boost and chase kills', '#4ade80');
        }
      }
      if (this.player && !this.player.destroyed) {
        if (!isOnline) {
          this.updateCar(this.player, deltaTime);
          this.checkArenaCollision(this.player);
        }
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
      
      if (!isOnline) {
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
      }

      // Update server-synced players
      for (const car of this.serverPlayers.values()) {
        if (!car.destroyed) {
          this.updateCarVisuals(car, deltaTime);
          // Keep nameplate pinned above player
          try {
            const np = (car as any).nameplate as HTMLDivElement | undefined;
            if (np) {
              const sx = car.x * this.camera.zoom + this.camera.x;
              const sy = car.y * this.camera.zoom + this.camera.y;
              np.style.left = `${sx}px`;
              np.style.top = `${sy}px`;
              np.style.display = 'block';
            }
          } catch {}
        } else {
          try {
            const np = (car as any).nameplate as HTMLDivElement | undefined;
            if (np) np.style.display = 'none';
          } catch {}
        }
      }
      
      if (!isOnline) {
        // Update trails
        this.updateTrails(deltaTime);
        
        // Check trail collisions
        this.checkTrailCollisions();
        this.resolveCarBumps(deltaTime);
      }
    }
    
    // Update particles
    this.updateParticles(deltaTime);

    // Animate and collect pickups (collection only after countdown)
    if (!isOnline && !this.preStart && this.pickupsUnlocked && this.pickupsContainer) {
      this.updatePickups(deltaTime);
    }
    
    // Update camera
    this.updateCamera();
    
    // Update round system
    this.updateRoundSystem();
    
    // Update BR zone (offline/local only). Online uses server walls.
    if (!isOnline) {
      this.updateZoneAndDamage(deltaTime);
    } else {
      // Hide local safe-zone overlay during online matches.
      try { if (this.zoneGraphics) this.zoneGraphics.visible = false; } catch {}
      // Drive HUD timer from the server-side shrink schedule (best-effort).
      try {
        if (!(this as any).onlineRoundStartAtMs) (this as any).onlineRoundStartAtMs = Date.now();
        const elapsedMs = Date.now() - (this as any).onlineRoundStartAtMs;
        const startMs = Math.max(0, Number(S_WORLD.ARENA_SHRINK_START_S || 0)) * 1000;
        const durMs = Math.max(0, Number(S_WORLD.ARENA_SHRINK_DURATION_S || 0)) * 1000;
        const totalMs = startMs + durMs;
        const remainMs = Math.max(0, totalMs - elapsedMs);
        if (this.hudManager) this.hudManager.updateZoneTimer(Math.ceil(remainMs / 1000));
      } catch {}
    }
    
    // Update sonar radar
    this.radarAngle = (this.radarAngle + deltaTime * 2) % (Math.PI * 2);
    this.updateRadar();
    this.updateEnemyCompass();
    this.updateObjectiveStatus();
    
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
    
    // Update HUD elements: nameplates and alive count
    this.updateNameplates();
    this.updateLeaderboard();
    // Kill feed removed - clutters mobile screen
    // Combo notifications removed - too cluttered

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
      const aliveHeaderSrv = `<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px\">
        <div style=\"color:${this.theme.text};font-weight:600;letter-spacing:0.01em;\">LEADERBOARD</div>
        <div style=\"color:${this.theme.text};opacity:0.9;\">ALIVE: ${this.wsHud!.aliveSet.size}</div>
      </div>`;
      const rowsSrv = sortedSrv.map((p, idx) => {
        const dotColor = p.alive ? '#10b981' : '#7b8796';
        const opacity = p.alive ? 1 : 0.6;
        const rank = idx + 1;
        const youTag = (this.wsHud!.playerId && p.id === this.wsHud!.playerId) ? ' <span style=\\"color:#22d3ee;opacity:0.9\\">(YOU)</span>' : '';
        return `
          <div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;gap:8px;opacity:${opacity}\">
            <div style=\"display:flex;align-items:center;gap:8px\">
              <div style=\"width:8px;height:8px;border-radius:50%;background:${dotColor}\"></div>
              <div style=\"color:#9aa7b5;width:18px;text-align:center\">#${rank}</div>
              <div style=\"color:${this.theme.text}\">${p.name}${youTag}</div>
            </div>
            <div style=\"color:${this.theme.text}\">KOs ${p.kills}</div>
          </div>`;
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
    const aliveHeader = `<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px\">
      <div style=\"color:${this.theme.text};font-weight:600;letter-spacing:0.01em;\">LEADERBOARD</div>
      <div style=\"color:${this.theme.text};opacity:0.9;\">ALIVE: ${this.alivePlayers}</div>
    </div>`;
    const rows = sorted.map((c, idx) => {
      const isAlive = !c.destroyed;
      const dotColor = isAlive ? '#10b981' : '#7b8796';
      const nameColor = c.type === 'player' ? '#22d3ee' : this.theme.text;
      const opacity = isAlive ? 1 : 0.6;
      const rank = idx + 1;
      const youTag = c.type === 'player' ? ' <span style=\\"color:#22d3ee;opacity:0.9\\">(YOU)</span>' : '';
      return `
        <div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;gap:8px;opacity:${opacity}\">
          <div style=\"display:flex;align-items:center;gap:8px\">
            <div style=\"width:8px;height:8px;border-radius:50%;background:${dotColor}\"></div>
            <div style=\"color:#9aa7b5;width:18px;text-align:center\">#${rank}</div>
            <div style=\"color:${nameColor}\">${c.name}${youTag}</div>
          </div>
          <div style=\"color:${this.theme.text}\">KOs ${c.kills}</div>
        </div>`;
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

  renderAliveCounter() {
    // Combo and near-miss rendering removed - too cluttered on mobile
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
        <span style="opacity:0.7;flex-shrink:0;font-size:11px;margin:0 4px;letter-spacing:1px;">KO</span>
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
    const isOnline = !!(this.wsHud && this.wsHud.active);
    // Low-speed aim smoothing to reduce wobble
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (speed < 120) {
      const prev = (this.player as any).targetAngle ?? targetAngle;
      (this.player as any).targetAngle = prev + (targetAngle - prev) * 0.38;
    } else {
      (this.player as any).targetAngle = targetAngle;
    }
    
    // Boost control
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      if (isOnline) {
        const wasDown = !!(this as any).spaceWasDown;
        const down = !!this.keys['Space'];
        if (down && !wasDown) {
          (this as any).pendingBoostPulse = true;
        }
        (this as any).spaceWasDown = down;
      } else {
        // Offline: hold to boost
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
    }

    // Online: send aim + accelerate + (optional) boost pulse to server.
    if (isOnline && this.wsSendInput) {
      try {
        const aim = (this.player as any).targetAngle ?? targetAngle;
        const px = this.player.x + this.arena.width / 2;
        const py = this.player.y + this.arena.height / 2;
        const len = 1400;
        const tx = px + Math.cos(aim) * len;
        const ty = py + Math.sin(aim) * len;
        const boost = !!(this as any).pendingBoostPulse;
        (this as any).pendingBoostPulse = false;
        this.wsSendInput({ x: tx, y: ty }, true, boost ? true : undefined);
      } catch { }
    }

    // Quick emote: press 'E' to pop a short SR emote above your head
    if (this.keys['KeyE']) {
      this.keys['KeyE'] = false; // single-shot
      try { this.spawnEmote(this.player, Math.random() < 0.5 ? 'SR' : 'SR+'); } catch {}
    }
  }

  spawnEmote(car: Car | null, emoji: string) {
    if (!car || !this.uiContainer || !this.app) return;
    const el = document.createElement("div");
    el.textContent = emoji;
    Object.assign(el.style, {
      position: "absolute",
      transform: "translate(-50%, -50%)",
      fontSize: "18px",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
      zIndex: "15",
      transition: "opacity 200ms ease, transform 200ms ease",
      opacity: "1"
    } as any);
    this.uiContainer.appendChild(el);
    const sx = car.x * this.camera.zoom + this.camera.x + this.app.screen.width * 0.5 - this.app.screen.width * 0.5;
    const sy = car.y * this.camera.zoom + this.camera.y + this.app.screen.height * 0.5 - this.app.screen.height * 0.5 - 24;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    const expiresAt = Date.now() + 900;
    this.emotes.push({ el, car, expiresAt });
    setTimeout(() => { try { el.style.opacity = "0"; el.style.transform = "translate(-50%, -60%)"; } catch {} }, 700);
    setTimeout(() => { try { el.remove(); } catch {} }, 900);
  }

  updateCarVisuals(car: Car, deltaTime: number) {
    if (car.destroyed) return;
    const now = Date.now();
    const buffActive = !!(car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt > now);
    const sizeMul = this.getSizeMultiplierForCar(car);

    if (!this.smallTailEnabled && car.tailGraphics) {
      car.tailGraphics.clear();
      car.tailGraphics.visible = false;
    } else if (this.smallTailEnabled && car.tailGraphics) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isTournament = !!(this.wsHud && this.wsHud.active);
      const isMobilePracticePlayer = isMobile && !isTournament && car.type === "player";

      const waveSpeed = isMobilePracticePlayer ? (car.isBoosting ? 6 : 3) : (car.isBoosting ? 18 : 10);
      car.tailWaveT = (car.tailWaveT || 0) + deltaTime * waveSpeed;

      const segs = isMobilePracticePlayer ? 6 : 10;
      const len = 34 * sizeMul;
      const amp = 5 * sizeMul * (car.isBoosting ? 1.5 : 1.0);
      
      const g = car.tailGraphics;
      g.visible = true;
      g.clear();
      const dirX = Math.cos(car.angle);
      const dirY = Math.sin(car.angle);
      const latX = Math.cos(car.angle + Math.PI / 2);
      const latY = Math.sin(car.angle + Math.PI / 2);
      
      const points = [];
      const step = len / segs;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const envelope = Math.pow(t, 1.5);
        const wave = Math.sin(t * 10 + car.tailWaveT) * envelope * amp;
        points.push({
          x: -dirX * i * step + latX * wave,
          y: -dirY * i * step + latY * wave
        });
      }
      const poly = [];
      for(const p of points) { poly.push(p.x, p.y); }
      g.poly(poly).stroke({ width: 2 * sizeMul, color: car.color, alpha: 0.8 });
    }

    if (car.headGraphics) {
      const rx = 9 * sizeMul;
      const ry = 6 * sizeMul;
      car.headGraphics.clear();
      car.headGraphics.ellipse(0, 0, rx, ry).fill({ color: car.color, alpha: 1.0 });
      if (car.isBoosting) {
        car.headGraphics.ellipse(0, 0, rx + 3, ry + 2).fill({ color: car.color, alpha: 0.2 });
      }
      if (buffActive) {
        car.headGraphics.ellipse(0, 0, rx + 5, ry + 4).stroke({ width: 2, color: 0xfacc15, alpha: 0.9 });
      }
    }
  }

  updateCar(car: Car, deltaTime: number) {
    if (car.destroyed) return;
    const now = Date.now();
    if (car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt <= now) car.hotspotBuffExpiresAt = undefined;
    if (car.spotlightUntil && car.spotlightUntil <= now) car.spotlightUntil = undefined;
    const buffActive = !!(car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt > now);
    
    const wasBoosting = car.isBoosting;
    if (car.isBoosting) {
      car.boostEnergy -= car.boostConsumptionRate * deltaTime;
      car.targetSpeed = car.boostSpeed;
      if (buffActive) car.targetSpeed *= 1.08;
      car.driftFactor = Math.min(car.maxDriftFactor, car.driftFactor + deltaTime * 2.0);
      if (car.boostEnergy <= 0) {
        car.boostEnergy = 0; car.isBoosting = false; car.targetSpeed = car.baseSpeed;
      }
    } else {
      let regenMultiplier = 1.0;
      if (this.zone && this.zone.startAtMs) {
        const elapsed = Date.now() - this.zone.startAtMs;
        const remainMs = Math.max(0, this.zone.durationMs - elapsed);
        if (elapsed < 10000) regenMultiplier = 1.5;
        else if (remainMs < 5000) regenMultiplier = 0.7;
      }
      car.boostEnergy += car.boostRegenRate * deltaTime * regenMultiplier;
      if (car.boostEnergy > car.maxBoostEnergy) car.boostEnergy = car.maxBoostEnergy;
      if (car.killBoostUntil && now < car.killBoostUntil) car.targetSpeed = car.boostSpeed * 0.8;
      else { car.targetSpeed = car.baseSpeed; if (buffActive) car.targetSpeed *= 1.05; }
      car.driftFactor = Math.max(0, car.driftFactor - deltaTime * 1.5);
    }
    if (!wasBoosting && car.isBoosting) this.emitBoostEcho(car.x, car.y);
    
    for (const pad of this.boostPads) {
      const dx = car.x - pad.x, dy = car.y - pad.y;
      if ((dx * dx + dy * dy) <= (pad.radius * pad.radius) && (now - pad.lastTriggeredAt) >= pad.cooldownMs) {
        pad.lastTriggeredAt = now;
        car.boostEnergy = Math.min(car.maxBoostEnergy, car.boostEnergy + 20);
        car.isBoosting = true; car.targetSpeed = car.boostSpeed * 1.05;
        this.emitBoostEcho(pad.x, pad.y);
      }
    }
    
    const speedDiff = car.targetSpeed - car.speed;
    car.speed += speedDiff * (car.accelerationScalar ?? car.speedTransitionRate) * deltaTime;
    
    const angleDiff = normalizeAngle((car as any).targetAngle - car.angle);
    const turnRate = (car as any).turnResponsiveness ?? 7.0;
    car.angle += angleDiff * Math.min(1.0, turnRate * deltaTime);
    
    const forwardX = Math.cos(car.angle), forwardY = Math.sin(car.angle);
    const driftAngle = car.angle + (Math.PI / 2);
    const driftIntensity = car.driftFactor * car.speed * 0.4 * Math.abs(angleDiff);
    car.vx = forwardX * car.speed + Math.cos(driftAngle) * driftIntensity;
    car.vy = forwardY * car.speed + Math.sin(driftAngle) * driftIntensity;
    
    car.x += car.vx * deltaTime;
    car.y += car.vy * deltaTime;
    car.sprite.x = car.x; car.sprite.y = car.y; car.sprite.rotation = car.angle;

    this.updateCarVisuals(car, deltaTime);

    if (car === this.player) {
      if (buffActive) this.updateOverdriveBanner(true, (car.hotspotBuffExpiresAt || now) - now);
      else this.updateOverdriveBanner(false, 0);
      if ((buffActive || (car.spotlightUntil && car.spotlightUntil > now)) && now - this.lastSpotlightPingAt > 320) {
        this.lastSpotlightPingAt = now;
        this.radarPings.push({ x: car.x, y: car.y, timestamp: now, playerId: "overdrive", kind: "bounty", ttlMs: 900 });
      }
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
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isTournament = !!(this.wsHud && this.wsHud.active);
    const hidePlayerTrailInMobilePractice = isMobile && !isTournament;

    if (this.player && !this.player.destroyed && !hidePlayerTrailInMobilePractice) {
      this.addTrailPoint(this.player);
    }
    if (this.bot && !this.bot.destroyed) {
      this.addTrailPoint(this.bot);
    }
    // Add trail points for server-synced players
    for (const car of this.serverPlayers.values()) {
      if (!car.destroyed) {
        this.addTrailPoint(car);
      }
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
      let trail = this.trails.find(t => t.carId === car.id);
      if (!trail) {
        trail = {
          carId: car.id,
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

    // Calm player trail: avoid ghost wiggle on the local player's own trail to prevent jittery visuals
    const isPlayerTrail = !!(this.player && trail.car === this.player);

    const baseWidth = (car.type === 'player') ? 2 : 1.6; // thinner overall
    const alphaStart = 1.0;

    // Ensure the rendered trail visually reaches the head, especially during boost (trail points emit at a lower rate).
    // We add a temporary final point at the current car position for rendering only.
    const drawPts = pts.slice();
    if (isPlayerTrail) {
      const last = drawPts[drawPts.length - 1];
      const dx = car.x - last.x;
      const dy = car.y - last.y;
      if ((dx * dx + dy * dy) > 0.5) {
        drawPts.push({ x: car.x, y: car.y, time: now, isBoosting: car.isBoosting });
      }
    }
    if (drawPts.length < 2) return;

    if (isPlayerTrail) {
      const first = drawPts[0];
      trail.graphics.moveTo(first.x, first.y);
      for (let i = 1; i < drawPts.length; i++) {
        const p = drawPts[i];
        trail.graphics.lineTo(p.x, p.y);
      }
      // Use butt cap so it doesn't look like a blob glued onto the head.
      trail.graphics.stroke({ width: baseWidth, color: trailColor, alpha: alphaStart, cap: 'butt', join: 'round' });
    } else {
      // Disable the "ghost wiggle trail" (it can look like a tiny tail glued to the head).
      const first = drawPts[0];
      trail.graphics.moveTo(first.x, first.y);
      for (let i = 1; i < drawPts.length; i++) {
        const p = drawPts[i];
        trail.graphics.lineTo(p.x, p.y);
      }
      trail.graphics.stroke({ width: baseWidth, color: trailColor, alpha: alphaStart, cap: 'round', join: 'round' });
    }

    // Proximity glow (subtle, thinner) using segment checks
    if (this.player && trail.car !== this.player && drawPts.length >= 2) {
      for (let i = 1; i < drawPts.length; i++) {
        const a = drawPts[i - 1];
        const b = drawPts[i];
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
            // EXPLOSION when WE crash (not when we kill others)
            this.createExplosion(car.x, car.y, car.color);
            
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
      
      // Show near-miss notification if player had a close call (reduced frequency)
      if (car === this.player && closestMiss < 25 && Math.random() < 0.08) { // 8% chance, tighter radius
        this.showNearMiss(missX, missY, closestMiss);
      }
    }
  }

  private resolveCarBumps(deltaTime: number) {
    const cars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null && !car.destroyed);
    if (cars.length < 2) return;

    const collisionRadius = 32;
    for (const car of cars) {
      car.contactCooldown = Math.max(0, (car.contactCooldown ?? 0) - deltaTime);
    }

    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        if ((a.contactCooldown ?? 0) > 0.02 && (b.contactCooldown ?? 0) > 0.02) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq === 0 || distSq > collisionRadius * collisionRadius) continue;

        const dist = Math.sqrt(distSq) || 1;
        const normalX = dx / dist;
        const normalY = dy / dist;
        const relativeVel = (b.vx - a.vx) * normalX + (b.vy - a.vy) * normalY;
        if (relativeVel >= 0) continue; // moving apart already

        // Lightweight impulse resolution
        const restitution = 1.1;
        const impulse = -(1 + restitution) * relativeVel * 0.5;
        const mitigationA = a.impactMitigation ?? 0.7;
        const mitigationB = b.impactMitigation ?? 0.7;
        a.vx -= impulse * normalX * (1 - mitigationA * 0.4);
        a.vy -= impulse * normalY * (1 - mitigationA * 0.4);
        b.vx += impulse * normalX * (1 - mitigationB * 0.4);
        b.vy += impulse * normalY * (1 - mitigationB * 0.4);

        const forwardA = Math.cos(a.angle) * normalX + Math.sin(a.angle) * normalY;
        const forwardB = -(Math.cos(b.angle) * normalX + Math.sin(b.angle) * normalY);
        const headOn = Math.abs(forwardA) > 0.6 && Math.abs(forwardB) > 0.6;
        const flankA = Math.abs(forwardA) > 0.65 && Math.abs(forwardB) < 0.35;
        const flankB = Math.abs(forwardB) > 0.65 && Math.abs(forwardA) < 0.35;

        if (headOn) {
          a.speed *= 0.85;
          b.speed *= 0.85;
          if (a === this.player || b === this.player) {
            this.hapticFeedback('medium');
            this.screenShake(0.4);
          }
        } else {
          if (flankA) {
            b.speed *= 0.7;
            b.contactCooldown = Math.max(b.contactCooldown ?? 0, 0.45);
          }
          if (flankB) {
            a.speed *= 0.7;
            a.contactCooldown = Math.max(a.contactCooldown ?? 0, 0.45);
          }
          if ((flankA && a === this.player) || (flankB && b === this.player)) {
            this.hapticFeedback('light');
            this.screenShake(0.25);
          }
        }

        // Positional correction to avoid overlap
        const penetration = collisionRadius - dist;
        if (penetration > 0) {
          const correction = penetration * 0.5;
          a.x -= normalX * correction;
          a.y -= normalY * correction;
          b.x += normalX * correction;
          b.y += normalY * correction;
          if (a.sprite) {
            a.sprite.x = a.x;
            a.sprite.y = a.y;
          }
          if (b.sprite) {
            b.sprite.x = b.x;
            b.sprite.y = b.y;
          }
        }

        a.contactCooldown = Math.max(a.contactCooldown ?? 0, 0.25);
        b.contactCooldown = Math.max(b.contactCooldown ?? 0, 0.25);
      }
    }
  }

  recordKill(killer: Car, victim: Car) {
    if (!killer || !victim) return;
    killer.kills = (killer.kills || 0) + 1;
    this.recentKills.push({ killer: killer.name, victim: victim.name, time: Date.now() });

    // KILL BOOST: Reward killer with 1.5s speed burst
    const now = Date.now();
    killer.killBoostUntil = now + 1500;
    killer.targetSpeed = killer.boostSpeed * 0.8;

    // Kill streak tracking for player - simplified without combo
    if (killer === this.player) {
      // Reset streak if more than 5 seconds since last kill
      if (now - this.lastKillTime > 5000) {
        this.killStreak = 0;
      }
      this.killStreak++;
      this.lastKillTime = now;

      // Simple haptic feedback
      this.hapticFeedback('heavy');
      
      // Mild screen shake
      this.screenShake(0.3);
    }
  }

  // Effective kill count for size scaling (practice uses local kills; tournament uses server HUD for the local player)
  private getEffectiveKillsForCar(car: Car): number {
    let kills = car.kills || 0;
    if (car === this.player && this.wsHud?.active && this.wsHud.playerId) {
      const srvKills = this.wsHud.kills?.[this.wsHud.playerId];
      if (typeof srvKills === 'number' && srvKills > kills) kills = srvKills;
    }
    return kills;
  }

  // Map kills + survival + boost → visual size multiplier
  private getSizeMultiplierForCar(car: Car): number {
    // START SMALL: Base size 0.8
    let size = 0.8;
    
    // GROW ON KILLS: +8% per kill (max +48% at 6 kills)
    const kills = this.getEffectiveKillsForCar(car);
    size += Math.max(0, Math.min(6, kills)) * 0.08;
    
    // GROW OVER TIME: +20% max over 45 seconds
    const survivalSec = car.spawnTime ? (Date.now() - car.spawnTime) / 1000 : 0;
    size += Math.min(0.20, survivalSec / 45 * 0.20);
    
    // GROW WHEN BOOSTING: +15% pulse when boosting
    if (car.isBoosting) {
      size += 0.15;
    }
    
    return size;
  }

  showKillStreakNotification(streak: number, x: number, y: number) {
    const streakTexts: Record<number, string> = {
      2: 'DOUBLE KILL',
      3: 'TRIPLE KILL',
      4: 'MEGA KILL',
      5: 'ULTRA KILL',
      6: 'MONSTER KILL',
      7: 'KILLING SPREE',
      8: 'UNSTOPPABLE',
      10: 'LEGENDARY'
    };

    const text = streakTexts[streak] || `${streak}x STREAK`;
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
    
    let playerDistance = Infinity;
    let viewportRadius = Math.max(window.innerWidth, window.innerHeight) / 2;
    const playerAlive = this.player && !this.player.destroyed;
    if (playerAlive) {
      const dx = car.x - this.player!.x;
      const dy = car.y - this.player!.y;
      playerDistance = Math.sqrt(dx * dx + dy * dy);
    }

    // AAA Impact Frame: only trigger when the drama is near the player or involves them
    const playerInvolved = car === this.player || (playerDistance <= viewportRadius * 0.9);
    if (playerAlive && car !== this.player && playerInvolved) {
      this.triggerImpactFrame();
    } else if (car === this.player) {
      this.triggerImpactFrame();
    }

    // Haptic feedback on death (mobile)
    if (car === this.player) {
      this.hapticFeedback('heavy');
      
      // RESET KILL STREAK WHEN PLAYER DIES
      this.killStreak = 0;
      this.lastKillTime = 0;
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
    
    // Explosion already created at collision point - don't duplicate here

    // Flash only if death is near player (within viewport)
    if (playerAlive) {
      if (playerDistance < viewportRadius) {
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
    const particleCount = 30; // More particles for visibility
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.3;
      const speed = 150 + Math.random() * 200; // Faster explosion
      
      // Bright explosion colors (mix victim color with bright white/yellow)
      const explosionColors = [0xFFFFFF, 0xFFFF00, 0xFF6600, color];
      const particleColor = explosionColors[Math.floor(Math.random() * explosionColors.length)];
      
      const particle: Particle = {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.2, // Longer lifetime
        color: particleColor,
        graphics: new PIXI.Graphics()
      };
      
      // Bigger particles (5-8px radius)
      const size = 5 + Math.random() * 3;
      particle.graphics.circle(0, 0, size).fill(particleColor);
      particle.graphics.x = x;
      particle.graphics.y = y;
      
      this.worldContainer.addChild(particle.graphics);
      this.particles.push(particle);
    }

    // Add screen shake on explosion (reduced) - but skip in mobile practice for stability
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isTournament = !!(this.wsHud && this.wsHud.active);
      if (isMobile && !isTournament) {
        this.camera.shakeX = 0;
        this.camera.shakeY = 0;
      } else {
        this.camera.shakeX = 6;
        this.camera.shakeY = 6;
      }
    } catch {
      this.camera.shakeX = 6;
      this.camera.shakeY = 6;
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
    const now = Date.now();
    const t = now * 0.001;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.expiresAt && now >= p.expiresAt) {
        try { this.pickupsContainer.removeChild(p.graphics); } catch {}
        this.pickups.splice(i, 1);
        continue;
      }

      const pulseSpeed = p.type === 'overdrive' ? 2.6 : 2.0;
      p.pulseT += deltaTime * pulseSpeed;
      const scale = 1 + Math.sin(p.pulseT) * (p.type === 'overdrive' ? 0.09 : 0.06);
      p.shape.scale.set(scale);
      p.shape.alpha = p.type === 'overdrive'
        ? 0.9 + Math.sin(t + p.pulseT) * 0.12
        : 0.7 + Math.sin(t + p.pulseT) * 0.15;
      p.shape.rotation += p.rotationSpeed * deltaTime;
      p.aura.clear();
      const auraWidth = p.type === 'overdrive' ? 2 : 1;
      const auraAlpha = p.type === 'overdrive' ? 0.2 : 0.08;
      const auraScale = p.type === 'overdrive' ? 1.7 : 1.15;
      p.aura.circle(0, 0, p.radius * (auraScale + Math.sin(t * 1.2) * 0.05))
        .stroke({ width: auraWidth, color: p.color, alpha: auraAlpha });
    }

    if (this.player && !this.player.destroyed) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const orb = this.pickups[i];
        const dx = orb.x - this.player.x;
        const dy = orb.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < orb.radius + 18) {
          if (orb.type === 'energy') {
            this.player.boostEnergy = Math.min(this.player.maxBoostEnergy, this.player.boostEnergy + orb.amount);
          } else if (orb.type === 'overdrive') {
            this.applyOverdriveBuff(this.player);
          }

          this.createExplosion(orb.x, orb.y, orb.type === 'overdrive' ? 0xfacc15 : 0x00ffaa);
          try { this.pickupsContainer.removeChild(orb.graphics); } catch {}
          this.pickups.splice(i, 1);
          this.hapticFeedback(orb.type === 'overdrive' ? 'success' : 'light');
          this.screenShake(orb.type === 'overdrive' ? 0.6 : 0.3);
        }
      }
    }

    if (this.pickups.length < 25) this.spawnPickups(8);
  }

  handleRespawning(_deltaTime: number) {
    // Battle Royale: No respawning - players stay dead permanently
    // This method is kept for potential future modes but does nothing in BR
  }

  updateAliveCount() {
    const isOnline = !!(this.wsHud && this.wsHud.active);
    if (isOnline && (this.wsHud as any)?.aliveSet?.size != null) {
      this.alivePlayers = (this.wsHud as any).aliveSet.size;
    } else {
      const allCars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null);
      this.alivePlayers = allCars.filter(car => !car.destroyed).length;
    }

    // Update HUD manager
    if (this.hudManager) {
      this.hudManager.updateAliveCount(this.alivePlayers);
    }
  }

  endGame() {
    this.gamePhase = 'finished';
    const allCars = [this.player, this.bot, ...this.extraBots].filter((car): car is Car => car !== null);
    const aliveCars = allCars.filter(car => !car.destroyed);
    const winner = aliveCars[0];
    
    // AAA Victory Moment: Slow-mo + zoom on winner
    if (winner) {
      this.triggerVictorySlowMo(winner);
    }
    
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
    title.textContent = isVictory ? 'VICTORY' : 'ELIMINATED';

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
      ? 'Champion'
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
      <div style="color:#ffffff; font-size: 16px; font-weight:700; margin-bottom: 12px;">BATTLE STATS</div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">Survival Time</span>
        <span style="color:#ffffff; font-size: 14px; font-weight:600;">${minutes}:${seconds.toString().padStart(2, '0')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">Knockouts</span>
        <span style="color:#ffffff; font-size: 14px; font-weight:600;">${eliminated}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 8px 0;">
        <span style="color:rgba(255,255,255,0.8); font-size: 14px;">Placement</span>
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
    this.updateProximityRadar(); return;
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
      const isBounty = ping.kind === 'bounty';
      ctx.fillStyle = isBounty ? `rgba(250, 204, 21, ${alpha})` : `rgba(255, 0, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, isBounty ? 4 : 3, 0, Math.PI * 2); // Slightly larger dot for bounty
      ctx.fill();
      
      // Add pulsing effect
      if (age < 0.3) { // Pulse for first 300ms
        const pulseRadius = 2 + Math.sin(age * 20) * 2;
        ctx.strokeStyle = isBounty ? `rgba(250, 204, 21, ${alpha * 0.6})` : `rgba(255, 0, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw echo rings from boost events (inside map rect only) - brighter and more visible
    for (const ping of this.echoPings) {
      const ex = centerX + (ping.x * scale);
      const ey = centerY + (ping.y * scale);
      const elapsed = (now - ping.timestamp) / 1000;
      const life = (ping.ttlMs || 0) / 1000 || 0.9;
      const tnorm = Math.min(1, elapsed / life);
      const r = tnorm * radius * 0.9;
      const a = Math.max(0, 0.85 * (1 - tnorm)); // Brighter alpha
      if (ex >= rectL && ex <= rectR && ey >= rectT && ey <= rectB) {
        ctx.strokeStyle = `rgba(0, 255, 200, ${a})`;
        ctx.lineWidth = 2; // Thicker line
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
    if (!this.player || !this.hudManager) return;

    const isOnline = !!(this.wsHud && this.wsHud.active);
    const boostingNow = !!this.player.isBoosting;
    let energyPercent = 100;
    let isLow = false;
    if (isOnline) {
      const cdMs = Number((this.player as any).serverBoostCooldownMs ?? 0) || 0;
      const maxCdMs = Number((this.player as any).serverBoostMaxCooldownMs ?? 0) || 0;
      if (maxCdMs > 0) {
        energyPercent = (1 - Math.max(0, Math.min(maxCdMs, cdMs)) / maxCdMs) * 100;
        isLow = cdMs > 0;
      } else {
        energyPercent = 100;
        isLow = false;
      }
    } else {
      energyPercent = (this.player.boostEnergy / this.player.maxBoostEnergy) * 100;
      isLow = this.player.boostEnergy < this.player.minBoostEnergy;
    }
    
    // Update HUD manager
    this.hudManager.updateBoost(energyPercent, boostingNow, isLow);
    
    // Emit echo on boost start
    if (boostingNow && !(this as any).wasBoostingUI) {
      this.emitBoostEcho(this.player.x, this.player.y);
    }
    (this as any).wasBoostingUI = boostingNow;
  }
  
  updateComboDisplay() {
    // Combo display removed - too cluttered
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
    const allCars = [this.bot, ...this.extraBots, ...Array.from(this.serverPlayers.values())].filter((car): car is Car => car !== null && !car.destroyed);
    const isOnline = !!(this.wsHud && this.wsHud.active);
    const mode = (this.wsHud as any)?.mode;
    const entryFee = Number((this.wsHud as any)?.entryFee ?? NaN);
    const isPracticeOnline = isOnline && (mode === 'practice' || entryFee === 0);
    const detectionRange = isPracticeOnline ? 12000 : 2500;
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
    let indicatorX: number;
    let indicatorY: number;
    const aspectRatio = W / H;
    const cornerAngle = Math.atan(1 / aspectRatio);
    const absAngle = Math.abs(angle);
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
      // Accent the player head with a glow while boosting (filter removed for compatibility)
      // try { this.player.headGraphics!.filters = [new (PIXI as any).filters.BlurFilter({ strength: 2 })]; } catch {}
    } else {
      // Boost not active - fade out effects
      boostOverlay.style.opacity = '0';
      // try { this.player.headGraphics!.filters = []; } catch {}
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
  // Sharper pacing: ~42s core rounds with aggressive finale
  this.zone.durationMs = 42000;
    this.zoneGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.zoneGraphics);
    this.finalSurgeBannerShown = false;

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
    const zoneStart = this.zone.startAtMs || now;
    const elapsed = Math.max(0, now - zoneStart);
    const progress = this.zone.durationMs > 0 ? Math.min(1, Math.max(0, elapsed / this.zone.durationMs)) : 0;
    const tension = Math.pow(progress, 1.35);
    const targetInterval = 3200 - Math.min(2200, 2200 * tension);
    this.rectZone.sliceIntervalMs = Math.max(900, targetInterval);
    this.rectZone.sliceStep = Math.round(260 + 240 * tension);

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

    const safeLeft = this.rectZone.left;
    const safeTop = this.rectZone.top;
    const safeWidth = this.rectZone.right - this.rectZone.left;
    const safeHeight = this.rectZone.bottom - this.rectZone.top;

    // 1) Safe zone fill + bold border so it's clearly distinct from map edge
    this.zoneGraphics
      .rect(safeLeft, safeTop, safeWidth, safeHeight)
      .fill({ color: 0x020617, alpha: 0.55 })
      .stroke({ width: 6, color: this.theme.accent, alpha: 0.9 });
    // Inner crisp line for extra clarity
    this.zoneGraphics
      .rect(safeLeft + 4, safeTop + 4, Math.max(0, safeWidth - 8), Math.max(0, safeHeight - 8))
      .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });

    // 2) Darken everything outside the safe zone with a strong danger tint
    const dangerPulse = 0.3 + 0.2 * Math.sin(now * 0.003);
    const outerAlpha = 0.16 + dangerPulse * 0.16;
    const worldLeft = -this.arena.width / 2;
    const worldTop = -this.arena.height / 2;
    const worldRight = this.arena.width / 2;
    const worldBottom = this.arena.height / 2;

    // Top band
    this.zoneGraphics
      .rect(worldLeft, worldTop, this.arena.width, Math.max(0, safeTop - worldTop))
      .fill({ color: 0x450a0a, alpha: outerAlpha });
    // Bottom band
    this.zoneGraphics
      .rect(worldLeft, this.rectZone.bottom, this.arena.width, Math.max(0, worldBottom - this.rectZone.bottom))
      .fill({ color: 0x450a0a, alpha: outerAlpha });
    // Left band
    this.zoneGraphics
      .rect(worldLeft, safeTop, Math.max(0, safeLeft - worldLeft), safeHeight)
      .fill({ color: 0x450a0a, alpha: outerAlpha });
    // Right band
    this.zoneGraphics
      .rect(this.rectZone.right, safeTop, Math.max(0, worldRight - this.rectZone.right), safeHeight)
      .fill({ color: 0x450a0a, alpha: outerAlpha });
      
    // 3) Telegraph arrow on pending side
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
    if (!this.finalSurgeBannerShown && remainMs <= 10000) {
      this.showFinalSurgeBanner();
      this.finalSurgeBannerShown = true;
    }
    
    // Update zone timer in HUD
    if (this.hudManager) {
      const secs = Math.ceil(remainMs / 1000);
      this.hudManager.updateZoneTimer(secs);
    }

    // Apply soft damage outside rectangular zone
    const applyZone = (car?: Car | null) => {
      if (!car || car.destroyed) return;
      const inside = car.x >= this.rectZone.left && car.x <= this.rectZone.right && car.y >= this.rectZone.top && car.y <= this.rectZone.bottom;
      if (!inside) {
        // Show warning for player outside zone
        if (car === this.player) {
          this.showZoneWarning();
        }
        
        // Compute shortest push vector toward rectangle
        const clampedX = Math.max(this.rectZone.left, Math.min(this.rectZone.right, car.x));
        const clampedY = Math.max(this.rectZone.top, Math.min(this.rectZone.bottom, car.y));
        const dx = car.x - clampedX;
        const dy = car.y - clampedY;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        const pushStrength = 14 + tension * 36;
        car.vx -= dirX * pushStrength * deltaTime;
        car.vy -= dirY * pushStrength * deltaTime;
        car.outZoneTime = (car.outZoneTime || 0) + deltaTime;
        // If prolonged outside, eliminate
        const grace = Math.max(2.4, 6 - tension * 3.5);
        if (car.outZoneTime > grace) this.destroyCar(car);
      } else {
        car.outZoneTime = 0;
        // Hide warning when back inside
        if (car === this.player) {
          this.hideZoneWarning();
        }
      }
    };
    applyZone(this.player);
    applyZone(this.bot);
    for (const b of this.extraBots) applyZone(b);
    
    // Update danger overlay based on zone proximity and time
    this.updateDangerOverlay(remainMs);
  }

  private showFinalSurgeBanner() {
    if (!this.uiContainer) return;
    let banner = document.getElementById('final-surge-banner') as HTMLDivElement | null;
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'final-surge-banner';
      Object.assign(banner.style, {
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 32px',
        borderRadius: '18px',
        background: 'rgba(15, 23, 42, 0.9)',
        border: '2px solid rgba(250,204,21,0.6)',
        color: '#facc15',
        fontSize: '28px',
        fontWeight: '800',
        letterSpacing: '0.14em',
        textShadow: '0 0 18px rgba(250,204,21,0.45)',
        opacity: '0',
        transition: 'opacity 200ms ease-out',
        pointerEvents: 'none',
        zIndex: '50',
        textAlign: 'center'
  } as Partial<CSSStyleDeclaration>);
      banner.textContent = 'FINAL SURGE • ZONE CRUSHING';
      this.uiContainer.appendChild(banner);
    }

    banner.style.opacity = '1';
    if (this.finalSurgeTimeout) window.clearTimeout(this.finalSurgeTimeout);
    this.finalSurgeTimeout = window.setTimeout(() => {
      try { banner!.style.opacity = '0'; } catch {}
    }, 2200);
  }
  
  showZoneWarning() {
    let warning = document.getElementById('zone-warning');
    if (!warning && this.uiContainer) {
      warning = document.createElement('div');
      warning.id = 'zone-warning';
      
      const isMobile = window.innerWidth <= 768;
      Object.assign(warning.style, {
        position: 'absolute',
        top: isMobile ? '30%' : '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: '#ef4444',
        fontSize: isMobile ? '20px' : '32px',
        fontWeight: '700',
        textAlign: 'center',
        zIndex: '30',
        pointerEvents: 'none',
        textShadow: '0 0 10px rgba(239,68,68,0.8)',
        animation: 'pulse 1s ease-in-out infinite'
      });
      this.uiContainer.appendChild(warning);
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }
    
    if (warning) {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        // Simple mobile warning
        warning.innerHTML = `<div>OUTSIDE SAFE ZONE</div>`;
      } else {
        warning.innerHTML = `
          <div>OUTSIDE SAFE ZONE</div>
          <div style="font-size:20px;margin-top:8px">Return to safe area</div>
        `;
      }
      warning.style.display = 'block';
    }
  }
  
  hideZoneWarning() {
    const warning = document.getElementById('zone-warning');
    if (warning) {
      warning.style.display = 'none';
    }
  }
  
  updateDangerOverlay(remainMs: number) {
    const overlay = document.getElementById('game-danger-overlay');
    if (!overlay || !this.player || this.player.destroyed) return;
    
    // Calculate danger level from multiple sources
    let dangerLevel = 0;
    
    // 1. Time pressure - final 5 seconds
    if (remainMs <= 5000) {
      dangerLevel = Math.max(dangerLevel, 1 - (remainMs / 5000)); // 0 to 1 as time runs out
    }
    
    // 2. Zone proximity - when near zone edges
    if (this.player) {
      const distToLeft = Math.abs(this.player.x - this.rectZone.left);
      const distToRight = Math.abs(this.player.x - this.rectZone.right);
      const distToTop = Math.abs(this.player.y - this.rectZone.top);
      const distToBottom = Math.abs(this.player.y - this.rectZone.bottom);
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      const dangerThreshold = 200; // Distance at which warning starts
      
      if (minDist < dangerThreshold) {
        const proximityDanger = 1 - (minDist / dangerThreshold);
        dangerLevel = Math.max(dangerLevel, proximityDanger * 0.6); // Max 0.6 from proximity
      }
    }
    
    // 3. Outside zone - max danger
    if (this.player.outZoneTime && this.player.outZoneTime > 0) {
      dangerLevel = Math.max(dangerLevel, 0.8);
    }
    
    // Apply smooth transitions
    const targetOpacity = dangerLevel * 0.8; // Max 80% opacity
    overlay.style.opacity = targetOpacity.toFixed(2);
    
    // Pulsing border effect when in high danger
    if (dangerLevel > 0.3) {
      const pulseIntensity = Math.sin(Date.now() * 0.005) * 0.5 + 0.5; // 0 to 1
      const borderAlpha = dangerLevel * pulseIntensity * 0.8;
      overlay.style.borderColor = `rgba(239, 68, 68, ${borderAlpha})`;
      overlay.style.filter = `saturate(${0.7 - dangerLevel * 0.3}) brightness(${1 - dangerLevel * 0.2})`;
    } else {
      overlay.style.borderColor = 'transparent';
      overlay.style.filter = 'none';
    }
  }
  
  triggerImpactFrame() {
    // Very brief time slow (not freeze) - 25ms at 50% speed
    const slowDuration = 25;
    const originalTimeScale = (this.app as any)?.ticker?.speed ?? 1;
    
    // Slow time (50% speed instead of full freeze)
    if ((this.app as any)?.ticker) {
      (this.app as any).ticker.speed = 0.5;
    }
    
    // Subtle camera shake (1.5x intensity)
    this.screenShake(1.5);
    
    // Haptic feedback (short sharp burst)
    try { navigator.vibrate?.(10); } catch {}
    
    // Resume after brief slow
    setTimeout(() => {
      if ((this.app as any)?.ticker) {
        (this.app as any).ticker.speed = originalTimeScale;
      }
    }, slowDuration);
    
    // Add impact flash overlay
    try {
      let impactFlash = document.getElementById('impact-flash');
      if (!impactFlash) {
        impactFlash = document.createElement('div');
        impactFlash.id = 'impact-flash';
        impactFlash.style.cssText = `
          position: fixed;
          inset: 0;
          background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
          pointer-events: none;
          z-index: 9998;
          opacity: 0;
          transition: opacity 100ms ease-out;
        `;
        document.body.appendChild(impactFlash);
      }
      // Trigger flash
      impactFlash.style.opacity = '1';
      setTimeout(() => { try { impactFlash!.style.opacity = '0'; } catch {} }, 50);
    } catch {}
  }
  
  triggerVictorySlowMo(winner: Car) {
    // Slow motion effect for 1.5 seconds
    const slowDuration = 1500;
    const slowMotionSpeed = 0.3; // 30% speed
    
    // Slow down time
    if ((this.app as any)?.ticker) {
      (this.app as any).ticker.speed = slowMotionSpeed;
    }
    
    // Zoom camera to winner
    if (this.camera) {
      const startZoom = this.camera.zoom;
      const targetZoom = Math.min(0.8, startZoom * 1.3); // Zoom in 30%
      const zoomDuration = 800;
      const startTime = Date.now();
      
      const animateZoom = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / zoomDuration);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        
        this.camera.targetZoom = startZoom + (targetZoom - startZoom) * eased;
        
        if (progress < 1) {
          requestAnimationFrame(animateZoom);
        }
      };
      animateZoom();
    }
    
    // Add epic victory overlay
    try {
      let victoryOverlay = document.getElementById('victory-overlay');
      if (!victoryOverlay) {
        victoryOverlay = document.createElement('div');
        victoryOverlay.id = 'victory-overlay';
        victoryOverlay.style.cssText = `
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, 
            rgba(16, 185, 129, 0.2) 0%, 
            rgba(16, 185, 129, 0.05) 50%, 
            transparent 100%);
          pointer-events: none;
          z-index: 9997;
          opacity: 0;
          transition: opacity 600ms ease-in;
          box-shadow: inset 0 0 100px rgba(16, 185, 129, 0.3);
        `;
        document.body.appendChild(victoryOverlay);
      }
      // Fade in
      victoryOverlay.style.opacity = '1';
      
      // Add "VICTORY" text if player won
      if (winner === this.player) {
        const victoryText = document.createElement('div');
        victoryText.style.cssText = `
          position: fixed;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.5);
          font-size: 72px;
          font-weight: 900;
          color: #10b981;
          text-shadow: 
            0 0 40px rgba(16, 185, 129, 1),
            0 0 80px rgba(16, 185, 129, 0.6),
            0 8px 32px rgba(0, 0, 0, 0.8);
          letter-spacing: 12px;
          z-index: 9998;
          opacity: 0;
          transition: all 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        `;
        victoryText.textContent = 'VICTORY';
        document.body.appendChild(victoryText);
        
        // Animate in
        setTimeout(() => {
          victoryText.style.opacity = '1';
          victoryText.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        
        // Remove after slow-mo ends
        setTimeout(() => {
          victoryText.style.opacity = '0';
          victoryText.style.transform = 'translate(-50%, -50%) scale(1.5)';
          setTimeout(() => victoryText.remove(), 500);
        }, slowDuration - 300);
      }
    } catch {}
    
    // Resume normal speed after slow-mo
    setTimeout(() => {
      if ((this.app as any)?.ticker) {
        (this.app as any).ticker.speed = 1.0;
      }
    }, slowDuration);
  }
  
  updateRoundSystem() {
    // Round indicator disabled - using unified top HUD bar instead
    return;
    // Display round UI - compact for mobile
    let roundUI = document.getElementById('round-indicator');
    if (!roundUI && this.uiContainer) {
      roundUI = document.createElement('div');
      roundUI.id = 'round-indicator';
      
      const isMobile = window.innerWidth <= 768;
      Object.assign(roundUI.style, {
        position: 'absolute',
        top: isMobile ? '10px' : '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: this.theme.text,
        fontSize: isMobile ? '12px' : '16px',
        fontWeight: '600',
        background: 'rgba(0,0,0,0.7)',
        padding: isMobile ? '4px 10px' : '8px 16px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.2)',
        zIndex: '25',
        pointerEvents: 'none'
      });
      this.uiContainer.appendChild(roundUI);
    }
    
    if (roundUI) {
      const winsNeeded = Math.ceil(this.totalRounds / 2);
      const roundTimeRemain = this.zone.startAtMs ? Math.max(0, this.zone.durationMs - (Date.now() - this.zone.startAtMs)) : 0;
      const secs = Math.ceil(roundTimeRemain / 1000);
      const isMobile = window.innerWidth <= 768;
      
      // Count alive players
      const alivePlayers = [this.player, this.bot, ...this.extraBots].filter(c => c && !c.destroyed).length;
      
      if (isMobile) {
        // Cleaner mobile view - essential info only
        roundUI.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600">
            <span style="color:#10b981">R${this.currentRound}</span>
            <span style="color:#666">|</span>
            <span style="color:#fbbf24">${String(secs%60).padStart(2,'0')}s</span>
            <span style="color:#666">|</span>
            <span style="color:#3b82f6">${alivePlayers} left</span>
          </div>
        `;
      } else {
        // Desktop view - remove W/L display
        roundUI.innerHTML = `
          <div style="text-align:center">
            <div style="font-size:14px;opacity:0.7;margin-bottom:4px">BEST OF ${this.totalRounds} • First to ${winsNeeded}</div>
            <div style="font-size:18px;color:#10b981;margin:4px 0">Round ${this.currentRound}/3 • ${alivePlayers} Alive</div>
            <div style="font-size:14px;opacity:0.9;color:#fbbf24">TIME ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}</div>
          </div>
        `;
      }
    }
    
    // Check round end conditions
    if (!this.roundInProgress) return;
    
    const aliveCars = [this.player, this.bot, ...this.extraBots].filter(c => c && !c.destroyed);
    
    // Round ends when only one car remains (last survivor wins)
    if (aliveCars.length === 1 && this.roundInProgress) {
      const playerWon = !!(this.player && !this.player.destroyed);
      this.endRound(playerWon);
    } else if (aliveCars.length === 0 && this.roundInProgress) {
      // Everyone died (zone killed all) - round draw, replay
      this.endRound(false);
    }
  }
  
  endRound(playerWon: boolean) {
    this.roundInProgress = false;
    this.roundEndTime = Date.now();
    
    // Hide zone warning
    this.hideZoneWarning();
    
    if (playerWon) {
      this.roundWins++;
    } else {
      this.roundLosses++;
    }
    
    // Show round result
    this.showRoundResult(playerWon);
    
    // Check if match is over
    const winsNeeded = Math.ceil(this.totalRounds / 2);
    if (this.roundWins >= winsNeeded) {
      setTimeout(() => this.showMatchResult(true), 2500);
    } else if (this.roundLosses >= winsNeeded) {
      setTimeout(() => this.showMatchResult(false), 2500);
    } else {
      // Start next round
      setTimeout(() => this.startNextRound(), 3000);
    }
  }
  
  showRoundResult(won: boolean) {
    let resultUI = document.getElementById('round-result');
    const isMobile = window.innerWidth <= 768;
    
    if (!resultUI && this.uiContainer) {
      resultUI = document.createElement('div');
      resultUI.id = 'round-result';
      Object.assign(resultUI.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: isMobile ? '32px' : '48px',
        fontWeight: '700',
        color: won ? '#10b981' : '#ef4444',
        textAlign: 'center',
        zIndex: '30',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 300ms ease',
        background: 'rgba(0,0,0,0.85)',
        padding: isMobile ? '20px 32px' : '32px 48px',
        borderRadius: '12px',
        border: `2px solid ${won ? '#10b981' : '#ef4444'}`
      });
      this.uiContainer.appendChild(resultUI);
    }
    
    if (resultUI) {
      const message = won ? (isMobile ? 'ROUND WON' : 'ROUND WON') : (isMobile ? 'ROUND LOST' : 'ROUND LOST');
      const subtitle = won 
        ? `${this.roundWins}/${Math.ceil(this.totalRounds/2)} wins` 
        : `${this.roundLosses} losses`;
      
      resultUI.innerHTML = `
        <div>${message}</div>
        <div style="font-size:${isMobile ? '16px' : '20px'};margin-top:${isMobile ? '8px' : '12px'};opacity:0.8">${subtitle}</div>
      `;
      resultUI.style.opacity = '1';
      setTimeout(() => { resultUI!.style.opacity = '0'; }, 2000);
    }
  }
  
  showMatchResult(won: boolean) {
    let matchUI = document.getElementById('match-result');
    const isMobile = window.innerWidth <= 768;
    
    if (!matchUI && this.uiContainer) {
      matchUI = document.createElement('div');
      matchUI.id = 'match-result';
      Object.assign(matchUI.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: isMobile ? '36px' : '56px',
        fontWeight: '700',
        color: won ? '#10b981' : '#ef4444',
        textAlign: 'center',
        zIndex: '35',
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.9)',
        padding: isMobile ? '24px 40px' : '32px 64px',
        borderRadius: '16px',
        border: `3px solid ${won ? '#10b981' : '#ef4444'}`
      });
      this.uiContainer.appendChild(matchUI);
    }
    
    if (matchUI) {
      matchUI.innerHTML = `
        <div>${won ? 'VICTORY' : 'DEFEAT'}</div>
        <div style="font-size:${isMobile ? '18px' : '24px'};margin-top:${isMobile ? '12px' : '16px'};opacity:0.8">
          ${this.roundWins} - ${this.roundLosses}
        </div>
      `;
    }
  }
  
  startNextRound() {
    this.currentRound++;
    this.roundInProgress = true;
    
    // Reset all cars
    const resetCar = (car: Car | null) => {
      if (!car) return;
      car.destroyed = false;
      car.sprite.visible = true;
      car.vx = 0;
      car.vy = 0;
      car.speed = car.baseSpeed;
      car.targetSpeed = car.baseSpeed;
      car.isBoosting = false;
      car.boostEnergy = car.maxBoostEnergy;
      car.outZoneTime = 0;
      
      // Respawn at random position
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 500 + 200;
      car.x = Math.cos(angle) * dist;
      car.y = Math.sin(angle) * dist;
      car.angle = Math.random() * Math.PI * 2;
      car.targetAngle = car.angle;
    };
    
    resetCar(this.player);
    resetCar(this.bot);
    this.extraBots.forEach(b => resetCar(b));
    
    // Reset zone for new round (faster closing for urgency)
  this.zone.startAtMs = Date.now() + 3000; // Start zone after countdown
  this.zone.durationMs = 26000; // Later rounds stay fast but allow finale
    this.rectZone.left = -this.arena.width / 2;
    this.rectZone.right = this.arena.width / 2;
    this.rectZone.top = -this.arena.height / 2;
    this.rectZone.bottom = this.arena.height / 2;
    this.rectZone.nextSliceAt = this.zone.startAtMs + 5000; // First slice at 5s
    this.rectZone.pendingSide = null;
    this.sliceIndex = 0;
    this.finalSurgeBannerShown = false;
    
    // Clear trails
    this.trails = [];
    if (this.trailContainer) {
      this.trailContainer.removeChildren();
    }
    
    // Clear particles
    this.particles.forEach(p => {
      if (p.graphics && p.graphics.parent) {
        p.graphics.parent.removeChild(p.graphics);
      }
    });
    this.particles = [];
    
    // Start countdown
    this.preStart = { startAt: Date.now(), durationMs: 3000 };
  }

  emitBoostEcho(x: number, y: number) {
    this.echoPings.push({ x, y, timestamp: Date.now(), playerId: 'echo', kind: 'echo', ttlMs: 1200 }); // Longer visible time
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
  const { state: wsState, sendInput } = useWs();

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

  // Wire WS input sending into the Pixi game loop (online matches).
  useEffect(() => {
    const game = gameRef.current as any;
    if (game) game.wsSendInput = sendInput;
  }, [sendInput]);

  // Bind WsProvider state into HUD when in tournament mode
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (wsState?.phase === 'game' && wsState.game) {
      try {
        try { game.applyServerWorld(wsState.game.world as any); } catch {}
        try { (game as any).objective = (wsState.game as any).objective || null; } catch {}
        try { (game as any).lastServerTimeMs = Number((wsState.game as any).timestamp || 0) || 0; } catch {}
        const players = wsState.game.players || [];
        const aliveSet = new Set<string>(players.filter(p => p.isAlive).map(p => p.id));
        const idToName: Record<string, string> = {};
        const lobbyAny: any = wsState.lobby || null;
        const playerNames: Record<string, string> = (lobbyAny && typeof lobbyAny === 'object' && lobbyAny.playerNames) ? lobbyAny.playerNames : {};
        const mode = lobbyAny?.mode ?? ((Number(lobbyAny?.entryFee || 0) === 0) ? 'practice' : 'tournament');
        const entryFee = lobbyAny?.entryFee ?? null;
        for (const p of players) {
          const short = `${p.id.slice(0,4)}…${p.id.slice(-4)}`;
          idToName[p.id] = (typeof playerNames?.[p.id] === 'string' && playerNames[p.id]) ? playerNames[p.id] : short;
        }
        game.wsHud = {
          active: true,
          kills: wsState.kills || {},
          killFeed: wsState.killFeed || [],
          playerId: wsState.playerId,
          idToName,
          aliveSet,
          eliminationOrder: wsState.eliminationOrder || [],
          mode,
          entryFee
        };
        try {
          if (!(game as any).srOnlineHintShown && mode === 'practice') {
            (game as any).srOnlineHintShown = true;
            const el = document.getElementById('game-toast');
            if (el) {
              el.textContent = 'Follow HUNT + edge arrows to find rivals fast';
              el.style.opacity = '1';
              setTimeout(() => { try { el.style.opacity = '0'; } catch {} }, 1600);
            }
          }
        } catch {}
        game.syncServerPlayers(wsState.game.players);
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
        
