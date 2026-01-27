import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'panic' | 'attack';

type BotPersonality = 'aggressive' | 'cautious' | 'balanced';

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
}

interface BotPersonalityTraits {
  reactionTime: number;        // Delay before responding (seconds)
  aimError: number;            // Angular error in radians
  boostFrequency: number;      // How often they boost (0-1)
  riskTolerance: number;       // Willingness to take risks (0-1)
  inconsistency: number;       // How often they make mistakes (0-1)
  panicThreshold: number;      // Distance at which they panic (pixels)
  aggressionDistance: number;  // Distance to engage enemies (pixels)
  predictionSkill: number;     // Accuracy of movement prediction (0-1)
}

interface PredictedPosition {
  x: number;
  y: number;
  confidence: number;          // How confident the prediction is (0-1)
  timeToIntercept: number;     // Estimated seconds to reach target
}

/**
 * BotController drives a PlayerEntity using an enhanced state machine with human-like behaviors:
 * SEARCH (Gather DNA)
 * HUNT (Chase player from distance)
 * ATTACK (Strategic cut-off maneuvers)
 * PANIC (Evade walls and trails)
 *
 * Each bot has a personality that affects their decision-making, reaction times,
 * and tendency to make mistakes - making them feel more like human players.
 */
export class BotController {
  public readonly id: string;
  public readonly player: PlayerEntity;

  private state: BotState = 'search';
  private aimAngle: number;
  private panicTimer: number = 0;

  // Human-like behavior properties
  private personality: BotPersonality;
  private traits: BotPersonalityTraits;
  private reactionTimer: number = 0;
  private stateChangeTimer: number = 0;
  private lastTargetUpdate: number = 0;
  private currentTarget: { x: number; y: number } | null = null;
  private microAdjustmentTimer: number = 0;
  private mistakeTimer: number = 0;
  private hesitationChance: number = 0;
  private targetPredictionHistory: PredictedPosition[] = [];
  private lastPredictionUpdate: number = 0;

  constructor(player: PlayerEntity) {
    this.player = player;
    this.id = player.id;
    this.aimAngle = player.sperm.angle;

    // Assign a random personality to this bot
    this.personality = this.randomPersonality();
    this.traits = this.getPersonalityTraits(this.personality);

    // Randomize initial reaction timer
    this.reactionTimer = Math.random() * this.traits.reactionTime;
  }

