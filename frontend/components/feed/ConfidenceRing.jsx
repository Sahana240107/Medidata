'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated circular progress ring showing a 0-100 confidence score,
 * with a count-up number in the center. Pure SVG + CSS, no chart library.
 */
export default function ConfidenceRing({ value = 0, color = '#5c6bc0', size = 132, label = 'Confidence' }) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const duration = 1400;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const offset = circumference * (1 - display / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="white" strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size * 0.26, fontWeight: 800, color: 'white', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
          {display}%
        </div>
        <div style={{ fontSize: size * 0.08, color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginTop: 4, letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}