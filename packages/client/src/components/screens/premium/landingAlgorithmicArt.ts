type ArtOptions = {
  seedKey: string;
  baseHex: string;
  accentHex: string;
  secondaryHex: string;
};

type Racer = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  speed: number;
  team: 0 | 1;
  lane: number;
  radius: number;
  phase: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: Rgb;
};

type Rgb = { r: number; g: number; b: number };

function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const n = Number.parseInt(value, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export function startLandingAlgorithmicArt(canvas: HTMLCanvasElement, options: ArtOptions): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};

  const seed = hashString(options.seedKey || 'spermrace-default');
  const random = mulberry32(seed);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  const baseColor = hexToRgb(options.baseHex);
  const accentColor = hexToRgb(options.accentHex);
  const secondaryColor = hexToRgb(options.secondaryHex);
  const hotColor = mix(accentColor, { r: 226, g: 235, b: 244 }, 0.12);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let lastTime = 0;
  let racers: Racer[] = [];
  let sparks: Spark[] = [];
  let sparkBudget = 0;
  let frameCount = 0;
  let centerX = 0;
  let centerY = 0;
  let arenaRadius = 0;
  const enableSparks = false;

  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const angleScale = 0.00125 + random() * 0.0008;
  const driftScale = 0.00016 + random() * 0.00012;

  const laneCount = isCoarsePointer ? 4 : 5;

  const makeRacer = (team: 0 | 1): Racer => {
    const lane = Math.floor(random() * laneCount);
    const laneBand = (lane + 0.5) / laneCount;
    const y = height * (0.18 + laneBand * 0.64);
    const x = team === 0 ? -8 - random() * 80 : width + 8 + random() * 80;
    const life = 210 + random() * 300;
    return {
      x,
      y,
      px: x,
      py: y,
      vx: (team === 0 ? 1 : -1) * (0.45 + random() * 0.58),
      vy: (random() - 0.5) * 0.18,
      life,
      maxLife: life,
      speed: 0.27 + random() * 0.33,
      team,
      lane,
      radius: 1.3 + random() * 1.1,
      phase: random() * Math.PI * 2,
    };
  };

  const resetRacer = (r: Racer, team?: 0 | 1) => {
    const replacement = makeRacer(team ?? r.team);
    r.team = replacement.team;
    r.lane = replacement.lane;
    r.radius = replacement.radius;
    r.phase = replacement.phase;
    r.x = replacement.x;
    r.y = replacement.y;
    r.px = replacement.px;
    r.py = replacement.py;
    r.vx = replacement.vx;
    r.vy = replacement.vy;
    r.life = replacement.life;
    r.maxLife = replacement.maxLife;
    r.speed = replacement.speed;
  };

  const makeSpark = (x: number, y: number, color: Rgb) => {
    const life = 6 + random() * 12;
    sparks.push({
      x,
      y,
      vx: (random() - 0.5) * 1.2,
      vy: (random() - 0.5) * 1.2,
      life,
      maxLife: life,
      color,
    });
    if (sparks.length > (isCoarsePointer ? 80 : 120)) {
      sparks.splice(0, sparks.length - (isCoarsePointer ? 80 : 120));
    }
  };

  const getFlowAngle = (x: number, y: number, t: number, team: 0 | 1): number => {
    const nx = x * angleScale + phaseA;
    const ny = y * angleScale + phaseB;
    const turbulence = Math.sin(nx + t * driftScale) * Math.cos(ny - t * driftScale * 0.8);
    const wave = Math.sin((nx * 0.68 + ny * 1.3) + t * driftScale * 0.6);
    const swirl = team === 0 ? 0.1 : -0.1;
    return (turbulence + wave * 0.65 + swirl) * Math.PI * 1.55;
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width * 0.5;
    centerY = height * 0.5;
    arenaRadius = Math.min(width, height) * 0.32;

    const area = width * height;
    const density = isCoarsePointer ? 1 / 21000 : 1 / 15000;
    const totalRacers = Math.max(isCoarsePointer ? 68 : 98, Math.min(isCoarsePointer ? 120 : 168, Math.floor(area * density)));
    const teamSize = Math.floor(totalRacers / 2);
    racers = [];
    for (let i = 0; i < teamSize; i += 1) racers.push(makeRacer(0));
    for (let i = 0; i < totalRacers - teamSize; i += 1) racers.push(makeRacer(1));
    sparks = [];
    frameCount = 0;

    context.clearRect(0, 0, width, height);
    context.fillStyle = rgba(baseColor, 0.94);
    context.fillRect(0, 0, width, height);
  };

  const drawArena = (time: number) => {
    const pulse = 0.5 + Math.sin(time * 0.0012) * 0.5;
    context.lineWidth = 1;
    context.strokeStyle = rgba(mix(accentColor, secondaryColor, 0.45), 0.1 + pulse * 0.05);
    context.beginPath();
    context.arc(centerX, centerY, arenaRadius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = rgba(mix(accentColor, secondaryColor, 0.2), 0.08 + pulse * 0.04);
    context.beginPath();
    context.arc(centerX, centerY, arenaRadius * 0.72, 0, Math.PI * 2);
    context.stroke();
  };

  const step = (time: number, dt: number) => {
    frameCount += 1;
    let fadeAlpha = prefersReducedMotion ? 0.42 : (isCoarsePointer ? 0.3 : 0.27);
    if (frameCount % 96 === 0) fadeAlpha += 0.18;
    context.fillStyle = rgba(baseColor, Math.min(0.58, fadeAlpha));
    context.fillRect(0, 0, width, height);
    drawArena(time);

    context.lineWidth = isCoarsePointer ? 0.8 : 1;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    sparkBudget = 0;

    for (let i = 0; i < racers.length; i += 1) {
      const r = racers[i];
      r.px = r.x;
      r.py = r.y;

      const angle = getFlowAngle(r.x, r.y, time, r.team);
      const targetX = r.team === 0 ? width * 0.78 : width * 0.22;
      const laneBand = (r.lane + 0.5) / laneCount;
      const laneYBase = height * (0.18 + laneBand * 0.64);
      const laneOsc = Math.sin(time * 0.0012 + r.phase) * 2.2;
      const targetY = laneYBase + laneOsc;
      const tx = targetX - r.x;
      const ty = targetY - r.y;
      const tLen = Math.hypot(tx, ty) || 1;
      const steerX = tx / tLen;
      const steerY = ty / tLen;

      const cx = r.x - centerX;
      const cy = r.y - centerY;
      const distToCenter = Math.hypot(cx, cy) || 1;
      const tangentX = -cy / distToCenter;
      const tangentY = cx / distToCenter;
      const swirlStrength = distToCenter < arenaRadius * 1.15 ? 0.07 : 0.025;
      const swirlSign = r.team === 0 ? 1 : -1;

      r.vx = r.vx * 0.86
        + Math.cos(angle) * r.speed * dt * 0.55
        + steerX * r.speed * dt * 0.65
        + tangentX * swirlStrength * swirlSign * dt;
      r.vy = r.vy * 0.86
        + Math.sin(angle) * r.speed * dt * 0.55
        + steerY * r.speed * dt * 0.5
        + tangentY * swirlStrength * swirlSign * dt;

      for (let j = i + 1; j < racers.length; j += 1) {
        const other = racers[j];
        if (other.team === r.team) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 625) continue;
        const d = Math.sqrt(d2) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const push = (24 - d) * 0.007;
        if (push > 0) {
          r.vx -= nx * push;
          r.vy -= ny * push;
          other.vx += nx * push;
          other.vy += ny * push;
        }
        if (enableSparks && d < 13 && sparkBudget < 1) {
          const sx = (r.x + other.x) * 0.5;
          const sy = (r.y + other.y) * 0.5;
          makeSpark(sx, sy, mix(accentColor, secondaryColor, random()));
          sparkBudget += 1;
        }
      }

      r.x += r.vx;
      r.y += r.vy;
      r.life -= dt * 1.05;

      if (r.life <= 0 || r.x < -42 || r.x > width + 42 || r.y < -28 || r.y > height + 28) {
        resetRacer(r);
        continue;
      }

      const lifeT = 1 - r.life / r.maxLife;
      const speedT = Math.min(1, (Math.abs(r.vx) + Math.abs(r.vy)) * 0.18);
      const teamBase = r.team === 0 ? accentColor : secondaryColor;
      const highlight = mix(teamBase, hotColor, 0.1 + speedT * 0.15);
      const trailColor = mix(highlight, baseColor, lifeT * 0.62);
      const alpha = 0.018 + speedT * 0.05;

      context.strokeStyle = rgba(trailColor, alpha);
      context.beginPath();
      context.moveTo(r.px, r.py);
      context.lineTo(r.x, r.y);
      context.stroke();

      const tailX = r.x - r.vx * 1.8;
      const tailY = r.y - r.vy * 1.8;
      context.strokeStyle = rgba(trailColor, alpha * 0.78);
      context.beginPath();
      context.moveTo(r.x, r.y);
      context.lineTo(tailX, tailY);
      context.stroke();

      context.fillStyle = rgba(highlight, 0.28);
      context.beginPath();
      context.arc(r.x, r.y, r.radius * 0.9, 0, Math.PI * 2);
      context.fill();
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= dt * 1.8;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
      const t = s.life / s.maxLife;
      context.fillStyle = rgba(s.color, 0.03 + t * 0.12);
      context.beginPath();
      context.arc(s.x, s.y, 0.5 + (1 - t) * 0.9, 0, Math.PI * 2);
      context.fill();
    }
  };

  const animate = (time: number) => {
    const deltaMs = lastTime ? time - lastTime : 16.667;
    const dt = Math.min(3, Math.max(0.6, deltaMs / 16.667));
    lastTime = time;
    step(time, dt);
    raf = window.requestAnimationFrame(animate);
  };

  resize();

  if (prefersReducedMotion) {
    for (let i = 0; i < 52; i += 1) {
      step(i * 16, 1);
    }
  } else {
    raf = window.requestAnimationFrame(animate);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  return () => {
    if (raf) {
      window.cancelAnimationFrame(raf);
    }
    window.removeEventListener('resize', onResize);
  };
}
