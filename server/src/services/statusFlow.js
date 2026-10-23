const ValidationError = require('../utils/ValidationError');
const { forbidden } = require('../utils/HttpError');
const { VIDEO_STATUSES } = require('../utils/constants');

/**
 * The whole video workflow in one table:  from -> { to: [roles allowed to make that move] }
 * Anything not listed here is an invalid transition (400).
 */
const TRANSITIONS = {
  footage_uploaded: { assigned: ['manager'] },
  assigned: { in_progress: ['editor'] },
  in_progress: { submitted: ['editor'] },
  submitted: {
    approved: ['manager'],
    changes_requested: ['manager'],
    client_review: ['manager'],
  },
  changes_requested: { in_progress: ['editor'], submitted: ['editor'] },
  // Managers may record a client's decision on their behalf (e.g. approval over a call).
  client_review: { approved: ['client', 'manager'], client_changes: ['client', 'manager'] },
  client_changes: { changes_requested: ['manager'] },
  approved: { delivered: ['manager'] },
  delivered: {},
};

const pretty = (s) => s.replace(/_/g, ' ');

function assertTransition(from, to, role) {
  if (!VIDEO_STATUSES.includes(to)) {
    throw new ValidationError(`Unknown status '${to}'. Valid statuses: ${VIDEO_STATUSES.join(', ')}`);
  }
  if (from === to) throw new ValidationError(`Video is already '${pretty(to)}'`);
  const allowedRoles = (TRANSITIONS[from] || {})[to];
  if (!allowedRoles) {
    const next = Object.keys(TRANSITIONS[from] || {});
    throw new ValidationError(
      `Cannot move a video from '${pretty(from)}' to '${pretty(to)}'.` +
        (next.length ? ` Allowed next: ${next.map(pretty).join(', ')}` : ' This is a final status.')
    );
  }
  if (!allowedRoles.includes(role)) {
    throw forbidden(`A ${role} cannot move a video from '${pretty(from)}' to '${pretty(to)}'`);
  }
}

// Validates, then mutates the (unsaved) video document and records history.
function applyTransition(video, to, user, note) {
  assertTransition(video.status, to, user.role);
  video.status = to;
  video.statusHistory.push({ status: to, changedBy: user.id, at: new Date(), note: note || undefined });
  return video;
}

function nextStatusesFor(status, role) {
  return Object.entries(TRANSITIONS[status] || {})
    .filter(([, roles]) => roles.includes(role))
    .map(([to]) => to);
}

module.exports = { TRANSITIONS, assertTransition, applyTransition, nextStatusesFor };
