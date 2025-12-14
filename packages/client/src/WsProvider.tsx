import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
// API base for HTTP calls from the client.
// For any spermrace.io host (prod/dev/www), always use same-origin /api so we avoid CORS and
// let the frontend host proxy to the API.
const API_BASE: string = (() => {
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.endsWith('spermrace.io')) return '/api';
  } catch {}

  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'https://dev.spermrace.io/api';
    if (host.includes('spermrace.io')) return 'https://spermrace.io/api';
  } catch {}
  return '/api';
})();
import type { EntryFeeTier, GameMode, Lobby } from 'shared';
import { useWallet } from './WalletProvider';
import { handleSIWS } from './siws';
import { sendEntryFeeTransaction } from './walletUtils';

type Countdown = { remaining: number; startAtMs?: number } | null;

type WsPhase = 'idle' | 'connecting' | 'authenticating' | 'lobby' | 'game' | 'ended';

type WsState = {
  connected: boolean;
  phase: WsPhase;
  playerId: string | null;
  lobby: Lobby | null;
  countdown: Countdown;
  entryFee: { pending: boolean; verified: boolean };
  lastError: string | null;
  joining: boolean;
  game: {
    timestamp: number;
    players: Array<{
      id: string;
      isAlive: boolean;
      sperm: { position: { x: number; y: number }; angle: number; color: string };
      trail: Array<{ x: number; y: number; expiresAt?: number; createdAt?: number }>;
      status?: { boosting?: boolean; boostCooldownMs?: number; boostMaxCooldownMs?: number };
    }>;
    world: { width: number; height: number };
    items?: Array<{ id: string; type: 'dna'; x: number; y: number }>;
    aliveCount: number;
  } | null;
  hasFirstGameState?: boolean;
  kills: Record<string, number>;
  killFeed: Array<{ killerId?: string; victimId: string; ts: number }>;
  debugCollisions?: Array<{ victimId: string; killerId?: string; hit: { x: number; y: number }; segment?: { from: { x: number; y: number }; to: { x: number; y: number } }; ts: number }>;
  lastRound?: { winnerId: string; prizeAmount: number; txSignature?: string } | null;
  initialPlayers: string[];
  eliminationOrder: string[];
};

type JoinOpts = { entryFeeTier: EntryFeeTier; mode?: GameMode };

type WsApi = {
  state: WsState;
  connectAndJoin: (opts: JoinOpts) => Promise<void>;
  leave: () => void;
  signAuthentication: () => Promise<void>;
  sendInput: (target: { x: number; y: number }, accelerate: boolean, boost?: boolean) => void;
};

const Ctx = createContext<WsApi>({
  state: { connected: false, phase: 'idle', playerId: null, lobby: null, countdown: null, entryFee: { pending: false, verified: false }, lastError: null, joining: false, game: null, kills: {}, killFeed: [], lastRound: null, initialPlayers: [], eliminationOrder: [] },
  connectAndJoin: async () => {},
  leave: () => {},
  signAuthentication: async () => {},
  sendInput: () => {},
});

