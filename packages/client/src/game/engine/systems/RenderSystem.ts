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
import { getTrailAlpha } from '../components/Trail';
import type { Player } from '../components/Player';
import { EntityType } from '../components/Player';
import type { Health } from '../components/Health';
import { EntityState } from '../components/Health';
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
import { PLAYER_VISUAL_CONFIG, TRAIL_EFFECTS } from '../config/GameConstants';
import { PostProcessingSystem, createPostProcessingSystem } from './PostProcessingSystem';
import type { KillPower } from '../components/KillPower';
import { getKillPowerGrowthMult } from '../components/KillPower';
import type { SpermClass } from '../components/SpermClass';
import { SpermClassType } from '../components/SpermClass';

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

  /** Tail lateral bend state for spring-like smooth motion */
  tailBend: number;

  /** Tail bend velocity for damping */
  tailBendVelocity: number;

  /** Position history for slither.io-style body (world coords) */
  positionHistory: Array<{ x: number; y: number }>;
}

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
  private readonly _trailGraphics: Map<string, GraphicsType> = new Map();

  // Particle pool
  private readonly _particlePool = getParticlePool();

  // Particle graphics container
  private _particleGraphics: GraphicsType | null = null;

  // Powerup system reference
  private _powerupSystem: PowerupSystem | null = null;

  // Powerup graphics cache
  private readonly _powerupGraphics: Map<string, { container: ContainerType; graphics: GraphicsType }> = new Map();

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

  // Background graphics
  private _backgroundGraphics: GraphicsType | null = null;
  private _zoneGraphics: GraphicsType | null = null;

  // Post-processing system
  private _postProcessing: PostProcessingSystem | null = null;

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
      container.sortableChildren = true;
      this._layers.set(layer, container);
      this._config.worldContainer.addChild(container);
    }

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
   * Draw retro starfield background with grid
   */
  private _drawBackgroundGrid(): void {
    if (!this._backgroundGraphics) return;

    const grid = this._backgroundGraphics;
    grid.clear();

    const engine = this.getEngine();
    const worldSize = engine?.getWorldSize() ?? { width: 8000, height: 6000 };

    // 1. Deep space background
    grid.rect(0, 0, worldSize.width, worldSize.height).fill({
      color: 0x000000, // PICO-8 Black
    });

    // 2. Retro Grid (dots)
    const gridSize = 100;
    const dotSize = 2;
    for (let x = 0; x <= worldSize.width; x += gridSize) {
      for (let y = 0; y <= worldSize.height; y += gridSize) {
        grid.rect(x, y, dotSize, dotSize).fill({
          color: 0x1d2b53, // Dark blue
          alpha: 0.5
        });
      }
    }

    // 3. Distant Stars (static)
    // Use a pseudo-random seed to keep stars consistent
    const starCount = 1000;
    const seed = 12345; 
    for (let i = 0; i < starCount; i++) {
      // Simple LCG for deterministic "random" numbers
      const r1 = ((seed + i * 9301 + 49297) % 233280) / 233280;
      const r2 = ((seed + i * 49297 + 9301) % 233280) / 233280;
      
      const x = r1 * worldSize.width;
      const y = r2 * worldSize.height;
      
      // Twinkle effect based on time
      const twinkle = Math.sin(this._time * 2 + i) > 0.9;
      const color = twinkle ? 0xfff1e8 : 0x5f574f; // White or Dark Gray
      
      grid.rect(x, y, 2, 2).fill({
        color: color,
        alpha: twinkle ? 0.8 : 0.4
      });
    }

    // 4. Border
    grid.rect(0, 0, worldSize.width, worldSize.height).stroke({
      width: 4,
      color: 0x7e2553, // Dark purple
      alpha: 1.0,
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
  }

  /**
   * Initialize post-processing effects
   */
  private _initPostProcessing(): void {
    // Apply post-processing to world container
    this._postProcessing = createPostProcessingSystem(this._config.worldContainer, {
      // NOTE: CRT shader currently crashes in some environments (attribute mismatch).
      // Keep post-processing off until the filter pipeline is stabilized.
      crtEnabled: false,
      vignetteEnabled: false,
      vignetteIntensity: 0.0,
      filmGrainEnabled: false,
    });
  }

  /**
   * Update zone visualization with retro pixel style
   */
  private _updateZoneVisualization(): void {
    if (!this._zoneGraphics) return;

    const systemManager = this.getEngine()?.getSystemManager();
    const zoneSystem = systemManager?.getSystem<ZoneSystem>('zone');

    if (!zoneSystem) return;

    const zoneInfo = zoneSystem.getDebugInfo?.();
    if (!zoneInfo) return;

    const zone = this._zoneGraphics;
    zone.clear();

    const { currentRadius, center, state } = zoneInfo;

    // Colors
    const baseColor = state === 'warning' ? 0xffa300 : (state === 'shrinking' ? 0xff004d : 0x00e436);
    const alpha = state === 'warning'
      ? 0.4 + Math.sin(this._time * 8) * 0.2
      : (state === 'shrinking' ? 0.35 : 0.25);

    // Pixelated Circle Approximation using blocks
    // Fewer segments for blockier look
    const circumference = 2 * Math.PI * currentRadius;
    const blockSize = 32;
    const numSegments = Math.floor(circumference / blockSize);

    for (let i = 0; i < numSegments; i++) {
        const angle = (i / numSegments) * Math.PI * 2 + this._time * 0.1;
        const x = center.x + Math.cos(angle) * currentRadius;
        const y = center.y + Math.sin(angle) * currentRadius;

        // Main boundary blocks
        zone.rect(x - 8, y - 8, 16, 16).fill({
            color: baseColor,
            alpha: alpha
        });

        // Flashing danger indicators
        if (state === 'shrinking' || state === 'warning') {
            const pulse = Math.sin(this._time * 10 + i * 0.5) > 0;
            if (pulse && i % 3 === 0) {
                 zone.rect(x - 12, y - 12, 24, 24).stroke({
                     width: 4,
                     color: 0xff004d, // Red
                     alpha: 0.6
                 });
            }
        }
    }

    // Center marker (Pixel Cross)
    const markerSize = 20;
    zone.rect(center.x - markerSize, center.y - 4, markerSize * 2, 8).fill({ color: baseColor, alpha: 0.5 });
    zone.rect(center.x - 4, center.y - markerSize, 8, markerSize * 2).fill({ color: baseColor, alpha: 0.5 });
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
    this._renderCars();

    // Render powerups
    this._renderPowerups();

    // Render trails
    this._renderTrails();

    // Render effects
    this._renderEffects();

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
    const engine = this.getEngine();
    const spatialGrid = (engine as any)?.getSpatialGrid() as SpatialGrid | undefined;
    if (spatialGrid) {
        const nearby = spatialGrid.getNearbyEntities(localPos.x, localPos.y, 100);
        let maxTrailDanger = 0;
        for (const [id] of nearby) {
            if (id === localPlayerId) continue;
            const other = this.entityManager.getEntity(id);
            const trail = other?.getComponent<Trail>(ComponentNames.TRAIL);
            if (trail && trail.points.length > 0) {
                // Find closest point in trail
                for (const pt of trail.points) {
                    const dx = pt.x - localPos.x;
                    const dy = pt.y - localPos.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < 60 * 60) { // Within 60px of a trail
                        const d = Math.sqrt(distSq);
                        const trailDanger = Math.max(0, Math.min(1, (60 - d) / 40));
                        maxTrailDanger = Math.max(maxTrailDanger, trailDanger);
                    }
                }
            }
        }
        totalDanger = Math.max(totalDanger, maxTrailDanger);
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
    let indicators = overlayLayer.getChildByName('offscreen-indicators') as GraphicsType;
    if (!indicators) {
        indicators = new Graphics();
        indicators.name = 'offscreen-indicators';
        overlayLayer.addChild(indicators);
    }
    indicators.clear();

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
        indicators
          .moveTo(x1, y1)
          .lineTo(x2, y2)
          .lineTo(x3, y3)
          .closePath()
          .fill({
            color: player.color,
            alpha: 0.8
        });

        // Small indicator pulse
        const pulse = 1 + Math.sin(this._time * 10) * 0.2;
        const pulseSize = 4 / Math.max(0.001, camConfig.zoom);
        indicators.rect(worldAnchor.x - pulseSize / 2, worldAnchor.y - pulseSize / 2, pulseSize, pulseSize).fill({
            color: 0xffffff,
            alpha: 0.9 * pulse
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
        this._camera.addShake(0.08);
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

      const fpsElement = this._config.uiContainer.querySelector('.fps-counter');
      if (fpsElement) {
        fpsElement.textContent = `FPS: ${this._fps}`;
      }
    }
  }

  /**
   * Render cars
   */
  private _renderCars(): void {
    const entities = this.entityManager.queryByMask(this._carMask);

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
      const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);
      const killPower = entity.getComponent<KillPower>(ComponentNames.KILL_POWER);
      const spermClass = entity.getComponent<SpermClass>(ComponentNames.SPERM_CLASS);

      if (!position || !velocity || !player) continue;

      // Get or create graphics
      let graphics = this._entityGraphics.get(entity.id);
      if (!graphics) {
        graphics = this._createCarGraphics(entity, player);
        this._entityGraphics.set(entity.id, graphics);
      }

      // Update graphics
      this._updateCarGraphics(
        entity.id,
        graphics,
        position,
        velocity,
        player,
        health,
        boost,
        abilities,
        killPower,
        spermClass
      );
    }
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

    // Nameplate
    const nameplate = document.createElement('div');
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
      tailBend: 0,
      tailBendVelocity: 0,
      positionHistory: [],
    };
  }

  /**
   * Update car graphics
   */
  private _updateCarGraphics(
    entityId: string,
    graphics: EntityGraphics,
    position: Position,
    velocity: Velocity,
    player: Player,
    health: Health | undefined,
    boost: Boost | undefined,
    abilities: Abilities | undefined,
    killPower: KillPower | undefined,
    spermClass: SpermClass | undefined
  ): void {
    const { container, body, tail, shield, glow, nameplate } = graphics;
    const now = Date.now();
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
    const facingLerp = boost?.isBoosting ? 0.64 : 0.52;
    graphics.visualAngle = this._lerpAngle(graphics.visualAngle, targetVisualAngle, facingLerp);
    container.rotation = graphics.visualAngle;

    // === SLITHER.IO STYLE: Update position history ===
    const maxHistoryLen = boost?.isBoosting ? 45 : 35;
    const minDist = 4; // Min distance between history points
    const history = graphics.positionHistory;

    if (history.length === 0) {
      history.push({ x: position.x, y: position.y });
    } else {
      const last = history[history.length - 1];
      const dx = position.x - last.x;
      const dy = position.y - last.y;
      if (dx * dx + dy * dy >= minDist * minDist) {
        history.push({ x: position.x, y: position.y });
        if (history.length > maxHistoryLen) {
          history.shift();
        }
      }
    }

    // Visibility
    const isVisible = health?.isAlive ?? true;
    container.visible = isVisible;

    // Keep DOM nameplates in sync with entity life state to avoid
    // "floating names" after a car is eliminated.
    if (nameplate) {
      nameplate.style.display = isVisible ? 'block' : 'none';
    }

    if (!isVisible) return;

    // Draw retro sperm head (apply class size multiplier)
    this._drawSpermHead(body, player, boost?.isBoosting ?? false, classSizeMult * growthMult);

    // Keep head locked forward like a sperm head (no independent banking).
    const turnDiff = angularDistance(graphics.visualAngle, velocity.targetAngle);
    body.rotation = 0;

    // Draw slither.io style body using position history (with class and kill power multipliers)
    this._drawSlitherBody(
      tail,
      player.color,
      boost?.isBoosting ?? false,
      graphics,
      position,
      classSizeMult * growthMult
    );

    // Draw shield if active
    if (abilities && isAbilityActive(abilities, AbilityType.SHIELD)) {
      this._drawShield(shield, true);
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
  }

  /**
   * Draw clean sperm head - simple oval with highlight, no donut effect.
   */
  private _drawSpermHead(bodyGraphics: GraphicsType, player: Player, isBoosting: boolean, sizeMult: number = 1.0): void {
    bodyGraphics.clear();

    const rx = 10 * sizeMult;  // Slightly bigger head (scaled by class)
    const ry = 7 * sizeMult;

    // Boost glow
    if (isBoosting) {
      bodyGraphics.ellipse(0, 0, rx + 5, ry + 4).fill({
        color: player.color,
        alpha: 0.25,
      });
    }

    // Main head - solid color
    bodyGraphics.ellipse(0, 0, rx, ry).fill({
      color: player.color,
      alpha: 1.0,
    });

    // Subtle white outline for visibility
    bodyGraphics.ellipse(0, 0, rx, ry).stroke({
      width: 1.5,
      color: 0xffffff,
      alpha: 0.4,
    });

    // Single highlight spot for 3D depth (top-front)
    bodyGraphics.ellipse(3, -2, rx * 0.35, ry * 0.3).fill({
      color: 0xffffff,
      alpha: 0.35,
    });
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
   * Draw slither.io-style body that follows the head's actual path.
   * The body IS the trail - smooth, responsive, addictive movement.
   */
  private _drawSlitherBody(
    tailGraphics: GraphicsType,
    color: number,
    isBoosting: boolean,
    graphics: EntityGraphics,
    currentPos: Position,
    growthMult: number = 1.0
  ): void {
    tailGraphics.clear();

    const history = graphics.positionHistory;
    if (history.length < 2) return;

    // Transform world positions to local coordinates (relative to head)
    const headX = currentPos.x;
    const headY = currentPos.y;
    const angle = graphics.visualAngle;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    // Convert history to local space
    const localPts: Array<{ x: number; y: number }> = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const wx = history[i].x - headX;
      const wy = history[i].y - headY;
      // Rotate to local space
      const lx = wx * cosA - wy * sinA;
      const ly = wx * sinA + wy * cosA;
      localPts.push({ x: lx, y: ly });
    }

    // Body parameters - thick like slither.io!
    // Apply growth multiplier for kill power effect
    const baseHeadWidth = isBoosting ? 14 : 12;
    const baseTailWidth = isBoosting ? 4 : 3;
    const headWidth = baseHeadWidth * growthMult;  // Thick body near head
    const tailWidth = baseTailWidth * growthMult;  // Thin at the end

    // Draw outer glow first
    for (let i = 0; i < localPts.length - 1; i++) {
      const t = i / (localPts.length - 1);
      const width = headWidth - (headWidth - tailWidth) * t;

      tailGraphics.moveTo(localPts[i].x, localPts[i].y);
      tailGraphics.lineTo(localPts[i + 1].x, localPts[i + 1].y);
      tailGraphics.stroke({
        width: width + 4,
        color: color,
        alpha: 0.2,
        cap: 'round',
        join: 'round',
      });
    }

    // Draw main body
    for (let i = 0; i < localPts.length - 1; i++) {
      const t = i / (localPts.length - 1);
      const width = headWidth - (headWidth - tailWidth) * t;
      const alpha = 1.0 - t * 0.15;  // Slight fade

      tailGraphics.moveTo(localPts[i].x, localPts[i].y);
      tailGraphics.lineTo(localPts[i + 1].x, localPts[i + 1].y);
      tailGraphics.stroke({
        width: width,
        color: color,
        alpha: alpha,
        cap: 'round',
        join: 'round',
      });
    }

    // Inner highlight for depth (slither.io style)
    for (let i = 0; i < localPts.length - 1; i += 2) {
      const t = i / (localPts.length - 1);
      const width = (headWidth - (headWidth - tailWidth) * t) * 0.4;

      tailGraphics.moveTo(localPts[i].x, localPts[i].y - 1);
      tailGraphics.lineTo(localPts[i + 1].x, localPts[i + 1].y - 1);
      tailGraphics.stroke({
        width: width,
        color: 0xffffff,
        alpha: 0.25,
        cap: 'round',
      });
    }

    // Boost sparkles at the tip
    if (isBoosting && localPts.length > 3) {
      const tipIdx = localPts.length - 1;
      const tip = localPts[tipIdx];
      tailGraphics.circle(tip.x, tip.y, 3).fill({
        color: 0xffffff,
        alpha: 0.6 + Math.sin(this._time * 15) * 0.3,
      });
    }
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

    const r = radius;
    // Outer square outline
    shieldGraphics.rect(-r, -r, r * 2, r * 2).stroke({
      width: 4,
      color: 0x00ffff,
      alpha: pulse,
    });

    // Inner square outline
    const r2 = r - 6;
    shieldGraphics.rect(-r2, -r2, r2 * 2, r2 * 2).stroke({
      width: 2,
      color: 0x00ffff,
      alpha: pulse * 0.7,
    });

    // Corner accents (pixel look)
    const cornerSize = 4;
    shieldGraphics.rect(-r - 2, -r - 2, cornerSize, cornerSize).fill({ color: 0xffffff });
    shieldGraphics.rect(r - 2, -r - 2, cornerSize, cornerSize).fill({ color: 0xffffff });
    shieldGraphics.rect(-r - 2, r - 2, cornerSize, cornerSize).fill({ color: 0xffffff });
    shieldGraphics.rect(r - 2, r - 2, cornerSize, cornerSize).fill({ color: 0xffffff });
  }

  /**
   * Draw pixel art boost glow
   */
  private _drawGlow(glowGraphics: GraphicsType, color: number): void {
    glowGraphics.clear();

    const pulseFast = 0.4 + Math.sin(this._time * 15) * 0.25;
    const r = PLAYER_VISUAL_CONFIG.GLOW_RADIUS + Math.sin(this._time * 9) * 2.6;
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
  private _renderTrails(): void {
    const entities = this.entityManager.queryByMask(this._trailMask);
    const now = Date.now();

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);

      if (!trail || !player) continue;

      let trailGraphics = this._trailGraphics.get(entity.id);
      if (!trailGraphics) {
        trailGraphics = new Graphics();
        trailGraphics.label = `trail_${entity.id}`;
        const trailsLayer = this._layers.get(RenderLayer.TRAILS);
        if (trailsLayer) {
          trailsLayer.addChild(trailGraphics);
        }
        this._trailGraphics.set(entity.id, trailGraphics);
      }

      trailGraphics.clear();

      const trailColor = trail.color;

      // Determine trail effect based on color
      let effectType = 'default';
      if (trailColor === 0xFFD700) effectType = 'gold';
      else if (trailColor === 0xFF4500 || trailColor === 0xFF0000) effectType = 'fire';
      else if (trailColor === 0xFFFF00) effectType = 'lightning';

      // Draw trail as continuous slither-style ribbons and split only on large jumps.
      if (trail.points.length >= 2) {
        const isLocalTrail = player.isLocal;
        const trailWidth = Math.max(1.25, trail.baseWidth * (isLocalTrail ? 1.08 : 0.96));
        const maxGapSq = 52 * 52;
        const visualLifetime = Math.min(trail.lifetime, isLocalTrail ? 420 : 340);
        const active = trail.points
          .map((p) => ({
            p,
            alpha: Number.isFinite(p?.x) && Number.isFinite(p?.y)
              ? getTrailAlpha(p, visualLifetime, now)
              : 0,
          }))
          .filter((entry) => entry.alpha > 0.22);

        if (active.length >= 2) {
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

          for (const seg of segments) {
            const poly: Array<{ x: number; y: number }> = [];
            let alphaSum = 0;
            let alphaCount = 0;

            for (let i = 0; i < seg.length; i++) {
              const point = seg[i]?.p;
              const alpha = seg[i].alpha;
              if (!point) continue;

              poly.push({ x: point.x, y: point.y });
              alphaSum += alpha;
              alphaCount++;
            }

            if (poly.length >= 2 && alphaCount > 0) {
              const avgAlpha = alphaSum / alphaCount;
              const glowAlpha = isLocalTrail ? 0.16 : 0.11;
              const coreAlpha = isLocalTrail ? 0.72 : 0.54;
              const highlightAlpha = isLocalTrail ? 0.16 : 0.08;
              this._drawPolylineSegment(trailGraphics, poly, trailWidth + 0.4, trailColor, avgAlpha * glowAlpha);
              this._drawPolylineSegment(trailGraphics, poly, trailWidth, trailColor, avgAlpha * coreAlpha);
              this._drawPolylineSegment(
                trailGraphics,
                poly,
                Math.max(0.55, trailWidth * 0.24),
                0xffffff,
                avgAlpha * highlightAlpha
              );
            }
          }
        }

        // Spawn particles for special effects
        for (let i = 0; i < trail.points.length; i++) {
          const p = trail.points[i];
          const alpha = getTrailAlpha(p, visualLifetime, now);
          if (alpha <= 0) continue;

          // Boost sparkles
          if (p.isBoosted && Math.random() < 0.04) {
            const sparkleSize = 2;
            trailGraphics.rect(p.x - sparkleSize/2, p.y - sparkleSize/2, sparkleSize, sparkleSize).fill({
              color: 0xffffff,
              alpha: alpha * 0.55,
            });
          }

          // Fire/Gold particles
          if (Math.random() < 0.03 && (effectType === 'gold' || effectType === 'fire')) {
            const pType = effectType === 'fire' ? ParticleType.SMOKE : ParticleType.SPARK;
            const pColor = effectType === 'fire' ? 0xFF4500 : 0xFFD700;

            this._particlePool.spawn({
              type: pType,
              x: p.x + (Math.random() - 0.5) * 10,
              y: p.y + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 0.5,
              decay: 2,
              startSize: 2,
              endSize: 0,
              size: 2,
              color: pColor,
              alpha: alpha,
              rotation: 0,
              rotationSpeed: 0,
              gravity: effectType === 'fire' ? -20 : 0,
              active: true
            });
          }
        }
      }
    }

    // Clean up trail graphics for destroyed entities
    for (const [entityId, graphics] of this._trailGraphics) {
      if (!this.entityManager.hasEntity(entityId)) {
        graphics.destroy();
        this._trailGraphics.delete(entityId);
      }
    }
  }

  /**
   * Render effects (particles, etc.)
   */
  private _renderEffects(): void {
    const effectsLayer = this._layers.get(RenderLayer.EFFECTS);
    if (!effectsLayer) return;

    // Render all active particles
    this._particlePool.render();
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
  private _renderPowerups(): void {
    if (!this._powerupSystem) return;

    const powerups = this._powerupSystem.getPowerups();
    const effectsLayer = this._layers.get(RenderLayer.POWERUPS);
    if (!effectsLayer) return;

    const now = Date.now();

    for (const powerup of powerups) {
      if (powerup.collected) continue;

      let graphics = this._powerupGraphics.get(powerup.entityId);
      if (!graphics) {
        graphics = this._createPowerupGraphics(powerup);
        this._powerupGraphics.set(powerup.entityId, graphics);
        effectsLayer.addChild(graphics.container);
      }

      this._updatePowerupGraphics(graphics, powerup, now);
    }

    // Clean up graphics for collected/removed powerups
    for (const [id, graphicsData] of this._powerupGraphics) {
      const exists = powerups.find(p => p.entityId === id && !p.collected);
      if (!exists) {
        graphicsData.container.destroy();
        this._powerupGraphics.delete(id);
      }
    }
  }

  /**
   * Create graphics for a powerup
   */
  private _createPowerupGraphics(powerup: PowerupData): { container: ContainerType; graphics: GraphicsType } {
    const container = new Container();
    container.x = powerup.x;
    container.y = powerup.y;

    const graphics = new Graphics();
    graphics.label = `powerup_${powerup.entityId}`;
    container.addChild(graphics);

    return { container, graphics };
  }

  /**
   * Update powerup graphics (Pixel Art DNA)
   */
  private _updatePowerupGraphics(powerupGraphics: { container: ContainerType; graphics: GraphicsType }, powerup: PowerupData, now: number): void {
    const { container, graphics } = powerupGraphics;
    const age = now - powerup.spawnTime;
    const lifetime = 15000; // 15 seconds
    const fadeStart = lifetime - 3000; // Start fading at 12 seconds

    // Update position
    container.x = powerup.x;
    container.y = powerup.y;

    // Update scale (bobbing animation from system)
    container.scale.set(powerup.scale);
    container.rotation = powerup.rotation;

    // Calculate alpha based on lifetime
    let alpha = 1;
    if (age > fadeStart) {
      alpha = 1 - (age - fadeStart) / (lifetime - fadeStart);
    }
    alpha = Math.max(0, Math.min(1, alpha));

    // Clear and redraw
    graphics.clear();

    // Get powerup color based on type
    const colors = this._getPowerupColors(powerup.type);
    const primary = colors.primary;
    const glow = colors.glow;

    // Draw outer glow ring (Pixelated)
    const ringRadius = 16;
    const ringSteps = 12;
    for(let i=0; i<ringSteps; i++) {
        const angle = (i/ringSteps) * Math.PI * 2 + now/1000;
        const px = Math.cos(angle) * ringRadius;
        const py = Math.sin(angle) * ringRadius;
        graphics.rect(px-2, py-2, 4, 4).fill({ color: glow, alpha: alpha * 0.3 });
    }

    // Draw DNA helix (double helix structure)
    this._drawHelix(graphics, primary, alpha, now);

    // Center nucleus
    graphics.rect(-3, -3, 6, 6).fill({
      color: primary,
      alpha: alpha * 0.9,
    });

    // Inner highlight
    graphics.rect(-1, -1, 2, 2).fill({
      color: 0xffffff,
      alpha: alpha * 0.6,
    });
  }

  /**
   * Draw DNA double helix structure (Pixel Art)
   */
  private _drawHelix(graphics: GraphicsType, color: number, alpha: number, now: number): void {
    // Iterate along the length to draw pixel strands
    const steps = 20;
    for(let i=0; i<steps; i++) {
        const t = i/steps;
        const x = (t - 0.5) * 20; // -10 to 10
        const angle = (now / 500) + t * Math.PI * 4;
        
        // Strand 1
        const y1 = Math.sin(angle) * 8;
        graphics.rect(x-1, y1-1, 2, 2).fill({ color, alpha });
        
        // Strand 2
        const y2 = Math.sin(angle + Math.PI) * 8;
        graphics.rect(x-1, y2-1, 2, 2).fill({ color, alpha });
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
      if (graphics.nameplate?.style.display !== 'none') visibleNameplates += 1;
    }

    return {
      layerChildren,
      entityGraphics: this._entityGraphics.size,
      visibleEntities,
      visibleNameplates,
      trailGraphics: this._trailGraphics.size,
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

    // Clear particle pool before destroying its Graphics handle.
    // This avoids calling Graphics.clear() after the underlying context is gone.
    this._particlePool.clear();
    this._particlePool.setGraphics(null);

    // Clean up particle graphics
    if (this._particleGraphics) {
      this._particleGraphics.destroy({ children: true, texture: false });
      this._particleGraphics = null;
    }

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
    for (const graphics of this._trailGraphics.values()) {
      graphics.destroy({ children: true, texture: false });
    }
    this._trailGraphics.clear();

    // Clean up powerup graphics
    for (const graphics of this._powerupGraphics.values()) {
      if (graphics.container) {
        graphics.container.destroy({ children: true, texture: false });
      }
    }
    this._powerupGraphics.clear();

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
    const fpsElement = this._config.uiContainer.querySelector('.fps-counter');
    if (fpsElement && fpsElement.parentNode) {
      fpsElement.parentNode.removeChild(fpsElement);
    }
  }
}

/**
 * Factory function
 */
export function createRenderSystem(config: RenderSystemConfig): RenderSystem {
  return new RenderSystem(config);
}
