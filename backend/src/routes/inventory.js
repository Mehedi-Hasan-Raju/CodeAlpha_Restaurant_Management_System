const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num, isNum } = require('../utils/format');
const { emit } = require('../realtime');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');

const UNITS = ['kg', 'g', 'ltr', 'ml', 'pcs', 'pack'];
const LIMIT = 1000000;

const dec2 = (v) => Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) < 1e-6;
const statusOf = (stock, min) => (stock === 0 ? 'OUT' : stock < min ? 'LOW' : 'ADEQUATE');

const fmt = (i) => {
  const stock = num(i.stock), min = num(i.minStock), max = num(i.maxStock);
  return {
    id: i.id, name: i.name, category: i.category, unit: i.unit,
    stock, minStock: min, maxStock: max,
    status: statusOf(stock, min),
    levelPercent: max > 0 ? Math.min(100, Math.round((stock / max) * 100)) : 0,
    updatedAt: i.updatedAt,
  };
};

// a stock-like number: >= 0, at most 2 decimals, not huge
function qty(v, label) {
  if (!isNum(v) || Number(v) < 0 || Number(v) > LIMIT || !dec2(v)) return { error: `${label} must be a number from 0 to ${LIMIT} (max 2 decimals)` };
  return { value: Math.round(Number(v) * 100) / 100 };
}

function parse(b, create, old) {
  const d = {};
  if (create || b.name !== undefined) {
    if (!b.name || !String(b.name).trim()) return { error: 'name is required' };
    d.name = String(b.name).trim();
  }
  if (create || b.category !== undefined) {
    if (!b.category || !String(b.category).trim()) return { error: 'category is required' };
    d.category = String(b.category).trim();
  }
  if (create || b.unit !== undefined) {
    if (!UNITS.includes(b.unit)) return { error: 'unit must be one of ' + UNITS.join(', ') };
    d.unit = b.unit;
  }
  for (const k of ['stock', 'minStock', 'maxStock']) {
    if (b[k] !== undefined) {
      const r = qty(b[k], k);
      if (r.error) return { error: r.error };
      d[k] = r.value;
    }
  }
  if (create && b.maxStock === undefined) return { error: 'maxStock is required' };

  const min = d.minStock ?? (old ? num(old.minStock) : 0);
  const max = d.maxStock ?? (old ? num(old.maxStock) : 0);
  if (max <= 0) return { error: 'maxStock must be greater than 0' };
  if (min > max) return { error: 'minStock cannot be more than maxStock' };
  return { data: d };
}

// All items in one reply, because an inventory list is small. Also returns the numbers for the stat cards.
router.get('/', asyncHandler(async (req, res) => {
  const { status, category, q } = req.query;
  const where = {};
  if (category) where.category = String(category);
  if (q) where.name = { contains: String(q), mode: 'insensitive' };

  const all = (await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } })).map(fmt);
  const stats = {
    total: all.length,
    low: all.filter((i) => i.status === 'LOW').length,
    out: all.filter((i) => i.status === 'OUT').length,
  };
  const want = String(status || '').toUpperCase();
  res.json({ data: ['ADEQUATE', 'LOW', 'OUT'].includes(want) ? all.filter((i) => i.status === want) : all, stats });
}));

// Items that need attention (low or out), worst first
router.get('/alerts', asyncHandler(async (req, res) => {
  const rows = (await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } })).map(fmt)
    .filter((i) => i.status !== 'ADEQUATE')
    .sort((a, b) => (a.status === 'OUT' ? 0 : 1) - (b.status === 'OUT' ? 0 : 1));
  res.json(rows);
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, true, null);
  if (error) return res.status(400).json({ error });
  const item = fmt(await prisma.inventoryItem.create({ data }));
  emit('inventory:updated', item);
  res.status(201).json(item);
}));

router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const old = await prisma.inventoryItem.findUnique({ where: { id: req.id } });
  if (!old) return res.status(404).json({ error: 'Item not found' });
  const { data, error } = parse(req.body || {}, false, old);
  if (error) return res.status(400).json({ error });
  const item = fmt(await prisma.inventoryItem.update({ where: { id: req.id }, data }));
  emit('inventory:updated', item);
  res.json(item);
}));

// The +/- buttons. Body: { "delta": 5 } to add, { "delta": -2 } to use.
router.patch('/:id/adjust', asyncHandler(async (req, res) => {
  const { delta } = req.body || {};
  if (!isNum(delta) || Number(delta) === 0 || Math.abs(Number(delta)) > LIMIT || !dec2(delta))
    return res.status(400).json({ error: `delta must be a non-zero number (max 2 decimals, up to ${LIMIT})` });
  const d = (Math.round(Number(delta) * 100) / 100).toFixed(2);

  // one statement checks and changes the stock, so it cannot go below zero even with two clicks at once
  const changed = await prisma.$queryRaw`
    UPDATE "InventoryItem" SET "stock" = "stock" + ${d}::numeric, "updatedAt" = NOW()
    WHERE "id" = ${req.id} AND "stock" + ${d}::numeric >= 0
    RETURNING "id"`;

  const current = await prisma.inventoryItem.findUnique({ where: { id: req.id } });
  if (!current) return res.status(404).json({ error: 'Item not found' });
  if (!changed.length) return res.status(400).json({ error: `Not enough stock (current: ${num(current.stock)} ${current.unit})` });

  const item = fmt(current);
  emit('inventory:updated', item);
  res.json(item);
}));

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.inventoryItem.delete({ where: { id: req.id } });
  emit('inventory:deleted', { id: req.id });
  res.json({ ok: true });
}));

module.exports = router;