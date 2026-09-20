/**
 * VectorLite-DB - Lightweight Zero-Dependency Embedded Vector Search Engine
 * Author: Ali Nurettin Demir (@alinurettin)
 * 
 * Features:
 * - Mathematical distance metrics: Cosine Similarity, Euclidean Distance (L2), Dot Product
 * - Exact top-K nearest neighbor search with metadata pre-filtering
 * - Dimensional integrity verification & L2 vector normalization
 * - In-memory K-Means clustering algorithm
 */

class VectorMath {
  static dotProduct(a, b) {
    if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  static magnitude(a) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * a[i];
    }
    return Math.sqrt(sum);
  }

  static normalize(a) {
    const mag = VectorMath.magnitude(a);
    if (mag === 0) return a.slice();
    return a.map(v => v / mag);
  }

  static cosineSimilarity(a, b) {
    const magA = VectorMath.magnitude(a);
    const magB = VectorMath.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return VectorMath.dotProduct(a, b) / (magA * magB);
  }

  static euclideanDistance(a, b) {
    if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

class VectorLiteDB {
  constructor(options = {}) {
    this.dimension = options.dimension || 4;
    this.defaultMetric = options.defaultMetric || 'cosine'; // 'cosine' | 'euclidean' | 'dot'
    this.vectors = new Map(); // id -> { id, vector, metadata, normVector }
    this.startTime = Date.now();
    this.queryCount = 0;
    this.totalQueryLatencyMs = 0;
  }

  upsert(id, vector, metadata = {}) {
    if (!id || typeof id !== 'string') throw new Error('Vector ID must be a non-empty string');
    if (!Array.isArray(vector) || vector.length !== this.dimension) {
      throw new Error(`Vector must be a float array of exactly dimension ${this.dimension}`);
    }

    // Validate finite numbers
    for (let i = 0; i < vector.length; i++) {
      if (typeof vector[i] !== 'number' || !Number.isFinite(vector[i])) {
        throw new Error(`Invalid non-finite number at index ${i}`);
      }
    }

    const normVector = VectorMath.normalize(vector);
    const record = {
      id,
      vector: Array.from(vector),
      normVector,
      metadata: metadata || {},
      updatedAt: Date.now()
    };

    this.vectors.set(id, record);
    return record;
  }

  upsertBatch(items = []) {
    const results = [];
    for (const item of items) {
      results.push(this.upsert(item.id, item.vector, item.metadata));
    }
    return results;
  }

  get(id) {
    return this.vectors.get(id) || null;
  }

  delete(id) {
    return this.vectors.delete(id);
  }

  count() {
    return this.vectors.size;
  }

  clear() {
    this.vectors.clear();
  }

  query(queryVector, options = {}) {
    const t0 = Date.now();
    if (!Array.isArray(queryVector) || queryVector.length !== this.dimension) {
      throw new Error(`Query vector must have dimension ${this.dimension}`);
    }

    const topK = Math.max(1, options.topK || 5);
    const metric = options.metric || this.defaultMetric;
    const filter = options.filter || null; // e.g. { category: 'ai' }

    const candidates = [];

    for (const record of this.vectors.values()) {
      // Metadata pre-filtering
      if (filter && typeof filter === 'object') {
        let match = true;
        for (const [k, v] of Object.entries(filter)) {
          if (record.metadata[k] !== v) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      let score = 0;
      if (metric === 'cosine') {
        score = VectorMath.cosineSimilarity(queryVector, record.vector);
      } else if (metric === 'euclidean') {
        score = VectorMath.euclideanDistance(queryVector, record.vector);
      } else if (metric === 'dot') {
        score = VectorMath.dotProduct(queryVector, record.vector);
      }

      candidates.push({
        id: record.id,
        score,
        metadata: record.metadata,
        vector: record.vector
      });
    }

    // Sort according to metric
    if (metric === 'cosine' || metric === 'dot') {
      candidates.sort((a, b) => b.score - a.score); // Highest similarity first
    } else {
      candidates.sort((a, b) => a.score - b.score); // Lowest distance first
    }

    const results = candidates.slice(0, topK);
    const latency = Date.now() - t0;
    this.queryCount++;
    this.totalQueryLatencyMs += latency;

    return {
      results,
      totalCandidates: candidates.length,
      metric,
      topK,
      latencyMs: latency
    };
  }

  cluster(k = 3, maxIterations = 20) {
    const entries = Array.from(this.vectors.values());
    if (entries.length < k) {
      throw new Error(`Not enough vectors (${entries.length}) to form ${k} clusters`);
    }

    // Pick k initial centroids randomly
    let centroids = entries.slice(0, k).map(e => Array.from(e.vector));

    let assignments = new Array(entries.length).fill(0);

    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      // Assign to nearest centroid
      for (let i = 0; i < entries.length; i++) {
        let bestDist = Infinity;
        let bestC = 0;
        for (let c = 0; c < k; c++) {
          const dist = VectorMath.euclideanDistance(entries[i].vector, centroids[c]);
          if (dist < bestDist) {
            bestDist = dist;
            bestC = c;
          }
        }
        if (assignments[i] !== bestC) {
          assignments[i] = bestC;
          changed = true;
        }
      }

      if (!changed) break; // Converged

      // Recompute centroids
      const newCentroids = Array.from({ length: k }, () => new Array(this.dimension).fill(0));
      const counts = new Array(k).fill(0);

      for (let i = 0; i < entries.length; i++) {
        const c = assignments[i];
        counts[c]++;
        for (let d = 0; d < this.dimension; d++) {
          newCentroids[c][d] += entries[i].vector[d];
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          centroids[c] = newCentroids[c].map(v => v / counts[c]);
        }
      }
    }

    // Build clusters output
    const clusters = Array.from({ length: k }, (_, c) => ({
      clusterIndex: c,
      centroid: centroids[c],
      members: []
    }));

    for (let i = 0; i < entries.length; i++) {
      const c = assignments[i];
      clusters[c].members.push({ id: entries[i].id, metadata: entries[i].metadata });
    }

    return clusters;
  }

  getStats() {
    return {
      totalVectors: this.vectors.size,
      dimension: this.dimension,
      defaultMetric: this.defaultMetric,
      totalQueries: this.queryCount,
      avgQueryLatencyMs: this.queryCount > 0 ? (this.totalQueryLatencyMs / this.queryCount).toFixed(3) : '0.000',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

module.exports = { VectorMath, VectorLiteDB };