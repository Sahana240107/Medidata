import { TimelineIcon, SymptomIcon, LabIcon, ProcedureIcon, PinIcon } from './icons';

const TAG_STYLES = {
  default: { bg: 'var(--lavender-50)', color: 'var(--lavender-700)' },
  Recovered: { bg: '#e6f4ea', color: '#1e7e34' },
  Improved: { bg: '#e6f4ea', color: '#1e7e34' },
  Deteriorated: { bg: '#fdeaea', color: '#c62828' },
  Unresolved: { bg: '#fff4e5', color: '#b8770e' },
  'Partial Response': { bg: '#fff4e5', color: '#b8770e' },
  'Diagnosis confirmed': { bg: '#e8eaf6', color: 'var(--lavender-700)' },
  'Mixed outcomes': { bg: 'var(--lavender-50)', color: 'var(--text-secondary)' },
};

function Tag({ label }) {
  const style = TAG_STYLES[label] || TAG_STYLES.default;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

/** Circular match-score ring, with a soft purple glow behind it. */
function ScoreRing({ score = 0, size = 58 }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: -8, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--lavender-200) 0%, transparent 70%)',
        opacity: 0.7,
      }} />
      <svg width={size} height={size} style={{ position: 'relative', transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lavender-100)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--lavender-600)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

const ACTION_BUTTONS = [
  { key: 'timeline', icon: TimelineIcon, title: 'Timeline' },
  { key: 'symptom', icon: SymptomIcon, title: 'Symptoms' },
  { key: 'lab', icon: LabIcon, title: 'Lab Results' },
  { key: 'procedure', icon: ProcedureIcon, title: 'Procedures' },
];

/**
 * Vertical / stacked case row.
 * - Click anywhere on the row LOCKS the detail modal open, starting on the status/overview tab.
 * - Click an action icon locks the modal open directly on that tab.
 */
export default function CaseCard({ result, isPinned, isFocused, onLock, onPin }) {
  const {
    disease_name, match_score, hospital_name, specialty, case_count,
    country, outcome_tags,
  } = result;

  return (
    <div
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onClick={() => onLock('status')}
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, var(--white) 65%, var(--lavender-50) 130%)',
        border: `1.5px solid ${isFocused ? 'var(--lavender-400)' : 'var(--lavender-100)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: isFocused
          ? '0 0 0 4px var(--lavender-100), var(--shadow-hover)'
          : 'var(--shadow-card)',
        padding: '16px 20px 16px 24px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Purple accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
        background: 'linear-gradient(180deg, var(--lavender-400), var(--lavender-600))',
      }} />

      <ScoreRing score={match_score} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {disease_name}
        </div>
        <div style={{
          fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hospital_name} · {specialty}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {case_count} case{case_count === 1 ? '' : 's'}{country ? ` · ${country}` : ''}
          </span>
          {outcome_tags?.slice(0, 2).map((tag) => <Tag key={tag} label={tag} />)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {ACTION_BUTTONS.map(({ key, icon: Icon, title }) => (
          <button
            key={key}
            title={title}
            onClick={() => onLock(key)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--lavender-200)', background: 'var(--lavender-50)',
              color: 'var(--lavender-600)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lavender-600)'; e.currentTarget.style.borderColor = 'var(--lavender-600)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lavender-50)'; e.currentTarget.style.borderColor = 'var(--lavender-200)'; e.currentTarget.style.color = 'var(--lavender-600)'; }}
          >
            <Icon size={15} />
          </button>
        ))}

        <div style={{ width: 1, height: 22, background: 'var(--lavender-100)', margin: '0 4px' }} />

        <button
          onClick={onPin}
          title={isPinned ? 'Unpin case' : 'Pin case'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
            background: isPinned ? 'var(--lavender-600)' : 'var(--white)',
            border: `1px solid ${isPinned ? 'var(--lavender-600)' : 'var(--lavender-200)'}`,
            color: isPinned ? 'white' : 'var(--text-muted)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <PinIcon size={15} filled={isPinned} />
        </button>
      </div>
    </div>
  );
}