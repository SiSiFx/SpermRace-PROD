// @ts-nocheck
import * as PIXI from 'pixi.js';
import GameEffects from './GameEffects';
import { startSpermBackground, stopSpermBackground } from './spermBackground';
import type { PlayerInput, GameStateUpdateMessage, TrailPoint } from 'shared';
import { TRAIL } from 'shared';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import bs58 from 'bs58';

// =================================================================================================
// Types & State
// =================================================================================================

type UIState = 'landing' | 'wallet' | 'mode' | 'lobby' | 'game';

interface AppState {
  ui: UIState;
  selectedMode: 'practice' | 'tournament';
  selectedTier: 1 | 5 | 25 | 100;
  solPriceUsd: number | null;
  walletConnected: boolean;
  isAuthenticated: boolean;
  playerId: string | null;
  isInGame: boolean;
  spectatorTarget: string | null;
  spectatorIndex: number;
}

// =================================================================================================
// Global State
// =================================================================================================

const state: AppState = {
  ui: 'landing',
  selectedMode: 'practice',
  selectedTier: 1,
  solPriceUsd: null,
  walletConnected: false,
  isAuthenticated: false,
  playerId: null,
  isInGame: false,
  spectatorTarget: null,
  spectatorIndex: 0
};

let app: PIXI.Application;
let ws: WebSocket;
let solana: any = (window as any).solana;
let walletPublicKey: string | null = null;
let lastLobbyUpdateAt = 0;
let lastEntryFeeVerifiedAt = 0;
let hasVerifiedEntryFee = false;


// Initialize Solana connection with devnet RPC
const RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Network endpoints (env-configurable)
const WS_URL = (import.meta as any).env?.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const PRICE_API_URL = (import.meta as any).env?.VITE_PRICE_API_URL || '/api/sol-price';

type PlayerRenderGroup = {
  container: PIXI.Container;
  // Sperm body rendered as a textured sprite (tinted per-player)
  sperm: PIXI.Sprite;
  // Trails rendered as MeshRope instances for GPU-accelerated ribbons
  trail: any;
  trailGlow: any;
  boostGlow: PIXI.Graphics;
};
const TRAIL_SEGMENTS = 32;
let spermTexture: PIXI.Texture | null = null;
let spermAnchor: PIXI.Point | null = null;
let trailTexture: PIXI.Texture | null = null;
const playerGroups: Map<string, PlayerRenderGroup> = new Map();
const playerInput: PlayerInput = {
  target: { x: 3000, y: 2000 }, // Start at center of map
  accelerate: false
};

// World rendering layers and camera
let rootContainer: PIXI.Container;
let worldContainer: PIXI.Container;
let arenaLayer: PIXI.Container;
let trailsLayer: PIXI.Container;
let playersLayer: PIXI.Container;
let vfxLayer: PIXI.Container;
let previousAlive: Map<string, boolean> = new Map();
type Spark = { g: PIXI.Graphics; vx: number; vy: number; life: number; maxLife: number };
let sparks: Spark[] = [];
let cachedWorldSize: { w: number; h: number } | null = null;
type Puff = { g: PIXI.Graphics; vx: number; vy: number; life: number; maxLife: number };
let exhaustPuffs: Puff[] = [];
let screenLayer: PIXI.Container;
let dangerTexture: PIXI.Texture | null = null;
let dangerTop: PIXI.TilingSprite | null = null;
let dangerBottom: PIXI.TilingSprite | null = null;
let dangerLeft: PIXI.TilingSprite | null = null;
let dangerRight: PIXI.TilingSprite | null = null;
let arenaBorder: PIXI.Graphics | null = null;
let arenaGrid: PIXI.Graphics | null = null;
let lastWorldWidth: number | null = null;
let zoneWarningTriggered = false;
let gameEffects: GameEffects | null = null;
// Camera zoom state
let cameraZoom = 1.0;
let targetZoom = 1.0;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;
let flashRect: PIXI.Graphics | null = null;
let latestServerTimestamp = 0;
let matchTimerStartMs: number | null = null;
let gotGameStarting = false;
let lastHeartbeatVibrationAt = 0;

// Smooth position correction for local player
type SmoothCorrection = {
  currentPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  startTime: number;
  duration: number;
};
const smoothCorrections: Map<string, SmoothCorrection> = new Map();
const CORRECTION_DURATION_MS = 100;

// Simple SFX via Web Audio API
let audioCtx: AudioContext | null = null;
function ensureAudio(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx!;
}
function playTone(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.06): void {
  try {
    const ctx = ensureAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); }, ms);
  } catch {}
}
const sfx = {
  boost: () => { playTone(220, 80, 'sawtooth', 0.05); },
  hit: () => { playTone(140, 120, 'square', 0.07); setTimeout(() => playTone(100, 80, 'square', 0.05), 90); },
  start: () => { playTone(440, 90, 'triangle', 0.06); setTimeout(() => playTone(660, 120, 'triangle', 0.05), 110); },
  end: () => { playTone(520, 120, 'sine', 0.05); setTimeout(() => playTone(390, 150, 'sine', 0.05), 140); },
};

// =================================================================================================
// Interpolation Buffer
// =================================================================================================

type Snapshot = { time: number; state: GameStateUpdateMessage['payload'] };
const snapshots: Snapshot[] = [];
let INTERPOLATION_DELAY_MS = 80; // Reduced for more responsive movement

// Trail interpolation cache for smooth rendering
interface TrailCache {
  trail: TrailPoint[];
  timestamp: number;
}
const trailCache: Map<string, TrailCache> = new Map();

function bufferSnapshot(state: GameStateUpdateMessage['payload']): void {
  // Use server timestamp for consistent interpolation
  snapshots.push({ time: state.timestamp, state });
  if (snapshots.length > 120) snapshots.shift();
}

/**
 * Interpolate between two trail arrays based on parameter t (0-1).
 * Creates smooth transitions between snapshots by blending trail points.
 */
function interpolateTrails(
  fromTrail: TrailPoint[] | undefined,
  toTrail: TrailPoint[] | undefined,
  t: number,
  timestamp: number
): TrailPoint[] {
  // If no trails in either snapshot, return empty
  if (!toTrail || toTrail.length === 0) return [];
  if (!fromTrail || fromTrail.length === 0) return toTrail;

  // Filter out expired points from both trails
  const now = timestamp;
  const validFrom = fromTrail.filter(p => p.expiresAt > now);
  const validTo = toTrail.filter(p => p.expiresAt > now);

  if (validTo.length === 0) return [];

  // For very short trails or near endpoints, just return the target
  if (validTo.length <= 2 || t >= 0.95) return validTo;

  // Build interpolated trail by sampling and blending
  const result: TrailPoint[] = [];
  const maxLength = Math.max(validFrom.length, validTo.length);

  // Sample points at regular intervals
  const sampleCount = Math.min(maxLength, 64); // Limit for performance
  for (let i = 0; i < sampleCount; i++) {
    const normPos = i / (sampleCount - 1); // 0 to 1 along trail

    // Find corresponding points in both trails (from tail to head)
    const fromIdx = Math.floor(normPos * (validFrom.length - 1));
    const toIdx = Math.floor(normPos * (validTo.length - 1));

    const fromPoint = validFrom[fromIdx];
    const toPoint = validTo[toIdx];

    if (!toPoint) continue;

    // Interpolate position
    const ix = fromPoint ? fromPoint.x + (toPoint.x - fromPoint.x) * t : toPoint.x;
    const iy = fromPoint ? fromPoint.y + (toPoint.y - fromPoint.y) * t : toPoint.y;

    // Use expiration from target trail (authoritative)
    const interpolatedPoint: TrailPoint = {
      x: ix,
      y: iy,
      expiresAt: toPoint.expiresAt,
      createdAt: toPoint.createdAt
    };

    result.push(interpolatedPoint);
  }

  return result;
}

/**
 * Get interpolated trail for a player, using cached trails for smoothness.
 */
function getInterpolatedTrail(
  playerId: string,
  leftSnapshot: Snapshot,
  rightSnapshot: Snapshot,
  t: number,
  timestamp: number
): TrailPoint[] {
  // Check cache first
  const cached = trailCache.get(playerId);
  if (cached && cached.timestamp === timestamp) {
    return cached.trail;
  }

  // Get trails from both snapshots
  const leftPlayer = leftSnapshot.state.players.find(p => p.id === playerId);
  const rightPlayer = rightSnapshot.state.players.find(p => p.id === playerId);

  const fromTrail = leftPlayer?.trail;
  const toTrail = rightPlayer?.trail;

  // Interpolate
  const interpolated = interpolateTrails(fromTrail, toTrail, t, timestamp);

  // Cache result
  trailCache.set(playerId, { trail: interpolated, timestamp });

  // Clean old cache entries periodically
  if (trailCache.size > 32) {
    const oldestTimestamp = timestamp - 5000; // 5 seconds old
    for (const [id, entry] of trailCache) {
      if (entry.timestamp < oldestTimestamp) {
        trailCache.delete(id);
      }
    }
  }

  return interpolated;
}

