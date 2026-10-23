const Video = require('../models/Video');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const ValidationError = require('../utils/ValidationError');
const { deadlineWarning, isId, isUrl, sameId } = require('../utils/helpers');
const { VIDEO_STATUSES, DONE_STATUSES, CLIENT_VISIBLE_STATUSES } = require('../utils/constants');
const { getProjectForUser, getVideoForUser, videoScope, VIDEO_POPULATE } = require('../services/access');
const { serializeVideo } = require('../services/visibility');
const { applyTransition, nextStatusesFor } = require('../services/statusFlow');
const { emitTo } = require('../sockets/emitter');

const NOTE_REQUIRED = ['changes_requested', 'client_changes'];

function respond(res, status, video, role, extra = {}) {
  const data = serializeVideo(video, role);
  data.allowedNext = nextStatusesFor(video.status, role);
  return res.status(status).json({ data, ...extra });
}

// Tell everyone involved (managers, the editor, and the client when visible) that a video changed.
function notify(video, actor, summary) {
  const payload = {
    videoId: String(video._id),
    projectId: String(video.project._id || video.project),
    title: video.title,
    status: video.status,
    by: actor.name,
    summary,
  };
  const rooms = ['role:manager'];
  if (video.assignedEditor) rooms.push(`user:${video.assignedEditor._id || video.assignedEditor}`);
  const clientId = video.project && video.project.client && (video.project.client._id || video.project.client);
  if (clientId && CLIENT_VISIBLE_STATUSES.includes(video.status)) rooms.push(`user:${clientId}`);
  emitTo(rooms, 'video_updated', payload);
}

const reload = (id) => Video.findById(id).populate(VIDEO_POPULATE);
const warningsFor = (video) => {
  const w = deadlineWarning(video.editorDeadline, video.clientDeadline);
  return w ? { warning: w } : {};
};

// POST /api/projects/:projectId/videos
exports.create = asyncHandler(async (req, res) => {
  const project = await getProjectForUser(req.params.projectId, req.user);
  const { title, brief, footageLink, referenceLinks, clientDeadline, internalNotes } = req.body;
  const video = await Video.create({
    project: project._id,
    title,
    brief,
    footageLink: footageLink.trim(),
    referenceLinks: referenceLinks || [],
    clientDeadline: clientDeadline || project.clientDeadline,
    internalNotes,
    statusHistory: [{ status: 'footage_uploaded', changedBy: req.user.id }],
  });
  const count = await Video.countDocuments({ project: project._id });
  const extra = count > project.totalVideos
    ? { warning: `This project now has ${count} videos but was planned for ${project.totalVideos}` }
    : {};
  return respond(res, 201, await reload(video._id), req.user.role, extra);
});

// GET /api/projects/:projectId/videos
exports.listForProject = asyncHandler(async (req, res) => {
  const project = await getProjectForUser(req.params.projectId, req.user);
  const scope = await videoScope(req.user);
  const videos = await Video.find({ ...scope, project: project._id }).sort({ clientDeadline: 1 }).populate(VIDEO_POPULATE);
  return res.status(200).json({ data: videos.map((v) => serializeVideo(v, req.user.role)) });
});

// GET /api/videos?status=&editor=&project=
exports.list = asyncHandler(async (req, res) => {
  const filter = await videoScope(req.user);
  const { status, editor, project } = req.query;
  if (status) {
    const list = String(status).split(',');
    if (list.some((s) => !VIDEO_STATUSES.includes(s))) throw new ValidationError('Unknown status filter');
    filter.status = filter.status ? { $in: list.filter((s) => filter.status.$in.includes(s)) } : { $in: list };
  }
  if (project) {
    if (!isId(project)) throw new ValidationError('project is not a valid id');
    filter.project = filter.project ? { $in: filter.project.$in.filter((p) => sameId(p, project)) } : project;
  }
  if (editor && req.user.role === 'manager') {
    if (!isId(editor)) throw new ValidationError('editor is not a valid id');
    filter.assignedEditor = editor;
  }
  const sort = req.user.role === 'editor' ? { editorDeadline: 1 } : { clientDeadline: 1 };
  const videos = await Video.find(filter).sort(sort).populate(VIDEO_POPULATE);
  return res.status(200).json({
    data: videos.map((v) => ({ ...serializeVideo(v, req.user.role), allowedNext: nextStatusesFor(v.status, req.user.role) })),
  });
});

