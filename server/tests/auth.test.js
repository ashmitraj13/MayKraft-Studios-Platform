const { api, authed, makeUser, uniqueEmail } = require('./helpers');

describe('Auth', () => {
  test('login returns a token and the user without the password hash', async () => {
    const { user, password } = await makeUser('manager');
    const res = await api().post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('manager');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('wrong password -> 401 with message and error', async () => {
    const { user } = await makeUser('editor');
    const res = await api().post('/api/auth/login').send({ email: user.email, password: 'nope-nope' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password', error: 'Invalid email or password' });
  });

  test('logging in through the wrong role page -> 403', async () => {
    const { user, password } = await makeUser('editor');
    const res = await api().post('/api/auth/login').send({ email: user.email, password, role: 'client' });
    expect(res.status).toBe(403);
  });

  test('deactivated accounts cannot log in', async () => {
    const { user, password } = await makeUser('client', { isActive: false });
    const res = await api().post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(403);
  });

  test('invalid email -> 400', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/);
  });

  test('GET /me without a token -> 401', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  test('GET /me with a garbage token -> 401', async () => {
    const res = await authed('get', '/api/auth/me', 'garbage.token.here');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });

  test('GET /me with a valid token returns the user', async () => {
    const { token, id } = await makeUser('client');
    const res = await authed('get', '/api/auth/me', token);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(id);
  });
});

describe('Register (manager creates accounts)', () => {
  test('manager creates an editor -> 201', async () => {
    const { token } = await makeUser('manager');
    const res = await authed('post', '/api/auth/register', token).send({
      name: 'Kabir', email: uniqueEmail('kabir'), password: 'Password123!', role: 'editor', skills: ['After Effects'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('editor');
    expect(res.body.data.skills).toEqual(['After Effects']);
  });

  test('the new account can log in', async () => {
    const { token } = await makeUser('manager');
    const email = uniqueEmail('client');
    await authed('post', '/api/auth/register', token).send({ name: 'Priya', email, password: 'Password123!', role: 'client', company: 'Vidya Spark' });
    const res = await api().post('/api/auth/login').send({ email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.company).toBe('Vidya Spark');
  });

  test('duplicate email -> 409 "Email already registered"', async () => {
    const { token } = await makeUser('manager');
    const email = uniqueEmail('dup');
    const body = { name: 'A', email, password: 'Password123!', role: 'editor' };
    expect((await authed('post', '/api/auth/register', token).send(body)).status).toBe(201);
    const res = await authed('post', '/api/auth/register', token).send({ ...body, email: email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Email already registered', error: 'Email already registered' });
  });

  test('client without a company -> 400', async () => {
    const { token } = await makeUser('manager');
    const res = await authed('post', '/api/auth/register', token).send({ name: 'X', email: uniqueEmail(), password: 'Password123!', role: 'client' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Company is required/);
  });

  test('cannot create another manager -> 400', async () => {
    const { token } = await makeUser('manager');
    const res = await authed('post', '/api/auth/register', token).send({ name: 'X', email: uniqueEmail(), password: 'Password123!', role: 'manager' });
    expect(res.status).toBe(400);
  });

  test('short password -> 400', async () => {
    const { token } = await makeUser('manager');
    const res = await authed('post', '/api/auth/register', token).send({ name: 'X', email: uniqueEmail(), password: 'short', role: 'editor' });
    expect(res.status).toBe(400);
  });

  test('no token -> 401, editor token -> 403', async () => {
    const body = { name: 'X', email: uniqueEmail(), password: 'Password123!', role: 'editor' };
    expect((await api().post('/api/auth/register').send(body)).status).toBe(401);
    const { token } = await makeUser('editor');
    const res = await authed('post', '/api/auth/register', token).send(body);
    expect(res.status).toBe(403);
  });
});

describe('General API behaviour', () => {
  test('unknown route -> 404 JSON', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe(res.body.error);
  });

  test('malformed JSON -> 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });

  test('health check', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('Change password', () => {
  test('changes the password; old one stops working', async () => {
    const { user, password, token } = await makeUser('client');
    const res = await authed('patch', '/api/auth/password', token).send({ currentPassword: password, newPassword: 'BrandNew123!' });
    expect(res.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: 'BrandNew123!' })).status).toBe(200);
  });

  test('wrong current password -> 400 (not 401, so the user stays logged in)', async () => {
    const { token } = await makeUser('editor');
    const res = await authed('patch', '/api/auth/password', token).send({ currentPassword: 'wrong-one', newPassword: 'BrandNew123!' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Current password is incorrect');
  });

  test('too short or unchanged -> 400; no token -> 401', async () => {
    const { password, token } = await makeUser('editor');
    expect((await authed('patch', '/api/auth/password', token).send({ currentPassword: password, newPassword: 'short' })).status).toBe(400);
    expect((await authed('patch', '/api/auth/password', token).send({ currentPassword: password, newPassword: password })).status).toBe(400);
    expect((await api().patch('/api/auth/password').send({ currentPassword: 'a', newPassword: 'BrandNew123!' })).status).toBe(401);
  });
});
