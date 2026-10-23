const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const logger = require('./middleware/logger');
const routes = require('./routes');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct rate limiting
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / curl / tests (no Origin header) and the configured client URLs
      if (!origin || env.CLIENT_URLS.includes(origin.replace(/\/$/, ''))) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(logger);

app.get('/', (req, res) => res.status(200).json({ data: { name: 'MayKraft Studios API', docs: '/api/health' } }));
app.use('/api', routes);

app.use(notFoundRoute);
app.use(errorHandler);

module.exports = app;
module.exports.app = app;
