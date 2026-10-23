const env = require('../config/env');

module.exports = function logger(req, res, next) {
  if (!env.isTest) console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
};
