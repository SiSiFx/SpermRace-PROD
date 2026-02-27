import type { MutableRefObject } from 'react';
import type { Game } from '../Game';

type MouseRef = MutableRefObject<{ x: number; y: number; active: boolean }>;
type GameRef = MutableRefObject<Game | null>;

export function installAutomationHooks(host: HTMLDivElement, gameRef: GameRef, mouseRef: MouseRef): () => void {
  const w = window as any;
  const previousRenderToText = w.render_game_to_text;
  const previousAdvanceTime = w.advanceTime;

  const canvas = host.querySelector('canvas') as HTMLCanvasElement | null;
  const onMouseMove = (e: MouseEvent) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  };

  if (canvas) {
    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
  }

  // Deterministic automation/debug hooks used by the game test harness.
  w.render_game_to_text = () => {
    const active = gameRef.current;
    if (!active) {
      return JSON.stringify({ mode: 'ecs_pixi', status: 'unavailable' });
    }
    return active.getTextSnapshot(12);
  };

  w.advanceTime = async (ms: number) => {
    const active = gameRef.current;
    if (!active) return;
    active.advanceTime(Number.isFinite(ms) ? ms : 1000 / 60);
  };

  return () => {
    if (canvas) {
      canvas.removeEventListener('mousemove', onMouseMove);
    }
    w.render_game_to_text = previousRenderToText;
    w.advanceTime = previousAdvanceTime;
  };
}
