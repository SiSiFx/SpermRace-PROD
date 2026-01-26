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

/**
 * Detect if the device is a high-performance mobile device capable of 60fps
 * Includes iPhone 12+ and Pixel 6+ series
 */
export function isHighPerformanceMobile(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const deviceMemory = (navigator as any).deviceMemory; // Chrome: device RAM in GB
  const hardwareConcurrency = navigator.hardwareConcurrency; // CPU cores

  // iPhone 12 and later (released in 2020, capable of 60fps)
  // Detection via iOS version and device type
  const isModerniPhone = /iPhone/.test(userAgent) &&
    (function() {
      // iOS 14+ (released with iPhone 12) supports modern rendering
      const match = userAgent.match(/OS (\d+)_(\d+)/);
      if (!match) return false;
      const major = parseInt(match[1], 10);
      return major >= 14; // iOS 14+ indicates iPhone 12 or newer
    })();

  // Pixel 6 and later (released with Android 12, Tensor SoC)
  const isPixel6OrLater = /Android/.test(userAgent) &&
    /Pixel (6|7|8|9|Fold)/.test(userAgent);

  // Generic high-end Android detection (device memory + CPU cores)
  // Devices with 6GB+ RAM and 6+ cores can typically handle 60fps
  const isHighEndAndroid = /Android/.test(userAgent) &&
    deviceMemory && deviceMemory >= 6 &&
    hardwareConcurrency && hardwareConcurrency >= 6;

  // Samsung Galaxy S21 and later
  const isHighEndSamsung = /Android/.test(userAgent) &&
    /SM-G99|SM-G9[89]|SM-S90|SM-S91/.test(userAgent);

  return isModerniPhone || isPixel6OrLater || isHighEndAndroid || isHighEndSamsung;
}

/**
 * Get performance tier for the device
 */
export function getPerformanceTier(): 'low' | 'medium' | 'high' {
  const deviceType = getDeviceType();

  // High-performance mobile devices get 'high' tier
  if ((deviceType === 'mobile' || deviceType === 'tablet') && isHighPerformanceMobile()) {
    return 'high';
  }

  if (deviceType === 'mobile') {
    return 'low';
  }

  if (deviceType === 'tablet') {
    return 'medium';
  }

  return 'high'; // Desktop
}

// Performance preferences based on device
export function getPerformanceSettings() {
  const tier = getPerformanceTier();

  if (tier === 'low') {
    return {
      maxParticles: 50,
      trailQuality: 'low' as const,
      shadowsEnabled: false,
      antiAliasing: false,
      targetFPS: 30,
      resolution: 1, // No resolution multiplier
      textureResolution: 'low' as const
    };
  }

  if (tier === 'medium') {
    return {
      maxParticles: 100,
      trailQuality: 'medium' as const,
      shadowsEnabled: false,
      antiAliasing: true,
      targetFPS: 45,
      resolution: 1.5,
      textureResolution: 'medium' as const
    };
  }

  // High tier (includes high-performance mobile like iPhone 12+, Pixel 6+)
  return {
    maxParticles: 200,
    trailQuality: 'high' as const,
    shadowsEnabled: true,
    antiAliasing: true,
    targetFPS: 60,
    resolution: 2, // Can handle 2x resolution
    textureResolution: 'high' as const
  };
}

