const { CLIENT_VISIBLE_STATUSES } = require('../utils/constants');

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc });

/**
 * Shapes a video for the role that is asking.
 * - manager: everything
 * - editor: no internal notes, no real client deadline (the buffer belongs to the manager)
 * - client: no editor, no editor deadline, no internal notes, no version notes
 */
function serializeVideo(doc, role) {
  const v = plain(doc);
  if (role === 'manager') return v;

  if (role === 'editor') {
    delete v.internalNotes;
    delete v.clientDeadline;
    if (v.project && typeof v.project === 'object') delete v.project.clientDeadline;
    return v;
  }

  const latest = (v.versions || [])[v.versions.length - 1];
  const project = v.project && typeof v.project === 'object' && v.project._id
    ? { _id: v.project._id, title: v.project.title, clientDeadline: v.project.clientDeadline }
    : v.project;
  return {
    _id: v._id,
    project,
    title: v.title,
    brief: v.brief,
    clientDeadline: v.clientDeadline,
    status: v.status,
    currentVersion: latest ? latest.versionNumber : null,
    reviewLink: latest ? latest.link : null,
    deliveryLink: v.status === 'delivered' ? v.deliveryLink || null : null,
    statusHistory: (v.statusHistory || [])
      .filter((h) => CLIENT_VISIBLE_STATUSES.includes(h.status) || h.status === 'client_changes')
      .map((h) => ({ status: h.status, at: h.at })),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function serializeProject(doc, role) {
  const p = plain(doc);
  if (role === 'editor') delete p.clientDeadline;
  if (role === 'client' && p.statusCounts) {
    // Clients see what is ready for them; everything else is just "in production".
    const visible = {};
    let shown = 0;
    for (const s of CLIENT_VISIBLE_STATUSES) {
      visible[s] = p.statusCounts[s] || 0;
      shown += visible[s];
    }
    visible.in_production = Math.max((p.videoCount || 0) - shown, 0);
    p.statusCounts = visible;
  }
  return p;
}

module.exports = { serializeVideo, serializeProject };
