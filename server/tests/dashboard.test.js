const { authed, makeUser, inDays } = require('./helpers');
const Video = require('../src/models/Video');
const { buildDashboardPipeline } = require('../src/services/dashboard');
const Project = require('../src/models/Project');

async function setup() {
  const manager = await makeUser('manager');
  const editor = await makeUser('editor', { name: 'Kabir' });
  const client = await makeUser('client', { company: 'Chaiwala Junction' });
  const project = (await authed('post', '/api/projects', manager.token).send({
    title: 'Monsoon', client: client.id, totalVideos: 4, clientDeadline: inDays(10),
  })).body.data;
  const add = (title, extra = {}) =>
    authed('post', `/api/projects/${project._id}/videos`, manager.token).send({ title, footageLink: 'https://drive.google.com/x', ...extra }).then((r) => r.body.data);
  return { manager, editor, client, project, add };
}

describe('Manager dashboard', () => {
  test('progress counts come from the aggregation', async () => {
    const { manager, editor, project, add } = await setup();
    const [a, b, c] = [await add('A'), await add('B'), await add('C')];
    await Video.updateOne({ _id: a._id }, { status: 'approved', assignedEditor: editor.id });
    await Video.updateOne({ _id: b._id }, { status: 'delivered', assignedEditor: editor.id });
    await Video.updateOne({ _id: c._id }, { status: 'in_progress', assignedEditor: editor.id, editorDeadline: inDays(5) });

    const res = await authed('get', '/api/dashboard/clients', manager.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    expect(row.client.company).toBe('Chaiwala Junction');
    const p = row.projects[0];
    expect(p._id).toBe(project._id);
    expect(p).toMatchObject({ totalVideos: 4, videoCount: 3, doneCount: 2, progress: 50 });
    expect(p.statusCounts).toEqual({ approved: 1, delivered: 1, in_progress: 1 });
    expect(res.body.summary).toMatchObject({ clients: 1, projects: 1, done: 2, totalVideos: 4 });
  });

  test('fromCache is false, then true; any video write clears it', async () => {
    const { manager, add } = await setup();
    await add('A');
    const first = await authed('get', '/api/dashboard/clients', manager.token);
    expect(first.body.fromCache).toBe(false);
    const second = await authed('get', '/api/dashboard/clients', manager.token);
    expect(second.body.fromCache).toBe(true);
    expect(second.body.data).toEqual(first.body.data);

    await add('B'); // a write
    const third = await authed('get', '/api/dashboard/clients', manager.token);
    expect(third.body.fromCache).toBe(false);
    expect(third.body.data[0].projects[0].videoCount).toBe(2);
  });

  test('different filters are cached separately', async () => {
    const { manager, add } = await setup();
    await add('A');
    await authed('get', '/api/dashboard/clients', manager.token);
    const filtered = await authed('get', '/api/dashboard/clients?overdue=true', manager.token);
    expect(filtered.body.fromCache).toBe(false);
  });

  test('flags: green on track, amber tight, red when editor is after client deadline or overdue', async () => {
    const { manager, editor, add } = await setup();
    const ids = {};
    for (const t of ['safe', 'tight', 'late', 'overdue', 'done']) ids[t] = (await add(t))._id;
    await Video.updateOne({ _id: ids.safe }, { status: 'in_progress', assignedEditor: editor.id, editorDeadline: inDays(5), clientDeadline: inDays(10) });
    await Video.updateOne({ _id: ids.tight }, { status: 'in_progress', assignedEditor: editor.id, editorDeadline: inDays(1), clientDeadline: inDays(10) });
    await Video.updateOne({ _id: ids.late }, { status: 'assigned', assignedEditor: editor.id, editorDeadline: inDays(12), clientDeadline: inDays(10) });
    await Video.updateOne({ _id: ids.overdue }, { status: 'in_progress', assignedEditor: editor.id, editorDeadline: inDays(-2), clientDeadline: inDays(10) });
    await Video.updateOne({ _id: ids.done }, { status: 'delivered', assignedEditor: editor.id, editorDeadline: inDays(-20), clientDeadline: inDays(-15) });

    const res = await authed('get', '/api/dashboard/clients', manager.token);
    const byTitle = Object.fromEntries(res.body.data[0].projects[0].videos.map((v) => [v.title, v]));
    expect(byTitle.safe).toMatchObject({ flag: 'green', overdue: false, bufferDays: 5 });
    expect(byTitle.tight.flag).toBe('amber');
    expect(byTitle.late).toMatchObject({ flag: 'red', bufferDays: -2 });
    expect(byTitle.overdue).toMatchObject({ flag: 'red', overdue: true });
    expect(byTitle.done).toMatchObject({ flag: 'green', overdue: false });
    expect(byTitle.safe.assignedEditor.name).toBe('Kabir');

    const overdueOnly = await authed('get', '/api/dashboard/clients?overdue=true', manager.token);
    expect(overdueOnly.body.data[0].projects[0].videos.map((v) => v.title)).toEqual(['overdue']);
    // progress still counts every video of the project
    expect(overdueOnly.body.data[0].projects[0].videoCount).toBe(5);
  });

  test('filter by editor and status; projects without matches disappear', async () => {
    const { manager, editor, add } = await setup();
    const a = await add('A');
    await add('B');
    await Video.updateOne({ _id: a._id }, { status: 'assigned', assignedEditor: editor.id, editorDeadline: inDays(3) });

    const byEditor = await authed('get', `/api/dashboard/clients?editor=${editor.id}`, manager.token);
    expect(byEditor.body.data[0].projects[0].videos.map((v) => v.title)).toEqual(['A']);

    const byStatus = await authed('get', '/api/dashboard/clients?status=approved', manager.token);
    expect(byStatus.body.data).toEqual([]);

    expect((await authed('get', '/api/dashboard/clients?status=bogus', manager.token)).status).toBe(400);
  });

  test('the pipeline is a real aggregation ($lookup, $group, $addFields)', () => {
    const json = JSON.stringify(buildDashboardPipeline({}));
    for (const stage of ['$match', '$lookup', '$group', '$addFields', '$facet']) expect(json).toContain(stage);
    expect(typeof Project.aggregate).toBe('function');
  });
});
