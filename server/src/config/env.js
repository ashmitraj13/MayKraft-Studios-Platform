require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

const env = {
  NODE_ENV,
  isTest: NODE_ENV === 'test',
  isProd: NODE_ENV === 'production',
  PORT: Number(process.env.PORT) || 5050,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/maykraft',
  JWT_SECRET: process.env.JWT_SECRET || (NODE_ENV === 'production' ? '' : 'dev-only-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((u) => u.trim().replace(/\/$/, ''))
    .filter(Boolean),
  USE_MEMORY_DB: process.env.USE_MEMORY_DB === 'true',
};

if (env.isProd && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
