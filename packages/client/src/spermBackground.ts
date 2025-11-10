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
        const angle = Math.atan2(dy, dx);
        sperm.vx = Math.cos(angle) * 3;
        sperm.vy = Math.sin(angle) * 3;

        // Reset to normal speed after 1 second
        setTimeout(() => {
          sperm.vx = Math.random() * 2.5 + 2.0;
          sperm.vy = (Math.random() - 0.5) * 0.4;
        }, 1000);
      }
    });
  };

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);

  // Create sperms with staggered start positions
  const count = window.innerWidth < 768 ? 12 : 20; // Fewer for cleaner look
  for (let i = 0; i < count; i++) {
    const sperm = createSperm();
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
  const size = Math.random() * 3 + 5; // 5-8px bigger for better visibility
  return {
    x: -80, // Start from left edge
    y: Math.random() * window.innerHeight,
    vx: Math.random() * 2.5 + 2.0, // Move right (2.0-4.5 speed - faster)
    vy: (Math.random() - 0.5) * 0.4, // More vertical drift
    size,
    opacity: Math.random() * 0.2 + 0.7, // 0.7-0.9 (much more visible)
    tailLength: size * 18, // Longer tail for realism
    wiggleOffset: Math.random() * Math.PI * 2,
    wiggleSpeed: Math.random() * 0.08 + 0.05 // Faster wiggle
  };
}

function drawSperm(sperm: Sperm, time: number): void {
  if (!ctx) return;

  const { x, y, size, opacity, tailLength, wiggleOffset, wiggleSpeed } = sperm;
  const waveSpeed = 4 + wiggleSpeed * 8;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Smooth tail animation
  const segments = 20;
  const amplitude = size * 1.5; // Wiggle amplitude

  // Calculate head position with wave motion (synchronized with tail start)
  const headWave = Math.sin(-(time * waveSpeed) + wiggleOffset) * amplitude * 0.3;
  const headX = x;
  const headY = y + headWave;

  // Draw tail with smooth bezier curves
  const gradient = ctx.createLinearGradient(headX, headY, x - tailLength, y);
  gradient.addColorStop(0, 'rgba(34, 211, 238, 0.9)');
  gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.5)');
  gradient.addColorStop(1, 'rgba(34, 211, 238, 0.1)');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = size * 0.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(headX, headY);

  // Create smooth S-wave tail - synchronized with head
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const distance = tailLength * t;
    const tailX = headX - distance;

    // Traveling wave formula for realistic swimming
    const wave = Math.sin((t * Math.PI * 4) - (time * waveSpeed) + wiggleOffset) * amplitude * t;
    const tailY = headY + wave;

    if (i === 1) {
      ctx.lineTo(tailX, tailY);
    } else {
      // Use quadratic curves for smoothness
      const prevT = (i - 1) / segments;
      const prevDistance = tailLength * prevT;
      const prevX = headX - prevDistance;
      const prevWave = Math.sin((prevT * Math.PI * 4) - (time * waveSpeed) + wiggleOffset) * amplitude * prevT;
      const prevY = headY + prevWave;

      const cpX = (prevX + tailX) / 2;
      const cpY = (prevY + tailY) / 2;
      ctx.quadraticCurveTo(cpX, cpY, tailX, tailY);
    }
  }
  ctx.stroke();

  // Draw realistic sperm head
  ctx.fillStyle = '#22d3ee';

  // Head shape (teardrop/oval) - synchronized with wave motion
  ctx.beginPath();
  ctx.ellipse(headX, headY, size * 1.8, size * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Add midpiece (mitochondria area) - follows head position
  ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
  ctx.beginPath();
  ctx.ellipse(headX - size * 1.5, headY, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stronger glow - follows head position
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.ellipse(headX, headY, size * 1.8, size * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function animate(): void {
  if (!ctx || !canvas) return;

  const time = Date.now() * 0.001;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update and draw sperms
  sperms.forEach((sperm) => {
    // Mouse repulsion
    const dx = sperm.x - mouseX;
    const dy = sperm.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 100 && dist > 0) {
      const repelForce = (100 - dist) / 100;
      const angle = Math.atan2(dy, dx);
      sperm.x += Math.cos(angle) * repelForce * 2;
      sperm.y += Math.sin(angle) * repelForce * 2;
    }

    // Update position
    sperm.x += sperm.vx;
    sperm.y += sperm.vy;

    // Add swimming motion (up and down wiggle)
    const bobSpeed = 2 + sperm.wiggleSpeed * 6;
    sperm.y += Math.sin(time * bobSpeed + sperm.wiggleOffset) * 0.5;

    // When sperm goes off right edge, respawn from left
    if (sperm.x > canvas!.width + sperm.tailLength) {
      sperm.x = -sperm.tailLength;
      sperm.y = Math.random() * canvas!.height;
      sperm.vx = Math.random() * 2.5 + 2.0;
    }

    // Keep within vertical bounds
    if (sperm.y < -sperm.tailLength) sperm.y = canvas!.height + sperm.tailLength;
    if (sperm.y > canvas!.height + sperm.tailLength) sperm.y = -sperm.tailLength;

    // Draw
    drawSperm(sperm, time);
  });

  animationFrame = requestAnimationFrame(animate);
}

