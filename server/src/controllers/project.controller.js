const Project = require('../models/Project');
const Video = require('../models/Video');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ValidationError = require('../utils/ValidationError');
const { toId, isId } = require('../utils/helpers');
const { PROJECT_STATUSES } = require('../utils/constants');
const { projectsWithStats } = require('../services/stats');
const { getProjectForUser, videoScope, VIDEO_POPULATE } = require('../services/access');
const { serializeProject, serializeVideo } = require('../services/visibility');

async function assertClient(id) {
  const client = await User.findById(id);
  if (!client || client.role !== 'client') throw new ValidationError('client must be an existing client account');
  return client;
}

// POST /api/projects
exports.create = asyncHandler(async (req, res) => {
  const { title, client, description, totalVideos, clientDeadline, status } = req.body;
  await assertClient(client);
  const project = await Project.create({
    title, client, description, totalVideos, clientDeadline, status, createdBy: req.user.id,
  });
  const warning = new Date(clientDeadline) < new Date() ? 'Client deadline is in the past' : undefined;
  return res.status(201).json({ data: project, ...(warning && { warning }) });
});

// GET /api/projects?client=&status=
exports.list = asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  const match = {};
  if (role === 'manager') {
    if (req.query.client) {
      if (!isId(req.query.client)) throw new ValidationError('client is not a valid id');
      match.client = toId(req.query.client);
    }
  } else if (role === 'client') {
    match.client = toId(id);
  } else {
    match._id = { $in: await Video.distinct('project', { assignedEditor: id }) };
  }
  if (req.query.status) {
    if (!PROJECT_STATUSES.includes(req.query.status)) throw new ValidationError(`status must be one of: ${PROJECT_STATUSES.join(', ')}`);
    match.status = req.query.status;
  }
  const projects = await projectsWithStats(match);
  return res.status(200).json({ data: projects.map((p) => serializeProject(p, role)) });
});

// GET /api/projects/:id  -> project with stats + the videos this user may see
exports.get = asyncHandler(async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  const [stats] = await projectsWithStats({ _id: project._id });
  const scope = await videoScope(req.user);
  const videos = await Video.find({ ...scope, project: project._id })
    .sort({ clientDeadline: 1, createdAt: 1 })
    .populate(VIDEO_POPULATE);
  const data = serializeProject(stats, req.user.role);
  data.videos = videos.map((v) => serializeVideo(v, req.user.role));
  return res.status(200).json({ data });
});

// PATCH /api/projects/:id
exports.update = asyncHandler(async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  const { title, client, description, totalVideos, clientDeadline, status } = req.body;
  if (client !== undefined) {
    await assertClient(client);
    project.client = client;
  }
  if (title !== undefined) project.title = title;
  if (description !== undefined) project.description = description;
  if (totalVideos !== undefined) project.totalVideos = totalVideos;
  if (status !== undefined) project.status = status;

  let warning;
  if (clientDeadline !== undefined) {
    const oldDeadline = project.clientDeadline;
    project.clientDeadline = clientDeadline;
    // Videos that were following the project deadline move with it.
    await Video.updateMany({ project: project._id, clientDeadline: oldDeadline }, { clientDeadline });
    const late = await Video.countDocuments({ project: project._id, editorDeadline: { $gt: new Date(clientDeadline) } });
    if (late) warning = `${late} video${late === 1 ? ' has an editor deadline' : 's have editor deadlines'} after the new client deadline`;
  }
  await project.save();
  return res.status(200).json({ data: project, ...(warning && { warning }) });
});

// DELETE /api/projects/:id  (removes its videos and their feedback too)
exports.remove = asyncHandler(async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  const videoIds = await Video.distinct('_id', { project: project._id });
  await Feedback.deleteMany({ video: { $in: videoIds } });
  await Video.deleteMany({ project: project._id });
  await project.deleteOne();
  return res.status(200).json({ data: { _id: project._id, deleted: true, videosDeleted: videoIds.length } });
});
