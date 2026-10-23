const { Server } = require('socket.io');
const env = require('../config/env');
const Conversation = require('../models/Conversation');
const { userFromToken } = require('../middleware/auth');
const { setIO } = require('./emitter');
const { addSocket, removeSocket } = require('./presence');
const registerChatHandlers = require('./chat.handlers');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URLS, credentials: true },
  });

  // Handshake auth: the client sends { auth: { token } }; no valid JWT, no connection.
  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth && socket.handshake.auth.token);
      socket.user = { id: String(user._id), role: user.role, name: user.name };
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.user;
    const tabs = addSocket(id, socket.id);
    socket.join([`user:${id}`, `role:${role}`]);

    registerChatHandlers(io, socket); // before any await, so early events are not missed

    const convs = await Conversation.find({ participants: id }, '_id').lean();
    convs.forEach((c) => socket.join(`conv:${c._id}`));
    if (tabs === 1) socket.broadcast.emit('presence', { userId: id, online: true });
    socket.emit('ready', { userId: id, rooms: convs.length });

    socket.on('disconnect', () => {
      if (removeSocket(id, socket.id) === 0) io.emit('presence', { userId: id, online: false });
    });
  });

  setIO(io);
  return io;
}

module.exports = { initSocket };
