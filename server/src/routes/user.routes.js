const router = require('express').Router();
const c = require('../controllers/user.controller');
const people = require('../controllers/people.controller');
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');

router.use(['/managers', '/clients', '/editors', '/users'], auth);

router.get('/managers', people.listManagers);

router.get('/clients', requireRole('manager'), people.listClients);
router.get('/clients/:id', requireRole('manager'), validateObjectId('id', 'Client'), people.getClient);
router.get('/editors', requireRole('manager'), people.listEditors);
router.get('/editors/:id', requireRole('manager'), validateObjectId('id', 'Editor'), people.getEditor);

router.get('/users', requireRole('manager'), c.list);
router.get('/users/:id', requireRole('manager'), validateObjectId('id', 'User'), c.get);
router.patch(
  '/users/:id',
  requireRole('manager'),
  validateObjectId('id', 'User'),
  validate(
    {
      name: { type: 'string', max: 80 },
      email: { type: 'email' },
      company: { type: 'string', max: 120 },
      skills: { type: 'stringArray' },
      avatarUrl: { type: 'url' },
      isActive: { type: 'boolean' },
      password: { type: 'password' },
    },
    { partial: true }
  ),
  c.update
);

module.exports = router;
