// userId -> Set of socket ids (one person can have several tabs open)
const userSockets = new Map();

function addSocket(userId, socketId) {
  const key = String(userId);
  if (!userSockets.has(key)) userSockets.set(key, new Set());
  userSockets.get(key).add(socketId);
  return userSockets.get(key).size;
}

function removeSocket(userId, socketId) {
  const key = String(userId);
  const set = userSockets.get(key);
  if (!set) return 0;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(key);
  return set.size;
}

const isOnline = (userId) => userSockets.has(String(userId));
const onlineUserIds = () => [...userSockets.keys()];

module.exports = { userSockets, addSocket, removeSocket, isOnline, onlineUserIds };
