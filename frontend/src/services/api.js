/**
 * api.js — All backend fetch calls.
 * WRITTEN BY AGENT — this file was completely missing from Member 3's frontend.
 * Uses relative paths (/api/...) so Vite proxy routes them to localhost:8000.
 */

export async function startAnalysis(file, config = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(config));

  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

/** GET /api/report/{jobId} — poll for results */
export async function getReport(jobId) {
  const res = await fetch(`/api/report/${jobId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Report fetch failed: ${res.status}`);
  }

  return res.json();
}

/** GET /health */
export async function checkHealth() {
  const res = await fetch('/health');
  return res.json();
}

export async function importFromKaggle(datasetId) {
  const res = await fetch('/api/import/kaggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Kaggle import failed');
  }
  return res.json();
}

export async function importFromSheets(url) {
  const res = await fetch('/api/import/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Google Sheets import failed');
  }
  return res.json();
}

export async function importFromHuggingFace(datasetName, split = 'train', maxRows = 10000) {
  const res = await fetch('/api/import/huggingface', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: datasetName, split, max_rows: maxRows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'HuggingFace import failed');
  }
  return res.json();
}