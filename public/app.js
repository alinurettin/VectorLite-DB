// VectorLite-DB Interactive Canvas & Search Controller
const canvas = document.getElementById('vectorCanvas');
const ctx = canvas.getContext('2d');
const resultsList = document.getElementById('resultsList');

let allVectors = [];
let lastQueryPoint = null;
let activeHighlightIds = new Set();

async function loadVectors() {
  try {
    const statsRes = await fetch('/api/stats');
    const statsData = await statsRes.json();
    if (statsData.stats) {
      document.getElementById('mTotal').textContent = statsData.stats.totalVectors;
      document.getElementById('mDim').textContent = `${statsData.stats.dimension}-D`;
      document.getElementById('mMetric').textContent = statsData.stats.defaultMetric.toUpperCase();
      document.getElementById('mLatency').textContent = `${statsData.stats.avgQueryLatencyMs} ms`;
    }

    // Query with a neutral vector to fetch top vectors for display
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: [0.5, 0.5, 0.5, 0.5], topK: 50 })
    });
    const data = await res.json();
    if (data.queryRes && data.queryRes.results) {
      allVectors = data.queryRes.results;
      drawCanvas();
    }
  } catch (e) {
    console.error('Failed to load vectors', e);
  }
}

function projectToCanvas(v) {
  // Simple 2D projection mapping v[0] and v[1] (normalized roughly 0..1) to canvas width/height
  const x = Math.max(30, Math.min(canvas.width - 30, (v[0] || 0.5) * canvas.width));
  const y = Math.max(30, Math.min(canvas.height - 30, (1 - (v[1] || 0.5)) * canvas.height));
  return { x, y };
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw lines to query point if active
  if (lastQueryPoint) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(lastQueryPoint.x, lastQueryPoint.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    for (const v of allVectors) {
      if (activeHighlightIds.has(v.id)) {
        const p = projectToCanvas(v.vector);
        ctx.beginPath();
        ctx.moveTo(lastQueryPoint.x, lastQueryPoint.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // Draw vector points
  for (const v of allVectors) {
    const p = projectToCanvas(v.vector);
    const isHighlighted = activeHighlightIds.has(v.id);

    ctx.beginPath();
    ctx.arc(p.x, p.y, isHighlighted ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isHighlighted ? '#10b981' : '#6366f1';
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#a7f3d0' : '#818cf8';
    ctx.lineWidth = isHighlighted ? 2 : 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = isHighlighted ? '#f8fafc' : '#94a3b8';
    ctx.font = isHighlighted ? 'bold 11px sans-serif' : '10px sans-serif';
    ctx.fillText(v.id, p.x + 8, p.y - 4);
  }
}

function renderResults(results) {
  resultsList.innerHTML = '';
  activeHighlightIds.clear();

  if (!results || results.length === 0) {
    resultsList.innerHTML = '<div class="empty-state">No vectors matched the query criteria.</div>';
    return;
  }

  for (const r of results) {
    activeHighlightIds.add(r.id);
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <div class="result-top">
        <span class="result-id">${r.id}</span>
        <span class="result-score">Score: ${(r.score || 0).toFixed(4)}</span>
      </div>
      <div class="result-meta">${r.metadata?.label || 'Vector'} &bull; ${r.metadata?.category || 'uncategorized'}</div>
      <div class="result-vec">[${(r.vector || []).map(n => n.toFixed(2)).join(', ')}]</div>
    `;
    resultsList.appendChild(item);
  }

  drawCanvas();
}

async function executeQuery(vector, metric = 'cosine') {
  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector, metric, topK: 3 })
    });
    const data = await res.json();
    if (data.queryRes) {
      renderResults(data.queryRes.results);
      document.getElementById('mLatency').textContent = `${data.queryRes.latencyMs} ms`;
    }
  } catch (e) {
    console.error('Query failed', e);
  }
}

// Canvas Click Handler -> Spatial Search
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  lastQueryPoint = { x, y };
  const v0 = x / canvas.width;
  const v1 = 1 - (y / canvas.height);
  const queryVec = [v0, v1, 0.5, 0.2]; // 4-D sample

  executeQuery(queryVec, document.getElementById('queryMetric').value);
});

// Insert Vector Handler
document.getElementById('insertForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('insId').value;
  const coordsStr = document.getElementById('insCoords').value;
  const label = document.getElementById('insLabel').value;

  try {
    const vector = coordsStr.split(',').map(n => parseFloat(n.trim()));
    const res = await fetch('/api/vectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, vector, metadata: { label, category: 'user-added' } })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Vector ${id} successfully upserted!`);
      loadVectors();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Invalid vector coordinates format: ${err.message}`);
  }
});

// Query Form Handler
document.getElementById('queryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const coordsStr = document.getElementById('queryCoords').value;
  const metric = document.getElementById('queryMetric').value;
  try {
    const vector = coordsStr.split(',').map(n => parseFloat(n.trim()));
    const p = projectToCanvas(vector);
    lastQueryPoint = p;
    executeQuery(vector, metric);
  } catch (err) {
    alert(`Invalid query vector format: ${err.message}`);
  }
});

// K-Means Cluster Button
document.getElementById('btnCluster').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/cluster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: 3 })
    });
    const data = await res.json();
    if (data.clusters) {
      resultsList.innerHTML = '';
      data.clusters.forEach(cl => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="result-top">
            <span class="result-id">Cluster #${cl.clusterIndex + 1}</span>
            <span class="result-score">${cl.members.length} Members</span>
          </div>
          <div class="result-meta">Centroid: [${cl.centroid.map(n => n.toFixed(2)).join(', ')}]</div>
          <div class="result-vec">Members: ${cl.members.map(m => m.id).join(', ')}</div>
        `;
        resultsList.appendChild(item);
      });
    }
  } catch (e) {
    alert('K-Means execution failed: ' + e.message);
  }
});

document.getElementById('btnReload').addEventListener('click', loadVectors);

// Initial Load
loadVectors();
