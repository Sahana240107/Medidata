// Routed through the Next.js rewrite in next.config.js:
//   { source: '/api/backend/:path*', destination: `${NEXT_PUBLIC_API_URL}/:path*` }
// so this must be prefixed with /api/backend, not called as /api/falsification/... directly.
const BASE = '/api/backend/api/falsification/dataset';

async function parseErrorMessage(res) {
  try {
    const body = await res.json();
    return body?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * Uploads a CSV/XLSX file of cases. Returns
 * { dataset_id, filename, row_count, columns, uploaded_at, preview }.
 */
export async function uploadCaseDataset(file, { onProgress } = {}) {
  const formData = new FormData();
  formData.append('file', file);

  // Use XHR (not fetch) so upload progress can be reported for large files.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body);
      } else {
        const err = new Error(body?.detail || `Upload failed (${xhr.status})`);
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — network error.'));
    xhr.send(formData);
  });
}

export async function getUploadedDataset(datasetId) {
  const res = await fetch(`${BASE}/${datasetId}`);
  if (!res.ok) {
    const err = new Error(await parseErrorMessage(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function deleteUploadedDataset(datasetId) {
  const res = await fetch(`${BASE}/${datasetId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = new Error(await parseErrorMessage(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
}