import { Car, ZoneBounds, ArenaBounds } from './types';

export class UISystem {
  private container: HTMLElement;
  private radarCanvas: HTMLCanvasElement | null = null;
  private radarCtx: CanvasRenderingContext2D | null = null;
  private boostBarEl: HTMLDivElement | null = null;
  private aliveCountEl: HTMLDivElement | null = null;
  private killFeedEl: HTMLDivElement | null = null;
  private recentKills: Array<{ killer: string; victim: string; time: number }> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.setup();
  }

  private setup(): void {
    // Create UI container
    const ui = document.createElement('div');
    ui.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
    this.container.appendChild(ui);

    // Radar
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.width = 150;
    this.radarCanvas.height = 150;
    this.radarCanvas.style.cssText = 'position:absolute;bottom:20px;right:20px;border-radius:50%;background:rgba(0,0,0,0.5);';
    ui.appendChild(this.radarCanvas);
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Boost bar
    this.boostBarEl = document.createElement('div');
    this.boostBarEl.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:200px;height:8px;background:rgba(0,0,0,0.5);border-radius:4px;overflow:hidden;';
    this.boostBarEl.innerHTML = '<div style="height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1);width:100%;transition:width 0.1s;"></div>';
    ui.appendChild(this.boostBarEl);

    // Alive count
    this.aliveCountEl = document.createElement('div');
    this.aliveCountEl.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:24px;color:white;font-weight:bold;text-shadow:0 2px 4px rgba(0,0,0,0.5);';
    ui.appendChild(this.aliveCountEl);

    // Kill feed
    this.killFeedEl = document.createElement('div');
    this.killFeedEl.style.cssText = 'position:absolute;top:60px;right:20px;font-size:14px;color:white;text-align:right;';
    ui.appendChild(this.killFeedEl);
  }

  updateRadar(
    player: Car | null,
    enemies: Car[],
    arena: ArenaBounds,
    zone: ZoneBounds
  ): void {
    if (!this.radarCtx || !this.radarCanvas) return;
    const ctx = this.radarCtx;
    const size = this.radarCanvas.width;
    const center = size / 2;
    const scale = size / arena.width;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Zone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    const zoneW = (zone.right - zone.left) * scale;
    const zoneH = (zone.bottom - zone.top) * scale;
    const zoneX = center + zone.left * scale + arena.width * scale / 2;
    const zoneY = center + zone.top * scale + arena.height * scale / 2;
    ctx.strokeRect(zoneX, zoneY, zoneW, zoneH);

    // Enemies
    ctx.fillStyle = '#ff4444';
    for (const enemy of enemies) {
      if (enemy.destroyed) continue;
      const ex = center + enemy.x * scale;
      const ey = center + enemy.y * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    if (player && !player.destroyed) {
      ctx.fillStyle = '#22d3ee';
      const px = center + player.x * scale;
      const py = center + player.y * scale;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  updateBoostBar(energy: number, maxEnergy: number): void {
    if (!this.boostBarEl) return;
    const bar = this.boostBarEl.firstElementChild as HTMLDivElement;
    if (bar) {
      bar.style.width = `${(energy / maxEnergy) * 100}%`;
    }
  }

  updateAliveCount(count: number): void {
    if (!this.aliveCountEl) return;
    this.aliveCountEl.textContent = `${count} ALIVE`;
  }

  addKill(killer: string, victim: string): void {
    this.recentKills.unshift({ killer, victim, time: Date.now() });
    if (this.recentKills.length > 5) this.recentKills.pop();
    this.renderKillFeed();
  }

  private renderKillFeed(): void {
    if (!this.killFeedEl) return;
    const now = Date.now();
    this.recentKills = this.recentKills.filter(k => now - k.time < 5000);
    this.killFeedEl.innerHTML = this.recentKills
      .map(k => `<div style="margin:4px 0;opacity:${1 - (now - k.time) / 5000}">${k.killer} → ${k.victim}</div>`)
      .join('');
  }

  destroy(): void {
    this.radarCanvas?.remove();
    this.boostBarEl?.remove();
    this.aliveCountEl?.remove();
    this.killFeedEl?.remove();
  }
}
