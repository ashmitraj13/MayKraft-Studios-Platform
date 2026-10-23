const ROLES = ['manager', 'editor', 'client'];

const VIDEO_STATUSES = [
  'footage_uploaded',
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'client_review',
  'client_changes',
  'approved',
  'delivered',
];

// Videos that still count against an editor's workload.
const EDITOR_ACTIVE_STATUSES = ['assigned', 'in_progress', 'submitted', 'changes_requested', 'client_changes'];
// Statuses where the editor is the one who has to act.
const EDITOR_OWES_STATUSES = ['assigned', 'in_progress', 'changes_requested'];
// The only statuses a client may ever see.
const CLIENT_VISIBLE_STATUSES = ['client_review', 'approved', 'delivered'];
const DONE_STATUSES = ['approved', 'delivered'];

const PROJECT_STATUSES = ['active', 'on-hold', 'completed'];
const CONVERSATION_TYPES = ['manager_editor', 'manager_client'];

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  ROLES,
  VIDEO_STATUSES,
  EDITOR_ACTIVE_STATUSES,
  EDITOR_OWES_STATUSES,
  CLIENT_VISIBLE_STATUSES,
  DONE_STATUSES,
  PROJECT_STATUSES,
  CONVERSATION_TYPES,
  DAY_MS,
};
