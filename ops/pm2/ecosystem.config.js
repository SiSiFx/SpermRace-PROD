module.exports = {
  apps: [
    {
      name: 'spermrace-server-ws',
      script: 'packages/server/dist/index.js',
      cwd: __dirname + '/../../',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        // REQUIRED: replace with your values or set in PM2 via `--update-env`
        SOLANA_RPC_ENDPOINT: 'https://api.devnet.solana.com',
        PRIZE_POOL_WALLET: 'REPLACE_WITH_PRIZE_POOL_PUBLIC_KEY',
        PRIZE_POOL_SECRET_KEY: 'REPLACE_WITH_SECRET_KEY',
        ENABLE_DEV_BOTS: 'false',
        SKIP_ENTRY_FEE: 'false',
        ALLOWED_ORIGINS: 'https://your-frontend-domain,https://game.yourdomain.com',
        LOG_LEVEL: 'info',
      },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/spermrace-out.log',
      error_file: '/var/log/pm2/spermrace-err.log',
      merge_logs: true,
      time: true,
      watch: false,
    },
  ],
};