function startInterpolatedRender(): void {
  if (!app) return;
  app.ticker.add(() => {
    if (!state.isInGame) return;
    if (snapshots.length < 2) return;
    const latestTime = snapshots[snapshots.length - 1].time;
    const target = latestTime - INTERPOLATION_DELAY_MS;

    // Find snapshot pair bracketing target
    let left = snapshots[0];
    let right = snapshots[snapshots.length - 1];
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].time <= target) { left = snapshots[i]; right = snapshots[Math.min(i + 1, snapshots.length - 1)]; break; }
    }
    const span = Math.max(1, right.time - left.time);
    const t = Math.min(1, Math.max(0, (target - left.time) / span));

    // Auto-tune interpolation delay to maintain ~2–3 snapshot buffer
    if (snapshots.length >= 3) {
      let totalDelta = 0;
      for (let i = 1; i < snapshots.length; i++) totalDelta += (snapshots[i].time - snapshots[i - 1].time);
      const avgDelta = totalDelta / (snapshots.length - 1);
      const desiredBacklog = 2.0; // Reduced for lower latency
      const desiredDelay = Math.max(50, Math.min(180, avgDelta * desiredBacklog));
      INTERPOLATION_DELAY_MS += (desiredDelay - INTERPOLATION_DELAY_MS) * 0.08; // Faster adaptation
    }

    // Interpolate players
    const leftPlayers = new Map<string, typeof left.state.players[number]>();
    left.state.players.forEach(p => leftPlayers.set(p.id, p));
    const rightPlayers = new Map<string, typeof right.state.players[number]>();
    right.state.players.forEach(p => rightPlayers.set(p.id, p));
    const mergedIds = new Set<string>([...Array.from(leftPlayers.keys()), ...Array.from(rightPlayers.keys())]);

    const interpPlayers: Array<typeof right.state.players[number]> = [];
    mergedIds.forEach(id => {
      const lp = leftPlayers.get(id);
      const rp = rightPlayers.get(id) || lp;
      if (!rp) return;
      const from = lp || rp;
      const to = rp;
      const ix = from.sperm.position.x + (to.sperm.position.x - from.sperm.position.x) * t;
      const iy = from.sperm.position.y + (to.sperm.position.y - from.sperm.position.y) * t;
      // Simple angle lerp
      let da = to.sperm.angle - from.sperm.angle; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const ia = from.sperm.angle + da * t;

      // Interpolate trails for smooth rendering
      const interpolatedTrail = getInterpolatedTrail(id, left, right, t, right.state.timestamp);

      interpPlayers.push({
        id,
        sperm: { position: { x: ix, y: iy }, velocity: to.sperm.velocity, angle: ia, angularVelocity: to.sperm.angularVelocity, color: to.sperm.color },
        isAlive: to.isAlive,
        trail: interpolatedTrail, // Use interpolated trails for smooth rendering
        status: (to as any).status,
      } as any);
    });

    renderInterpolated({ players: interpPlayers, world: right.state.world, aliveCount: right.state.aliveCount, timestamp: right.state.timestamp } as any);

    // Camera follow on local player, clamped to arena
    // Choose camera target: self if alive, else spectator target if set, else default to first alive
    let cam = interpPlayers.find(p => p.id === state.playerId && p.isAlive);
    if (!cam && state.spectatorTarget) cam = interpPlayers.find(p => p.id === state.spectatorTarget && p.isAlive);
    if (!cam) cam = interpPlayers.find(p => p.isAlive);
    if (cam && rootContainer) {
      // Smooth zooming
      cameraZoom += (targetZoom - cameraZoom) * 0.15;
      const viewW = app.screen.width, viewH = app.screen.height;
      const worldW = right.state.world.width, worldH = right.state.world.height;
      const s = cameraZoom;
      // Position root so the camera target sits at screen center
      const desiredX = (viewW / 2) - cam.sperm.position.x * s;
      const desiredY = (viewH / 2) - cam.sperm.position.y * s;
      // Clamp so world remains within view
      const minX = Math.min(0, viewW - worldW * s);
      const minY = Math.min(0, viewH - worldH * s);
      const maxX = 0;
      const maxY = 0;
      rootContainer.scale.set(s);
      rootContainer.position.set(
        Math.max(minX, Math.min(maxX, desiredX)), // no rounding for smooth camera
        Math.max(minY, Math.min(maxY, desiredY))
      );
    }
  });
}

// =================================================================================================
// DOM Elements
// =================================================================================================

const screens = {
  landing: document.getElementById('landing-screen')!,
  wallet: document.getElementById('wallet-screen')!,
  mode: document.getElementById('mode-screen')!,
  lobby: document.getElementById('lobby-screen')!,
  game: document.getElementById('game-screen')!
};



const elements = {
  // Landing
  playCta: document.getElementById('play-cta')!,

  // Wallet
  connectWallet: document.getElementById('connect-wallet')!,
  walletWarning: document.getElementById('wallet-warning')!,
  walletBack: document.getElementById('wallet-back')!,
  walletDisplay: document.getElementById('wallet-display')!,
  walletAddress: document.getElementById('wallet-address')!,

  // Mode
  tournamentCards: document.querySelectorAll('.tournament-card') as NodeListOf<HTMLElement>,
  tournamentJoinBtns: document.querySelectorAll('.tournament-join-btn') as NodeListOf<HTMLButtonElement>,
  solAmounts: document.querySelectorAll('.sol-amount') as NodeListOf<HTMLElement>,
  solPrice: document.getElementById('sol-price')!,
  rateTimestamp: document.getElementById('rate-timestamp')!,
  modeContinue: document.getElementById('mode-continue')!,
  modeBack: document.getElementById('mode-back')!,

  // Landing price widgets
  landingSolPrice: document.getElementById('landing-sol-price')!,
  landingPriceAge: document.getElementById('landing-price-age')!,

  // Lobby
  lobbyCount: document.getElementById('lobby-count')!,
  lobbyMax: document.getElementById('lobby-max')!,
  playersOnline: document.getElementById('players-online')!,
  playersList: document.getElementById('players-list')!,
  queueCurrent: document.getElementById('queue-current')!,
  queueTarget: document.getElementById('queue-target')!,
  queueEta: document.getElementById('queue-eta')!,
  matchMode: document.getElementById('match-mode')!,
  matchFee: document.getElementById('match-fee')!,
  matchPrize: document.getElementById('match-prize')!,
  lobbyCountdown: document.getElementById('lobby-countdown')!,
  countdownTimer: document.getElementById('countdown-timer')!,
  lobbyLeave: document.getElementById('lobby-leave')!,

  // Game
  gameCanvas: document.getElementById('game-canvas') as HTMLCanvasElement,
  gameHud: document.getElementById('game-hud')!,
  aliveCount: document.getElementById('alive-count')!,
  roundTimer: document.getElementById('round-timer')!,
  boostCooldown: document.getElementById('boost-cooldown')!,
  minimap: document.getElementById('minimap') as HTMLCanvasElement,
  leaderboard: document.getElementById('leaderboard')!,
  killFeed: document.getElementById('kill-feed')!,
  gameCountdown: document.getElementById('game-countdown')!,
  countdownNumber: document.getElementById('countdown-number')!,

  // Round End
  roundEnd: document.getElementById('round-end')!,
  roundResult: document.getElementById('round-result')!,
  roundDescription: document.getElementById('round-description')!,
  finalPlacement: document.getElementById('final-placement')!,
  eliminations: document.getElementById('eliminations')!,
  survivalTime: document.getElementById('survival-time')!,
  winnings: document.getElementById('winnings')!,
  payoutLinkRow: document.getElementById('payout-link-row')!,
  payoutLink: document.getElementById('payout-link') as HTMLAnchorElement,
  playAgain: document.getElementById('play-again')!,
  returnLobby: document.getElementById('return-lobby')!,
  
  // Loading
  loadingOverlay: document.getElementById('loading-overlay')!,
  loadingText: document.getElementById('loading-text')!
};

function showInlineWarning(message?: string): void {
  try {
    const panel = elements.walletWarning;
    const textEl = panel.querySelector('.warning-text') as HTMLElement | null;
    if (message && textEl) textEl.textContent = message;
    panel.style.display = 'flex';
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(-6px)';
      setTimeout(() => { panel.style.display = 'none'; }, 260);
    }, 4500);
  } catch {}
}

