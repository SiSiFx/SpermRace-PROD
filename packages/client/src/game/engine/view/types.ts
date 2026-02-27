export interface GameStats {
  placement: number;
  kills: number;
  duration: number;
  distance: number;
}

export type TouchState = {
  moveTouchId: number | null;
  boostTouchId: number | null;
  moveOrigin: { x: number; y: number };
};

export type ViewStatus = 'playing' | 'dead' | 'won';

export type ViewSnapshot = {
  aliveCount: number;
  kills: number;
  boostPct: number;
  elapsed: number;
  status: ViewStatus;
  placement: number;
  killer: string | null;
};
