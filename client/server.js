import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1m', // Cache for 1 minute only
  etag: false   // Disable ETags to force fresh downloads
}));

// SPA fallback - serve index.html for all non-file requests
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`📁 Serving from: ${join(__dirname, 'dist')}`);
});
