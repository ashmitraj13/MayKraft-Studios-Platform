const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { signToken } = require('../src/middleware/auth');

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}.${Date.now()}.${++counter}@test.maykraft.dev`;

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString();

async function makeUser(role, extra = {}) {
  const password = extra.password || 'Password123!';
  const user = await User.create({
    name: extra.name || `Test ${role} ${counter + 1}`,
    email: extra.email || uniqueEmail(role),
    passwordHash: await User.hashPassword(password),
    role,
    company: role === 'client' ? extra.company || 'Test Brand Pvt Ltd' : undefined,
    isActive: extra.isActive !== undefined ? extra.isActive : true,
  });
  return { user, password, token: signToken(user), id: String(user._id) };
}

const api = () => request(app);
const authed = (method, url, token) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

// manager + editor + client + a project + a video, ready for workflow tests
async function makeWorld({ videoClientDays = 10 } = {}) {
  const manager = await makeUser('manager');
  const editor = await makeUser('editor');
  const client = await makeUser('client');
  const project = (
    await authed('post', '/api/projects', manager.token).send({
      title: 'Launch Campaign',
      client: client.id,
      totalVideos: 3,
      clientDeadline: inDays(videoClientDays),
    })
  ).body.data;
  const video = (
    await authed('post', `/api/projects/${project._id}/videos`, manager.token).send({
      title: 'Hero Reel',
      footageLink: 'https://drive.google.com/drive/folders/abc123',
      brief: '30s vertical reel',
    })
  ).body.data;
  return { manager, editor, client, project, video };
}

module.exports = { uniqueEmail, makeUser, api, authed, makeWorld, inDays, DAY };
