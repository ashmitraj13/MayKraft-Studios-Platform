const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Build unique indexes (email, participantKey) before any test relies on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  require('../src/services/cache').dashboardCache.clear();
});

afterAll(async () => {
  const { server, io } = require('../src/server');
  await new Promise((resolve) => io.close(() => resolve()));
  if (server.listening) await new Promise((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
