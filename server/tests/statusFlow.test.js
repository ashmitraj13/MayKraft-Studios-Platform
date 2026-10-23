const { authed, makeWorld, makeUser, inDays } = require('./helpers');

async function assigned() {
  const w = await makeWorld();
  await authed('patch', `/api/videos/${w.video._id}/assign`, w.manager.token).send({ editorId: w.editor.id, editorDeadline: inDays(5) });
  return w;
}
const status = (w, who, body) => authed('patch', `/api/videos/${w.video._id}/status`, w[who].token).send(body);
const submit = (w, link = 'https://frame.io/v/1') => authed('post', `/api/videos/${w.video._id}/versions`, w.editor.token).send({ link, notes: 'First cut' });

describe('Status transitions', () => {
  test('the full happy path, end to end', async () => {
    const w = await assigned();
    expect((await status(w, 'editor', { status: 'in_progress' })).body.data.status).toBe('in_progress');

    const v1 = await submit(w);
    expect(v1.status).toBe(201);
    expect(v1.body.data.status).toBe('submitted');
    expect(v1.body.data.versions).toHaveLength(1);

    const cr = await status(w, 'manager', { status: 'changes_requested', note: 'Tighten the intro', timestampInVideo: '00:05' });
    expect(cr.body.data.status).toBe('changes_requested');

    const v2 = await submit(w, 'https://frame.io/v/2');
    expect(v2.body.data.versions.map((v) => v.versionNumber)).toEqual([1, 2]);

    expect((await status(w, 'manager', { status: 'client_review' })).status).toBe(200);
    // client can now see it — with no editor details
    const seen = await authed('get', `/api/videos/${w.video._id}`, w.client.token);
    expect(seen.status).toBe(200);
    expect(seen.body.data.reviewLink).toBe('https://frame.io/v/2');
    expect(seen.body.data.assignedEditor).toBeUndefined();
    expect(seen.body.data.editorDeadline).toBeUndefined();
    expect(seen.body.data.versions).toBeUndefined();

    expect((await status(w, 'client', { status: 'approved', note: 'Love it' })).body.data.status).toBe('approved');
    const done = await status(w, 'manager', { status: 'delivered', deliveryLink: 'https://drive.google.com/final' });
    expect(done.body.data.status).toBe('delivered');
    expect(done.body.data.deliveryLink).toBe('https://drive.google.com/final');

    const history = (await authed('get', `/api/videos/${w.video._id}`, w.manager.token)).body.data.statusHistory.map((h) => h.status);
    expect(history).toEqual(['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'changes_requested', 'submitted', 'client_review', 'approved', 'delivered']);
  });

  test('invalid transition -> 400 with a clear message', async () => {
    const w = await assigned();
    const res = await status(w, 'manager', { status: 'delivered', deliveryLink: 'https://x.com/a' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cannot move a video from 'assigned' to 'delivered'/);
  });

  test('unknown status -> 400', async () => {
    const w = await assigned();
    const res = await status(w, 'manager', { status: 'finished' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown status/);
  });

  test('same status -> 400', async () => {
    const w = await assigned();
    expect((await status(w, 'manager', { status: 'assigned' })).status).toBe(400);
  });

  test('a valid move by the wrong role -> 403', async () => {
    const w = await assigned();
    const res = await status(w, 'manager', { status: 'in_progress' });
    expect(res.status).toBe(403);
  });

  test('an editor cannot submit before starting work', async () => {
    const w = await assigned();
    const res = await submit(w);
    expect(res.status).toBe(400);
  });

  test('version link must be a URL', async () => {
    const w = await assigned();
    await status(w, 'editor', { status: 'in_progress' });
    const res = await authed('post', `/api/videos/${w.video._id}/versions`, w.editor.token).send({ link: 'final.mp4' });
    expect(res.status).toBe(400);
  });

  test('requesting changes needs a note', async () => {
    const w = await assigned();
    await status(w, 'editor', { status: 'in_progress' });
    await submit(w);
    const res = await status(w, 'manager', { status: 'changes_requested' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/note/);
  });

  test('delivering needs a valid delivery link', async () => {
    const w = await assigned();
    await status(w, 'editor', { status: 'in_progress' });
    await submit(w);
    await status(w, 'manager', { status: 'approved' });
    expect((await status(w, 'manager', { status: 'delivered' })).status).toBe(400);
  });

  test('client feedback reaches the manager, never the editor', async () => {
    const w = await assigned();
    await status(w, 'editor', { status: 'in_progress' });
    await submit(w);
    await status(w, 'manager', { status: 'changes_requested', note: 'Manager note to editor' });
    await submit(w, 'https://frame.io/v/2');
    await status(w, 'manager', { status: 'client_review' });
    const cc = await status(w, 'client', { status: 'client_changes', note: 'Logo bigger please', timestampInVideo: '01:15' });
    expect(cc.status).toBe(200);

    const managerView = (await authed('get', `/api/videos/${w.video._id}/feedback`, w.manager.token)).body.data;
    expect(managerView.map((f) => f.text)).toEqual(['Manager note to editor', 'Logo bigger please']);
    expect(managerView[1]).toMatchObject({ role: 'client', timestampInVideo: '01:15', versionNumber: 2 });

    const editorView = (await authed('get', `/api/videos/${w.video._id}/feedback`, w.editor.token)).body.data;
    expect(editorView.map((f) => f.text)).toEqual(['Manager note to editor']);

    // manager forwards it to the editor
    expect((await status(w, 'manager', { status: 'changes_requested', note: 'Client wants the logo bigger at 01:15' })).status).toBe(200);
  });

  test('clients cannot see videos before client review', async () => {
    const w = await assigned();
    const res = await authed('get', `/api/videos/${w.video._id}`, w.client.token);
    expect(res.status).toBe(404);
    const list = await authed('get', `/api/projects/${w.project._id}`, w.client.token);
    expect(list.body.data.videos).toHaveLength(0);
  });

  test('editors cannot post feedback; another editor cannot change status', async () => {
    const w = await assigned();
    expect((await authed('post', `/api/videos/${w.video._id}/feedback`, w.editor.token).send({ text: 'hi' })).status).toBe(403);
    const stranger = await makeUser('editor');
    expect((await authed('patch', `/api/videos/${w.video._id}/status`, stranger.token).send({ status: 'in_progress' })).status).toBe(404);
  });

  test('bad timestamp -> 400', async () => {
    const w = await assigned();
    const res = await authed('post', `/api/videos/${w.video._id}/feedback`, w.manager.token).send({ text: 'x', timestampInVideo: 'one minute' });
    expect(res.status).toBe(400);
  });

  test('on-time percentage counts the first submission against the editor deadline', async () => {
    const w = await assigned();
    await status(w, 'editor', { status: 'in_progress' });
    await submit(w);
    await status(w, 'manager', { status: 'approved' });
    const row = (await authed('get', '/api/editors', w.manager.token)).body.data.find((e) => e._id === w.editor.id);
    expect(row).toMatchObject({ activeCount: 0, completedCount: 1, onTimePercent: 100 });
  });
});
