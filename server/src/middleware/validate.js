const validator = require('validator');
const ValidationError = require('../utils/ValidationError');
const { isUrl, isId, TIMESTAMP_RE } = require('../utils/helpers');

/**
 * validate({ field: rule }, { partial })
 * rule: { type, required, label, min, max, values }
 * types: string, email, password, url, urlArray, date, int, enum, boolean, id, timestamp, stringArray
 * partial = true for PATCH: missing fields are fine, but present ones must be valid.
 */
function validate(rules, { partial = false } = {}) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const label = rule.label || field;
      const v = body[field];
      const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

      if (empty) {
        if (rule.required && !partial) errors.push(`${label} is required`);
        continue;
      }

      switch (rule.type) {
        case 'string':
          if (typeof v !== 'string') errors.push(`${label} must be text`);
          else if (rule.max && v.trim().length > rule.max) errors.push(`${label} must be at most ${rule.max} characters`);
          else if (rule.min && v.trim().length < rule.min) errors.push(`${label} must be at least ${rule.min} characters`);
          break;
        case 'email':
          if (typeof v !== 'string' || !validator.isEmail(v.trim())) errors.push(`${label} must be a valid email`);
          break;
        case 'password':
          if (typeof v !== 'string' || v.length < 8) errors.push(`${label} must be at least 8 characters`);
          break;
        case 'url':
          if (!isUrl(v)) errors.push(`${label} must be a valid http(s) URL`);
          break;
        case 'urlArray':
          if (!Array.isArray(v) || v.some((u) => !isUrl(u))) errors.push(`${label} must be a list of valid http(s) URLs`);
          break;
        case 'stringArray':
          if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) errors.push(`${label} must be a list of text values`);
          break;
        case 'date':
          if (Number.isNaN(new Date(v).getTime()) || typeof v === 'boolean') errors.push(`${label} must be a valid date`);
          break;
        case 'int': {
          const n = Number(v);
          if (!Number.isInteger(n)) errors.push(`${label} must be a whole number`);
          else if (rule.min !== undefined && n < rule.min) errors.push(`${label} must be at least ${rule.min}`);
          else if (rule.max !== undefined && n > rule.max) errors.push(`${label} must be at most ${rule.max}`);
          break;
        }
        case 'enum':
          if (!rule.values.includes(v)) errors.push(`${label} must be one of: ${rule.values.join(', ')}`);
          break;
        case 'boolean':
          if (typeof v !== 'boolean') errors.push(`${label} must be true or false`);
          break;
        case 'id':
          if (!isId(String(v))) errors.push(`${label} is not a valid id`);
          break;
        case 'timestamp':
          if (typeof v !== 'string' || !TIMESTAMP_RE.test(v.trim())) errors.push(`${label} must look like 01:15 or 1:02:30`);
          break;
        default:
          break;
      }
    }

    if (errors.length) return next(new ValidationError(errors.join('; ')));
    return next();
  };
}

module.exports = validate;
