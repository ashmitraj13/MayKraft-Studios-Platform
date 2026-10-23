import { StatusBadge, ExternalLink, Avatar } from '../ui';
import { fmtDateTime, hostOf, timeAgo, embedUrl } from '../../lib/format';
import { STATUS } from '../../lib/status';

export function Section({ title, children, action, className = '' }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="eyebrow">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function LinkTile({ label, href, sub }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-ink-950/50 px-4 py-3 transition hover:border-cream/30">
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wider text-muted">{label}</span>
        <span className="block truncate text-sm text-cream-soft">{sub || hostOf(href)}</span>
      </span>
      <span className="text-cream/60 transition group-hover:translate-x-0.5 group-hover:text-cream">↗</span>
    </a>
  );
}

export function Brief({ video }) {
  return (
    <div className="space-y-4">
      {video.brief ? <p className="whitespace-pre-line text-sm leading-relaxed text-cream-soft/90">{video.brief}</p> : <p className="text-sm text-muted">No brief yet.</p>}
      {video.footageLink && <LinkTile label="Footage" href={video.footageLink} />}
      {video.referenceLinks?.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">References</div>
          <ul className="space-y-1.5 text-sm">{video.referenceLinks.map((r) => <li key={r}><ExternalLink href={r}>{hostOf(r)}</ExternalLink></li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function VersionList({ versions = [], feedback = [] }) {
  if (!versions.length) return <p className="text-sm text-muted">No versions submitted yet.</p>;
  return (
    <ol className="space-y-3">
      {[...versions].reverse().map((v) => {
        const notes = feedback.filter((f) => f.versionNumber === v.versionNumber);
        return (
          <li key={v.versionNumber} className="rounded-xl border border-white/[0.07] bg-ink-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-sans text-xl font-light">v{v.versionNumber}</span>
              <span className="text-xs text-muted">{v.submittedBy?.name ? `${v.submittedBy.name} · ` : ''}{fmtDateTime(v.submittedAt)}</span>
            </div>
            <div className="mt-2"><ExternalLink href={v.link} /></div>
            {v.notes && <p className="mt-2 text-sm text-cream-soft/80">“{v.notes}”</p>}
            {notes.length > 0 && <div className="mt-3 text-xs text-warn">{notes.length} note{notes.length === 1 ? '' : 's'} on this version</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function FeedbackList({ items = [], onResolve, emptyText = 'No feedback yet.' }) {
  if (!items.length) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f._id} className={`rounded-xl border p-4 transition ${f.resolved ? 'border-white/[0.04] opacity-60' : f.role === 'client' ? 'border-cream/20 bg-cream/[0.03]' : 'border-white/[0.08] bg-ink-950/40'}`}>
          <div className="flex items-start gap-3">
            <Avatar name={f.author?.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-cream-soft">{f.author?.name}</span>
                <span className="uppercase tracking-wider text-muted">{f.role}</span>
                {f.versionNumber && <span className="chip border-white/10 text-muted">v{f.versionNumber}</span>}
                {f.timestampInVideo && <span className="chip border-cream/30 font-mono text-cream">@ {f.timestampInVideo}</span>}
                <span className="text-muted">{timeAgo(f.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-cream-soft/90">{f.text}</p>
            </div>
            {onResolve && (
              <button className={`shrink-0 text-xs ${f.resolved ? 'text-ok' : 'text-muted hover:text-cream'}`} onClick={() => onResolve(f)} title="Toggle resolved">
                {f.resolved ? '✓ Resolved' : 'Resolve'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ history = [] }) {
  return (
    <ol className="relative space-y-4 border-l border-white/10 pl-5">
      {[...history].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-ink-800 ${i === 0 ? 'bg-cream' : 'bg-white/20'}`} />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.status} />
            <span className="text-[11px] text-muted">{fmtDateTime(h.at)}</span>
          </div>
          {(h.changedBy?.name || h.note) && (
            <p className="mt-1 text-xs text-muted">{h.changedBy?.name}{h.changedBy?.name && h.note ? ' — ' : ''}{h.note}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Player({ link, title }) {
  const src = embedUrl(link);
  if (!link) return null;
  if (!src) return <LinkTile label="Watch" href={link} sub={`Open on ${hostOf(link)}`} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="relative aspect-video">
        <iframe src={src} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    </div>
  );
}

export const statusLabel = (s) => STATUS[s]?.label || s;
