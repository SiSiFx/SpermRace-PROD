import type { Vec2 } from './types';

export const WORLD_DESKTOP: Vec2 = { x: 5200, y: 4200 };
export const WORLD_MOBILE: Vec2 = { x: 3400, y: 5200 };

export const PLAYER_BASE_SPEED = 300;
export const BOOST_MULTIPLIER = 1.55;

export const TRAIL_MAX_POINTS = 220;
export const TRAIL_MIN_POINTS = 60;
export const TRAIL_GROW_RATE = 40; // points per second when boosting
export const TRAIL_SHRINK_RATE = 15; // points per second when not boosting

export const ZONE_DELAY_SECONDS = 18;
export const ZONE_SHRINK_PER_SEC = 13;
export const ZONE_DAMAGE_DELAY = 1.25;
