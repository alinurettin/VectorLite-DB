/**
 * VectorLite-DB - Exhaustive Multi-Scenario Verification Suite
 * Author: Ali Nurettin Demir (@alinurettin)
 * 
 * Verifies:
 * - Mathematical precision of vector distance metrics (Cosine, Euclidean L2, Dot Product)
 * - L2 normalization invariants
 * - Dimensional bounds checking & exception handling
 * - Top-K nearest neighbor ranking & metadata pre-filtering
 * - In-memory K-Means clustering convergence
 * - Ephemeral HTTP REST API integration
 */

const assert = require('assert');
const http = require('http');
const { VectorMath, VectorLiteDB } = require('../src/engine');
const { startServer } = require('../src/index');

console.log('================================================================');
console.log('📐 VectorLite-DB: Exhaustive Multi-Scenario Verification Suite');
console.log('================================================================\n');

let assertionCount = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  assertionCount++;
  console.log(`  ✓ [Assertion #${assertionCount}] ${msg}`);
}

// -------------------------------------------------------------
// SECTION 1: Vector Mathematical Formulas & Normalization
// -------------------------------------------------------------
console.log('[SECTION 1] Testing Vector Mathematical Formulas & Normalization...');

// Dot Product
const vA = [1, 2, 3];
const vB = [4, 5, 6];
const dot = VectorMath.dotProduct(vA, vB); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
check(dot === 32, 'Dot product of [1,2,3] and [4,5,6] equals exactly 32');

// Magnitude (Pythagorean 3-4-5)
const v345 = [3, 4];
const mag = VectorMath.magnitude(v345);
check(mag === 5, 'Magnitude of [3, 4] equals exactly 5.0');

// L2 Normalization
const norm = VectorMath.normalize(v345);
check(Math.abs(norm[0] - 0.6) < 1e-6 && Math.abs(norm[1] - 0.8) < 1e-6, 'L2 normalization yields unit coordinates [0.6, 0.8]');
check(Math.abs(VectorMath.magnitude(norm) - 1.0) < 1e-6, 'Normalized vector has exact magnitude of 1.0');

// Cosine Similarity
const vIdentical1 = [1, 0, 0];
const vIdentical2 = [5, 0, 0];
const cosIdentical = VectorMath.cosineSimilarity(vIdentical1, vIdentical2);
check(Math.abs(cosIdentical - 1.0) < 1e-6, 'Cosine similarity of parallel collinear vectors is exactly 1.0');

const vOrtho1 = [1, 0];
const vOrtho2 = [0, 1];
const cosOrtho = VectorMath.cosineSimilarity(vOrtho1, vOrtho2);
check(Math.abs(cosOrtho - 0.0) < 1e-6, 'Cosine similarity of orthogonal perpendicular vectors is exactly 0.0');

const vOpposite = [-1, 0];
const cosOpposite = VectorMath.cosineSimilarity(vOrtho1, vOpposite);
check(Math.abs(cosOpposite - (-1.0)) < 1e-6, 'Cosine similarity of opposing diametric vectors is exactly -1.0');

// Euclidean Distance
const dist345 = VectorMath.euclideanDistance([0, 0], [3, 4]);
check(dist345 === 5, 'Euclidean distance from origin [0,0] to [3,4] equals exactly 5.0');

// -------------------------------------------------------------
// SECTION 2: Vector Database In-Memory Engine & Indexing
// -------------------------------------------------------------
console.log('\n[SECTION 2] Testing VectorLiteDB Indexing & Query Ranking...');

const db = new VectorLiteDB({ dimension: 3 });
check(db.dimension === 3, 'Vector database initialized with target dimension 3');

// Upserting vectors
db.upsert('doc-ai-1', [1.0, 0.1, 0.0], { category: 'ai', title: 'NLP Models' });
db.upsert('doc-ai-2', [0.9, 0.2, 0.0], { category: 'ai', title: 'Transformers' });
db.upsert('doc-db-1', [0.0, 0.9, 0.9], { category: 'database', title: 'B-Trees' });
db.upsert('doc-db-2', [0.1, 0.8, 0.95], { category: 'database', title: 'LSM-Trees' });
check(db.count() === 4, 'Successfully indexed 4 distinct high-dimensional vectors');

// Dimensional Bounds Enforcement
let dimErrorThrown = false;
try {
  db.upsert('doc-invalid', [1.0, 2.0]); // 2-D vector in 3-D DB
} catch (e) {
  dimErrorThrown = true;
}
check(dimErrorThrown === true, 'Database strictly rejects vectors with mismatched dimensionality');

