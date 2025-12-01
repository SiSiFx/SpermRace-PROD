import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedCounter({ 
  value, 
  duration = 1200, 
  decimals = 0,
  suffix = '',
  className,
  style 
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();
  
  useEffect(() => {
    // Reset and start animation when value changes
    startTimeRef.current = undefined;
    setDisplayValue(0);
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const current = value * easeOutQuart;
      setDisplayValue(current);
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);
  
  const formatted = decimals > 0 
    ? displayValue.toFixed(decimals)
    : Math.floor(displayValue).toString();
  
  return (
    <span className={className} style={style}>
      {formatted}{suffix}
    </span>
  );
}

export default AnimatedCounter;
