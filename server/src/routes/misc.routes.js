const router = require('express').Router();
const feedback = require('../controllers/feedback.controller');
const dashboard = require('../controllers/dashboard.controller');
const conv = require('../controllers/conversation.controller');
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');

router.patch(
  '/feedback/:id/resolve',
  auth,
  requireRole('manager'),
  validateObjectId('id', 'Feedback'),
  validate({ resolved: { type: 'boolean' } }),
  feedback.resolve
);

router.get('/dashboard/clients', auth, requireRole('manager'), dashboard.clients);

const convId = validateObjectId('id', 'Conversation');
router.get('/conversations', auth, conv.list);
router.post('/conversations', auth, validate({ participantId: { type: 'id', required: true, label: 'participantId' }, projectId: { type: 'id' } }), conv.open);
router.get('/conversations/:id/messages', auth, convId, conv.messages);
router.post(
  '/conversations/:id/messages',
  auth,
  convId,
  validate({ text: { type: 'string', required: true, max: 2000, label: 'Message' }, video: { type: 'id', label: 'Video' } }),
  conv.send
);
router.patch('/conversations/:id/read', auth, convId, conv.read);

module.exports = router;
