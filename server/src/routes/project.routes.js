const router = require('express').Router();
const c = require('../controllers/project.controller');
const videos = require('../controllers/video.controller');
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { PROJECT_STATUSES } = require('../utils/constants');

const projectRules = {
  title: { type: 'string', required: true, max: 120, label: 'Title' },
  client: { type: 'id', required: true, label: 'Client' },
  description: { type: 'string', max: 2000, label: 'Description' },
  totalVideos: { type: 'int', required: true, min: 1, max: 500, label: 'Total videos' },
  clientDeadline: { type: 'date', required: true, label: 'Client deadline' },
  status: { type: 'enum', values: PROJECT_STATUSES, label: 'Status' },
};

const videoRules = {
  title: { type: 'string', required: true, max: 120, label: 'Title' },
  brief: { type: 'string', max: 4000, label: 'Brief' },
  footageLink: { type: 'url', required: true, label: 'Footage link' },
  referenceLinks: { type: 'urlArray', label: 'Reference links' },
  clientDeadline: { type: 'date', label: 'Client deadline' },
  internalNotes: { type: 'string', max: 2000, label: 'Internal notes' },
};

router.use(auth);

router.get('/', c.list);
router.post('/', requireRole('manager'), validate(projectRules), c.create);
router.get('/:id', validateObjectId('id', 'Project'), c.get);
router.patch('/:id', requireRole('manager'), validateObjectId('id', 'Project'), validate(projectRules, { partial: true }), c.update);
router.delete('/:id', requireRole('manager'), validateObjectId('id', 'Project'), c.remove);

router.get('/:projectId/videos', validateObjectId('projectId', 'Project'), videos.listForProject);
router.post('/:projectId/videos', requireRole('manager'), validateObjectId('projectId', 'Project'), validate(videoRules), videos.create);

module.exports = router;
module.exports.videoRules = videoRules;
