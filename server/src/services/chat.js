const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ValidationError = require('../utils/ValidationError');
const { notFound, forbidden } = require('../utils/HttpError');
const { isId, sameId, toId } = require('../utils/helpers');
const { emitTo, getIO } = require('../sockets/emitter');
const { getVideoForUser } = require('./access');

const room = (id) => `conv:${id}`;

/**
 * The chat rule in one place: every conversation has exactly one manager.
 * manager+editor -> manager_editor, manager+client -> manager_client, anything else is refused.
 */
function conversationTypeFor(roleA, roleB) {
  const roles = [roleA, roleB].sort().join('+');
  if (roles === 'editor+manager') return 'manager_editor';
  if (roles === 'client+manager') return 'manager_client';
  return null;
}

async function getConversationForUser(id, user) {
  if (!isId(String(id))) throw notFound('Conversation');
  const conv = await Conversation.findById(id);
  if (!conv || !conv.participants.some((p) => sameId(p, user.id))) throw notFound('Conversation');
  return conv;
}

async function openConversation(user, participantId, projectId) {
  if (!isId(String(participantId))) throw new ValidationError('participantId is not a valid id');
  if (sameId(participantId, user.id)) throw new ValidationError('You cannot start a conversation with yourself');
  const other = await User.findById(participantId);
  if (!other || !other.isActive) throw notFound('User');

  const type = conversationTypeFor(user.role, other.role);
  if (!type) throw forbidden('Editors and clients can only chat with managers');

  const participantKey = Conversation.keyFor(user.id, other._id);
  let conv = await Conversation.findOne({ participantKey });
  let created = false;
  if (!conv) {
    conv = await Conversation.create({
      type,
      participants: [user.id, other._id],
      participantKey,
      project: projectId && isId(String(projectId)) ? projectId : null,
    });
    created = true;
    // Put every open tab of both people into the new room.
    const io = getIO();
    if (io) io.in([`user:${user.id}`, `user:${other._id}`]).socketsJoin(room(conv._id));
    emitTo(`user:${other._id}`, 'conversation_updated', { conversationId: String(conv._id) });
  }
  return { conv, created };
}

async function checkVideoReference(user, conv, videoId) {
  if (!isId(String(videoId))) throw new ValidationError('video is not a valid id');
  const video = await getVideoForUser(videoId, user); // sender must be allowed to see it
  const others = await User.find({ _id: { $in: conv.participants } }, 'role');
  const client = others.find((u) => u.role === 'client');
  const editor = others.find((u) => u.role === 'editor');
  // The other side must also be allowed to see it.
  if (client && !sameId(video.project.client, client._id)) throw new ValidationError('That video does not belong to this client');
  if (editor && !sameId(video.assignedEditor, editor._id)) throw new ValidationError('That video is not assigned to this editor');
  return video;
}

const MESSAGE_POPULATE = [
  { path: 'sender', select: 'name role avatarUrl' },
  { path: 'video', select: 'title status' },
];

async function sendMessage(user, conversationId, { text, video } = {}) {
  const conv = await getConversationForUser(conversationId, user);
  if (typeof text !== 'string' || !text.trim()) throw new ValidationError('Message text is required');
  if (text.trim().length > 2000) throw new ValidationError('Message must be at most 2000 characters');
  if (video) await checkVideoReference(user, conv, video);

  const msg = await Message.create({
    conversation: conv._id,
    sender: user.id,
    text: text.trim(),
    video: video || null,
    readBy: [user.id],
  });
  conv.lastMessageAt = msg.createdAt;
  await conv.save();

  const populated = await msg.populate(MESSAGE_POPULATE);
  const payload = { conversationId: String(conv._id), message: populated.toObject() };
  emitTo(room(conv._id), 'new_message', payload);
  // Personal rooms too, so chat lists/unread badges update even when the room was not joined.
  emitTo(conv.participants.map((p) => `user:${p}`), 'conversation_updated', { conversationId: String(conv._id) });
  return populated;
}

async function markRead(user, conversationId) {
  const conv = await getConversationForUser(conversationId, user);
  const res = await Message.updateMany(
    { conversation: conv._id, readBy: { $ne: user.id } },
    { $addToSet: { readBy: user.id } }
  );
  emitTo(room(conv._id), 'messages_read', { conversationId: String(conv._id), userId: user.id });
  return res.modifiedCount;
}

async function listMessages(user, conversationId, { before, limit } = {}) {
  const conv = await getConversationForUser(conversationId, user);
  const size = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const query = { conversation: conv._id };
  if (before) {
    let cursor = null;
    if (isId(String(before))) {
      const ref = await Message.findById(before, 'createdAt');
      cursor = ref && ref.createdAt;
    } else if (!Number.isNaN(new Date(before).getTime())) {
      cursor = new Date(before);
    }
    if (!cursor) throw new ValidationError('before must be a message id or a date');
    query.createdAt = { $lt: cursor };
  }
  const rows = await Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(size + 1).populate(MESSAGE_POPULATE);
  const hasMore = rows.length > size;
  return { messages: rows.slice(0, size).reverse(), hasMore };
}

// Conversation list with the other person, last message and unread count (one aggregation).
function listConversations(user) {
  const me = toId(user.id);
  return Conversation.aggregate([
    { $match: { participants: me } },
    { $sort: { lastMessageAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'participants',
        foreignField: '_id',
        as: 'people',
        pipeline: [{ $project: { name: 1, role: 1, company: 1, avatarUrl: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: '_id',
        foreignField: 'conversation',
        as: 'lastMessage',
        pipeline: [{ $sort: { createdAt: -1 } }, { $limit: 1 }, { $project: { text: 1, sender: 1, createdAt: 1, video: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: '_id',
        foreignField: 'conversation',
        as: 'unread',
        pipeline: [{ $match: { readBy: { $ne: me } } }, { $count: 'n' }],
      },
    },
    {
      $project: {
        type: 1,
        project: 1,
        lastMessageAt: 1,
        participants: '$people',
        otherUser: { $first: { $filter: { input: '$people', cond: { $ne: ['$$this._id', me] } } } },
        lastMessage: { $first: '$lastMessage' },
        unreadCount: { $ifNull: [{ $first: '$unread.n' }, 0] },
      },
    },
  ]);
}

module.exports = {
  conversationTypeFor,
  getConversationForUser,
  openConversation,
  sendMessage,
  markRead,
  listMessages,
  listConversations,
  room,
};
