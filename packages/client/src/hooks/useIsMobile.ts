/**
 * useIsMobile hook
 * Reactive mobile detection with resize handling
 */

import { useState, useEffect } from 'react';
import { isMobileDevice } from '../deviceDetection';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
}