// =================================================================================================
// UI State Management
// =================================================================================================

function showScreen(screen: UIState) {
  // Hide all screens
  Object.values(screens).forEach(s => s.classList.remove('active'));

  // Show target screen
  screens[screen].classList.add('active');
  state.ui = screen;

  // Background animation lifecycle
  if (screen === 'landing') {
    const bg = document.getElementById('bg-particles');
    if (bg) { bg.classList.remove('tunnel-out'); bg.classList.add('tunnel-in'); }
    startSpermBackground().catch(() => {});
  } else {
    const bg = document.getElementById('bg-particles');
    if (bg) {
      bg.classList.remove('tunnel-in');
      bg.classList.add('tunnel-out');
      setTimeout(() => { stopSpermBackground(); }, 580);
    } else {
      stopSpermBackground();
    }
  }

  // Refresh wallet button label when entering wallet screen
  if (screen === 'wallet') {
    updateWalletButton().catch(console.error);
    // If no wallet detected, show inline warning below the button
    detectWallet().then(d => { if (!d.found) showInlineWarning('No wallet detected. Install Phantom/Solflare/Coinbase and refresh.'); }).catch(() => {});
  }
  if (screen !== 'wallet' && walletPublicKey) {
    elements.walletDisplay.style.display = 'block';
    elements.walletAddress.textContent = `${walletPublicKey.slice(0,4)}…${walletPublicKey.slice(-4)}`;
  }
  
  console.log(`🎮 UI State: ${screen}`);
}

function showLoading(text: string) {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}

// =================================================================================================
// Wallet Integration
// =================================================================================================

async function detectWallet(): Promise<{ found: boolean; wallet?: any; name?: string }> {
  if (typeof window === 'undefined') {
    return { found: false };
  }

  // List of known Solana wallet providers in order of preference
  const walletProviders = [
    // Generic aggregator first (lets user choose if multiple wallets exist)
    { name: 'Wallet', provider: (window as any).solana },
    { name: 'Phantom', provider: (window as any).phantom?.solana },
    { name: 'Backpack', provider: (window as any).backpack?.solana },
    { name: 'Solflare', provider: (window as any).solflare },
    { name: 'Slope', provider: (window as any).Slope },
    { name: 'Sollet', provider: (window as any).sollet },
    { name: 'MathWallet', provider: (window as any).mathwallet?.solana },
    { name: 'Coin98', provider: (window as any).coin98?.solana },
    { name: 'Clover', provider: (window as any).clover_solana },
    { name: 'Torus', provider: (window as any).torus },
    // Final fallback
    { name: 'Wallet', provider: (window as any).solana }
  ];

  for (const wallet of walletProviders) {
    if (wallet.provider && typeof wallet.provider.connect === 'function') {
      return { found: true, wallet: wallet.provider, name: wallet.name };
    }
  }

  return { found: false };
}

async function connectWallet(): Promise<boolean> {
  try {
    const detection = await detectWallet();
    if (!detection.found) {
      elements.walletWarning.style.display = 'flex';
      return false;
    }
    
    elements.walletWarning.style.display = 'none';
    showLoading(`Connecting ${detection.name} wallet...`);
    
    solana = detection.wallet;
    
    // Log the network we're using
    console.log(`🌐 Configuring wallet for network: ${RPC_ENDPOINT}`);
    
    // If already connected, reuse session
    if (solana.isConnected && solana.publicKey) {
      walletPublicKey = solana.publicKey.toString();
    } else {
      let response: any;
      try {
        // Prefer explicit connect with options if supported
        response = await solana.connect({ onlyIfTrusted: false });
      } catch {
        // Fallback to plain connect signature
        response = await solana.connect();
      }
      // Some providers return publicKey on response, others set it on the provider
      const pk = response?.publicKey ?? solana.publicKey;
      walletPublicKey = typeof pk === 'string' ? pk : pk?.toString?.();
      if (!walletPublicKey) {
        throw new Error('Wallet did not return a public key');
      }
    }
    state.walletConnected = true;
    
    console.log(`🔗 ${detection.name} wallet connected: ${walletPublicKey}`);
    console.log(`🌐 Using RPC: ${RPC_ENDPOINT}`);
    hideLoading();
    return true;
    
  } catch (error) {
    console.error('Wallet connection failed:', error);
    hideLoading();
    showInlineWarning('Wallet connection failed. Check your wallet and try again.');
    return false;
  }
}

// =================================================================================================
// Price & Tier Management
// =================================================================================================

async function fetchSolPrice(): Promise<void> {
  try {
    const response = await fetch(PRICE_API_URL);
    const data = await response.json();
    state.solPriceUsd = Number(data.usd);
    updateTierDisplay();
    // Update landing widgets
    if (elements.landingSolPrice && state.solPriceUsd != null) {
      elements.landingSolPrice.textContent = state.solPriceUsd.toFixed(2);
    }
    if (elements.landingPriceAge) {
      elements.landingPriceAge.textContent = '0';
    }
  } catch (error) {
    console.error('Failed to fetch SOL price:', error);
    // Do not set synthetic fallback; keep previous price if available
  }
}

function updateTierDisplay(): void {
  if (!state.solPriceUsd) return;
  
  // Update SOL price display
  elements.solPrice.textContent = state.solPriceUsd.toFixed(2);
  
  // Update all tier SOL amounts
  elements.solAmounts.forEach(element => {
    const tier = parseInt(element.dataset.tier!);
    const solAmount = (tier / state.solPriceUsd!).toFixed(4);
    element.textContent = solAmount;
  });
  
  // Update timestamp (simulated for now)
  elements.rateTimestamp.textContent = '30';
}

function setSelectedTier(tier: 1 | 5 | 25 | 100): void {
  state.selectedTier = tier;
  
  // Update tournament card selection states
  elements.tournamentCards.forEach(card => {
    const cardTier = parseInt(card.dataset.tier!);
    if (cardTier === tier) {
      card.style.borderColor = 'var(--primary)';
      card.style.boxShadow = '0 4px 20px rgba(0, 212, 255, 0.2)';
    } else {
      card.style.borderColor = '';
      card.style.boxShadow = '';
    }
  });
  
  updateTierDisplay();
  // Reflect selection immediately in any visible match info
  updateMatchInfo();
}

// =================================================================================================
// Lobby Management
// =================================================================================================

function updateLobbyDisplayFromLobby(lobby: any): void {
  const list: any[] = Array.isArray(lobby.players) ? lobby.players : [];
  elements.lobbyCount.textContent = list.length.toString();
  if (typeof lobby.maxPlayers === 'number') {
    elements.lobbyMax.textContent = lobby.maxPlayers.toString();
  }
  elements.playersOnline.textContent = list.length.toString();
  
  // Update players list
  elements.playersList.innerHTML = '';
  list.forEach((p, index) => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.textContent = (index + 1).toString();
    
    const name = document.createElement('div');
    name.className = 'player-name';
    const id = typeof p === 'string' ? p : p?.id;
    name.textContent = id ? id.substring(0, 8) + '...' : `Player ${index + 1}`;
    
    playerItem.appendChild(avatar);
    playerItem.appendChild(name);
    elements.playersList.appendChild(playerItem);
  });
}

function updateMatchInfo(): void {
  elements.matchMode.textContent = state.selectedMode === 'practice' ? 'Practice' : 'Tournament';
  
  if (state.selectedMode === 'tournament' && state.solPriceUsd) {
    const solAmount = (state.selectedTier / state.solPriceUsd).toFixed(3);
    elements.matchFee.textContent = `$${state.selectedTier} (≈${solAmount} SOL)`;
    elements.matchPrize.textContent = `$${state.selectedTier * 64}`;
  } else {
    elements.matchFee.textContent = 'Free';
    elements.matchPrize.textContent = 'N/A';
  }
}

function showLobbyCountdown(seconds: number): void {
  elements.lobbyCountdown.style.display = 'block';
  elements.countdownTimer.textContent = seconds.toString();
  
  if (seconds <= 3) {
    elements.countdownTimer.style.animation = 'pulse 1s ease-in-out infinite';
  }
}

function hideLobbyCountdown(): void {
  elements.lobbyCountdown.style.display = 'none';
  elements.countdownTimer.style.animation = '';
}

function updateQueueBar(payload: any): void {
  try {
    const players = Array.isArray(payload.players) ? payload.players.length : (payload.count ?? 1);
    const target = payload.maxPlayers ?? 16;
    elements.queueCurrent.textContent = String(players);
    elements.queueTarget.textContent = String(target);
    // naive ETA: if countdown provided use that; else estimate by missing players * 3s
    const eta = typeof payload.etaSeconds === 'number'
      ? payload.etaSeconds
      : Math.max(0, (target - players)) * 3;
    elements.queueEta.textContent = `${eta}s`;
  } catch {}
}

