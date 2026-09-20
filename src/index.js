/**
 * VectorLite-DB - Production Vector Search API Server
 * Author: Ali Nurettin Demir (@alinurettin)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { VectorLiteDB } = require('./engine');

const DIMENSION = parseInt(process.env.VECTOR_DIMENSION, 10) || 4;
const db = new VectorLiteDB({ dimension: DIMENSION, defaultMetric: 'cosine' });

// Seed with initial representative vectors for instant demo
db.upsertBatch([
  { id: 'vec-alpha', vector: [0.95, 0.1, 0.2, 0.05], metadata: { label: 'Machine Learning', category: 'ai' } },
  { id: 'vec-beta', vector: [0.88, 0.25, 0.15, 0.1], metadata: { label: 'Deep Learning', category: 'ai' } },
  { id: 'vec-gamma', vector: [0.05, 0.9, 0.85, 0.1], metadata: { label: 'Distributed Systems', category: 'infra' } },
  { id: 'vec-delta', vector: [0.1, 0.82, 0.95, 0.2], metadata: { label: 'Cloud Architecture', category: 'infra' } },
  { id: 'vec-epsilon', vector: [0.3, 0.4, 0.1, 0.92], metadata: { label: 'Cryptography & Zero Trust', category: 'sec' } }
]);

const PORT = parseInt(process.env.PORT, 10) || 6009;
const publicDir = path.join(__dirname, '..', 'public');
const startTime = Date.now();

function requestHandler(req, res) {
  const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = reqUrl.pathname;

  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // 1. Health Status
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        status: 'UP',
        service: 'VectorLite-DB',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      }));
    }

    // 2. Telemetry & Stats
    if (pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        service: 'VectorLite-DB',
        stats: db.getStats()
      }));
    }

    // 3. Upsert Vector
    if (req.method === 'POST' && pathname === '/api/vectors') {
      try {
        const parsed = JSON.parse(body || '{}');
        const record = db.upsert(parsed.id, parsed.vector, parsed.metadata);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: true, record }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // 4. Query Nearest Neighbors
    if (req.method === 'POST' && pathname === '/api/query') {
      try {
        const parsed = JSON.parse(body || '{}');
        const queryRes = db.query(parsed.vector, {
          topK: parsed.topK || 5,
          metric: parsed.metric || 'cosine',
          filter: parsed.filter
        });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: true, queryRes }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // 5. K-Means Clustering
    if (req.method === 'POST' && pathname === '/api/cluster') {
      try {
        const parsed = JSON.parse(body || '{}');
        const k = parsed.k || 3;
        const clusters = db.cluster(k);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: true, clusters }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // 6. Delete Vector
    if (req.method === 'DELETE' && pathname.startsWith('/api/vectors/')) {
      const id = pathname.replace('/api/vectors/', '');
      const deleted = db.delete(id);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ success: true, deleted, id }));
    }

    // 7. Static Dashboard UI
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      return res.end(fs.readFileSync(filePath));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
}

function startServer(portToUse = PORT, callback) {
  const server = http.createServer(requestHandler);
  server.listen(portToUse, callback);
  return server;
}

if (require.main === module) {
  startServer(PORT, () => {
    console.log(`📐 VectorLite-DB live at http://localhost:${PORT}`);
  });
}

module.exports = { startServer, db };