// GET /api/videos/:id
exports.get = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  return respond(res, 200, video, req.user.role);
});

// PATCH /api/videos/:id   (manager edits details)
exports.update = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  for (const f of ['title', 'brief', 'footageLink', 'referenceLinks', 'clientDeadline', 'internalNotes']) {
    if (req.body[f] !== undefined) video[f] = req.body[f];
  }
  if (req.body.editorDeadline !== undefined) {
    if (!video.assignedEditor) throw new ValidationError('Assign an editor before setting an editor deadline');
    video.editorDeadline = req.body.editorDeadline;
  }
  await video.save();
  return respond(res, 200, await reload(video._id), req.user.role, warningsFor(video));
});

// DELETE /api/videos/:id
exports.remove = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  await Feedback.deleteMany({ video: video._id });
  await video.deleteOne();
  return res.status(200).json({ data: { _id: video._id, deleted: true } });
});

// PATCH /api/videos/:id/assign  { editorId, editorDeadline }  (also used to reassign)
exports.assign = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  if (DONE_STATUSES.includes(video.status)) throw new ValidationError(`Cannot reassign a video that is already ${video.status}`);

  const editor = await User.findById(req.body.editorId);
  if (!editor || editor.role !== 'editor') throw new ValidationError('editorId must be an existing editor');
  if (!editor.isActive) throw new ValidationError('That editor account is deactivated');

  const previous = video.assignedEditor;
  const isReassign = previous && !sameId(previous, editor._id);
  video.assignedEditor = editor._id;
  video.editorDeadline = req.body.editorDeadline;

  if (video.status === 'footage_uploaded') {
    applyTransition(video, 'assigned', req.user, `Assigned to ${editor.name}`);
  } else if (isReassign) {
    video.statusHistory.push({ status: video.status, changedBy: req.user.id, note: `Reassigned from ${previous.name} to ${editor.name}` });
  }
  await video.save();

  const fresh = await reload(video._id);
  notify(fresh, req.user, isReassign ? 'reassigned' : 'assigned');
  if (isReassign) emitTo(`user:${previous._id}`, 'video_updated', { videoId: String(video._id), title: video.title, summary: 'unassigned' });

  const extra = warningsFor(video);
  if (new Date(req.body.editorDeadline) < new Date()) {
    extra.warning = [extra.warning, 'Editor deadline is in the past'].filter(Boolean).join('. ');
  }
  return respond(res, 200, fresh, req.user.role, extra);
});

// PATCH /api/videos/:id/status  { status, note?, deliveryLink?, timestampInVideo? }
exports.updateStatus = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  const { status, note, deliveryLink, timestampInVideo } = req.body;

  if (status === 'submitted' && req.user.role === 'editor') {
    throw new ValidationError('Submit work with POST /api/videos/:id/versions so the link is saved');
  }
  if (NOTE_REQUIRED.includes(status) && !(note && note.trim())) {
    throw new ValidationError('Please add a note describing the changes');
  }
  if (status === 'delivered') {
    if (!isUrl(deliveryLink)) throw new ValidationError('deliveryLink must be a valid http(s) URL');
    video.deliveryLink = deliveryLink.trim();
  }

  applyTransition(video, status, req.user, note);
  await video.save();

  if (note && note.trim()) {
    const latest = video.versions[video.versions.length - 1];
    await Feedback.create({
      video: video._id,
      author: req.user.id,
      role: req.user.role,
      text: note.trim(),
      timestampInVideo: timestampInVideo || undefined,
      versionNumber: latest ? latest.versionNumber : null,
    });
  }

  const fresh = await reload(video._id);
  notify(fresh, req.user, `moved to ${status.replace(/_/g, ' ')}`);
  return respond(res, 200, fresh, req.user.role);
});

// POST /api/videos/:id/versions  { link, notes }   (assigned editor)
exports.submitVersion = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  applyTransition(video, 'submitted', req.user);
  const versionNumber = video.versions.length + 1;
  video.versions.push({ versionNumber, link: req.body.link.trim(), notes: req.body.notes, submittedBy: req.user.id });
  video.statusHistory[video.statusHistory.length - 1].note = `Version ${versionNumber} submitted`;
  await video.save();

  const fresh = await reload(video._id);
  notify(fresh, req.user, `submitted v${versionNumber}`);
  return respond(res, 201, fresh, req.user.role);
});
