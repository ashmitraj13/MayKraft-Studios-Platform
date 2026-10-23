const asyncHandler = require('../utils/asyncHandler');
const chat = require('../services/chat');
const { isOnline } = require('../sockets/presence');

// GET /api/conversations
exports.list = asyncHandler(async (req, res) => {
  const rows = await chat.listConversations(req.user);
  const data = rows.map((c) => ({ ...c, otherOnline: c.otherUser ? isOnline(c.otherUser._id) : false }));
  return res.status(200).json({ data });
});

// POST /api/conversations  { participantId, projectId? }  -> 201 new, 200 existing
exports.open = asyncHandler(async (req, res) => {
  const { conv, created } = await chat.openConversation(req.user, req.body.participantId, req.body.projectId);
  await conv.populate('participants', 'name role company avatarUrl');
  return res.status(created ? 201 : 200).json({ data: conv });
});

// GET /api/conversations/:id/messages?before=<messageId|ISO date>&limit=30
exports.messages = asyncHandler(async (req, res) => {
  const { messages, hasMore } = await chat.listMessages(req.user, req.params.id, req.query);
  return res.status(200).json({ data: messages, hasMore });
});

// POST /api/conversations/:id/messages  { text, video? }   (REST fallback for the socket event)
exports.send = asyncHandler(async (req, res) => {
  const message = await chat.sendMessage(req.user, req.params.id, req.body);
  return res.status(201).json({ data: message });
});

// PATCH /api/conversations/:id/read
exports.read = asyncHandler(async (req, res) => {
  const updated = await chat.markRead(req.user, req.params.id);
  return res.status(200).json({ data: { conversationId: req.params.id, updated } });
});
