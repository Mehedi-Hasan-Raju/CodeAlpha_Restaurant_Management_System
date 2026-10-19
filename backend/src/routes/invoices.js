const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num } = require('../utils/format');
const { cents, paidCents } = require('../utils/billing');
require('../utils/idParam')(router);

router.use(authenticate, requireRole('ADMIN', 'CASHIER'));
const adminOnly = requireRole('ADMIN');

const STATUSES = ['PAID', 'PENDING', 'CANCELLED'];
const include = {
  order: { select: { type: true } },
  customer: { select: { name: true } },
  payments: { orderBy: { id: 'asc' } },
};

const fmt = (i) => {
  const done = i.payments.filter((p) => p.status === 'COMPLETED');
  const paid = done.reduce((s, p) => s + cents(p.amount), 0);
  const last = done[done.length - 1];
  return {
    id: i.id,
    number: i.number,
    createdAt: i.createdAt,
    status: i.status,
    orderId: i.orderId,
    type: i.order ? i.order.type : null,
    customerId: i.customerId,
    customerName: i.customer ? i.customer.name : null,
    total: num(i.total),
    paid: paid / 100,
    balance: Math.max(0, cents(i.total) - paid) / 100,
    paymentMethod: last ? last.method : null,
  };
};

router.post('/', asyncHandler(async (req, res) => {
  const orderId = Number(req.body && req.body.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'orderId is required' });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot invoice a cancelled order' });
  if (await prisma.invoice.findUnique({ where: { orderId } }))
    return res.status(409).json({ error: 'This order already has an invoice' });

  try {
    const inv = await prisma.$transaction(async (tx) => {
      // the number needs the new id, so create with a temporary number and then set the real one
      const created = await tx.invoice.create({
        data: { number: 'TMP-' + crypto.randomBytes(6).toString('hex'), total: order.total, orderId, customerId: order.customerId },
      });
      return tx.invoice.update({
        where: { id: created.id },
        data: { number: `INV-${new Date().getFullYear()}-${String(created.id).padStart(4, '0')}` },
        include,
      });
    });
    res.status(201).json(fmt(inv));
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'This order already has an invoice' });
    throw e;
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (q) where.OR = [
    { number: { contains: String(q), mode: 'insensitive' } },
    { customer: { name: { contains: String(q), mode: 'insensitive' } } },
  ];

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({ where, include, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ data: rows.map(fmt), total, page, limit });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const i = await prisma.invoice.findUnique({
    where: { id: req.id },
    include: { ...include, order: { select: { type: true, subtotal: true, discount: true, tax: true, items: true } } },
  });
  if (!i) return res.status(404).json({ error: 'Invoice not found' });
  res.json({
    ...fmt(i),
    subtotal: num(i.order.subtotal),
    discount: num(i.order.discount),
    tax: num(i.order.tax),
    items: i.order.items.map((x) => ({ name: x.name, quantity: x.quantity, unitPrice: num(x.unitPrice), options: x.options })),
    payments: i.payments.map((p) => ({ id: p.id, reference: p.reference, method: p.method, amount: num(p.amount), status: p.status, createdAt: p.createdAt })),
  });
}));

// Admin only. Refund the payments first if money was already taken.
router.post('/:id/cancel', adminOnly, asyncHandler(async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: req.id } });
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'CANCELLED') return res.status(400).json({ error: 'Invoice is already cancelled' });
  if ((await paidCents(prisma, req.id)) > 0) return res.status(400).json({ error: 'Refund the payments before cancelling this invoice' });

  const [updated] = await prisma.$transaction([
    prisma.invoice.update({ where: { id: req.id }, data: { status: 'CANCELLED' }, include }),
    prisma.payment.updateMany({ where: { invoiceId: req.id, status: 'PENDING' }, data: { status: 'FAILED' } }),
  ]);
  res.json(fmt(updated));
}));

module.exports = router;