const DEFAULT_WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const ENV_WS = (import.meta as any).env?.VITE_WS_URL as string | undefined;
const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
const WS_URL = (() => {
  try {
    if (IS_LOCAL) return DEFAULT_WS_URL;
    if (ENV_WS && ENV_WS.trim()) {
      const trimmed = ENV_WS.trim();
      // Validate that the env var doesn't point to api.spermrace.io (common mistake)
      if (trimmed.includes('api.spermrace.io')) {
        console.warn('[WS] Invalid VITE_WS_URL contains api.spermrace.io, using fallback');
      } else if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
        const u = new URL(trimmed);
        if (!u.pathname || u.pathname === '/') u.pathname = '/ws';
        return u.toString();
      } else {
        const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
        const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return `${scheme}://${location.host}${path.includes('/ws') ? path : '/ws'}`;
      }
    }
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'wss://dev.spermrace.io/ws';
    if (host.includes('spermrace.io')) return 'wss://spermrace.io/ws';
    return DEFAULT_WS_URL;
  } catch { return DEFAULT_WS_URL; }
})();
const RPC_ENDPOINT = (import.meta as any).env?.VITE_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { provider, publicKey, connect, getLatest } = useWallet();
  const [state, setState] = useState<WsState>({ connected: false, phase: 'idle', playerId: null, lobby: null, countdown: null, entryFee: { pending: false, verified: false }, lastError: null, joining: false, game: null, kills: {}, killFeed: [], lastRound: null, initialPlayers: [], eliminationOrder: [], debugCollisions: [], hasFirstGameState: false });
  const wsRef = useRef<WebSocket | null>(null);
  const pendingJoinRef = useRef<JoinOpts | null>(null);
  const joinBusyRef = useRef<boolean>(false);
  const joinRetryTimerRef = useRef<number | null>(null);
  const siwsRef = useRef<{ message: string; nonce: string } | null>(null);
  const siwsRetryTimerRef = useRef<number | null>(null);
  const pendingAuthRef = useRef<{ publicKey: string; signedMessage: string; nonce: string } | null>(null);
  const lastInputSentRef = useRef<number>(0);
  const lastSentPayloadRef = useRef<{ target: { x: number; y: number }; accelerate: boolean; boost?: boolean } | null>(null);
  const lastBoostTsRef = useRef<number>(0);
  const expectedCloseRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const connectAndJoin = async (opts: JoinOpts) => {
    console.log(`[JOIN] Requested → mode=${opts.mode ?? 'tournament'} tier=$${opts.entryFeeTier}`);
    try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'join_requested', payload: { mode: opts.mode ?? 'tournament', tier: opts.entryFeeTier } }) }); } catch {}

    // ALWAYS get latest wallet state (React state may be stale)
    const latest = getLatest();
    let currentProvider = latest.provider;
    let currentPublicKey = latest.publicKey;
    console.log('[WALLET] Latest state →', currentPublicKey ? currentPublicKey.slice(0, 4) : 'null', currentProvider?.name);

    // Ensure wallet
    if (!currentPublicKey || !currentProvider) {
      console.log('[WALLET] Not connected → opening wallet');
      try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_wallet_missing' }) }); } catch {}
      const ok = await connect();
      if (!ok) {
        setState(s => ({ ...s, lastError: 'Wallet connection required' }));
        console.error('[WALLET] Connection failed');
        try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_wallet_failed' }) }); } catch {}
        return;
      }
      console.log('[WALLET] Connected');
      const latest2 = getLatest();
      currentProvider = latest2.provider;
      currentPublicKey = latest2.publicKey;
      console.log('[WALLET] Latest after connect →', currentPublicKey ? currentPublicKey.slice(0, 4) : 'null', currentProvider?.name);
    }
    if (!currentPublicKey || !currentProvider) {
      console.warn('[WALLET] connect() reported success but wallet data still unavailable');
      setState(s => ({ ...s, lastError: 'Wallet connection failed. Please try again.' }));
      try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_wallet_unavailable' }) }); } catch {}
      return;
    }
    pendingJoinRef.current = opts;
    // If socket exists
    if (wsRef.current) {
      const ready = wsRef.current.readyState;
      console.log('[WS] Socket exists, readyState:', ready, 'playerId:', state.playerId);
      try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_exists', payload: { readyState: ready, hasPlayerId: !!state.playerId } }) }); } catch {}
      // If already authenticated and socket is OPEN, send join now
      if (ready === WebSocket.OPEN && state.playerId) {
        console.log('[JOIN] WS open + authenticated → sending joinLobby');
        wsRef.current.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: opts.entryFeeTier, mode: opts.mode } }));
        joinBusyRef.current = false;
        setState(s => ({ ...s, phase: 'connecting', joining: true }));
        console.log('[JOIN] joinLobby sent (socket already authenticated)');
        try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_reuse_ws' }) }); } catch {}
        return;
      }
      // If CONNECTING/CLOSING/CLOSED, let the existing flow continue or reconnect below
      if (ready === WebSocket.CONNECTING) {
        console.log('[WS] Already CONNECTING → will join after authenticate');
        try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_connecting' }) }); } catch {}
        return; // wait for onopen -> siws -> authenticated to send join
      }
    }
    // Create a new connection (guard to avoid join spamming)
    if (joinBusyRef.current) {
      console.log('[WS] Join already busy, skipping');
      try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_join_busy' }) }); } catch {}
      return;
    }
    joinBusyRef.current = true;
    setState(s => ({ ...s, phase: 'connecting', joining: true }));

    // HTTP-based authentication (mobile-friendly)
    console.log('[HTTP AUTH] Starting authentication flow...');
    let sessionToken: string | null = null;

    try {
      // Step 1: Get challenge
      console.log('[HTTP AUTH] Fetching challenge...');
      const challengeResp = await fetch(`${API_BASE}/siws-challenge`);
      if (!challengeResp.ok) throw new Error('Failed to get challenge');
      const { message, nonce } = await challengeResp.json();
      console.log('[HTTP AUTH] Challenge received, nonce:', nonce.slice(0, 8));

      // Step 2: Sign the message (this will open Phantom on mobile)
      console.log('[HTTP AUTH] Requesting signature from wallet...');
      const auth = await handleSIWS(currentProvider, { message, nonce }, currentPublicKey);
      console.log('[HTTP AUTH] Signature received');

      // Step 3: Submit signed message to get session token
      console.log('[HTTP AUTH] Submitting signed message...');
      const authResp = await fetch(`${API_BASE}/siws-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: auth.publicKey,
          signedMessage: auth.signedMessage,
          message: message,
          nonce: auth.nonce
        })
      });

      if (!authResp.ok) {
        const errData = await authResp.json().catch(() => ({}));
        throw new Error(errData.error || 'Authentication failed');
      }

      const authData = await authResp.json();
      sessionToken = authData.sessionToken;
      console.log('[HTTP AUTH] ✓ Session token received:', sessionToken?.slice(0, 8) ?? 'unknown');

    } catch (e: any) {
      console.error('[HTTP AUTH] Failed:', e);
      setState(s => ({ ...s, lastError: e?.message || 'Authentication failed', phase: 'ended', joining: false }));
      joinBusyRef.current = false;
      try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_http_auth_failed', payload: { error: e?.message || String(e) } }) }); } catch {}
      return;
    }

    // Now connect WebSocket with session token
    const wsUrlWithToken = sessionToken ? `${WS_URL}?token=${sessionToken}` : WS_URL;
    console.log(`[WS] Connecting with HTTP auth token → url=${wsUrlWithToken.replace(/token=.+/, 'token=***')}`);
    try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_creating_with_token' }) }); } catch {}

    const attach = (sock: WebSocket, triedDefault = false) => {
      wsRef.current = sock;
      sock.onopen = () => {
        console.log('[WS] open');
        reconnectAttemptsRef.current = 0;
        setState(s => ({ ...s, connected: true }));
      };
      sock.onerror = (e: any) => {
        // Only retry fallback if we're on localhost
        if (!triedDefault && IS_LOCAL && WS_URL !== DEFAULT_WS_URL) {
          console.warn('[WS] error → retrying default /ws once');
          try { sock.close(); } catch {}
          const ws2 = new WebSocket(DEFAULT_WS_URL);
          attach(ws2, true);
          return;
        }
        console.error('[WS] error', e);
        setState(s => ({ ...s, lastError: e?.message || 'WS error' }));
      };
      sock.onclose = (ev: CloseEvent) => {
        console.warn(`[WS] close code=${ev.code} reason=${ev.reason || 'n/a'}`);
        try { fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_close', payload: { code: ev.code, reason: ev.reason || 'none', wasClean: ev.wasClean } }) }); } catch {}
        joinBusyRef.current = false;
        if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
        setState(s => ({ ...s, connected: false, phase: 'ended', joining: false }));
        wsRef.current = null;
        // Auto-reconnect if not an intentional leave and we have a pending intent
        const shouldReconnect = !expectedCloseRef.current && (pendingJoinRef.current != null || !!state.playerId || state.phase === 'lobby' || state.phase === 'game' || state.phase === 'authenticating');
        if (shouldReconnect) {
          const attempt = (reconnectAttemptsRef.current = reconnectAttemptsRef.current + 1);
          const delay = Math.min(15000, 1000 * Math.pow(2, attempt - 1));
          console.log(`[WS] scheduling reconnect in ${delay}ms (attempt ${attempt})`);
          if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
          reconnectTimerRef.current = (window as any).setTimeout(() => {
            try {
              console.log('[WS] reconnecting...');
              const ws3 = new WebSocket(WS_URL);
              attach(ws3, true);
            } catch (e) { console.error('[WS] reconnect failed to initiate', e); }
          }, delay);
        }
      };
      sock.onmessage = async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type) console.log(`[WS<=] ${msg.type}`);
          switch (msg.type) {
            case 'siwsChallenge': {
              // Do not early return; store challenge and enter authenticating state
              siwsRef.current = { message: msg.payload.message, nonce: msg.payload.nonce };
              setState(s => ({ ...s, phase: 'authenticating', joining: true }));
              console.log(`[SIWS] challenge received nonce=${String(msg.payload?.nonce || '').slice(0,8)}…`);

              // Check if we have pending auth from a previous signature (reconnection case)
              // BUT: we CANNOT resend the old signature because the nonce has changed!
              // We also CANNOT re-sign because it will open Phantom again and cause backgrounding
              // For now, just clear pending auth and user will need to try again
              if (pendingAuthRef.current) {
                console.log('[SIWS] Found pending auth but nonce has changed, clearing...');
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_auth_nonce_mismatch' }) }); } catch {}
                pendingAuthRef.current = null;
                // Fall through to normal signing flow
              }

              try {
                const latest = getLatest();
                const adapter = latest.provider ?? provider;
                const pk = latest.publicKey ?? publicKey ?? adapter?.publicKey?.toBase58?.();
                console.log('[SIWS] auto-sign attempt → adapter', adapter?.name, 'pk', pk ? pk.slice(0, 4) : 'none');
                if (!adapter || !pk) {
                  console.log('[SIWS] provider/publicKey not ready yet → scheduling quick retry');
                  if (siwsRetryTimerRef.current) { clearTimeout(siwsRetryTimerRef.current); siwsRetryTimerRef.current = null; }
                  siwsRetryTimerRef.current = (window as any).setTimeout(async () => {
                    try {
                      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                      if (!siwsRef.current) return;
                      const latestAttempt = getLatest();
                      const adapterAttempt = latestAttempt.provider ?? provider;
                      const pkAttempt = latestAttempt.publicKey ?? publicKey ?? adapterAttempt?.publicKey?.toBase58?.();
                      console.log('[SIWS] retry attempt → adapter', adapterAttempt?.name, 'pk', pkAttempt ? pkAttempt.slice(0, 4) : 'none');
                      if (!adapterAttempt || !pkAttempt) return;
                      const auth2 = await handleSIWS(adapterAttempt, siwsRef.current, pkAttempt);
                      wsRef.current.send(JSON.stringify({ type: 'authenticate', payload: auth2 }));
                      console.log('[SIWS] authenticate sent (retry)');
                    } catch (e) { console.warn('[SIWS] retry failed', e); }
                  }, 800);
                  break;
                }
                console.log('[SIWS] attempting auto-sign...');
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_siws_start' }) }); } catch {}
                const auth = await handleSIWS(adapter, msg.payload, pk);
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_siws_success' }) }); } catch {}

                // Store auth for potential reconnect (mobile browser backgrounding issue)
                pendingAuthRef.current = auth;

                // Check if WebSocket is still open after async signature
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                  console.warn('[SIWS] WebSocket closed during signature, will retry on reconnect');
                  try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_closed_during_siws' }) }); } catch {}
                  return;
                }
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_sending_auth', payload: { publicKey: auth.publicKey?.slice(0, 8) } }) }); } catch {}
                const authMessage = JSON.stringify({ type: 'authenticate', payload: auth });
                console.log('[SIWS] Auth message length:', authMessage.length, 'chars');
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_auth_size', payload: { size: authMessage.length } }) }); } catch {}

                // Longer delay for mobile browsers to stabilize after returning from Phantom
                console.log('[SIWS] Waiting 1 second for connection to stabilize...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Re-check connection after delay
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                  console.warn('[SIWS] WebSocket closed while waiting to send auth');
                  try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_closed_before_send' }) }); } catch {}
                  return;
                }

                try {
                  wsRef.current.send(authMessage);
                  console.log('[SIWS] authenticate sent via WebSocket');
                  try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_auth_sent' }) }); } catch {}
                } catch (sendErr: any) {
                  console.error('[SIWS] WebSocket send error:', sendErr);
                  try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_ws_send_error', payload: { error: sendErr?.message || String(sendErr) } }) }); } catch {}
                  throw sendErr;
                }
              } catch (e: any) {
                console.error('[SIWS] auto-sign failed', e);
                try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'debug_siws_failed', payload: { error: e?.message || String(e) } }) }); } catch {}
                console.log('[SIWS] waiting for manual sign via overlay button...');
                // As a fallback, schedule one auto-retry after 2s
                if (siwsRetryTimerRef.current) { clearTimeout(siwsRetryTimerRef.current); siwsRetryTimerRef.current = null; }
                siwsRetryTimerRef.current = (window as any).setTimeout(async () => {
                  try {
                    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                    if (!siwsRef.current) return;
                    const latestAttempt = getLatest();
                    const adapterAttempt = latestAttempt.provider ?? provider;
                    const pkAttempt = latestAttempt.publicKey ?? publicKey ?? adapterAttempt?.publicKey?.toBase58?.();
                    console.log('[SIWS] post-fail retry → adapter', adapterAttempt?.name, 'pk', pkAttempt ? pkAttempt.slice(0, 4) : 'none');
                    if (!adapterAttempt || !pkAttempt) return;
                    console.log('[SIWS] auto-retry sign (post-fail)...');
                    const auth2 = await handleSIWS(adapterAttempt, siwsRef.current, pkAttempt);
                    wsRef.current.send(JSON.stringify({ type: 'authenticate', payload: auth2 }));
                    console.log('[SIWS] authenticate sent (retry)');
                  } catch (err) { console.warn('[SIWS] auto-retry failed', err); }
                }, 2000);
                // stays in 'authenticating' until user taps Sign
              }
              break;
            }
            case 'authenticated': {
              setState(s => ({ ...s, playerId: msg.payload.playerId }));
              console.log(`[AUTH] authenticated as ${String(msg.payload.playerId).slice(0,6)}…`);
              // Clear pending auth since we successfully authenticated
              pendingAuthRef.current = null;
              const join = pendingJoinRef.current;
              if (join) {
                console.log('[JOIN] sending joinLobby after auth');
                sock.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: join.entryFeeTier, mode: join.mode } }));
                setState(s => ({ ...s, phase: 'connecting', joining: true }));
              }
              break;
            }
            case 'lobbyState': {
              joinBusyRef.current = false;
              if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
              console.log(`[LOBBY] players=${Array.isArray(msg.payload?.players) ? msg.payload.players.length : 'n/a'} max=${msg.payload?.maxPlayers}`);
              setState(s => ({ ...s, lobby: msg.payload, phase: 'lobby', joining: false }));
              try {
                await fetch(`${API_BASE}/analytics`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'lobby_state', payload: { players: (msg.payload?.players || []).length, max: msg.payload?.maxPlayers, tier: msg.payload?.entryFee } })
                });
              } catch {}
              break;
            }
            case 'lobbyCountdown': {
              console.log(`[LOBBY] countdown remaining=${msg.payload?.remaining}s`);
              setState(s => ({ ...s, countdown: { remaining: msg.payload.remaining, startAtMs: msg.payload.startAtMs } }));
              break;
            }
            case 'entryFeeTx': {
              try {
                setState(s => ({ ...s, entryFee: { pending: true, verified: false }, joining: true }));
                const requiredLamports = msg.payload?.lamports || 0;
                const requiredSol = (requiredLamports / 1_000_000_000).toFixed(4);
                console.log(`[PAY] entryFeeTx received tier=$${msg.payload?.entryFeeTier} lamports=${requiredLamports} (${requiredSol} SOL) paymentId=${String(msg.payload?.paymentId || '').slice(0,8)}…`);

                const latest = getLatest();
                const adapter = latest.provider ?? provider;
                if (!adapter || !adapter.publicKey) {
                  throw new Error('Wallet not connected');
                }

                // Check balance BEFORE asking user to sign
                console.log('[PAY] Checking wallet balance...');
                const { Connection, PublicKey } = await import('@solana/web3.js');
                const connection = new Connection(RPC_ENDPOINT, 'confirmed');
                const balance = await connection.getBalance(new PublicKey(adapter.publicKey.toString()));
                const balanceSol = (balance / 1_000_000_000).toFixed(4);
                console.log(`[PAY] Wallet balance: ${balance} lamports (${balanceSol} SOL)`);

                // Need enough for payment + transaction fee (~0.000005 SOL)
                const feeBuffer = 5000; // 0.000005 SOL for transaction fee
                const totalNeeded = requiredLamports + feeBuffer;

                if (balance < totalNeeded) {
                  const neededSol = (totalNeeded / 1_000_000_000).toFixed(4);
                  throw new Error(`Insufficient funds: You have ${balanceSol} SOL but need ${neededSol} SOL (${requiredSol} entry fee + 0.000005 transaction fee)`);
                }

                console.log('[PAY] Balance check passed, requesting signature from wallet...');
                const sig = await sendEntryFeeTransaction(adapter, msg.payload.txBase64 ?? msg.payload.transaction, RPC_ENDPOINT);
                console.log(`[PAY] Transaction submitted! Signature: ${String(sig).slice(0,12)}…`);
                sock.send(JSON.stringify({ type: 'entryFeeSignature', payload: { signature: sig, paymentId: msg.payload.paymentId, sessionNonce: msg.payload.sessionNonce } }));
              } catch (e: any) {
                console.error('[PAY] Payment failed:', e);
                const errorMsg = e?.message || 'Payment failed';
                setState(s => ({ ...s, lastError: errorMsg, entryFee: { pending: false, verified: false }, joining: false, phase: 'idle' }));
                // Clear pending join to prevent reconnect loop
                pendingJoinRef.current = null;
                joinBusyRef.current = false;
                expectedCloseRef.current = true;
                // Close WebSocket to prevent further errors
                try { wsRef.current?.close(); } catch {}
                wsRef.current = null;
              }
              break;
            }
            case 'entryFeeVerified': {
              const verified = !!msg.payload.ok;
              
              // ✅ FIX #3: User-friendly error messages
              let friendlyError = null;
              if (!verified && msg.payload?.reason) {
                const rawError = msg.payload.reason.toLowerCase();
                
                if (rawError.includes('insufficientfundsforrent') || rawError.includes('insufficient funds for rent')) {
                  const usd = ((1_200_000 / 1e9) * 184).toFixed(2); // Approx $0.22 at $184/SOL
                  friendlyError = `Need $${usd} more SOL. Total: entry + $0.22 fees.`;
                } else if (rawError.includes('insufficient') || rawError.includes('not enough')) {
                  friendlyError = 'Insufficient balance. Add more SOL.';
                } else if (rawError.includes('timeout') || rawError.includes('expired')) {
                  friendlyError = 'Transaction timeout. Try again.';
                } else if (rawError.includes('rejected') || rawError.includes('declined')) {
                  friendlyError = 'Transaction cancelled. Try again when ready.';
                } else if (rawError.includes('blockhash')) {
                  friendlyError = 'Transaction expired. Try again.';
                } else if (rawError.includes('rent')) {
                  friendlyError = 'Add $0.22 more SOL (Solana fees).';
                } else {
                  friendlyError = 'Payment failed. Check wallet balance.';
                }
              }
              
              // ✅ FIX #4: Store transaction signature for receipt
              if (verified && msg.payload?.signature) {
                console.log(`[PAY] ✅ Payment verified. Tx: ${msg.payload.signature}`);
                console.log(`[PAY] 🔗 View on Solscan: https://solscan.io/tx/${msg.payload.signature}`);
              }
              
              setState(s => ({ 
                ...s, 
                entryFee: { pending: false, verified }, 
                joining: verified, 
                phase: verified ? s.phase : 'idle', 
                lastError: friendlyError,
                lastPaymentSignature: verified ? msg.payload?.signature : null
              } as any));
              console.log(`[PAY] verified ok=${verified} reason=${msg.payload?.reason || 'n/a'}`);

              // If payment failed, clear pending join to prevent auto-reconnect loop
              if (!verified) {
                console.warn('[PAY] Payment failed, clearing pending join to prevent auto-reconnect');
                pendingJoinRef.current = null;
                joinBusyRef.current = false;
                expectedCloseRef.current = true; // Prevent auto-reconnect when server disconnects us
              }

              if (verified) {
                // If lobby state doesn't arrive shortly, re-send join once
                if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); }
                joinRetryTimerRef.current = (window as any).setTimeout(() => {
                  try {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && pendingJoinRef.current) {
                      console.log('[JOIN] no lobby update yet → re-sending joinLobby');
                      wsRef.current.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: pendingJoinRef.current.entryFeeTier, mode: pendingJoinRef.current.mode } }));
                    }
                  } catch {}
                }, 3000);
              }
              break;
            }
            case 'gameStarting': {
              joinBusyRef.current = false;
              console.log('[GAME] starting');
              setState(s => ({ ...s, phase: 'game', joining: false, initialPlayers: Array.isArray(s.lobby?.players) ? [...(s.lobby!.players as any)] : [], eliminationOrder: [], kills: {}, killFeed: [], hasFirstGameState: false }));
              try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'game_start', payload: { players: (state.lobby?.players || []).length, tier: state.lobby?.entryFee } }) }); } catch {}
              break;
            }
            case 'gameStateUpdate': {
              const p = msg.payload;
              setState(s => ({
                ...s,
                game: {
                  timestamp: p.timestamp,
                  players: p.players,
                  world: p.world,
                  items: (p as any).items,
                  aliveCount: p.aliveCount
                },
                hasFirstGameState: s.hasFirstGameState || true
              }));
              try { (window as any).__SR_HAS_FIRST_GAME_STATE__ = true; } catch {}
              break;
            }
            case 'roundEnd': {
              console.log('[GAME] round end received');
              // Keep phase ended so UI can navigate to results (App handles screen switch)
              setState(s => ({ ...s, phase: 'ended', joining: false, lastRound: { winnerId: msg.payload?.winnerId, prizeAmount: msg.payload?.prizeAmount, txSignature: msg.payload?.txSignature } }));
              try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'round_end', payload: { winner: msg.payload?.winnerId, prize: msg.payload?.prizeAmount, tx: msg.payload?.txSignature } }) }); } catch {}
              break;
            }
            case 'playerEliminated': {
              const killer = msg.payload?.eliminatorId as string | undefined;
              const victim = msg.payload?.playerId as string;
              setState(s => {
                const newKills = killer ? { ...s.kills, [killer]: (s.kills[killer] || 0) + 1 } : s.kills;
                const newFeed = [{ killerId: killer, victimId: victim, ts: Date.now() }, ...s.killFeed].slice(0, 6);
                const newOrder = s.eliminationOrder.includes(victim) ? s.eliminationOrder : [...s.eliminationOrder, victim];
                return { ...s, kills: newKills, killFeed: newFeed, eliminationOrder: newOrder };
              });
              break;
            }
            case 'debugCollision': {
              if ((import.meta as any).env?.PROD === true) break;
              const payload = msg.payload || {};
              const entry = { victimId: payload.victimId, killerId: payload.killerId, hit: payload.hit, segment: payload.segment, ts: payload.ts || Date.now() };
              setState(s => ({ ...s, debugCollisions: [entry, ...(s.debugCollisions || [])].slice(0, 12) }));
              break;
            }
            case 'soloPlayerWarning': {
              console.log('[LOBBY] Solo player warning:', msg.payload?.secondsUntilRefund, 'seconds until refund');
              const seconds = msg.payload?.secondsUntilRefund || 0;
              // Show discrete countdown in lobby state, not as error
              setState(s => ({ ...s, lobby: { ...s.lobby, refundCountdown: seconds } as any }));
              break;
            }
            case 'lobbyRefund': {
              console.log('[REFUND] Entry fee refunded:', msg.payload);
              const solAmount = ((msg.payload?.lamports || 0) / 1e9).toFixed(4);
              const txSig = msg.payload?.txSignature;
              joinBusyRef.current = false;
              if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
              
              // ✅ FIX #4: Log transaction link
              if (txSig) {
                console.log(`[REFUND] 🔗 View refund: https://solscan.io/tx/${txSig}`);
              }
              
              // Clear lobby state immediately to prevent countdown restart
              setState(s => ({ 
                ...s, 
                lastError: `✅ Refunded ${solAmount} SOL - Returning to menu...`, 
                phase: 'idle', 
                joining: false,
                lobby: null, // Clear lobby state immediately
                countdown: null, // Clear countdown
                lastRefundSignature: txSig,
                refundReceived: true // Flag for auto-return
              } as any));
              
              // Close WebSocket to prevent reconnection
              if (wsRef.current) {
                expectedCloseRef.current = true;
                wsRef.current.close();
                wsRef.current = null;
              }
              
              // Auto-clear error message after showing
              setTimeout(() => {
                setState(s => ({ ...s, lastError: null, refundReceived: false }));
              }, 2500);
              
              try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'lobby_refund', payload: { lamports: msg.payload?.lamports, tx: txSig } }) }); } catch {}
              break;
            }
            
            case 'refundFailed': {
              // ✅ FIX #2: Handle refund failures with clear error message
              console.error('[REFUND] Failed:', msg.payload);
              joinBusyRef.current = false;
              if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
              
              setState(s => ({ 
                ...s, 
                lastError: `❌ ${msg.payload?.message || 'Refund failed - contact support'}`, 
                phase: 'idle', 
                joining: false,
                lobby: null
              }));
              
              // Show error for longer (5s)
              setTimeout(() => {
                setState(s => ({ ...s, lastError: null }));
              }, 5000);
              
              try { await fetch(`${API_BASE}/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'refund_failed', payload: msg.payload }) }); } catch {}
              break;
            }
            
            case 'error': {
              joinBusyRef.current = false;
              if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
              console.error('[WS] server error', msg.payload?.message);
              setState(s => ({ ...s, lastError: msg.payload?.message || 'Server error', joining: false }));
              break;
            }
            default: break;
          }
        } catch {}
      };
    };

    const ws = new WebSocket(wsUrlWithToken);
    attach(ws);
  };

  const signAuthentication = async () => {
    try {
      const sock = wsRef.current;
      const challenge = siwsRef.current;
      if (!sock || !challenge) return;
      const latest = getLatest();
      const adapter = latest.provider ?? provider;
      const pk = latest.publicKey ?? publicKey;
      console.log('[SIWS] Manual sign requested → adapter', adapter?.name, 'pk', pk ? pk.slice(0, 4) : 'none');
      if (!adapter || !pk) {
        console.warn('[SIWS] Cannot sign: wallet not connected');
        return;
      }
      const { message, nonce } = challenge;
      const auth = await handleSIWS(adapter, { message, nonce }, pk);
      sock.send(JSON.stringify({ type: 'authenticate', payload: auth }));
      console.log('[SIWS] authenticate sent');
    } catch (e) { console.error('[SIWS] sign failed', e); }
  };

  const leave = () => {
    try { expectedCloseRef.current = true; wsRef.current?.close(); } catch {}
    wsRef.current = null;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    reconnectAttemptsRef.current = 0;
    pendingJoinRef.current = null;
    joinBusyRef.current = false;
    if (joinRetryTimerRef.current) { clearTimeout(joinRetryTimerRef.current); joinRetryTimerRef.current = null; }
    if (siwsRetryTimerRef.current) { clearTimeout(siwsRetryTimerRef.current); siwsRetryTimerRef.current = null; }
    setState(s => ({ ...s, connected: false, phase: 'idle', lobby: null, countdown: null, entryFee: { pending: false, verified: false }, game: null, lastError: null }));
  };

  const sendInput = (target: { x: number; y: number }, accelerate: boolean, boost?: boolean) => {
    try {
      const now = performance.now();
      // Hard throttle to ~20 Hz
      if (now - (lastInputSentRef.current || 0) < 50) return;
      // Debounce unchanged payloads (within small target delta)
      const prev = lastSentPayloadRef.current;
      const dx = prev ? Math.abs(prev.target.x - target.x) : Infinity;
      const dy = prev ? Math.abs(prev.target.y - target.y) : Infinity;
      const changed = !prev || dx > 2 || dy > 2 || prev.accelerate !== accelerate || prev.boost !== boost;
      if (!changed) return;
      lastInputSentRef.current = now;
      // Boost cooldown (client-side guardrail)
      if (boost) {
        const lastBoost = lastBoostTsRef.current || 0;
        if (performance.now() - lastBoost < 400) {
          // Ignore rapid boost toggles
          boost = undefined;
        } else {
          lastBoostTsRef.current = performance.now();
        }
      }
      // Clamp to world bounds if available
      let tx = target.x, ty = target.y;
      const world = state.game?.world;
      if (world) {
        tx = Math.max(0, Math.min(world.width, tx));
        ty = Math.max(0, Math.min(world.height, ty));
      }
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      const payload = { target: { x: tx, y: ty }, accelerate, ...(boost !== undefined ? { boost } : {}) };
      lastSentPayloadRef.current = { target: { x: tx, y: ty }, accelerate, boost };
      sock.send(JSON.stringify({ type: 'playerInput', payload }));
    } catch {}
  };

  const value = useMemo<WsApi>(() => ({ state, connectAndJoin, leave, signAuthentication, sendInput }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWs() { return useContext(Ctx); }

