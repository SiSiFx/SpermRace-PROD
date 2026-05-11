/**
 * Enhanced Render System
 * Full-featured PIXI.js rendering with car sprites, trails, effects, and UI
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import { angularDistance } from '../components/Velocity';
import type { Renderable } from '../components/Renderable';
import { RenderLayer } from '../components/Renderable';
import type { Trail } from '../components/Trail';
import type { TrailPoint } from '../components/Trail';
import { getTrailAlpha } from '../components/Trail';
import type { Player } from '../components/Player';
import { EntityType } from '../components/Player';
import type { Health } from '../components/Health';
import { EntityState, hasSpawnProtection, getSpawnProtectionRemaining } from '../components/Health';
import type { Boost } from '../components/Boost';
import type { Abilities } from '../components/Abilities';
import { AbilityType } from '../components/Abilities';
import { isAbilityActive } from '../components/Abilities';
import { ComponentNames, createComponentMask } from '../components';
import { getParticlePool, ParticleType } from '../pooling';
import { Container, Graphics, TextureStyle, type Container as ContainerType, type Graphics as GraphicsType } from 'pixi.js';
import type { CameraConfig } from './CameraSystem';
import { CameraSystem } from './CameraSystem';
import { PowerupSystem, PowerupType } from './PowerupSystem';
import type { PowerupData } from './PowerupSystem';
import type { Entity } from '../core/Entity';
import type { ZoneSystem } from './ZoneSystem';
import type { SpatialGrid } from '../spatial/SpatialGrid';
import { PLAYER_VISUAL_CONFIG, TRAIL_EFFECTS, MICROSCOPE_PALETTE, MICROSCOPE_VISUALS, MATCH_CONFIG, ABILITY_CONFIG, POWERUP_CONFIG } from '../config/GameConstants';
import { PostProcessingSystem, createPostProcessingSystem } from './PostProcessingSystem';
import type { KillPower } from '../components/KillPower';
import { getKillPowerGrowthMult } from '../components/KillPower';
import type { SpermClass } from '../components/SpermClass';
import { SpermClassType } from '../components/SpermClass';
import type { TrailSystem } from './TrailSystem';
import type { AbilitySystem } from './AbilitySystem';

/**
 * Sperm car visual configuration
 */
interface CarVisualConfig {
  /** Body radius */
  bodyRadius: number;

  /** Tail length */
  tailLength: number;

  /** Tail segments */
  tailSegments: number;

  /** Tail amplitude */
  tailAmplitude: number;

  /** Tail wave speed */
  tailWaveSpeed: number;

  /** Body color */
  color: number;
}

/**
 * Render system configuration
 */
export interface RenderSystemConfig {
  /** PIXI Application */
  app: unknown;

  /** World container for game objects */
  worldContainer: ContainerType;

  /** UI container for UI elements */
  uiContainer: HTMLElement;

  /** Camera system for camera transforms */
  cameraSystem: CameraSystem;

  /** Show FPS counter */
  showFPS?: boolean;

  /** Show debug info */
  debug?: boolean;
}

/**
 * Cached entity graphics
 */
interface EntityGraphics {
  /** Container for all entity graphics */
  container: ContainerType;

  /** Body graphics */
  body: GraphicsType;

  /** Tail graphics */
  tail: GraphicsType;

  /** Nameplate element */
  nameplate?: HTMLDivElement;

  /** Shield effect */
  shield: GraphicsType;

  /** Glow effect */
  glow: GraphicsType;

  /** Smoothed visual facing angle (head/container) */
  visualAngle: number;

  /** Cache key for the last head geometry draw */
  bodyDrawKey: string;

  /** Timestamp (ms) of first visible frame — drives scale pop-in; 0 = not yet started */
  spawnAnimStart: number;
}

interface TrailGraphicsCache {
  graphics: GraphicsType;
  pointCount: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  fadeBucket: number;
  cullKey: string;
}

interface OffscreenIndicatorSpec {
  color: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  pulseX: number;
  pulseY: number;
  pulseSize: number;
  pulseAlpha: number;
  key: string;
}

const TRAIL_REDRAW_INTERVAL_MS = 80;
const TRAIL_CULL_BUCKET_SIZE = 160;
const TRAIL_APPEND_REDRAW_POINTS = 3;
const TRAIL_APPEND_REDRAW_INTERVAL_MS = 120;
const TRAIL_FX_SCAN_LIMIT = 24;
const TRAIL_FX_SAMPLE_LIMIT = 6;
const OFFSCREEN_INDICATOR_BUCKET_SIZE = 10;
const OFFSCREEN_INDICATOR_PULSE_HZ = 12;

/**
 * Enhanced render system for PIXI.js rendering
 */
export class RenderSystem extends System {
  public readonly priority = SystemPriority.RENDERING;

  private readonly _config: RenderSystemConfig;
  private readonly _camera: CameraSystem;

  // Layer containers
  private readonly _layers: Map<RenderLayer, ContainerType> = new Map();

  // Graphics cache
  private readonly _entityGraphics: Map<string, EntityGraphics> = new Map();

  // Trail graphics cache
  private readonly _trailGraphics: Map<string, TrailGraphicsCache> = new Map();
  private _trailRedrawsLastFrame: number = 0;
  private _trailReuseSkipsLastFrame: number = 0;
  private _bodyRedrawsLastFrame: number = 0;
  private _bodyReuseSkipsLastFrame: number = 0;
  private _offscreenIndicators: GraphicsType | null = null;
  private _offscreenIndicatorDrawKey: string = '';
  private _offscreenIndicatorRedrawsLastFrame: number = 0;
  private _offscreenIndicatorReuseSkipsLastFrame: number = 0;
  private _offscreenIndicatorCountLastFrame: number = 0;

  // Particle pool
  private readonly _particlePool = getParticlePool();

  // Particle graphics container
  private _particleGraphics: GraphicsType | null = null;

  // Powerup system reference
  private _powerupSystem: PowerupSystem | null = null;

  // Powerup graphics cache
  private readonly _powerupGraphics: Map<string, { container: ContainerType; graphics: GraphicsType }> = new Map();

  // Trap graphics cache (one Graphics per trap id)
  private readonly _trapGraphics: Map<string, GraphicsType> = new Map();

  // Component masks
  private readonly _renderableMask: number;
  private readonly _carMask: number;
  private readonly _trailMask: number;

  // Current time for animations
  private _time: number = 0;

  // FPS tracking
  private _fps: number = 60;
  private _fpsTime: number = 0;
  private _fpsFrames: number = 0;
  private _fpsElement: HTMLDivElement | null = null;

  // Background graphics
  private _backgroundGraphics: GraphicsType | null = null;
  private _zoneGraphics: GraphicsType | null = null;

  // Zone change-detection — only redraw when something actually changes
  private _zoneLastState: string = '';
  private _zoneLastRadius: number = -1;
  private _zoneLastPulseBucket: number = -1;

  // Trap alpha-bucket caching — avoid 60fps redraws when alpha is unchanged
  private readonly _trapAlphaBuckets: Map<string, number> = new Map();

  // Post-processing system
  private _postProcessing: PostProcessingSystem | null = null;

  // Spawn ring — one expanding circle at local player's spawn point (500ms)
  private _spawnRing: { x: number; y: number; startTime: number } | null = null;
  private _spawnRingGraphics: GraphicsType | null = null;

  constructor(config: RenderSystemConfig) {
    super(SystemPriority.RENDERING);
    TextureStyle.defaultOptions.scaleMode = 'nearest';

    this._config = config;
    this._camera = config.cameraSystem;

    // Initialize component masks
    this._renderableMask = createComponentMask(ComponentNames.RENDERABLE);
    this._carMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.VELOCITY,
      ComponentNames.PLAYER
    );
    this._trailMask = createComponentMask(ComponentNames.TRAIL);

    // Initialize render layers
    this._initLayers();

    // Initialize background
    this._initBackground();

    // Initialize zone visualization
    this._initZoneVisualization();

    // Initialize particle graphics
    this._initParticleGraphics();

    // Initialize post-processing
    this._initPostProcessing();