// =================================================================================================
// Game Integration
// =================================================================================================

async function initializeGame(): Promise<void> {
  showScreen('game');
  
  // Initialize PIXI Application
  app = new PIXI.Application();
  
  await app.init({
    view: elements.gameCanvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0a0f,
    resizeTo: window,
  });

  app.start();
  state.isInGame = true;

  // Lazy-init heavy UI after entering game
  setTimeout(() => {
    try { updateLeaderboard(); } catch {}
  }, 300);
  // Create world layers and add to stage
  worldContainer = new PIXI.Container();
  arenaLayer = new PIXI.Container();
  trailsLayer = new PIXI.Container();
  playersLayer = new PIXI.Container();
  vfxLayer = new PIXI.Container();
  screenLayer = new PIXI.Container();
  worldContainer.addChild(arenaLayer, trailsLayer, playersLayer, vfxLayer);
  rootContainer = new PIXI.Container();
  app.stage.addChild(rootContainer);
  rootContainer.addChild(worldContainer);
  app.stage.addChild(screenLayer);
  // Reset arena caches and VFX helpers
  cachedWorldSize = null;
  lastWorldWidth = null;
  zoneWarningTriggered = false;
  dangerTop = dangerBottom = dangerLeft = dangerRight = null;
  arenaBorder = arenaGrid = null;
  // Instantiate game effects for screen glitches and warnings
  gameEffects = new GameEffects(worldContainer);
  // Generate shared textures used by player sprites and trail ropes
  generateSpermTexture(app);
  generateTrailTexture(app);
  // Start smooth interpolation renderer
  startInterpolatedRender();
  
  // Add mouse tracking for player input
  elements.gameCanvas.addEventListener('mousemove', (e) => {
    if (!state.isInGame) return;
    
    const rect = elements.gameCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Convert screen coords to world coords using camera offset and zoom
    const s = cameraZoom || 1.0;
    const camX = (rootContainer?.position.x ?? 0);
    const camY = (rootContainer?.position.y ?? 0);
    const worldX = (cx - camX) / s;
    const worldY = (cy - camY) / s;
    playerInput.target.x = worldX;
    playerInput.target.y = worldY;
  });
  // Mouse wheel zoom controls
  elements.gameCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = e.deltaY > 0 ? -0.1 : 0.1;
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom + step));
  }, { passive: false });
  
  // Mouse-only controls
  // Left mouse = accelerate (hold); Right mouse = boost (click)
  elements.gameCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      playerInput.accelerate = true;
    } else if (e.button === 2) {
      e.preventDefault();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'playerInput', payload: { ...playerInput, boost: true } }));
        try {
          if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            navigator.vibrate?.(30);
          }
        } catch {}
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) playerInput.accelerate = false;
  });
  
  // Handle mouse leave to prevent stuck acceleration
  elements.gameCanvas.addEventListener('mouseleave', () => {
    playerInput.accelerate = false;
  });
  // Disable context menu so right-click can be used for boost
  elements.gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Add keyboard controls
  document.addEventListener('keydown', (e) => {
    if (!state.isInGame) return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'playerInput', payload: { ...playerInput, boost: true } }));
          try {
            if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
              navigator.vibrate?.(30);
            }
          } catch {}
        }
        break;
      // Keyboard accelerate disabled (mouse-only)
      case 'Tab':
        e.preventDefault();
        cycleSpectatorTarget();
        break;
    }
  });
  // No keyboard accelerate on keyup
  
  // Start input loop
  // Send player input at higher rate for better responsiveness
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && state.isInGame) {
      ws.send(JSON.stringify({ type: 'playerInput', payload: playerInput }));
    }
  }, 33); // ~30fps input rate for smoother control


}





function cycleSpectatorTarget(): void {
  // Pick next alive player from latest snapshot
  if (snapshots.length === 0) return;
  const latest = snapshots[snapshots.length - 1].state;
  const alive = latest.players.filter(p => p.isAlive);
  if (alive.length === 0) return;
  // If local is alive, set spectator to self; otherwise cycle
  const meAlive = alive.find(p => p.id === state.playerId);
  if (!state.spectatorTarget) {
    state.spectatorIndex = 0;
    state.spectatorTarget = meAlive ? state.playerId : alive[0].id;
  } else {
    const idx = Math.max(0, alive.findIndex(p => p.id === state.spectatorTarget));
    state.spectatorIndex = (idx + 1) % alive.length;
    state.spectatorTarget = alive[state.spectatorIndex].id;
  }
  // Camera follow will naturally follow spectator because we select target below
}

function showGameCountdown(number: number): void {
  elements.countdownNumber.textContent = number.toString();
  elements.gameCountdown.style.display = 'block';
  
  setTimeout(() => {
    elements.gameCountdown.style.display = 'none';
  }, 1000);
}

function updateGameHUD(gameState: any): void {
  if (gameState.aliveCount !== undefined) {
    elements.aliveCount.textContent = gameState.aliveCount.toString();
    const badge = document.getElementById('overtime-badge');
    if (badge) badge.style.display = gameState.aliveCount < 3 ? 'block' : 'none';
  }
  
  // Update boost cooldown display (support players as array)
  let player: any = undefined;
  try {
    if (Array.isArray(gameState.players)) {
      player = gameState.players.find((p: any) => p.id === state.playerId);
    } else if (gameState.players && state.playerId) {
      player = (gameState.players as any)[state.playerId];
    }
  } catch {}
  if (player && player.status && player.status.boostCooldownMs !== undefined) {
    const max = (player as any).status.boostMaxCooldownMs ?? 5000;
    const cooldownPercent = Math.max(0, Math.min(1, (player as any).status.boostCooldownMs / max)) * 100;
    const boostFill = elements.boostCooldown.querySelector('.boost-fill') as HTMLElement;
    if (boostFill) {
      boostFill.style.width = `${100 - cooldownPercent}%`;
    }
  }
}

function showRoundEnd(result: any): void {
  const isWinner = result.placement === 1;
  
  elements.roundResult.textContent = isWinner ? 'Fertilization!' : 'Eliminated';
  elements.roundResult.className = `round-result ${isWinner ? 'victory' : 'defeat'}`;
  
  elements.roundDescription.textContent = `You finished #${result.placement} out of ${result.totalPlayers} sperm`;
  elements.finalPlacement.textContent = `#${result.placement}`;
  elements.eliminations.textContent = result.eliminations?.toString() || '0';
  elements.survivalTime.textContent = formatTime(result.survivalTime || 0);
  elements.winnings.textContent = result.winnings ? `${result.winnings} SOL` : '0 SOL';

  // Payout link handled in handleRoundEnd (signature available there)
  
  elements.roundEnd.style.display = 'flex';
}

function handleRoundEnd(payload: { winnerId: string; prizeAmount: number; txSignature?: string }): void {
  const isWinner = payload.winnerId === state.playerId;
  const winningsSol = isWinner ? payload.prizeAmount : 0;

  const result = {
    placement: isWinner ? 1 : 0,
    totalPlayers: 0,
    eliminations: 0,
    survivalTime: 0,
    winnings: winningsSol,
  };

  showRoundEnd(result);

  // Show payout confirmation banner if available
  if (isWinner && payload.txSignature) {
    const overlay = document.getElementById('status-overlay') as HTMLDivElement;
    if (overlay) {
      overlay.textContent = `Payout sent: ${payload.txSignature.slice(0, 12)}... (devnet)`;
      overlay.style.display = 'flex';
      setTimeout(() => { overlay.style.display = 'none'; }, 6000);
    }
    // Set Solscan link
    const row = document.getElementById('payout-link-row') as HTMLDivElement | null;
    const a = document.getElementById('payout-link') as HTMLAnchorElement | null;
    if (row && a) {
      a.href = `https://solscan.io/tx/${payload.txSignature}?cluster=devnet`;
      row.style.display = 'block';
    }
  }
}

function hideRoundEnd(): void {
  elements.roundEnd.style.display = 'none';
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// =================================================================================================
// WebSocket Communication
// =================================================================================================

async function connectToServer(): Promise<void> {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  return new Promise((resolve, reject) => {
    showLoading('Connecting to server...');
    
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('🔌 Connected to server');
      hideLoading();
      resolve();
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      hideLoading();
      reject(error);
    };
    
    ws.onclose = () => {
      console.log('🔌 Disconnected from server');
      state.isAuthenticated = false;
      state.isInGame = false;
      // Attempt auto-reconnect after short delay
      setTimeout(() => {
        connectToServer().catch(() => {});
      }, 1500);
    };
    
    ws.onmessage = handleServerMessage;
  });
}

