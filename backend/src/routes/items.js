const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { isNum, fmtItem } = require('../utils/format');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');

const TYPES = ['VEG', 'NON_VEG', 'EGG'];
const include = { category: true, addonGroups: { select: { id: true } } };

// Checks the body and builds the data for Prisma. `create` = all required fields must be present.
function parse(b, create) {
  const d = {};
  if (create || b.name !== undefined) {
    if (!b.name || !String(b.name).trim()) return { error: 'name is required' };
    d.name = String(b.name).trim();
  }
  if (create || b.price !== undefined) {
    if (!isNum(b.price) || Number(b.price) < 0) return { error: 'price must be a number >= 0' };
    d.price = Number(b.price);
  }
  if (create || b.categoryId !== undefined) {
    if (!Number.isInteger(Number(b.categoryId)) || Number(b.categoryId) < 1)
      return { error: 'categoryId is required' };
    d.categoryId = Number(b.categoryId);
  }
  if (b.type !== undefined) {
    if (!TYPES.includes(b.type)) return { error: 'type must be VEG, NON_VEG or EGG' };
    d.type = b.type;
  }
  if (b.imageUrl) {
    if (!/^(data:image\/|https?:\/\/)/.test(b.imageUrl)) return { error: 'imageUrl must be an image data URL or http link' };
  }
  if (b.imageUrl !== undefined) d.imageUrl = b.imageUrl || null;
  if (b.description !== undefined) d.description = b.description;
  if (b.active !== undefined) d.active = !!b.active;

  let groups;
  if (b.addonGroupIds !== undefined) {
    if (!Array.isArray(b.addonGroupIds)) return { error: 'addonGroupIds must be an array' };
    groups = b.addonGroupIds.map((id) => ({ id: Number(id) }));
  }
  return { data: d, groups };
}

router.get('/', asyncHandler(async (req, res) => {
  const { categoryId, type, q, active } = req.query;
  const where = {};
  if (categoryId) where.categoryId = Number(categoryId);
  if (TYPES.includes(type)) where.type = type;
  if (active === 'true' || active === 'false') where.active = active === 'true';
  if (q) where.name = { contains: String(q), mode: 'insensitive' };
  const rows = await prisma.menuItem.findMany({ where, include, orderBy: { id: 'asc' } });
  res.json(rows.map(fmtItem));
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { data, groups, error } = parse(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  if (groups) data.addonGroups = { connect: groups };
  const row = await prisma.menuItem.create({ data, include });
  res.status(201).json(fmtItem(row));
}));

router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { data, groups, error } = parse(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  if (groups) data.addonGroups = { set: groups };
  const row = await prisma.menuItem.update({ where: { id: req.id }, data, include });
  res.json(fmtItem(row));
}));

// If the item is already in past orders, delete is blocked (409). Hide it instead: PUT { "active": false }
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.menuItem.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;