#!/usr/bin/env node
/**
 * HTTP file server to transfer the project to VPS
 * Usage: node scripts/serve-project-http.js [port]
 * Creates a tarball of the project and serves it via HTTP
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || '9000', 10);
const PROJECT_ROOT = path.join(__dirname, '..');
const TARBALL_NAME = 'spermrace-deploy.tar.gz';
const TARBALL_PATH = path.join(PROJECT_ROOT, TARBALL_NAME);

console.log('\n🎯 SpermRace.io - Project Transfer Server\n');

// Create tarball
console.log('📦 Creating project tarball...');
try {
  // Remove old tarball if exists
  if (fs.existsSync(TARBALL_PATH)) {
    fs.unlinkSync(TARBALL_PATH);
  }

  // Create new tarball (exclude node_modules, dist, .git)
  execSync(
    `tar -czf "${TARBALL_NAME}" --exclude=node_modules --exclude=dist --exclude=.git --exclude=*.tar.gz --exclude=.env --exclude=.env.* -C "${PROJECT_ROOT}" .`,
    { cwd: PROJECT_ROOT, stdio: 'inherit' }
  );

  const stats = fs.statSync(TARBALL_PATH);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Tarball created: ${sizeInMB} MB\n`);
} catch (err) {
  console.error('❌ Failed to create tarball:', err.message);
  process.exit(1);
}

// Get local IP addresses
function getLocalIPs() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const localIPs = getLocalIPs();

// Create HTTP server
const server = http.createServer((req, res) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`📥 Request from ${clientIP}: ${req.url}`);

  if (req.url === `/${TARBALL_NAME}`) {
    const stat = fs.statSync(TARBALL_PATH);
    res.writeHead(200, {
      'Content-Type': 'application/gzip',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${TARBALL_NAME}"`,
    });
    const stream = fs.createReadStream(TARBALL_PATH);
    stream.pipe(res);
    console.log(`✅ Serving tarball to ${clientIP}`);
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head><title>SpermRace Deploy</title></head>
<body style="font-family:monospace;padding:2rem;background:#000;color:#0f0;">
<h1>🎯 SpermRace.io - Deployment Server</h1>
<p>Project tarball ready for download.</p>
<p><a href="/${TARBALL_NAME}" style="color:#0ff;">Download ${TARBALL_NAME}</a></p>
<h2>VPS Download Command:</h2>
<pre style="background:#111;padding:1rem;border:1px solid #0f0;">
wget http://YOUR_PC_IP:${PORT}/${TARBALL_NAME}
# or
curl -O http://YOUR_PC_IP:${PORT}/${TARBALL_NAME}
</pre>
</body>
</html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server running!\n');
  console.log('📍 Download URLs:');
  console.log(`   http://localhost:${PORT}/${TARBALL_NAME}`);
  localIPs.forEach(ip => {
    console.log(`   http://${ip}:${PORT}/${TARBALL_NAME}`);
  });
  console.log('\n📋 VPS Command:');
  console.log(`   wget http://YOUR_PC_IP:${PORT}/${TARBALL_NAME}`);
  console.log('\n⚠️  Make sure firewall allows port', PORT);
  console.log('   Windows: Allow in Windows Defender Firewall');
  console.log('\n💡 Press Ctrl+C to stop server\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🧹 Cleaning up...');
  if (fs.existsSync(TARBALL_PATH)) {
    fs.unlinkSync(TARBALL_PATH);
    console.log('✅ Tarball removed');
  }
  process.exit(0);
});









