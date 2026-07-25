/**
 * Formats an ISO timestamp as a short relative string, e.g. "3h ago",
 * "2d ago", "just now". Falls back to a locale date string once it's
 * more than ~5 weeks old.
 */
export function timeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';

  const units = [
    ['y', 60 * 60 * 24 * 365],
    ['mo', 60 * 60 * 24 * 30],
    ['d', 60 * 60 * 24],
    ['h', 60 * 60],
    ['m', 60],
  ];

  for (const [label, secondsInUnit] of units) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) return `${value}${label} ago`;
  }
  return 'just now';
}
