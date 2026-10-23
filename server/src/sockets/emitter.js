// Lets controllers push socket events without importing server.js (avoids circular requires).
let io = null;

const setIO = (instance) => { io = instance; };
const getIO = () => io;

// rooms: 'user:<id>', 'role:manager', 'conv:<id>'
function emitTo(rooms, event, payload) {
  if (!io) return;
  const list = (Array.isArray(rooms) ? rooms : [rooms]).filter(Boolean);
  if (list.length) io.to(list).emit(event, payload);
}

module.exports = { setIO, getIO, emitTo };
