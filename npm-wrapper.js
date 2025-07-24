#!/usr/bin/env node

// npm wrapper for codex with Kimi K2 support
// This wrapper sets the necessary environment variables and calls the codex CLI

const path = require('path');
const { spawn } = require('child_process');

function runCodexWithKimi(args = []) {
  // Check if API key is provided
  if (!process.env.MOONSHOT_API_KEY) {
    console.error('❌ MOONSHOT_API_KEY environment variable is required.');
    console.error('');
    console.error('📋 How to get your API key:');
    console.error('   1. Visit https://platform.moonshot.cn');
    console.error('   2. Create an account and get your API key');
    console.error('   3. Export it: export MOONSHOT_API_KEY="sk-your-key-here"');
    console.error('');
    console.error('🚀 Usage:');
    console.error('   export MOONSHOT_API_KEY="your-key"');
    console.error('   codex-kimi');
    console.error('');
    console.error('   Or run directly: MOONSHOT_API_KEY="your-key" codex-kimi');
    process.exit(1);
  }
  
  // Set the required environment variable for Kimi K2
  const env = {
    ...process.env,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY
  };
  
  // Path to the bundled codex CLI in this package
  const codexPath = path.join(__dirname, 'codex-cli', 'bin', 'codex.js');
  
  // Default arguments to include the Kimi model and moonshot provider
  const defaultArgs = ['--provider', 'moonshot', '--model', 'kimi-k2-0711-preview'];
  const finalArgs = [...defaultArgs, ...args];
  
  // Create a wrapper script to bypass Node version check
  const wrapperScript = `
    // Patch process.version to bypass Node.js version check  
    Object.defineProperty(process, 'version', {
      value: 'v22.0.0',
      writable: false,
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(process.versions, 'node', {
      value: '22.0.0',
      writable: false,
      enumerable: true,
      configurable: true
    });
    
    // Set up process.argv with the correct arguments
    process.argv = ['node', '${codexPath}', ...${JSON.stringify(finalArgs)}];
    
    // Now import and run the codex CLI
    import('${codexPath.replace(/\\/g, '/')}').catch(console.error);
  `;
  
  // Use the bundled codex CLI with version patching
  const child = spawn('node', ['--input-type=module', '-e', wrapperScript], {
    stdio: 'inherit',
    env
  });
  
  child.on('error', (err) => {
    console.error('Error running bundled codex:', err.message);
    process.exit(1);
  });
  
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });
}

module.exports = { runCodexWithKimi };

// If this file is run directly, execute codex
if (require.main === module) {
  runCodexWithKimi(process.argv.slice(2));
}