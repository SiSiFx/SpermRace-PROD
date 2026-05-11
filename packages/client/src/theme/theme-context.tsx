/**
 * Theme context stub
 */
import { createContext, useContext, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeClasses() {
  return {
    theme: 'dark' as ThemeMode,
    bg: 'bg-dark',
    text: 'text-white',
    border: 'border-gray-700',
    card: 'bg-gray-900',
    button: 'bg-cyan-500',
  };
}

export default ThemeContext;
