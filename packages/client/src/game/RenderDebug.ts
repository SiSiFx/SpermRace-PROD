import * as PIXI from 'pixi.js';

export type RenderDebugSample = {
  id: string;
  serverPos?: { x: number; y: number };
  worldPos?: { x: number; y: number };
  spritePos?: { x: number; y: number };
};

export type RenderDebugSnapshot = {
  knownEntities: number;
  renderedEntities: number;
  stageChildren: number;
  worldChildren: number;
  worldBounds?: { width: number; height: number };
  camera?: { x: number; y: number; zoom: number };
  playerWorldPos?: { x: number; y: number };
  sample?: RenderDebugSample;
};

export type RenderDebugGetSnapshot = () => RenderDebugSnapshot;

function fmt(n: number | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return 'NaN';
  return n.toFixed(digits);
}

export class RenderDebug {
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;
  private getSnapshot: RenderDebugGetSnapshot;

  private overlayContainer: PIXI.Container;
  private overlayBg: PIXI.Graphics;
  private overlayText: PIXI.Text;

  private worldGfx: PIXI.Graphics;
  private lastLogAt = 0;

  constructor(opts: {
    app: PIXI.Application;
    worldContainer: PIXI.Container;
    getSnapshot: RenderDebugGetSnapshot;
  }) {
    this.app = opts.app;
    this.worldContainer = opts.worldContainer;
    this.getSnapshot = opts.getSnapshot;

    try {
      this.app.stage.sortableChildren = true;
    } catch {}

    this.overlayContainer = new PIXI.Container();
    this.overlayContainer.zIndex = 999999;

    this.overlayBg = new PIXI.Graphics();
    this.overlayContainer.addChild(this.overlayBg);

    this.overlayText = new PIXI.Text('', {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      fill: 0x00ff88,
      lineHeight: 14,
    } as any);
    this.overlayText.x = 8;
    this.overlayText.y = 8;
    this.overlayContainer.addChild(this.overlayText);

    try {
      this.app.stage.addChild(this.overlayContainer);
    } catch {}

    this.worldGfx = new PIXI.Graphics();
    this.worldGfx.zIndex = 999998;
    try {
      this.worldContainer.addChild(this.worldGfx);
    } catch {}
  }

  update(dtSeconds: number): void {
    const snap = this.getSnapshot();

    const renderer: any = this.app.renderer as any;
    const rw = Number(renderer?.width) || 0;
    const rh = Number(renderer?.height) || 0;
    const res = Number(renderer?.resolution) || 1;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    const fps = this.app.ticker?.FPS || 0;

    const lines: string[] = [];
    lines.push(`FPS ${fmt(fps, 1)} | dt ${fmt(dtSeconds * 1000, 2)}ms`);
    lines.push(`renderer ${rw}x${rh} res=${fmt(res, 2)} dpr=${fmt(dpr, 2)}`);
    lines.push(`stage.children=${snap.stageChildren} world.children=${snap.worldChildren}`);
    lines.push(`entities known=${snap.knownEntities} rendered=${snap.renderedEntities}`);

    if (snap.sample) {
      const sp = snap.sample;
      const s1 = sp.serverPos ? `${fmt(sp.serverPos.x, 1)},${fmt(sp.serverPos.y, 1)}` : '-';
      const s2 = sp.worldPos ? `${fmt(sp.worldPos.x, 1)},${fmt(sp.worldPos.y, 1)}` : '-';
      const s3 = sp.spritePos ? `${fmt(sp.spritePos.x, 1)},${fmt(sp.spritePos.y, 1)}` : '-';
      lines.push(`sample ${sp.id} server(${s1}) world(${s2}) sprite(${s3})`);
    }

    this.overlayText.text = lines.join('\n');

    // Overlay background
    try {
      const bounds = this.overlayText.getBounds();
      this.overlayBg
        .clear()
        .roundRect(4, 4, bounds.width + 16, bounds.height + 12, 8)
        .fill({ color: 0x000000, alpha: 0.55 })
        .stroke({ width: 1, color: 0x00ff88, alpha: 0.35 });
    } catch {}

    this.drawWorldDebug(snap);

    const now = Date.now();
    if (now - this.lastLogAt > 2000) {
      this.lastLogAt = now;
      this.logThrottled(snap);
    }
  }

  private drawWorldDebug(snap: RenderDebugSnapshot): void {
    const cam = snap.camera;
    const worldW = snap.worldBounds?.width;
    const worldH = snap.worldBounds?.height;

    this.worldGfx.clear();

    // World bounds (centered coordinate system)
    if (worldW && worldH) {
      this.worldGfx
        .rect(-worldW / 2, -worldH / 2, worldW, worldH)
        .stroke({ width: 2, color: 0x00ff88, alpha: 0.35 });
    }

    // Origin axes
    this.worldGfx
      .moveTo(-30, 0)
      .lineTo(30, 0)
      .moveTo(0, -30)
      .lineTo(0, 30)
      .stroke({ width: 2, color: 0xff00ff, alpha: 0.85 });

    // Viewport rectangle in world coords
    if (cam && Number.isFinite(cam.zoom) && cam.zoom > 0) {
      const viewW = this.app.screen.width;
      const viewH = this.app.screen.height;
      const left = (-cam.x) / cam.zoom;
      const top = (-cam.y) / cam.zoom;
      const w = viewW / cam.zoom;
      const h = viewH / cam.zoom;
      this.worldGfx
        .rect(left, top, w, h)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.22 });
    }

    // Crosshair on player
    if (snap.playerWorldPos && Number.isFinite(snap.playerWorldPos.x) && Number.isFinite(snap.playerWorldPos.y)) {
      const x = snap.playerWorldPos.x;
      const y = snap.playerWorldPos.y;
      this.worldGfx
        .moveTo(x - 20, y)
        .lineTo(x + 20, y)
        .moveTo(x, y - 20)
        .lineTo(x, y + 20)
        .stroke({ width: 2, color: 0x22d3ee, alpha: 0.9 });
    }
  }

  private logThrottled(snap: RenderDebugSnapshot): void {
    const wc = this.worldContainer as any;
    const cam = snap.camera;

    const fmtContainer = (c: any) => ({
      pos: { x: fmt(c?.position?.x), y: fmt(c?.position?.y) },
      scale: { x: fmt(c?.scale?.x), y: fmt(c?.scale?.y) },
      pivot: { x: fmt(c?.pivot?.x), y: fmt(c?.pivot?.y) },
      rot: fmt(c?.rotation),
      alpha: fmt(c?.alpha),
      visible: !!c?.visible,
    });

    try {
      // eslint-disable-next-line no-console
      console.log('[render][dbg]', {
        worldContainer: fmtContainer(wc),
        camera: cam
          ? { x: fmt(cam.x), y: fmt(cam.y), zoom: fmt(cam.zoom) }
          : null,
        entities: { known: snap.knownEntities, rendered: snap.renderedEntities },
        sample: snap.sample || null,
      });
    } catch {}
  }

  destroy(): void {
    try {
      this.overlayContainer.parent?.removeChild(this.overlayContainer);
    } catch {}
    try {
      this.worldGfx.parent?.removeChild(this.worldGfx);
    } catch {}
    try {
      this.overlayContainer.destroy({ children: true });
    } catch {}
    try {
      this.worldGfx.destroy();
    } catch {}
  }
}
