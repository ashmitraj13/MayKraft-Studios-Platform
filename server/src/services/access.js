const Project = require('../models/Project');
const Video = require('../models/Video');
const { notFound } = require('../utils/HttpError');
const { sameId } = require('../utils/helpers');
const { CLIENT_VISIBLE_STATUSES } = require('../utils/constants');

// Loads a project the user is allowed to see. Anything else looks like "not found".
async function getProjectForUser(id, user) {
  const project = await Project.findById(id).populate('client', 'name email company avatarUrl');
  if (!project) throw notFound('Project');
  if (user.role === 'client' && !sameId(project.client, user.id)) throw notFound('Project');
  if (user.role === 'editor') {
    const assigned = await Video.exists({ project: project._id, assignedEditor: user.id });
    if (!assigned) throw notFound('Project');
  }
  return project;
}

const VIDEO_POPULATE = [
  { path: 'project', select: 'title client clientDeadline status', populate: { path: 'client', select: 'name company' } },
  { path: 'assignedEditor', select: 'name email avatarUrl skills' },
  { path: 'versions.submittedBy', select: 'name' },
  { path: 'statusHistory.changedBy', select: 'name role' },
];

async function getVideoForUser(id, user) {
  const video = await Video.findById(id).populate(VIDEO_POPULATE);
  if (!video) throw notFound('Video');
  if (user.role === 'editor' && !sameId(video.assignedEditor, user.id)) throw notFound('Video');
  if (user.role === 'client') {
    const ownsProject = video.project && sameId(video.project.client, user.id);
    if (!ownsProject || !CLIENT_VISIBLE_STATUSES.includes(video.status)) throw notFound('Video');
  }
  return video;
}

// Base Mongo filter for "videos this user may list".
async function videoScope(user) {
  if (user.role === 'manager') return {};
  if (user.role === 'editor') return { assignedEditor: user.id };
  const projectIds = await Project.find({ client: user.id }).distinct('_id');
  return { project: { $in: projectIds }, status: { $in: CLIENT_VISIBLE_STATUSES } };
}

module.exports = { getProjectForUser, getVideoForUser, videoScope, VIDEO_POPULATE };
