const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Project = require('../models/Project');
const Video = require('../models/Video');
const Feedback = require('../models/Feedback');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const data = require('./data');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const at = (days, hour = 18) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// The route a video took to reach its current status.
const PATHS = {
  footage_uploaded: ['footage_uploaded'],
  assigned: ['footage_uploaded', 'assigned'],
  in_progress: ['footage_uploaded', 'assigned', 'in_progress'],
  submitted: ['footage_uploaded', 'assigned', 'in_progress', 'submitted'],
  changes_requested: ['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'changes_requested'],
  client_review: ['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'changes_requested', 'submitted', 'client_review'],
  client_changes: ['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'client_review', 'client_changes'],
  approved: ['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'client_review', 'approved'],
  delivered: ['footage_uploaded', 'assigned', 'in_progress', 'submitted', 'changes_requested', 'submitted', 'client_review', 'approved', 'delivered'],
};
const MANAGER_STEPS = ['footage_uploaded', 'assigned', 'changes_requested', 'client_review', 'delivered'];
const CLIENT_STEPS = ['client_changes', 'approved'];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function buildVideo(v, project, ids) {
  const editorId = v.editor ? ids.editors[v.editor] : null;
  const steps = PATHS[v.status];
  const editorDeadline = v.editor ? at(v.ed) : null;
  // Spread the history over the days before now (or before the editor deadline for finished work).
  const end = v.ed !== undefined && v.ed < 0 ? at(v.ed + (v.late ? 1 : 0), v.late ? 22 : 12) : new Date(Date.now() - 2 * HOUR);
  const start = new Date(end.getTime() - Math.max(steps.length, 2) * DAY);
  const stepGap = (end - start) / Math.max(steps.length - 1, 1);

  const statusHistory = [];
  const versions = [];
  steps.forEach((status, i) => {
    const when = new Date(start.getTime() + i * stepGap);
    let changedBy = ids.manager;
    if (!MANAGER_STEPS.includes(status) && !CLIENT_STEPS.includes(status)) changedBy = editorId;
    if (CLIENT_STEPS.includes(status)) changedBy = project.client;
    if (status === 'approved' && v.status === 'approved' && i === steps.length - 1 && v.title.includes('Macro')) changedBy = ids.manager;
    const entry = { status, changedBy, at: when };
    if (status === 'submitted') {
      const n = versions.length + 1;
      // the first cut decides "on time": make it land before/after the editor deadline as the data says
      let submittedAt = when;
      if (n === 1 && editorDeadline && v.ed < 0) submittedAt = new Date(editorDeadline.getTime() + (v.late ? 20 * HOUR : -10 * HOUR));
      versions.push({
        versionNumber: n,
        link: `https://frame.io/reviews/mks-${slug(v.title).slice(0, 24)}-v${n}`,
        notes: n === 1 ? 'First cut — music is temp, grade is a first pass.' : 'Addressed all notes; tightened pacing and fixed the end card.',
        submittedBy: editorId,
        submittedAt,
      });
      entry.note = `Version ${n} submitted`;
      entry.at = submittedAt;
    }
    if (status === 'assigned') entry.note = 'Assigned';
    statusHistory.push(entry);
  });

  return {
    project: project._id,
    title: v.title,
    brief: `${v.title}. Vertical 9:16 for Instagram Reels and YouTube Shorts. Hook in the first 2 seconds, brand colours, captions burned in, end card with CTA.`,
    footageLink: `https://drive.google.com/drive/folders/mks-${slug(v.title).slice(0, 30)}`,
    referenceLinks: ['https://www.instagram.com/reel/C8mks-reference-01/', 'https://vimeo.com/824804225'],
    assignedEditor: editorId,
    editorDeadline,
    clientDeadline: at(v.cd),
    status: v.status,
    versions,
    statusHistory,
    deliveryLink: v.status === 'delivered' ? `https://drive.google.com/drive/folders/mks-final-${slug(v.title).slice(0, 20)}` : undefined,
    internalNotes: v.status === 'client_changes' ? 'Client is particular about logo size — keep it above 12% of frame.' : '',
  };
}

async function seed({ quiet = false } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };

  await Promise.all([User, Project, Video, Feedback, Conversation, Message].map((m) => m.deleteMany({})));
  await Promise.all([User, Project, Video, Feedback, Conversation, Message].map((m) => m.init()));

  const hash = (p) => User.hashPassword(p);
  const manager = await User.create({ ...data.users.manager, passwordHash: await hash(data.users.manager.password) });
  const editorPw = await hash(data.users.editorPassword);
  const clientPw = await hash(data.users.clientPassword);

  const ids = { manager: manager._id, editors: {}, clients: {} };
  for (const e of data.users.editors) {
    const u = await User.create({ name: e.name, email: e.email, role: 'editor', skills: e.skills, passwordHash: editorPw });
    ids.editors[e.key] = u._id;
  }
  for (const c of data.users.clients) {
    const u = await User.create({ name: c.name, email: c.email, role: 'client', company: c.company, passwordHash: clientPw });
    ids.clients[c.key] = u._id;
  }

  const projectDocs = {};
  for (const p of data.projects) {
    projectDocs[p.key] = await Project.create({
      title: p.title,
      client: ids.clients[p.client],
      description: p.description,
      totalVideos: p.totalVideos,
      clientDeadline: at(p.deadline),
      createdBy: manager._id,
    });
  }

  const videoDocs = {};
  for (const v of data.videos) {
    videoDocs[v.title] = await Video.create(buildVideo(v, projectDocs[v.project], ids));
  }

  // Feedback threads
  // Feedback is dated just after the latest version of its video.
  const fb = (title, author, role, text, timestampInVideo, versionNumber = 1) => {
    const v = videoDocs[title];
    const after = v.statusHistory[v.statusHistory.length - 1].at;
    const createdAt = new Date(Math.min(after.getTime() + HOUR, Date.now()));
    return Feedback.create({ video: v._id, author, role, text, timestampInVideo, versionNumber, createdAt, updatedAt: createdAt });
  };
  await fb('Physics in 60 Seconds', manager._id, 'manager', 'Formula animation at 00:18 is too fast — hold each step for a beat. Also swap the music for something less dramatic.', '00:18');
  await fb('Parent Trust Ad — 45s', ids.clients.vidya, 'client', 'Please make our logo bigger in the end card and use the new tagline "Learn. Rise. Shine."', '00:41');
  await fb('Parent Trust Ad — 45s', manager._id, 'manager', 'Mum’s line at 00:12 has background noise — try the alternate take from card B.', '00:12');
  await fb('Behind the Counter — Barista Story', manager._id, 'manager', 'Warmer grade on the pour shots and trim the intro by 2 seconds.', '00:03');
  await fb('Masala Chai Pour — 15s Reel', ids.clients.chai, 'client', 'Perfect. This is exactly the vibe we wanted!', null, 2);

  // Chat threads
  const thread = async (otherId, type, projectKey, lines) => {
    const conv = await Conversation.create({
      type,
      participants: [manager._id, otherId],
      participantKey: Conversation.keyFor(manager._id, otherId),
      project: projectKey ? projectDocs[projectKey]._id : null,
    });
    const base = Date.now() - lines.length * 40 * 60 * 1000;
    const msgs = lines.map(([from, text, videoTitle, unread], i) => {
      const sender = from === 'm' ? manager._id : otherId;
      return {
        conversation: conv._id,
        sender,
        text,
        video: videoTitle ? videoDocs[videoTitle]._id : null,
        readBy: unread ? [sender] : [manager._id, otherId],
        createdAt: new Date(base + i * 40 * 60 * 1000),
        updatedAt: new Date(base + i * 40 * 60 * 1000),
      };
    });
    await Message.insertMany(msgs);
    conv.lastMessageAt = msgs[msgs.length - 1].createdAt;
    await conv.save();
  };

  await thread(ids.editors.kabir, 'manager_editor', 'boards', [
    ['m', 'Kabir, left notes on Physics in 60 Seconds — mainly pacing on the formula section.', 'Physics in 60 Seconds'],
    ['o', 'Got it. I’ll slow the build and swap the track. v2 by Thursday?'],
    ['m', 'Thursday works. Parent Trust Ad is back from the client too — logo + new tagline.', 'Parent Trust Ad — 45s'],
    ['o', 'On it after Physics. Do we have the new logo files?', null, true],
  ]);
  await thread(ids.editors.arjun, 'manager_editor', 'serum', [
    ['m', 'Arjun, Before / After is past your deadline and the client deadline is today. Where are we?', 'Before / After — 7 Day Glow'],
    ['o', 'Sorry — day-7 footage came in late. Grading now, first cut in 3 hours.', null, true],
  ]);
  await thread(ids.editors.isha, 'manager_editor', 'bandra', [
    ['m', 'Isha, Ribbon Cutting Highlights is overdue — can you prioritise it over the farms B-roll?', 'Ribbon Cutting Highlights'],
    ['o', 'Yes, switching now. Should be with you tonight.'],
  ]);
  await thread(ids.clients.chai, 'manager_client', 'bandra', [
    ['o', 'Hi! Any update on the opening teaser? We want to post it this weekend.'],
    ['m', 'Hi Rohan — the first cut is in internal review now. You’ll have it for review tomorrow.'],
    ['o', 'Amazing, thank you!'],
  ]);
  await thread(ids.clients.kesari, 'manager_client', 'serum', [
    ['m', 'Meera, the Unboxing ASMR reel is ready for your review.', 'Unboxing ASMR Reel'],
    ['o', 'Watching now — the sound design is gorgeous. Will approve by evening.', null, true],
  ]);

  const counts = {
    users: await User.countDocuments(),
    projects: await Project.countDocuments(),
    videos: await Video.countDocuments(),
    conversations: await Conversation.countDocuments(),
    messages: await Message.countDocuments(),
  };
  log(`\nSeeded: ${counts.users} users, ${counts.projects} projects, ${counts.videos} videos, ${counts.conversations} conversations, ${counts.messages} messages\n`);
  log('Demo logins');
  log('-----------');
  log(`Manager  ${data.users.manager.email.padEnd(28)} ${data.users.manager.password}`);
  data.users.editors.forEach((e) => log(`Editor   ${e.email.padEnd(28)} ${data.users.editorPassword}`));
  data.users.clients.forEach((c) => log(`Client   ${c.email.padEnd(28)} ${data.users.clientPassword}   (${c.company})`));
  log('');
  return counts;
}

module.exports = { seed };

if (require.main === module) {
  (async () => {
    if (env.isProd && !process.argv.includes('--force')) {
      console.error('Refusing to wipe a production database. Re-run with --force if you really mean it.');
      process.exit(1);
    }
    try {
      await connectDB(env.MONGO_URI);
      await seed();
    } catch (err) {
      console.error('Seed failed:', err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
