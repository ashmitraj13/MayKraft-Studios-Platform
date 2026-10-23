const mongoose = require('mongoose');
const { ROLES } = require('../utils/constants');
const { TIMESTAMP_RE } = require('../utils/helpers');

const feedbackSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    text: { type: String, required: [true, 'Feedback text is required'], trim: true, maxlength: 4000 },
    timestampInVideo: {
      type: String,
      trim: true,
      validate: { validator: (v) => !v || TIMESTAMP_RE.test(v), message: 'Timestamp must look like 01:15' },
    },
    versionNumber: { type: Number, default: null },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

feedbackSchema.index({ video: 1, createdAt: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
