const mongoose = require('mongoose');
const { CONVERSATION_TYPES } = require('../utils/constants');

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    // Sorted "idA:idB" — the unique index guarantees one thread per pair of people.
    participantKey: { type: String, required: true, unique: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.keyFor = (a, b) => [String(a), String(b)].sort().join(':');

module.exports = mongoose.model('Conversation', conversationSchema);
