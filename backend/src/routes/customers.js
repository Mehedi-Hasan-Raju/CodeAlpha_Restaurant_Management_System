const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num } = require('../utils/format');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');
const staff = requireRole('ADMIN', 'CASHIER');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blank = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

function parse(b, create) {
  const d = {};
  if (create || b.name !== undefined) {
    if (!b.name || !String(b.name).trim()) return { error: 'name is required' };
    d.name = String(b.name).trim();
  }
  if (b.phone !== undefined) d.phone = blank(b.phone);
  if (b.email !== undefined) {
    const e = blank(b.email);
    if (e && !EMAIL.test(e)) return { error: 'email is not valid' };
    d.email = e ? e.toLowerCase() : null; // empty email must be null, because email is unique
  }
  return { data: d };
}

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = q
    ? { OR: [
        { name: { contains: String(q), mode: 'insensitive' } },
        { phone: { contains: String(q) } },
        { email: { contains: String(q), mode: 'insensitive' } },
      ] }
    : {};
  const [rows, sums] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { id: 'asc' }, include: { _count: { select: { orders: true } } } }),
    prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { not: null }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _max: { createdAt: true },
    }),
  ]);
  const byId = new Map(sums.map((s) => [s.customerId, s]));
  res.json(rows.map(({ _count, ...c }) => ({
    ...c,
    orders: _count.orders,
    totalSpent: num(byId.get(c.id)?._sum.total) || 0,
    lastVisit: byId.get(c.id)?._max.createdAt || null,
  })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await prisma.customer.findUnique({
    where: { id: req.id },
    include: { orders: { orderBy: { id: 'desc' }, take: 10, select: { id: true, type: true, status: true, total: true, createdAt: true } } },
  });
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  res.json({ ...c, orders: c.orders.map((o) => ({ ...o, total: num(o.total) })) });
}));

router.post('/', staff, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await prisma.customer.create({ data }));
}));

router.put('/:id', staff, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  res.json(await prisma.customer.update({ where: { id: req.id }, data }));
}));

// A customer who already has orders, invoices or payments cannot be deleted (409)
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;