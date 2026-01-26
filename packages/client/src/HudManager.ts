/**
 * HUD Manager - Clean, unified HUD system
 * Single source of truth for all UI elements with perfect scaling
 */

import { getMobileControlsScale, responsiveFontSize, getSafeAreaInsets } from './uiScalingUtils';

export class HudManager {
  private container: HTMLElement;
  private topBar: HTMLElement | null = null;
  private zoneTimerEl: HTMLElement | null = null;
  private boostBarFillEl: HTMLElement | null = null;
  private aliveCountEl: HTMLElement | null = null;
  private currentScale: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentScale = getMobileControlsScale();
  }

  /**
   * Get responsive padding based on viewport
   */
  private getResponsivePadding(): { vertical: string; horizontal: string; gap: string } {
    const width = window.innerWidth;
    if (width <= 374) {
      return { vertical: '6px', horizontal: '10px', gap: '6px' };
    } else if (width <= 767) {
      return { vertical: '6px', horizontal: '12px', gap: '8px' };
    } else {
      return { vertical: '10px', horizontal: '20px', gap: '12px' };
    }
  }

  /**
   * Create entire HUD from scratch
   */
  createHUD() {
    // Clear any existing HUD
    this.clearHUD();

    const isMobile = window.innerWidth <= 768;
    const padding = this.getResponsivePadding();

    // Create unified top bar with responsive sizing
    this.topBar = document.createElement('div');
    this.topBar.id = 'unified-top-bar';
    Object.assign(this.topBar.style, {
      position: 'absolute',
      top: `calc(10px + ${getSafeAreaInsets().top})`,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: padding.gap,
      background: 'rgba(0, 0, 0, 0.85)',
      padding: `${padding.vertical} ${padding.horizontal}`,
      borderRadius: '24px',
      border: '1px solid rgba(0, 255, 255, 0.2)',
      zIndex: '100',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: '700',
      color: '#ffffff',
      // Ensure minimum touch target size
      minHeight: isMobile ? '36px' : '44px',
      minWidth: 'min-content',
    });

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
      width: isMobile ? 'clamp(50px, 12vw, 60px)' : 'clamp(80px, 8vw, 100px)',
      height: '6px',
      minHeight: '6px',
      background: 'rgba(34, 211, 238, 0.15)',
      borderRadius: '3px',
      overflow: 'hidden',
      position: 'relative',
      // Ensure minimum touch target
      minWidth: '44px',
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
