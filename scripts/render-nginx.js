#!/usr/bin/env node
// Render ops/nginx/game.conf.example with a provided domain into /tmp/game.conf
// Usage: node scripts/render-nginx.js --domain game.example.com --out ./game.conf

const fs = require('fs');
const path = require('path');

function arg(name, def) {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
	return def;
}

const domain = arg('domain');
const out = arg('out', './game.conf');

if (!domain) {
	console.error('Usage: node scripts/render-nginx.js --domain game.example.com [--out ./game.conf]');
	process.exit(1);
}

const tplPath = path.join(__dirname, '..', 'ops', 'nginx', 'game.conf.example');
const tpl = fs.readFileSync(tplPath, 'utf8');
const rendered = tpl.replace(/game\.yourdomain\.com/g, domain)
	.replace(/\/etc\/letsencrypt\/live\/game\.yourdomain\.com\//g, `/etc/letsencrypt/live/${domain}/`);

fs.writeFileSync(out, rendered, 'utf8');
console.log(`Rendered Nginx config to ${path.resolve(out)} with domain=${domain}`);