async function handleServerMessage(event: MessageEvent): Promise<void> {
  const message: any = JSON.parse(event.data);
  
    switch (message.type) {
    case 'siwsChallenge':
      await handleSIWSChallenge(message.payload);
      break;
      
      case 'authenticated':
      state.isAuthenticated = true;
      state.playerId = message.payload.playerId;
      console.log(`✅ Authenticated as ${state.playerId}`);
      await joinLobby();
        break;
      
      case 'lobbyState':
      lastLobbyUpdateAt = Date.now();
      updateLobbyDisplayFromLobby(message.payload);
      updateQueueBar(message.payload);
      updateMatchInfo();
      if (state.ui !== 'lobby') showScreen('lobby');
      break;
      
    case 'lobbyCountdown':
      const remaining = message.payload.remaining as number;
      const startAtMs = (message.payload.startAtMs as number) || Date.now() + remaining * 1000;
      const serverNow = Date.now();
      const correctedRemaining = Math.max(0, Math.ceil((startAtMs - serverNow) / 1000));
      showLobbyCountdown(correctedRemaining);
      if (correctedRemaining <= 3 && correctedRemaining >= 1) {
        showGameCountdown(correctedRemaining);
      }
      break;
      
    case 'gameStarting':
      hideLobbyCountdown();
      await initializeGame();
      gotGameStarting = true;
      matchTimerStartMs = null;
      sfx.start();
        break;
  
      case 'gameStateUpdate':
      updateGameHUD(message.payload);
      bufferSnapshot(message.payload);
      break;
      
    case 'roundEnd':
      handleRoundEnd(message.payload);
      sfx.end();
      break;
      
    case 'entryFeeTx':
      if (hasVerifiedEntryFee) {
        console.warn('⚠️ Ignoring duplicate entry fee transaction after verification');
        break;
    }
      await handleEntryFeeTransaction(message.payload);
      break;
      
    case 'entryFeeVerified':
      console.log('✅ Entry fee verified');
      hideLoading();
      lastEntryFeeVerifiedAt = Date.now();
      hasVerifiedEntryFee = true;
      // Ensure lobby view is shown and status updates render
      if (state.ui !== 'lobby') showScreen('lobby');
      // Fallback: if no lobby update arrives shortly, request join again (idempotent server-side)
      setTimeout(() => {
        // Only rejoin if no lobby update has been received since verification
        if (lastLobbyUpdateAt < lastEntryFeeVerifiedAt) {
          joinLobby().catch(() => {});
        }
      }, 4000);
      break;
    
    case 'playerEliminated': {
      const { playerId, eliminatorId } = message.payload || {};
      if (elements.killFeed) {
        const row = document.createElement('div');
        row.className = 'kf-row';
        const killer = eliminatorId ? `${String(eliminatorId).slice(0,6)}…` : 'Arena';
        const victim = playerId ? `${String(playerId).slice(0,6)}…` : 'Unknown';
        row.textContent = `${killer} → ${victim}`;
        elements.killFeed.prepend(row);
        setTimeout(() => { row.remove(); }, 5000);
      }

      // Haptics: strong buzz on death, double pulse on kill
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
          if (playerId && playerId === state.playerId) {
            try { navigator.vibrate?.(400); } catch {}
          } else if (eliminatorId && eliminatorId === state.playerId) {
            try { navigator.vibrate?.([50, 30, 50]); } catch {}
          }
        }
      } catch {}
        break;
    }

    case 'error':
      console.error('❌ Server error:', message.payload?.message);
      elements.loadingOverlay.style.display = 'none';
      const overlay = document.getElementById('status-overlay') as HTMLDivElement;
      if (overlay) {
        overlay.textContent = message.payload?.message || 'An error occurred';
        overlay.style.display = 'flex';
        setTimeout(() => { overlay.style.display = 'none'; }, 3500);
      }
        break;
      
    // case 'playerEliminated': handled above
    default:
      // console.log('📨 Unknown message:', message);
  }
}

async function handleSIWSChallenge(payload: any): Promise<void> {
  try {
    showLoading('Signing authentication message...');
    
    const { message: authMsg, nonce } = payload;
    const encoded = new TextEncoder().encode(authMsg);
    const signed = await solana.signMessage(encoded, 'utf8');
    const sigB58 = signed?.signature ? bs58.encode(signed.signature) : bs58.encode(signed);
    
    ws.send(JSON.stringify({
      type: 'authenticate',
      payload: { publicKey: walletPublicKey, signedMessage: sigB58, nonce }
    }));
    
    hideLoading();
  } catch (error) {
    console.error('Authentication failed:', error);
    hideLoading();
  }
}

async function handleEntryFeeTransaction(payload: any): Promise<void> {
  try {
    showLoading('Processing entry fee...');
    console.log(`🔗 Processing transaction on network: ${RPC_ENDPOINT}`);
    
    const base64 = payload.txBase64 ?? payload.transaction; // support both keys just in case
    const txBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const tx = VersionedTransaction.deserialize(txBytes);
    
    // For wallet providers that support it, specify the connection
    const sendOptions: any = {
      preflightCommitment: 'confirmed',
      skipPreflight: false
    };
    
    // If the wallet supports specifying connection/network, use it
    if (solana.signAndSendTransaction) {
      // Some wallets accept a connection parameter
      try {
        const signed = await solana.signAndSendTransaction(tx, connection, sendOptions);
        ws.send(JSON.stringify({
          type: 'entryFeeSignature',
          payload: { signature: signed.signature, paymentId: payload.paymentId, sessionNonce: payload.sessionNonce }
        }));
      } catch (error: any) {
        // If connection parameter not supported, try without it
        if (error.message?.includes('connection') || error.message?.includes('argument')) {
          const signed = await solana.signAndSendTransaction(tx, sendOptions);
          ws.send(JSON.stringify({
            type: 'entryFeeSignature',
            payload: { signature: signed.signature, paymentId: payload.paymentId, sessionNonce: payload.sessionNonce }
          }));
        } else {
          throw error;
        }
      }
    } else {
      // Fallback for wallets without signAndSendTransaction
      const signed = await solana.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      ws.send(JSON.stringify({
        type: 'entryFeeSignature',
        payload: { signature, paymentId: payload.paymentId, sessionNonce: payload.sessionNonce }
      }));
    }
    
    // Keep loading overlay visible while server verifies payment
    elements.loadingText.textContent = 'Verifying payment...';
  } catch (error) {
    console.error('Entry fee transaction failed:', error);
    hideLoading();
  }
}

async function joinLobby(): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'joinLobby',
      payload: { entryFeeTier: state.selectedTier, mode: state.selectedMode }
    }));
  }
}

// =================================================================================================
// Game Rendering
// =================================================================================================

// Pre-rendered textures for sperm bodies and trails
function generateSpermTexture(app: PIXI.Application): void {
  if (spermTexture) return;

  const g = new PIXI.Graphics();

  // Sperm head (white, to be tinted per-player)
  g.ellipse(0, 0, 8, 4).fill({ color: 0xffffff, alpha: 1.0 });
  g.ellipse(0, 0, 8, 4).stroke({ width: 2, color: 0xffffff, alpha: 0.4 });

  // Tail (simple wavy line)
  g.moveTo(-8, 0)
    .lineTo(-12, -1)
    .lineTo(-16, 1)
    .lineTo(-20, -1)
    .lineTo(-24, 0)
    .lineTo(-28, 1)
    .lineTo(-32, 0)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });

  // Head nucleus
  g.circle(2, 0, 2).fill({ color: 0xffffff, alpha: 0.9 });

  const bounds = g.getLocalBounds();
  const resolution = (window.devicePixelRatio || 1) as number;

  spermTexture = app.renderer.generateTexture(g, {
    resolution,
    region: bounds,
  } as any);
  spermAnchor = new PIXI.Point(
    -bounds.x / bounds.width,
    -bounds.y / bounds.height,
  );

  g.destroy();
}

function generateTrailTexture(app: PIXI.Application): void {
  if (trailTexture) return;

  const g = new PIXI.Graphics();
  const length = 128;
  const thickness = 16;

  // Soft outer glow
  g.rect(0, (thickness - 10) / 2, length, 10).fill({ color: 0xffffff, alpha: 0.25 });
  // Bright inner core
  g.rect(0, (thickness - 4) / 2, length, 4).fill({ color: 0xffffff, alpha: 1.0 });

  const bounds = g.getLocalBounds();
  const resolution = (window.devicePixelRatio || 1) as number;

  trailTexture = app.renderer.generateTexture(g, {
    resolution,
    region: bounds,
  } as any);

  g.destroy();
}

