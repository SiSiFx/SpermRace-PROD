/**
 * HUD Manager - Clean, unified HUD system
 * Single source of truth for all UI elements
 * Supports multiple themes: default, tactical
 */

export type HudTheme = 'default' | 'tactical';

export class HudManager {
  private container: HTMLElement;
  private topBar: HTMLElement | null = null;
  private zoneTimerEl: HTMLElement | null = null;
  private boostBarFillEl: HTMLElement | null = null;
  private aliveCountEl: HTMLElement | null = null;
  private theme: HudTheme = 'default';
  private tacticalElements: HTMLElement[] = [];
  private tacticalStylesLoaded: boolean = false;

  constructor(container: HTMLElement, theme: HudTheme = 'default') {
    this.container = container;
    this.theme = theme;
  }

  /**
   * Create entire HUD from scratch
   */
  createHUD() {
    // Clear any existing HUD
    this.clearHUD();

    // Load tactical styles if needed
    if (this.theme === 'tactical' && !this.tacticalStylesLoaded) {
      this.loadTacticalStyles();
    }

    const isMobile = window.innerWidth <= 768;

    // Create scanline overlay for entire game
    const scanlineOverlay = document.createElement('div');
    scanlineOverlay.id = 'hud-scanline-overlay';
    scanlineOverlay.className = 'hud-scanline-overlay';
    this.container.appendChild(scanlineOverlay);

    // Create unified top bar
    this.topBar = document.createElement('div');
    this.topBar.id = 'unified-top-bar';
    if (this.theme === 'tactical') {
      this.topBar.classList.add('tactical-hud');
    }

    Object.assign(this.topBar.style, {
      position: 'absolute',
      top: 'calc(10px + env(safe-area-inset-top, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '8px' : '12px',
      background: this.theme === 'tactical' ? 'rgba(0, 20, 0, 0.85)' : 'rgba(0, 0, 0, 0.85)',
      padding: isMobile ? '6px 12px' : '10px 20px',
      borderRadius: this.theme === 'tactical' ? '4px' : '24px',
      border: this.theme === 'tactical' ? '2px solid rgba(0, 255, 65, 0.5)' : '1px solid rgba(0, 255, 255, 0.2)',
      zIndex: '100',
      backdropFilter: 'blur(10px)',
      boxShadow: this.theme === 'tactical' ? '0 0 10px rgba(0, 255, 65, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.5)',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: this.theme === 'tactical' ? 'bold' : '700',
      color: '#ffffff',
      fontFamily: this.theme === 'tactical' ? "'Courier New', monospace" : 'inherit',
      letterSpacing: this.theme === 'tactical' ? '2px' : 'normal',
      textTransform: this.theme === 'tactical' ? 'uppercase' : 'none',
      transition: 'all 0.3s ease'
    });

    // Zone timer section
    const zoneSection = document.createElement('div');
    zoneSection.className = 'zone-timer';
    Object.assign(zoneSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    });

    this.zoneTimerEl = document.createElement('div');
    this.zoneTimerEl.textContent = 'TIME 1:30';
    const timerColor = this.theme === 'tactical' ? '#00ff41' : '#22d3ee';
    Object.assign(this.zoneTimerEl.style, {
      color: timerColor,
      whiteSpace: 'nowrap',
      textShadow: this.theme === 'tactical' ? '0 0 5px rgba(0, 255, 65, 0.8)' : 'none'
    });
    zoneSection.appendChild(this.zoneTimerEl);

    this.topBar.appendChild(zoneSection);

    // Separator
    const separator1 = this.createSeparator();
    this.topBar.appendChild(separator1);

