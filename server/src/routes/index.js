const router = require('express').Router();

router.get('/health', (req, res) => res.status(200).json({ data: { status: 'ok', time: new Date().toISOString() } }));

router.use('/auth', require('./auth.routes'));
router.use('/projects', require('./project.routes'));
router.use('/videos', require('./video.routes'));
router.use('/', require('./user.routes'));
router.use('/', require('./misc.routes'));

module.exports = router;
