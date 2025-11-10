export declare const WORLD: {
    WIDTH: number;
    HEIGHT: number;
    ARENA_SHRINK_START_S: number;
    ARENA_SHRINK_DURATION_S: number;
};
export declare const PHYSICS: {
    ACCELERATION: number;
    LONGITUDINAL_DRAG: number;
    LATERAL_DRAG: number;
    TURN_SPEED: number;
    MAX_SPEED: number;
    SPEED_TURN_SCALE: number;
    MAX_TURN_RATE_RAD_PER_S: number;
    LOW_SPEED_TURN_BONUS: number;
};
export declare const TRAIL: {
    BASE_LIFETIME_MS: number;
    FINAL_CIRCLE_LIFETIME_MS: number;
    EMIT_INTERVAL_MS: number;
    FADE_OUT_DURATION_MS: number;
};
export declare const COLLISION: {
    GRID_CELL_SIZE: number;
    SPERM_COLLISION_RADIUS: number;
    TRAIL_COLLISION_RADIUS: number;
    SELF_IGNORE_RECENT_MS: number;
    SPAWN_SELF_COLLISION_GRACE_MS: number;
    POST_BOUNCE_GRACE_MS: number;
};
export declare const TICK: {
    RATE: number;
    INTERVAL_MS: number;
};
