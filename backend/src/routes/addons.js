const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { isNum, fmtGroup } = require('../utils/format');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');
const include = { options: { orderBy: { id: 'asc' } } };

function readOptions(list) {
  if (!Array.isArray(list)) return { error: 'options must be an array' };
  const out = [];
  for (const o of list) {
    if (!o || !String(o.name || '').trim()) return { error: 'every option needs a name' };
    if (o.extraPrice !== undefined && (!isNum(o.extraPrice) || Number(o.extraPrice) < 0))
      return { error: 'extraPrice must be a number >= 0' };
    out.push({ name: String(o.name).trim(), extraPrice: Number(o.extraPrice || 0) });
  }
  return { out };
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.addonGroup.findMany({ include, orderBy: { id: 'asc' } });
  res.json(rows.map(fmtGroup));
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name is required' });
  const { out, error } = readOptions(b.options || []);
  if (error) return res.status(400).json({ error });
  const row = await prisma.addonGroup.create({
    data: {
      name: String(b.name).trim(),
      multiple: !!b.multiple,
      required: !!b.required,
      maxSelect: Number(b.maxSelect) || 1,
      active: b.active ?? true,
      options: { create: out },
    },
    include,
  });
  res.status(201).json(fmtGroup(row));
}));

// If "options" is sent, the old options are replaced by the new list.
router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.name !== undefined) {
    if (!String(b.name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = String(b.name).trim();
  }
  if (b.multiple !== undefined) data.multiple = !!b.multiple;
  if (b.required !== undefined) data.required = !!b.required;
  if (b.maxSelect !== undefined) data.maxSelect = Number(b.maxSelect) || 1;
  if (b.active !== undefined) data.active = !!b.active;

  const ops = [];
  if (b.options !== undefined) {
    const { out, error } = readOptions(b.options);
    if (error) return res.status(400).json({ error });
    ops.push(prisma.addonOption.deleteMany({ where: { groupId: req.id } }));
    data.options = { create: out };
  }
  ops.push(prisma.addonGroup.update({ where: { id: req.id }, data, include }));
  const result = await prisma.$transaction(ops);
  res.json(fmtGroup(result[result.length - 1]));
}));

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.addonGroup.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;