  update(deltaTime: number, sense: BotSense): void {
    if (!this.player.isAlive) return;

    const self = this.player;
    const pos = self.sperm.position;

    // Update reaction timer (human reaction delay)
    this.reactionTimer = Math.max(0, this.reactionTimer - deltaTime);
    this.microAdjustmentTimer = Math.max(0, this.microAdjustmentTimer - deltaTime);
    this.mistakeTimer = Math.max(0, this.mistakeTimer - deltaTime);
    this.stateChangeTimer = Math.max(0, this.stateChangeTimer - deltaTime);

    // Decrement panic timer
    this.panicTimer = Math.max(0, this.panicTimer - deltaTime);

    const enemies = sense.players.filter(p => p.isAlive && p.id !== self.id);
    const nearestEnemy = this.findNearestEnemy(enemies);
    const nearestDNA = this.findNearestDNA(sense.items, pos);

    const panicDetected = this.detectPanic(sense, deltaTime);

    // STATE TRANSITION LOGIC with human-like delays and personality
    if (panicDetected && this.stateChangeTimer <= 0) {
      if (this.state !== 'panic') {
        // Add reaction delay before panicking
        this.reactionTimer = this.traits.reactionTime * (0.5 + Math.random() * 0.5);
      }
      this.state = 'panic';
      this.panicTimer = Math.max(this.panicTimer, 0.8);
      this.stateChangeTimer = 0.3;
    } else if (this.panicTimer <= 0 && this.stateChangeTimer <= 0) {
      if (nearestEnemy) {
        // Personality affects engagement distance
        const engageDist = this.traits.aggressionDistance;
        if (nearestEnemy.dist < 180) {
          if (this.state !== 'attack' || Math.random() < this.traits.inconsistency * 0.3) {
            this.state = 'attack';
            this.stateChangeTimer = 0.2 + Math.random() * 0.3;
          }
        } else if (nearestEnemy.dist < engageDist) {
          if (this.state !== 'hunt' || Math.random() < this.traits.inconsistency * 0.2) {
            this.state = 'hunt';
            this.stateChangeTimer = 0.3 + Math.random() * 0.4;
          }
        } else {
          if (this.state !== 'search' || Math.random() < this.traits.inconsistency * 0.1) {
            this.state = 'search';
            this.stateChangeTimer = 0.5;
          }
        }
      } else {
        if (this.state !== 'search') {
          this.state = 'search';
          this.stateChangeTimer = 0.5;
        }
      }
    }

    // Build input based on current state
    let input: PlayerInput = {
      target: { ...self.input.target },
      accelerate: true,
      boost: false,
      drift: false,
    };

    switch (this.state) {
      case 'panic':
        input = this.buildPanicInput(pos, sense);
        break;
      case 'attack':
        input = this.buildAttackInput(pos, nearestEnemy, sense);
        break;
      case 'hunt':
        input = this.buildHuntInput(pos, nearestEnemy, sense);
        break;
      case 'search':
      default:
        input = this.buildSearchInput(pos, nearestDNA, sense);
        break;
    }

    // Apply human-like behaviors if reaction timer has elapsed
    if (this.reactionTimer <= 0) {
      // Add aiming error based on personality
      const aimError = (Math.random() - 0.5) * 2 * this.traits.aimError;

      // Calculate desired angle with aim error
      const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x) + aimError;
      let diff = desiredAngle - this.aimAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Add micro-adjustments (human-like jitter)
      if (this.microAdjustmentTimer <= 0) {
        const microAdjust = (Math.random() - 0.5) * 0.1;
        diff += microAdjust;
        this.microAdjustmentTimer = 0.1 + Math.random() * 0.15;
      }

      // In panic mode, allow faster turning for emergency evasion
      const maxTurnRate = this.state === 'panic' ? Math.PI * 4.0 : Math.PI * 2.2;
      const turnVariation = this.state === 'panic' ? 0 : (0.95 + Math.random() * 0.1);
      const maxTurn = maxTurnRate * turnVariation * deltaTime;
      const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.aimAngle += clamped;

      // Occasional mistakes (hesitation, over-steering, etc.)
      if (this.mistakeTimer <= 0 && Math.random() < this.traits.inconsistency * 0.1) {
        this.mistakeTimer = 0.5 + Math.random() * 1.0;
        // Make a mistake: over-steer or hesitate
        if (Math.random() < 0.5) {
          // Over-steer
          this.aimAngle += (Math.random() - 0.5) * 0.3;
        } else {
          // Hesitate (will be handled below)
          this.hesitationChance = 0.7;
        }
      }

      const aimDistance = 1000;
      this.currentTarget = {
        x: pos.x + Math.cos(this.aimAngle) * aimDistance,
        y: pos.y + Math.sin(this.aimAngle) * aimDistance,
      };
    }

    // Apply current target (maintain last known target if still reacting)
    if (this.currentTarget) {
      input.target = { ...this.currentTarget };
    }

    // Apply hesitation (humans sometimes delay actions)
    if (this.hesitationChance > 0 && Math.random() < this.hesitationChance) {
      input.boost = false;
      this.hesitationChance = 0;
    }

    // Modify boost behavior based on personality
    if (input.boost) {
      // Personality affects boost decision
      if (Math.random() > this.traits.boostFrequency) {
        input.boost = false;
      }
      // Risk-tolerant bots boost more in dangerous situations
      if (this.state === 'attack' && this.traits.riskTolerance < 0.3 && Math.random() < 0.3) {
        input.boost = false;
      }
    }

    this.player.setInput(input);