function renderGame(gameState: GameStateUpdateMessage['payload']): void {
  if (!app || !state.isInGame) return;
  
  // Clear arena only when size changes (handled in drawArena)
  // Reuse pooled player groups, mark seen this frame
  const seen = new Set<string>();
  
  const { players, world } = gameState;
  
  // Draw arena boundaries
  drawArena(world);
  // Heartbeat haptics: pulse when the nearest enemy is very close
  try {
    const me = players.find(p => p.id === state.playerId && p.isAlive);
    if (me && typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      let nearest = Infinity;
      for (const p of players) {
        if (!p.isAlive || p.id === me.id) continue;
        const dx = p.sperm.position.x - me.sperm.position.x;
        const dy = p.sperm.position.y - me.sperm.position.y;
        const d = Math.hypot(dx, dy);
        if (d < nearest) nearest = d;
      }
      const now = Date.now();
      if (nearest < 300 && (now - lastHeartbeatVibrationAt) >= 500) {
        try { navigator.vibrate?.([5, 50]); } catch {}
        lastHeartbeatVibrationAt = now;
      }
    }
  } catch {}

  // Heartbeat haptics: pulse when the nearest enemy is very close
  try {
    const me = players.find(p => p.id === state.playerId && p.isAlive);
    if (me && typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      let nearest = Infinity;
      for (const p of players) {
        if (!p.isAlive || p.id === me.id) continue;
        const dx = p.sperm.position.x - me.sperm.position.x;
        const dy = p.sperm.position.y - me.sperm.position.y;
        const d = Math.hypot(dx, dy);
        if (d < nearest) nearest = d;
      }
      const now = Date.now();
      if (nearest < 300 && (now - lastHeartbeatVibrationAt) >= 500) {
        try { navigator.vibrate?.([5, 50]); } catch {}
        lastHeartbeatVibrationAt = now;
      }
    }
  } catch {}
  
  // Update or create player groups and trails
  for (const player of players) {
    const group = ensurePlayerGroup(player.id);
    updatePlayerGroup(group, player);
    seen.add(player.id);
  }

  // Remove groups for players not present anymore
  for (const [id, group] of playerGroups) {
    if (!seen.has(id)) {
      playersLayer.removeChild(group.container);
      trailsLayer.removeChild(group.trail);
      trailsLayer.removeChild(group.trailGlow);
      vfxLayer.removeChild(group.boostGlow);
      playerGroups.delete(id);
      smoothCorrections.delete(id); // Clean up corrections
    }
  }

  // Clean up expired smooth corrections
  const now = performance.now();
  for (const [id, correction] of smoothCorrections) {
    if (now - correction.startTime > correction.duration) {
      smoothCorrections.delete(id);
    }
  }
  
  // Update minimap
  updateMinimap(gameState);

  // Update VFX
  updateSparks();
  updateExhaust();



  // Elimination detection for VFX (moved from drawPlayer)
  for (const p of players) {
    const prev = previousAlive.get(p.id);
    if (prev === undefined) previousAlive.set(p.id, !!p.isAlive);
    else if (prev && !p.isAlive) {
      spawnEliminationSparks(p.sperm.position.x, p.sperm.position.y);
      if (p.id === state.playerId) {
        if (!flashRect) { flashRect = new PIXI.Graphics(); screenLayer.addChild(flashRect); }
        flashRect.clear();
        flashRect.rect(0, 0, app.screen.width, app.screen.height);
        flashRect.fill({ color: 0xff4444, alpha: 0.18 });
        setTimeout(() => { if (flashRect) flashRect.clear(); }, 140);
        sfx.hit();
      }
      previousAlive.set(p.id, false);
    } else if (!prev && p.isAlive) {
      previousAlive.set(p.id, true);
    }
  }

  // Match timer (server-driven)
  latestServerTimestamp = gameState.timestamp;
  if (!matchTimerStartMs && gotGameStarting) matchTimerStartMs = latestServerTimestamp;
  if (matchTimerStartMs) {
    const elapsed = Math.max(0, latestServerTimestamp - matchTimerStartMs);
    const mm = Math.floor(elapsed / 60000);
    const ss = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    elements.roundTimer.textContent = `${mm}:${ss}`;
  }

  // Leaderboard
  updateLeaderboard();
}

function renderInterpolated(gameState: GameStateUpdateMessage['payload']): void {
  // Same as renderGame but does not clear snapshots
  renderGame(gameState);
}

// Create a cached "biohazard" danger texture used for the void outside the arena
function createDangerTexture(_app: PIXI.Application): void {
  if (dangerTexture) return;
  try {
    if (typeof document === 'undefined') {
      dangerTexture = PIXI.Texture.WHITE;
      return;
    }
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      dangerTexture = PIXI.Texture.WHITE;
      return;
    }

    // Dark red background
    ctx.fillStyle = '#190009';
    ctx.fillRect(0, 0, size, size);

    // Diagonal hazard stripes
    ctx.fillStyle = '#ff2745';
    const stripeWidth = 10;
    for (let offset = -size; offset < size * 2; offset += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + stripeWidth, 0);
      ctx.lineTo(offset + stripeWidth + size, size);
      ctx.lineTo(offset + size, size);
      ctx.closePath();
      ctx.fill();
    }

    dangerTexture = PIXI.Texture.from(canvas);
  } catch {
    dangerTexture = PIXI.Texture.WHITE;
  }
}

function drawArena(world: { width: number; height: number }): void {
  if (!arenaLayer) return;

  const prevWidth = cachedWorldSize?.w ?? null;
  const worldChanged = !cachedWorldSize || cachedWorldSize.w !== world.width || cachedWorldSize.h !== world.height;
  cachedWorldSize = { w: world.width, h: world.height };

  // Detect shrink: current width smaller than previous
  const shrinkingNow = prevWidth !== null && world.width < prevWidth;
  lastWorldWidth = world.width;

  // Danger pattern texture (cached)
  if (!dangerTexture) {
    createDangerTexture(app);
  }

  // Lazily create void sprites and arena primitives
  if (!dangerTop || !dangerBottom || !dangerLeft || !dangerRight) {
    dangerTop = new PIXI.TilingSprite({ texture: dangerTexture || PIXI.Texture.WHITE, width: 1, height: 1 });
    dangerBottom = new PIXI.TilingSprite({ texture: dangerTexture || PIXI.Texture.WHITE, width: 1, height: 1 });
    dangerLeft = new PIXI.TilingSprite({ texture: dangerTexture || PIXI.Texture.WHITE, width: 1, height: 1 });
    dangerRight = new PIXI.TilingSprite({ texture: dangerTexture || PIXI.Texture.WHITE, width: 1, height: 1 });
    arenaBorder = new PIXI.Graphics();
    arenaGrid = new PIXI.Graphics();
    arenaLayer.addChild(dangerTop, dangerBottom, dangerLeft, dangerRight, arenaBorder, arenaGrid);
  }

  // Layout danger "void" around the safe world rectangle
  const pad = Math.max(800, Math.max(world.width, world.height));
  const totalWidth = world.width + pad * 2;

  if (dangerTop && dangerBottom && dangerLeft && dangerRight) {
    // Top strip
    dangerTop.x = -pad;
    dangerTop.y = -pad;
    dangerTop.width = totalWidth;
    dangerTop.height = pad;

    // Bottom strip
    dangerBottom.x = -pad;
    dangerBottom.y = world.height;
    dangerBottom.width = totalWidth;
    dangerBottom.height = pad;

    // Left strip
    dangerLeft.x = -pad;
    dangerLeft.y = 0;
    dangerLeft.width = pad;
    dangerLeft.height = world.height;

    // Right strip
    dangerRight.x = world.width;
    dangerRight.y = 0;
    dangerRight.width = pad;
    dangerRight.height = world.height;
  }

  // Arena border with dynamic color/alpha when shrinking
  if (arenaBorder) {
    arenaBorder.clear();
    const borderColor = shrinkingNow ? 0xff4444 : 0x00d4ff;
    const alpha = shrinkingNow
      ? 0.5 + Math.sin(Date.now() / 200) * 0.5
      : 0.95;
    arenaBorder.rect(0, 0, world.width, world.height);
    arenaBorder.stroke({ width: 3, color: borderColor, alpha });
  }

  // Grid only needs to be recomputed when size changes
  if (arenaGrid && worldChanged) {
    arenaGrid.clear();
    arenaGrid.stroke({ width: 1, color: 0x0a6ea6, alpha: 0.35 });
    for (let x = 200; x < world.width; x += 200) {
      arenaGrid.moveTo(x, 0); arenaGrid.lineTo(x, world.height);
    }
    for (let y = 200; y < world.height; y += 200) {
      arenaGrid.moveTo(0, y); arenaGrid.lineTo(world.width, y);
    }
    arenaGrid.stroke({ width: 1, color: 0x0aa67a, alpha: 0.35 });
  }

  // Trigger cinematic zone warning only once when shrink begins
  if (shrinkingNow && !zoneWarningTriggered && gameEffects) {
    try { gameEffects.showZoneWarning(1); } catch {}
    zoneWarningTriggered = true;
  }
}

