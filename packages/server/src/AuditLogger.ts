import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

type AuditEntry = {
  ts: number;
  type: string;
  payload?: any;
  server?: {
    pid: number;
    env: string;
    build?: string;
  };
  prevHash?: string;
  hash?: string;
};

function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      return JSON.stringify({ error: 'unserializable' });
    } catch {
      return '{"error":"unserializable"}';
    }
  }
}

function dayStampUtc(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class AuditLogger {
  private dir: string;
  private stream: fs.WriteStream | null = null;
  private currentDay: string | null = null;
  private lastHash: string = '0'.repeat(64);
  private build: string | undefined;

  constructor(opts: { dir: string; build?: string }) {
    this.dir = opts.dir;
    this.build = opts.build;
  }

  private ensureStream(ts: number): void {
    const day = dayStampUtc(ts);
    if (this.stream && this.currentDay === day) return;

    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch { }

    try {
      this.stream?.end();
    } catch { }

    const file = path.join(this.dir, `audit-${day}.jsonl`);
    try {
      this.stream = fs.createWriteStream(file, { flags: 'a' });
      this.currentDay = day;
    } catch (e) {
      this.stream = null;
      this.currentDay = null;
      try { console.warn('[AUDIT] failed to open log file', file, e); } catch { }
    }
  }

  log(type: string, payload?: any): void {
    const ts = Date.now();
    this.ensureStream(ts);
    if (!this.stream) return;

    const entry: AuditEntry = {
      ts,
      type,
      payload,
      server: {
        pid: process.pid,
        env: (process.env.NODE_ENV || 'unknown').toLowerCase(),
        build: this.build,
      },
      prevHash: this.lastHash,
    };

    const body = safeJsonStringify({ ts: entry.ts, type: entry.type, payload: entry.payload, server: entry.server, prevHash: entry.prevHash });
    const hash = createHash('sha256').update(body).digest('hex');
    entry.hash = hash;
    this.lastHash = hash;

    try {
      this.stream.write(`${body.slice(0, -1)},\"hash\":\"${hash}\"}\n`);
    } catch { }
  }
}

