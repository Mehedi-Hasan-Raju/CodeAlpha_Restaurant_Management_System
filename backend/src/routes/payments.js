const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num, isNum } = require('../utils/format');
const { cents, paidCents, syncInvoice, lockInvoice } = require('../utils/billing');
require('../utils/idParam')(router);

router.use(authenticate, requireRole('ADMIN', 'CASHIER'));

const METHODS = ['CARD', 'UPI', 'CASH', 'ONLINE'];
const STATUSES = ['COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'];
const FLOW = { PENDING: ['COMPLETED', 'FAILED'], COMPLETED: ['REFUNDED'], FAILED: [], REFUNDED: [] };
const include = { invoice: { select: { number: true } }, customer: { select: { name: true } } };

const fmt = (p) => ({
  id: p.id,
  reference: p.reference,
  createdAt: p.createdAt,
  method: p.method,
  amount: num(p.amount),
  status: p.status,
  invoiceId: p.invoiceId,
  invoiceNumber: p.invoice ? p.invoice.number : null,
  customerName: p.customer ? p.customer.name : null,
});

// errors thrown inside a transaction are turned into clean replies here
function known(e, res, status) {
  if (e.message.startsWith('OVER:')) {
    res.status(400).json({ error: `Amount is more than the balance (${(Number(e.message.slice(5)) / 100).toFixed(2)})` });
    return true;
  }
  if (e.message.startsWith('BAD_FLOW:')) {
    res.status(400).json({ error: `Cannot change ${e.message.slice(9)} to ${status}` });
    return true;
  }
  const map = {
    NO_INVOICE: [404, 'Invoice not found'],
    NO_PAYMENT: [404, 'Payment not found'],
    CANCELLED: [400, 'This invoice is cancelled'],
  };
  if (map[e.message]) {
    res.status(map[e.message][0]).json({ error: map[e.message][1] });
    return true;
  }
  return false;
}

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const invoiceId = Number(b.invoiceId);
  const status = b.status === undefined ? 'COMPLETED' : b.status;

  if (!Number.isInteger(invoiceId) || invoiceId < 1) return res.status(400).json({ error: 'invoiceId is required' });
  if (!METHODS.includes(b.method)) return res.status(400).json({ error: 'method must be one of ' + METHODS.join(', ') });
  if (!['COMPLETED', 'PENDING'].includes(status)) return res.status(400).json({ error: 'a new payment can only be COMPLETED or PENDING' });
  if (!isNum(b.amount) || Number(b.amount) <= 0) return res.status(400).json({ error: 'amount must be a number > 0' });
  const amountC = cents(b.amount);
  if (Math.abs(Number(b.amount) * 100 - amountC) > 1e-6) return res.status(400).json({ error: 'amount can have at most 2 decimals' });

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, invoiceId);
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) throw new Error('NO_INVOICE');
      if (inv.status === 'CANCELLED') throw new Error('CANCELLED');

      const balance = cents(inv.total) - (await paidCents(tx, invoiceId));
      if (amountC > balance) throw new Error('OVER:' + balance);

      const created = await tx.payment.create({
        data: {
          reference: 'TMP-' + crypto.randomBytes(6).toString('hex'),
          method: b.method, amount: amountC / 100, status, invoiceId, customerId: inv.customerId,
        },
      });
      const done = await tx.payment.update({
        where: { id: created.id }, data: { reference: `PAY-${100000 + created.id}` }, include,
      });
      await syncInvoice(tx, invoiceId);
      return done;
    });
    res.status(201).json(fmt(payment));
  } catch (e) {
    if (!known(e, res)) throw e;
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, method, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (METHODS.includes(method)) where.method = method;
  if (q) where.OR = [
    { reference: { contains: String(q), mode: 'insensitive' } },
    { invoice: { number: { contains: String(q), mode: 'insensitive' } } },
    { customer: { name: { contains: String(q), mode: 'insensitive' } } },
  ];

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({ where, include, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.payment.count({ where }),
  ]);
  res.json({ data: rows.map(fmt), total, page, limit });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.id }, include });
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  res.json(fmt(p));
}));

// PENDING -> COMPLETED or FAILED.   COMPLETED -> REFUNDED (admin only).
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of ' + STATUSES.join(', ') });
  if (status === 'REFUNDED' && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admin can refund a payment' });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const first = await tx.payment.findUnique({ where: { id: req.id } });
      if (!first) throw new Error('NO_PAYMENT');
      await lockInvoice(tx, first.invoiceId);

      const cur = await tx.payment.findUnique({ where: { id: req.id } }); // read again after the lock
      if (!FLOW[cur.status].includes(status)) throw new Error('BAD_FLOW:' + cur.status);

      if (status === 'COMPLETED') {
        const inv = await tx.invoice.findUnique({ where: { id: cur.invoiceId } });
        if (inv.status === 'CANCELLED') throw new Error('CANCELLED');
        const balance = cents(inv.total) - (await paidCents(tx, inv.id));
        if (cents(cur.amount) > balance) throw new Error('OVER:' + balance);
      }
      const u = await tx.payment.update({ where: { id: req.id }, data: { status }, include });
      await syncInvoice(tx, cur.invoiceId);
      return u;
    });
    res.json(fmt(updated));
  } catch (e) {
    if (!known(e, res, status)) throw e;
  }
}));

module.exports = router;