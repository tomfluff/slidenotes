export function fmtTime(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export function fmtDateTimeLong(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fileStem(name: string): string {
  const stem = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'slide-review';
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
