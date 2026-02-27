/**
 * GameViewWrapper.tsx
 * Uses ECS game engine
 *
 * All game logic is in src/game/engine/
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { getFeatureFlags } from '../config/featureFlags';
import { NewGameViewECS } from '../game/engine/NewGameViewECS';

export interface GameViewWrapperProps {
  /** Override player ID for testing */
  meIdOverride?: string;

  /** Called when replay is requested */
  onReplay?: () => void;

  /** Called when exit is requested */
  onExit?: () => void;
}

/**
 * Wrapper component for the ECS game engine
 * Memoized to prevent unnecessary re-renders during gameplay
 */
export const GameViewWrapper = memo(function GameViewWrapperComponent({
  meIdOverride,
  onReplay,
  onExit,
}: GameViewWrapperProps) {
  const flagsRef = useRef(getFeatureFlags());
  const [gameError, setGameError] = useState<string | null>(null);

  // Re-check feature flags on mount (in case they changed)
  useEffect(() => {
    try {
      flagsRef.current = getFeatureFlags();
    } catch (error) {
      console.error('[GameViewWrapper] Failed to get feature flags:', error);
    }
  }, []);

  const handleGameEnd = useCallback((_stats: any) => {
    try {
      // Keep the player inside the in-game end overlay (replay/exit).
      // Auto-exiting here causes abrupt returns to menu and breaks game-first flow.
    } catch (error) {
      console.error('[GameViewWrapper] Error in onGameEnd callback:', error);
    }
  }, []);

  const handlePlayerDeath = useCallback((killer: string | null) => {
    try {
      // player death handled internally by NewGameViewECS
    } catch (error) {
      console.error('[GameViewWrapper] Error in onPlayerDeath callback:', error);
    }
  }, []);

  // Handle game errors
  const handleError = useCallback((error: Error) => {
    console.error('[GameViewWrapper] Game error:', error);
    setGameError(error.message || 'An error occurred in the game');
  }, []);

  if (gameError) {
    return (
      <div className="screen active" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <h2 style={{ color: '#ef4444' }}>Game Error</h2>
        <p>{gameError}</p>
        <button
          onClick={() => { setGameError(null); onExit?.(); }}
          style={{
            padding: '10px 20px',
            background: '#22d3ee',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Return to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="screen active" style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
    }}>
      <NewGameViewECS
        playerName={meIdOverride || 'Player'}
        playerColor={0x22d3ee}
        botCount={9}
        enableAbilities={flagsRef.current.enableAbilities}
        onGameEnd={handleGameEnd}
        onPlayerDeath={handlePlayerDeath}
        onError={handleError}
        onExit={onExit}
      />
    </div>
  );
});

export default GameViewWrapper;
