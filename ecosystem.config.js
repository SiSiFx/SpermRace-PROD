module.exports = {
  apps: [{
    name: 'spermrace-server-ws',
    script: './packages/server/dist/server/src/index.js',
    cwd: '/opt/spermrace',
    env_file: '/opt/spermrace/.env'
  }]
};