// Query with Cosine Similarity
const qAI = db.query([1.0, 0.0, 0.0], { topK: 2, metric: 'cosine' });
check(qAI.results.length === 2, 'Top-2 query returns exactly 2 ranked results');
check(qAI.results[0].id === 'doc-ai-1', 'Highest ranked neighbor is doc-ai-1 with highest cosine score');
check(qAI.results[0].score > qAI.results[1].score, 'Cosine search results are sorted in descending order of similarity');

// Query with Euclidean Distance
const qDist = db.query([0.0, 1.0, 1.0], { topK: 2, metric: 'euclidean' });
check(qDist.results[0].id === 'doc-db-1', 'Euclidean nearest neighbor correctly identifies closest spatial vector doc-db-1');
check(qDist.results[0].score < qDist.results[1].score, 'Euclidean search results are sorted in ascending order of distance');

// Metadata Filtering
const qFiltered = db.query([1.0, 0.0, 0.0], { topK: 5, filter: { category: 'database' } });
check(qFiltered.results.length === 2, 'Metadata pre-filter constrained search strictly to category: database');
check(qFiltered.results.every(r => r.metadata.category === 'database'), 'All returned candidates satisfy metadata filter criteria');

// Deletion
const deleted = db.delete('doc-ai-2');
check(deleted === true, 'Vector deletion returned true for existing item');
check(db.count() === 3, 'Vector count decremented accurately following deletion');

// -------------------------------------------------------------
// SECTION 3: Unsupervised K-Means Clustering
// -------------------------------------------------------------
console.log('\n[SECTION 3] Testing Unsupervised K-Means Clustering Algorithm...');

db.upsert('c1-a', [10, 10, 10]);
db.upsert('c1-b', [10.2, 9.8, 10.1]);
db.upsert('c2-a', [-10, -10, -10]);
db.upsert('c2-b', [-9.8, -10.2, -10]);

const clusters = db.cluster(2);
check(clusters.length === 2, 'K-Means partitions dataset into requested k=2 clusters');
check(clusters[0].members.length > 0 && clusters[1].members.length > 0, 'Every cluster contains assigned member vectors');
check(clusters[0].centroid.length === 3, 'Cluster centroids have matching dimensionality');

// -------------------------------------------------------------
// SECTION 4: Live HTTP REST API Integration
// -------------------------------------------------------------
console.log('\n[SECTION 4] Testing Live HTTP Ephemeral Server Integration...');

const server = startServer(0, () => {
  const port = server.address().port;
  console.log(`  [HTTP] VectorLite-DB active on ephemeral port ${port}`);

  // 1. GET /api/health
  http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
    check(res.statusCode === 200, 'GET /api/health returns HTTP 200 OK');

    // 2. GET /api/stats
    http.get(`http://127.0.0.1:${port}/api/stats`, (resStats) => {
      check(resStats.statusCode === 200, 'GET /api/stats returns HTTP 200 OK');

      // 3. POST /api/vectors
      const newVec = JSON.stringify({
        id: 'test-vec-http',
        vector: [0.7, 0.7, 0.1, 0.05],
        metadata: { tag: 'http-test' }
      });

      const reqPost = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/vectors',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(newVec) }
      }, (resPost) => {
        check(resPost.statusCode === 200, 'POST /api/vectors successfully indexes new vector');

        // 4. POST /api/query
        const queryPayload = JSON.stringify({
          vector: [0.7, 0.7, 0.1, 0.05],
          topK: 1
        });

        const reqQuery = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/api/query',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(queryPayload) }
        }, (resQuery) => {
          check(resQuery.statusCode === 200, 'POST /api/query returns HTTP 200 OK');
          let qBody = '';
          resQuery.on('data', c => qBody += c);
          resQuery.on('end', () => {
            const qJson = JSON.parse(qBody);
            check(qJson.queryRes.results[0].id === 'test-vec-http', 'Top nearest neighbor matches the query vector itself');
            check(Math.abs(qJson.queryRes.results[0].score - 1.0) < 1e-4, 'Exact match yields Cosine Similarity of ~1.0');

            // 5. DELETE /api/vectors/:id
            const reqDel = http.request({
              hostname: '127.0.0.1',
              port,
              path: '/api/vectors/test-vec-http',
              method: 'DELETE'
            }, (resDel) => {
              check(resDel.statusCode === 200, 'DELETE /api/vectors/:id returns HTTP 200 OK');

              server.close(() => {
                console.log('\n================================================================');
                console.log(`🎉 ALL ${assertionCount} ASSERTIONS PASSED WITH 100% SUCCESS!`);
                console.log('================================================================\n');
                process.exit(0);
              });
            });
            reqDel.end();
          });
        });
        reqQuery.write(queryPayload);
        reqQuery.end();
      });
      reqPost.write(newVec);
      reqPost.end();
    });
  });
});
