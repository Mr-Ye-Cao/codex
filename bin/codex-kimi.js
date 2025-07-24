#!/usr/bin/env node

// Binary entry point for codex-kimi npm package
const path = require('path');

// Import and run the wrapper function
const { runCodexWithKimi } = require(path.join(__dirname, '..', 'npm-wrapper.js'));

runCodexWithKimi(process.argv.slice(2));