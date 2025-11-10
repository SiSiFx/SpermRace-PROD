#!/usr/bin/env node

/**
 * Smart Environment Switcher for skidr.io
 * 
 * This utility helps developers quickly switch between environments
 * and ensures proper configuration is loaded.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Environment configurations
const environments = {
  development: {
    name: 'Development',
    emoji: '🔧',
    color: colors.yellow,
    features: ['debug', 'devTools', 'botTesting', 'mockWallet'],
    port: 3000,
    wsPort: 4000,
  },
  demo: {
    name: 'Demo',
    emoji: '🎮',
    color: colors.blue,
    features: ['gameplay', 'leaderboard'],
    port: 3001,
    wsPort: 4001,
  },
  production: {
    name: 'Production',
    emoji: '🚀',
    color: colors.green,
    features: ['gameplay', 'leaderboard', 'realMoney', 'wallet'],
    port: 3002,
    wsPort: 4002,
  },
};

class EnvironmentSwitcher {
  constructor() {
    this.currentEnv = this.detectCurrentEnvironment();
    this.projectRoot = this.findProjectRoot();
  }

  findProjectRoot() {
    let dir = __dirname;
    
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
        );
        
        if (packageJson.name === 'skidr.io' || packageJson.workspaces) {
          return dir;
        }
      }
      dir = path.dirname(dir);
    }
    
    throw new Error('Could not find project root directory');
  }

  detectCurrentEnvironment() {
    try {
      // Check for running processes
      const processes = execSync('pnpm list --depth=0 2>/dev/null || echo "none"', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Check for environment variables
      const nodeEnv = process.env.NODE_ENV;
      const viteAppMode = process.env.VITE_APP_MODE;
      
      if (nodeEnv) {
        return nodeEnv.toLowerCase();
      }
      
      if (viteAppMode) {
        return viteAppMode.toLowerCase();
      }
      
      return 'development'; // default
    } catch (error) {
      return 'development';
    }
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  logHeader(message) {
    const line = '='.repeat(50);
    this.log(`\n${line}`, colors.magenta);
    this.log(`${message}`, colors.magenta);
    this.log(`${line}`, colors.magenta);
  }

  logEnvironment(envKey) {
    const env = environments[envKey];
    this.log(`${env.emoji} ${env.name} Environment`, env.color);
    this.log(`   Features: ${env.features.join(', ')}`, colors.cyan);
    this.log(`   Port: ${env.port} (WebSocket: ${env.wsPort})`, colors.cyan);
  }

  showCurrentStatus() {
    this.logHeader('Current Environment Status');
    
    if (this.currentEnv && environments[this.currentEnv]) {
      this.logEnvironment(this.currentEnv);
    } else {
      this.log('❓ Unknown or not set', colors.red);
    }
    
    // Show running processes
    try {
      const ports = this.getRunningPorts();
      if (ports.length > 0) {
        this.log(`\nRunning on ports: ${ports.join(', ')}`, colors.green);
      } else {
        this.log('\nNo development servers detected', colors.yellow);
      }
    } catch (error) {
      this.log('\nCould not detect running servers', colors.yellow);
    }
  }

  getRunningPorts() {
    try {
      const netstat = execSync('netstat -an 2>/dev/null || ss -tuln 2>/dev/null || echo ""', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const ports = [];
      const lines = netstat.split('\n');
      
      Object.values(environments).forEach(env => {
        if (lines.some(line => line.includes(`:${env.port}`) || line.includes(`:${env.wsPort}`))) {
          ports.push(`${env.port}/${env.wsPort}`);
        }
      });
      
      return ports;
    } catch (error) {
      return [];
    }
  }

  validateEnvironment(envKey) {
    const env = environments[envKey];
    if (!env) {
      throw new Error(`Invalid environment: ${envKey}`);
    }
    
    const clientEnvFile = path.join(
      this.projectRoot,
      'packages/client',
      `.env.${envKey}`
    );
    
    if (!fs.existsSync(clientEnvFile)) {
      throw new Error(`Environment file not found: ${clientEnvFile}`);
    }
    
    return true;
  }

  switchEnvironment(targetEnv) {
    this.logHeader(`Switching to ${environments[targetEnv].name} Environment`);
    
    try {
      this.validateEnvironment(targetEnv);
      
      // Stop any running servers
      this.stopServers();
      
      // Update environment
      this.updateEnvironmentFiles(targetEnv);
      
      // Show next steps
      this.showNextSteps(targetEnv);
      
      this.log(`\n✅ Successfully switched to ${targetEnv} environment`, colors.green);
      
    } catch (error) {
      this.log(`\n❌ Failed to switch environment: ${error.message}`, colors.red);
      process.exit(1);
    }
  }

  stopServers() {
    this.log('🛑 Stopping any running servers...', colors.yellow);
    
    try {
      // Try to stop pnpm processes gracefully
      execSync('pkill -f "pnpm.*dev" 2>/dev/null || pkill -f "pnpm.*start" 2>/dev/null || true', {
        stdio: 'pipe'
      });
      
      // Wait a moment for graceful shutdown
      setTimeout(() => {}, 1000);
      
      this.log('   Servers stopped', colors.green);
    } catch (error) {
      this.log('   No servers to stop', colors.cyan);
    }
  }

  updateEnvironmentFiles(targetEnv) {
    this.log('📝 Updating environment configuration...', colors.yellow);
    
    // Update package.json scripts if needed
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Update default dev script to point to target environment
      if (packageJson.scripts) {
        const envCommand = targetEnv === 'development' ? 'dev' : targetEnv;
        packageJson.scripts['dev:current'] = `pnpm run ${envCommand}`;
        
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
    }
    
    this.log(`   Environment files updated for ${targetEnv}`, colors.green);
  }

  showNextSteps(targetEnv) {
    const env = environments[targetEnv];
    
    this.log('\n📋 Next Steps:', colors.cyan);
    this.log(`   1. Run: pnpm run ${targetEnv === 'development' ? 'dev' : targetEnv}`, colors.white);
    this.log(`   2. Open: http://localhost:${env.port}`, colors.white);
    this.log(`   3. WebSocket: ws://localhost:${env.wsPort}`, colors.white);
    
    if (targetEnv === 'production') {
      this.log('\n⚠️  Production Environment Warnings:', colors.red);
      this.log('   • Real money features are enabled', colors.red);
      this.log('   • Make sure all API keys are configured', colors.red);
      this.log('   • Monitor carefully for issues', colors.red);
    }
    
    if (targetEnv === 'demo') {
      this.log('\n🎮 Demo Environment Notes:', colors.blue);
      this.log('   • Crypto features are disabled', colors.blue);
      this.log('   • Pure gameplay experience', colors.blue);
      this.log('   • Perfect for public demonstrations', colors.blue);
    }
  }

  showAvailableEnvironments() {
    this.logHeader('Available Environments');
    
    Object.keys(environments).forEach(envKey => {
      this.logEnvironment(envKey);
      console.log();
    });
  }

  showUsage() {
    this.log('\nUsage: node environment-switcher.js [command] [environment]', colors.cyan);
    this.log('\nCommands:', colors.yellow);
    this.log('  switch <env>    Switch to specified environment', colors.white);
    this.log('  status          Show current environment status', colors.white);
    this.log('  list            List all available environments', colors.white);
    this.log('  help            Show this help message', colors.white);
    this.log('\nEnvironments:', colors.yellow);
    this.log('  development     Full development environment', colors.white);
    this.log('  demo            Clean demo environment', colors.white);
    this.log('  production      Production environment', colors.white);
    this.log('\nExamples:', colors.yellow);
    this.log('  node environment-switcher.js switch demo', colors.white);
    this.log('  node environment-switcher.js status', colors.white);
  }

  run(args) {
    const command = args[0];
    const environment = args[1];
    
    switch (command) {
      case 'switch':
        if (!environment) {
          this.log('❌ Environment not specified', colors.red);
          this.showUsage();
          return;
        }
        
        if (!environments[environment]) {
          this.log(`❌ Invalid environment: ${environment}`, colors.red);
          this.showAvailableEnvironments();
          return;
        }
        
        this.switchEnvironment(environment);
        break;
        
      case 'status':
        this.showCurrentStatus();
        break;
        
      case 'list':
        this.showAvailableEnvironments();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        this.showUsage();
        break;
        
      default:
        if (command) {
          this.log(`❌ Unknown command: ${command}`, colors.red);
        }
        this.showUsage();
        break;
    }
  }
}

// Main execution
if (require.main === module) {
  const switcher = new EnvironmentSwitcher();
  const args = process.argv.slice(2);
  
  try {
    switcher.run(args);
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

module.exports = EnvironmentSwitcher;