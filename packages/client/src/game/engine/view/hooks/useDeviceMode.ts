import { useEffect, useState } from 'react';

function detectMobile(mobileWidth: number): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse || window.innerWidth <= mobileWidth;
}

export function useDeviceMode(mobileWidth: number = 900): boolean {
  // Lazy initializer: detects correctly on the very first render (no flash of wrong value)
  const [isMobile, setIsMobile] = useState(() => detectMobile(mobileWidth));

  useEffect(() => {
    const detect = () => setIsMobile(detectMobile(mobileWidth));
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, [mobileWidth]);

  return isMobile;
}
