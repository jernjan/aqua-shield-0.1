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
        ...req.headers,
      }
    };

    // Only add body for methods that support it
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    console.log(`Proxying ${req.method} ${apiUrl}`);
    
    const response = await fetch(apiUrl, options);
    const data = await response.text();
    
    // Copy headers
    Object.entries(response.headers.raw ? response.headers.raw() : {}).forEach(([key, value]) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status).send(data);
  } catch (err) {
    console.error('API proxy error:', err.message);
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
