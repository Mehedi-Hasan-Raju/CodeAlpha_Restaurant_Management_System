const router = require('express').Router();
const { emit } = require('../realtime');
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num } = require('../utils/format');
const { price, money, TAX_RATE } = require('../utils/pricing');
require('../utils/idParam')(router);

router.use(authenticate);
const staff = requireRole('ADMIN', 'CASHIER');
const orderAccess = requireRole('ADMIN', 'KITCHEN');

const TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
const STATUSES = ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
const ACTIVE = ['NEW', 'PREPARING', 'READY'];
const FLOW = {
  NEW: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: [],
};

const include = {
  items: { orderBy: { id: 'asc' } },
  table: { select: { name: true } },
  customer: { select: { name: true } },
  coupon: { select: { code: true } },
};

const fmt = (o) => ({
  id: o.id,
  type: o.type,
  status: o.status,
  subtotal: num(o.subtotal),
  discount: num(o.discount),
  tax: num(o.tax),
  total: num(o.total),
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  tableId: o.tableId,
  tableName: o.table ? o.table.name : null,
  customerId: o.customerId,
  customerName: o.customer ? o.customer.name : null,
  couponCode: o.coupon ? o.coupon.code : null,
  items: o.items.map((i) => ({
    id: i.id, menuItemId: i.menuItemId, name: i.name, quantity: i.quantity,
    unitPrice: num(i.unitPrice), options: i.options,
  })),
});

// Price check only. Nothing is saved. The POS cart can call this to show totals.
router.post('/quote', staff, asyncHandler(async (req, res) => {
  const p = await price(req.body);
  if (p.error) return res.status(p.code).json({ error: p.error });
  res.json({
    lines: p.lines.map((l) => ({
      menuItemId: l.menuItemId, name: l.name, quantity: l.quantity, options: l.options,
      unitPrice: money(l.unitC), lineTotal: money(l.unitC * l.quantity),
    })),
    subtotal: money(p.subtotalC),
    discount: money(p.discountC),
    tax: money(p.taxC),
    total: money(p.totalC),
    taxRate: TAX_RATE,
    couponCode: p.coupon ? p.coupon.code : null,
  });
}));

router.post('/', staff, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!TYPES.includes(b.type)) return res.status(400).json({ error: 'type must be DINE_IN, TAKEAWAY or DELIVERY' });

  let tableId = null;
  if (b.type === 'DINE_IN') {
    if (!b.tableId) return res.status(400).json({ error: 'tableId is required for dine-in orders' });
    const table = await prisma.diningTable.findUnique({ where: { id: Number(b.tableId) } });
    if (!table) return res.status(400).json({ error: 'Table not found' });
    tableId = table.id;
  }

  let customerId = null;
  if (b.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: Number(b.customerId) } });
    if (!c) return res.status(400).json({ error: 'Customer not found' });
    customerId = c.id;
  }

  const p = await price(b);
  if (p.error) return res.status(p.code).json({ error: p.error });

  try {
    const order = await prisma.$transaction(async (tx) => {
      // count the coupon use atomically: this fails if the limit was reached a moment ago by another order
      if (p.coupon) {
        const n = await tx.$executeRaw`UPDATE "Coupon" SET "used" = "used" + 1 WHERE "id" = ${p.coupon.id} AND ("maxUses" IS NULL OR "used" < "maxUses")`;
        if (n === 0) throw new Error('COUPON_LIMIT');
      }
      const o = await tx.order.create({
        data: {
          type: b.type,
          subtotal: money(p.subtotalC),
          discount: money(p.discountC),
          tax: money(p.taxC),
          total: money(p.totalC),
          tableId,
          customerId,
          couponId: p.coupon ? p.coupon.id : null,
          createdById: req.user.id,
          items: {
            create: p.lines.map((l) => ({
              menuItemId: l.menuItemId, name: l.name, quantity: l.quantity,
              unitPrice: money(l.unitC), options: l.options,
            })),
          },
        },
        include,
      });
      if (tableId) await tx.diningTable.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
      return o;
    });
    emit('order:created', fmt(order));
    if (tableId) emit('table:changed', { id: tableId });
    res.status(201).json(fmt(order));
  } catch (e) {
    if (e.message === 'COUPON_LIMIT') return res.status(400).json({ error: 'Coupon usage limit reached' });
    throw e;
  }
}));

// List with filters. status can be one value or several: ?status=NEW,PREPARING
router.get('/', orderAccess, asyncHandler(async (req, res) => {
  const { status, type, date, tableId } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const where = {};
  if (status) {
    const list = String(status).split(',').filter((s) => STATUSES.includes(s));
    if (list.length) where.status = { in: list };
  }
  if (TYPES.includes(type)) where.type = type;
  if (tableId) where.tableId = Number(tableId);
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const from = new Date(date + 'T00:00:00');
    where.createdAt = { gte: from, lt: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, include, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.order.count({ where }),
  ]);
  res.json({ data: rows.map(fmt), total, page, limit });
}));

router.get('/:id', orderAccess, asyncHandler(async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: req.id }, include });
  if (!o) return res.status(404).json({ error: 'Order not found' });
  res.json(fmt(o));
}));

// Kitchen and admin can move an order forward. Only admin can cancel.
router.patch('/:id/status', orderAccess, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of ' + STATUSES.join(', ') });

  const o = await prisma.order.findUnique({ where: { id: req.id } });
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (!FLOW[o.status].includes(status)) return res.status(400).json({ error: `Cannot change ${o.status} to ${status}` });
  if (status === 'CANCELLED' && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Only admin can cancel an order' });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: o.id }, data: { status }, include });
    if (status === 'CANCELLED') {
      if (o.couponId) await tx.coupon.update({ where: { id: o.couponId }, data: { used: { decrement: 1 } } });
      if (o.tableId) {
        const open = await tx.order.count({ where: { tableId: o.tableId, id: { not: o.id }, status: { in: ACTIVE } } });
        if (!open) await tx.diningTable.updateMany({ where: { id: o.tableId, status: 'OCCUPIED' }, data: { status: 'AVAILABLE' } });
      }
    }
    return u;
  });
  emit('order:updated', fmt(updated));
  if (o.tableId) emit('table:changed', { id: o.tableId });
  res.json(fmt(updated));
}));

module.exports = router;