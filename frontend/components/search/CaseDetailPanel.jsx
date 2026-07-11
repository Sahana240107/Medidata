'use client';

import { useEffect } from 'react';
import CaseTimeline from './CaseTimeline';
import { TimelineIcon, SymptomIcon, LabIcon, ProcedureIcon, CloseIcon } from './icons';

const TAB_META = {
  timeline: { label: 'Timeline', icon: TimelineIcon },
  symptom: { label: 'Symptoms', icon: SymptomIcon },
  lab: { label: 'Lab Results', icon: LabIcon },
  procedure: { label: 'Procedures', icon: ProcedureIcon },
};

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

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

function StatusTag({ label }) {
  const style = TAG_STYLES[label] || TAG_STYLES.default;
  return (
    <span style={{
      padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
      background: style.bg, color: style.color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function PillList({ items, tone = 'lavender' }) {
  const styles = tone === 'lavender'
    ? { bg: 'var(--lavender-50)', color: 'var(--lavender-700)', border: 'var(--lavender-200)', dot: 'var(--lavender-500)' }
    : { bg: '#fff9f0', color: '#b8770e', border: '#f3d9ac', dot: '#e79a3a' };

  if (!items?.length) {
    return (
      <div style={{
        fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
        padding: '48px 20px', background: 'var(--lavender-50)', borderRadius: 'var(--radius-md)',
      }}>
        No data recorded.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item) => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderRadius: 'var(--radius-md)', fontSize: 13.5,
          background: styles.bg, color: styles.color, border: `1px solid ${styles.border}`,
          lineHeight: 1.5,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: styles.dot, flexShrink: 0 }} />
          {item}
        </div>
      ))}
    </div>
  );
}

/** Default tab: outcome status + key facts about the case. */
function StatusOverview({ activeCase }) {
  const { outcome_tags, hospital_name, specialty, case_count, country, managing_doctor } = activeCase;

  const rows = [
    { label: 'Hospital', value: hospital_name },
    { label: 'Specialty', value: specialty },
    { label: 'Cases', value: case_count },
    { label: 'Country', value: country },
    { label: 'Managing Doctor', value: managing_doctor },
  ].filter((r) => r.value);

  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        Outcome
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
        {outcome_tags?.length
          ? outcome_tags.map((tag) => <StatusTag key={tag} label={tag} />)
          : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No outcome recorded yet.</span>}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        Case Details
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5,
            padding: '14px 18px', borderRadius: 'var(--radius-md)',
            background: 'var(--lavender-50)',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <span style={{ color: 'var(--navy)', fontWeight: 700, textAlign: 'right' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Centered floating modal over a blurred backdrop.
 * - Opens when a case is locked (row or action icon clicked).
 * - Outer box is a FIXED size — switching FAB tabs never resizes it, the
 *   inner content area scrolls instead so everything still fits.
 * - Defaults to the "status" tab (outcome + key facts) on open.
 * - The FAB row along the bottom edge holds the section tabs AND the close (X) button.
 */
export default function CaseDetailPanel({
  open, activeCase, activeTab, isLocked,
  onClose, onTabChange, onMouseEnter, onMouseLeave,
}) {
  useEffect(() => {
    if (!isLocked) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLocked, onClose]);

  const visible = open && !!activeCase;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(30, 20, 60, 0.38)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.18s ease',
      }}
      onClick={isLocked ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative',
          width: 'min(600px, 92vw)',
          height: 'min(720px, 90vh)',
          background: 'var(--white)',
          border: '1px solid var(--lavender-100)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 60px rgba(80, 60, 180, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          transition: 'transform 0.18s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {activeCase && (
          <>
            {/* Purple gradient header banner — the color pop */}
            <div style={{
              flexShrink: 0,
              background: 'linear-gradient(120deg, var(--lavender-600), var(--lavender-400))',
              padding: '26px 30px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                borderRadius: '50%', background: 'rgba(255,255,255,0.10)',
              }} />
              <div style={{
                position: 'absolute', bottom: -60, right: 60, width: 120, height: 120,
                borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
              }} />
              <div style={{ position: 'relative', minWidth: 0 }}>
                <div style={{
                  fontSize: 19, fontWeight: 800, color: 'white', fontFamily: "'Sora', sans-serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {activeCase.disease_name}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 5 }}>
                  {activeCase.hospital_name}
                </div>
              </div>
            </div>

            {/* Fixed-size box — only this inner area scrolls when content changes */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 30px 36px' }}>
              {activeTab === 'status' && <StatusOverview activeCase={activeCase} />}
              {activeTab === 'timeline' && (
                <>
                  <SectionHeader>{TAB_META.timeline.label}</SectionHeader>
                  <div style={{ background: 'var(--lavender-50)', borderRadius: 'var(--radius-md)', padding: '10px 6px' }}>
                    <CaseTimeline events={activeCase.timeline} />
                  </div>
                </>
              )}
              {activeTab === 'symptom' && (
                <>
                  <SectionHeader>{TAB_META.symptom.label}</SectionHeader>
                  <PillList items={activeCase.symptoms} />
                </>
              )}
              {activeTab === 'lab' && (
                <>
                  <SectionHeader>{TAB_META.lab.label}</SectionHeader>
                  <PillList items={activeCase.lab_results} tone="warm" />
                </>
              )}
              {activeTab === 'procedure' && (
                <>
                  <SectionHeader>{TAB_META.procedure.label}</SectionHeader>
                  <PillList items={activeCase.procedures} />
                </>
              )}
            </div>
          </>
        )}

        {/* FAB tab switcher, straddling the bottom edge of the box — includes the close (X) button */}
        <div style={{
            position: 'absolute', left: '50%', bottom: 0,
            transform: 'translate(-50%)',
            display: 'flex', gap: 8,
            background: 'var(--white)', border: '1px solid var(--lavender-100)',
            borderRadius: 999, padding: 6, boxShadow: 'var(--shadow-hover)',
          }}>
          {Object.entries(TAB_META).map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              title={label}
              onClick={() => onTabChange(key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: '50%',
                border: 'none',
                background: activeTab === key
                  ? 'linear-gradient(135deg, var(--lavender-600), var(--lavender-500))'
                  : 'var(--lavender-50)',
                color: activeTab === key ? 'white' : 'var(--lavender-600)',
                boxShadow: activeTab === key ? '0 3px 10px rgba(90, 60, 200, 0.35)' : 'none',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
            </button>
          ))}

          {isLocked && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--lavender-100)', margin: '0 2px' }} />
              <button
                title="Close"
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: '50%',
                  border: 'none', background: 'var(--lavender-50)',
                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lavender-100)'; e.currentTarget.style.color = 'var(--lavender-700)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lavender-50)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <CloseIcon size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}