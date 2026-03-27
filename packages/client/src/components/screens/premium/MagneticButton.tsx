'use client';

import { useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type MagneticButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
};

const springConfig = { stiffness: 140, damping: 18, mass: 0.35 };

export function MagneticButton({
  children,
  className,
  onPointerLeave,
  onPointerMove,
  type = 'button',
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const element = buttonRef.current;

    if (element) {
      const rect = element.getBoundingClientRect();
      const offsetX = event.clientX - (rect.left + rect.width / 2);
      const offsetY = event.clientY - (rect.top + rect.height / 2);

      x.set((offsetX / rect.width) * 16);
      y.set((offsetY / rect.height) * 12);
    }

    onPointerMove?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    x.set(0);
    y.set(0);
    onPointerLeave?.(event);
  };

  return (
    <motion.button
      {...props}
      ref={buttonRef}
      type={type}
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
    >
      {children}
    </motion.button>
  );
}
