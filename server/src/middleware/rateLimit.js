const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = 'Too many attempts, please try again in a few minutes';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) => res.status(429).json({ message, error: message }),
});

module.exports = { authLimiter };
