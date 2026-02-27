/**
 * Post-Processing System - Cinematic Visual Effects
 * Adds CRT, vignette and film grain for retro visuals
 */

import { System, SystemPriority } from '../core/System';
import { Container, Graphics, Filter, GlProgram, GpuProgram, type Container as ContainerType, type Graphics as GraphicsType } from 'pixi.js';

/**
 * Post-processing configuration
 */
export interface PostProcessingConfig {
  /** Enable vignette */
  vignetteEnabled?: boolean;

  /** Vignette intensity */
  vignetteIntensity?: number;

  /** Enable film grain */
  filmGrainEnabled?: boolean;

  /** Film grain intensity */
  grainIntensity?: number;
  
  /** Enable CRT effect */
  crtEnabled?: boolean;
}

// === SHADERS ===

const vertexShader = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vTextureCoord;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    vTextureCoord = aUV;
    gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uDimensions;
uniform float uAberration;
uniform float uFlash;

void main() {
    vec2 uv = vTextureCoord;
    
    // 1. Chromatic Aberration
    // Shift RGB channels slightly
    float aberration = uAberration;
    float r = texture(uTexture, vec2(uv.x + aberration, uv.y)).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, vec2(uv.x - aberration, uv.y)).b;
    float a = texture(uTexture, uv).a;
    
    // 2. Scanlines
    // Sine wave based on Y coordinate and time
    float scanlineCount = uDimensions.y * 0.5;
    float scanline = sin(uv.y * scanlineCount + uTime * 2.0) * 0.05;
    
    vec3 color = vec3(r, g, b);
    color -= scanline;
    
    // 3. Brightness Boost (compensate for scanlines)
    color *= 1.1;
    
    // 4. Vignette (Shader-based, cheaper than Graphics)
    float dist = distance(uv, vec2(0.5));
    color *= smoothstep(0.8, 0.2, dist * (0.8));

    // 5. Screen Flash (White overlay)
    color = mix(color, vec3(1.0), uFlash);

    finalColor = vec4(color, a);
}
`;

/**
 * Custom CRT Filter
 */
class CRTFilter extends Filter {
    constructor() {
        const glProgram = new GlProgram({
            vertex: vertexShader,
            fragment: fragmentShader,
            name: 'crt-filter'
        });

        super({
            glProgram,
            resources: {
                crtUniforms: {
                    uTime: { value: 0, type: 'f32' },
                    uDimensions: { value: [800, 600], type: 'vec2<f32>' },
                    uAberration: { value: 0.002, type: 'f32' },
                    uFlash: { value: 0.0, type: 'f32' }
                }
            }
        });
    }

    public update(time: number, width: number, height: number, aberration: number, flash: number) {
        // Update uniforms
        this.resources.crtUniforms.uniforms.uTime = time;
        this.resources.crtUniforms.uniforms.uDimensions = [width, height];
        this.resources.crtUniforms.uniforms.uAberration = aberration;
        this.resources.crtUniforms.uniforms.uFlash = flash;
    }
}

/**
 * Post-processing system for cinematic effects
 */
export class PostProcessingSystem extends System {
  public readonly priority = SystemPriority.RENDERING;

  private readonly _config: Required<PostProcessingConfig>;
  private readonly _targetContainer: ContainerType;
  private readonly _overlayContainer: ContainerType;

  // Time for animated effects
  private _time: number = 0;

  // Vignette graphics
  private _vignetteGraphics: GraphicsType | null = null;
  private _dangerGraphics: GraphicsType | null = null;

  // CRT Filter
  private _crtFilter: CRTFilter | null = null;

  // Aberration state
  private _baseAberration: number = 0.002;
  private _targetAberration: number = 0.002;
  private _shakeAberration: number = 0;

  // Flash state
  private _flashIntensity: number = 0;

  // Danger state
  private _dangerIntensity: number = 0;

  constructor(targetContainer: Container, config: PostProcessingConfig = {}) {
    super(SystemPriority.RENDERING);

    this._targetContainer = targetContainer;

    // Default configuration
    this._config = {
      vignetteEnabled: config.vignetteEnabled ?? false, // Disabled in favor of CRT shader vignette
      vignetteIntensity: config.vignetteIntensity ?? 0.5,
      filmGrainEnabled: config.filmGrainEnabled ?? false,
      grainIntensity: config.grainIntensity ?? 0.05,
      crtEnabled: config.crtEnabled ?? true // Enable by default for retro look
    };

    // Create overlay container for additional effects (if any)
    this._overlayContainer = new Container();
    this._overlayContainer.zIndex = 9999;
    this._targetContainer.addChild(this._overlayContainer);

    // Initialize effects
    this._initializeEffects();
  }

  /**
   * Initialize post-processing effects
   */
  private _initializeEffects(): void {
    // Initialize CRT Filter
    if (this._config.crtEnabled) {
        this._crtFilter = new CRTFilter();
        // Apply filter to target container
        const currentFilters = this._targetContainer.filters || [];
        this._targetContainer.filters = [...(Array.isArray(currentFilters) ? currentFilters : [currentFilters]), this._crtFilter];
    }

    // Create danger graphics
    this._dangerGraphics = new Graphics();
    this._overlayContainer.addChild(this._dangerGraphics);

    // Create vignette graphics (legacy/extra)
    if (this._config.vignetteEnabled) {
      this._vignetteGraphics = new Graphics();
      this._overlayContainer.addChild(this._vignetteGraphics);
      this._renderVignette();
    }
  }

  /**
   * Render vignette effect
   */
  private _renderVignette(): void {
    if (!this._vignetteGraphics) return;

    const vignette = this._vignetteGraphics;
    vignette.clear();

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    const maxRadius = Math.max(screenWidth, screenHeight) * 0.7;

    const layers = 10;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const radius = maxRadius * (1 - t * 0.3);
      const alpha = this._config.vignetteIntensity * t * 0.15;

      vignette.circle(centerX, centerY, radius).stroke({
        width: 40,
        color: 0x000000,
        alpha,
      });
    }
  }

  /**
   * Update post-processing effects
   */
  update(dt: number): void {
    this._time += dt;

    // Decay shake aberration
    if (this._shakeAberration > 0) {
      this._shakeAberration = Math.max(0, this._shakeAberration - dt * 0.02);
    }

    // Combine base, target (boost), and shake
    // Interpolate towards target
    this._baseAberration += (this._targetAberration - this._baseAberration) * dt * 5;
    
    const totalAberration = this._baseAberration + this._shakeAberration;

    // Decay flash
    if (this._flashIntensity > 0) {
      this._flashIntensity = Math.max(0, this._flashIntensity - dt * 5); // Fast decay
    }

    // Update danger effect
    if (this._dangerGraphics && this._dangerIntensity > 0) {
        this._dangerGraphics.clear();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Pulse alpha
        const pulse = 0.5 + Math.sin(this._time * 10) * 0.5;
        const alpha = this._dangerIntensity * 0.3 * pulse; // Max 0.3 opacity

        // Draw red vignette (using large border)
        this._dangerGraphics.rect(0, 0, screenWidth, screenHeight).stroke({
            width: Math.min(screenWidth, screenHeight) * 0.1, // 10% border
            color: 0xff0000,
            alpha: alpha,
            alignment: 0 // Inside
        });
    } else if (this._dangerGraphics) {
        this._dangerGraphics.clear();
    }

    // Update CRT filter
    if (this._crtFilter) {
        this._crtFilter.update(this._time, window.innerWidth, window.innerHeight, totalAberration, this._flashIntensity);
    }
  }

  /**
   * Set danger intensity (0-1)
   */
  setDangerIntensity(intensity: number): void {
    this._dangerIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Trigger screen flash effect (whiteout)
   */
  triggerFlash(intensity: number = 0.8): void {
    this._flashIntensity = intensity;
  }

  /**
   * Set target chromatic aberration intensity
   * Base is usually 0.002. Boost might be 0.006.
   */
  setChromaticAberration(intensity: number): void {
    this._targetAberration = intensity;
  }

  /**
   * Set vignette intensity
   */
  setVignetteIntensity(intensity: number): void {
    this._config.vignetteIntensity = Math.max(0, Math.min(1, intensity));
    if (this._vignetteGraphics) {
        this._renderVignette();
    }
  }

  /**
   * Enable or disable vignette
   */
  setVignetteEnabled(enabled: boolean): void {
    this._config.vignetteEnabled = enabled;
    // Re-init logic omitted for brevity, focusing on CRT
  }

  /**
   * Trigger screen shake effect (vignette intensity boost + aberration)
   */
  triggerScreenShake(intensity: number, duration: number = 0.3): void {
    // Add temporary aberration spike
    this._shakeAberration = intensity * 0.005;
  }

  /**
   * Trigger near-miss effect (brief red flash + micro shake)
   * For dopamine feedback when narrowly avoiding death
   */
  triggerNearMiss(): void {
    // Quick danger flash that decays rapidly
    this._dangerIntensity = Math.min(1, this._dangerIntensity + 0.5);
    // Micro chromatic aberration burst
    this._shakeAberration = Math.max(this._shakeAberration, 0.003);
  }

  /**
   * Destroy post-processing system
   */
  destroy(): void {
    if (this._vignetteGraphics) {
      this._vignetteGraphics.destroy({ children: true, texture: false });
      this._vignetteGraphics = null;
    }

    // Remove filters
    this._targetContainer.filters = [];
    this._crtFilter = null;

    if (this._overlayContainer.parent) {
      this._overlayContainer.parent.removeChild(this._overlayContainer);
    }
    this._overlayContainer.destroy({ children: true, texture: false });
  }
}

/**
 * Factory function
 */
export function createPostProcessingSystem(
  targetContainer: Container,
  config?: PostProcessingConfig
): PostProcessingSystem {
  return new PostProcessingSystem(targetContainer, config);
}