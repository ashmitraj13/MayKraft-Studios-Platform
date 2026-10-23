// An error that already knows its HTTP status (401, 403, 404, 409...).
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const notFound = (what) => new HttpError(404, `${what} not found`);
const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);

module.exports = { HttpError, notFound, forbidden, unauthorized };
