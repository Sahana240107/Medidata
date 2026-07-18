'use client';

/**
 * NetworkActivityTable — "Network Activity Signals"-style table, grounded in
 * expert_stats + profiles + hospitals (no dependency on the not-yet-built
 * research_signals -> PI linkage). Columns: Principal Investigator,
 * Institution, Focus Area, Case Volume (bar), Status.
 */

const STATUS_STYLE = {
  verified: { bg: '#dcfce7', color: '#16a34a', label: 'VERIFIED' },
  pending: { bg: '#fef3c7', color: '#d97706', label: 'IN REVIEW' },
  rejected: { bg: '#fce4ec', color: '#c2185b', label: 'UNVERIFIED' },
};

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function NetworkActivityTable({ rows }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--lavender-100)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(92,107,192,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 20px',
          borderBottom: '1px solid var(--lavender-100)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lavender-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M18 17V9M13 17V5M8 17v-3" />
        </svg>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
          Network Activity Signals
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--lavender-50)' }}>
              {['Principal Investigator', 'Institution', 'Focus Area', 'Case Volume', 'Status'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 20px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const status = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
              return (
                <tr
                  key={row.doctor_id}
                  style={{
                    borderTop: '1px solid var(--lavender-50)',
                    animation: 'slideUp 0.4s ease both',
                    animationDelay: `${Math.min(i * 0.04, 0.4)}s`,
                  }}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--lavender-400), var(--lavender-700))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials(row.full_name)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{row.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {row.hospital_name || '\u2014'}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {row.focus_area}
                  </td>
                  <td style={{ padding: '12px 20px', minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--lavender-100)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${row.signal_strength_pct}%`,
                            height: '100%',
                            borderRadius: 4,
                            background: 'linear-gradient(90deg, var(--lavender-500), var(--lavender-600))',
                            transition: 'width 1s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 30 }}>{row.cases_managed}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: status.bg,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No expert activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}