const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');

router.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.category.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  res.json(rows.map(({ _count, ...c }) => ({ ...c, itemCount: _count.items })));
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { name, emoji, description, active } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  const row = await prisma.category.create({
    data: { name: String(name).trim(), emoji, description, active: active ?? true },
  });
  res.status(201).json(row);
}));

router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { name, emoji, description, active } = req.body || {};
  const data = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = String(name).trim();
  }
  if (emoji !== undefined) data.emoji = emoji;
  if (description !== undefined) data.description = description;
  if (active !== undefined) data.active = !!active;
  res.json(await prisma.category.update({ where: { id: req.id }, data }));
}));

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;