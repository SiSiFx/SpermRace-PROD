/**
 * CRTEffect - Toggleable CRT overlay
 * Scanlines, vignette, and optional chromatic aberration
 */

import { useEffect, useState } from 'react';
import './CRTEffect.css';

export interface CRTEffectProps {
  /** Whether CRT effect is enabled */
  enabled?: boolean;
  /** Strength of scanline effect (0-1) */
  scanlineStrength?: number;
  /** Strength of vignette (0-1) */
  vignetteStrength?: number;
  /** Enable chromatic aberration on text */
  chromaticAberration?: boolean;
  /** Enable screen flicker */
  flicker?: boolean;
}

export function CRTEffect({
  enabled = true,
  scanlineStrength = 0.06,
  vignetteStrength = 0.3,
  chromaticAberration = true,
  flicker = false,
}: CRTEffectProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  useEffect(() => {
    setIsEnabled(enabled);

    // Apply CSS custom properties for dynamic values
    const root = document.documentElement;
    root.style.setProperty('--scanline-opacity', String(scanlineStrength));
    root.style.setProperty('--vignette-strength', String(vignetteStrength));

    if (enabled) {
      document.body.classList.add('crt-enabled');
      if (flicker) {
        document.body.classList.add('crt-flicker');
      } else {
        document.body.classList.remove('crt-flicker');
      }
    } else {
      document.body.classList.remove('crt-enabled', 'crt-flicker');
    }

    return () => {
      document.body.classList.remove('crt-enabled', 'crt-flicker');
    };
  }, [enabled, scanlineStrength, vignetteStrength, flicker]);

  if (!isEnabled) return null;

  return (
    <>
      {/* Scanlines overlay */}
      <div className="crt-scanlines" aria-hidden="true" />

      {/* Vignette overlay */}
      <div className="crt-vignette" aria-hidden="true" />

      {/* Optional chromatic aberration effect wrapper */}
      {chromaticAberration && <div className="crt-chromatic" aria-hidden="true" />}
    </>
  );
}

/**
 * Hook to toggle CRT effect
 */
export function useCRT() {
  const [enabled, setEnabled] = useState(true);

  const toggle = () => setEnabled(prev => !prev);

  useEffect(() => {
    const saved = localStorage.getItem('pixel-crt-enabled');
    if (saved !== null) {
      setEnabled(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pixel-crt-enabled', String(enabled));
  }, [enabled]);

  return { enabled, toggle };
}
