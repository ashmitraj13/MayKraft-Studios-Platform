const http = require('http');
const mongoose = require('mongoose');
const env = require('./config/env');
const app = require('./app');
const { connectDB, startMemoryDB } = require('./config/db');
const { initSocket } = require('./sockets');

const server = http.createServer(app);
const io = initSocket(server);

async function start() {
  if (env.USE_MEMORY_DB) {
    await startMemoryDB();
    console.log('Using in-memory MongoDB (data resets on restart). Seeding demo data...');
    await require('./seed/seed').seed({ quiet: false });
  } else {
    await connectDB(env.MONGO_URI);
    console.log('MongoDB connected');
  }
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${env.PORT} is busy. Set PORT in server/.env to a free port.`);
    else console.error(err);
    process.exit(1);
  });
  server.listen(env.PORT, () => console.log(`MayKraft API listening on http://localhost:${env.PORT}`));
}

async function shutdown() {
  io.close();
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { server, io, start };
module.exports.server = server;
module.exports.io = io;
