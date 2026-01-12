import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || 'https://aqua-shield-api-production.onrender.com';

// Parse JSON bodies for POST/PATCH requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'frontend' });
});

// Simple API proxy using fetch
app.all('/api/*', async (req, res) => {
  try {
    const apiPath = req.url.substring(4); // Remove /api prefix
    const apiUrl = `${API_BASE_URL}${apiPath}`;
    
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Copy relevant headers from client
    if (req.headers['authorization']) {
      options.headers['authorization'] = req.headers['authorization'];
    }
    if (req.headers['cookie']) {
      options.headers['cookie'] = req.headers['cookie'];
    }

    // Add body for POST/PATCH
    if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && req.body) {
      if (typeof req.body === 'string') {
        options.body = req.body;
      } else {
        options.body = JSON.stringify(req.body);
      }
    }

    console.log(`[PROXY] ${req.method} ${apiUrl}`);
    
    const response = await fetch(apiUrl, options);
    const text = await response.text();
    
    // Copy status and key headers
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    
    res.send(text);
  } catch (err) {
    console.error('[PROXY ERROR]', err.message);
    res.status(502).json({ error: 'API Unavailable', details: err.message });
  }
});

// Serve static files
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1m',
  etag: false
}));

// SPA fallback
app.get('*', (req, res) => {
  console.log(`SPA fallback: serving index.html for ${req.path}`);
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server on port ${PORT}`);
  console.log(`🔗 API proxy to: ${API_BASE_URL}`);
});
