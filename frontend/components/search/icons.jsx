'use client';

/* Shared 16–18px stroke icon set for the Case Search page.
   All icons inherit color via `stroke="currentColor"` so they can be
   recolored per-state (active / inactive) from the parent button. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function TimelineIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SymptomIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4.8 12.5 8 9l3 3 3-6 2.2 4.5H20" />
      <path d="M3 18h18" />
    </svg>
  );
}

export function LabIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8.5V2" />
      <path d="M8.5 2h7" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

export function ProcedureIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 2v6" />
      <path d="M9 5h6" />
      <path d="m4 20 6.5-6.5" />
      <path d="M14.5 9.5 20 4" />
      <circle cx="6" cy="18" r="2.2" />
    </svg>
  );
}

export function PinIcon({ size = 16, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 2c-3 0-5.5 2.4-5.5 5.5 0 3.8 5.5 10.5 5.5 10.5s5.5-6.7 5.5-10.5C17.5 4.4 15 2 12 2Z" />
      {!filled && <circle cx="12" cy="7.5" r="2" />}
    </svg>
  );
}

export function FilterIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <polygon points="4 3 20 3 14 11.5 14 19 10 21 10 11.5 4 3" />
    </svg>
  );
}

export function StatsIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="5" y1="21" x2="5" y2="10" />
      <line x1="12" y1="21" x2="12" y2="4" />
      <line x1="19" y1="21" x2="19" y2="14" />
    </svg>
  );
}

export function ChevronIcon({ size = 14, direction = 'right' }) {
  const rotation = { right: 0, down: 90, left: 180, up: -90 }[direction];
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" {...base}
      style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function CloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function SparkleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}
