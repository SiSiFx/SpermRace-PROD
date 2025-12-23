// Animated sperm background for landing page
let animationFrame: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let sperms: Sperm[] = [];
let mouseX = 0;
let mouseY = 0;

interface Sperm {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  tailLength: number;
  wiggleOffset: number;
  wiggleSpeed: number;
  angle: number; // Direction angle
  turnSpeed: number; // How fast it turns
  turnTimer: number; // Timer for direction changes
}

export function startSpermBackground(): void {
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.style.opacity = '0.9';
  canvas.style.cursor = 'pointer';

  const container = document.getElementById('bg-particles');
  if (container) {
    container.appendChild(canvas);
  } else {
    document.body.appendChild(canvas);
  }

  ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Mouse interaction
  const handleMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };

  const handleClick = (e: MouseEvent) => {
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Find sperms near click and make them flee
    sperms.forEach(sperm => {
      const dx = sperm.x - clickX;
      const dy = sperm.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        // Flee away from click
        const fleeAngle = Math.atan2(dy, dx);
        sperm.angle = fleeAngle;
        sperm.vx = Math.cos(fleeAngle) * 5;
        sperm.vy = Math.sin(fleeAngle) * 5;

        // Reset to normal direction after 1.5 seconds
        setTimeout(() => {
          sperm.angle = (Math.random() - 0.5) * 0.4;
          sperm.turnTimer = 0;
        }, 1500);
      }
    });
  };

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);

  // Touch support for mobile
  const handleTouch = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      mouseX = touch.clientX;
      mouseY = touch.clientY;
    }
  };

  const handleTap = (e: TouchEvent) => {
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      // Simulate click for tap
      sperms.forEach(sperm => {
        const dx = sperm.x - touch.clientX;
        const dy = sperm.y - touch.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          sperm.vy += (dy / dist) * 3;
          sperm.vx += 2;
        }
      });
    }
  };

  canvas.addEventListener('touchmove', handleTouch, { passive: true });
  canvas.addEventListener('touchend', handleTap, { passive: true });

  // Create sperms with staggered start positions
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 5 : 12; // Reduced count -> better perf
  for (let i = 0; i < count; i++) {
    const sperm = createSperm();
    // Mobile: smaller, slower sperm
    if (isMobile) {
      sperm.size *= 0.7; // Smaller
      sperm.tailLength *= 0.7;
      sperm.vx *= 0.7;
    }
    // Stagger initial positions across screen
    sperm.x = -80 - (Math.random() * window.innerWidth * 0.5);
    sperms.push(sperm);
  }

  // Start animation
  animate();
}

export function stopSpermBackground(): void {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }

  canvas = null;
  ctx = null;
  sperms = [];

  window.removeEventListener('resize', resizeCanvas);
}

function resizeCanvas(): void {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createSperm(): Sperm {
  const size = Math.random() * 3 + 5;
  const angle = (Math.random() - 0.5) * 0.8;
  const speed = Math.random() * 1.5 + 2.0;
  return {
    x: -80,
    y: Math.random() * window.innerHeight,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    opacity: Math.random() * 0.3 + 0.5,
    tailLength: size * 15,
    wiggleOffset: Math.random() * Math.PI * 2,
    wiggleSpeed: Math.random() * 0.08 + 0.05,
    angle,
    turnSpeed: Math.random() * 0.03 + 0.01,
    turnTimer: Math.random() * 3,
  };
}

function drawSperm(sperm: Sperm, time: number): void {
  if (!ctx) return;

  const { x, y, size, opacity, tailLength, wiggleOffset, wiggleSpeed } = sperm;
  const waveSpeed = 6 + wiggleSpeed * 10;
  const isMobile = window.innerWidth < 768;

  ctx.save();
  ctx.globalAlpha = opacity;

  const segments = isMobile ? 8 : 16; // Reduced segments -> factor of 2x speedup
  const amplitude = size * 2.0;
  const headX = x;
  const headY = y;

  // NO SHADOWS - Shadows are the #1 cause of perf issues on mobile canvas
  // We simulate glow with semi-transparent strokes in multiple passes instead if needed,
  // but for raw speed we keep it simple.

  // Draw tail 
  // Mobile: 1 pass. Desktop: 2 passes (removed 3rd pass).
  const passes = isMobile ? 1 : 2;

  for (let pass = 0; pass < passes; pass++) {
    ctx.beginPath();
    ctx.moveTo(headX - size * 1.1, headY);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const dist = tailLength * t;
      const px = headX - size * 1.1 - dist;
      const wave = Math.sin((t * Math.PI * 4) - (time * waveSpeed) + wiggleOffset) * amplitude * (1 - t);
      const py = headY + wave;

      if (i === 1) {
        ctx.lineTo(px, py);
      } else {
        const prevT = (i - 1) / segments;
        const prevDist = tailLength * prevT;
        const prevX = headX - size * 1.1 - prevDist;
        const prevWave = Math.sin((prevT * Math.PI * 4) - (time * waveSpeed) + wiggleOffset) * amplitude * (1 - prevT);
        const prevY = headY + prevWave;
        ctx.quadraticCurveTo(prevX, prevY, (prevX + px) / 2, (prevY + py) / 2);
      }
    }

    if (isMobile) {
      // Single simple pass for mobile
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
      ctx.lineWidth = size * 1.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      if (pass === 0) {
        // Outer glow simulation
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.15)';
        ctx.lineWidth = size * 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // Core
        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = size * 0.8;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  // HEAD
  // Simple ellipse, no complex gradients
  ctx.fillStyle = isMobile ? 'rgba(0, 245, 255, 0.9)' : 'rgba(200, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.ellipse(headX, headY, size * 1.8, size * 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isMobile) {
    // Simple glow overlay on PC
    ctx.fillStyle = 'rgba(0, 245, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(headX, headY, size * 2.2, size * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function animate(): void {
  if (!ctx || !canvas) return;

  const time = Date.now() * 0.001;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update and draw sperms
  sperms.forEach((sperm) => {
    // Mouse repulsion (gentle)
    const dx = sperm.x - mouseX;
    const dy = sperm.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 80 && dist > 0) {
      const repelForce = (80 - dist) / 80;
      sperm.vy += (dy / dist) * repelForce * 0.5;
    }

    // Keep moving right with slight vertical wave
    sperm.x += sperm.vx;
    sperm.y += sperm.vy;

    // Gentle vertical swimming motion
    const bobSpeed = 1.5 + sperm.wiggleSpeed * 4;
    sperm.y += Math.sin(time * bobSpeed + sperm.wiggleOffset) * 0.6;

    // Dampen vertical velocity back to center
    sperm.vy *= 0.98;

    // When sperm goes off right edge, respawn from left
    if (sperm.x > canvas!.width + sperm.tailLength) {
      sperm.x = -sperm.tailLength - Math.random() * 100;
      sperm.y = Math.random() * canvas!.height;
      sperm.vx = Math.random() * 1.5 + 1.5;
      sperm.vy = (Math.random() - 0.5) * 0.3;
    }

    // Soft vertical bounds
    if (sperm.y < 50) sperm.vy += 0.05;
    if (sperm.y > canvas!.height - 50) sperm.vy -= 0.05;

    // Draw
    drawSperm(sperm, time);
  });

  animationFrame = requestAnimationFrame(animate);
}

