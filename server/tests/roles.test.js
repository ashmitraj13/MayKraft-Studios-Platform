const { authed, makeUser, makeWorld, inDays } = require('./helpers');

describe('Role guards', () => {
  test('editor gets 403 on manager routes', async () => {
    const { token } = await makeUser('editor');
    for (const [method, url] of [
      ['get', '/api/dashboard/clients'],
      ['get', '/api/clients'],
      ['get', '/api/editors'],
      ['get', '/api/users'],
      ['post', '/api/projects'],
    ]) {
      const res = await authed(method, url, token).send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/);
    }
  });

  test('client gets 403 on manager routes', async () => {
    const { token } = await makeUser('client');
    expect((await authed('get', '/api/dashboard/clients', token)).status).toBe(403);
  });

  test("a client cannot see another client's project (404, existence is not leaked)", async () => {
    const { project } = await makeWorld();
    const other = await makeUser('client');
    const res = await authed('get', `/api/projects/${project._id}`, other.token);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Project not found');
    const list = await authed('get', '/api/projects', other.token);
    expect(list.body.data).toHaveLength(0);
  });

  test('a client sees their own project', async () => {
    const { project, client } = await makeWorld();
    const res = await authed('get', `/api/projects/${project._id}`, client.token);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Launch Campaign');
  });

  test('malformed ObjectId -> 404 not found, not 500', async () => {
    const { token } = await makeUser('manager');
    expect((await authed('get', '/api/projects/not-an-id', token)).body).toEqual({ message: 'Project not found', error: 'Project not found' });
    expect((await authed('get', '/api/videos/123', token)).status).toBe(404);
    expect((await authed('get', '/api/clients/xyz', token)).body.message).toBe('Client not found');
    expect((await authed('get', '/api/conversations/zzz/messages', token)).status).toBe(404);
  });

  test('an editor only sees videos assigned to them', async () => {
    const { manager, editor, video } = await makeWorld();
    const other = await makeUser('editor');
    await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(5) });

    expect((await authed('get', '/api/videos', editor.token)).body.data).toHaveLength(1);
    expect((await authed('get', '/api/videos', other.token)).body.data).toHaveLength(0);
    expect((await authed('get', `/api/videos/${video._id}`, other.token)).status).toBe(404);
  });

  test('editors do not see internal notes or the real client deadline', async () => {
    const { manager, editor, video } = await makeWorld();
    await authed('patch', `/api/videos/${video._id}`, manager.token).send({ internalNotes: 'Client is very picky' });
    await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(5) });
    const res = await authed('get', `/api/videos/${video._id}`, editor.token);
    expect(res.body.data.internalNotes).toBeUndefined();
    expect(res.body.data.clientDeadline).toBeUndefined();
    expect(res.body.data.editorDeadline).toBeDefined();
  });

  test('manager can deactivate a user, who then gets 401', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const res = await authed('patch', `/api/users/${editor.id}`, manager.token).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await authed('get', '/api/auth/me', editor.token)).status).toBe(401);
  });

  test('manager cannot deactivate themselves', async () => {
    const manager = await makeUser('manager');
    const res = await authed('patch', `/api/users/${manager.id}`, manager.token).send({ isActive: false });
    expect(res.status).toBe(400);
  });
});
