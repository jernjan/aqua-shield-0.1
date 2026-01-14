#!/usr/bin/env node
// Start server and keep it running
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting AquaShield server...');

const serverPath = path.join(__dirname, 'server', 'index.js');
const server = spawn('node', [serverPath], {
    cwd: path.join(__dirname, 'server'),
    detached: true,
    stdio: 'ignore'
});

server.unref();

console.log(`✓ Server started (PID: ${server.pid})`);
console.log('✓ Server will run in background');
console.log('');
console.log('Now you can run: node test-backtest-direct.js');
