const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');

router.post(
  '/login',
  authLimiter,
  validate({
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password' },
    role: { type: 'enum', values: ['manager', 'editor', 'client'], label: 'Role' },
  }),
  c.login
);

router.post(
  '/register',
  authLimiter,
  auth,
  requireRole('manager'),
  validate({
    name: { type: 'string', required: true, max: 80, label: 'Name' },
    email: { type: 'email', required: true, label: 'Email' },
    password: { type: 'password', required: true, label: 'Password' },
    role: { type: 'enum', required: true, values: ['editor', 'client'], label: 'Role' },
    company: { type: 'string', max: 120, label: 'Company' },
    skills: { type: 'stringArray', label: 'Skills' },
    avatarUrl: { type: 'url', label: 'Avatar URL' },
  }),
  c.register
);

router.get('/me', auth, c.me);

router.patch(
  '/password',
  authLimiter,
  auth,
  validate({
    currentPassword: { type: 'string', required: true, label: 'Current password' },
    newPassword: { type: 'password', required: true, label: 'New password' },
  }),
  c.changePassword
);

module.exports = router;
