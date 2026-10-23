const { authed, makeUser, makeWorld, inDays } = require('./helpers');

describe('Projects', () => {
  test('manager creates a project -> 201', async () => {
    const manager = await makeUser('manager');
    const client = await makeUser('client');
    const res = await authed('post', '/api/projects', manager.token).send({
      title: 'Monsoon Menu', client: client.id, totalVideos: 4, clientDeadline: inDays(14),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Monsoon Menu');
    expect(res.body.data.status).toBe('active');
    expect(res.body.warning).toBeUndefined();
  });

  test('missing fields -> 400 listing each problem', async () => {
    const manager = await makeUser('manager');
    const res = await authed('post', '/api/projects', manager.token).send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Title is required/);
    expect(res.body.message).toMatch(/Client is required/);
    expect(res.body.message).toMatch(/Total videos is required/);
  });

  test('client must be a client account', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const res = await authed('post', '/api/projects', manager.token).send({
      title: 'X', client: editor.id, totalVideos: 1, clientDeadline: inDays(3),
    });
    expect(res.status).toBe(400);
  });

  test('update + list with progress, then delete', async () => {
    const { manager, project, client } = await makeWorld();
    const upd = await authed('patch', `/api/projects/${project._id}`, manager.token).send({ title: 'Renamed', totalVideos: 5 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.title).toBe('Renamed');

    const list = await authed('get', '/api/projects', client.token);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ totalVideos: 5, videoCount: 1, doneCount: 0, progress: 0 });
    // clients only see the client-facing buckets
    expect(Object.keys(list.body.data[0].statusCounts).sort()).toEqual(['approved', 'client_review', 'delivered', 'in_production']);
    expect(list.body.data[0].statusCounts.in_production).toBe(1);

    const del = await authed('delete', `/api/projects/${project._id}`, manager.token);
    expect(del.status).toBe(200);
    expect(del.body.data).toMatchObject({ deleted: true, videosDeleted: 1 });
    expect((await authed('get', `/api/projects/${project._id}`, manager.token)).status).toBe(404);
  });

  test('moving the project deadline moves videos that followed it', async () => {
    const { manager, project, video } = await makeWorld();
    const newDeadline = inDays(30);
    await authed('patch', `/api/projects/${project._id}`, manager.token).send({ clientDeadline: newDeadline });
    const v = await authed('get', `/api/videos/${video._id}`, manager.token);
    expect(new Date(v.body.data.clientDeadline).toISOString()).toBe(newDeadline);
  });

  test('GET /clients/:id returns the client with all their projects', async () => {
    const { manager, client } = await makeWorld();
    const res = await authed('get', `/api/clients/${client.id}`, manager.token);
    expect(res.status).toBe(200);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.projectCount).toBe(1);
  });
});

describe('Videos', () => {
  test('manager adds a video -> 201 with status footage_uploaded', async () => {
    const { video } = await makeWorld();
    expect(video.status).toBe('footage_uploaded');
    expect(video.statusHistory).toHaveLength(1);
    expect(video.allowedNext).toEqual(['assigned']);
  });

  test('bad footage link -> 400', async () => {
    const { manager, project } = await makeWorld();
    const res = await authed('post', `/api/projects/${project._id}/videos`, manager.token).send({ title: 'X', footageLink: 'drive folder' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Footage link must be a valid/);
  });

  test('bad reference link -> 400', async () => {
    const { manager, project } = await makeWorld();
    const res = await authed('post', `/api/projects/${project._id}/videos`, manager.token).send({
      title: 'X', footageLink: 'https://frame.io/abc', referenceLinks: ['https://youtube.com/x', 'nope'],
    });
    expect(res.status).toBe(400);
  });

  test('video on a missing project -> 404', async () => {
    const manager = await makeUser('manager');
    const res = await authed('post', '/api/projects/64b7f0c2a1b2c3d4e5f60718/videos', manager.token).send({ title: 'X', footageLink: 'https://frame.io/a' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Project not found');
  });

  test('video defaults to the project client deadline', async () => {
    const { project, video } = await makeWorld();
    expect(video.clientDeadline).toBe(project.clientDeadline);
  });
});

describe('Assignment', () => {
  test('assign an editor -> status assigned, no warning when deadline is safe', async () => {
    const { manager, editor, video } = await makeWorld({ videoClientDays: 10 });
    const res = await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(6) });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
    expect(res.body.data.assignedEditor._id).toBe(editor.id);
    expect(res.body.warning).toBeUndefined();
  });

  test('editor deadline after client deadline is saved but returns a warning', async () => {
    const { manager, editor, video } = await makeWorld({ videoClientDays: 5 });
    const res = await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(7) });
    expect(res.status).toBe(200);
    expect(res.body.warning).toMatch(/after the client deadline/);
    expect(new Date(res.body.data.editorDeadline).toISOString()).toBe(new Date(res.body.data.editorDeadline).toISOString());
    const saved = await authed('get', `/api/videos/${video._id}`, manager.token);
    expect(saved.body.data.assignedEditor._id).toBe(editor.id);
  });

  test('reassigning keeps the status and records history', async () => {
    const { manager, editor, video } = await makeWorld();
    const other = await makeUser('editor', { name: 'Isha' });
    await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(5) });
    const res = await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: other.id, editorDeadline: inDays(5) });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
    expect(res.body.data.statusHistory.at(-1).note).toMatch(/Reassigned .* to Isha/);
    expect((await authed('get', `/api/videos/${video._id}`, editor.token)).status).toBe(404);
  });

  test('assigning to a non-editor -> 400', async () => {
    const { manager, client, video } = await makeWorld();
    const res = await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: client.id, editorDeadline: inDays(5) });
    expect(res.status).toBe(400);
  });

  test('editor list shows workload', async () => {
    const { manager, editor, video } = await makeWorld();
    await authed('patch', `/api/videos/${video._id}/assign`, manager.token).send({ editorId: editor.id, editorDeadline: inDays(5) });
    const res = await authed('get', '/api/editors', manager.token);
    const row = res.body.data.find((e) => e._id === editor.id);
    expect(row).toMatchObject({ activeCount: 1, completedCount: 0, onTimePercent: null });
  });
});
