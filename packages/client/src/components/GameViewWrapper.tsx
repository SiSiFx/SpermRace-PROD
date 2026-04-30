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
  mode: 'practice' | 'tournament';

  /** Called when exit is requested */
  onExit?: () => void;

  /** Called when game ends with stats (death or win) */
  onGameEnd?: (stats: any) => void;

  /** Called when player wins practice and clicks "Play Real" */
  onPlayReal?: () => void;
  /** Prize label shown on the "play for real" upsell CTA */
  playRealPrize?: string;
}

/**
 * Wrapper component for the ECS game engine
 * Memoized to prevent unnecessary re-renders during gameplay
 */
export const GameViewWrapper = memo(function GameViewWrapperComponent({
  mode,
  onExit,
  onGameEnd,
  onPlayReal,
  playRealPrize,
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

  const handleGameEnd = useCallback((stats: any) => {
    try {
      onGameEnd?.(stats);
    } catch (error) {
      console.error('[GameViewWrapper] Error in onGameEnd callback:', error);
    }
  }, [onGameEnd]);

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
    }}>
      <NewGameViewECS
        playerName="Player"
        playerColor={0x22d3ee}
        botCount={9}
        enableAbilities={flagsRef.current.enableAbilities}
        mode={mode}
        onGameEnd={handleGameEnd}
        onError={handleError}
        onExit={onExit}
        onPlayReal={onPlayReal}
        playRealPrize={playRealPrize}
      />
    </div>
  );
});

export default GameViewWrapper;
