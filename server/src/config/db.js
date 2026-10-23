const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

async function connectDB(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

// Starts an in-memory MongoDB (dev/demo only). Returns the instance so it can be stopped.
async function startMemoryDB() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri('maykraft'));
  return mongod;
}

module.exports = { connectDB, startMemoryDB };
