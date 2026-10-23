const mongoose = require('mongoose');
const { PROJECT_STATUSES } = require('../utils/constants');
const { invalidatesDashboard } = require('../services/cache');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Client is required'] },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    totalVideos: { type: Number, required: [true, 'Total videos is required'], min: 1, max: 500 },
    clientDeadline: { type: Date, required: [true, 'Client deadline is required'] },
    status: { type: String, enum: PROJECT_STATUSES, default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false }
);

projectSchema.index({ client: 1 });
projectSchema.plugin(invalidatesDashboard);

module.exports = mongoose.model('Project', projectSchema);
