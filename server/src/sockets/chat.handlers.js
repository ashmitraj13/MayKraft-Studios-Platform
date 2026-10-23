const chat = require('../services/chat');

const reply = (ack, body) => { if (typeof ack === 'function') ack(body); };
const fail = (ack, err) => reply(ack, { ok: false, message: err.message, error: err.message, status: err.status || (err.name === 'ValidationError' ? 400 : 500) });

module.exports = function registerChatHandlers(io, socket) {
  const user = socket.user;

  // Join a room — only if this user is a participant (the server enforces the role rules).
  socket.on('join_conversation', async ({ conversationId } = {}, ack) => {
    try {
      const conv = await chat.getConversationForUser(conversationId, user);
      socket.join(chat.room(conv._id));
      reply(ack, { ok: true });
    } catch (err) { fail(ack, err); }
  });

  // send_message -> save in MongoDB -> broadcast new_message to the room
  socket.on('send_message', async ({ conversationId, text, video } = {}, ack) => {
    try {
      const message = await chat.sendMessage(user, conversationId, { text, video });
      reply(ack, { ok: true, data: message.toObject() });
    } catch (err) { fail(ack, err); }
  });

  socket.on('typing', async ({ conversationId, isTyping = true } = {}) => {
    const roomName = chat.room(conversationId);
    if (!socket.rooms.has(roomName)) return; // only people in the room may type into it
    socket.to(roomName).emit('typing', { conversationId, userId: user.id, name: user.name, isTyping: Boolean(isTyping) });
  });

  socket.on('mark_read', async ({ conversationId } = {}, ack) => {
    try {
      const updated = await chat.markRead(user, conversationId);
      reply(ack, { ok: true, updated });
    } catch (err) { fail(ack, err); }
  });
};
