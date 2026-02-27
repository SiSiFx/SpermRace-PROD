import { timeToClock } from './math';
import type { ViewSnapshot } from './types';

export function createInitialSnapshot(botCount: number): ViewSnapshot {
  return {
    aliveCount: botCount + 1,
    kills: 0,
    boostPct: 100,
    elapsed: 0,
    status: 'playing',
    placement: 0,
    killer: null,
  };
}

export function getViewSummary(snapshot: ViewSnapshot): { statusText: string; timeText: string } {
  const statusText =
    snapshot.status === 'playing'
      ? 'SURVIVE'
      : snapshot.status === 'won'
        ? 'VICTORY'
        : 'ELIMINATED';

  return {
    statusText,
    timeText: timeToClock(snapshot.elapsed),
  };
}
