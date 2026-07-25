'use client';

const VERIFICATION_STYLES = {
  verified: { bg: '#e6f4ea', color: '#1e7e34', label: 'Verified Node', icon: '✓' },
  pending: { bg: '#fff4e5', color: '#b8770e', label: 'Verification Pending', icon: '…' },
  rejected: { bg: '#fdeaea', color: '#c62828', label: 'Unverified', icon: '!' },
};

/** Large circular gauge for the hospital's discovery score — the page's hero visual. */
function DiscoveryRing({ score = 0, size = 132 }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: -18, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%)',
      }} />
      <svg width={size} height={size} style={{ position: 'relative', transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="white" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: 'white', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
          {Math.round(pct)}
        </span>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Discovery Score
        </span>
      </div>
    </div>
  );
}

/**
 * Hero header for the Hospital Insights page: identity, verification
 * status, global rank, and a one-line plain-language summary of where
 * this hospital stands in the network — alongside its discovery score.
 */
export default function HospitalProfileHeader({ hospital, totalHospitals }) {
  if (!hospital) return null;

  const verification = VERIFICATION_STYLES[hospital.verification_status] || VERIFICATION_STYLES.pending;
  const rank = hospital.global_rank;
  // "Top X%" = you rank better than (100 - X)% of the network. Rank 1 of
  // 25 should read "top 4%", not "top 100%" — this is X = ceil(rank/total*100).
  const percentile = rank && totalHospitals
    ? Math.min(100, Math.max(1, Math.ceil((rank / totalHospitals) * 100)))
    : null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--lavender-700) 0%, var(--lavender-500) 100%)',
      borderRadius: 'var(--radius-lg)',
      padding: '32px 36px',
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      {/* Decorative orbs */}
      <div style={{ position: 'absolute', right: -40, top: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', right: 120, bottom: -70, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      <DiscoveryRing score={hospital.discovery_score} />

      <div style={{ position: 'relative', zIndex: 1, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: verification.bg, color: verification.color,
            fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
          }}>
            {verification.icon} {verification.label}
          </span>
          {rank && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.18)', color: 'white',
              fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
            }}>
              🏅 Global Rank #{rank}{totalHospitals ? ` of ${totalHospitals}` : ''}
            </span>
          )}
        </div>

        <h1 style={{
          fontSize: 26, fontWeight: 800, color: 'white',
          fontFamily: "'Sora', sans-serif", marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hospital.name}
        </h1>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 14 }}>
          {[hospital.city, hospital.country].filter(Boolean).join(', ') || 'Location not set'}
        </div>

        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6, maxWidth: 560 }}>
          {percentile
            ? <>Your hospital is in the <strong>top {percentile}%</strong> of {totalHospitals} hospitals in the MediData network, with <strong>{hospital.case_count}</strong> case{hospital.case_count === 1 ? '' : 's'} contributed so far.</>
            : <>Your hospital has contributed <strong>{hospital.case_count}</strong> case{hospital.case_count === 1 ? '' : 's'} to the MediData network so far.</>}
        </p>
      </div>
    </div>
  );
}
