const router = require('express').Router();
const c = require('../controllers/video.controller');
const feedback = require('../controllers/feedback.controller');
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { videoRules } = require('./project.routes');

const id = validateObjectId('id', 'Video');

router.use(auth);

router.get('/', c.list);
router.get('/:id', id, c.get);
router.patch(
  '/:id',
  requireRole('manager'),
  id,
  validate({ ...videoRules, editorDeadline: { type: 'date', label: 'Editor deadline' } }, { partial: true }),
  c.update
);
router.delete('/:id', requireRole('manager'), id, c.remove);

router.patch(
  '/:id/assign',
  requireRole('manager'),
  id,
  validate({
    editorId: { type: 'id', required: true, label: 'Editor' },
    editorDeadline: { type: 'date', required: true, label: 'Editor deadline' },
  }),
  c.assign
);

router.patch(
  '/:id/status',
  id,
  validate({
    status: { type: 'string', required: true, label: 'Status' },
    note: { type: 'string', max: 4000, label: 'Note' },
    deliveryLink: { type: 'url', label: 'Delivery link' },
    timestampInVideo: { type: 'timestamp', label: 'Timestamp' },
  }),
  c.updateStatus
);

router.post(
  '/:id/versions',
  requireRole('editor'),
  id,
  validate({
    link: { type: 'url', required: true, label: 'Version link' },
    notes: { type: 'string', max: 2000, label: 'Notes' },
  }),
  c.submitVersion
);

router.get('/:id/feedback', id, feedback.list);
router.post(
  '/:id/feedback',
  id,
  validate({
    text: { type: 'string', required: true, max: 4000, label: 'Feedback' },
    timestampInVideo: { type: 'timestamp', label: 'Timestamp' },
    versionNumber: { type: 'int', min: 1, label: 'Version' },
  }),
  feedback.create
);

module.exports = router;
