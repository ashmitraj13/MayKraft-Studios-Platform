const { seed } = require('../src/seed/seed');
const { api, authed } = require('./helpers');

test('seed creates the demo world and the demo logins work', async () => {
  const counts = await seed({ quiet: true });
  expect(counts).toMatchObject({ users: 7, projects: 5, videos: 20, conversations: 5 });

  const login = await api().post('/api/auth/login').send({ email: 'manager@maykraft.studio', password: 'Manager@123' });
  expect(login.status).toBe(200);
  const dash = await authed('get', '/api/dashboard/clients', login.body.data.token);
  expect(dash.body.data).toHaveLength(3);
  expect(dash.body.summary.red).toBeGreaterThan(0);
  expect(dash.body.summary.overdue).toBeGreaterThan(0);

  const editors = await authed('get', '/api/editors', login.body.data.token);
  expect(editors.body.data.every((e) => e.activeCount >= 0)).toBe(true);

  const client = await api().post('/api/auth/login').send({ email: 'rohan@chaiwalajunction.in', password: 'Client@123' });
  const projects = await authed('get', '/api/projects', client.body.data.token);
  expect(projects.body.data.map((p) => p.title).sort()).toEqual(['Bandra Flagship Opening', 'Monsoon Menu Launch']);
});
