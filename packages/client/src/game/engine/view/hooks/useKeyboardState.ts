import { useEffect, useRef } from 'react';

export function useKeyboardState(): React.MutableRefObject<Set<string>> {
  const keyStateRef = useRef(new Set<string>());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keyStateRef.current.add(e.key.toLowerCase());
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keyStateRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return keyStateRef;
}