function ensurePlayerGroup(id: string): PlayerRenderGroup {
  let group = playerGroups.get(id);
  if (group) return group;
  const container = new PIXI.Container();

  // Ensure textures exist before creating renderers
  if (!spermTexture || !trailTexture) {
    generateSpermTexture(app);
    generateTrailTexture(app);
  }

  const sperm = new PIXI.Sprite(spermTexture || PIXI.Texture.WHITE);
  if (spermAnchor) {
    sperm.anchor.set(spermAnchor.x, spermAnchor.y);
  } else {
    sperm.anchor.set(0.5);
  }
  container.addChild(sperm);

  // Preallocate rope geometry for trails (shared points array for main + glow ropes)
  const ropePoints: PIXI.Point[] = [];
  for (let i = 0; i < TRAIL_SEGMENTS; i++) {
    ropePoints.push(new PIXI.Point(0, 0));
  }

  const trail = new (PIXI as any).MeshRope(trailTexture || PIXI.Texture.WHITE, ropePoints);
  trail.autoUpdate = true;

  const trailGlow = new (PIXI as any).MeshRope(trailTexture || PIXI.Texture.WHITE, ropePoints);
  trailGlow.autoUpdate = true;
  trailGlow.alpha = 0;
  trailGlow.scale.y = 1.5;
  trailGlow.blendMode = 'add';

  const boostGlow = new PIXI.Graphics();
  boostGlow.blendMode = 'add';

  playersLayer.addChild(container);
  trailsLayer.addChild(trail);
  trailsLayer.addChild(trailGlow);
  vfxLayer.addChild(boostGlow);

  group = { container, sperm, trail, trailGlow, boostGlow };
  playerGroups.set(id, group);
  return group;
}

function updatePlayerGroup(group: PlayerRenderGroup, player: GameStateUpdateMessage['payload']['players'][0]): void {
  // Trails rendered as MeshRope ribbons
  const trailHistory = player.trail as TrailPoint[];
  const rope = group.trail as any;
  const glowRope = group.trailGlow as any;
  const isSelf = player.id === state.playerId;
  const speed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
  const color = isSelf ? 0x00d4ff : 0xff6b6b;
  const boosting = !!(player as any).status?.boosting;

  if (!trailHistory || trailHistory.length < 2 || !rope || !rope.points) {
    if (rope) rope.visible = false;
    if (glowRope) glowRope.visible = false;
  } else {
    rope.visible = true;
    rope.tint = color;

    const points = rope.points as PIXI.Point[];
    const maxPoints = points.length;
    const srcLen = Math.min(trailHistory.length, maxPoints);

    // Get current timestamp for fade calculations
    const now = Date.now();

    // Calculate fade-out based on trail point expiration
    // Find the earliest expiration time in the trail
    let earliestExpiration = Infinity;
    let latestExpiration = 0;
    for (const point of trailHistory) {
      if (point.expiresAt < earliestExpiration) earliestExpiration = point.expiresAt;
      if (point.expiresAt > latestExpiration) latestExpiration = point.expiresAt;
    }

    // Calculate overall trail alpha based on expiration
    let trailAlpha = 1.0;
    if (earliestExpiration !== Infinity) {
      const timeUntilExpiration = earliestExpiration - now;
      const totalLifetime = latestExpiration - earliestExpiration + TRAIL.FADE_OUT_DURATION_MS;

      // Fade out starts 2 seconds before expiration
      if (timeUntilExpiration < TRAIL.FADE_OUT_DURATION_MS) {
        trailAlpha = Math.max(0, timeUntilExpiration / TRAIL.FADE_OUT_DURATION_MS);
      }
    }

    rope.alpha = trailAlpha;

    // Sample from latest trail points backwards into the rope geometry
    const step = (trailHistory.length - 1) / Math.max(1, srcLen - 1);
    const offset = maxPoints - srcLen;
    for (let i = 0; i < srcLen; i++) {
      const srcIndex = Math.floor(i * step);
      const src = trailHistory[trailHistory.length - 1 - srcIndex]; // newest → head
      const p = points[offset + i];
      p.x = src.x;
      p.y = src.y;
    }
    // Extend the far tail with the oldest sampled point
    for (let i = 0; i < offset; i++) {
      points[i].x = points[offset].x;
      points[i].y = points[offset].y;
    }

    // Apply lightweight sine-wave wiggle along the rope for organic motion
    const nowTime = performance.now() * 0.004;
    const speedFactor = 1.0 + Math.min(1.5, speed / 280);
    for (let i = 1; i < maxPoints - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const tNorm = i / (maxPoints - 1); // 0 at head → 1 at tail
      const ampBase = isSelf ? 6 : 4;
      const amp = ampBase * tNorm;
      const wave = Math.sin(nowTime + tNorm * 5.0) * amp * speedFactor;
      curr.x += nx * wave;
      curr.y += ny * wave;
    }

    if (glowRope) {
      glowRope.visible = isSelf && boosting;
      glowRope.tint = color;
      glowRope.alpha = boosting ? 0.22 * trailAlpha : 0;
    }
  }

  // Player container/spermatozoide - with smooth correction for local player
  const isOwnPlayer = player.id === state.playerId;
  const spermColor = isOwnPlayer ? 0x00ff88 : 0xff6b6b;
  group.sperm.tint = spermColor;

  // Apply smooth position correction for local player
  let renderX = player.sperm.position.x;
  let renderY = player.sperm.position.y;

  if (isOwnPlayer) {
    const currentPos = group.container.position;
    const dist = Math.hypot(renderX - currentPos.x, renderY - currentPos.y);

    // If position difference is significant, start smooth correction
    if (dist > 2) {
      const existing = smoothCorrections.get(player.id);
      if (!existing || performance.now() - existing.startTime > existing.duration) {
        // Start new smooth correction
        smoothCorrections.set(player.id, {
          currentPos: { x: currentPos.x, y: currentPos.y },
          targetPos: { x: renderX, y: renderY },
          startTime: performance.now(),
          duration: CORRECTION_DURATION_MS
        });
      }
    }

    // Apply smooth correction if active
    const correction = smoothCorrections.get(player.id);
    if (correction && performance.now() - correction.startTime < correction.duration) {
      const elapsed = performance.now() - correction.startTime;
      const t = Math.min(1, elapsed / correction.duration);
      // Smooth easing function (ease-out)
      const easeT = 1 - Math.pow(1 - t, 3);
      renderX = correction.currentPos.x + (correction.targetPos.x - correction.currentPos.x) * easeT;
      renderY = correction.currentPos.y + (correction.targetPos.y - correction.currentPos.y) * easeT;
    }
  }

  group.container.position.set(renderX, renderY);
  group.container.rotation = player.sperm.angle;

  // Propulsion glow (small Graphics triangle behind head)
  group.boostGlow.clear();
  if (boosting) {
    const hx = Math.cos(player.sperm.angle), hy = Math.sin(player.sperm.angle);
    const backX = -hx * 18, backY = -hy * 18;
    group.boostGlow.moveTo(backX, backY);
    group.boostGlow.lineTo(backX - hy * 10, backY + hx * 10);
    group.boostGlow.lineTo(backX + hy * 10, backY - hx * 10);
    group.boostGlow.closePath();
    group.boostGlow.fill({ color: 0xffd73d, alpha: 0.28 });
    // Spawn propulsion puffs at world position
    spawnExhaustPuffs(player.sperm.position.x + backX, player.sperm.position.y + backY, player.sperm.angle);
  }
}

// replaced by pooled update

function spawnEliminationSparks(x: number, y: number): void {
  const count = 16 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, 2);
    g.fill({ color: 0xff6b6b, alpha: 0.9 });
    const a = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 220;
    const s: Spark = { g, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 500 + Math.random() * 300, maxLife: 800 };
    g.position.set(x, y);
    vfxLayer.addChild(g);
    sparks.push(s);
  }
}

