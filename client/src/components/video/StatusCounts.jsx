import { STATUS, STATUS_ORDER, TONE_CLASSES, CLIENT_LABEL } from '../../lib/status';

export default function StatusCounts({ counts = {}, client = false }) {
  const keys = client ? ['in_production', 'client_review', 'approved', 'delivered'] : STATUS_ORDER;
  const shown = keys.filter((k) => counts[k]);
  if (!shown.length) return <span className="text-xs text-muted">No videos yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((k) => (
        <span key={k} className={`chip ${TONE_CLASSES[STATUS[k]?.tone || 'muted']}`}>
          <span className="tabular-nums">{counts[k]}</span> {client ? CLIENT_LABEL[k] : STATUS[k].label}
        </span>
      ))}
    </div>
  );
}
