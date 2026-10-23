const env = require('../config/env');

function send(res, status, message) {
  return res.status(status).json({ message, error: message });
}

// 404 for unknown routes
function notFoundRoute(req, res) {
  return send(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Our own ValidationError and Mongoose schema validation errors -> 400
  if (err.name === 'ValidationError') {
    const message = err.errors
      ? Object.values(err.errors).map((e) => e.message).join('; ')
      : err.message;
    return send(res, 400, message);
  }

  // Duplicate key (unique index) -> 409
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (field === 'email') return send(res, 409, 'Email already registered');
    if (field === 'participantKey') return send(res, 409, 'Conversation already exists');
    return send(res, 409, `Duplicate value for ${field || 'a unique field'}`);
  }

  if (err.name === 'HttpError') return send(res, err.status, err.message);

  if (err.name === 'CastError') return send(res, 400, `Invalid value for ${err.path}`);

  if (err.type === 'entity.parse.failed') return send(res, 400, 'Request body is not valid JSON');
  if (err.type === 'entity.too.large') return send(res, 413, 'Request body is too large');

  if (!env.isTest) console.error(err);
  return send(res, 500, 'Internal server error');
}

module.exports = { errorHandler, notFoundRoute };
