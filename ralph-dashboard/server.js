import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { watch } from 'chokidar';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3333;
const WORKTREE_DIR = '/home/sisi/projects/spermrace/.ralphy-worktrees';
const RALPH_LOG = '/home/sisi/projects/spermrace/ralph.log';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

let seenCommands = new Set();
let logOffset = 0;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => c.readyState === 1 && c.send(data));
}

// Watch main ralph.log
function watchRalphLog() {
  if (!existsSync(RALPH_LOG)) return;
  
  // Initial read
  try {
    const content = readFileSync(RALPH_LOG, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    logOffset = content.length;
  } catch {}

  const watcher = watch(RALPH_LOG, { persistent: true });
  watcher.on('change', path => {
    try {
      const stats = execSync(`stat -c%s "${RALPH_LOG}"`).toString().trim();
      const size = parseInt(stats);
      if (size < logOffset) logOffset = 0; // Rotated
      
      const newContent = execSync(`tail -c +${logOffset + 1} "${RALPH_LOG}"`, { encoding: 'utf8' });
      logOffset = size;
      
      if (newContent.trim()) {
        broadcast({ type: 'orchestrator_log', text: newContent });
      }
    } catch {}
  });
}

function getAgentId(path) {
  const match = path.match(/agent-(\d+)-/);
  return match ? match[1] : null;
}

function getAgentFiles(agentDir) {
  try {
    if (!existsSync(agentDir)) return [];
    const status = execSync(`git -C "${agentDir}" status --short`, { encoding: 'utf-8', timeout: 3000 });
    return status.trim().split('\n').filter(l => l.trim());
  } catch { return []; }
}

function getAllAgents() {
  if (!existsSync(WORKTREE_DIR)) return [];
  try {
    return readdirSync(WORKTREE_DIR)
      .filter(d => d.startsWith('agent-'))
      .map(d => {
        const id = d.match(/agent-(\d+)-/)?.[1];
        const path = join(WORKTREE_DIR, d);
        const files = getAgentFiles(path);
        return { id, path, files };
      })
      .filter(a => a.id);
  } catch { return []; }
}

// Watch worktrees for changes
function watchWorktrees() {
  if (!existsSync(WORKTREE_DIR)) return;

  const watcher = watch(WORKTREE_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 5,
    ignored: /(node_modules|\.git|dist|\.next|coverage)/
  });

  watcher.on('all', (event, path) => {
    const agentId = getAgentId(path);
    if (!agentId) return;

    const file = basename(path);
    if (event === 'add') {
      broadcast({ type: 'agent_log', agent: agentId, level: 'result', text: `+ ${file}` });
    } else if (event === 'change') {
      broadcast({ type: 'agent_log', agent: agentId, level: 'tool', text: `✏️ ${file}` });
    }

    // Update files list
    const agentDir = path.split('/').slice(0, 7).join('/');
    const files = getAgentFiles(agentDir);
    broadcast({ type: 'agent_files', agent: agentId, files });
  });
}

// Poll commands and map to agents
function pollCommands() {
  setInterval(() => {
    try {
      const ps = execSync(`ps aux | grep "eval '" | grep -v grep`, { encoding: 'utf-8', timeout: 2000 });

      for (const line of ps.trim().split('\n').filter(l => l)) {
        const match = line.match(/eval '([^']+)'/);
        const cwdMatch = line.match(/agent-(\d+)-/);

        if (match) {
          const cmd = match[1].trim();
          const agentId = cwdMatch ? cwdMatch[1] : '?';
          const pidMatch = line.match(/^\S+\s+(\d+)/);
          const key = `${pidMatch?.[1]}:${cmd}`;

          if (!seenCommands.has(key)) {
            seenCommands.add(key);
            broadcast({ type: 'agent_log', agent: agentId, level: 'tool', text: `▶ ${cmd}` });
            setTimeout(() => seenCommands.delete(key), 30000);
          }
        }
      }
    } catch {}
  }, 2000);
}

// Poll agent status and files
function pollAgents() {
  setInterval(() => {
    const agents = getAllAgents();
    for (const agent of agents) {
      broadcast({ type: 'agent_files', agent: agent.id, files: agent.files });
    }
  }, 5000);
}

app.get('/', (_, res) => res.sendFile(join(__dirname, 'index.html')));

wss.on('connection', (ws) => {
  // Send orchestrator context
  try {
    if (existsSync(RALPH_LOG)) {
      const logs = execSync(`tail -n 100 "${RALPH_LOG}"`, { encoding: 'utf8' });
      ws.send(JSON.stringify({ type: 'orchestrator_log', text: logs }));
    }
  } catch {}

  // Send initial state
  const agents = getAllAgents();
  for (const agent of agents) {
    ws.send(JSON.stringify({ type: 'agent_files', agent: agent.id, files: agent.files }));
    ws.send(JSON.stringify({ type: 'agent_status', agent: agent.id, status: 'active' }));
  }
});

watchWorktrees();
watchRalphLog();
pollCommands();
pollAgents();

server.listen(PORT, () => console.log(`🤖 Ralph Dashboard → http://localhost:${PORT}`));
