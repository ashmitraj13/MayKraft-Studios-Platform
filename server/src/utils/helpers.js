const mongoose = require('mongoose');
const validator = require('validator');
const { DAY_MS } = require('./constants');

const isId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v);
const toId = (v) => new mongoose.Types.ObjectId(String(v));
const sameId = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);

const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };
const isUrl = (v) => typeof v === 'string' && validator.isURL(v.trim(), URL_OPTS);

const TIMESTAMP_RE = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/;

// Returns a warning string (or null) when the editor deadline is risky.
function deadlineWarning(editorDeadline, clientDeadline) {
  if (!editorDeadline || !clientDeadline) return null;
  const e = new Date(editorDeadline).getTime();
  const c = new Date(clientDeadline).getTime();
  if (e > c) {
    const days = Math.ceil((e - c) / DAY_MS);
    return `Editor deadline is ${days} day${days === 1 ? '' : 's'} after the client deadline`;
  }
  return null;
}

module.exports = { isId, toId, sameId, isUrl, URL_OPTS, TIMESTAMP_RE, deadlineWarning };
