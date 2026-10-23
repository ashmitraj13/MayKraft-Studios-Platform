const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const ValidationError = require('../utils/ValidationError');
const { notFound, forbidden } = require('../utils/HttpError');
const { getVideoForUser } = require('../services/access');
const { emitTo } = require('../sockets/emitter');

// Editors only see the manager's notes; clients only see their own. Client feedback never reaches editors directly.
const visibleRoles = { manager: ['manager', 'client'], editor: ['manager'], client: ['client'] };

// GET /api/videos/:id/feedback
exports.list = asyncHandler(async (req, res) => {
  const video = await getVideoForUser(req.params.id, req.user);
  const filter = { video: video._id, role: { $in: visibleRoles[req.user.role] } };
  if (req.user.role === 'client') filter.author = req.user.id;
  const items = await Feedback.find(filter).sort({ createdAt: 1 }).populate('author', 'name role avatarUrl');
  return res.status(200).json({ data: items });
});

// POST /api/videos/:id/feedback  { text, timestampInVideo?, versionNumber? }
exports.create = asyncHandler(async (req, res) => {
  if (req.user.role === 'editor') throw forbidden('Editors reply to feedback through chat with the manager');
  const video = await getVideoForUser(req.params.id, req.user);
  const latest = video.versions[video.versions.length - 1];
  let versionNumber = latest ? latest.versionNumber : null;
  if (req.body.versionNumber !== undefined) {
    if (!video.versions.some((v) => v.versionNumber === Number(req.body.versionNumber))) {
      throw new ValidationError(`Version ${req.body.versionNumber} does not exist for this video`);
    }
    versionNumber = Number(req.body.versionNumber);
  }
  const item = await Feedback.create({
    video: video._id,
    author: req.user.id,
    role: req.user.role,
    text: req.body.text,
    timestampInVideo: req.body.timestampInVideo || undefined,
    versionNumber,
  });
  await item.populate('author', 'name role avatarUrl');

  const rooms = ['role:manager'];
  if (req.user.role === 'manager' && video.assignedEditor) rooms.push(`user:${video.assignedEditor._id}`);
  emitTo(rooms, 'feedback_added', { videoId: String(video._id), title: video.title, by: req.user.name });
  return res.status(201).json({ data: item });
});

// PATCH /api/feedback/:id/resolve  { resolved?: boolean }
exports.resolve = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.params.id);
  if (!item) throw notFound('Feedback');
  item.resolved = req.body.resolved === undefined ? !item.resolved : Boolean(req.body.resolved);
  await item.save();
  return res.status(200).json({ data: item });
});
