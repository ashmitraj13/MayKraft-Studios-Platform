const Project = require('../models/Project');
const User = require('../models/User');
const { DONE_STATUSES, EDITOR_ACTIVE_STATUSES } = require('../utils/constants');

/** Turns [{ _id: 'approved', count: 2 }, ...] into { approved: 2, ... } inside the pipeline. */
const countsToObject = (input) => ({
  $arrayToObject: { $map: { input, as: 'g', in: { k: '$$g._id', v: '$$g.count' } } },
});

const percent = (part, whole) => ({
  $cond: [
    { $gt: [whole, 0] },
    { $min: [100, { $round: [{ $multiply: [{ $divide: [part, whole] }, 100] }, 0] }] },
    0,
  ],
});

/** Projects + per-status video counts + progress %, all computed by MongoDB. */
function projectsWithStats(match = {}) {
  return Project.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'videos',
        localField: '_id',
        foreignField: 'project',
        as: 'statusGroups',
        pipeline: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'client',
        foreignField: '_id',
        as: 'client',
        pipeline: [{ $project: { name: 1, email: 1, company: 1, avatarUrl: 1 } }],
      },
    },
    { $unwind: '$client' },
    {
      $addFields: {
        statusCounts: countsToObject('$statusGroups'),
        videoCount: { $sum: '$statusGroups.count' },
        doneCount: {
          $sum: {
            $map: {
              input: '$statusGroups',
              as: 'g',
              in: { $cond: [{ $in: ['$$g._id', DONE_STATUSES] }, '$$g.count', 0] },
            },
          },
        },
      },
    },
    { $addFields: { progress: percent('$doneCount', '$totalVideos') } },
    { $project: { statusGroups: 0 } },
    { $sort: { clientDeadline: 1 } },
  ]);
}

/** Clients with project and video totals. */
function clientsWithStats(match = {}) {
  return User.aggregate([
    { $match: { role: 'client', ...match } },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: 'client',
        as: 'projects',
        pipeline: [{ $project: { status: 1, totalVideos: 1, clientDeadline: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'projects._id',
        foreignField: 'project',
        as: 'videos',
        pipeline: [{ $project: { status: 1 } }],
      },
    },
    {
      $addFields: {
        projectCount: { $size: '$projects' },
        activeProjects: { $size: { $filter: { input: '$projects', cond: { $eq: ['$$this.status', 'active'] } } } },
        totalVideos: { $sum: '$projects.totalVideos' },
        videoCount: { $size: '$videos' },
        doneCount: { $size: { $filter: { input: '$videos', cond: { $in: ['$$this.status', DONE_STATUSES] } } } },
        nextDeadline: { $min: '$projects.clientDeadline' },
      },
    },
    { $addFields: { progress: percent('$doneCount', '$totalVideos') } },
    { $project: { projects: 0, videos: 0, passwordHash: 0, __v: 0 } },
    { $sort: { company: 1 } },
  ]);
}

/**
 * Editors with workload and on-time %.
 * On time = the first version was submitted on or before the editor deadline.
 */
function editorsWithStats(match = {}) {
  return User.aggregate([
    { $match: { role: 'editor', ...match } },
    {
      $lookup: {
        from: 'videos',
        localField: '_id',
        foreignField: 'assignedEditor',
        as: 'videos',
        pipeline: [
          {
            $project: {
              status: 1,
              editorDeadline: 1,
              firstSubmittedAt: { $ifNull: [{ $first: '$versions.submittedAt' }, null] },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        activeCount: { $size: { $filter: { input: '$videos', cond: { $in: ['$$this.status', EDITOR_ACTIVE_STATUSES] } } } },
        completedCount: { $size: { $filter: { input: '$videos', cond: { $in: ['$$this.status', DONE_STATUSES] } } } },
        measured: {
          $filter: {
            input: '$videos',
            cond: { $and: [{ $ne: ['$$this.firstSubmittedAt', null] }, { $ne: ['$$this.editorDeadline', null] }] },
          },
        },
      },
    },
    {
      $addFields: {
        totalAssigned: { $size: '$videos' },
        onTimeCount: { $size: { $filter: { input: '$measured', cond: { $lte: ['$$this.firstSubmittedAt', '$$this.editorDeadline'] } } } },
        measuredCount: { $size: '$measured' },
      },
    },
    {
      $addFields: {
        onTimePercent: {
          $cond: [{ $gt: ['$measuredCount', 0] }, { $round: [{ $multiply: [{ $divide: ['$onTimeCount', '$measuredCount'] }, 100] }, 0] }, null],
        },
      },
    },
    { $project: { videos: 0, measured: 0, passwordHash: 0, __v: 0 } },
    { $sort: { activeCount: 1, name: 1 } },
  ]);
}

module.exports = { projectsWithStats, clientsWithStats, editorsWithStats, countsToObject, percent };
