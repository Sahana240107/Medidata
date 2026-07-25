'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './research.module.css';
import { uploadCaseDataset, deleteUploadedDataset } from '@/lib/api/datasetUpload';
import { useUploadedDataset } from '@/lib/hooks/useUploadedDataset';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

function isAcceptedFile(file) {
  const name = (file?.name || '').toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatasetUploadPanel({ variant = 'collapsed' }) {
  const {
    datasets, activeDatasetId, activeDataset,
    addDataset, setActiveDatasetId, removeDataset,
  } = useUploadedDataset();

  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;

    const rejected = files.filter((f) => !isAcceptedFile(f));
    if (rejected.length > 0) {
      setError(`Skipped ${rejected.map((f) => f.name).join(', ')} — only .csv, .xlsx, .xls are supported.`);
    } else {
      setError(null);
    }

    const accepted = files.filter(isAcceptedFile);
    for (const file of accepted) {
      setUploading(true);
      setProgress(0);
      try {
        const result = await uploadCaseDataset(file, { onProgress: setProgress });
        addDataset({
          datasetId: result.dataset_id,
          filename: result.filename,
          rowCount: result.row_count,
          columns: result.columns,
          preview: result.preview,
          uploadedAt: result.uploaded_at,
          fileSize: file.size,
        });
      } catch (e) {
        setError(e.message || `Upload failed for ${file.name}.`);
      }
    }
    setUploading(false);
  }, [addDataset]);

  const onInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const openPicker = () => inputRef.current?.click();

  const handleRemove = async (datasetId) => {
    setRemovingId(datasetId);
    try {
      await deleteUploadedDataset(datasetId);
    } catch {
      // dataset may have already expired server-side — still clear locally
    } finally {
      removeDataset(datasetId);
      setRemovingId(null);
    }
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_EXTENSIONS.join(',')}
      multiple
      onChange={onInputChange}
      style={{ display: 'none' }}
    />
  );

  const dropzoneStyle = {
    border: `2px dashed ${dragActive ? 'var(--lavender-500)' : 'var(--lavender-100)'}`,
    borderRadius: 'var(--radius-md)',
    background: dragActive ? 'var(--lavender-50)' : 'var(--white)',
    padding: variant === 'collapsed' ? '16px' : '26px 20px',
    textAlign: 'center',
    cursor: uploading ? 'default' : 'pointer',
    transition: 'all 0.15s',
  };

  const Dropzone = ({ compact = false }) => (
    <div
      style={dropzoneStyle}
      onClick={uploading ? undefined : openPicker}
      onDrop={uploading ? undefined : onDrop}
      onDragOver={uploading ? undefined : onDragOver}
      onDragLeave={uploading ? undefined : onDragLeave}
      role="button"
      tabIndex={0}
    >
      {hiddenInput}
      <svg width={compact ? 20 : 26} height={compact ? 20 : 26} viewBox="0 0 24 24" fill="none"
        stroke="var(--lavender-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ margin: '0 auto 6px' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      {uploading ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Uploading… {progress}%</div>
      ) : (
        <>
          <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 700, color: 'var(--navy)' }}>
            {datasets.length > 0 ? 'Drop another CSV or Excel file' : 'Drop a CSV or Excel file here'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
            or click to browse · .csv, .xlsx, .xls · multiple files OK
          </div>
        </>
      )}
    </div>
  );

  const DatasetCard = ({ d, compact = false }) => {
    const isActive = d.datasetId === activeDatasetId;
    return (
      <div
        key={d.datasetId}
        onClick={() => setActiveDatasetId(d.datasetId)}
        className={styles.datasetCard}
        style={{
          cursor: 'pointer',
          background: isActive ? 'var(--lavender-100)' : 'var(--lavender-50)',
          border: isActive ? '1.5px solid var(--lavender-500)' : '1px solid var(--lavender-100)',
        }}
      >
        {isActive && <span className={styles.datasetDot} />}
        <div className={styles.datasetName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.filename}
        </div>
        <div className={styles.datasetMeta}>
          {d.rowCount?.toLocaleString()} rows{d.fileSize ? ` · ${formatBytes(d.fileSize)}` : ''}
        </div>
        {!compact && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {isActive ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lavender-700)' }}>Active for engine runs</span>
            ) : (
              <button
                className={styles.linkBtn}
                style={{ fontSize: 11.5 }}
                onClick={(e) => { e.stopPropagation(); setActiveDatasetId(d.datasetId); }}
              >
                Use this dataset
              </button>
            )}
            <button
              className={styles.linkBtn}
              style={{ fontSize: 11.5, color: '#c62828' }}
              disabled={removingId === d.datasetId}
              onClick={(e) => { e.stopPropagation(); handleRemove(d.datasetId); }}
            >
              {removingId === d.datasetId ? 'Removing…' : 'Remove'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Collapsed variant ──
  if (variant === 'collapsed') {
    return (
      <div className={styles.panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className={styles.panelLabel}>Datasets{datasets.length > 0 ? ` (${datasets.length})` : ''}</div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: '#c62828', marginBottom: 10 }}>{error}</div>}

        {datasets.length > 0 && (
          <div className={styles.datasetGrid} style={{ marginBottom: 12 }}>
            {datasets.map((d) => <DatasetCard key={d.datasetId} d={d} compact />)}
          </div>
        )}

        <Dropzone compact />
      </div>
    );
  }

  // ── Expanded variant ──
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Upload Datasets</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            Upload one or more CSV/Excel files of cases. Pick which one is active — the hypothesis and engine runs below use it.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#c62828', marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#fee2e2' }}>
          {error}
        </div>
      )}

      <Dropzone />

      {datasets.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className={styles.templatesLabel} style={{ marginBottom: 8 }}>
            Uploaded datasets — click one to make it active
          </div>
          <div className={styles.datasetGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {datasets.map((d) => <DatasetCard key={d.datasetId} d={d} />)}
          </div>
        </div>
      )}

      {activeDataset?.preview?.length > 0 && (
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          <div className={styles.templatesLabel} style={{ marginBottom: 8 }}>
            Preview of active dataset — {activeDataset.filename} (first {activeDataset.preview.length} rows)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['id', 'disease', 'domain', 'hospital', 'country', 'sex', 'age_range', 'medications', 'outcome'].map((col) => (
                  <th key={col} style={{
                    textAlign: 'left', padding: '6px 10px', borderBottom: '1.5px solid var(--lavender-100)',
                    color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDataset.preview.map((row) => (
                <tr key={row.id}>
                  {['id', 'disease', 'domain', 'hospital', 'country', 'sex', 'age_range', 'medications', 'outcome'].map((col) => (
                    <td key={col} style={{
                      padding: '6px 10px', borderBottom: '1px solid var(--lavender-100)',
                      color: 'var(--navy)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}