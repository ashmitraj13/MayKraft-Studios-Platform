const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/HttpError');
const { toId } = require('../utils/helpers');
const { clientsWithStats, editorsWithStats, projectsWithStats } = require('../services/stats');

// GET /api/clients
exports.listClients = asyncHandler(async (req, res) => {
  const clients = await clientsWithStats();
  return res.status(200).json({ data: clients });
});

// GET /api/clients/:id  -> client + all their projects with progress
exports.getClient = asyncHandler(async (req, res) => {
  const [client] = await clientsWithStats({ _id: toId(req.params.id) });
  if (!client) throw notFound('Client');
  const projects = await projectsWithStats({ client: client._id });
  return res.status(200).json({ data: { ...client, projects } });
});

// GET /api/editors?active=true -> editors with workload + on-time %
exports.listEditors = asyncHandler(async (req, res) => {
  const match = req.query.active === 'true' ? { isActive: true } : {};
  const editors = await editorsWithStats(match);
  return res.status(200).json({ data: editors });
});

// GET /api/editors/:id
exports.getEditor = asyncHandler(async (req, res) => {
  const [editor] = await editorsWithStats({ _id: toId(req.params.id) });
  if (!editor) throw notFound('Editor');
  return res.status(200).json({ data: editor });
});

// GET /api/managers  (anyone logged in: used by editors/clients to start a chat)
exports.listManagers = asyncHandler(async (req, res) => {
  const managers = await User.find({ role: 'manager', isActive: true }, 'name role avatarUrl').sort({ name: 1 });
  return res.status(200).json({ data: managers });
});
