const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

// never send the password hash to the browser
const safe = ({ passwordHash, ...user }) => user;

// Public registration always creates a CASHIER. Admins are created by the seed script.
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const mail = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: mail } });
  if (exists) return res.status(409).json({ error: 'This email is already registered' });

  const user = await prisma.user.create({
    data: { name: name.trim(), email: mail, passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({ user: safe(user), token: sign(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ user: safe(user), token: sign(user) });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ user: safe(user) });
}));

module.exports = router;