const { isId } = require('../utils/helpers');
const { notFound } = require('../utils/HttpError');

// A malformed id can never match a document, so it is reported as "X not found".
module.exports = (param, label) => (req, res, next) => {
  if (!isId(req.params[param])) return next(notFound(label));
  return next();
};
