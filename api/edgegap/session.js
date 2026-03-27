/**
 * Vercel Serverless Function: Edgegap session matchmaker
 *
 * Route: POST /api/edgegap/session
 *
 * Keeps the Edgegap token server-side. The client calls this endpoint to get a
 * ready-to-connect WebSocket URL (typically `wss://<fqdn>:<port>/ws`).
 *
 * Required env (Vercel project settings):
 * - EDGEGAP_TOKEN
 * - EDGEGAP_APP_NAME
 * - EDGEGAP_VERSION_NAME
 *
 * Optional env:
 * - EDGEGAP_API_BASE (default: https://api.edgegap.com)
 * - EDGEGAP_WS_SCHEME (default: wss)
 * - EDGEGAP_WS_PATH (default: /ws)
 * - EDGEGAP_PORT_KEY (e.g. 8080 or 80; otherwise first port entry)
 * - EDGEGAP_POLL_TIMEOUT_MS (default: 45000)
 * - EDGEGAP_POLL_INTERVAL_MS (default: 1500)
 * - EDGEGAP_FALLBACK_WS_URL (return this if Edgegap is not configured)
 */

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getClientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim();
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  const remote = (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : '';
  return remote || null;
}

async function edgegapFetch(url, { method, token, body }) {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `token ${token}`,
  };
  const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { }
  return { ok: resp.ok, status: resp.status, data, text };
}

function firstPortKey(ports) {
  try {
    if (!ports || typeof ports !== 'object') return null;
    const keys = Object.keys(ports);
    if (!keys.length) return null;
    keys.sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
    return keys[0];
  } catch {
    return null;
  }
}

function buildWsUrl({ link, scheme, path }) {
  const safeScheme = (scheme === 'ws' || scheme === 'wss') ? scheme : 'wss';
  const safePath = (typeof path === 'string' && path.trim())
    ? (path.startsWith('/') ? path.trim() : `/${path.trim()}`)
    : '/ws';
  return `${safeScheme}://${link}${safePath}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const token = (process.env.EDGEGAP_TOKEN || '').trim();
  const appName = (process.env.EDGEGAP_APP_NAME || '').trim();
  const versionName = (process.env.EDGEGAP_VERSION_NAME || '').trim();
  const fallbackWsUrl = (process.env.EDGEGAP_FALLBACK_WS_URL || '').trim();

  if (!token || !appName || !versionName) {
    if (fallbackWsUrl) return json(res, 200, { ok: true, wsUrl: fallbackWsUrl, backend: 'fallback' });
    return json(res, 501, {
      ok: false,
      error: 'Edgegap is not configured on this deployment (missing EDGEGAP_TOKEN/EDGEGAP_APP_NAME/EDGEGAP_VERSION_NAME)',
    });
  }

  const apiBase = (process.env.EDGEGAP_API_BASE || 'https://api.edgegap.com').replace(/\/+$/, '');
  const wsScheme = (process.env.EDGEGAP_WS_SCHEME || 'wss').trim();
  const wsPath = (process.env.EDGEGAP_WS_PATH || '/ws').trim();
  const portKeyEnv = (process.env.EDGEGAP_PORT_KEY || '').trim();
  const pollTimeoutMs = Math.max(5000, Number(process.env.EDGEGAP_POLL_TIMEOUT_MS || 45000) || 45000);
  const pollIntervalMs = Math.max(250, Number(process.env.EDGEGAP_POLL_INTERVAL_MS || 1500) || 1500);

  const clientIp = getClientIp(req);
  const ipList = clientIp ? [clientIp] : [];

  // Body is optional; reserved for future selectors (region/mode).
  let parsedBody = {};
  try {
    parsedBody = typeof req.body === 'object' && req.body ? req.body : {};
  } catch { }
  const selectors = (parsedBody && typeof parsedBody === 'object' && parsedBody.selectors && typeof parsedBody.selectors === 'object')
    ? parsedBody.selectors
    : undefined;

  const createResp = await edgegapFetch(`${apiBase}/v1/session`, {
    method: 'POST',
    token,
    body: {
      app_name: appName,
      version_name: versionName,
      ip_list: ipList,
      ...(selectors ? { selectors } : {}),
    },
  });

  if (!createResp.ok) {
    return json(res, 502, {
      ok: false,
      error: 'Failed to create Edgegap session',
      status: createResp.status,
      details: createResp.data || createResp.text,
    });
  }

  const sessionId = createResp.data?.session_id || createResp.data?.sessionId;
  if (!sessionId) {
    return json(res, 502, { ok: false, error: 'Edgegap response missing session_id', details: createResp.data });
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < pollTimeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const getResp = await edgegapFetch(`${apiBase}/v1/session/${encodeURIComponent(sessionId)}`, { method: 'GET', token });
    if (!getResp.ok) {
      return json(res, 502, {
        ok: false,
        error: 'Failed to fetch Edgegap session status',
        status: getResp.status,
        details: getResp.data || getResp.text,
        sessionId,
      });
    }

    const status = String(getResp.data?.status || '').trim();
    if (status.toLowerCase() === 'error') {
      return json(res, 502, { ok: false, error: 'Edgegap session entered error state', sessionId, details: getResp.data });
    }

    const ports = getResp.data?.ports;
    const portKey = portKeyEnv || firstPortKey(ports);
    const link = portKey ? ports?.[portKey]?.link : null;
    if (status.toLowerCase() === 'ready' && typeof link === 'string' && link.includes(':')) {
      const wsUrl = buildWsUrl({ link, scheme: wsScheme, path: wsPath });
      return json(res, 200, {
        ok: true,
        backend: 'edgegap',
        sessionId,
        wsUrl,
        portKey,
        fqdn: getResp.data?.deployment?.fqdn || null,
      });
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return json(res, 504, { ok: false, error: 'Timed out waiting for Edgegap session readiness', sessionId });
};

