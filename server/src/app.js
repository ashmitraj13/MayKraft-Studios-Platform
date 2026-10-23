const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const logger = require('./middleware/logger');
const routes = require('./routes');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct rate limiting
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        // review links can be embedded from these players
        frameSrc: ['https://www.youtube.com', 'https://player.vimeo.com', 'https://drive.google.com'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
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

app.use('/api', routes);

// In production the API also serves the built React app, so the whole product lives on one URL.
const clientDist = path.join(__dirname, '../../client/dist');
if (process.env.SERVE_CLIENT !== 'false' && fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.status(200).json({ data: { name: 'MayKraft Studios API', docs: '/api/health' } }));
}

app.use(notFoundRoute);
app.use(errorHandler);

module.exports = app;
module.exports.app = app;
