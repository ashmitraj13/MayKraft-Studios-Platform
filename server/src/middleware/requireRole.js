const { forbidden, unauthorized } = require('../utils/HttpError');

// requireRole('manager') or requireRole('manager', 'editor')
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(forbidden(`Access denied: ${roles.join(' or ')} only`));
  }
  return next();
};
