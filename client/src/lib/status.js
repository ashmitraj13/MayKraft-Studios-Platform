export const STATUS = {
  footage_uploaded: { label: 'Footage in', tone: 'muted' },
  assigned: { label: 'Assigned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'cream' },
  changes_requested: { label: 'Changes requested', tone: 'warn' },
  client_review: { label: 'Client review', tone: 'cream' },
  client_changes: { label: 'Client changes', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  delivered: { label: 'Delivered', tone: 'ok' },
};

export const STATUS_ORDER = Object.keys(STATUS);

// What the client is told (they never see the internal pipeline).
export const CLIENT_LABEL = {
  client_review: 'Ready for your review',
  approved: 'Approved',
  delivered: 'Delivered',
  in_production: 'In production',
};

export const TONE_CLASSES = {
  muted: 'border-white/10 text-muted bg-white/[0.02]',
  info: 'border-info/30 text-info bg-info/[0.06]',
  cream: 'border-cream/30 text-cream bg-cream/[0.06]',
  warn: 'border-warn/30 text-warn bg-warn/[0.07]',
  ok: 'border-ok/30 text-ok bg-ok/[0.07]',
  bad: 'border-bad/40 text-bad bg-bad/[0.08]',
};

export const FLAG = {
  green: { label: 'On track', dot: 'bg-ok', text: 'text-ok', tone: 'ok' },
  amber: { label: 'Tight', dot: 'bg-warn', text: 'text-warn', tone: 'warn' },
  red: { label: 'At risk', dot: 'bg-bad', text: 'text-bad', tone: 'bad' },
};

const DAY = 86400000;
const DONE = ['approved', 'delivered'];
const EDITOR_OWES = ['assigned', 'in_progress', 'changes_requested'];

// Same rules as the server's dashboard pipeline, for screens outside the dashboard.
export function computeFlag(v, now = Date.now()) {
  if (DONE.includes(v.status)) return { flag: 'green', overdue: false, bufferDays: buffer(v) };
  const cd = v.clientDeadline ? new Date(v.clientDeadline).getTime() : null;
  const ed = v.editorDeadline ? new Date(v.editorDeadline).getTime() : null;
  const owes = EDITOR_OWES.includes(v.status);
  const overdue = (cd !== null && cd < now) || (owes && ed !== null && ed < now);
  const b = buffer(v);
  if (overdue || (b !== null && b < 0)) return { flag: 'red', overdue, bufferDays: b };
  if ((owes && ed !== null && ed - now <= 2 * DAY) || (b !== null && b < 2) || (!v.assignedEditor && cd !== null && cd - now <= 2 * DAY)) {
    return { flag: 'amber', overdue, bufferDays: b };
  }
  return { flag: 'green', overdue, bufferDays: b };
}

function buffer(v) {
  if (!v.editorDeadline || !v.clientDeadline) return null;
  return Math.round(((new Date(v.clientDeadline) - new Date(v.editorDeadline)) / DAY) * 10) / 10;
}
