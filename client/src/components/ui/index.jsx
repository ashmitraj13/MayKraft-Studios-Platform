import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { STATUS, TONE_CLASSES, FLAG, CLIENT_LABEL } from '../../lib/status';
import { initials, fmtBuffer } from '../../lib/format';

export function StatusBadge({ status, client = false }) {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  const label = client && CLIENT_LABEL[status] ? CLIENT_LABEL[status] : s.label;
  return <span className={`chip ${TONE_CLASSES[s.tone]}`}>{label}</span>;
}

export function DeadlineFlag({ flag, overdue, compact = false }) {
  const f = FLAG[flag] || FLAG.green;
  const label = overdue ? 'Overdue' : f.label;
  if (compact) {
    return <span title={label} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${f.dot} ${flag === 'red' ? 'shadow-[0_0_10px_rgba(229,96,79,.7)]' : ''}`} />;
  }
  return (
    <span className={`chip ${TONE_CLASSES[f.tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
      {label}
    </span>
  );
}

export function Buffer({ days }) {
  const tone = days === null || days === undefined ? 'text-muted' : days < 0 ? 'text-bad' : days < 2 ? 'text-warn' : 'text-ok';
  return <span className={`tabular-nums ${tone}`}>{fmtBuffer(days)}</span>;
}

export function ProgressBar({ value = 0, label, sub, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      {(label || sub) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted">{label}</span>
          <span className="tabular-nums text-cream-soft">{sub ?? `${pct}%`}</span>
        </div>
      )}
      <div className={`overflow-hidden rounded-full bg-white/[0.06] ${size === 'sm' ? 'h-1' : 'h-1.5'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-cream-dim to-cream transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action, icon = '◎' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center animate-fade-in">
      <div className="mb-4 font-display text-4xl text-cream/40">{icon}</div>
      <h3 className="text-2xl">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/[0.04] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

export function SkeletonList({ rows = 4, className = 'h-20' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={className} />)}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-bad/30 bg-bad/[0.05] px-6 py-10 text-center">
      <p className="text-sm text-bad">{message}</p>
      {onRetry && <button className="btn-ghost btn-sm mt-4" onClick={() => onRetry()}>Try again</button>}
    </div>
  );
}

export function Avatar({ name, size = 'md', online }) {
  const s = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' }[size];
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-cream/20 bg-navy font-medium text-cream ${s}`}>
      {initials(name)}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-800 ${online ? 'bg-ok' : 'bg-muted/50'}`} />
      )}
    </span>
  );
}

export function PageHeader({ eyebrow, title, children, sub }) {
  return (
    <div className="mb-8 flex flex-col gap-4 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-4xl leading-tight sm:text-5xl text-balance">{title}</h1>
        {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {typeof children === 'function' ? children(id) : children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-6 shadow-glow animate-fade-up sm:rounded-3xl sm:p-8 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-3xl">{title}</h2>
          <button onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-xl leading-none text-muted hover:text-cream" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Stat({ label, value, tone, sub }) {
  const color = { bad: 'text-bad', warn: 'text-warn', ok: 'text-ok' }[tone] || 'text-cream-soft';
  return (
    <div className="card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 font-sans font-light tracking-tight text-4xl leading-none tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-label="Loading" />;
}

export function ExternalLink({ href, children, className = 'link break-all' }) {
  if (!href) return <span className="text-muted">—</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children || href} ↗</a>;
}
