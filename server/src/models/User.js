const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { ROLES } = require('../utils/constants');
const { invalidatesDashboard } = require('../services/cache');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: { validator: (v) => validator.isEmail(v), message: 'Email must be a valid email' },
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: [true, 'Role is required'] },
    company: {
      type: String,
      trim: true,
      maxlength: 120,
      required: [function requiredForClient() { return this.role === 'client'; }, 'Company is required for clients'],
    },
    avatarUrl: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1 });

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 10);
userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.plugin(invalidatesDashboard); // names/companies appear on the dashboard

module.exports = mongoose.model('User', userSchema);
