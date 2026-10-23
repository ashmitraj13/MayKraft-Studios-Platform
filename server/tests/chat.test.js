const { io: ioClient } = require('socket.io-client');
const { authed, makeUser, makeWorld, inDays, api } = require('./helpers');
const { server } = require('../src/server');
const Message = require('../src/models/Message');

let url;
beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

const sockets = [];
function connect(token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(s);
    s.on('ready', () => resolve(s));
    s.on('connect_error', reject);
  });
}
const emit = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));
const once = (s, event) => new Promise((resolve) => s.once(event, resolve));

afterEach(() => { while (sockets.length) sockets.pop().disconnect(); });

describe('Conversations (REST)', () => {
  test('manager opens a conversation with an editor -> 201, opening again -> 200 same thread', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const first = await authed('post', '/api/conversations', manager.token).send({ participantId: editor.id });
    expect(first.status).toBe(201);
    expect(first.body.data.type).toBe('manager_editor');
    const again = await authed('post', '/api/conversations', editor.token).send({ participantId: manager.id });
    expect(again.status).toBe(200);
    expect(again.body.data._id).toBe(first.body.data._id);
  });

  test('an editor cannot open a conversation with a client -> 403', async () => {
    const editor = await makeUser('editor');
    const client = await makeUser('client');
    const res = await authed('post', '/api/conversations', editor.token).send({ participantId: client.id });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only chat with managers/);
  });

  test('clients cannot chat with each other', async () => {
    const a = await makeUser('client');
    const b = await makeUser('client');
    expect((await authed('post', '/api/conversations', a.token).send({ participantId: b.id })).status).toBe(403);
  });

  test('a message is persisted and returned in history, with unread counts', async () => {
    const manager = await makeUser('manager');
    const client = await makeUser('client');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: client.id })).body.data;

    const sent = await authed('post', `/api/conversations/${conv._id}/messages`, manager.token).send({ text: 'Hi Priya, v2 is ready' });
    expect(sent.status).toBe(201);
    expect(await Message.countDocuments()).toBe(1);

    const history = await authed('get', `/api/conversations/${conv._id}/messages`, client.token);
    expect(history.status).toBe(200);
    expect(history.body.data.map((m) => m.text)).toEqual(['Hi Priya, v2 is ready']);
    expect(history.body.data[0].sender.role).toBe('manager');

    const list = await authed('get', '/api/conversations', client.token);
    expect(list.body.data[0]).toMatchObject({ unreadCount: 1 });
    expect(list.body.data[0].otherUser._id).toBe(manager.id);

    await authed('patch', `/api/conversations/${conv._id}/read`, client.token);
    expect((await authed('get', '/api/conversations', client.token)).body.data[0].unreadCount).toBe(0);
  });

  test('history is paginated with before + limit', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: editor.id })).body.data;
    const base = Date.now() - 100000;
    await Message.insertMany(Array.from({ length: 35 }, (_, i) => ({
      conversation: conv._id, sender: manager.id, text: `m${i}`, createdAt: new Date(base + i * 1000),
    })));
    const page1 = await authed('get', `/api/conversations/${conv._id}/messages`, editor.token);
    expect(page1.body.data).toHaveLength(30);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.data[0].text).toBe('m5');
    expect(page1.body.data[29].text).toBe('m34');
    const page2 = await authed('get', `/api/conversations/${conv._id}/messages?before=${page1.body.data[0]._id}&limit=30`, editor.token);
    expect(page2.body.data.map((m) => m.text)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(page2.body.hasMore).toBe(false);
  });

  test("an outsider cannot read someone else's conversation", async () => {
    const manager = await makeUser('manager');
    const client = await makeUser('client');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: client.id })).body.data;
    expect((await authed('get', `/api/conversations/${conv._id}/messages`, editor.token)).status).toBe(404);
    expect((await authed('post', `/api/conversations/${conv._id}/messages`, editor.token).send({ text: 'hi' })).status).toBe(404);
  });

  test('a message can reference a video the other side can see', async () => {
    const w = await makeWorld();
    await authed('patch', `/api/videos/${w.video._id}/assign`, w.manager.token).send({ editorId: w.editor.id, editorDeadline: inDays(4) });
    const conv = (await authed('post', '/api/conversations', w.manager.token).send({ participantId: w.editor.id })).body.data;
    const res = await authed('post', `/api/conversations/${conv._id}/messages`, w.manager.token).send({ text: 'Notes on this one', video: w.video._id });
    expect(res.status).toBe(201);
    expect(res.body.data.video.title).toBe('Hero Reel');

    // not visible to the client yet -> refused
    const cconv = (await authed('post', '/api/conversations', w.manager.token).send({ participantId: w.client.id })).body.data;
    const bad = await authed('post', `/api/conversations/${cconv._id}/messages`, w.client.token).send({ text: 'x', video: w.video._id });
    expect(bad.status).toBe(404);
  });

  test('empty message -> 400', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: editor.id })).body.data;
    expect((await authed('post', `/api/conversations/${conv._id}/messages`, manager.token).send({ text: '   ' })).status).toBe(400);
  });

  test('editors and clients can find managers to chat with', async () => {
    await makeUser('manager');
    const editor = await makeUser('editor');
    const res = await authed('get', '/api/managers', editor.token);
    expect(res.body.data).toHaveLength(1);
    expect((await api().get('/api/managers')).status).toBe(401);
  });
});

