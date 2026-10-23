const mongoose = require('mongoose');
const { VIDEO_STATUSES } = require('../utils/constants');
const { isUrl } = require('../utils/helpers');
const { invalidatesDashboard } = require('../services/cache');

const { ObjectId } = mongoose.Schema.Types;
const urlCheck = { validator: (v) => !v || isUrl(v), message: 'Must be a valid http(s) URL' };

const versionSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true },
    link: { type: String, required: true, validate: urlCheck },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    submittedBy: { type: ObjectId, ref: 'User' },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: VIDEO_STATUSES, required: true },
    changedBy: { type: ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    brief: { type: String, trim: true, maxlength: 4000, default: '' },
    footageLink: { type: String, required: [true, 'Footage link is required'], trim: true, validate: urlCheck },
    referenceLinks: [{ type: String, trim: true, validate: urlCheck }],
    assignedEditor: { type: ObjectId, ref: 'User', default: null },
    editorDeadline: { type: Date, default: null },
    clientDeadline: { type: Date, required: true },
    status: { type: String, enum: VIDEO_STATUSES, default: 'footage_uploaded' },
    versions: [versionSchema],
    statusHistory: [historySchema],
    deliveryLink: { type: String, trim: true, validate: urlCheck },
    internalNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true, versionKey: false }
);

videoSchema.index({ project: 1 });
videoSchema.index({ assignedEditor: 1, status: 1 });
videoSchema.plugin(invalidatesDashboard);

module.exports = mongoose.model('Video', videoSchema);
