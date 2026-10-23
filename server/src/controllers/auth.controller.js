const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/HttpError');
const { signToken } = require('../middleware/auth');

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');
  if (req.body.role && req.body.role !== user.role) {
    const article = user.role === 'editor' ? 'an' : 'a';
    throw new HttpError(403, `This is ${article} ${user.role} account. Please use the ${user.role} login.`);
  }
  return res.status(200).json({ data: { token: signToken(user), user: user.toJSON() } });
});

// POST /api/auth/register  (manager only: creates editor or client accounts)
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, company, skills, avatarUrl } = req.body;
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    company: role === 'client' ? company : undefined,
    skills: role === 'editor' && Array.isArray(skills) ? skills : [],
    avatarUrl,
  });
  return res.status(201).json({ data: user.toJSON() });
});

// GET /api/auth/me
exports.me = (req, res) => res.status(200).json({ data: req.user.doc.toJSON() });
