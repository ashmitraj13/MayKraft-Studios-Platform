const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { unauthorized } = require('../utils/HttpError');

function signToken(user) {
  return jwt.sign({ userId: String(user._id), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// Verifies a token and returns the live user (or throws a 401 HttpError).
async function userFromToken(token) {
  if (!token) throw unauthorized('Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    throw unauthorized(e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) throw unauthorized('Invalid token');
  return user;
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized('Authentication required');
    const user = await userFromToken(token);
    req.user = { id: String(user._id), role: user.role, name: user.name, doc: user };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { auth, signToken, userFromToken };
