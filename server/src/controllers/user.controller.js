const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ValidationError = require('../utils/ValidationError');
const { notFound } = require('../utils/HttpError');
const { sameId } = require('../utils/helpers');
const { ROLES } = require('../utils/constants');

// GET /api/users?role=editor&q=kab
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) {
    if (!ROLES.includes(req.query.role)) throw new ValidationError(`role must be one of: ${ROLES.join(', ')}`);
    filter.role = req.query.role;
  }
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const users = await User.find(filter).sort({ role: 1, name: 1 });
  return res.status(200).json({ data: users });
});

// GET /api/users/:id
exports.get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User');
  return res.status(200).json({ data: user });
});

// PATCH /api/users/:id
exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User');
  const { name, email, company, skills, avatarUrl, isActive, password } = req.body;

  if (isActive === false && sameId(user._id, req.user.id)) {
    throw new ValidationError('You cannot deactivate your own account');
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (company !== undefined && user.role === 'client') user.company = company;
  if (skills !== undefined && user.role === 'editor') user.skills = skills;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (isActive !== undefined) user.isActive = isActive;
  if (password) user.passwordHash = await User.hashPassword(password);

  await user.save();
  return res.status(200).json({ data: user });
});
