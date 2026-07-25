'use client';

import styles from './research.module.css';
import { downloadAuditPackUrl } from '@/lib/api/verdict';

const MODULE_COLORS = {
  evidence: '#5c6bc0',
  falsification: '#f2ab4d',
  verdict: '#1e7e34',
};

function moduleOf(step) {
  return String(step).split('.')[0] || 'trace';
}

function traceToCsv(auditPack) {
  const header = 'step,function,timestamp\n';
  const rows = auditPack.trace
    .map((e) => [e.step, e.function, e.timestamp].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return header + rows;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPackViewer({ auditPack, verdictId, simulated }) {
  // Simulated packs were never computed server-side, so there's nothing for
  // downloadAuditPackUrl() to fetch — build the download client-side instead
  // so the buttons still work mid-demo even when the backend isn't wired.
  const handleDownload = (format) => (e) => {
    if (!simulated) return; // real link handles it
    e.preventDefault();
    if (format === 'csv') {
      downloadBlob(traceToCsv(auditPack), `audit_pack_${auditPack.audit_pack_id}.csv`, 'text/csv');
    } else {
      downloadBlob(JSON.stringify(auditPack, null, 2), `audit_pack_${auditPack.audit_pack_id}.json`, 'application/json');
    }
  };

  return (
    <div className={`${styles.panel} ${styles.fadeInUp}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>
          Audit Trail
          {simulated && <span className={styles.simBadge}>Simulated</span>}
        </span>
        <div className={styles.downloadBtns}>
          <a
            href={simulated ? '#' : downloadAuditPackUrl(verdictId, 'json')}
            onClick={handleDownload('json')}
            className={styles.downloadBtn}
          >
            JSON
          </a>
          <a
            href={simulated ? '#' : downloadAuditPackUrl(verdictId, 'csv')}
            onClick={handleDownload('csv')}
            className={styles.downloadBtn}
          >
            CSV
          </a>
        </div>
      </div>

      <div className={styles.auditTimeline}>
        {auditPack.trace.map((entry, i) => {
          const mod = moduleOf(entry.step);
          return (
            <div key={i} className={styles.auditTimelineRow} style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
              <div className={styles.auditTimelineRail}>
                <span className={styles.auditTimelineDot} style={{ background: MODULE_COLORS[mod] || 'var(--lavender-400)' }} />
                {i < auditPack.trace.length - 1 && <span className={styles.auditTimelineLine} />}
              </div>
              <div className={styles.auditTimelineBody}>
                <div className={styles.auditTimelineTop}>
                  <span className={styles.auditStep}>{entry.step}</span>
                  <span className={styles.auditTime}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <div className={styles.auditFunc}>{entry.function}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.auditPackId}>audit pack: {auditPack.audit_pack_id}</div>
    </div>
  );
}
