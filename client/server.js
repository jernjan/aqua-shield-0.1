import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import https from 'https';
import { execSync } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API proxy - forward /api requests to the actual API service
const API_BASE_URL = process.env.API_BASE_URL || 'https://aqua-shield-api-production.onrender.com';

// Ensure dist exists - build if missing
const distPath = join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('📦 dist folder missing, building...');
  try {
    execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
    console.log('✅ Build complete');
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  }
}

// Health check endpoint for frontend server
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API proxy middleware
app.use('/api', (req, res) => {
  const options = {
    hostname: new URL(API_BASE_URL).hostname,
    port: 443,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const protocol = API_BASE_URL.startsWith('https') ? https : http;
  
  const proxyReq = protocol.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('API proxy error:', err);
    res.status(502).json({ error: 'Bad Gateway', message: err.message });
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1m',
  etag: false
}));

// SPA fallback - serve index.html for all non-file requests
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`📁 Serving from: ${join(__dirname, 'dist')}`);
  console.log(`🔗 API proxy to: ${API_BASE_URL}`);
});
