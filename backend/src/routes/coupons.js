const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { isNum, fmtCoupon } = require('../utils/format');
require('../utils/idParam')(router);

router.use(authenticate);
const adminOnly = requireRole('ADMIN');
const KINDS = ['PERCENTAGE', 'FLAT'];

function parse(b, create) {
  const d = {};
  if (create || b.code !== undefined) {
    if (!b.code || !String(b.code).trim()) return { error: 'code is required' };
    d.code = String(b.code).trim().toUpperCase();
  }
  if (create || b.discountType !== undefined) {
    if (!KINDS.includes(b.discountType)) return { error: 'discountType must be PERCENTAGE or FLAT' };
    d.discountType = b.discountType;
  }
  if (create || b.value !== undefined) {
    if (!isNum(b.value) || Number(b.value) <= 0) return { error: 'value must be a number > 0' };
    d.value = Number(b.value);
  }
  const type = d.discountType || b.discountType;
  if (type === 'PERCENTAGE' && d.value > 100) return { error: 'percentage cannot be more than 100' };
  if (b.minOrder !== undefined) {
    if (!isNum(b.minOrder) || Number(b.minOrder) < 0) return { error: 'minOrder must be a number >= 0' };
    d.minOrder = Number(b.minOrder);
  }
  if (b.expiresAt !== undefined) {
    d.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    if (d.expiresAt && Number.isNaN(d.expiresAt.getTime())) return { error: 'expiresAt is not a valid date' };
  }
  if (b.maxUses !== undefined) d.maxUses = b.maxUses ? Number(b.maxUses) : null;
  if (b.description !== undefined) d.description = b.description;
  if (b.active !== undefined) d.active = !!b.active;
  return { data: d };
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.coupon.findMany({ orderBy: { id: 'asc' } });
  res.json(rows.map(fmtCoupon));
}));

// POS asks: "is this code valid for this subtotal, and how much is the discount?"
router.post('/validate', asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code || !isNum(subtotal)) return res.status(400).json({ error: 'code and subtotal are required' });
  const c = await prisma.coupon.findUnique({ where: { code: String(code).trim().toUpperCase() } });
  if (!c || !c.active) return res.status(404).json({ error: 'Invalid coupon' });
  if (c.expiresAt && c.expiresAt < new Date()) return res.status(400).json({ error: 'Coupon has expired' });
  if (c.maxUses && c.used >= c.maxUses) return res.status(400).json({ error: 'Coupon usage limit reached' });
  const sub = Number(subtotal);
  if (sub < Number(c.minOrder)) return res.status(400).json({ error: `Minimum order is ${Number(c.minOrder)}` });
  let discount = c.discountType === 'PERCENTAGE' ? (sub * Number(c.value)) / 100 : Number(c.value);
  discount = Math.round(Math.min(discount, sub) * 100) / 100;
  res.json({ coupon: fmtCoupon(c), discount });
}));

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  res.status(201).json(fmtCoupon(await prisma.coupon.create({ data })));
}));

router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = parse(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  res.json(fmtCoupon(await prisma.coupon.update({ where: { id: req.id }, data })));
}));

// If the coupon was already used in orders, delete is blocked (409). Use PUT { "active": false } instead.
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  await prisma.coupon.delete({ where: { id: req.id } });
  res.json({ ok: true });
}));

module.exports = router;