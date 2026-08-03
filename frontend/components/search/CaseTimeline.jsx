'use client';

export default function CaseTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '10px 0' }}>
        No timeline recorded for this case yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {events.map((ev, i) => {
        const isLast = i === events.length - 1;
        return (
          <div
            key={`${ev.day}-${i}`}
            style={{ display: 'flex', gap: 14, minWidth: 0 }}
          >
            {/* Dot + connecting line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--lavender-600)', marginTop: 4, flexShrink: 0,
              }} />
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--lavender-100)' }} />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingBottom: isLast ? 0 : 18, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, color: 'var(--lavender-700)',
                  background: 'var(--lavender-50)', borderRadius: 999,
                  padding: '2px 10px', whiteSpace: 'nowrap',
                }}>
                  Day {ev.day}
                </span>
                {ev.category && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {ev.category}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                {ev.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}