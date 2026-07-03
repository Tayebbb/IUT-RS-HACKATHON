/**
 * Number/format helpers used across the dashboard.
 */

export function formatWatts(w) {
  if (w == null || Number.isNaN(w)) {return '0 W';}
  if (w >= 1000) {return `${(w / 1000).toFixed(2)} kW`;}
  return `${Math.round(w)} W`;
}

export function formatKwh(kwh) {
  if (kwh == null || Number.isNaN(kwh)) {return '0.000 kWh';}
  return `${kwh.toFixed(3)} kWh`;
}

export function formatRelative(iso, nowMs = Date.now()) {
  if (!iso) {return '—';}
  const diff = Math.floor((nowMs - Date.parse(iso)) / 1000);
  if (diff < 5) {return 'just now';}
  if (diff < 60) {return `${diff}s ago`;}
  if (diff < 3600) {return `${Math.floor(diff / 60)}m ago`;}
  if (diff < 86400) {return `${Math.floor(diff / 3600)}h ago`;}
  return `${Math.floor(diff / 86400)}d ago`;
}

export function severityClasses(sev) {
  switch (sev) {
    case 'high':
      return 'text-bad border-bad/40 bg-bad/10';
    case 'medium':
      return 'text-warn border-warn/40 bg-warn/10';
    default:
      return 'text-good border-good/40 bg-good/10';
  }
}
