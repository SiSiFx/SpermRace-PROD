module.exports = {
  apps: [
    {
      name: 'spermrace-server-ws',
      script: 'packages/server/dist/server/src/index.js',
      cwd: __dirname + '/../../',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--enable-source-maps',
      env_file: 'packages/server/.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      max_memory_restart: '500M',
      out_file: './.pm2/logs/spermrace-out.log',
      error_file: './.pm2/logs/spermrace-err.log',
      merge_logs: true,
      time: true,
      watch: false,
    },
  ],
};


