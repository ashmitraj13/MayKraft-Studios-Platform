const DAY = 86400000;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';

export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function relDays(d) {
  if (!d) return '';
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(diff / DAY);
  if (Math.abs(diff) < DAY) {
    const hours = Math.round(diff / 3600000);
    if (hours === 0) return 'now';
    return hours > 0 ? `in ${hours}h` : `${-hours}h ago`;
  }
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}

export const fmtBuffer = (b) => (b === null || b === undefined ? '—' : `${b > 0 ? '+' : ''}${b}d`);

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtShort(d);
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}
export const fromLocalInput = (s) => (s ? new Date(s).toISOString() : undefined);

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function embedUrl(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p));
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes('drive.google.com') && u.pathname.includes('/file/d/')) {
      return link.replace(/\/view.*$/, '/preview');
    }
  } catch {
    return null;
  }
  return null;
}

export const hostOf = (link) => {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return link; }
};
