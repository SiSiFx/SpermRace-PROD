/**
 * HUD Manager - Tactical Bio-Cyberpunk Combat Interface
 * Single source of truth for all UI elements
 */

export class HudManager {
  private container: HTMLElement;
  private topBar: HTMLElement | null = null;
  private zoneTimerEl: HTMLElement | null = null;
  private boostBarFillEl: HTMLElement | null = null;
  private aliveCountEl: HTMLElement | null = null;
  private killFeedEl: HTMLElement | null = null;
  private performanceMetricsEl: HTMLElement | null = null;
  private minimapEl: HTMLElement | null = null;
  private warningSystemEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Create entire HUD from scratch
   */
  createHUD() {
    // Clear any existing HUD
    this.clearHUD();

    const isMobile = window.innerWidth <= 768;

    // Create unified top bar with tactical styling
    this.topBar = document.createElement('div');
    this.topBar.id = 'unified-top-bar';
    Object.assign(this.topBar.style, {
      position: 'absolute',
      top: 'calc(10px + env(safe-area-inset-top, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '8px' : '12px',
      background: 'linear-gradient(135deg, rgba(5, 5, 8, 0.95) 0%, rgba(10, 10, 15, 0.9) 50%, rgba(5, 5, 8, 0.95) 100%)',
      padding: isMobile ? '6px 12px' : '10px 20px',
      borderRadius: '24px',
      border: '1px solid rgba(57, 255, 20, 0.3)',
      zIndex: '100',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 30px rgba(57, 255, 20, 0.15), inset 0 1px 0 rgba(57, 255, 20, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.5)',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: '700',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    });

    // Add tactical corner brackets
    this.addCornerBrackets(this.topBar);

    // Zone timer section
    const zoneSection = document.createElement('div');
    Object.assign(zoneSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    });

    this.zoneTimerEl = document.createElement('div');
    this.zoneTimerEl.textContent = 'TIME 1:30';
    Object.assign(this.zoneTimerEl.style, {
      color: '#22d3ee',
      whiteSpace: 'nowrap'
    });
    zoneSection.appendChild(this.zoneTimerEl);

    this.topBar.appendChild(zoneSection);

    // Separator
    const separator1 = this.createSeparator();
    this.topBar.appendChild(separator1);

    // Boost section
    const boostSection = document.createElement('div');
    Object.assign(boostSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    });

    const boostIcon = document.createElement('div');
    boostIcon.id = 'boost-icon';
    boostIcon.textContent = 'BOOST';
    Object.assign(boostIcon.style, {
      fontSize: isMobile ? '14px' : '16px',
      color: '#22d3ee'
    });
    boostSection.appendChild(boostIcon);

    const boostBarContainer = document.createElement('div');
    Object.assign(boostBarContainer.style, {
      width: isMobile ? '60px' : '100px',
      height: '6px',
      background: 'rgba(34, 211, 238, 0.15)',
      borderRadius: '3px',
      overflow: 'hidden',
      position: 'relative'
    });

    this.boostBarFillEl = document.createElement('div');
    this.boostBarFillEl.id = 'boost-bar-fill';
    Object.assign(this.boostBarFillEl.style, {
      height: '100%',
      width: '100%',
      background: 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)',
      borderRadius: '3px',
      transition: 'width 0.1s ease-out, background 0.2s ease',
      boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)'
    });
    boostBarContainer.appendChild(this.boostBarFillEl);
    boostSection.appendChild(boostBarContainer);

    this.topBar.appendChild(boostSection);

    // Separator
    const separator2 = this.createSeparator();
    this.topBar.appendChild(separator2);

    // Alive count section
    const aliveSection = document.createElement('div');
    Object.assign(aliveSection.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    });

    this.aliveCountEl = document.createElement('div');
    this.aliveCountEl.textContent = '8 ALIVE';
    Object.assign(this.aliveCountEl.style, {
      color: '#10b981',
      whiteSpace: 'nowrap'
    });
    aliveSection.appendChild(this.aliveCountEl);

    this.topBar.appendChild(aliveSection);

    // Add to container
    this.container.appendChild(this.topBar);
  }

  /**
   * Create visual separator
   */
  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      width: '1px',
      height: '16px',
      background: 'rgba(255, 255, 255, 0.15)'
    });
    return sep;
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

    if (clampedSeconds === 0) {
      this.zoneTimerEl.innerHTML = 'ZONE COLLAPSE';
      this.zoneTimerEl.style.color = '#ef4444';
      this.zoneTimerEl.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.9)';
      this.zoneTimerEl.style.animation = '';
      return;
    }

    if (clampedSeconds < 30) {
      this.zoneTimerEl.innerHTML = `SHRINKING: <span>${timeLabel}</span>`;
      this.zoneTimerEl.style.color = '#ef4444';
      this.zoneTimerEl.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.9)';
      this.zoneTimerEl.style.animation = 'blink 1s ease-in-out infinite';
    } else {
      this.zoneTimerEl.innerHTML = `SAFE TIME: <span>${timeLabel}</span>`;
      this.zoneTimerEl.style.color = '#22d3ee';
      this.zoneTimerEl.style.textShadow = '0 0 6px rgba(34, 211, 238, 0.6)';
      this.zoneTimerEl.style.animation = '';
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
      this.boostBarFillEl.style.background = 'linear-gradient(90deg, #00ff88 0%, #22d3ee 100%)';
      if (boostIcon) {
        boostIcon.style.color = '#00ff88';
        boostIcon.style.textShadow = '0 0 10px rgba(0, 255, 136, 0.8)';
      }
    } else if (isLow) {
      this.boostBarFillEl.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      if (boostIcon) {
        boostIcon.style.color = '#ef4444';
        boostIcon.style.textShadow = '0 0 8px rgba(239, 68, 68, 0.6)';
      }
    } else {
      this.boostBarFillEl.style.background = 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)';
      if (boostIcon) {
        boostIcon.style.color = '#22d3ee';
        boostIcon.style.textShadow = '0 0 8px rgba(34, 211, 238, 0.6)';
      }
    }
  }

  /**
   * Update alive count
   */
  updateAliveCount(count: number) {
    if (!this.aliveCountEl) return;

    this.aliveCountEl.textContent = `${count} ALIVE`;

    // Color based on count
    if (count <= 2) {
      this.aliveCountEl.style.color = '#ef4444'; // Red
    } else if (count <= 4) {
      this.aliveCountEl.style.color = '#fbbf24'; // Yellow
    } else {
      this.aliveCountEl.style.color = '#10b981'; // Green
    }
  }

  /**
   * Clear all HUD elements
   */
  clearHUD() {
    // Remove all old HUD elements
    const oldElements = [
      'unified-top-bar',
      'top-hud-bar',
      'game-zone-timer',
      'game-boost-bar',
      'game-boost-label',
      'game-boost-fill',
      'game-alive-counter',
      'round-indicator',
      'game-trail-status'
    ];

    oldElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

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
  }
}

export default HudManager;
