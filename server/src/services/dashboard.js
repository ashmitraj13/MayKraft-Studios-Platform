const Project = require('../models/Project');
const { toId } = require('../utils/helpers');
const { DONE_STATUSES, EDITOR_OWES_STATUSES, DAY_MS } = require('../utils/constants');
const { countsToObject, percent } = require('./stats');

const notNull = (expr) => ({ $ne: [expr, null] });
const days = (msExpr) => ({ $round: [{ $divide: [msExpr, DAY_MS] }, 1] }); // null stays null

/**
 * Builds the manager's Client Dashboard in ONE aggregation.
 *
 * Shape: projects -> (lookup videos + editor, compute flags) -> (lookup status counts)
 *        -> (lookup client) -> $facet { clients: group by client, summary: totals }
 *
 * filters: { client, editor, status, overdue, flag }, now: Date (injectable for tests)
 */
function buildDashboardPipeline(filters = {}, now = new Date()) {
  const videoMatch = {};
  if (filters.editor) videoMatch.assignedEditor = toId(filters.editor);
  if (filters.status) videoMatch.status = filters.status;
  const afterFlags = {};
  if (filters.overdue) afterFlags.overdue = true;
  if (filters.flag) afterFlags.flag = filters.flag;
  const filteringVideos = Object.keys(videoMatch).length > 0 || Object.keys(afterFlags).length > 0;

  const videoPipeline = [
    ...(Object.keys(videoMatch).length ? [{ $match: videoMatch }] : []),
    // 1) raw time maths, in milliseconds
    {
      $addFields: {
        editorDeadline: { $ifNull: ['$editorDeadline', null] },
        isDone: { $in: ['$status', DONE_STATUSES] },
        editorOwes: { $in: ['$status', EDITOR_OWES_STATUSES] },
        bufferMs: { $subtract: ['$clientDeadline', { $ifNull: ['$editorDeadline', null] }] },
        msToEditor: { $subtract: [{ $ifNull: ['$editorDeadline', null] }, now] },
        msToClient: { $subtract: ['$clientDeadline', now] },
      },
    },
    // 2) overdue: client deadline passed, or the editor still owes work past their deadline
    {
      $addFields: {
        overdue: {
          $and: [
            { $not: ['$isDone'] },
            {
              $or: [
                { $lt: ['$msToClient', 0] },
                { $and: ['$editorOwes', notNull('$msToEditor'), { $lt: ['$msToEditor', 0] }] },
              ],
            },
          ],
        },
      },
    },
    // 3) traffic-light flag
    {
      $addFields: {
        flag: {
          $switch: {
            branches: [
              { case: '$isDone', then: 'green' },
              {
                case: { $or: ['$overdue', { $and: [notNull('$bufferMs'), { $lt: ['$bufferMs', 0] }] }] },
                then: 'red',
              },
              {
                case: {
                  $or: [
                    { $and: ['$editorOwes', notNull('$msToEditor'), { $lte: ['$msToEditor', 2 * DAY_MS] }] },
                    { $and: [notNull('$bufferMs'), { $lt: ['$bufferMs', 2 * DAY_MS] }] },
                    { $and: [{ $eq: [{ $ifNull: ['$assignedEditor', null] }, null] }, { $lte: ['$msToClient', 2 * DAY_MS] }] },
                  ],
                },
                then: 'amber',
              },
            ],
            default: 'green',
          },
        },
        bufferDays: days('$bufferMs'),
        daysToEditorDeadline: days('$msToEditor'),
        daysToClientDeadline: days('$msToClient'),
      },
    },
    ...(Object.keys(afterFlags).length ? [{ $match: afterFlags }] : []),
    {
      $lookup: {
        from: 'users',
        localField: 'assignedEditor',
        foreignField: '_id',
        as: 'assignedEditor',
        pipeline: [{ $project: { name: 1, avatarUrl: 1 } }],
      },
    },
    {
      $project: {
        title: 1,
        status: 1,
        assignedEditor: { $first: '$assignedEditor' },
        editorDeadline: 1,
        clientDeadline: 1,
        bufferDays: 1,
        daysToEditorDeadline: 1,
        daysToClientDeadline: 1,
        overdue: 1,
        flag: 1,
        versionCount: { $size: '$versions' },
        updatedAt: 1,
      },
    },
    { $sort: { clientDeadline: 1, title: 1 } },
  ];

  const flagCount = (f) => ({ $size: { $filter: { input: '$videos', cond: { $eq: ['$$this.flag', f] } } } });

  return [
    { $match: filters.client ? { client: toId(filters.client) } : {} },
    { $lookup: { from: 'videos', localField: '_id', foreignField: 'project', as: 'videos', pipeline: videoPipeline } },
    // Status counts always use ALL videos of the project (filters only narrow the video list).
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
        flagCounts: { red: flagCount('red'), amber: flagCount('amber'), green: flagCount('green') },
        overdueCount: { $size: { $filter: { input: '$videos', cond: '$$this.overdue' } } },
      },
    },
    { $addFields: { progress: percent('$doneCount', '$totalVideos') } },
    ...(filteringVideos ? [{ $match: { 'videos.0': { $exists: true } } }] : []),
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
    { $project: { statusGroups: 0 } },
    { $sort: { clientDeadline: 1 } },
    {
      $facet: {
        clients: [
          {
            $group: {
              _id: '$client._id',
              client: { $first: '$client' },
              projects: {
                $push: {
                  _id: '$_id',
                  title: '$title',
                  status: '$status',
                  totalVideos: '$totalVideos',
                  clientDeadline: '$clientDeadline',
                  statusCounts: '$statusCounts',
                  videoCount: '$videoCount',
                  doneCount: '$doneCount',
                  progress: '$progress',
                  flagCounts: '$flagCounts',
                  overdueCount: '$overdueCount',
                  videos: '$videos',
                },
              },
              totalVideos: { $sum: '$totalVideos' },
              doneCount: { $sum: '$doneCount' },
              red: { $sum: '$flagCounts.red' },
              amber: { $sum: '$flagCounts.amber' },
              green: { $sum: '$flagCounts.green' },
              overdueCount: { $sum: '$overdueCount' },
              nextDeadline: { $min: '$clientDeadline' },
            },
          },
          { $addFields: { progress: percent('$doneCount', '$totalVideos'), projectCount: { $size: '$projects' } } },
          { $sort: { red: -1, amber: -1, 'client.company': 1 } },
        ],
        summary: [
          {
            $group: {
              _id: null,
              projects: { $sum: 1 },
              totalVideos: { $sum: '$totalVideos' },
              videosAdded: { $sum: '$videoCount' },
              done: { $sum: '$doneCount' },
              red: { $sum: '$flagCounts.red' },
              amber: { $sum: '$flagCounts.amber' },
              green: { $sum: '$flagCounts.green' },
              overdue: { $sum: '$overdueCount' },
              inClientReview: { $sum: { $ifNull: ['$statusCounts.client_review', 0] } },
              awaitingReview: { $sum: { $ifNull: ['$statusCounts.submitted', 0] } },
            },
          },
          { $project: { _id: 0 } },
        ],
      },
    },
  ];
}

async function getDashboard(filters, now) {
  const [result] = await Project.aggregate(buildDashboardPipeline(filters, now));
  const summary = result.summary[0] || {
    projects: 0, totalVideos: 0, videosAdded: 0, done: 0, red: 0, amber: 0, green: 0, overdue: 0, inClientReview: 0, awaitingReview: 0,
  };
  summary.clients = result.clients.length;
  return { clients: result.clients, summary };
}

module.exports = { buildDashboardPipeline, getDashboard };