function updateSparks(): void {
  if (!sparks.length) return;
  const dt = app.ticker.deltaMS;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.life <= 0) {
      vfxLayer.removeChild(s.g);
      sparks.splice(i, 1);
      continue;
    }
    const t = 1 - (s.life / s.maxLife);
    s.g.alpha = 1 - t;
    s.g.position.x += s.vx * (dt / 1000);
    s.g.position.y += s.vy * (dt / 1000);
  }
}

function spawnExhaustPuffs(x: number, y: number, angle: number): void {
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const g = new PIXI.Graphics();
    const r = 2 + Math.random() * 3;
    g.circle(0, 0, r);
    g.fill({ color: 0xffd73d, alpha: 0.6 });
    g.blendMode = 'add';
    const spread = 0.5;
    const a = angle + Math.PI + (Math.random() - 0.5) * spread;
    const speed = 120 + Math.random() * 80;
    const p: Puff = { g, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 180 + Math.random() * 120, maxLife: 300 };
    g.position.set(x, y);
    vfxLayer.addChild(g);
    exhaustPuffs.push(p);
  }
}

function updateExhaust(): void {
  if (!exhaustPuffs.length) return;
  const dt = app.ticker.deltaMS;
  for (let i = exhaustPuffs.length - 1; i >= 0; i--) {
    const p = exhaustPuffs[i];
    p.life -= dt;
    if (p.life <= 0) {
      vfxLayer.removeChild(p.g);
      exhaustPuffs.splice(i, 1);
      continue;
    }
    const t = 1 - (p.life / p.maxLife);
    p.g.alpha = 0.6 * (1 - t);
    p.g.scale.set(1 + t * 0.6);
    p.g.position.x += p.vx * (dt / 1000);
    p.g.position.y += p.vy * (dt / 1000);
  }
}

function updateMinimap(gameState: GameStateUpdateMessage['payload']): void {
  const ctx = elements.minimap.getContext('2d');
  if (!ctx) return;
  
  const { width, height } = elements.minimap;
  const world = gameState.world;
  
  // Clear minimap
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(10, 10, 15, 0.8)';
  ctx.fillRect(0, 0, width, height);
  
  // Draw arena border
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, width - 4, height - 4);
  
  // Draw players (simple version without exact world bounds)
  const scaleX = (width - 8) / world.width;
  const scaleY = (height - 8) / world.height;
  
  gameState.players.forEach((player) => {
    const x = 4 + (player.sperm.position.x * scaleX);
    const y = 4 + (player.sperm.position.y * scaleY);
    
    ctx.fillStyle = player.id === state.playerId ? '#00d4ff' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateLeaderboard(): void {
  if (!elements.leaderboard) return;
  if (snapshots.length === 0) return;
  const latest = snapshots[snapshots.length - 1].state;
  const alive = latest.players.filter(p => p.isAlive);
  const top = alive.slice(0, 5);
  const html = top.map((p, i) => `<div class="lb-row"><span class="lb-rank">${i+1}</span> <span class="lb-name">${p.id.slice(0,8)}...</span></div>`).join('');
  elements.leaderboard.innerHTML = html;
}

// =================================================================================================
// Event Listeners
// =================================================================================================

function setupEventListeners(): void {
  // Landing screen
  elements.playCta.addEventListener('click', () => {
    showScreen('wallet');
  });
  
  // Wallet screen
  elements.connectWallet.addEventListener('click', async () => {
    if (await connectWallet()) {
      walletPublicKey = (await solana?.publicKey?.toString?.()) || walletPublicKey;
      elements.walletDisplay.style.display = 'block';
      if (walletPublicKey) elements.walletAddress.textContent = `${walletPublicKey.slice(0,4)}…${walletPublicKey.slice(-4)}`;
      showScreen('mode');
    }
  });
  
  elements.walletBack.addEventListener('click', () => {
    showScreen('landing');
  });
  
  // Mode screen - Tournament card selection and joining
  elements.tournamentCards.forEach(card => {
    card.addEventListener('click', () => {
      const tier = parseInt(card.dataset.tier!) as 1 | 5 | 25 | 100;
      setSelectedTier(tier);
    });
  });
  
  elements.tournamentJoinBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent card click
      try {
        const tier = parseInt(btn.dataset.tier!) as 1 | 5 | 25 | 100;
        setSelectedTier(tier);
        state.selectedMode = 'tournament';
        updateMatchInfo();
        await connectToServer();
        // After server connection, the SIWS/auth flow will request entry fee tx
        await joinLobby();
      } catch (error) {
        console.error('❌ Failed to connect to server:', error);
        hideLoading();
      }
    });
  });

  // Hidden practice quick-link under tournament grid
  const goPractice = document.getElementById('go-practice');
  if (goPractice) {
    goPractice.addEventListener('click', () => {
      state.selectedMode = 'practice';
      showScreen('lobby'); // server will accept practice mode join on authenticate
    });
  }
  
  elements.modeBack.addEventListener('click', () => {
    showScreen('wallet');
  });
  
  // Lobby screen
  elements.lobbyLeave.addEventListener('click', () => {
    if (ws) ws.close();
    showScreen('mode');
  });
  
  // Round end modal
  elements.playAgain.addEventListener('click', async () => {
    hideRoundEnd();
    await joinLobby();
  });
  
  elements.returnLobby.addEventListener('click', () => {
    hideRoundEnd();
    showScreen('lobby');
  });
}

// =================================================================================================
// Background Particles
// =================================================================================================

function createParticles(): void {
  const particlesContainer = document.getElementById('bg-particles')!;
  
  // Create racing-themed particles (tire marks, sparks, etc.)
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    
    // Random particle type
    const particleType = Math.random();
    if (particleType < 0.4) {
      // Spark particles
      particle.style.width = Math.random() * 3 + 1 + 'px';
      particle.style.height = particle.style.width;
      particle.style.background = `rgba(255, 217, 61, ${Math.random() * 0.4 + 0.2})`;
      particle.style.borderRadius = '50%';
      particle.style.boxShadow = '0 0 6px rgba(255, 217, 61, 0.5)';
    } else if (particleType < 0.7) {
      // Drift trail particles
      particle.style.width = Math.random() * 6 + 2 + 'px';
      particle.style.height = '2px';
      particle.style.background = `rgba(${Math.random() > 0.5 ? '0, 212, 255' : '255, 107, 107'}, ${Math.random() * 0.3 + 0.1})`;
      particle.style.borderRadius = '1px';
    } else {
      // Small circular particles
      particle.style.width = Math.random() * 4 + 1 + 'px';
      particle.style.height = particle.style.width;
      particle.style.background = `rgba(0, 212, 255, ${Math.random() * 0.2 + 0.1})`;
      particle.style.borderRadius = '50%';
    }
    
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animation = `drift-float ${Math.random() * 25 + 15}s linear infinite`;
    particle.style.animationDelay = Math.random() * 25 + 's';
    
    particlesContainer.appendChild(particle);
  }
  
  // Add racing-themed animation CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes drift-float {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg);
        opacity: 0;
      }
      5% {
        opacity: 1;
      }
      95% {
        opacity: 1;
      }
      100% {
        transform: translateY(-100px) translateX(${Math.random() * 300 - 150}px) rotate(${Math.random() * 720 - 360}deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// =================================================================================================
// Initialization
// =================================================================================================

async function updateWalletButton(): Promise<void> {
  const detection = await detectWallet();
  const walletTitle = elements.connectWallet.querySelector('.wallet-title') as HTMLElement;
  const walletSubtitle = elements.connectWallet.querySelector('.wallet-subtitle') as HTMLElement;
  
  if (detection.found && walletTitle && walletSubtitle) {
    walletTitle.textContent = `Connect ${detection.name}`;
    walletSubtitle.textContent = `Use your ${detection.name} wallet to sign in`;
  }
}

async function init(): Promise<void> {
  console.log('🚀 Initializing SpermRace.io...');

  // Debug: Check if elements exist
  console.log('Screens found:', {
    landing: !!screens.landing,
    wallet: !!screens.wallet,
    mode: !!screens.mode,
    lobby: !!screens.lobby,
    game: !!screens.game
  });

  setupEventListeners();
  createParticles();
  await fetchSolPrice();
  // Age counter for landing price timestamp
setInterval(() => {
    const ageEl = elements.landingPriceAge;
    if (!ageEl) return;
    const current = parseInt(ageEl.textContent || '0');
    ageEl.textContent = String(Math.min(current + 1, 999));
  }, 1000);
  // Refresh price every 30s
  setInterval(fetchSolPrice, 30000);
  setSelectedTier(1);
  await updateWalletButton();
  
  // Start with landing screen
  showScreen('landing');
  // Ensure background starts on first paint
  try { await startSpermBackground(); } catch {}

  console.log('✅ SpermRace.io initialized');
}

// Start the application
init().catch(console.error);

