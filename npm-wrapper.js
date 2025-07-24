#!/usr/bin/env node

// npm wrapper for codex with Kimi K2 support
// This wrapper sets the necessary environment variables and calls the codex CLI

const path = require('path');
const { spawn } = require('child_process');

function runCodexWithKimi(args = []) {
  // Set the required environment variable for Kimi K2
  const env = {
    ...process.env,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || "sk-4VjKuOMtb0WGhx3vY5Mm0Sw6YJLKviuTFtm2tgRQzyERJhZE"
  };
  
  // Default arguments to include the Kimi model
  const defaultArgs = ['--model', 'kimi-k2-0711-preview'];
  const finalArgs = [...defaultArgs, ...args];
  
  // Use the globally installed codex command
  const child = spawn('codex', finalArgs, {
    stdio: 'inherit',
    env
  });
  
  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('Error: codex command not found. Please install codex first.');
      console.error('You can install it from: https://github.com/anthropics/claude-code');
    } else {
      console.error('Error running codex:', err.message);
    }
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