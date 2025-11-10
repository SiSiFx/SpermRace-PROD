/**
 * Device Detection Utility
 * Determines if the user is on a mobile device or desktop
 */

export function isMobileDevice(): boolean {
  // Check if window is available (SSR compatibility)
  if (typeof window === 'undefined') {
    return false;
  }

  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Mobile device patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Check if matches mobile pattern
  if (mobileRegex.test(userAgent)) {
    return true;
  }

  // Check for touch capability (secondary check)
  const hasTouchScreen = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );

  // Check screen size (tertiary check)
  const isSmallScreen = window.innerWidth <= 768;

  // Return true if touch-capable AND small screen
  // (to avoid detecting tablets and touch-screen laptops as mobile)
  return hasTouchScreen && isSmallScreen;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const width = window.innerWidth;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const tabletRegex = /iPad|Android(?!.*Mobile)/i;

  // Definite mobile phones
  if (mobileRegex.test(userAgent) && width <= 768) {
    return 'mobile';
  }

  // Tablets (iPads, Android tablets)
  if (tabletRegex.test(userAgent) || (width > 768 && width <= 1024)) {
    return 'tablet';
  }

  // Desktop
  return 'desktop';
}

export function isPortrait(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.innerHeight > window.innerWidth;
}

export function isLandscape(): boolean {
  return !isPortrait();
}

export function getScreenSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1920, height: 1080 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

// Listen for orientation changes
export function onOrientationChange(callback: (isPortrait: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => {
    callback(isPortrait());
  };

  window.addEventListener('orientationchange', handler);
  window.addEventListener('resize', handler);

  return () => {
    window.removeEventListener('orientationchange', handler);
    window.removeEventListener('resize', handler);
  };
}

// Performance preferences based on device
export function getPerformanceSettings() {
  const deviceType = getDeviceType();
  
  if (deviceType === 'mobile') {
    return {
      maxParticles: 50,
      trailQuality: 'low',
      shadowsEnabled: false,
      antiAliasing: false,
      targetFPS: 30
    };
  }
  
  if (deviceType === 'tablet') {
    return {
      maxParticles: 100,
      trailQuality: 'medium',
      shadowsEnabled: false,
      antiAliasing: true,
      targetFPS: 45
    };
  }
  
  // Desktop
  return {
    maxParticles: 200,
    trailQuality: 'high',
    shadowsEnabled: true,
    antiAliasing: true,
    targetFPS: 60
  };
}

