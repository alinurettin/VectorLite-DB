class VectorEngine {
  constructor() {
    this.vectors = new Map();
  }
  dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
  }
  norm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
  }
  cosineSimilarity(a, b) {
    const normA = this.norm(a);
    const normB = this.norm(b);
    if (normA === 0 || normB === 0) return 0;
    return this.dotProduct(a, b) / (normA * normB);
  }
  euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  insert(id, vector, metadata = {}) {
    if (!Array.isArray(vector) || vector.length === 0) throw new Error('Invalid vector array');
    this.vectors.set(id, { vector, metadata, norm: this.norm(vector) });
    return { id, dimensions: vector.length };
  }
  search(queryVector, topK = 5) {
    if (!Array.isArray(queryVector) || queryVector.length === 0) throw new Error('Invalid query vector');
    const results = [];
    for (const [id, item] of this.vectors.entries()) {
      if (item.vector.length !== queryVector.length) continue;
      const score = this.cosineSimilarity(queryVector, item.vector);
      const euclidean = this.euclideanDistance(queryVector, item.vector);
      results.push({ id, score: parseFloat(score.toFixed(6)), euclideanDistance: parseFloat(euclidean.toFixed(6)), metadata: item.metadata });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  delete(id) { return this.vectors.delete(id); }
  count() { return this.vectors.size; }
}
module.exports = VectorEngine;