    // Boost section
    const boostSection = document.createElement('div');
    boostSection.className = 'boost-section';
    Object.assign(boostSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    });

    const boostIcon = document.createElement('div');
    boostIcon.id = 'boost-icon';
    boostIcon.textContent = 'BOOST';
    const boostColor = this.theme === 'tactical' ? '#00ff41' : '#22d3ee';
    Object.assign(boostIcon.style, {
      fontSize: isMobile ? '14px' : '16px',
      color: boostColor,
      textShadow: this.theme === 'tactical' ? '0 0 5px rgba(0, 255, 65, 0.8)' : 'none'
    });
    boostSection.appendChild(boostIcon);

    const boostBarContainer = document.createElement('div');
    Object.assign(boostBarContainer.style, {
      width: isMobile ? '60px' : '100px',
      height: '6px',
      background: this.theme === 'tactical' ? 'rgba(0, 255, 65, 0.1)' : 'rgba(34, 211, 238, 0.15)',
      borderRadius: '3px',
      overflow: 'hidden',
      position: 'relative',
      border: this.theme === 'tactical' ? '1px solid rgba(0, 255, 65, 0.5)' : 'none'
    });

    this.boostBarFillEl = document.createElement('div');
    this.boostBarFillEl.id = 'boost-bar-fill';
    const boostGradient = this.theme === 'tactical'
      ? 'linear-gradient(90deg, #00d926 0%, #00ff41 100%)'
      : 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)';
    const boostGlow = this.theme === 'tactical'
      ? '0 0 10px rgba(0, 255, 65, 0.5)'
      : '0 0 8px rgba(34, 211, 238, 0.6)';
    Object.assign(this.boostBarFillEl.style, {
      height: '100%',
      width: '100%',
      background: boostGradient,
      borderRadius: '3px',
      transition: 'width 0.1s ease-out, background 0.2s ease',
      boxShadow: boostGlow
    });
    boostBarContainer.appendChild(this.boostBarFillEl);
    boostSection.appendChild(boostBarContainer);

    this.topBar.appendChild(boostSection);

    // Separator
    const separator2 = this.createSeparator();
    this.topBar.appendChild(separator2);

    // Alive count section
    const aliveSection = document.createElement('div');
    aliveSection.className = 'alive-counter';
    Object.assign(aliveSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    });

    this.aliveCountEl = document.createElement('div');
    this.aliveCountEl.textContent = '8 ALIVE';
    const aliveColor = this.theme === 'tactical' ? '#00ff41' : '#10b981';
    Object.assign(this.aliveCountEl.style, {
      color: aliveColor,
      whiteSpace: 'nowrap',
      textShadow: this.theme === 'tactical' ? '0 0 5px rgba(0, 255, 65, 0.8)' : 'none'
    });
    aliveSection.appendChild(this.aliveCountEl);

    this.topBar.appendChild(aliveSection);

    // Add to container
    this.container.appendChild(this.topBar);

    // Add tactical overlay elements if tactical theme
    if (this.theme === 'tactical') {
      this.createTacticalOverlays();
    }
  }

  /**
   * Create visual separator
   */
  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = 'separator';
    if (this.theme === 'tactical') {
      Object.assign(sep.style, {
        width: '2px',
        height: '16px',
        background: 'linear-gradient(to bottom, transparent, rgba(0, 255, 65, 0.5), transparent)',
        boxShadow: '0 0 10px rgba(0, 255, 65, 0.5)'
      });
    } else {
      Object.assign(sep.style, {
        width: '1px',
        height: '16px',
        background: 'rgba(255, 255, 255, 0.15)'
      });
    }
    return sep;
  }

  /**
   * Load tactical CSS styles
   */
  private loadTacticalStyles(): void {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/src/tactical-hud.css';
    link.id = 'tactical-hud-styles';
    document.head.appendChild(link);
    this.tacticalStylesLoaded = true;

    // Add scanline overlay to body
    const scanlines = document.createElement('div');
    scanlines.className = 'tactical-scanlines';
    scanlines.id = 'tactical-scanlines';
    document.body.appendChild(scanlines);
    this.tacticalElements.push(scanlines);
  }

  /**
   * Create tactical overlay elements (corners, grid, readouts)
   */
  private createTacticalOverlays(): void {
    // Grid overlay
    const gridOverlay = document.createElement('div');
    gridOverlay.className = 'tactical-grid-overlay';
    gridOverlay.id = 'tactical-grid';
    this.container.appendChild(gridOverlay);
    this.tacticalElements.push(gridOverlay);

    // Corner brackets
    const corners = ['tl', 'tr', 'bl', 'br'];
    corners.forEach(corner => {
      const cornerEl = document.createElement('div');
      cornerEl.className = `tactical-corner ${corner}`;
      this.container.appendChild(cornerEl);
      this.tacticalElements.push(cornerEl);
    });

    // Technical readout panel
    const readout = document.createElement('div');
    readout.className = 'tactical-readout';
    readout.id = 'tactical-readout';
    readout.innerHTML = `
      <div class="tactical-readout-row">
        <span class="tactical-readout-label">SYS:</span>
        <span class="tactical-readout-value">NOMINAL</span>
      </div>
      <div class="tactical-readout-row">
        <span class="tactical-readout-label">PWR:</span>
        <span class="tactical-readout-value">100%</span>
      </div>
      <div class="tactical-readout-row">
        <span class="tactical-readout-label">SPD:</span>
        <span class="tactical-readout-value" id="tactical-speed">200</span>
      </div>
    `;
    this.container.appendChild(readout);
    this.tacticalElements.push(readout);

    // Compass/heading indicator
    const compass = document.createElement('div');
    compass.className = 'tactical-compass';
    compass.id = 'tactical-compass';
    compass.innerHTML = `
      <div class="tactical-compass-value" id="tactical-heading">000°</div>
      <div class="tactical-compass-ticks">
        <div class="tactical-compass-tick"></div>
        <div class="tactical-compass-tick"></div>
        <div class="tactical-compass-tick"></div>
      </div>
    `;
    this.container.appendChild(compass);
    this.tacticalElements.push(compass);

    // Targeting reticle (center screen)
    const reticle = document.createElement('div');
    reticle.className = 'tactical-reticle';
    reticle.id = 'tactical-reticle';
    this.container.appendChild(reticle);
    this.tacticalElements.push(reticle);

    // Alert banner
    const alertBanner = document.createElement('div');
    alertBanner.className = 'tactical-alert-banner';
    alertBanner.id = 'tactical-alert';
    alertBanner.textContent = '⚠ WARNING ⚠';
    this.container.appendChild(alertBanner);
    this.tacticalElements.push(alertBanner);
  }

  /**
   * Update zone timer
   */
  updateZoneTimer(seconds: number) {
    if (!this.zoneTimerEl) return;

    const clampedSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(clampedSeconds / 60);
    const secs = clampedSeconds % 60;
    const timeLabel = mins > 0
      ? `${mins}:${String(secs).padStart(2, '0')}`
      : `${secs}s`;

    const alertColor = this.theme === 'tactical' ? '#ff3333' : '#ef4444';
    const normalColor = this.theme === 'tactical' ? '#00ff41' : '#22d3ee';

    if (clampedSeconds === 0) {
      this.zoneTimerEl.innerHTML = 'ZONE COLLAPSE';
      this.zoneTimerEl.style.color = alertColor;
      this.zoneTimerEl.style.textShadow = `0 0 10px rgba(${this.theme === 'tactical' ? '255, 51, 51' : '239, 68, 68'}, 0.9)`;
      this.zoneTimerEl.className = this.theme === 'tactical' ? 'zone-timer alert' : '';
      this.zoneTimerEl.style.animation = '';
      this.zoneTimerEl.classList.remove('zone-timer-critical');
      return;
    }

    if (clampedSeconds < 30) {
      this.zoneTimerEl.innerHTML = `SHRINKING: <span>${timeLabel}</span>`;
      this.zoneTimerEl.style.color = alertColor;
      this.zoneTimerEl.style.textShadow = `0 0 10px rgba(${this.theme === 'tactical' ? '255, 51, 51' : '239, 68, 68'}, 0.9)`;
      if (this.theme === 'tactical') {
        this.zoneTimerEl.className = 'zone-timer alert';
      } else {
        this.zoneTimerEl.style.animation = 'blink 1s ease-in-out infinite';
        this.zoneTimerEl.classList.add('zone-timer-critical');
      }
    } else {
      this.zoneTimerEl.innerHTML = `SAFE TIME: <span>${timeLabel}</span>`;
      this.zoneTimerEl.style.color = normalColor;
      this.zoneTimerEl.style.textShadow = `0 0 6px rgba(${this.theme === 'tactical' ? '0, 255, 65' : '34, 211, 238'}, 0.6)`;
      this.zoneTimerEl.className = 'zone-timer';
      this.zoneTimerEl.style.animation = '';
      this.zoneTimerEl.classList.remove('zone-timer-critical');
    }
  }

  /**
   * Update boost bar
   */
  updateBoost(percentage: number, isBoosting: boolean, isLow: boolean) {
    if (!this.boostBarFillEl) return;

    const boostIcon = document.getElementById('boost-icon');

    // Update width
    this.boostBarFillEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;

    // Update colors based on state
    if (isBoosting) {
      const boostGradient = this.theme === 'tactical'
        ? 'linear-gradient(90deg, #00ffff 0%, #00ff41 100%)'
        : 'linear-gradient(90deg, #00ff88 0%, #22d3ee 100%)';
      const boostColor = this.theme === 'tactical' ? '#00ffff' : '#00ff88';
      const glowColor = this.theme === 'tactical' ? '0, 255, 255' : '0, 255, 136';

      this.boostBarFillEl.style.background = boostGradient;
      if (this.theme === 'tactical') {
        this.boostBarFillEl.className = 'boosting';
      } else {
        this.boostBarFillEl.classList.remove('low-boost');
      }
      if (boostIcon) {
        boostIcon.style.color = boostColor;
        boostIcon.style.textShadow = `0 0 10px rgba(${glowColor}, 0.8)`;
      }
    } else if (isLow) {
      const lowGradient = this.theme === 'tactical'
        ? 'linear-gradient(90deg, #ff3333 0%, #ff6666 100%)'
        : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      const lowColor = this.theme === 'tactical' ? '#ff3333' : '#ef4444';
      const glowColor = this.theme === 'tactical' ? '255, 51, 51' : '239, 68, 68';

      this.boostBarFillEl.style.background = lowGradient;
      if (this.theme === 'tactical') {
        this.boostBarFillEl.className = 'low';
      } else {
        this.boostBarFillEl.classList.add('low-boost');
      }
      if (boostIcon) {
        boostIcon.style.color = lowColor;
        boostIcon.style.textShadow = `0 0 8px rgba(${glowColor}, 0.6)`;
      }
    } else {
      const normalGradient = this.theme === 'tactical'
        ? 'linear-gradient(90deg, #00d926 0%, #00ff41 100%)'
        : 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)';
      const normalColor = this.theme === 'tactical' ? '#00ff41' : '#22d3ee';
      const glowColor = this.theme === 'tactical' ? '0, 255, 65' : '34, 211, 238';

      this.boostBarFillEl.style.background = normalGradient;
      if (this.theme === 'tactical') {
        this.boostBarFillEl.className = '';
      } else {
        this.boostBarFillEl.classList.remove('low-boost');
      }
      if (boostIcon) {
        boostIcon.style.color = normalColor;
        boostIcon.style.textShadow = `0 0 8px rgba(${glowColor}, 0.6)`;
      }
    }
  }

  /**
   * Update alive count
   */
  updateAliveCount(count: number) {
    if (!this.aliveCountEl) return;

    const previousCount = parseInt(this.aliveCountEl.textContent || '0');
    this.aliveCountEl.textContent = `${count} ALIVE`;

    // Add pulse animation when count changes
    if (count !== previousCount && count > 0) {
      this.aliveCountEl.classList.remove('alive-count-update');
      void this.aliveCountEl.offsetWidth; // Trigger reflow
      this.aliveCountEl.classList.add('alive-count-update');
    }

    // Color based on count
    if (count <= 2) {
      const color = this.theme === 'tactical' ? '#ff3333' : '#ef4444';
      this.aliveCountEl.style.color = color;
      this.aliveCountEl.className = this.theme === 'tactical' ? 'alive-counter critical' : '';
    } else if (count <= 4) {
      const color = this.theme === 'tactical' ? '#ffaa00' : '#fbbf24';
      this.aliveCountEl.style.color = color;
      this.aliveCountEl.className = this.theme === 'tactical' ? 'alive-counter warning' : '';
    } else {
      const color = this.theme === 'tactical' ? '#00ff41' : '#10b981';
      this.aliveCountEl.style.color = color;
      this.aliveCountEl.className = 'alive-counter';
    }
  }

  /**
   * Update tactical-specific elements (speed, heading, etc.)
   */
  updateTacticalReadouts(speed: number, heading: number): void {
    if (this.theme !== 'tactical') return;

    // Update speed display
    const speedEl = document.getElementById('tactical-speed');
    if (speedEl) {
      speedEl.textContent = Math.round(speed).toString();
    }

    // Update heading display
    const headingEl = document.getElementById('tactical-heading');
    if (headingEl) {
      const degrees = Math.round((heading * 180) / Math.PI) % 360;
      const normalizedDegrees = degrees < 0 ? degrees + 360 : degrees;
      headingEl.textContent = String(normalizedDegrees).padStart(3, '0') + '°';
    }
  }

  /**
   * Show tactical alert banner
   */
  showTacticalAlert(message: string, duration: number = 3000): void {
    if (this.theme !== 'tactical') return;

    const alertEl = document.getElementById('tactical-alert');
    if (alertEl) {
      alertEl.textContent = message;
      alertEl.classList.add('active');

      setTimeout(() => {
        alertEl.classList.remove('active');
      }, duration);
    }
  }

  /**
   * Clear all HUD elements
   */
  clearHUD() {
    // Remove all old HUD elements
    const oldElements = [
      'unified-top-bar',
      'hud-scanline-overlay',
      'top-hud-bar',
      'game-zone-timer',
      'game-boost-bar',
      'game-boost-label',
      'game-boost-fill',
      'game-alive-counter',
      'round-indicator',
      'game-trail-status',
      'tactical-grid',
      'tactical-readout',
      'tactical-compass',
      'tactical-reticle',
      'tactical-alert',
      'tactical-scanlines'
    ];

    oldElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // Remove tactical corner elements
    this.tacticalElements.forEach(el => el.remove());
    this.tacticalElements = [];

    this.topBar = null;
    this.zoneTimerEl = null;
    this.boostBarFillEl = null;
    this.aliveCountEl = null;
  }

  /**
   * Destroy HUD
   */
  destroy() {
    this.clearHUD();

    // Remove tactical CSS if loaded
    const tacticalStyles = document.getElementById('tactical-hud-styles');
    if (tacticalStyles) {
      tacticalStyles.remove();
    }
    this.tacticalStylesLoaded = false;
  }
}

export default HudManager;