    // Boost activation with personality-based timing
    if (input.boost && this.player.canLunge(40)) {
      // Cautious bots hesitate before boosting
      const hesitation = this.personality === 'cautious' ? Math.random() < 0.2 : false;
      if (!hesitation) {
        this.player.tryActivateBoost();
      }
    }
  }

  private findNearestDNA(items: GameItem[], pos: { x: number; y: number }) {
    let best = null;
    for (const item of items) {
      if (item.type !== 'dna') continue;
      const d = Math.hypot(item.x - pos.x, item.y - pos.y);
      if (!best || d < best.dist) best = { item, dist: d };
    }
    return best;
  }

  private findNearestEnemy(players: PlayerEntity[]) {
    let best = null;
    const selfPos = this.player.sperm.position;
    for (const p of players) {
      const d = Math.hypot(p.sperm.position.x - selfPos.x, p.sperm.position.y - selfPos.y);
      if (!best || d < best.dist) best = { player: p, dist: d };
    }
    return best;
  }

  /**
   * Calculates the intercept point for predictive aiming.
   * Solves the intercept problem: given bot position, bot speed, target position, and target velocity,
   * find where the bot should aim to intercept the target.
   *
   * Uses quadratic formula to solve for time to intercept:
   * |botPos + botSpeed * t * aimDir| = |targetPos + targetVel * t - botPos|
   *
   * @param botPos Bot's current position
   * @param botSpeed Bot's current speed magnitude
   * @param targetPos Target's current position
   * @param targetVel Target's velocity vector
   * @returns Predicted intercept position, or null if intercept is impossible
   */
  private calculateInterceptPoint(
    botPos: { x: number; y: number },
    botSpeed: number,
    targetPos: { x: number; y: number },
    targetVel: { x: number; y: number }
  ): { x: number; y: number } | null {
    // If target is stationary or very slow, aim directly at them
    const targetSpeed = Math.hypot(targetVel.x, targetVel.y);
    if (targetSpeed < 1) {
      return targetPos;
    }

    // If bot is much slower than target, interception may be impossible
    if (botSpeed < targetSpeed * 0.5) {
      // Still attempt prediction but with limited lead
      const leadTime = Math.min(2.0, Math.hypot(targetPos.x - botPos.x, targetPos.y - botPos.y) / botSpeed);
      return {
        x: targetPos.x + targetVel.x * leadTime,
        y: targetPos.y + targetVel.y * leadTime,
      };
    }

    // Vector from bot to target
    const dx = targetPos.x - botPos.x;
    const dy = targetPos.y - botPos.y;
    const distToTarget = Math.hypot(dx, dy);

    // Relative velocity components
    // We want to find t such that: botSpeed * t = distance to intercept point
    // The intercept point moves with target velocity
    // This gives us a quadratic equation: at² + bt + c = 0

    const targetSpeedSq = targetSpeed * targetSpeed;
    const botSpeedSq = botSpeed * botSpeed;

    // Coefficients for quadratic formula
    // a = botSpeed² - targetSpeed²
    const a = botSpeedSq - targetSpeedSq;

    // b = -2 * (dx * targetVel.x + dy * targetVel.y)
    const b = -2 * (dx * targetVel.x + dy * targetVel.y);

    // c = dx² + dy² = distToTarget²
    const c = distToTarget * distToTarget;

    let t: number;

    if (Math.abs(a) < 0.001) {
      // botSpeed ≈ targetSpeed, linear case
      if (Math.abs(b) < 0.001) {
        return targetPos; // Both stationary
      }
      t = -c / b;
    } else {
      // Quadratic case
      const discriminant = b * b - 4 * a * c;

      if (discriminant < 0) {
        // No real solution - target too fast or wrong angle
        // Fall back to leading the target
        const leadTime = Math.min(1.5, distToTarget / botSpeed);
        return {
          x: targetPos.x + targetVel.x * leadTime,
          y: targetPos.y + targetVel.y * leadTime,
        };
      }

      // Two possible solutions - we want the smallest positive time
      const sqrtDisc = Math.sqrt(discriminant);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);

      // Choose smallest positive time
      if (t1 > 0.1 && t2 > 0.1) {
        t = Math.min(t1, t2);
      } else if (t1 > 0.1) {
        t = t1;
      } else if (t2 > 0.1) {
        t = t2;
      } else {
        // Both solutions negative or too small, use minimum positive
        t = Math.max(t1, t2);
      }

      // Clamp intercept time to reasonable bounds
      t = Math.max(0.1, Math.min(3.0, t));
    }

    // Calculate intercept point
    return {
      x: targetPos.x + targetVel.x * t,
      y: targetPos.y + targetVel.y * t,
    };
  }

  private buildSearchInput(pos: { x: number; y: number }, nearestDNA: any, sense: BotSense): PlayerInput {
    // Personality affects search behavior
    let targetX, targetY;

    if (nearestDNA) {
      targetX = nearestDNA.item.x;
      targetY = nearestDNA.item.y;
    } else {
      // Different personalities patrol differently when no items
      if (this.personality === 'aggressive') {
        // Aggressive bots patrol edges looking for action
        const edgeOffset = 200;
        targetX = pos.x < sense.worldWidth / 2 ? sense.worldWidth - edgeOffset : edgeOffset;
        targetY = pos.y < sense.worldHeight / 2 ? sense.worldHeight - edgeOffset : edgeOffset;
      } else if (this.personality === 'cautious') {
        // Cautious bots stay near center
        targetX = sense.worldWidth / 2 + (Math.random() - 0.5) * 400;
        targetY = sense.worldHeight / 2 + (Math.random() - 0.5) * 400;
      } else {
        // Balanced bots wander randomly
        targetX = sense.worldWidth / 2;
        targetY = sense.worldHeight / 2;
      }
    }

    return {
      target: { x: targetX, y: targetY },
      accelerate: true,
      boost: false,
      drift: false,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;

    // Calculate bot's current speed for intercept calculation
    const botSpeed = Math.hypot(this.player.sperm.velocity.x, this.player.sperm.velocity.y);
    const effectiveBotSpeed = Math.max(botSpeed, 200); // Assume minimum speed for prediction

    // Use predictive interception to calculate target point
    const interceptPoint = this.calculateInterceptPoint(
      pos,
      effectiveBotSpeed,
      target.sperm.position,
      target.sperm.velocity
    );

    let predictedX: number;
    let predictedY: number;

    if (interceptPoint) {
      // Personality affects prediction accuracy around intercept point
      const accuracy = this.personality === 'cautious' ? 0.95 :
                       this.personality === 'aggressive' ? 0.85 : 0.9;

      // Add personality-based prediction error
      const error = (1 - accuracy) * nearestEnemy.dist;

      // Add slight randomness to make prediction imperfect
      const jitter = (Math.random() - 0.5) * error * 0.5;

      predictedX = interceptPoint.x + jitter;
      predictedY = interceptPoint.y + jitter;
    } else {
      // Fallback to simple lead prediction if intercept calculation fails
      const leadTime = this.personality === 'aggressive' ? 1.2 : 0.8;
      predictedX = target.sperm.position.x + target.sperm.velocity.x * leadTime;
      predictedY = target.sperm.position.y + target.sperm.velocity.y * leadTime;
    }

    // Personality affects boost usage during hunt
    const shouldBoost = nearestEnemy.dist < 350 && Math.random() < this.traits.boostFrequency * 0.4;

    return {
      target: {
        x: predictedX,
        y: predictedY
      },
      accelerate: true,
      boost: shouldBoost,
      drift: false,
    };
  }

  private buildAttackInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;

    // Calculate intercept point for predictive attack
    const botSpeed = Math.hypot(this.player.sperm.velocity.x, this.player.sperm.velocity.y);
    const effectiveBotSpeed = Math.max(botSpeed, 250); // Assume faster speed during attacks

    const interceptPoint = this.calculateInterceptPoint(
      pos,
      effectiveBotSpeed,
      target.sperm.position,
      target.sperm.velocity
    );

    // Calculate angle to intercept point (or current position if intercept failed)
    const targetPos = interceptPoint || target.sperm.position;
    const angleToIntercept = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x);

    // Calculate target's direction of movement
    const targetSpeed = Math.hypot(target.sperm.velocity.x, target.sperm.velocity.y);
    let targetAngle = 0;
    if (targetSpeed > 1) {
      targetAngle = Math.atan2(target.sperm.velocity.y, target.sperm.velocity.x);
    }

    // Determine optimal cut-off angle based on intercept prediction
    // Aim to cut across the target's predicted path
    const angleDifference = this.normalizeAngle(targetAngle - angleToIntercept);

    let cutOffAngle: number;
    if (this.personality === 'aggressive') {
      // More aggressive cut-offs - aim further ahead on intercept path
      // If target is moving right-to-left relative to us, cut them off
      const offset = angleDifference > 0 ? 0.8 : -0.8;
      cutOffAngle = angleToIntercept + offset;
    } else if (this.personality === 'cautious') {
      // More conservative - aim closer to intercept point
      const offset = angleDifference > 0 ? 0.4 : -0.4;
      cutOffAngle = angleToIntercept + offset;
    } else {
      // Balanced approach
      const offset = angleDifference > 0 ? 0.6 : -0.6;
      cutOffAngle = angleToIntercept + offset;
    }

    // Add some randomness to make it less predictable
    cutOffAngle += (Math.random() - 0.5) * 0.15;

    const attackDistance = this.personality === 'aggressive' ? 700 : 600;

    return {
      target: {
        x: pos.x + Math.cos(cutOffAngle) * attackDistance,
        y: pos.y + Math.sin(cutOffAngle) * attackDistance
      },
      accelerate: true,
      boost: true,
      drift: false,
    };
  }

  /**
   * Normalizes an angle to the range [-PI, PI]
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private buildPanicInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    // Find the safest evasion direction using multi-directional sampling
    const safeAngle = this.findSafeEvasionDirection(pos, sense);

    // Calculate target point at a safe distance in the chosen direction
    const targetDistance = 600;
    const target = {
      x: pos.x + Math.cos(safeAngle) * targetDistance,
      y: pos.y + Math.sin(safeAngle) * targetDistance,
    };

    // Personality affects panic behavior - aggressive might boost-escape
    const shouldBoost = this.personality === 'aggressive' && Math.random() < 0.5;

    return {
      target,
      accelerate: true,
      boost: shouldBoost,
      drift: true,  // Use drift for tighter turning
    };
  }

  /**
   * Enhanced panic detection using multi-ray casting.
   * Checks multiple directions at multiple distances to detect trail collisions early.
   * Returns true if any of the probe rays detect danger within safety margins.
   */
  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;
    const currentAngle = self.sperm.angle;

    // Wall detection - check if we're heading toward walls
    // Personality affects wall buffer
    const wallBuffer = this.personality === 'cautious' ? 100 : 80;
    const lookAheadDistances = [250, 400];
    for (const lookAhead of lookAheadDistances) {
      const probeX = pos.x + Math.cos(currentAngle) * lookAhead;
      const probeY = pos.y + Math.sin(currentAngle) * lookAhead;
      if (probeX < wallBuffer || probeY < wallBuffer ||
          probeX > sense.worldWidth - wallBuffer ||
          probeY > sense.worldHeight - wallBuffer) {
        // Risk-tolerant bots might ignore wall danger if chasing
        if (this.traits.riskTolerance > 0.6 && this.state === 'attack' && Math.random() < 0.4) {
          continue;
        }
        return true;
      }
    }

    // Multi-ray trail detection
    // Cast rays in multiple directions to detect trails early
    const rayAngles = [-0.4, -0.25, -0.1, 0, 0.1, 0.25, 0.4]; // More rays, wider spread
    const rayDistances = [120, 200, 280, 360]; // More distance checks
    // Personality affects danger radius
    const dangerRadius = this.personality === 'cautious' ? 80 : 70;

    for (const angleOffset of rayAngles) {
      const rayAngle = currentAngle + angleOffset;
      for (const distance of rayDistances) {
        const probeX = pos.x + Math.cos(rayAngle) * distance;
        const probeY = pos.y + Math.sin(rayAngle) * distance;

        // Check if this probe point is near any trail
        if (this.isPointNearTrail(probeX, probeY, dangerRadius, sense)) {
          // Risk-tolerant bots might ignore trail danger if attacking
          if (this.traits.riskTolerance > 0.7 && this.state === 'attack' && Math.random() < 0.3) {
            continue;
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a given point is near any trail in the game.
   * Used by panic detection and evasion pathfinding.
   */
  private isPointNearTrail(
    x: number,
    y: number,
    radius: number,
    sense: BotSense
  ): boolean {
    const self = this.player;
    const radiusSq = radius * radius;

    for (const p of sense.players) {
      if (!p.isAlive || p.id === self.id) continue;
      for (const point of p.trail) {
        const dx = point.x - x;
        const dy = point.y - y;
        if (dx * dx + dy * dy < radiusSq) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Finds the safest direction to evade when in panic mode.
   * Samples multiple directions and scores them based on trail density.
   * Returns the angle (in radians) representing the safest escape route.
   */
  private findSafeEvasionDirection(pos: { x: number; y: number }, sense: BotSense): number {
    const self = this.player;
    const currentAngle = self.sperm.angle;

    // Sample directions: spread across -120 to +120 degrees from current heading
    const directions: Array<{ angle: number; score: number }> = [];
    const numSamples = 24; // More samples = better evasion
    const maxAngleOffset = Math.PI * 0.67; // 120 degrees

    for (let i = 0; i < numSamples; i++) {
      const offset = -maxAngleOffset + (2 * maxAngleOffset * i) / (numSamples - 1);
      const angle = currentAngle + offset;

      // Score this direction by checking for trails at multiple distances
      let score = 0;
      const checkDistances = [120, 200, 280, 360, 440];
      // Personality affects danger radius during evasion
      const dangerRadius = this.personality === 'cautious' ? 80 : 75;

      for (const dist of checkDistances) {
        const probeX = pos.x + Math.cos(angle) * dist;
        const probeY = pos.y + Math.sin(angle) * dist;

        // Penalty for being near trails (exponential penalty for closer dangers)
        if (this.isPointNearTrail(probeX, probeY, dangerRadius, sense)) {
          // Much higher penalty for closer dangers
          const penalty = (600 - dist) * 1.5; // Stronger penalties
          score -= penalty;
        } else {
          // Bonus for clear path (increases with distance)
          score += 15;
        }

        // Stronger penalty for heading toward walls
        // Personality affects wall margin
        const wallMargin = this.personality === 'cautious' ? 140 : 120;
        if (probeX < wallMargin || probeY < wallMargin ||
            probeX > sense.worldWidth - wallMargin ||
            probeY > sense.worldHeight - wallMargin) {
          score -= 300; // Increased wall penalty
        }
      }

      // Small bonus for maintaining general direction (prevents erratic behavior)
      const angleDiff = Math.abs(offset);
      score -= angleDiff * 30;

      directions.push({ angle, score });
    }

    // Sort by score (highest first) and return the best direction
    directions.sort((a, b) => b.score - a.score);
    return directions[0].angle;
  }

  /**
   * Advanced predictive movement: Calculates where to aim to intercept a moving target.
   * Uses iterative solving to account for:
   * - Target's current velocity and potential acceleration
   * - Bot's own speed and turn rate limitations
   * - Time to intercept decreases as target gets closer
   *
   * @param selfPos Bot's current position
   * @param targetPos Target's current position
   * @param targetVel Target's current velocity vector
   * @param distance Current distance to target
   * @returns Predicted interception point with confidence and time estimate
   */
  private predictInterceptionPosition(
    selfPos: { x: number; y: number },
    targetPos: { x: number; y: number },
    targetVel: { x: number; y: number },
    distance: number
  ): PredictedPosition {
    const selfSpeed = this.player.sperm.velocity
      ? Math.hypot(this.player.sperm.velocity.x, this.player.sperm.velocity.y)
      : 200; // Current speed or default
    const maxSpeed = 480; // Max speed from constants

    // Estimate target's intent based on their velocity
    const targetSpeed = Math.hypot(targetVel.x, targetVel.y);
    const targetHeading = Math.atan2(targetVel.y, targetVel.x);

    // Use personality-based prediction skill
    // Higher predictionSkill = more accurate lead calculation
    const skillFactor = this.traits.predictionSkill;

    // Calculate initial time to intercept estimate
    // This is iterative: we estimate where they'll be, calculate time to reach that point,
    // then refine our prediction based on that time
    let predictedX = targetPos.x;
    let predictedY = targetPos.y;
    let timeToIntercept = distance / Math.max(selfSpeed, 100);

    // Refine prediction through multiple iterations (converges on optimal intercept point)
    const iterations = Math.floor(2 + skillFactor * 3); // 2-5 iterations based on skill
    for (let i = 0; i < iterations; i++) {
      // Predict where target will be after timeToIntercept seconds
      // Account for potential direction changes (less accurate at longer distances)
      const uncertainty = Math.min(1, timeToIntercept * 0.2); // Increases with time

      // Predict target position considering their current velocity
      // More skillful bots predict tighter turns and less drift
      const turnPredictability = skillFactor * 0.8;
      predictedX = targetPos.x + targetVel.x * timeToIntercept * turnPredictability;
      predictedY = targetPos.y + targetVel.y * timeToIntercept * turnPredictability;

      // Add some target trajectory prediction based on typical player behavior
      // Players tend to drift in curves, not straight lines
      if (targetSpeed > 50 && i > 0) {
        // Estimate curvature based on typical turn rates
        const curveAmount = timeToIntercept * 0.3 * (1 - skillFactor * 0.5);
        predictedX += Math.cos(targetHeading + Math.PI / 2) * curveAmount * targetSpeed * 0.1;
        predictedY += Math.sin(targetHeading + Math.PI / 2) * curveAmount * targetSpeed * 0.1;
      }

      // Recalculate time to reach this predicted position
      const newDistance = Math.hypot(predictedX - selfPos.x, predictedY - selfPos.y);
      const avgSpeed = (selfSpeed + maxSpeed) / 2;
      timeToIntercept = newDistance / Math.max(avgSpeed, 100);
    }

    // Adjust prediction based on target's likely reactions
    // Smart bots consider that targets will try to evade
    if (skillFactor > 0.6) {
      // Predict target will try to cut away - aim slightly ahead of their current path
      const evasionLead = skillFactor * 0.15; // 0-0.15 radians lead
      const leadDistance = timeToIntercept * maxSpeed * 0.3;
      predictedX += Math.cos(targetHeading + evasionLead) * leadDistance;
      predictedY += Math.sin(targetHeading + evasionLead) * leadDistance;
    }

    // Calculate confidence in prediction
    // Higher confidence when: target is closer, target is moving predictably, bot has high skill
    let confidence = skillFactor;
    confidence *= Math.min(1, 300 / (distance + 1)); // Higher confidence when closer
    confidence *= Math.min(1, targetSpeed / 200 + 0.5); // Lower confidence for very slow/stationary targets

    // Personality affects confidence calibration
    if (this.personality === 'aggressive') {
      confidence *= 1.1; // Overconfident
    } else if (this.personality === 'cautious') {
      confidence *= 0.85; // Underconfident
    }

    return {
      x: predictedX,
      y: predictedY,
      confidence: Math.max(0.1, Math.min(0.95, confidence)),
      timeToIntercept,
    };
  }

  /**
   * Predicts where a target's trail will be positioned after a given time.
   * Used for cutting off targets and predicting escape routes.
   *
   * @param targetPos Target's current position
   * @param targetVel Target's current velocity
   * @param timeAhead Seconds to predict into the future
   * @returns Predicted trail position
   */
  private predictTrailPosition(
    targetPos: { x: number; y: number },
    targetVel: { x: number; y: number },
    timeAhead: number
  ): { x: number; y: number } {
    // Trail lags behind the player
    const trailLag = 0.15; // 150ms delay
    const effectiveTime = Math.max(0, timeAhead - trailLag);

    return {
      x: targetPos.x + targetVel.x * effectiveTime,
      y: targetPos.y + targetVel.y * effectiveTime,
    };
  }

  /**
   * Advanced attack mode with predictive cut-off maneuvers.
   * Calculates interception points to cut off the target's path.
   */
  private buildPredictiveAttackInput(
    pos: { x: number; y: number },
    nearestEnemy: any,
    sense: BotSense
  ): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;

    // Predict where target will be and where their trail will be
    const interceptPrediction = this.predictInterceptionPosition(
      pos,
      target.sperm.position,
      target.sperm.velocity,
      nearestEnemy.dist
    );

    // Calculate cut-off angle based on predicted intercept point
    const angleToIntercept = Math.atan2(
      interceptPrediction.y - pos.y,
      interceptPrediction.x - pos.x
    );

    // Personality affects cut-off aggressiveness
    let cutOffAngle;
    const baseCutOff = Math.PI / 4; // 45 degrees base

    if (this.personality === 'aggressive') {
      // More aggressive cut-offs (aim further ahead, riskier)
      cutOffAngle = angleToIntercept + (Math.random() > 0.5 ? baseCutOff * 1.5 : -baseCutOff * 1.5);
    } else if (this.personality === 'cautious') {
      // More conservative cut-offs
      cutOffAngle = angleToIntercept + (Math.random() > 0.5 ? baseCutOff * 0.6 : -baseCutOff * 0.6);
    } else {
      // Balanced approach
      cutOffAngle = angleToIntercept + (Math.random() > 0.5 ? baseCutOff : -baseCutOff);
    }

    // Add randomness based on inconsistency
    cutOffAngle += (Math.random() - 0.5) * this.traits.inconsistency * 0.5;

    // Attack distance based on personality and prediction confidence
    const attackDistance = (this.personality === 'aggressive' ? 700 : 600) * interceptPrediction.confidence;

    return {
      target: {
        x: pos.x + Math.cos(cutOffAngle) * attackDistance,
        y: pos.y + Math.sin(cutOffAngle) * attackDistance
      },
      accelerate: true,
      boost: interceptPrediction.confidence > 0.5, // Boost when confident
      drift: false,
    };
  }

  private randomPersonality(): BotPersonality {
    const rand = Math.random();
    if (rand < 0.33) return 'aggressive';
    if (rand < 0.66) return 'cautious';
    return 'balanced';
  }

  private getPersonalityTraits(personality: BotPersonality): BotPersonalityTraits {
    switch (personality) {
      case 'aggressive':
        return {
          reactionTime: 0.15 + Math.random() * 0.1,     // Fast reactions
          aimError: 0.08 + Math.random() * 0.05,         // Less accurate (rushing)
          boostFrequency: 0.85 + Math.random() * 0.15,   // Boosts often
          riskTolerance: 0.75 + Math.random() * 0.2,     // High risk tolerance
          inconsistency: 0.4 + Math.random() * 0.2,      // Somewhat inconsistent
          panicThreshold: 120,                            // Panics later
          aggressionDistance: 700,                       // Engages from further
          predictionSkill: 0.55 + Math.random() * 0.15,  // Moderate prediction (overcommits)
        };

      case 'cautious':
        return {
          reactionTime: 0.25 + Math.random() * 0.15,     // Slower reactions
          aimError: 0.03 + Math.random() * 0.02,         // More accurate
          boostFrequency: 0.4 + Math.random() * 0.2,     // Boosts rarely
          riskTolerance: 0.15 + Math.random() * 0.15,    // Low risk tolerance
          inconsistency: 0.2 + Math.random() * 0.15,     // More consistent
          panicThreshold: 180,                            // Panics earlier
          aggressionDistance: 500,                       // Engages from closer
          predictionSkill: 0.75 + Math.random() * 0.15,  // Good prediction (careful calculation)
        };

      case 'balanced':
      default:
        return {
          reactionTime: 0.2 + Math.random() * 0.1,      // Average reactions
          aimError: 0.05 + Math.random() * 0.04,        // Average accuracy
          boostFrequency: 0.6 + Math.random() * 0.2,    // Moderate boosting
          riskTolerance: 0.45 + Math.random() * 0.2,    // Moderate risk
          inconsistency: 0.3 + Math.random() * 0.2,     // Average inconsistency
          panicThreshold: 150,                           // Average panic distance
          aggressionDistance: 600,                       // Average engagement
          predictionSkill: 0.65 + Math.random() * 0.2,  // Above average prediction
        };
    }
  }
}