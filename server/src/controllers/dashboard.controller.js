const asyncHandler = require('../utils/asyncHandler');
const ValidationError = require('../utils/ValidationError');
const { isId } = require('../utils/helpers');
const { VIDEO_STATUSES } = require('../utils/constants');
const { dashboardCache } = require('../services/cache');
const { getDashboard } = require('../services/dashboard');

// GET /api/dashboard/clients?client=&editor=&status=&overdue=true&flag=red
exports.clients = asyncHandler(async (req, res) => {
  const { client, editor, status, overdue, flag } = req.query;
  if (client && !isId(client)) throw new ValidationError('client is not a valid id');
  if (editor && !isId(editor)) throw new ValidationError('editor is not a valid id');
  if (status && !VIDEO_STATUSES.includes(status)) throw new ValidationError('Unknown status filter');
  if (flag && !['red', 'amber', 'green'].includes(flag)) throw new ValidationError('flag must be red, amber or green');

  const filters = { client, editor, status, overdue: overdue === 'true', flag };
  const key = JSON.stringify(filters);

  const cached = dashboardCache.get(key);
  if (cached) return res.status(200).json({ ...cached, fromCache: true });

  const { clients, summary } = await getDashboard(filters);
  const body = { data: clients, summary, generatedAt: new Date().toISOString() };
  dashboardCache.set(key, body);
  return res.status(200).json({ ...body, fromCache: false });
});