    // Setup FPS counter
    if (this._config.showFPS) {
      this._initFPSCounter();
    }
  }

  /**
   * Initialize render layers
   */
  private _initLayers(): void {
    const layerOrder = [
      RenderLayer.BACKGROUND,
      RenderLayer.GROUND,
      RenderLayer.TRAILS,
      RenderLayer.POWERUPS,
      RenderLayer.CORPSES,
      RenderLayer.CARS,
      RenderLayer.EFFECTS,
      RenderLayer.WORLD_UI,
      RenderLayer.OVERLAY,
    ];

    for (const layer of layerOrder) {
      const container = new Container();
      container.zIndex = layer;
      // No sortableChildren on individual layers — entities within a layer never
      // set per-entity zIndex, so sorting would be a no-op at 60fps cost.
      this._layers.set(layer, container);
      this._config.worldContainer.addChild(container);
    }

    // worldContainer needs sorting so layers render in the right order.
    this._config.worldContainer.sortableChildren = true;
  }

  /**
   * Initialize FPS counter
   */
  private _initFPSCounter(): void {
    const fpsElement = document.createElement('div');
    fpsElement.className = 'fps-counter';
    fpsElement.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
    `;
    this._config.uiContainer.appendChild(fpsElement);
    this._fpsElement = fpsElement;
  }

  /**
   * Initialize background with grid pattern
   */
  private _initBackground(): void {
    const backgroundLayer = this._layers.get(RenderLayer.BACKGROUND);
    if (!backgroundLayer) return;

    this._backgroundGraphics = new Graphics();
    this._backgroundGraphics.label = 'background';
    backgroundLayer.addChild(this._backgroundGraphics);

    // Draw grid pattern
    this._drawBackgroundGrid();
  }

  /**
   * Draw the arena as a microscope slide with a readable combat bowl.
   */
  private _drawBackgroundGrid(): void {
    if (!this._backgroundGraphics) return;

    const grid = this._backgroundGraphics;
    grid.clear();

    const engine = this.getEngine();
    const worldSize = engine?.getWorldSize() ?? { width: 8000, height: 6000 };

    const centerX = worldSize.width / 2;
    const centerY = worldSize.height / 2;
    const dishRadius = Math.min(worldSize.width, worldSize.height) * 0.34;

    grid.rect(0, 0, worldSize.width, worldSize.height).fill({ color: MICROSCOPE_PALETTE.DEEP_BLACK });

    // Soft ambient wash so the world reads as fluid rather than flat black.
    grid.circle(centerX, centerY, dishRadius * 1.24).fill({
      color: MICROSCOPE_PALETTE.AMBIENT_SOFT,
      alpha: 0.035,
    });
    grid.circle(centerX, centerY, dishRadius).fill({
      color: MICROSCOPE_PALETTE.SLIDE_DARK,
      alpha: 0.72,
    });

    grid.ellipse(centerX - dishRadius * 0.22, centerY - dishRadius * 0.18, dishRadius * 0.62, dishRadius * 0.32).fill({
      color: MICROSCOPE_PALETTE.AMBIENT_CYAN,
      alpha: 0.045,
    });
    grid.ellipse(centerX + dishRadius * 0.16, centerY + dishRadius * 0.22, dishRadius * 0.52, dishRadius * 0.26).fill({
      color: MICROSCOPE_PALETTE.BIOLUM_TEAL,
      alpha: 0.04,
    });

    // Reticle and dish rings give players spatial reference near the action.
    grid.moveTo(centerX, 0).lineTo(centerX, worldSize.height).stroke({
      width: 2,
      color: MICROSCOPE_PALETTE.RETICLE,
      alpha: 0.12,
    });
    grid.moveTo(0, centerY).lineTo(worldSize.width, centerY).stroke({
      width: 2,
      color: MICROSCOPE_PALETTE.RETICLE,
      alpha: 0.12,
    });

    for (const ratio of [0.26, 0.52, 0.78]) {
      grid.circle(centerX, centerY, dishRadius * ratio).stroke({
        width: ratio === 0.78 ? 2 : 1,
        color: MICROSCOPE_PALETTE.RETICLE,
        alpha: ratio === 0.78 ? 0.16 : 0.08,
      });
    }

    const gridSize = 140;
    for (let x = gridSize; x < worldSize.width; x += gridSize) {
      for (let y = gridSize; y < worldSize.height; y += gridSize) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.hypot(dx, dy);
        const alpha = dist < dishRadius ? 0.2 : 0.08;
        const radius = dist < dishRadius ? 1.5 : 1;
        grid.circle(x, y, radius).fill({ color: MICROSCOPE_PALETTE.GRID_DOT, alpha });
      }
    }

    grid.circle(centerX, centerY, dishRadius).stroke({
      width: 18,
      color: MICROSCOPE_PALETTE.PETRI_RIM,
      alpha: 0.18,
    });
    grid.circle(centerX, centerY, dishRadius - 24).stroke({
      width: 3,
      color: MICROSCOPE_PALETTE.MEMBRANE,
      alpha: 0.12,
    });

    grid.rect(6, 6, worldSize.width - 12, worldSize.height - 12).stroke({
      width: 4,
      color: MICROSCOPE_PALETTE.MEMBRANE,
      alpha: 0.08,
    });
  }

  /**
   * Initialize zone visualization
   */
  private _initZoneVisualization(): void {
    const groundLayer = this._layers.get(RenderLayer.GROUND);
    if (!groundLayer) return;

    this._zoneGraphics = new Graphics();
    this._zoneGraphics.label = 'zone';
    groundLayer.addChild(this._zoneGraphics);
  }

  /**
   * Initialize particle graphics container
   */
  private _initParticleGraphics(): void {
    const effectsLayer = this._layers.get(RenderLayer.EFFECTS);
    if (!effectsLayer) return;

    this._particleGraphics = new Graphics();
    this._particleGraphics.label = 'particles';
    effectsLayer.addChild(this._particleGraphics);

    // Set graphics on particle pool
    this._particlePool.setGraphics(this._particleGraphics);

    // Spawn ring (drawn above particles)
    this._spawnRingGraphics = new Graphics();
    this._spawnRingGraphics.label = 'spawnRing';
    effectsLayer.addChild(this._spawnRingGraphics);
  }

  /**
   * Initialize post-processing effects - disabled for performance
   */
  private _initPostProcessing(): void {
    this._postProcessing = createPostProcessingSystem(this._config.worldContainer, {
      crtEnabled: false,
      vignetteEnabled: false,
      vignetteIntensity: 0,
      filmGrainEnabled: false,
    });
  }

  /**
   * Update zone visualization - simple and performant
   */
  private _updateZoneVisualization(): void {
    if (!this._zoneGraphics) return;

    const systemManager = this.getEngine()?.getSystemManager();
    const zoneSystem = systemManager?.getSystem<ZoneSystem>('zone');

    if (!zoneSystem) return;

    const zoneInfo = zoneSystem.getDebugInfo?.();
    if (!zoneInfo) return;

    const { currentRadius, center, state } = zoneInfo;

    // Bucket time-based pulse at 8fps so we only redraw when visible state changes
    const pulseBucket = state === 'shrinking' ? Math.floor(this._time * 8) : 0;
    // Round radius to nearest pixel — zone shrinks ~0.5px/frame so this gives ~2-frame skips
    const stateKey = `${state}:${Math.round(currentRadius)}:${pulseBucket}`;
    if (this._zoneLastState === stateKey) return;
    this._zoneLastState = stateKey;

    const zone = this._zoneGraphics;
    zone.clear();

    // Idle: visible guide ring so players can see the zone boundary
    if (state === 'idle') {
      zone.circle(center.x, center.y, currentRadius).stroke({ width: 2, color: 0xffffff, alpha: 0.22 });
      return;
    }

    // Simple colors — final state uses red instead of cyan
    const baseColor = state === 'warning' ? 0xfbbf24 : (state === 'shrinking' ? 0xf87171 : 0xef4444);
    const alpha = state === 'warning' ? 0.5 : (state === 'shrinking' ? 0.6 : 0.8);

    // Simple circle stroke - no complex per-segment rendering
    zone.circle(center.x, center.y, currentRadius).stroke({
      width: state === 'shrinking' ? 4 : (state === 'final' ? 3 : 2),
      color: baseColor,
      alpha: alpha
    });

    // Danger pulse for shrinking
    if (state === 'shrinking') {
      const pulse = (Math.sin(this._time * 6) + 1) * 0.5;
      zone.circle(center.x, center.y, currentRadius + 5).stroke({
        width: 2,
        color: 0xf87171,
        alpha: 0.2 + pulse * 0.2
      });
    }
  }

  /**
   * Update turbulence effects when players are close
   */
  private _updateTurbulence(dt: number): void {
    // Limit spawn rate to avoid particle flooding
    if (Math.random() > 0.3) return;

    const engine = this.getEngine();
    // Cast to any to access getSpatialGrid as typed SpatialGrid, fixing the unknown type issue
    const spatialGrid = (engine as any)?.getSpatialGrid() as SpatialGrid | undefined;
    if (!spatialGrid) return;

    const entities = this.entityManager.queryByMask(this._carMask);
    const checkedPairs = new Set<string>();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);

      if (!position || !velocity || !health || !health.isAlive) continue;
      if (velocity.speed < 100) continue; // Must be moving

      // Check nearby for turbulence (150px radius)
      const nearby = spatialGrid.getNearbyEntities(position.x, position.y, 150);

      for (const [otherId] of nearby) {
        if (otherId === entity.id) continue;
        
        // Avoid duplicate checks/spawns for the same pair
        const pairKey = entity.id < otherId ? `${entity.id}-${otherId}` : `${otherId}-${entity.id}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const otherEntity = this.entityManager.getEntity(otherId);
        if (!otherEntity) continue;
        
        const otherPos = otherEntity.getComponent<Position>(ComponentNames.POSITION);
        const otherHealth = otherEntity.getComponent<Health>(ComponentNames.HEALTH);
        
        // Only spawn if both are alive and close enough
        if (!otherPos || !otherHealth || !otherHealth.isAlive) continue;

        // Spawn turbulence smoke at midpoint
        const midX = (position.x + otherPos.x) / 2;
        const midY = (position.y + otherPos.y) / 2;
        
        // Add random spread
        const spread = 30;
        const x = midX + (Math.random() - 0.5) * spread;
        const y = midY + (Math.random() - 0.5) * spread;

        // Spawn smoke particle
        this._particlePool.spawn({
            type: ParticleType.SMOKE,
            x,
            y,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            life: 0.6 + Math.random() * 0.4,
            decay: 1.0,
            size: 4,
            startSize: 4,
            endSize: 12,
            color: 0xaaaaaa,
            alpha: 0.3,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 2,
            gravity: 0,
            active: true
        });
      }
    }
  }

  /**
   * Update rendering
   */
  update(dt: number): void {
    this._time += dt;
    const now = Date.now();

    // Update FPS
    this._updateFPS(dt);

    // Update post-processing effects
    this._postProcessing?.update(dt);

    // Check for near-misses and trigger dopamine feedback
    this._checkNearMisses();

    // Update zone visualization
    this._updateZoneVisualization();

    // Update turbulence effects
    this._updateTurbulence(dt);

    // Update danger indicators
    this._updateDangerIndicators();

    // Update particles
    this._particlePool.update(dt);

    // Render all entities
    this._renderCars(now);

    // Render powerups
    this._renderPowerups(now);

    // Render trails
    this._renderTrails(now);

    // Render traps
    this._renderTraps(now);

    // Render effects
    this._renderEffects(now);

    // Apply camera transform
    this._applyCameraTransform();

    // Clean up destroyed entities
    this._cleanupDestroyedEntities();
  }

  /**
   * Update danger indicators (screen vignette and off-screen markers)
   */
  private _updateDangerIndicators(): void {
    const localPlayerId = this._camera.getTarget();
    if (!localPlayerId) {
        this._postProcessing?.setDangerIntensity(0);
        return;
    }

    const localEntity = this.entityManager.getEntity(localPlayerId);
    if (!localEntity) return;

    const localPos = localEntity.getComponent<Position>(ComponentNames.POSITION);
    const localHealth = localEntity.getComponent<Health>(ComponentNames.HEALTH);
    if (!localPos || !localHealth || !localHealth.isAlive) {
        this._postProcessing?.setDangerIntensity(0);
        return;
    }

    // 1. Zone Danger (Screen Vignette)
    let totalDanger = 0;
    const systemManager = this.getEngine()?.getSystemManager();
    const zoneSystem = systemManager?.getSystem<ZoneSystem>('zone');
    if (zoneSystem) {
        const dist = zoneSystem.getDistanceFromZone(localPos.x, localPos.y);
        // Intensity starts at 200px from edge, max at 0px or outside
        const zoneDanger = Math.max(0, Math.min(1, (200 - dist) / 200));
        totalDanger = Math.max(totalDanger, zoneDanger);
    }

    // 2. Trail Proximity Danger
    const trailSystem = systemManager?.getSystem<TrailSystem>('trails');
    const nearestTrail = trailSystem?.findNearestHazard(localPos.x, localPos.y, 100, {
      ignoreOwnerId: localPlayerId,
    });
    if (nearestTrail) {
        const d = Math.sqrt(nearestTrail.distanceSq);
        const trailDanger = Math.max(0, Math.min(1, (60 - d) / 40));
        totalDanger = Math.max(totalDanger, trailDanger);
    }

    this._postProcessing?.setDangerIntensity(totalDanger);

    // 3. Off-screen Indicators
    this._drawOffscreenIndicators(localPos);
  }

  /**
   * Draw markers for off-screen players
   */
  private _drawOffscreenIndicators(localPos: Position): void {
    const overlayLayer = this._layers.get(RenderLayer.OVERLAY);
    if (!overlayLayer) return;

    // Use a dedicated graphics object for indicators
    let indicators = this._offscreenIndicators;
    if (!indicators) {
        indicators = new Graphics();
        indicators.label = 'offscreen-indicators';
        overlayLayer.addChild(indicators);
        this._offscreenIndicators = indicators;
    }

    const entities = this.entityManager.queryByMask(this._carMask);
    const camConfig = this._camera.getCameraConfig();
    
    // Screen bounds in world space
    const halfWidth = (camConfig.screenWidth / 2) / camConfig.zoom;
    const halfHeight = (camConfig.screenHeight / 2) / camConfig.zoom;
    const viewLeft = camConfig.x - halfWidth;
    const viewRight = camConfig.x + halfWidth;
    const viewTop = camConfig.y - halfHeight;
    const viewBottom = camConfig.y + halfHeight;

    const indicatorRadius = 800; // Only show if within 800px
    const pulseBucket = Math.floor(this._time * OFFSCREEN_INDICATOR_PULSE_HZ);
    const pulseTime = pulseBucket / OFFSCREEN_INDICATOR_PULSE_HZ;
    const pulse = 1 + Math.sin(pulseTime * 10) * 0.2;
    const indicatorSpecs: OffscreenIndicatorSpec[] = [];

    for (const entity of entities) {
        if (entity.id === this._camera.getTarget()) continue;

        const pos = entity.getComponent<Position>(ComponentNames.POSITION);
        const health = entity.getComponent<Health>(ComponentNames.HEALTH);
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);

        if (!pos || !health || !health.isAlive || !player) continue;

        // Check if off-screen
        const isOffscreen = pos.x < viewLeft || pos.x > viewRight || pos.y < viewTop || pos.y > viewBottom;
        if (!isOffscreen) continue;

        // Check proximity
        const dx = pos.x - localPos.x;
        const dy = pos.y - localPos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > indicatorRadius * indicatorRadius) continue;

        // Calculate screen edge position
        const angle = Math.atan2(dy, dx);
        // Map to screen coordinates
        const screenPos = this._camera.worldToScreen(pos.x, pos.y);
        
        // Clamp to screen edge with margin
        const margin = 40;
        const clampedX = Math.max(margin, Math.min(camConfig.screenWidth - margin, screenPos.x));
        const clampedY = Math.max(margin, Math.min(camConfig.screenHeight - margin, screenPos.y));

        // Overlay layer is camera-transformed with world, so convert from
        // clamped screen-edge point back into world space before drawing.
        const worldAnchor = this._camera.screenToWorld(clampedX, clampedY);
        const size = 12 / Math.max(0.001, camConfig.zoom);
        const x1 = worldAnchor.x + Math.cos(angle) * size;
        const y1 = worldAnchor.y + Math.sin(angle) * size;
        const x2 = worldAnchor.x + Math.cos(angle + 2.5) * size;
        const y2 = worldAnchor.y + Math.sin(angle + 2.5) * size;
        const x3 = worldAnchor.x + Math.cos(angle - 2.5) * size;
        const y3 = worldAnchor.y + Math.sin(angle - 2.5) * size;
        const pulseSize = 4 / Math.max(0.001, camConfig.zoom);
        indicatorSpecs.push({
          color: player.color,
          x1,
          y1,
          x2,
          y2,
          x3,
          y3,
          pulseX: worldAnchor.x - pulseSize / 2,
          pulseY: worldAnchor.y - pulseSize / 2,
          pulseSize,
          pulseAlpha: 0.9 * pulse,
          key: [
            player.color.toString(16),
            Math.round(x1 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            Math.round(y1 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            Math.round(x2 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            Math.round(y2 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            Math.round(x3 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            Math.round(y3 / OFFSCREEN_INDICATOR_BUCKET_SIZE),
            pulseBucket,
          ].join(':'),
        });
    }

    this._offscreenIndicatorCountLastFrame = indicatorSpecs.length;
    const drawKey = indicatorSpecs.length === 0
      ? 'empty'
      : indicatorSpecs.map((spec) => spec.key).join('|');
    if (drawKey === this._offscreenIndicatorDrawKey) {
      this._offscreenIndicatorRedrawsLastFrame = 0;
      this._offscreenIndicatorReuseSkipsLastFrame = 1;
      return;
    }

    this._offscreenIndicatorDrawKey = drawKey;
    this._offscreenIndicatorRedrawsLastFrame = 1;
    this._offscreenIndicatorReuseSkipsLastFrame = 0;
    indicators.clear();

    for (const spec of indicatorSpecs) {
      indicators
        .moveTo(spec.x1, spec.y1)
        .lineTo(spec.x2, spec.y2)
        .lineTo(spec.x3, spec.y3)
        .closePath()
        .fill({
          color: spec.color,
          alpha: 0.8,
        });

      indicators.rect(spec.pulseX, spec.pulseY, spec.pulseSize, spec.pulseSize).fill({
        color: 0xffffff,
        alpha: spec.pulseAlpha,
      });
    }
  }

  /**
   * Check for near-misses and trigger dopamine feedback
   */
  private _checkNearMisses(): void {
    const systemManager = this.getEngine()?.getSystemManager();
    const collisionSystem = systemManager?.getSystem<any>('collision');
    if (!collisionSystem) return;

    const nearMisses = collisionSystem.getNearMisses?.();
    if (!nearMisses || nearMisses.length === 0) return;

    // Check if local player had a near-miss
    const localPlayerId = this._camera.getTarget();
    if (!localPlayerId) return;

    for (const nearMiss of nearMisses) {
      if (nearMiss.entityId === localPlayerId) {
        // Trigger near-miss effect for local player
        this._postProcessing?.triggerNearMiss();

        // Spawn "CLOSE!" floating text
        const localEntity = this.entityManager.getEntity(localPlayerId);
        const localPos = localEntity?.getComponent<Position>(ComponentNames.POSITION);
        if (localPos) {
          const floatingText = this.getEngine()?.getSystemManager()?.getSystem<any>('floatingText');
          if (floatingText) {
            floatingText.spawnText(
              localPos.x + (Math.random() - 0.5) * 30,
              localPos.y - 40,
              'CLOSE!',
              '#FF6B6B',
              { fontSize: 18, speed: 60, lifetime: 0.8 }
            );
          }
        }

        // Camera micro-shake
        this._camera.addShake(0.025);
        break; // Only trigger once per frame
      }
    }
  }

  /**
   * Update FPS counter
   */
  private _updateFPS(dt: number): void {
    if (!this._config.showFPS) return;

    this._fpsFrames++;
    this._fpsTime += dt;

    if (this._fpsTime >= 1) {
      this._fps = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;

      if (this._fpsElement) {
        this._fpsElement.textContent = `FPS: ${this._fps}`;
      }
    }
  }

  /**
   * Render cars
   */
  private _renderCars(now: number): void {
    const entities = this.entityManager.queryByMask(this._carMask);
    let bodyRedraws = 0;
    let bodyReuseSkips = 0;

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
      const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);
      const killPower = entity.getComponent<KillPower>(ComponentNames.KILL_POWER);
      const spermClass = entity.getComponent<SpermClass>(ComponentNames.SPERM_CLASS);
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);

      if (!position || !velocity || !player) continue;

      // Get or create graphics
      let graphics = this._entityGraphics.get(entity.id);
      if (!graphics) {
        graphics = this._createCarGraphics(entity, player);
        this._entityGraphics.set(entity.id, graphics);
      }

      // Update graphics
      const bodyRedrawn = this._updateCarGraphics(
        graphics,
        position,
        velocity,
        player,
        health,
        boost,
        abilities,
        killPower,
        spermClass,
        trail,
        now
      );

      if (health?.isAlive ?? true) {
        if (bodyRedrawn) {
          bodyRedraws++;
        } else {
          bodyReuseSkips++;
        }
      }
    }

    this._bodyRedrawsLastFrame = bodyRedraws;
    this._bodyReuseSkipsLastFrame = bodyReuseSkips;
  }

  /**
   * Create car graphics
   */
  private _createCarGraphics(entity: Entity, player: Player): EntityGraphics {
    const container = new Container();

    // Tail (wiggly sperm tail)
    const tail = new Graphics();
    tail.label = 'tail';
    container.addChild(tail);

    // Body (sperm head)
    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    // Shield effect
    const shield = new Graphics();
    shield.label = 'shield';
    shield.visible = false;
    container.addChild(shield);

    // Glow effect
    const glow = new Graphics();
    glow.label = 'glow';
    glow.visible = false;
    container.addChild(glow);

    let nameplate: HTMLDivElement | undefined;
    if (PLAYER_VISUAL_CONFIG.SHOW_NAMEPLATES) {
      nameplate = document.createElement('div');
      nameplate.className = 'car-nameplate';
      nameplate.textContent = player.name;
      nameplate.style.cssText = `
        position: absolute;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        pointer-events: none;
        white-space: nowrap;
        opacity: 0.8;
      `;
      this._config.uiContainer.appendChild(nameplate);
    }

    // Add to car layer
    const carLayer = this._layers.get(RenderLayer.CARS);
    if (carLayer) {
      carLayer.addChild(container);
    }

    return {
      container,
      body,
      tail,
      shield,
      glow,
      nameplate,
      visualAngle: 0,
      bodyDrawKey: '',
      spawnAnimStart: 0,
    };
  }

  /**
   * Update car graphics
   */
  private _updateCarGraphics(
    graphics: EntityGraphics,
    position: Position,
    velocity: Velocity,
    player: Player,
    health: Health | undefined,
    boost: Boost | undefined,
    abilities: Abilities | undefined,
    killPower: KillPower | undefined,
    spermClass: SpermClass | undefined,
    trail: Trail | undefined,
    now: number
  ): boolean {
    const { container, body, tail, shield, glow, nameplate } = graphics;
    const growthMult = killPower ? getKillPowerGrowthMult(killPower, now) : 1.0;
    const hasKillPowerGlow = killPower?.active && killPower.glowIntensity > 0;

    // Class-specific multipliers
    const classSizeMult = spermClass?.sizeMultiplier ?? 1.0;
    const classWiggleSpeed = spermClass?.tailWiggleSpeed ?? 5.6;

    // Position
    container.x = position.x;
    container.y = position.y;

    // Smooth visual facing so the head glides instead of snapping every frame.
    const targetVisualAngle = Number.isFinite(velocity.angle) ? velocity.angle : graphics.visualAngle;
    if (!Number.isFinite(graphics.visualAngle)) {
      graphics.visualAngle = targetVisualAngle;
    }
    const facingLerp = boost?.isBoosting ? 0.18 : 0.10;
    graphics.visualAngle = this._lerpAngle(graphics.visualAngle, targetVisualAngle, facingLerp);
    container.rotation = graphics.visualAngle;

    // Visibility
    const isVisible = health?.isAlive ?? true;
    container.visible = isVisible;

    // Keep DOM nameplates in sync with entity life state to avoid
    // "floating names" after a car is eliminated.
    if (nameplate) {
      nameplate.style.display = isVisible ? 'block' : 'none';
    }

    if (!isVisible) return false;

    // Spawn animation: initialize on first visible frame, apply scale pop-in
    if (graphics.spawnAnimStart === 0) {
      graphics.spawnAnimStart = now;
      // Register expanding spawn ring for local player
      if (player.isLocal && !this._spawnRing) {
        this._spawnRing = { x: position.x, y: position.y, startTime: now };
      }
    }
    // Scale pop-in (0–400ms): 0 → 1.35 overshoot → 1.0
    const spawnElapsed = now - graphics.spawnAnimStart;
    if (spawnElapsed < 400) {
      const t = spawnElapsed / 400;
      const scale = t < 0.3
        ? (t / 0.3) * 1.35
        : 1.35 - 0.35 * ((t - 0.3) / 0.7);
      container.scale.set(scale);
    } else if (container.scale.x !== 1.0) {
      container.scale.set(1.0);
    }

    const bodySizeMult = classSizeMult * growthMult;
    const bodyDrawKey = `${player.color}:${boost?.isBoosting ? 1 : 0}:${bodySizeMult.toFixed(3)}:${player.isLocal ? 1 : 0}`;
    let bodyRedrawn = false;
    if (graphics.bodyDrawKey !== bodyDrawKey) {
      this._drawSpermHead(body, player, boost?.isBoosting ?? false, bodySizeMult);
      graphics.bodyDrawKey = bodyDrawKey;
      bodyRedrawn = true;
    }

    // Keep head locked forward like a sperm head (no independent banking).
    const turnDiff = angularDistance(graphics.visualAngle, velocity.targetAngle);
    body.rotation = 0;

    // Draw animated flagellum extending from the back of the head.
    this._drawTailConnector(
      tail,
      player.color,
      boost?.isBoosting ?? false,
      bodySizeMult,
      classWiggleSpeed,
      turnDiff,
    );

    // Draw shield ability aura, or spawn grace aura (whichever applies)
    if (abilities && isAbilityActive(abilities, AbilityType.SHIELD)) {
      this._drawShield(shield, true);
      shield.visible = true;
    } else if (health && hasSpawnProtection(health)) {
      this._drawSpawnAura(shield, health, classSizeMult, growthMult);
      shield.visible = true;
    } else {
      shield.visible = false;
    }

    // Draw glow if boosting, ability active, or kill power active
    if (boost?.isBoosting || abilities?.active.has(AbilityType.OVERDRIVE) || hasKillPowerGlow) {
      // Use kill power glow color (golden) if active, otherwise player color
      const glowColor = hasKillPowerGlow ? 0xFFD700 : player.color;
      this._drawGlow(glow, glowColor);
      glow.visible = true;

      // Spawn boost exhaust particles
        if (boost?.isBoosting) {
        // Emit exhaust behind the sperm (opposite to velocity angle)
        const exhaustAngle = velocity.angle + Math.PI;
        const exhaustX = position.x - Math.cos(velocity.angle) * 15;
        const exhaustY = position.y - Math.sin(velocity.angle) * 15;
        this.spawnExhaust(exhaustX, exhaustY, exhaustAngle, player.color);

        // Spawn dynamic speed lines (passing by effect)
        if (Math.random() < 0.18) {
             const perpAngle = velocity.angle + Math.PI / 2;
             const offset = (Math.random() - 0.5) * 80; // Spread around player width
             // Spawn slightly ahead so they streak past
             const sx = position.x + Math.cos(perpAngle) * offset + Math.cos(velocity.angle) * 60;
             const sy = position.y + Math.sin(perpAngle) * offset + Math.sin(velocity.angle) * 60;
             this.spawnSpeedLine(sx, sy, velocity.angle, velocity.speed);
        }

        // Trigger chromatic aberration boost (if local player)
        if (player.isLocal) {
            this._postProcessing?.setChromaticAberration(0.006); // 3x base intensity
        }
      }
    } else {
      glow.visible = false;
      // Reset chromatic aberration if local player stopped boosting
      if (player.isLocal) {
          this._postProcessing?.setChromaticAberration(0.002); // Base intensity
      }
    }

    // Update nameplate position
    if (nameplate) {
      const screenPos = this.worldToScreen(position.x, position.y);
      nameplate.style.left = `${screenPos.x}px`;
      nameplate.style.top = `${screenPos.y - 30}px`;
    }

    return bodyRedrawn;
  }

  /**
   * Draw sperm head — bioluminescent cell under microscope
   */
  private _drawSpermHead(bodyGraphics: GraphicsType, player: Player, isBoosting: boolean, sizeMult: number = 1.0): void {
    bodyGraphics.clear();

    const baseRadius = PLAYER_VISUAL_CONFIG.BODY_RADIUS * sizeMult;
    const rx = baseRadius * PLAYER_VISUAL_CONFIG.BODY_WIDTH_MULT;
    const ry = baseRadius * PLAYER_VISUAL_CONFIG.BODY_HEIGHT_MULT;
    const color = player.color;

    // Bioluminescent aura — tight concentric fills, light emitting from within
    bodyGraphics.ellipse(0, 0, rx + 14, ry + 9).fill({ color, alpha: 0.06 });
    bodyGraphics.ellipse(0, 0, rx + 8,  ry + 5).fill({ color, alpha: 0.14 });
    bodyGraphics.ellipse(0, 0, rx + 3,  ry + 2).fill({ color, alpha: 0.22 });

    // Boost outer ring — extra aura when boosting
    if (isBoosting) {
      bodyGraphics.ellipse(0, 0, rx + 18, ry + 12).fill({ color, alpha: 0.08 });
      bodyGraphics.ellipse(0, 0, rx + 10, ry + 7).stroke({ width: 1.7, color, alpha: 0.55 });
    }

    // Main head body
    bodyGraphics.ellipse(0, 0, rx, ry).fill({ color, alpha: 0.95 });

    // Inner bloom — bright white core that makes it look lit from inside
    bodyGraphics.ellipse(0, 0, rx * 0.65, ry * 0.6).fill({ color: 0xffffff, alpha: 0.12 });

    // Acrosome cap — brighter front half
    bodyGraphics.ellipse(rx * 0.18, 0, rx * 0.58, ry * 0.82).fill({ color: 0xffffff, alpha: 0.13 });

    // Edge stroke for cell membrane look
    bodyGraphics.ellipse(0, 0, rx, ry).stroke({ width: 1.4, color: 0xffffff, alpha: 0.55 });

    // Highlight spot (top-right, like light catching a wet cell)
    bodyGraphics.ellipse(rx * 0.28, -ry * 0.28, rx * 0.22, ry * 0.2).fill({ color: 0xffffff, alpha: 0.65 });

    // Local player identity ring — bright outer ring so you always know which one is you
    if (player.isLocal) {
      bodyGraphics.ellipse(0, 0, rx + 9, ry + 6).stroke({ width: 2.5, color: 0xffffff, alpha: 0.65 });
      bodyGraphics.ellipse(0, 0, rx + 16, ry + 11).stroke({ width: 1.2, color: 0xffffff, alpha: 0.22 });
    }
  }

  /**
   * Helper: Darken a color by a factor (0-1)
   */
  private _darkenColor(color: number, factor: number): number {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    const darkR = Math.floor(r * (1 - factor));
    const darkG = Math.floor(g * (1 - factor));
    const darkB = Math.floor(b * (1 - factor));

    return (darkR << 16) | (darkG << 8) | darkB;
  }

  /**
   * Draw the animated flagellum extending from the back of the head.
   * Uses PLAYER_VISUAL_CONFIG tail constants for length, segments, amplitude and wave speed.
   * Drawn in local space — the entity container already handles world rotation.
   */
  private _drawTailConnector(
    tailGraphics: GraphicsType,
    color: number,
    isBoosting: boolean,
    growthMult: number = 1.0,
    wiggleSpeed: number = 5.6,
    turnDiff: number = 0,
  ): void {
    tailGraphics.clear();

    const segments = PLAYER_VISUAL_CONFIG.TAIL_SEGMENTS;
    const tailLength = (isBoosting
      ? PLAYER_VISUAL_CONFIG.TAIL_LENGTH * PLAYER_VISUAL_CONFIG.BOOST_TAIL_STRETCH_MAX
      : PLAYER_VISUAL_CONFIG.TAIL_LENGTH) * growthMult;

    const amplitude = (isBoosting
      ? PLAYER_VISUAL_CONFIG.TAIL_AMPLITUDE_BOOST
      : PLAYER_VISUAL_CONFIG.TAIL_AMPLITUDE) * growthMult;

    // Back edge of the oval head in local space (entity faces +X, tail extends in -X)
    const headBackX = -PLAYER_VISUAL_CONFIG.BODY_RADIUS * PLAYER_VISUAL_CONFIG.BODY_WIDTH_MULT * growthMult;

    const wavePoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const baseX = headBackX - tailLength * t;
      // Amplitude envelope: zero at head end, peaks at ~45%, tapers to tip
      const envelope = t * Math.pow(1 - t * 0.45, 2.0);
      // Turn-driven bend: builds quadratically toward the tip
      const bend = turnDiff * PLAYER_VISUAL_CONFIG.TAIL_TURN_BEND * t * t;
      const phase = this._time * wiggleSpeed - t * Math.PI * 3.8;
      const wave = Math.sin(phase) * amplitude * envelope + bend;
      wavePoints.push({ x: baseX, y: wave });
    }

    const drawPath = (g: GraphicsType) => {
      if (wavePoints.length < 2) return;
      g.moveTo(wavePoints[0].x, wavePoints[0].y);
      for (let i = 1; i < wavePoints.length; i++) {
        g.lineTo(wavePoints[i].x, wavePoints[i].y);
      }
    };

    const baseWidth = PLAYER_VISUAL_CONFIG.TAIL_BASE_WIDTH * growthMult;

    // Outer glow
    drawPath(tailGraphics);
    tailGraphics.stroke({
      width: baseWidth + (isBoosting ? 4 : 3),
      color,
      alpha: isBoosting ? 0.28 : 0.18,
      cap: 'round',
      join: 'round',
    });

    // Core flagellum
    drawPath(tailGraphics);
    tailGraphics.stroke({
      width: baseWidth,
      color,
      alpha: 0.82,
      cap: 'round',
      join: 'round',
    });

    // Inner bioluminescent highlight
    drawPath(tailGraphics);
    tailGraphics.stroke({
      width: Math.max(1, baseWidth * 0.3),
      color: 0xffffff,
      alpha: 0.22,
      cap: 'round',
      join: 'round',
    });
  }

  /**
   * Draw one smooth trail segment with quadratic midpoint interpolation.
   */
  private _drawSmoothTrailSegment(
    g: GraphicsType,
    points: Array<{ x: number; y: number }>,
    width: number,
    color: number,
    alpha: number
  ): void {
    if (points.length < 2) return;
    g.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      g.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const mx = (points[i].x + points[i + 1].x) * 0.5;
        const my = (points[i].y + points[i + 1].y) * 0.5;
        if (typeof (g as unknown as { quadraticCurveTo?: Function }).quadraticCurveTo === 'function') {
          (g as unknown as { quadraticCurveTo: Function }).quadraticCurveTo(points[i].x, points[i].y, mx, my);
        } else {
          g.lineTo(points[i].x, points[i].y);
        }
      }
      const last = points[points.length - 1];
      g.lineTo(last.x, last.y);
    }
    g.stroke({
      width,
      color,
      alpha,
      cap: 'round',
      join: 'round',
    });
  }

  /**
   * Draw strict polyline segment (no curve interpolation).
   * Used for lethal trail ribbons to avoid occasional overshoot loops.
   */
  private _drawPolylineSegment(
    g: GraphicsType,
    points: Array<{ x: number; y: number }>,
    width: number,
    color: number,
    alpha: number
  ): void {
    if (points.length < 2) return;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.stroke({
      width,
      color,
      alpha,
      cap: 'round',
      join: 'round',
    });
  }

  /**
   * Angle interpolation that takes shortest angular path.
   */
  private _lerpAngle(current: number, target: number, t: number): number {
    const delta = angularDistance(current, target);
    return current + delta * t;
  }

  /**
   * Draw pixel art shield effect
   */
  private _drawShield(shieldGraphics: GraphicsType, active: boolean): void {
    shieldGraphics.clear();

    if (!active) return;

    const radius = PLAYER_VISUAL_CONFIG.SHIELD_RADIUS;
    const pulse = 0.6 + Math.sin(this._time * 8) * 0.2;

    // Organic cell-membrane shield — elliptical to match sperm head shape
    const rx = radius * 2.2;
    const ry = radius * 1.6;

    // Outer diffuse halo
    shieldGraphics.ellipse(0, 0, rx + 10, ry + 7).fill({ color: 0x00e5ff, alpha: pulse * 0.07 });

    // Mid glow ring
    shieldGraphics.ellipse(0, 0, rx + 4, ry + 3).stroke({
      width: 3,
      color: 0x00e5ff,
      alpha: pulse * 0.45,
    });

    // Core membrane ring
    shieldGraphics.ellipse(0, 0, rx, ry).stroke({
      width: 2.5,
      color: 0x7fffff,
      alpha: pulse,
    });

    // Inner fill (barely visible — like a soap bubble)
    shieldGraphics.ellipse(0, 0, rx, ry).fill({ color: 0x00ffff, alpha: pulse * 0.06 });

    // Top-left sheen arc highlight
    shieldGraphics.ellipse(-rx * 0.14, -ry * 0.42, rx * 0.55, ry * 0.32).stroke({
      width: 1.5,
      color: 0xffffff,
      alpha: pulse * 0.5,
    });
  }

  /**
   * Draw spawn-grace protection aura (mint green, fades as grace expires)
   * Distinct from shield ability — lighter, simpler, communicates "you're safe right now"
   */
  private _drawSpawnAura(
    shieldGraphics: GraphicsType,
    health: Health,
    sizeMult: number,
    growthMult: number
  ): void {
    shieldGraphics.clear();

    const graceRemaining = getSpawnProtectionRemaining(health);
    const graceFraction = Math.max(0, graceRemaining / MATCH_CONFIG.SPAWN_GRACE_MS);
    const pulse = 0.35 + 0.35 * Math.sin(this._time * 8.0);
    const alpha = pulse * graceFraction;

    if (alpha < 0.01) return;

    const bodyRadius = PLAYER_VISUAL_CONFIG.BODY_RADIUS * sizeMult * growthMult;
    const rx = bodyRadius * PLAYER_VISUAL_CONFIG.BODY_WIDTH_MULT + 8 + pulse * 4;
    const ry = bodyRadius * PLAYER_VISUAL_CONFIG.BODY_HEIGHT_MULT + 5 + pulse * 3;

    // Outer diffuse halo
    shieldGraphics.ellipse(0, 0, rx + 6, ry + 4).fill({ color: 0x44ffaa, alpha: alpha * 0.12 });
    // Main ring stroke
    shieldGraphics.ellipse(0, 0, rx, ry).stroke({ width: 2.0, color: 0x44ffaa, alpha: alpha * 0.9 });
    // Faint inner fill (soap-bubble look)
    shieldGraphics.ellipse(0, 0, rx - 3, ry - 2).fill({ color: 0x44ffaa, alpha: alpha * 0.06 });
  }

  /**
   * Draw pixel art boost glow
   */
  private _drawGlow(glowGraphics: GraphicsType, color: number): void {
    glowGraphics.clear();

    const pulseFast = 0.5 + Math.sin(this._time * 4) * 0.1;
    const r = PLAYER_VISUAL_CONFIG.GLOW_RADIUS + Math.sin(this._time * 3) * 1.2;
    glowGraphics.ellipse(0, 0, r * 0.9, r * 0.62).fill({
      color,
      alpha: pulseFast * 0.22,
    });
    glowGraphics.ellipse(0, 0, r * 0.56, r * 0.4).fill({
      color: 0xffffff,
      alpha: pulseFast * 0.12,
    });
  }

  /**
   * Render trails with retro pixel blocks
   */
  private _renderTrails(now: number): void {
    const entities = this.entityManager.queryByMask(this._trailMask);
    const camConfig = this._camera.getCameraConfig();
    const zoom = Math.max(0.001, camConfig.zoom);
    const cullMargin = 260;
    const halfWidth = (camConfig.screenWidth / 2) / zoom;
    const halfHeight = (camConfig.screenHeight / 2) / zoom;
    const viewLeft = camConfig.x - halfWidth - cullMargin;
    const viewRight = camConfig.x + halfWidth + cullMargin;
    const viewTop = camConfig.y - halfHeight - cullMargin;
    const viewBottom = camConfig.y + halfHeight + cullMargin;
    const fadeBucket = Math.floor(now / TRAIL_REDRAW_INTERVAL_MS);
    const cullKey = this._getTrailCullKey(viewLeft, viewRight, viewTop, viewBottom);
    let redrawCount = 0;
    let reuseCount = 0;

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);

      if (!trail || !player) continue;

      let trailCache = this._trailGraphics.get(entity.id);
      if (!trailCache) {
        const graphics = new Graphics();
        graphics.label = `trail_${entity.id}`;
        const trailsLayer = this._layers.get(RenderLayer.TRAILS);
        if (trailsLayer) {
          trailsLayer.addChild(graphics);
        }
        trailCache = {
          graphics,
          pointCount: -1,
          oldestTimestamp: -1,
          newestTimestamp: -1,
          fadeBucket: -1,
          cullKey: '',
        };
        this._trailGraphics.set(entity.id, trailCache);
      }

      const trailColor = trail.color;

      // Determine trail effect based on color
      let effectType = 'default';
      if (trailColor === 0xFFD700) effectType = 'gold';
      else if (trailColor === 0xFF4500 || trailColor === 0xFF0000) effectType = 'fire';
      else if (trailColor === 0xFFFF00) effectType = 'lightning';

      const oldestTimestamp = trail.points[0]?.timestamp ?? -1;
      const newestTimestamp = trail.points[trail.points.length - 1]?.timestamp ?? -1;
      const appendedPoints = Math.max(0, trail.points.length - Math.max(0, trailCache.pointCount));
      const removedPoints = Math.max(0, Math.max(0, trailCache.pointCount) - trail.points.length);
      const oldestAgeDelta = trailCache.oldestTimestamp < 0
        ? Number.POSITIVE_INFINITY
        : oldestTimestamp - trailCache.oldestTimestamp;
      const newestAgeDelta = trailCache.newestTimestamp < 0
        ? Number.POSITIVE_INFINITY
        : newestTimestamp - trailCache.newestTimestamp;
      const needsRedraw = (
        trailCache.pointCount < 0 ||
        (trail.points.length < 2 && trailCache.pointCount !== trail.points.length) ||
        appendedPoints >= TRAIL_APPEND_REDRAW_POINTS ||
        removedPoints >= TRAIL_APPEND_REDRAW_POINTS ||
        oldestAgeDelta >= TRAIL_APPEND_REDRAW_INTERVAL_MS ||
        newestAgeDelta >= TRAIL_APPEND_REDRAW_INTERVAL_MS ||
        trailCache.fadeBucket !== fadeBucket ||
        trailCache.cullKey !== cullKey
      );

      if (needsRedraw) {
        redrawCount++;
        trailCache.graphics.clear();

        if (trail.points.length >= 2) {
          const active = this._collectVisibleTrailPoints(
            trail,
            now,
            viewLeft,
            viewRight,
            viewTop,
            viewBottom
          );
          if (active.length >= 2) {
            this._drawTrailGeometry(trailCache.graphics, trail, player.isLocal, active);
          }
        }

        trailCache.pointCount = trail.points.length;
        trailCache.oldestTimestamp = oldestTimestamp;
        trailCache.newestTimestamp = newestTimestamp;
        trailCache.fadeBucket = fadeBucket;
        trailCache.cullKey = cullKey;
      } else {
        reuseCount++;
      }

      this._spawnTrailFx(
        trail,
        effectType,
        now,
        viewLeft,
        viewRight,
        viewTop,
        viewBottom
      );
    }

    this._trailRedrawsLastFrame = redrawCount;
    this._trailReuseSkipsLastFrame = reuseCount;

    // Clean up trail graphics for destroyed entities
    for (const [entityId, cache] of this._trailGraphics) {
      if (!this.entityManager.hasEntity(entityId)) {
        cache.graphics.destroy();
        this._trailGraphics.delete(entityId);
      }
    }
  }

  private _getTrailCullKey(
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number
  ): string {
    return [
      Math.floor(viewLeft / TRAIL_CULL_BUCKET_SIZE),
      Math.floor(viewRight / TRAIL_CULL_BUCKET_SIZE),
      Math.floor(viewTop / TRAIL_CULL_BUCKET_SIZE),
      Math.floor(viewBottom / TRAIL_CULL_BUCKET_SIZE),
    ].join(':');
  }

  private _collectVisibleTrailPoints(
    trail: Trail,
    now: number,
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number
  ): Array<{ p: TrailPoint; alpha: number }> {
    const active: Array<{ p: TrailPoint; alpha: number }> = [];

    for (const point of trail.points) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        continue;
      }

      const alpha = getTrailAlpha(point, trail.lifetime, now);
      if (alpha <= 0) {
        continue;
      }

      if (
        point.x < viewLeft ||
        point.x > viewRight ||
        point.y < viewTop ||
        point.y > viewBottom
      ) {
        continue;
      }

      active.push({ p: point, alpha });
    }

    return active;
  }

  private _drawTrailGeometry(
    trailGraphics: GraphicsType,
    trail: Trail,
    isLocalTrail: boolean,
    active: Array<{ p: TrailPoint; alpha: number }>
  ): void {
    const maxGapSq = 200 * 200;
    const segments: Array<typeof active> = [];
    let current: typeof active = [active[0]];

    for (let i = 1; i < active.length; i++) {
      const prev = current[current.length - 1];
      const cur = active[i];
      const dx = cur.p.x - prev.p.x;
      const dy = cur.p.y - prev.p.y;

      // Split hard on teleports only; keep temporal continuity to avoid dotty trails.
      if (dx * dx + dy * dy > maxGapSq) {
        if (current.length >= 2) segments.push(current);
        current = [cur];
      } else {
        current.push(cur);
      }
    }
    if (current.length >= 2) {
      segments.push(current);
    }

    // Tapered flagellum: active[0]=oldest(thin tip), active[n-1]=newest(thick near head)
    const localMult = isLocalTrail ? 1.05 : 1.16;
    const maxWidth = Math.max(2.4, trail.baseWidth * localMult);
    const minWidth = isLocalTrail ? 1.4 : 1.8;
    const dangerGlowAlpha = isLocalTrail ? 0.24 : 0.3;
    const coreAlpha = isLocalTrail ? 0.92 : 0.96;
    const highlightAlpha = isLocalTrail ? 0.3 : 0.26;
    const threatHaloAlpha = isLocalTrail ? 0.1 : 0.28;
    // Opponent trails get a red outer warning halo so they read as DEADLY at a glance
    const haloColor = isLocalTrail ? trail.color : 0xff2222;

    for (const seg of segments) {
      if (seg.length < 2) continue;
      const n = seg.length;

      const buckets = 16;
      for (let bucket = 0; bucket < buckets; bucket++) {
        const frac = bucket / (buckets - 1);
        const startIdx = Math.floor((bucket / buckets) * n);
        const endIdx = Math.min(Math.floor(((bucket + 1) / buckets) * n), n - 1);

        if (endIdx - startIdx < 1) continue;

        const width = minWidth + (maxWidth - minWidth) * frac;
        const subPoly: Array<{ x: number; y: number }> = [];

        for (let i = startIdx; i <= endIdx; i++) {
          const pt = seg[i]?.p;
          if (!pt) continue;
          subPoly.push({ x: pt.x, y: pt.y });
        }

        if (subPoly.length < 2) continue;

        // Catmull-Rom spline smoothing — eliminates angular kinks at sharp turns
        const drawPoly = subPoly.length >= 4 ? this._catmullRomSmooth(subPoly, 2) : subPoly;

        // Use midpoint alpha for smooth fade (not average — avoids sudden bucket drops)
        const midIdx = Math.floor((startIdx + endIdx) / 2);
        const bucketAlpha = seg[midIdx]?.alpha ?? 1;

        this._drawPolylineSegment(
          trailGraphics,
          drawPoly,
          width + (isLocalTrail ? 3 : 6),
          haloColor,
          bucketAlpha * threatHaloAlpha
        );
        this._drawPolylineSegment(
          trailGraphics,
          drawPoly,
          width + 3.2,
          trail.color,
          bucketAlpha * dangerGlowAlpha
        );
        this._drawPolylineSegment(
          trailGraphics,
          drawPoly,
          width,
          trail.color,
          bucketAlpha * coreAlpha
        );

        if (frac >= 0.4) {
          this._drawPolylineSegment(
            trailGraphics,
            drawPoly,
            Math.max(0.8, width * 0.35),
            0xffffff,
            bucketAlpha * highlightAlpha
          );
        }

        if (!isLocalTrail) {
          this._drawPolylineSegment(
            trailGraphics,
            drawPoly,
            Math.max(1.1, width * 0.58),
            MICROSCOPE_PALETTE.MEMBRANE,
            bucketAlpha * 0.1
          );
        }
      }
    }
  }

  /**
   * Catmull-Rom spline: insert `subdiv` smooth points between each pair of control points.
   * Eliminates angular kinks on sharp trail turns.
   */
  private _catmullRomSmooth(
    pts: Array<{ x: number; y: number }>,
    subdiv: number
  ): Array<{ x: number; y: number }> {
    const n = pts.length;
    const result: Array<{ x: number; y: number }> = [pts[0]];
    const step = 1 / (subdiv + 1);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      for (let s = 1; s <= subdiv; s++) {
        const t = s * step;
        const t2 = t * t;
        const t3 = t2 * t;
        result.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
      result.push(pts[i + 1]);
    }
    return result;
  }

  private _spawnTrailFx(
    trail: Trail,
    effectType: string,
    now: number,
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number
  ): void {
    let sampled = 0;
    const minIndex = Math.max(0, trail.points.length - TRAIL_FX_SCAN_LIMIT);

    for (let i = trail.points.length - 1; i >= minIndex && sampled < TRAIL_FX_SAMPLE_LIMIT; i--) {
      const point = trail.points[i];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        continue;
      }

      if (
        point.x < viewLeft ||
        point.x > viewRight ||
        point.y < viewTop ||
        point.y > viewBottom
      ) {
        continue;
      }

      const alpha = getTrailAlpha(point, trail.lifetime, now);
      if (alpha <= 0) {
        continue;
      }

      sampled++;

      if (point.isBoosted && Math.random() < 0.04) {
        this._particlePool.spawn({
          type: ParticleType.SPARK,
          x: point.x + (Math.random() - 0.5) * 6,
          y: point.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 0.18,
          decay: 5,
          startSize: 2,
          endSize: 0,
          size: 2,
          color: 0xffffff,
          alpha: alpha * 0.55,
          rotation: 0,
          rotationSpeed: 0,
          gravity: 0,
          active: true,
        });
      }

      if (Math.random() < 0.03 && (effectType === 'gold' || effectType === 'fire')) {
        const pType = effectType === 'fire' ? ParticleType.SMOKE : ParticleType.SPARK;
        const pColor = effectType === 'fire' ? 0xFF4500 : 0xFFD700;

        this._particlePool.spawn({
          type: pType,
          x: point.x + (Math.random() - 0.5) * 10,
          y: point.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 0.5,
          decay: 2,
          startSize: 2,
          endSize: 0,
          size: 2,
          color: pColor,
          alpha,
          rotation: 0,
          rotationSpeed: 0,
          gravity: effectType === 'fire' ? -20 : 0,
          active: true,
        });
      }
    }
  }

  /**
   * Render effects (particles, etc.)
   */
  private _renderEffects(now: number): void {
    const effectsLayer = this._layers.get(RenderLayer.EFFECTS);
    if (!effectsLayer) return;

    // Render all active particles
    this._particlePool.render();

    // Spawn ring — single expanding circle at local player spawn point (500ms)
    if (this._spawnRingGraphics) {
      if (this._spawnRing) {
        const elapsed = now - this._spawnRing.startTime;
        const duration = 500;
        if (elapsed <= duration) {
          const t = elapsed / duration;
          const radius = 8 + 72 * t;             // 8 → 80
          const ringAlpha = 0.85 * (1 - t);      // fades out
          const lineWidth = Math.max(0.5, 4 * (1 - t * 0.75));
          this._spawnRingGraphics.clear();
          this._spawnRingGraphics
            .circle(this._spawnRing.x, this._spawnRing.y, radius)
            .stroke({ width: lineWidth, color: 0xffffff, alpha: ringAlpha });
        } else {
          this._spawnRingGraphics.clear();
          this._spawnRing = null;
        }
      } else {
        // Nothing to draw — keep cleared
      }
    }
  }

  /**
   * Apply camera transform
   */
  private _applyCameraTransform(): void {
    const container = this._config.worldContainer;
    const cameraConfig = this._camera.getCameraConfig();
    const shakeOffset = this._camera.getShakeOffset();
    const zoom = Number.isFinite(cameraConfig.zoom) ? cameraConfig.zoom : 1;
    const pivotX = cameraConfig.x + shakeOffset.x;
    const pivotY = cameraConfig.y + shakeOffset.y;

    container.x = cameraConfig.screenWidth / 2;
    container.y = cameraConfig.screenHeight / 2;
    container.scale.set(zoom);

    container.pivot.x = Number.isFinite(pivotX) ? pivotX : cameraConfig.x;
    container.pivot.y = Number.isFinite(pivotY) ? pivotY : cameraConfig.y;
  }

  /**
   * Clean up destroyed entities
   */
  private _cleanupDestroyedEntities(): void {
    // Remove nameplates for destroyed entities
    for (const [entityId, graphics] of this._entityGraphics) {
      if (!this.entityManager.hasEntity(entityId)) {
        if (graphics.nameplate && graphics.nameplate.parentNode) {
          graphics.nameplate.parentNode.removeChild(graphics.nameplate);
        }
        if (graphics.container && graphics.container.parent) {
          graphics.container.parent.removeChild(graphics.container);
        }
        this._entityGraphics.delete(entityId);
      }
    }
  }

  /**
   * Add screen shake with post-processing chromatic aberration boost
   */
  addShake(intensity: number): void {
    this._camera.addShake(intensity);
    // Trigger chromatic aberration boost for cinematic effect
    this._postProcessing?.triggerScreenShake(intensity * 3, 0.4);
  }

  /**
   * Reset all spawn-entrance state so effects play from the current moment.
   * Call this at GO (engine.resume) — entity graphics are created one frame before
   * the engine pauses for the countdown, so timers are stale by the time GO fires.
   */
  resetSpawnState(): void {
    const now = Date.now();

    // Reset per-entity spawn animation timers
    for (const graphics of this._entityGraphics.values()) {
      graphics.spawnAnimStart = 0;
    }

    // Reset spawn ring so it re-registers on next frame
    this._spawnRing = null;

    // Refresh spawn grace periods — entity creation time is 3s before GO
    for (const entity of this.entityManager.queryByMask(this._carMask)) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      if (health && health.isAlive) {
        health.spawnGraceUntil = now + MATCH_CONFIG.SPAWN_GRACE_MS;
      }
    }
  }

  /**
   * Spawn explosion particles at position
   */
  spawnExplosion(x: number, y: number, color: number, count?: number): void {
    this._particlePool.spawnExplosion(x, y, color, count);
  }

  /**
   * Spawn mega explosion for kills (larger, more particles)
   */
  spawnMegaExplosion(x: number, y: number, color: number): void {
    // 3x particles, bigger spread
    this._particlePool.spawnExplosion(x, y, color, 60);
    
    // Add extra white core
    this._particlePool.spawnExplosion(x, y, 0xffffff, 20);
    
    // Add shockwave ring (simulated with expanding particles)
    for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16;
        this._particlePool.spawn({
            type: ParticleType.SHIELD, // Reuse shield type for ring effect
            x: x,
            y: y,
            vx: Math.cos(angle) * 400,
            vy: Math.sin(angle) * 400,
            life: 0.5,
            decay: 2,
            startSize: 4,
            endSize: 0,
            size: 4,
            color: 0xffffff,
            alpha: 0.8,
            rotation: angle,
            rotationSpeed: 0,
            gravity: 0,
            active: true
        });
    }
  }

  /**
   * Spawn a clear hit cross marker (high readability on chaotic fights).
   */
  spawnHitCross(x: number, y: number, color: number = 0x22d3ee): void {
    // Center core pulse
    this._particlePool.spawn({
      type: ParticleType.SPARK,
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.32,
      decay: 3.5,
      startSize: 9,
      endSize: 0,
      size: 9,
      color,
      alpha: 1,
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0,
      active: true,
    });

    const armLen = 34;
    const armSpeed = 210;
    const angles = [0, Math.PI * 0.5];
    for (const angle of angles) {
      for (const sign of [-1, 1]) {
        const dirAngle = angle + (sign < 0 ? Math.PI : 0);
        this._particlePool.spawn({
          type: ParticleType.SPEED_LINE,
          x: x + Math.cos(angle) * sign * 4,
          y: y + Math.sin(angle) * sign * 4,
          vx: Math.cos(angle) * sign * armSpeed,
          vy: Math.sin(angle) * sign * armSpeed,
          life: 0.28,
          decay: 4.2,
          startSize: armLen,
          endSize: 4,
          size: armLen,
          color,
          alpha: 0.95,
          rotation: dirAngle,
          rotationSpeed: 0,
          gravity: 0,
          active: true,
        });
        this._particlePool.spawn({
          type: ParticleType.SPEED_LINE,
          x: x + Math.cos(angle) * sign * 3,
          y: y + Math.sin(angle) * sign * 3,
          vx: Math.cos(angle) * sign * (armSpeed * 0.9),
          vy: Math.sin(angle) * sign * (armSpeed * 0.9),
          life: 0.24,
          decay: 4.8,
          startSize: armLen * 0.6,
          endSize: 2,
          size: armLen * 0.6,
          color: 0xffffff,
          alpha: 0.9,
          rotation: dirAngle,
          rotationSpeed: 0,
          gravity: 0,
          active: true,
        });
      }
    }

    // Corner sparks to make the hit marker stand out in crowded fights.
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this._particlePool.spawn({
        type: ParticleType.SPARK,
        x,
        y,
        vx: Math.cos(angle) * 110,
        vy: Math.sin(angle) * 110,
        life: 0.2,
        decay: 5,
        startSize: 3,
        endSize: 0,
        size: 3,
        color: 0xffffff,
        alpha: 0.85,
        rotation: angle,
        rotationSpeed: 0,
        gravity: 0,
        active: true,
      });
    }
  }

  /**
   * Spawn death burst effect (dramatic explosion)
   */
  spawnDeathBurst(x: number, y: number, color: number): void {
    this._particlePool.spawnDeathBurst(x, y, color);
  }

  /**
   * Spawn spawn effect (birth animation)
   */
  spawnSpawnEffect(x: number, y: number, color: number): void {
    this._particlePool.spawnSpawnEffect(x, y, color);
  }

  /**
   * Spawn exhaust particles (for boost trail)
   */
  spawnExhaust(x: number, y: number, angle: number, color: number): void {
    this._particlePool.spawnExhaust(x, y, angle, color);
  }

  /**
   * Spawn speed lines (for boost effect)
   */
  spawnSpeedLine(x: number, y: number, angle: number, speed: number): void {
    this._particlePool.spawnSpeedLine(x, y, angle, speed);
  }

  /**
   * Spawn shield effect particles
   */
  spawnShield(x: number, y: number, radius: number): void {
    this._particlePool.spawnShield(x, y, radius);
  }

  /**
   * Get particle pool for external access
   */
  getParticlePool() {
    return this._particlePool;
  }

  /**
   * Set camera target
   */
  setCameraTarget(entityId: string | null): void {
    this._camera.setTarget(entityId);
  }

  /**
   * Set camera zoom
   */
  setCameraZoom(zoom: number): void {
    this._camera.setZoom(zoom);
  }

  /**
   * World to screen conversion
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return this._camera.worldToScreen(worldX, worldY);
  }

  /**
   * Screen to world conversion
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this._camera.screenToWorld(screenX, screenY);
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this._camera.onResize(width, height);
  }

  /**
   * Set powerup system reference for rendering
   */
  setPowerupSystem(powerupSystem: PowerupSystem | null): void {
    this._powerupSystem = powerupSystem;
  }

  /**
   * Render powerups (DNA helix collectibles)
   */
  private _renderPowerups(now: number): void {
    if (!this._powerupSystem) return;

    const powerups = this._powerupSystem.getPowerups();
    const effectsLayer = this._layers.get(RenderLayer.POWERUPS);
    if (!effectsLayer) return;

    const camConfig = this._camera.getCameraConfig();
    const zoom = Math.max(0.001, camConfig.zoom);
    const cullMargin = 180;
    const halfWidth = (camConfig.screenWidth / 2) / zoom;
    const halfHeight = (camConfig.screenHeight / 2) / zoom;
    const viewLeft = camConfig.x - halfWidth - cullMargin;
    const viewRight = camConfig.x + halfWidth + cullMargin;
    const viewTop = camConfig.y - halfHeight - cullMargin;
    const viewBottom = camConfig.y + halfHeight + cullMargin;
    const activePowerupIds = new Set<string>();

    for (const powerup of powerups) {
      if (powerup.collected) continue;
      activePowerupIds.add(powerup.entityId);

      let graphics = this._powerupGraphics.get(powerup.entityId);
      if (!graphics) {
        graphics = this._createPowerupGraphics(powerup);
        this._powerupGraphics.set(powerup.entityId, graphics);
        effectsLayer.addChild(graphics.container);
      }

      const isVisible = (
        powerup.x >= viewLeft &&
        powerup.x <= viewRight &&
        powerup.y >= viewTop &&
        powerup.y <= viewBottom
      );
      graphics.container.visible = isVisible;
      if (!isVisible) {
        continue;
      }

      this._updatePowerupGraphics(graphics, powerup, now);
    }

    // Clean up graphics for collected/removed powerups
    for (const [id, graphicsData] of this._powerupGraphics) {
      if (!activePowerupIds.has(id)) {
        graphicsData.container.destroy();
        this._powerupGraphics.delete(id);
      }
    }
  }

  /**
   * Render ability traps (orange hazard dots)
   */
  private _renderTraps(now: number): void {
    const abilitySystem = this.getEngine()?.getSystemManager()?.getSystem<AbilitySystem>('abilities');
    if (!abilitySystem) return;

    const traps = abilitySystem.getTraps();
    const layer = this._layers.get(RenderLayer.POWERUPS);
    if (!layer) return;

    const TRAP_COLOR = 0xffa300; // PICO-8 orange
    const TRAP_LIFETIME = ABILITY_CONFIG.TRAP.LIFETIME_MS;
    const TRAP_RADIUS = 8;

    const activeTrapIds = new Set<string>();

    for (const [trapId, trap] of traps) {
      activeTrapIds.add(trapId);

      let g = this._trapGraphics.get(trapId);
      if (!g) {
        g = new Graphics();
        layer.addChild(g);
        this._trapGraphics.set(trapId, g);
      }

      const age = now - trap.createdAt;
      const lifeRatio = Math.max(0, 1 - age / TRAP_LIFETIME);
      // Fade out during last 2 seconds
      const alpha = age > TRAP_LIFETIME - 2000
        ? lifeRatio / (2000 / TRAP_LIFETIME)
        : 1;

      // Bucket alpha at 5% steps — skip clear+redraw when unchanged
      const alphaBucket = Math.round(alpha * 20) / 20;
      if (this._trapAlphaBuckets.get(trapId) === alphaBucket) continue;
      this._trapAlphaBuckets.set(trapId, alphaBucket);

      g.clear();
      for (const pt of trap.trailPoints) {
        g.circle(pt.x, pt.y, TRAP_RADIUS).fill({ color: TRAP_COLOR, alpha: alphaBucket * 0.85 });
        g.circle(pt.x, pt.y, TRAP_RADIUS + 3).stroke({ width: 1.5, color: TRAP_COLOR, alpha: alphaBucket * 0.4 });
      }
    }

    // Remove graphics for expired/removed traps
    for (const [id, g] of this._trapGraphics) {
      if (!activeTrapIds.has(id)) {
        g.destroy();
        this._trapGraphics.delete(id);
        this._trapAlphaBuckets.delete(id);
      }
    }
  }

  /**
   * Create graphics for a powerup.
   * Shape is drawn ONCE here — animation is handled via container.rotation + container.alpha,
   * avoiding 54+ per-frame Graphics primitives (zero clear+redraw cost at 60fps).
   */
  private _createPowerupGraphics(powerup: PowerupData): { container: ContainerType; graphics: GraphicsType } {
    const container = new Container();
    container.x = powerup.x;
    container.y = powerup.y;

    const graphics = new Graphics();
    graphics.label = `powerup_${powerup.entityId}`;
    container.addChild(graphics);

    // Draw static shape once — container rotation handles spin animation
    const colors = this._getPowerupColors(powerup.type);
    const { primary, glow } = colors;

    // Static outer ring (12 evenly-spaced dots)
    const ringRadius = 16;
    const ringSteps = 12;
    for (let i = 0; i < ringSteps; i++) {
      const angle = (i / ringSteps) * Math.PI * 2;
      const px = Math.cos(angle) * ringRadius;
      const py = Math.sin(angle) * ringRadius;
      graphics.rect(px - 2, py - 2, 4, 4).fill({ color: glow, alpha: 0.3 });
    }

    // Static DNA helix at phase=0
    this._drawHelixStatic(graphics, primary);

    // Center nucleus
    graphics.rect(-3, -3, 6, 6).fill({ color: primary, alpha: 0.9 });
    graphics.rect(-1, -1, 2, 2).fill({ color: 0xffffff, alpha: 0.6 });

    return { container, graphics };
  }

  /**
   * Update powerup graphics — position/scale/rotation/alpha only.
   * No clear+redraw; shape was drawn once in _createPowerupGraphics.
   */
  private _updatePowerupGraphics(powerupGraphics: { container: ContainerType; graphics: GraphicsType }, powerup: PowerupData, now: number): void {
    const { container } = powerupGraphics;
    const age = now - powerup.spawnTime;
    const lifetime = POWERUP_CONFIG.LIFETIME_MS;
    const fadeStart = lifetime - 3000;

    container.x = powerup.x;
    container.y = powerup.y;
    container.scale.set(powerup.scale);
    container.rotation = powerup.rotation;

    let alpha = 1;
    if (age > fadeStart) {
      alpha = 1 - (age - fadeStart) / (lifetime - fadeStart);
    }
    container.alpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Draw static DNA double helix at phase=0 (Pixel Art).
   * Container rotation drives the visual spin — no per-frame redraw needed.
   */
  private _drawHelixStatic(graphics: GraphicsType, color: number): void {
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = (t - 0.5) * 20; // -10 to 10
      const angle = t * Math.PI * 4; // fixed phase=0

      const y1 = Math.sin(angle) * 8;
      graphics.rect(x - 1, y1 - 1, 2, 2).fill({ color, alpha: 1 });

      const y2 = Math.sin(angle + Math.PI) * 8;
      graphics.rect(x - 1, y2 - 1, 2, 2).fill({ color, alpha: 1 });
    }
  }

  /**
   * Get powerup colors by type
   */
  private _getPowerupColors(type: PowerupType): { primary: number; glow: number } {
    switch (type) {
      case 'energy':
        return { primary: 0x22d3ee, glow: 0x06b6d4 }; // Cyan
      case 'speed':
        return { primary: 0xfbbf24, glow: 0xf59e0b }; // Yellow
      case 'overdrive':
        return { primary: 0xef4444, glow: 0xdc2626 }; // Red
      default:
        return { primary: 0xffffff, glow: 0x888888 };
    }
  }

  /**
   * Get camera info
   */
  getCamera(): Readonly<CameraConfig> {
    return this._camera.getCameraConfig();
  }

  /**
   * Lightweight render diagnostics for automation/debugging.
   */
  getDebugSnapshot(): {
    layerChildren: Record<string, number>;
    entityGraphics: number;
    visibleEntities: number;
    visibleNameplates: number;
    trailGraphics: number;
    trailRedraws: number;
    trailReuseSkips: number;
    bodyRedraws: number;
    bodyReuseSkips: number;
    offscreenIndicatorCount: number;
    offscreenIndicatorRedraws: number;
    offscreenIndicatorReuseSkips: number;
    hasBackground: boolean;
    hasZone: boolean;
    hasParticles: boolean;
  } {
    const layerChildren: Record<string, number> = {};
    for (const [layer, container] of this._layers.entries()) {
      layerChildren[String(layer)] = container.children.length;
    }

    let visibleEntities = 0;
    let visibleNameplates = 0;
    for (const graphics of this._entityGraphics.values()) {
      if (graphics.container.visible) visibleEntities += 1;
      if (graphics.nameplate && graphics.nameplate.style.display !== 'none') {
        visibleNameplates += 1;
      }
    }

    return {
      layerChildren,
      entityGraphics: this._entityGraphics.size,
      visibleEntities,
      visibleNameplates,
      trailGraphics: this._trailGraphics.size,
      trailRedraws: this._trailRedrawsLastFrame,
      trailReuseSkips: this._trailReuseSkipsLastFrame,
      bodyRedraws: this._bodyRedrawsLastFrame,
      bodyReuseSkips: this._bodyReuseSkipsLastFrame,
      offscreenIndicatorCount: this._offscreenIndicatorCountLastFrame,
      offscreenIndicatorRedraws: this._offscreenIndicatorRedrawsLastFrame,
      offscreenIndicatorReuseSkips: this._offscreenIndicatorReuseSkipsLastFrame,
      hasBackground: this._backgroundGraphics !== null,
      hasZone: this._zoneGraphics !== null,
      hasParticles: this._particleGraphics !== null,
    };
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this._fps;
  }

  /**
   * Destroy render system
   * PERFORMANCE: Properly cleans up all PIXI resources
   */
  destroy(): void {
    // Clean up post-processing
    if (this._postProcessing) {
      this._postProcessing.destroy();
      this._postProcessing = null;
    }

    // Clean up background and zone graphics
    if (this._backgroundGraphics) {
      this._backgroundGraphics.destroy({ children: true, texture: false });
      this._backgroundGraphics = null;
    }
    if (this._zoneGraphics) {
      this._zoneGraphics.destroy({ children: true, texture: false });
      this._zoneGraphics = null;
    }
    this._offscreenIndicators = null;
    this._offscreenIndicatorDrawKey = '';

    // Clear particle pool before destroying its Graphics handle.
    // This avoids calling Graphics.clear() after the underlying context is gone.
    this._particlePool.clear();
    this._particlePool.setGraphics(null);

    // Clean up particle graphics
    if (this._particleGraphics) {
      this._particleGraphics.destroy({ children: true, texture: false });
      this._particleGraphics = null;
    }

    if (this._spawnRingGraphics) {
      this._spawnRingGraphics.destroy({ children: true, texture: false });
      this._spawnRingGraphics = null;
    }
    this._spawnRing = null;

    // Clean up all graphics
    for (const [entityId, graphics] of this._entityGraphics) {
      if (graphics.nameplate && graphics.nameplate.parentNode) {
        graphics.nameplate.parentNode.removeChild(graphics.nameplate);
      }
      if (graphics.container) {
        graphics.container.destroy({ children: true, texture: false });
      }
    }
    this._entityGraphics.clear();

    // Clean up trail graphics
    for (const cache of this._trailGraphics.values()) {
      cache.graphics.destroy({ children: true, texture: false });
    }
    this._trailGraphics.clear();

    // Clean up powerup graphics
    for (const graphics of this._powerupGraphics.values()) {
      if (graphics.container) {
        graphics.container.destroy({ children: true, texture: false });
      }
    }
    this._powerupGraphics.clear();

    // Clean up trap graphics
    for (const g of this._trapGraphics.values()) {
      g.destroy();
    }
    this._trapGraphics.clear();

    // Clean up layers (destroy from bottom to top)
    const layerKeys = Array.from(this._layers.keys());
    for (const key of layerKeys) {
      const layer = this._layers.get(key);
      if (layer) {
        layer.destroy({ children: true, texture: false });
        this._layers.delete(key);
      }
    }

    // Remove FPS counter
    if (this._fpsElement && this._fpsElement.parentNode) {
      this._fpsElement.parentNode.removeChild(this._fpsElement);
    }
    this._fpsElement = null;
  }
}

/**
 * Factory function
 */
export function createRenderSystem(config: RenderSystemConfig): RenderSystem {
  return new RenderSystem(config);
}
