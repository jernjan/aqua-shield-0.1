import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'express-http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || 'https://aqua-shield-api-production.onrender.com';

// Health check for frontend
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'frontend', timestamp: new Date().toISOString() });
});

// Simple API proxy using express-http-proxy
app.use('/api', createProxyMiddleware({
  target: API_BASE_URL,
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'API Unavailable', details: err.message });
  }
}));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1m',
  etag: false
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`📁 Serving from: ${join(__dirname, 'dist')}`);
  console.log(`🔗 API proxy to: ${API_BASE_URL}`);
});