describe('Socket.io chat', () => {
  test('rejects a connection without a valid token', async () => {
    await expect(connect('bad-token')).rejects.toThrow('Unauthorized');
  });

  test('send_message saves to MongoDB and emits new_message to the room', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: editor.id })).body.data;

    const mSock = await connect(manager.token);
    const eSock = await connect(editor.token);
    const received = once(eSock, 'new_message');

    const ack = await emit(mSock, 'send_message', { conversationId: conv._id, text: 'Cut looks great' });
    expect(ack.ok).toBe(true);
    const evt = await received;
    expect(evt.conversationId).toBe(conv._id);
    expect(evt.message.text).toBe('Cut looks great');
    expect(await Message.countDocuments({ conversation: conv._id })).toBe(1);

    // survives a "refresh": history comes back from the DB
    const history = await authed('get', `/api/conversations/${conv._id}/messages`, editor.token);
    expect(history.body.data[0].text).toBe('Cut looks great');
  });

  test('a conversation created after connecting is joined automatically', async () => {
    const manager = await makeUser('manager');
    const client = await makeUser('client');
    const cSock = await connect(client.token);
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: client.id })).body.data;
    const received = once(cSock, 'new_message');
    await authed('post', `/api/conversations/${conv._id}/messages`, manager.token).send({ text: 'Welcome aboard' });
    expect((await received).message.text).toBe('Welcome aboard');
  });

  test("an editor cannot send into or join a manager-client conversation", async () => {
    const manager = await makeUser('manager');
    const client = await makeUser('client');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: client.id })).body.data;
    const eSock = await connect(editor.token);

    const sendAck = await emit(eSock, 'send_message', { conversationId: conv._id, text: 'hello client' });
    expect(sendAck).toMatchObject({ ok: false, status: 404 });
    const joinAck = await emit(eSock, 'join_conversation', { conversationId: conv._id });
    expect(joinAck.ok).toBe(false);
    expect(await Message.countDocuments()).toBe(0);
  });

  test('typing and mark_read reach the other participant', async () => {
    const manager = await makeUser('manager');
    const editor = await makeUser('editor');
    const conv = (await authed('post', '/api/conversations', manager.token).send({ participantId: editor.id })).body.data;
    await authed('post', `/api/conversations/${conv._id}/messages`, manager.token).send({ text: 'ping' });
    const mSock = await connect(manager.token);
    const eSock = await connect(editor.token);

    const typing = once(mSock, 'typing');
    eSock.emit('typing', { conversationId: conv._id, isTyping: true });
    expect(await typing).toMatchObject({ conversationId: conv._id, userId: editor.id, isTyping: true });

    const read = once(mSock, 'messages_read');
    const ack = await emit(eSock, 'mark_read', { conversationId: conv._id });
    expect(ack).toMatchObject({ ok: true, updated: 1 });
    expect(await read).toMatchObject({ userId: editor.id });
  });
});
