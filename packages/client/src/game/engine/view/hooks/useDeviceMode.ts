import { useEffect, useState } from 'react';

export function useDeviceMode(mobileWidth: number = 900): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const detect = () => {
      const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(coarse || window.innerWidth <= mobileWidth);
    };

    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, [mobileWidth]);

  return isMobile;
}
