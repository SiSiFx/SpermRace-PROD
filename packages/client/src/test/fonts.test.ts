/**
 * Font Implementation Tests
 * Tests for verifying Orbitron and Inter font implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Font Implementation', () => {
  // Store original DOM methods
  let originalGetComputedStyle: typeof window.getComputedStyle;

  beforeEach(() => {
    originalGetComputedStyle = window.getComputedStyle;
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
  });

  describe('Google Fonts Loading', () => {
    it('should have Google Fonts link in document head', () => {
      const googleFontsLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('fonts.googleapis.com'));

      expect(googleFontsLinks.length).toBeGreaterThan(0);
    });

    it('should have Orbitron font in Google Fonts URL', () => {
      const googleFontsLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('fonts.googleapis.com'));

      const hasOrbitron = googleFontsLinks.some(link => link.href.includes('Orbitron'));
      expect(hasOrbitron).toBe(true);
    });

    it('should have Inter font in Google Fonts URL', () => {
      const googleFontsLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('fonts.googleapis.com'));

      const hasInter = googleFontsLinks.some(link => link.href.includes('Inter'));
      expect(hasInter).toBe(true);
    });
  });

  describe('Header Fonts (Orbitron)', () => {
    it('should apply Orbitron font to h1 elements', () => {
      const h1 = document.createElement('h1');
      document.body.appendChild(h1);

      const styles = window.getComputedStyle(h1);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(h1);
    });

    it('should apply Orbitron font to h2 elements', () => {
      const h2 = document.createElement('h2');
      document.body.appendChild(h2);

      const styles = window.getComputedStyle(h2);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(h2);
    });

    it('should apply Orbitron font to h3 elements', () => {
      const h3 = document.createElement('h3');
      document.body.appendChild(h3);

      const styles = window.getComputedStyle(h3);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(h3);
    });

    it('should apply Orbitron font to .brand-title class', () => {
      const brandTitle = document.createElement('div');
      brandTitle.className = 'brand-title';
      document.body.appendChild(brandTitle);

      const styles = window.getComputedStyle(brandTitle);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(brandTitle);
    });

    it('should apply Orbitron font to .modal-title class', () => {
      const modalTitle = document.createElement('div');
      modalTitle.className = 'modal-title';
      document.body.appendChild(modalTitle);

      const styles = window.getComputedStyle(modalTitle);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(modalTitle);
    });

    it('should apply Orbitron font to .lobby-title class', () => {
      const lobbyTitle = document.createElement('div');
      lobbyTitle.className = 'lobby-title';
      document.body.appendChild(lobbyTitle);

      const styles = window.getComputedStyle(lobbyTitle);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(lobbyTitle);
    });

    it('should apply Orbitron font to .tournament-title class', () => {
      const tournamentTitle = document.createElement('div');
      tournamentTitle.className = 'tournament-title';
      document.body.appendChild(tournamentTitle);

      const styles = window.getComputedStyle(tournamentTitle);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(tournamentTitle);
    });

    it('should apply Orbitron font to .mode-title class', () => {
      const modeTitle = document.createElement('div');
      modeTitle.className = 'mode-title';
      document.body.appendChild(modeTitle);

      const styles = window.getComputedStyle(modeTitle);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Orbitron');

      document.body.removeChild(modeTitle);
    });
  });

  describe('UI Fonts (Inter)', () => {
    it('should apply Inter font to body element', () => {
      const styles = window.getComputedStyle(document.body);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');
    });

    it('should apply Inter font to paragraph elements', () => {
      const p = document.createElement('p');
      document.body.appendChild(p);

      const styles = window.getComputedStyle(p);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(p);
    });

    it('should apply Inter font to button elements', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);

      const styles = window.getComputedStyle(button);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(button);
    });

    it('should apply Inter font to .feature-chip class', () => {
      const featureChip = document.createElement('div');
      featureChip.className = 'feature-chip';
      document.body.appendChild(featureChip);

      const styles = window.getComputedStyle(featureChip);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(featureChip);
    });

    it('should apply Inter font to .footer-link class', () => {
      const footerLink = document.createElement('a');
      footerLink.className = 'footer-link';
      document.body.appendChild(footerLink);

      const styles = window.getComputedStyle(footerLink);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(footerLink);
    });

    it('should apply Inter font to .mode-description class', () => {
      const modeDescription = document.createElement('div');
      modeDescription.className = 'mode-description';
      document.body.appendChild(modeDescription);

      const styles = window.getComputedStyle(modeDescription);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(modeDescription);
    });

    it('should apply Inter font to .stat-label class', () => {
      const statLabel = document.createElement('div');
      statLabel.className = 'stat-label';
      document.body.appendChild(statLabel);

      const styles = window.getComputedStyle(statLabel);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(statLabel);
    });

    it('should apply Inter font to .detail-label class', () => {
      const detailLabel = document.createElement('div');
      detailLabel.className = 'detail-label';
      document.body.appendChild(detailLabel);

      const styles = window.getComputedStyle(detailLabel);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(detailLabel);
    });

    it('should apply Inter font to .rules-list class', () => {
      const rulesList = document.createElement('ul');
      rulesList.className = 'rules-list';
      document.body.appendChild(rulesList);

      const styles = window.getComputedStyle(rulesList);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toContain('Inter');

      document.body.removeChild(rulesList);
    });
  });

  describe('Font Fallbacks', () => {
    it('should have system font fallback for Inter', () => {
      const styles = window.getComputedStyle(document.body);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toMatch(/Inter.*system-ui|Inter.*-apple-system|Inter.*BlinkMacSystemFont/);
    });

    it('should have sans-serif fallback for Orbitron', () => {
      const h1 = document.createElement('h1');
      document.body.appendChild(h1);

      const styles = window.getComputedStyle(h1);
      const fontFamily = styles.fontFamily;

      expect(fontFamily).toMatch(/Orbitron.*sans-serif/);

      document.body.removeChild(h1);
    });
  });

  describe('Font Weights', () => {
    it('should have bold weight for h1 elements', () => {
      const h1 = document.createElement('h1');
      document.body.appendChild(h1);

      const styles = window.getComputedStyle(h1);
      const fontWeight = styles.fontWeight;

      expect(fontWeight).toMatch(/[7-9]00|bold/);

      document.body.removeChild(h1);
    });

    it('should have appropriate font weights loaded for Inter', () => {
      const googleFontsLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('fonts.googleapis.com'));

      const interLink = googleFontsLinks.find(link => link.href.includes('Inter'));

      expect(interLink).toBeDefined();

      // Check for common weight values (400, 500, 600, 700)
      if (interLink) {
        const url = interLink.href;
        expect(url).toMatch(/wght@(\d+;)*\d+/);
      }
    });

    it('should have appropriate font weights loaded for Orbitron', () => {
      const googleFontsLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes('fonts.googleapis.com'));

      const orbitronLink = googleFontsLinks.find(link => link.href.includes('Orbitron'));

      expect(orbitronLink).toBeDefined();

      // Check for common weight values (500, 600, 700, 800, 900)
      if (orbitronLink) {
        const url = orbitronLink.href;
        expect(url).toMatch(/wght@(\d+;)*\d+/);
      }
    });
  });
});
